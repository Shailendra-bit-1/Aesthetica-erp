-- B01: Phase B logic fixes
-- Covers: B2 (proforma RPC), B3 (counsellor RLS), B4 (lead auto-stage trigger),
--         B8 (void wallet reversal), B11 (consume_session inventory deduction),
--         B15 (convert_lead acquisition copy), B16 (dispatch/receive transfer RPCs)

-- ─── B3: Block counsellor role from creating invoices ─────────────────────────
DROP POLICY IF EXISTS "invoices_no_counsellor_insert" ON pending_invoices;
CREATE POLICY "invoices_no_counsellor_insert" ON pending_invoices
  AS RESTRICTIVE FOR INSERT
  WITH CHECK (get_viewer_role() NOT IN ('counsellor'));

-- ─── B4: Auto-stage CRM lead to 'appointment_booked' on new appointment ───────
CREATE OR REPLACE FUNCTION sync_lead_stage_on_appointment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NEW.patient_id IS NULL THEN RETURN NEW; END IF;

  UPDATE crm_leads
  SET    status = 'appointment_booked'
  WHERE  id = (
    SELECT id FROM crm_leads
    WHERE  patient_id = NEW.patient_id
      AND  clinic_id  = NEW.clinic_id
      AND  status NOT IN ('converted','lost','junk','appointment_booked')
    ORDER  BY created_at DESC
    LIMIT  1
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_lead_stage_on_appointment ON appointments;
CREATE TRIGGER trg_sync_lead_stage_on_appointment
  AFTER INSERT ON appointments FOR EACH ROW
  EXECUTE FUNCTION sync_lead_stage_on_appointment();

-- ─── B8: void_invoice_safe — reverse wallet payments then void ────────────────
CREATE OR REPLACE FUNCTION void_invoice_safe(
  p_invoice_id UUID,
  p_actor_id   UUID DEFAULT NULL,
  p_reason     TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_inv RECORD;
  v_pay RECORD;
BEGIN
  SELECT * INTO v_inv FROM pending_invoices WHERE id = p_invoice_id FOR UPDATE;

  IF v_inv IS NULL THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;
  IF v_inv.status = 'void' THEN
    RAISE EXCEPTION 'Invoice is already voided';
  END IF;

  -- Reverse every wallet payment on this invoice
  FOR v_pay IN
    SELECT * FROM invoice_payments
    WHERE invoice_id = p_invoice_id AND payment_mode = 'wallet'
  LOOP
    PERFORM add_wallet_credit(
      v_inv.patient_id,
      v_pay.clinic_id,
      v_pay.amount,
      'Void reversal: ' || COALESCE(v_inv.invoice_number, p_invoice_id::text),
      p_invoice_id,
      'invoice',
      p_actor_id
    );
  END LOOP;

  UPDATE pending_invoices
  SET    status      = 'void',
         void_reason = p_reason,
         updated_at  = NOW()
  WHERE  id = p_invoice_id;
END;
$$;

-- ─── B11: consume_session — add commission_type + inventory deduction ─────────
CREATE OR REPLACE FUNCTION consume_session(
  p_credit_id      UUID,
  p_appointment_id UUID,
  p_provider_id    UUID,
  p_clinic_id      UUID,
  p_patient_id     UUID,
  p_session_date   DATE,
  p_commission_pct NUMERIC DEFAULT 10
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_credit        RECORD;
  v_session_value NUMERIC;
  v_commission    NUMERIC;
  v_log_id        UUID;
  v_commission_id UUID;
  v_consumable    RECORD;
  v_batch_id      UUID;
BEGIN
  SELECT * INTO v_credit
  FROM   patient_service_credits
  WHERE  id = p_credit_id
    AND  current_clinic_id = p_clinic_id
    AND  status = 'active'
  FOR UPDATE;

  IF v_credit IS NULL THEN
    RAISE EXCEPTION 'Credit % not found, not active, or does not belong to clinic %',
      p_credit_id, p_clinic_id;
  END IF;

  IF v_credit.used_sessions >= v_credit.total_sessions THEN
    RAISE EXCEPTION 'Credit % fully consumed (% of % sessions used)',
      p_credit_id, v_credit.used_sessions, v_credit.total_sessions;
  END IF;

  v_session_value := COALESCE(v_credit.per_session_value, 0);
  v_commission    := ROUND(v_session_value * (p_commission_pct / 100.0), 2);

  IF v_commission > v_session_value AND v_session_value > 0 THEN
    RAISE EXCEPTION 'Commission % exceeds session value %', v_commission, v_session_value;
  END IF;

  -- 1. Log consumption
  INSERT INTO credit_consumption_log (
    credit_id, patient_id, consumed_at_clinic_id,
    provider_id, commission_pct, commission_amount, session_date
  ) VALUES (
    p_credit_id, p_patient_id, p_clinic_id,
    p_provider_id, p_commission_pct, v_commission, p_session_date
  ) RETURNING id INTO v_log_id;

  -- 2. Increment used sessions
  UPDATE patient_service_credits
  SET    used_sessions = used_sessions + 1,
         status = CASE
           WHEN used_sessions + 1 >= total_sessions THEN 'completed'
           ELSE 'active'
         END
  WHERE  id = p_credit_id;

  -- 3. Commission with commission_type='delivery'
  IF v_commission > 0 AND p_provider_id IS NOT NULL THEN
    INSERT INTO staff_commissions (
      consumption_id, provider_id, clinic_id, patient_id,
      service_name, sale_amount, commission_pct, commission_amount,
      commission_type, status
    ) VALUES (
      v_log_id, p_provider_id, p_clinic_id, p_patient_id,
      v_credit.service_name, v_session_value, p_commission_pct, v_commission,
      'delivery', 'pending'
    ) RETURNING id INTO v_commission_id;
  END IF;

  -- 4. Mark appointment completed
  UPDATE appointments SET status = 'completed' WHERE id = p_appointment_id;

  -- 5. Deduct inventory for every service consumable (B11)
  IF v_credit.service_id IS NOT NULL THEN
    FOR v_consumable IN
      SELECT inventory_product_id, quantity_per_session
      FROM   service_consumables
      WHERE  service_id = v_credit.service_id
    LOOP
      -- FIFO: deduct from oldest batch with enough stock
      SELECT ib.id INTO v_batch_id
      FROM   inventory_batches ib
      JOIN   inventory_products ip ON ip.id = ib.product_id
      WHERE  ib.product_id          = v_consumable.inventory_product_id
        AND  ip.clinic_id           = p_clinic_id
        AND  ib.quantity_remaining  >= CEIL(v_consumable.quantity_per_session)
      ORDER  BY ib.received_at ASC
      LIMIT  1;

      IF v_batch_id IS NOT NULL THEN
        UPDATE inventory_batches
        SET    quantity_remaining = quantity_remaining - CEIL(v_consumable.quantity_per_session)
        WHERE  id = v_batch_id;

        INSERT INTO inventory_movements (
          clinic_id, product_id, batch_id, movement_type, quantity, reason,
          appointment_id, patient_id, performed_by, notes
        ) VALUES (
          p_clinic_id, v_consumable.inventory_product_id, v_batch_id,
          'consume', CEIL(v_consumable.quantity_per_session)::int,
          'session', p_appointment_id, p_patient_id, p_provider_id,
          'Auto-deducted: ' || v_credit.service_name
        );
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'log_id',         v_log_id,
    'commission_id',  v_commission_id,
    'session_value',  v_session_value,
    'commission',     v_commission,
    'sessions_used',  v_credit.used_sessions + 1,
    'sessions_total', v_credit.total_sessions
  );
END;
$$;

-- ─── B15: convert_lead — copy acquisition attribution to new patient ──────────
CREATE OR REPLACE FUNCTION convert_lead(
  p_lead_id   UUID,
  p_clinic_id UUID,
  p_full_name TEXT,
  p_phone     TEXT DEFAULT NULL,
  p_email     TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_patient_id UUID;
  v_lead       RECORD;
BEGIN
  SELECT * INTO v_lead FROM crm_leads WHERE id = p_lead_id;
  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead % not found', p_lead_id;
  END IF;
  IF v_lead.patient_id IS NOT NULL THEN
    RAISE EXCEPTION 'Lead is already converted to a patient';
  END IF;

  INSERT INTO patients (
    clinic_id, full_name, phone, email,
    acquisition_source, acquisition_campaign
  ) VALUES (
    p_clinic_id, p_full_name, p_phone, p_email,
    v_lead.source,
    COALESCE(v_lead.utm_campaign, v_lead.utm_source)
  ) RETURNING id INTO v_patient_id;

  UPDATE crm_leads
  SET    patient_id = v_patient_id,
         status     = 'converted'
  WHERE  id = p_lead_id;

  RETURN v_patient_id;
END;
$$;

-- ─── B16: dispatch_transfer — deduct source stock + mark in_transit ───────────
CREATE OR REPLACE FUNCTION dispatch_transfer(
  p_transfer_id UUID,
  p_actor_id    UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_tr       RECORD;
  v_batch_id UUID;
BEGIN
  SELECT * INTO v_tr FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF v_tr IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_tr.transfer_status != 'requested' THEN
    RAISE EXCEPTION 'Transfer must be in ''requested'' status to dispatch (current: %)',
      v_tr.transfer_status;
  END IF;

  -- FIFO batch selection from source clinic
  SELECT ib.id INTO v_batch_id
  FROM   inventory_batches ib
  JOIN   inventory_products ip ON ip.id = ib.product_id
  WHERE  ib.product_id          = v_tr.inventory_product_id
    AND  ip.clinic_id           = v_tr.from_clinic_id
    AND  ib.quantity_remaining  >= v_tr.quantity
  ORDER  BY ib.received_at ASC
  LIMIT  1;

  IF v_batch_id IS NULL THEN
    RAISE EXCEPTION 'Insufficient stock at source clinic for this transfer';
  END IF;

  UPDATE inventory_batches
  SET    quantity_remaining = quantity_remaining - v_tr.quantity
  WHERE  id = v_batch_id;

  INSERT INTO inventory_movements (
    clinic_id, product_id, batch_id, movement_type, quantity, reason, performed_by, notes
  ) VALUES (
    v_tr.from_clinic_id, v_tr.inventory_product_id, v_batch_id,
    'adjust_down', v_tr.quantity::int, 'transfer_out', p_actor_id,
    'Dispatched transfer ' || p_transfer_id::text
  );

  UPDATE inventory_transfers
  SET    transfer_status = 'in_transit',
         approved_by     = p_actor_id
  WHERE  id = p_transfer_id;
END;
$$;

-- ─── B16: receive_transfer — add stock at destination + mark received ─────────
CREATE OR REPLACE FUNCTION receive_transfer(
  p_transfer_id UUID,
  p_actor_id    UUID
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_tr          RECORD;
  v_src_product RECORD;
  v_dst_prod_id UUID;
  v_batch_id    UUID;
BEGIN
  SELECT * INTO v_tr FROM inventory_transfers WHERE id = p_transfer_id FOR UPDATE;

  IF v_tr IS NULL THEN RAISE EXCEPTION 'Transfer not found'; END IF;
  IF v_tr.transfer_status != 'in_transit' THEN
    RAISE EXCEPTION 'Transfer must be in_transit to receive (current: %)',
      v_tr.transfer_status;
  END IF;

  -- Get source product details
  SELECT * INTO v_src_product
  FROM   inventory_products WHERE id = v_tr.inventory_product_id;

  -- Find matching product at destination clinic by name (case-insensitive)
  SELECT id INTO v_dst_prod_id
  FROM   inventory_products
  WHERE  clinic_id = v_tr.to_clinic_id
    AND  LOWER(name) = LOWER(v_src_product.name)
    AND  is_active = true
  LIMIT  1;

  -- If no matching product at destination, create one
  IF v_dst_prod_id IS NULL THEN
    INSERT INTO inventory_products (
      clinic_id, name, brand, sku, product_type, category,
      unit, reorder_level, is_active
    ) VALUES (
      v_tr.to_clinic_id, v_src_product.name, v_src_product.brand,
      v_src_product.sku, v_src_product.product_type, v_src_product.category,
      v_src_product.unit, v_src_product.reorder_level, true
    ) RETURNING id INTO v_dst_prod_id;
  END IF;

  -- Create new batch at destination
  INSERT INTO inventory_batches (
    product_id, batch_number, purchase_price,
    quantity_received, quantity_remaining, received_by, received_at
  ) VALUES (
    v_dst_prod_id,
    'TFR-' || LEFT(p_transfer_id::text, 8),
    0,
    v_tr.quantity::int, v_tr.quantity::int,
    p_actor_id, NOW()
  ) RETURNING id INTO v_batch_id;

  -- Log inbound movement at destination
  INSERT INTO inventory_movements (
    clinic_id, product_id, batch_id, movement_type, quantity, reason, performed_by, notes
  ) VALUES (
    v_tr.to_clinic_id, v_dst_prod_id, v_batch_id,
    'receive', v_tr.quantity::int, 'transfer_in', p_actor_id,
    'Received transfer ' || p_transfer_id::text
  );

  UPDATE inventory_transfers
  SET    transfer_status = 'received',
         received_by     = p_actor_id,
         received_at     = NOW()
  WHERE  id = p_transfer_id;
END;
$$;

-- ─── B2: create_proforma_from_session RPC ─────────────────────────────────────
CREATE OR REPLACE FUNCTION create_proforma_from_session(
  p_session_id UUID,
  p_actor_id   UUID
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
  v_session    RECORD;
  v_patient    RECORD;
  v_inv_id     UUID;
  v_item       JSONB;
BEGIN
  SELECT cs.*, p.full_name AS patient_full_name
  INTO   v_session
  FROM   counselling_sessions cs
  JOIN   patients p ON p.id = cs.patient_id
  WHERE  cs.id = p_session_id;

  IF v_session IS NULL THEN RAISE EXCEPTION 'Counselling session not found'; END IF;

  INSERT INTO pending_invoices (
    clinic_id, patient_id, patient_name,
    invoice_type, proforma_status, proforma_expires_at,
    total_amount, status, metadata
  ) VALUES (
    v_session.clinic_id,
    v_session.patient_id,
    v_session.patient_full_name,
    'proforma', 'draft',
    NOW() + INTERVAL '24 hours',
    COALESCE(v_session.total_proposed, 0),
    'pending',
    jsonb_build_object('counselling_session_id', p_session_id)
  ) RETURNING id INTO v_inv_id;

  -- Populate line items from treatments_discussed
  IF v_session.treatments_discussed IS NOT NULL THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_session.treatments_discussed)
    LOOP
      INSERT INTO invoice_line_items (
        invoice_id, clinic_id, description,
        quantity, unit_price, discount_pct, gst_pct, line_total
      ) VALUES (
        v_inv_id,
        v_session.clinic_id,
        COALESCE(v_item->>'name', 'Treatment'),
        1,
        COALESCE((v_item->>'price')::numeric, 0),
        0, 0,
        COALESCE((v_item->>'price')::numeric, 0)
      );
    END LOOP;
  END IF;

  RETURN v_inv_id;
END;
$$;
