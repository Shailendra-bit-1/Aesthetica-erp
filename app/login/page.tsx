"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Crown, Eye, EyeOff, Loader2, Lock, Mail, Sparkles } from "lucide-react";

// ── Suspense wrapper (required by Next.js for useSearchParams) ────────────────
export default function LoginPage() {
  return (
    <Suspense>
      <LoginCard />
    </Suspense>
  );
}

// ── The actual card ───────────────────────────────────────────────────────────
function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Trigger the card entrance animation after hydration
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error || !data.user) {
      toast.error("Invalid credentials", {
        description: "Please check your email and password and try again.",
        icon: <Lock size={15} color="#C5A059" />,
      });
      setLoading(false);
      return;
    }

    // Role-based routing
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    const role = profile?.role as string | null;
    const next = searchParams.get("next");

    if (next && next !== "/login") {
      router.push(next);
    } else if (role === "superadmin" || role === "admin") {
      router.push("/admin/manage");
    } else {
      router.push("/");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F9F7F2",
        backgroundImage: `
          radial-gradient(ellipse 120% 80% at 50% 40%, #FFFEF9 0%, transparent 70%),
          repeating-linear-gradient(45deg, transparent, transparent 48px, rgba(197,160,89,0.03) 48px, rgba(197,160,89,0.03) 49px),
          repeating-linear-gradient(-45deg, transparent, transparent 48px, rgba(197,160,89,0.03) 48px, rgba(197,160,89,0.03) 49px)
        `,
        padding: "24px",
      }}
    >
      {/* ── Card ── */}
      <div
        style={{
          width: "100%",
          maxWidth: "420px",
          background: "#FFFFFF",
          borderRadius: "20px",
          boxShadow:
            "0 4px 6px rgba(0,0,0,0.03), 0 20px 60px rgba(197,160,89,0.1), 0 1px 0 rgba(197,160,89,0.4) inset",
          border: "1px solid rgba(197,160,89,0.25)",
          overflow: "hidden",
          opacity: mounted ? 1 : 0,
          transform: mounted ? "translateY(0)" : "translateY(20px)",
          transition: "opacity 0.65s cubic-bezier(0.4,0,0.2,1), transform 0.65s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* Gold top bar */}
        <div
          style={{
            height: 3,
            background: "linear-gradient(90deg, #A8853A, #C5A059, #E8CC8A, #C5A059, #A8853A)",
          }}
        />

        {/* Card body */}
        <div style={{ padding: "44px 40px 36px" }}>

          {/* ── Logo / Monogram ── */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 32 }}>
            {/* Double-ring monogram */}
            <div style={{ position: "relative", width: 80, height: 80, marginBottom: 20 }}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: "50%",
                  border: "1px solid rgba(197,160,89,0.3)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 6,
                  borderRadius: "50%",
                  border: "1.5px solid rgba(197,160,89,0.55)",
                  background: "linear-gradient(145deg, rgba(197,160,89,0.08), rgba(197,160,89,0.04))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "Georgia, serif",
                    fontSize: 26,
                    fontWeight: 600,
                    color: "#C5A059",
                    lineHeight: 1,
                  }}
                >
                  A
                </span>
              </div>
              <Sparkles
                size={12}
                color="#C5A059"
                style={{ position: "absolute", top: 4, right: 4, opacity: 0.7 }}
              />
            </div>

            {/* Brand name */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <span style={{ color: "rgba(197,160,89,0.4)", fontSize: 10 }}>✦</span>
              <span
                style={{
                  fontFamily: "Georgia, serif",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.3em",
                  textTransform: "uppercase",
                  color: "#C5A059",
                }}
              >
                Aesthetica Clinic
              </span>
              <span style={{ color: "rgba(197,160,89,0.4)", fontSize: 10 }}>✦</span>
            </div>

            {/* Heading */}
            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: 26,
                fontWeight: 600,
                color: "#1A1A1A",
                margin: 0,
                textAlign: "center",
                lineHeight: 1.25,
              }}
            >
              Welcome to Aesthetica
            </h1>
            <p
              style={{
                fontSize: 13,
                color: "#8A8078",
                marginTop: 6,
                textAlign: "center",
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
              }}
            >
              Sign in to your private clinic suite
            </p>

            {/* Super Admin badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 14,
                padding: "5px 14px",
                borderRadius: 999,
                background: "linear-gradient(135deg, rgba(197,160,89,0.14), rgba(168,133,58,0.08))",
                border: "1px solid rgba(197,160,89,0.35)",
                boxShadow: "0 0 14px rgba(197,160,89,0.12)",
              }}
            >
              <Crown size={12} color="#C5A059" />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "#A8853A",
                  fontFamily: "Georgia, serif",
                }}
              >
                Super Admin
              </span>
            </div>
          </div>

          {/* Ornamental divider */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "linear-gradient(to right, transparent, #E8E2D4)",
              }}
            />
            <span style={{ fontSize: 10, color: "rgba(197,160,89,0.5)" }}>✦</span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: "linear-gradient(to left, transparent, #E8E2D4)",
              }}
            />
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 18 }}>

            {/* Email */}
            <div>
              <label style={labelSx}>
                <Mail size={11} color="#C5A059" />
                Email Address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputSx}
                onFocus={(e) => applyFocus(e.target)}
                onBlur={(e) => removeFocus(e.target)}
              />
            </div>

            {/* Password */}
            <div>
              <label style={labelSx}>
                <Lock size={11} color="#C5A059" />
                Password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ ...inputSx, paddingRight: 44 }}
                  onFocus={(e) => applyFocus(e.target)}
                  onBlur={(e) => removeFocus(e.target)}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((p) => !p)}
                  style={{
                    position: "absolute",
                    right: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 2,
                    color: "#8A8078",
                    display: "flex",
                    alignItems: "center",
                    transition: "color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "#C5A059")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLButtonElement).style.color = "#8A8078")
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                width: "100%",
                padding: "13px 0",
                borderRadius: 12,
                border: "none",
                background: loading
                  ? "rgba(197,160,89,0.5)"
                  : "linear-gradient(135deg, #C5A059 0%, #D4B472 45%, #A8853A 100%)",
                color: "white",
                fontSize: 14,
                fontWeight: 600,
                fontFamily: "Georgia, serif",
                letterSpacing: "0.04em",
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                transition: "all 0.25s",
                boxShadow: loading ? "none" : "0 4px 20px rgba(197,160,89,0.35)",
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    "0 6px 28px rgba(197,160,89,0.5)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.boxShadow =
                  "0 4px 20px rgba(197,160,89,0.35)";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
                  Signing in…
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  Sign In to Dashboard
                </>
              )}
            </button>
          </form>

          {/* Forgot password */}
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              type="button"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                fontFamily: "Georgia, serif",
                color: "#8A8078",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#C5A059")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.color = "#8A8078")
              }
            >
              Forgot your password?
            </button>
          </div>
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            padding: "14px 40px 18px",
            borderTop: "1px solid #F0EBE2",
            background: "#FDFCF8",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
          }}
        >
          {["🔒 Encrypted", "✦ HIPAA Ready", "◈ Private"].map((item) => (
            <span
              key={item}
              style={{ fontSize: 10, color: "#A89E94", fontWeight: 500, letterSpacing: "0.05em" }}
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #C4BBAF; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #FDFCF9 inset !important;
          -webkit-text-fill-color: #1A1A1A !important;
        }
      `}</style>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const labelSx: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.12em",
  color: "#8A8078",
  marginBottom: 7,
};

const inputSx: React.CSSProperties = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "Georgia, serif",
  background: "#FDFCF9",
  border: "1px solid #E8E2D4",
  color: "#1A1A1A",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
  boxSizing: "border-box",
};

function applyFocus(el: HTMLInputElement) {
  el.style.borderColor = "#C5A059";
  el.style.boxShadow = "0 0 0 3px rgba(197,160,89,0.13)";
}
function removeFocus(el: HTMLInputElement) {
  el.style.borderColor = "#E8E2D4";
  el.style.boxShadow = "none";
}
