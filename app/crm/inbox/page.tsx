"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useClinic } from "@/contexts/ClinicContext";
import TopBar from "@/components/TopBar";
import { ArrowLeft, Send, Phone, User, Circle, CheckCheck, Zap, X } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────
interface Conversation {
  id: string;
  wa_phone: string;
  status: "open" | "closed" | "bot";
  last_message_at: string;
  patients: { full_name: string } | null;
  profiles: { full_name: string } | null;
  last_message?: string;
}

interface Message {
  id: string;
  direction: "inbound" | "outbound";
  content: string;
  message_type: string;
  status: string;
  created_at: string;
  sent_by: string | null;
}

// ── D2: Keyword routing ────────────────────────────────────────────────────
const KEYWORD_RESPONSES: Record<string, string> = {
  book:    "Hi! To book an appointment, please visit: [booking_link] or call us at [clinic_phone].",
  cancel:  "Sorry to hear that! Please reply with your appointment date to cancel, or call us directly.",
  balance: "Your current wallet balance is [wallet_balance]. Visit [portal_link] to view details.",
  confirm: "Great! Your appointment is confirmed. We look forward to seeing you!",
  yes:     "Thank you for confirming! See you at your appointment.",
  no:      "We understand. Would you like to reschedule? Reply 'book' to see available slots.",
  help:    "How can we help? Reply: BOOK (new appointment), CANCEL (cancel appointment), BALANCE (wallet), CONFIRM (confirm appointment).",
};

const detectKeywords = (text: string): string[] => {
  const lower = text.toLowerCase().trim();
  return Object.keys(KEYWORD_RESPONSES).filter(kw => lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw));
};

const STATUS_CFG = {
  open:   { label: "Open",   bg: "rgba(34,197,94,0.1)",    color: "#16a34a",  dot: "#22c55e" },
  closed: { label: "Closed", bg: "rgba(107,114,128,0.1)",  color: "#6b7280",  dot: "#9ca3af" },
  bot:    { label: "Bot",    bg: "rgba(59,130,246,0.1)",   color: "#2563eb",  dot: "#3b82f6" },
};

