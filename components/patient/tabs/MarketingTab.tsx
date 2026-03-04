"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Target, MessageSquare, ExternalLink, Calendar, User, Star, ThumbsUp } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Patient, fmtDate } from "../types";

interface PatientFeedback {
  id: string;
  rating: number;
  comment: string | null;
  nps_score: number | null;
  submitted_at: string;
}

interface CrmLead {
  id: string;
  source: string | null;
  interest: string[] | null;
  status: string;
  next_followup: string | null;
}

interface CounsellingSession {
  id: string;
  session_date: string;
  chief_complaint: string | null;
  total_proposed: number | null;
  total_accepted: number | null;
  conversion_status: string;
  followup_date: string | null;
  notes: string | null;
  counsellor: { full_name: string } | null;
}

interface Props {
  patient: Patient;
  clinicId: string;
}

const LEAD_STATUS_CFG: Record<string, { bg: string; text: string; border: string }> = {
  new:        { bg: "rgba(59,130,246,0.08)",  text: "#1D4ED8", border: "rgba(59,130,246,0.3)" },
  contacted:  { bg: "rgba(251,191,36,0.1)",   text: "#92400E", border: "rgba(251,191,36,0.35)" },
  interested: { bg: "rgba(16,185,129,0.08)",  text: "#065F46", border: "rgba(16,185,129,0.3)" },
  converted:  { bg: "rgba(197,160,89,0.1)",   text: "#7A5518", border: "rgba(197,160,89,0.35)" },
  lost:       { bg: "rgba(107,114,128,0.08)", text: "#374151", border: "rgba(107,114,128,0.25)" },
  junk:       { bg: "rgba(220,38,38,0.06)",   text: "#991B1B", border: "rgba(220,38,38,0.2)" },
};

const CONV_STATUS_CFG: Record<string, { label: string; bg: string; text: string; border: string }> = {
  pending:   { label: "Pending",   bg: "rgba(251,191,36,0.1)",   text: "#92400E", border: "rgba(251,191,36,0.35)" },
  converted: { label: "Converted", bg: "rgba(197,160,89,0.1)",   text: "#7A5518", border: "rgba(197,160,89,0.35)" },
  partial:   { label: "Partial",   bg: "rgba(16,185,129,0.08)",  text: "#065F46", border: "rgba(16,185,129,0.3)" },
  declined:  { label: "Declined",  bg: "rgba(107,114,128,0.08)", text: "#374151", border: "rgba(107,114,128,0.25)" },
};

const fmtINR = (n: number | null) =>
  n == null ? "—" : `₹${n.toLocaleString("en-IN")}`;

