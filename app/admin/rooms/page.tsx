"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { Plus, Pencil, Trash2, Check, X, DoorOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Room {
  id: string;
  name: string;
  type: string | null;
  capacity: number | null;
  is_active: boolean;
}

const ROOM_TYPES = ["treatment_room", "consultation_room", "laser_room", "recovery_room", "waiting_room", "other"];
const ROOM_TYPE_LABEL: Record<string, string> = {
  treatment_room:    "Treatment Room",
  consultation_room: "Consultation Room",
  laser_room:        "Laser Room",
  recovery_room:     "Recovery Room",
  waiting_room:      "Waiting Room",
  other:             "Other",
};

export default function RoomsPage() {
  const { profile, activeClinicId: clinicId } = useClinic();
  const [rooms,   setRooms]   = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form,    setForm]    = useState({ name: "", type: "treatment_room", capacity: "1" });
  const [saving,  setSaving]  = useState(false);
  const [showForm, setShowForm] = useState(false);

  const isAdmin = ["superadmin", "chain_admin", "clinic_admin"].includes(profile?.role ?? "");

  const load = async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("rooms").select("id, name, type, capacity, is_active").eq("clinic_id", clinicId).order("name");
    setRooms(data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [clinicId]);

  function openNew() {
    setEditing(null);
    setForm({ name: "", type: "treatment_room", capacity: "1" });
    setShowForm(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setForm({ name: room.name, type: room.type ?? "other", capacity: String(room.capacity ?? 1) });
    setShowForm(true);
  }

  async function save() {
    if (!clinicId || !form.name.trim()) return;
    setSaving(true);
    const payload = {
      clinic_id: clinicId,
      name:     form.name.trim(),
      type:     form.type,
      capacity: parseInt(form.capacity) || 1,
      is_active: true,
    };
    const { error } = editing
      ? await supabase.from("rooms").update(payload).eq("id", editing.id)
      : await supabase.from("rooms").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editing ? "Room updated" : "Room created");
    setShowForm(false);
    await load();
  }

  async function toggleActive(room: Room) {
    await supabase.from("rooms").update({ is_active: !room.is_active }).eq("id", room.id);
    await load();
  }

  async function deleteRoom(id: string) {
    if (!confirm("Delete this room? This cannot be undone.")) return;
    await supabase.from("rooms").delete().eq("id", id);
    toast.success("Room deleted");
    await load();
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>Room Management</h1>
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{rooms.length} rooms configured</p>
          </div>
          {isAdmin && (
            <button
              onClick={openNew}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              <Plus size={14} /> Add Room
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", padding: 40 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Loading…
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "var(--text-muted)" }}>
            <DoorOpen size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
            <p style={{ fontSize: 15, fontWeight: 500 }}>No rooms configured</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Add rooms to enable room-based scheduling.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
            {rooms.map(room => (
              <div key={room.id} style={{
                background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: 16,
                opacity: room.is_active ? 1 : 0.55,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>{room.name}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                      {ROOM_TYPE_LABEL[room.type ?? "other"]}
                      {room.capacity ? ` · Capacity ${room.capacity}` : ""}
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: room.is_active ? "#F0FDF4" : "#F9FAFB", color: room.is_active ? "#16A34A" : "#6B7280" }}>
                    {room.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
                {isAdmin && (
                  <div style={{ display: "flex", gap: 6, marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                    <button onClick={() => openEdit(room)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 11, color: "var(--text-secondary)" }}>
                      <Pencil size={11} /> Edit
                    </button>
                    <button onClick={() => toggleActive(room)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 11, color: "var(--text-secondary)" }}>
                      {room.is_active ? <X size={11} /> : <Check size={11} />}
                      {room.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button onClick={() => deleteRoom(room.id)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 7, border: "1px solid var(--error-border)", background: "none", cursor: "pointer", fontSize: 11, color: "var(--error)" }}>
                      <Trash2 size={11} /> Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Form Modal */}
        {showForm && (
          <div style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
            <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 440, overflow: "hidden", boxShadow: "var(--shadow-xl)" }}>
              <div style={{ padding: "16px 20px", background: "var(--primary)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <p style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{editing ? "Edit Room" : "New Room"}</p>
                <button onClick={() => setShowForm(false)} style={{ border: "none", background: "rgba(255,255,255,0.15)", cursor: "pointer", borderRadius: 6, padding: 5, color: "#fff" }}>
                  <X size={14} />
                </button>
              </div>
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Room Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="ae-input" placeholder="e.g. Laser Suite 1" />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Room Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="ae-input">
                    {ROOM_TYPES.map(t => <option key={t} value={t}>{ROOM_TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 5 }}>Capacity (simultaneous patients)</label>
                  <input type="number" min="1" max="20" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className="ae-input" style={{ maxWidth: 100 }} />
                </div>
                <div style={{ display: "flex", gap: 8, paddingTop: 4 }}>
                  <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1px solid var(--border)", background: "none", cursor: "pointer", fontSize: 13, color: "var(--text-secondary)" }}>Cancel</button>
                  <button onClick={save} disabled={saving || !form.name.trim()} style={{ flex: 2, padding: "9px 0", borderRadius: 9, border: "none", background: "var(--primary)", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: saving || !form.name.trim() ? 0.6 : 1 }}>
                    {saving ? "Saving…" : editing ? "Save Changes" : "Create Room"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
