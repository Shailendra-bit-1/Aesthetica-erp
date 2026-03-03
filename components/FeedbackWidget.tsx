"use client";

import { useState, useEffect } from "react";
import { MessageCirclePlus, X, Send, CheckCircle, Bug, Lightbulb, HelpCircle, Heart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import { usePathname } from "next/navigation";

const CATEGORIES = [
  { key: "bug",        label: "Bug / Error",      icon: Bug,        color: "#dc2626", bg: "rgba(220,38,38,0.08)"   },
  { key: "suggestion", label: "Suggestion",        icon: Lightbulb,  color: "#f59e0b", bg: "rgba(245,158,11,0.08)"  },
  { key: "confusion",  label: "I'm confused",      icon: HelpCircle, color: "#2563eb", bg: "rgba(37,99,235,0.08)"   },
  { key: "compliment", label: "Compliment",        icon: Heart,      color: "#16a34a", bg: "rgba(22,163,74,0.08)"   },
] as const;

type Category = typeof CATEGORIES[number]["key"];

// Pages where the widget should NOT appear (public-facing, unauthenticated)
const HIDDEN_PATHS = ["/login", "/intake", "/portal"];

export default function FeedbackWidget() {
  const { profile, activeClinicId } = useClinic();
  const pathname = usePathname();

  const [open,      setOpen]      = useState(false);
  const [category,  setCategory]  = useState<Category | null>(null);
  const [message,   setMessage]   = useState("");
  const [saving,    setSaving]    = useState(false);
  const [done,      setDone]      = useState(false);

  // Hide on public pages or when not logged in
  const isHidden = !profile || HIDDEN_PATHS.some(p => pathname.startsWith(p));

  // Reset on open
  useEffect(() => {
    if (open) { setCategory(null); setMessage(""); setDone(false); }
  }, [open]);

  if (isHidden) return null;

  const submit = async () => {
    if (!category || !message.trim()) return;
    setSaving(true);
    await supabase.from("beta_feedback").insert({
      clinic_id: activeClinicId || profile.clinic_id,
      user_id:   profile.id,
      user_name: profile.full_name,
      category,
      message:   message.trim(),
      page_url:  pathname,
    });
    setSaving(false);
    setDone(true);
    setTimeout(() => setOpen(false), 2000);
  };

  const cfg = category ? CATEGORIES.find(c => c.key === category) : null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Send feedback"
        style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 400,
          width: 44, height: 44, borderRadius: "50%",
          background: open ? "#1a1714" : "linear-gradient(135deg,#C5A059,#A07830)",
          border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 4px 16px rgba(197,160,89,0.4)", transition: "all 0.2s",
        }}
      >
        {open
          ? <X size={16} color="#C5A059" />
          : <MessageCirclePlus size={18} color="#fff" />
        }
      </button>

      {/* Feedback panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: 78, right: 24, zIndex: 400,
          width: 340, background: "white", borderRadius: 18,
          border: "1px solid rgba(197,160,89,0.25)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.16), 0 0 0 1px rgba(197,160,89,0.1)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid rgba(197,160,89,0.1)", display: "flex", alignItems: "center", gap: 8 }}>
            <MessageCirclePlus size={14} color="#C5A059" />
            <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1714", fontFamily: "Georgia, serif", margin: 0 }}>Beta Feedback</p>
            <span style={{ marginLeft: "auto", fontSize: 10, color: "#9ca3af", background: "rgba(197,160,89,0.08)", padding: "2px 6px", borderRadius: 4 }}>{pathname}</span>
          </div>

          <div style={{ padding: 16 }}>
            {done ? (
              <div style={{ padding: "24px 0", textAlign: "center" }}>
                <CheckCircle size={28} color="#16a34a" style={{ margin: "0 auto 10px" }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1714" }}>Thanks for the feedback!</p>
                <p style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>We review every submission.</p>
              </div>
            ) : (
              <>
                {/* Category picker */}
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>What is this about?</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    const selected = category === cat.key;
                    return (
                      <button
                        key={cat.key}
                        onClick={() => setCategory(cat.key)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "8px 10px",
                          borderRadius: 10, border: `1.5px solid ${selected ? cat.color : "rgba(197,160,89,0.15)"}`,
                          background: selected ? cat.bg : "transparent",
                          cursor: "pointer", fontSize: 12, fontWeight: selected ? 700 : 500,
                          color: selected ? cat.color : "#6b7280", transition: "all 0.12s",
                        }}
                      >
                        <Icon size={13} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>

                {/* Message */}
                <p style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Tell us more</p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={
                    category === "bug"        ? "What went wrong? What did you expect to happen?" :
                    category === "suggestion" ? "What would make this better?" :
                    category === "confusion"  ? "What was confusing? Where did you get stuck?" :
                    category === "compliment" ? "What did you like?" :
                    "Describe your feedback…"
                  }
                  rows={3}
                  style={{
                    width: "100%", padding: "9px 12px", borderRadius: 10,
                    border: "1px solid rgba(197,160,89,0.2)", fontSize: 13,
                    color: "#1a1714", background: "#faf9f7", resize: "none",
                    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
                    lineHeight: 1.5,
                  }}
                />

                <button
                  onClick={submit}
                  disabled={saving || !category || !message.trim()}
                  style={{
                    marginTop: 10, width: "100%", padding: "10px 0", borderRadius: 10,
                    background: (!category || !message.trim()) ? "rgba(197,160,89,0.3)" : "linear-gradient(135deg,#C5A059,#A07830)",
                    border: "none", color: "#fff", fontSize: 13, fontWeight: 700,
                    cursor: (!category || !message.trim()) ? "not-allowed" : "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  {saving
                    ? <><span style={{ width: 12, height: 12, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> Sending…</>
                    : <><Send size={12} /> Send Feedback</>
                  }
                </button>

                {cfg && (
                  <p style={{ fontSize: 10, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
                    Submitting as <strong>{profile?.full_name ?? "you"}</strong> · {cfg.label}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