export default function MarketingTab({ patient, clinicId }: Props) {
  const [leads, setLeads]       = useState<CrmLead[]>([]);
  const [sessions, setSessions] = useState<CounsellingSession[]>([]);
  const [feedback, setFeedback] = useState<PatientFeedback[]>([]);
  const [loading, setLoading]   = useState(true);

  // C8: Feedback form state
  const [showFeedbackForm,   setShowFeedbackForm]   = useState(false);
  const [feedbackRating,     setFeedbackRating]     = useState(0);
  const [feedbackHover,      setFeedbackHover]      = useState(0);
  const [feedbackComment,    setFeedbackComment]    = useState("");
  const [savingFeedback,     setSavingFeedback]     = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [leadsRes, sessionsRes, feedbackRes] = await Promise.all([
        supabase
          .from("crm_leads")
          .select("id, source, interest, status, next_followup")
          .eq("patient_id", patient.id)
          .eq("clinic_id", clinicId),
        supabase
          .from("counselling_sessions")
          .select("id, session_date, chief_complaint, total_proposed, total_accepted, conversion_status, followup_date, notes, counsellor:profiles!counsellor_id(full_name)")
          .eq("patient_id", patient.id)
          .eq("clinic_id", clinicId)
          .order("session_date", { ascending: false }),
        supabase
          .from("patient_feedback")
          .select("id, rating, comment, nps_score, submitted_at")
          .eq("patient_id", patient.id)
          .eq("clinic_id", clinicId)
          .order("submitted_at", { ascending: false }),
      ]);
      setLeads((leadsRes.data ?? []) as CrmLead[]);
      setSessions((sessionsRes.data ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        counsellor: Array.isArray(r.counsellor) ? (r.counsellor[0] ?? null) : (r.counsellor ?? null),
      })) as unknown as CounsellingSession[]);
      setFeedback((feedbackRes.data ?? []) as PatientFeedback[]);
      setLoading(false);
    }
    load();
  }, [patient.id, clinicId]);

  const submitFeedback = async () => {
    if (feedbackRating === 0) { toast.error("Please select a rating"); return; }
    setSavingFeedback(true);
    const { error } = await supabase.from("patient_feedback").insert({
      clinic_id:    clinicId,
      patient_id:   patient.id,
      rating:       feedbackRating,
      comment:      feedbackComment.trim() || null,
      submitted_at: new Date().toISOString(),
    });
    if (error) { toast.error("Failed to save feedback"); setSavingFeedback(false); return; }
    setFeedback(prev => [{ id: crypto.randomUUID(), rating: feedbackRating, comment: feedbackComment.trim() || null, nps_score: null, submitted_at: new Date().toISOString() }, ...prev]);
    setShowFeedbackForm(false);
    setFeedbackRating(0);
    setFeedbackComment("");
    setSavingFeedback(false);
    if (feedbackRating >= 4) {
      toast.success("Great feedback! Share it on Google.", { description: "Consider asking the patient to leave a Google review.", duration: 5000 });
    } else {
      // C10: insert admin notification for negative feedback
      supabase.from("notifications").insert({
        clinic_id:   clinicId,
        type:        "feedback",
        title:       "Negative feedback received",
        body:        `${patient.full_name} rated ${feedbackRating}/5${feedbackComment.trim() ? ` — "${feedbackComment.trim().slice(0, 60)}"` : ""}`,
        entity_type: "patient",
        action_url:  `/patients/${patient.id}`,
        is_read:     false,
      }).then(() => {});
      toast.warning("Feedback flagged — admin notified", { description: "A notification has been sent for follow-up." });
    }
  };

  // Conversion funnel stats
  const totalProposed  = sessions.reduce((s, r) => s + (r.total_proposed ?? 0), 0);
  const totalAccepted  = sessions.reduce((s, r) => s + (r.total_accepted ?? 0), 0);
  const convertedCount = sessions.filter(s => s.conversion_status === "converted").length;

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, textTransform: "uppercase",
    letterSpacing: "0.08em", color: "#6B7280",
  };

  const card: React.CSSProperties = {
    padding: "14px 16px", borderRadius: 12, background: "#fff",
    border: "1px solid rgba(197,160,89,0.15)", boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  };

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 22 }}>

      {/* Acquisition / interest */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <Target size={13} color="#C5A059" />
          <span style={sectionLabel}>Acquisition &amp; Interest</span>
        </div>
        <div style={card}>
          {(patient.primary_concern?.length ?? 0) > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 12, color: "#6B7280", marginRight: 4 }}>Interests:</span>
              {(patient.primary_concern ?? []).map(c => (
                <span key={c} style={{ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "rgba(197,160,89,0.1)", border: "1px solid rgba(197,160,89,0.3)", color: "#7A5518" }}>{c}</span>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0, fontStyle: "italic" }}>No primary concern recorded on patient profile</p>
          )}
        </div>
      </section>

      {/* CRM Leads */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <TrendingUp size={13} color="#C5A059" />
            <span style={sectionLabel}>CRM Leads</span>
          </div>
          <a href="/crm" style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "#C5A059", textDecoration: "none" }}>
            <ExternalLink size={12} /> View in CRM
          </a>
        </div>

        {loading ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
        ) : leads.length === 0 ? (
          <div style={{ ...card, textAlign: "center" }}>
            <TrendingUp size={28} color="rgba(197,160,89,0.3)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No CRM lead records linked to this patient</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {leads.map(lead => {
              const cfg = LEAD_STATUS_CFG[lead.status] ?? LEAD_STATUS_CFG.new;
              return (
                <div key={lead.id} style={card}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {lead.source && (
                        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 5 }}>
                          <span style={{ fontWeight: 600, color: "#1C1917" }}>Source:</span> {lead.source}
                        </div>
                      )}
                      {(lead.interest?.length ?? 0) > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {(lead.interest ?? []).map(i => (
                            <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "rgba(197,160,89,0.08)", color: "#C5A059", border: "1px solid rgba(197,160,89,0.2)" }}>{i}</span>
                          ))}
                        </div>
                      )}
                      {lead.next_followup && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Calendar size={11} color="#9CA3AF" />
                          <span style={{ fontSize: 11, color: "#6B7280" }}>Follow-up: {fmtDate(lead.next_followup)}</span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text, textTransform: "capitalize", flexShrink: 0 }}>
                      {lead.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Counselling sessions */}
      <section>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
          <MessageSquare size={13} color="#C5A059" />
          <span style={sectionLabel}>Counselling Sessions</span>
        </div>

        {/* Funnel summary — only if data exists */}
        {!loading && sessions.length > 0 && (
          <div style={{ padding: "10px 14px", borderRadius: 10, background: "rgba(197,160,89,0.06)", border: "1px solid rgba(197,160,89,0.2)", marginBottom: 10, fontSize: 13, color: "#7A5518" }}>
            <strong>{sessions.length}</strong> counselling session{sessions.length !== 1 ? "s" : ""}
            {" · "}
            <strong>{fmtINR(totalProposed)}</strong> proposed
            {" · "}
            <strong>{fmtINR(totalAccepted)}</strong> accepted
            {convertedCount > 0 && <>{" · "}<strong>{convertedCount}</strong> converted</>}
          </div>
        )}

        {loading ? (
          <p style={{ fontSize: 13, color: "#9CA3AF" }}>Loading…</p>
        ) : sessions.length === 0 ? (
          <div style={{ ...card, textAlign: "center" }}>
            <MessageSquare size={28} color="rgba(197,160,89,0.3)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No counselling sessions on record</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sessions.map(s => {
              const cvCfg = CONV_STATUS_CFG[s.conversion_status] ?? CONV_STATUS_CFG.pending;
              return (
                <div key={s.id} style={card}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Date + counsellor */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <Calendar size={11} color="#9CA3AF" />
                          <span style={{ fontSize: 12, fontWeight: 700, color: "#1C1917" }}>{fmtDate(s.session_date)}</span>
                        </div>
                        {s.counsellor?.full_name && (
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <User size={11} color="#9CA3AF" />
                            <span style={{ fontSize: 12, color: "#6B7280" }}>{s.counsellor.full_name}</span>
                          </div>
                        )}
                      </div>

                      {/* Chief complaint */}
                      {s.chief_complaint && (
                        <p style={{ fontSize: 13, color: "#374151", margin: "0 0 6px", fontFamily: "Georgia, serif", lineHeight: 1.5 }}>{s.chief_complaint}</p>
                      )}

                      {/* Financials */}
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {s.total_proposed != null && (
                          <div>
                            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF", fontWeight: 600 }}>Proposed </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#1C1917" }}>{fmtINR(s.total_proposed)}</span>
                          </div>
                        )}
                        {s.total_accepted != null && (
                          <div>
                            <span style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", color: "#9CA3AF", fontWeight: 600 }}>Accepted </span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#065F46" }}>{fmtINR(s.total_accepted)}</span>
                          </div>
                        )}
                      </div>

                      {/* Follow-up */}
                      {s.followup_date && (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6 }}>
                          <Calendar size={11} color="#C5A059" />
                          <span style={{ fontSize: 11, color: "#6B7280" }}>Follow-up: {fmtDate(s.followup_date)}</span>
                        </div>
                      )}
                    </div>

                    {/* Conversion badge */}
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: cvCfg.bg, border: `1px solid ${cvCfg.border}`, color: cvCfg.text, flexShrink: 0 }}>
                      {cvCfg.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* C8: Patient Feedback */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Star size={13} color="#C5A059" />
            <span style={sectionLabel}>Patient Feedback</span>
          </div>
          {!showFeedbackForm && (
            <button
              onClick={() => setShowFeedbackForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.35)", background: "rgba(197,160,89,0.07)", color: "#8B6914", cursor: "pointer" }}>
              <ThumbsUp size={11} /> Record Feedback
            </button>
          )}
        </div>

        {/* Feedback form */}
        {showFeedbackForm && (
          <div style={{ ...card, marginBottom: 10 }}>
            <p style={{ fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif", color: "#1C1917", marginBottom: 10 }}>Rate this patient&apos;s visit</p>
            {/* Star selector */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {[1,2,3,4,5].map(n => (
                <button key={n}
                  onMouseEnter={() => setFeedbackHover(n)}
                  onMouseLeave={() => setFeedbackHover(0)}
                  onClick={() => setFeedbackRating(n)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                  <Star size={28} fill={(feedbackHover || feedbackRating) >= n ? "#C5A059" : "none"} color={(feedbackHover || feedbackRating) >= n ? "#C5A059" : "#D1D5DB"} />
                </button>
              ))}
              {feedbackRating > 0 && (
                <span style={{ fontSize: 12, color: "#6B7280", alignSelf: "center", marginLeft: 4 }}>
                  {["","Poor","Fair","Good","Very Good","Excellent"][feedbackRating]}
                </span>
              )}
            </div>
            {/* Comment */}
            <textarea
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value)}
              placeholder="Optional comment…"
              rows={2}
              style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", background: "rgba(249,247,242,0.8)", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button onClick={() => { setShowFeedbackForm(false); setFeedbackRating(0); setFeedbackComment(""); }}
                style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(120,130,140,0.25)", background: "#fff", fontSize: 12, color: "#6B7280", cursor: "pointer" }}>Cancel</button>
              <button onClick={submitFeedback} disabled={savingFeedback || feedbackRating === 0}
                style={{ padding: "6px 16px", borderRadius: 8, border: "none", background: "var(--gold)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: feedbackRating === 0 ? 0.5 : 1 }}>
                {savingFeedback ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        )}

        {/* Feedback history */}
        {!loading && feedback.length === 0 && !showFeedbackForm ? (
          <div style={{ ...card, textAlign: "center" }}>
            <Star size={28} color="rgba(197,160,89,0.3)" style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 13, color: "#9CA3AF", margin: 0 }}>No feedback recorded yet</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {feedback.map(fb => (
              <div key={fb.id} style={card}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: fb.comment ? 6 : 0 }}>
                  <div style={{ display: "flex", gap: 2 }}>
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={13} fill={fb.rating >= n ? "#C5A059" : "none"} color={fb.rating >= n ? "#C5A059" : "#D1D5DB"} />
                    ))}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: fb.rating >= 4 ? "#16a34a" : fb.rating <= 2 ? "#dc2626" : "#CA8A04" }}>
                    {["","Poor","Fair","Good","Very Good","Excellent"][fb.rating]}
                  </span>
                  <span style={{ fontSize: 11, color: "#9CA3AF", marginLeft: "auto" }}>{fmtDate(fb.submitted_at)}</span>
                </div>
                {fb.comment && <p style={{ fontSize: 13, color: "#374151", margin: 0, fontStyle: "italic" }}>&ldquo;{fb.comment}&rdquo;</p>}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
