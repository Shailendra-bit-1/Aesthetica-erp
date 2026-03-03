"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Phone, Lock, ArrowRight, Loader2 } from "lucide-react";

export default function PortalLoginPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const clinicId     = searchParams.get("clinic") ?? "";

  const [step,     setStep]     = useState<"phone" | "otp">("phone");
  const [phone,    setPhone]    = useState("");
  const [otp,      setOtp]      = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [devOtp,   setDevOtp]   = useState<string | null>(null);
  const [greeting, setGreeting] = useState("");

  const requestOtp = async () => {
    if (!phone.trim() || !clinicId) { setError("Please enter your phone number."); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/portal/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), clinic_id: clinicId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setGreeting(data.patient_name ? `Welcome, ${data.patient_name.split(" ")[0]}!` : "OTP sent!");
      if (data.dev_otp) setDevOtp(data.dev_otp);
      setStep("otp");
    } catch (e) {
      setError((e as Error).message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) { setError("Please enter the OTP."); return; }
    setLoading(true);
    setError("");
    try {
      const res  = await fetch("/api/portal/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), otp: otp.trim(), clinic_id: clinicId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      router.push(`/portal/${data.token}`);
    } catch (e) {
      setError((e as Error).message || "Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#F9F7F2", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Sparkles size={24} color="#C5A059" />
            <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif", color: "#1a1714" }}>Aesthetica</span>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280" }}>Patient Self-Service Portal</p>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, border: "1px solid rgba(197,160,89,0.2)", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {step === "phone" ? (
            <>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1a1714", marginBottom: 6 }}>Sign In</h2>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>Enter your registered mobile number to receive a one-time password.</p>

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 8 }}>Mobile Number</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(197,160,89,0.35)", borderRadius: 10, overflow: "hidden", background: "#faf9f7" }}>
                <div style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid rgba(197,160,89,0.2)" }}>
                  <Phone size={15} color="#C5A059" />
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && requestOtp()}
                  placeholder="+91 98765 43210"
                  style={{ flex: 1, padding: "12px 14px", border: "none", outline: "none", fontSize: 14, background: "transparent", color: "#1a1714" }}
                />
              </div>

              {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</p>}

              <button onClick={requestOtp} disabled={loading || !phone.trim()}
                style={{
                  width: "100%", marginTop: 16, padding: "13px", borderRadius: 12, border: "none",
                  background: phone.trim() ? "var(--gold)" : "#e5e7eb",
                  color: phone.trim() ? "#fff" : "#9ca3af",
                  fontWeight: 600, fontSize: 14, cursor: phone.trim() ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? "Sending OTP…" : "Send OTP"}
              </button>
            </>
          ) : (
            <>
              <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, fontWeight: 700, color: "#1a1714", marginBottom: 4 }}>{greeting || "Enter OTP"}</h2>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 24 }}>We sent a 6-digit OTP to {phone}. <button onClick={() => { setStep("phone"); setOtp(""); setError(""); setDevOtp(null); }} style={{ color: "#C5A059", background: "none", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>Change</button></p>

              {devOtp && (
                <div style={{ padding: "8px 12px", borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)", marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#2563eb" }}>DEV MODE — OTP: <span style={{ fontFamily: "monospace", fontSize: 14 }}>{devOtp}</span></p>
                </div>
              )}

              <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: 8 }}>One-Time Password</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid rgba(197,160,89,0.35)", borderRadius: 10, overflow: "hidden", background: "#faf9f7" }}>
                <div style={{ padding: "0 12px", display: "flex", alignItems: "center", borderRight: "1px solid rgba(197,160,89,0.2)" }}>
                  <Lock size={15} color="#C5A059" />
                </div>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={e => e.key === "Enter" && verifyOtp()}
                  placeholder="123456"
                  style={{ flex: 1, padding: "12px 14px", border: "none", outline: "none", fontSize: 20, fontFamily: "monospace", letterSpacing: "0.2em", background: "transparent", color: "#1a1714", textAlign: "center" }}
                />
              </div>

              {error && <p style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{error}</p>}

              <button onClick={verifyOtp} disabled={loading || otp.length < 6}
                style={{
                  width: "100%", marginTop: 16, padding: "13px", borderRadius: 12, border: "none",
                  background: otp.length === 6 ? "var(--gold)" : "#e5e7eb",
                  color: otp.length === 6 ? "#fff" : "#9ca3af",
                  fontWeight: 600, fontSize: 14, cursor: otp.length === 6 ? "pointer" : "default",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                {loading ? "Verifying…" : "Access Portal"}
              </button>
            </>
          )}
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginTop: 16 }}>
          Your data is encrypted and secure. For help, contact the clinic.
        </p>
      </div>
    </div>
  );
}
