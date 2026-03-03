"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Check, CheckCheck, Megaphone, CreditCard, Package, UserCheck2, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { useRouter } from "next/navigation";

/* ─── Types ─────────────────────────────────────────────── */
interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
}

/* ─── Icon map ───────────────────────────────────────────── */
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  new_lead:        { icon: <Megaphone size={13} />,    color: "#7c3aed", bg: "rgba(124,58,237,0.1)" },
  payment:         { icon: <CreditCard size={13} />,   color: "#16a34a", bg: "rgba(22,163,74,0.1)"  },
  low_stock:       { icon: <Package size={13} />,      color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  leave_request:   { icon: <UserCheck2 size={13} />,   color: "#ea580c", bg: "rgba(234,88,12,0.1)"  },
  appointment:     { icon: <Calendar size={13} />,     color: "#2563eb", bg: "rgba(37,99,235,0.1)"  },
  system:          { icon: <AlertCircle size={13} />,  color: "#6b7280", bg: "rgba(107,114,128,0.1)"},
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "Just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

/* ─── Component ──────────────────────────────────────────── */
export default function NotificationCenter() {
  const { profile, activeClinicId } = useClinic();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const clinicId = activeClinicId || profile?.clinic_id;

  const [open,          setOpen]          = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread,        setUnread]        = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase.from("notifications")
      .select("id, type, title, body, entity_type, action_url, is_read, created_at")
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(30);
    const notifs = (data ?? []) as Notification[];
    setNotifications(notifs);
    setUnread(notifs.filter(n => !n.is_read).length);
  }, [clinicId]);

  // Initial fetch
  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel(`notifications:${clinicId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `clinic_id=eq.${clinicId}` },
        () => fetchNotifications()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnread(u => Math.max(0, u - 1));
  };

  const markAllRead = async () => {
    if (!clinicId) return;
    await supabase.from("notifications").update({ is_read: true }).eq("clinic_id", clinicId).eq("is_read", false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead(n.id);
    if (n.action_url) { router.push(n.action_url); setOpen(false); }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: "relative", width: 34, height: 34, borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)", background: open ? "var(--bg-subtle)" : "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          transition: "var(--transition-base)",
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget.style.background = "var(--bg-subtle)"); }}
        onMouseLeave={e => { if (!open) (e.currentTarget.style.background = "none"); }}
        title="Notifications"
      >
        <Bell size={14} color="var(--text-muted)" />
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 5, right: 5, width: unread > 9 ? 14 : 10, height: 10,
            borderRadius: 5, background: "#dc2626", border: "1.5px solid var(--bg-base)",
            fontSize: 7, fontWeight: 700, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 8px)", right: 0,
          width: 360, maxHeight: 480,
          background: "white", borderRadius: "var(--radius-lg)",
          border: "1px solid rgba(197,160,89,0.2)",
          boxShadow: "var(--shadow-lg)", zIndex: 300,
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(197,160,89,0.12)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={14} color="var(--gold)" />
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-serif)", margin: 0 }}>Notifications</p>
              {unread > 0 && (
                <span style={{ padding: "1px 7px", borderRadius: 8, background: "rgba(220,38,38,0.1)", fontSize: 11, fontWeight: 700, color: "#dc2626" }}>{unread} new</span>
              )}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {unread > 0 && (
                <button onClick={markAllRead} title="Mark all as read"
                  style={{ padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(197,160,89,0.2)", background: "none", cursor: "pointer", fontSize: 10, color: "var(--gold)", fontWeight: 600, display: "flex", alignItems: "center", gap: 3 }}>
                  <CheckCheck size={10} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)}
                style={{ width: 24, height: 24, borderRadius: 6, border: "none", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={13} color="var(--text-muted)" />
              </button>
            </div>
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "40px 20px", textAlign: "center" }}>
                <Bell size={28} color="#d1d5db" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No notifications yet</p>
                <p style={{ fontSize: 11, color: "#d1d5db", marginTop: 4 }}>Activity from leads, payments, and appointments will appear here</p>
              </div>
            ) : notifications.map((n, i) => {
              const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.system;
              return (
                <div key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 16px",
                    borderBottom: i < notifications.length - 1 ? "1px solid #f9fafb" : "none",
                    background: n.is_read ? "transparent" : "rgba(197,160,89,0.04)",
                    cursor: n.action_url ? "pointer" : "default",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={e => { (e.currentTarget.style.background = "rgba(197,160,89,0.06)"); }}
                  onMouseLeave={e => { (e.currentTarget.style.background = n.is_read ? "transparent" : "rgba(197,160,89,0.04)"); }}
                >
                  {/* Icon */}
                  <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: cfg.bg, color: cfg.color }}>
                    {cfg.icon}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: n.is_read ? 500 : 700, color: "var(--text-primary)", margin: "0 0 2px", lineHeight: 1.4 }}>{n.title}</p>
                    {n.body && <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "0 0 4px", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{n.body}</p>}
                    <p style={{ fontSize: 10, color: "#d1d5db", margin: 0 }}>{timeAgo(n.created_at)}</p>
                  </div>
                  {/* Unread dot */}
                  {!n.is_read && (
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#C5A059", flexShrink: 0, marginTop: 4 }} />
                  )}
                  {/* Mark read button (on hover) */}
                  {!n.is_read && (
                    <button onClick={e => { e.stopPropagation(); markRead(n.id); }}
                      title="Mark as read"
                      style={{ padding: 4, borderRadius: 4, border: "none", background: "rgba(197,160,89,0.08)", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}>
                      <Check size={10} color="var(--gold)" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