// ── Component ─────────────────────────────────────────────────────────────
export default function WhatsAppInbox() {
  const { profile, activeClinicId } = useClinic();
  const clinicId = activeClinicId || profile?.clinic_id;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [activeConv,    setActiveConv]    = useState<Conversation | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [loadingMsgs,   setLoadingMsgs]   = useState(false);
  const [reply,         setReply]         = useState("");
  const [sending,       setSending]       = useState(false);
  const [kwSuggestion,  setKwSuggestion]  = useState<string | null>(null);
  const msgEndRef = useRef<HTMLDivElement>(null);

  const fetchConversations = useCallback(async () => {
    if (!clinicId) return;
    const { data } = await supabase
      .from("whatsapp_conversations")
      .select("*, patients(full_name), profiles!assigned_to(full_name)")
      .eq("clinic_id", clinicId)
      .order("last_message_at", { ascending: false });
    setConversations((data ?? []) as Conversation[]);
    setLoading(false);
  }, [clinicId]);

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: true });
    setMessages((data ?? []) as Message[]);
    setLoadingMsgs(false);
    // D2: detect keyword in last inbound message
    const lastInbound = [...(data ?? [])].reverse().find(m => m.direction === "inbound");
    if (lastInbound) {
      const kws = detectKeywords(lastInbound.content);
      setKwSuggestion(kws.length > 0 ? KEYWORD_RESPONSES[kws[0]] : null);
    } else {
      setKwSuggestion(null);
    }
  }, []);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    if (activeConv) fetchMessages(activeConv.id);
  }, [activeConv, fetchMessages]);

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const openConversation = (conv: Conversation) => {
    setActiveConv(conv);
    setReply("");
    setKwSuggestion(null);
  };

  const sendReply = async () => {
    if (!reply.trim() || !activeConv || sending) return;
    setSending(true);
    const content = reply.trim();
    setReply("");
    const { data: msg } = await supabase.from("whatsapp_messages").insert({
      conversation_id: activeConv.id,
      direction:       "outbound",
      content,
      message_type:    "text",
      status:          "sent",
      sent_by:         profile?.id ?? null,
    }).select().single();
    if (msg) setMessages(prev => [...prev, msg as Message]);
    // Update last_message_at
    await supabase.from("whatsapp_conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", activeConv.id);
    setSending(false);
    setKwSuggestion(null);
  };

  const setConvStatus = async (convId: string, status: "open" | "closed" | "bot") => {
    await supabase.from("whatsapp_conversations").update({ status }).eq("id", convId);
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, status } : c));
    if (activeConv?.id === convId) setActiveConv(prev => prev ? { ...prev, status } : null);
  };

  const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return fmtTime(iso);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  };

  return (
    <div className="flex flex-col h-screen" style={{ background: "#F9F7F2" }}>
      <TopBar />

      <div className="flex flex-1 overflow-hidden" style={{ maxWidth: 1280, margin: "0 auto", width: "100%", padding: "16px" }}>
        {/* ── Left: Conversation list ── */}
        <div className="flex flex-col" style={{ width: 320, flexShrink: 0, background: "#fff", borderRadius: 16, border: "1px solid rgba(197,160,89,0.15)", overflow: "hidden", marginRight: 12 }}>
          <div className="px-4 py-4" style={{ borderBottom: "1px solid rgba(197,160,89,0.12)" }}>
            <div className="flex items-center gap-2 mb-1">
              <a href="/crm" style={{ color: "#C5A059", display: "flex", alignItems: "center" }}>
                <ArrowLeft size={16} />
              </a>
              <h2 className="font-semibold" style={{ fontFamily: "Georgia, serif", color: "#1a1714", fontSize: 16 }}>WhatsApp Inbox</h2>
            </div>
            <p className="text-xs" style={{ color: "#9ca3af" }}>{conversations.length} conversations</p>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              [1,2,3].map(n => <div key={n} className="h-16 mx-4 my-2 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)" }} />)
            ) : conversations.length === 0 ? (
              <div className="text-center py-12 px-4">
                <Phone size={32} className="mx-auto mb-3" style={{ color: "rgba(197,160,89,0.3)" }} />
                <p className="text-sm" style={{ color: "#9ca3af" }}>No conversations yet</p>
                <p className="text-xs mt-1" style={{ color: "#d1d5db" }}>Messages from WhatsApp will appear here</p>
              </div>
            ) : conversations.map(conv => {
              const sc = STATUS_CFG[conv.status];
              const active = activeConv?.id === conv.id;
              return (
                <div key={conv.id}
                  onClick={() => openConversation(conv)}
                  style={{
                    padding: "12px 16px", cursor: "pointer", display: "flex", gap: 10, alignItems: "flex-start",
                    background: active ? "rgba(197,160,89,0.08)" : "transparent",
                    borderLeft: active ? "3px solid #C5A059" : "3px solid transparent",
                    borderBottom: "1px solid rgba(197,160,89,0.06)",
                  }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={16} color="#fff" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1a1714", fontFamily: "Georgia, serif" }}>
                        {conv.patients?.full_name || conv.wa_phone}
                      </span>
                      <span style={{ fontSize: 10, color: "#9ca3af" }}>{fmtDate(conv.last_message_at)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                      <Circle size={6} fill={sc.dot} color={sc.dot} />
                      <span style={{ fontSize: 11, color: sc.color, fontWeight: 600 }}>{sc.label}</span>
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>{conv.wa_phone}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: Message thread ── */}
        <div className="flex flex-col flex-1" style={{ background: "#fff", borderRadius: 16, border: "1px solid rgba(197,160,89,0.15)", overflow: "hidden" }}>
          {!activeConv ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Phone size={48} style={{ color: "rgba(197,160,89,0.25)", margin: "0 auto 12px" }} />
                <p style={{ fontFamily: "Georgia, serif", color: "#9ca3af", fontSize: 15 }}>Select a conversation</p>
                <p style={{ fontSize: 12, color: "#d1d5db", marginTop: 4 }}>Incoming WhatsApp messages will appear here</p>
              </div>
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding: "14px 20px", borderBottom: "1px solid rgba(197,160,89,0.12)", display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, #C5A059, #A8853A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <User size={17} color="#fff" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1a1714" }}>
                    {activeConv.patients?.full_name || activeConv.wa_phone}
                  </p>
                  <p style={{ fontSize: 12, color: "#6b7280" }}>{activeConv.wa_phone}</p>
                </div>
                {/* Status toggle */}
                <div style={{ display: "flex", gap: 4 }}>
                  {(["open","closed","bot"] as const).map(s => {
                    const sc = STATUS_CFG[s];
                    return (
                      <button key={s} onClick={() => setConvStatus(activeConv.id, s)}
                        style={{
                          padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${sc.color}40`,
                          background: activeConv.status === s ? sc.bg : "transparent",
                          color: activeConv.status === s ? sc.color : "#9ca3af",
                        }}>
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
                {loadingMsgs ? (
                  [1,2,3].map(n => <div key={n} className="h-10 rounded-xl animate-pulse" style={{ background: "rgba(197,160,89,0.06)", width: n % 2 === 0 ? "60%" : "45%", alignSelf: n % 2 === 0 ? "flex-start" : "flex-end" }} />)
                ) : messages.map(msg => {
                  const isOut = msg.direction === "outbound";
                  return (
                    <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isOut ? "flex-end" : "flex-start" }}>
                      <div style={{
                        maxWidth: "70%", padding: "8px 12px", borderRadius: isOut ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: isOut ? "linear-gradient(135deg, #C5A059, #A8853A)" : "#f3f4f6",
                        color: isOut ? "#fff" : "#1a1714", fontSize: 13, lineHeight: 1.5,
                      }}>
                        {msg.content}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                        <span style={{ fontSize: 10, color: "#9ca3af" }}>{fmtTime(msg.created_at)}</span>
                        {isOut && <CheckCheck size={11} style={{ color: msg.status === "read" ? "#22c55e" : "#9ca3af" }} />}
                      </div>
                    </div>
                  );
                })}
                <div ref={msgEndRef} />
              </div>

              {/* D2: Keyword auto-response suggestion */}
              {kwSuggestion && (
                <div style={{ padding: "10px 20px", borderTop: "1px solid rgba(59,130,246,0.15)", background: "rgba(59,130,246,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <Zap size={13} style={{ color: "#2563eb", flexShrink: 0, marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", marginBottom: 4 }}>Smart Reply Suggestion</p>
                      <p style={{ fontSize: 12, color: "#4b5563", lineHeight: 1.5 }}>{kwSuggestion}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setReply(kwSuggestion)}
                        style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(37,99,235,0.35)", background: "rgba(59,130,246,0.1)", color: "#2563eb", cursor: "pointer" }}>
                        Use
                      </button>
                      <button onClick={() => setKwSuggestion(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                        <X size={13} style={{ color: "#9ca3af" }} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Reply box */}
              <div style={{ padding: "12px 16px", borderTop: "1px solid rgba(197,160,89,0.12)", display: "flex", gap: 8, alignItems: "flex-end" }}>
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  placeholder="Type a message… (Enter to send)"
                  rows={2}
                  style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid rgba(197,160,89,0.25)", fontSize: 13, fontFamily: "inherit", resize: "none", outline: "none", background: "#faf9f7" }}
                />
                <button onClick={sendReply} disabled={!reply.trim() || sending}
                  style={{ width: 40, height: 40, borderRadius: 12, background: reply.trim() ? "var(--gold)" : "#e5e7eb", border: "none", cursor: reply.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Send size={16} color={reply.trim() ? "#fff" : "#9ca3af"} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
