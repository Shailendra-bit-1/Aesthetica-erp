"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Sparkles, MapPin, Phone, Clock, CheckCircle2 } from "lucide-react";

interface ClinicInfo {
  name: string;
  location: string | null;
}

export default function WelcomePage() {
  const params       = useParams();
  const searchParams = useSearchParams();
  const clinicId     = params.clinicId as string;
  const patientName  = searchParams.get("name") ?? "Welcome";

  const [clinic,  setClinic]  = useState<ClinicInfo | null>(null);
  const [visible, setVisible] = useState(false);

  const fetchClinic = useCallback(async () => {
    try {
      const res  = await fetch(`/api/intake/clinic/${clinicId}`);
      const data = await res.json();
      if (data.clinic) setClinic(data.clinic);
    } catch { /* silent */ }
  }, [clinicId]);

  useEffect(() => {
    fetchClinic();
    // Trigger fade-in animation after mount
    const t = setTimeout(() => setVisible(true), 60);
    return () => clearTimeout(t);
  }, [fetchClinic]);

  const firstName = patientName.split(" ")[0];

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.7); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>

      {/* ── Full-page linen background ── */}
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
        style={{
          background: "#F9F7F2",
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 20px,
              rgba(197,160,89,0.025) 20px,
              rgba(197,160,89,0.025) 21px
            )
          `,
        }}
      >
        {/* ── Card ── */}
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "white",
            border: "1px solid rgba(197,160,89,0.45)",
            borderRadius: 24,
            boxShadow: "0 12px 56px rgba(28,25,23,0.1), 0 2px 8px rgba(28,25,23,0.05)",
            overflow: "hidden",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(16px)",
            transition: "opacity 0.6s ease, transform 0.6s ease",
          }}
        >
          {/* Gold bar */}
          <div
            style={{
              height: 4,
              background: "linear-gradient(90deg, #C5A059, #A8853A, #C5A059)",
              backgroundSize: "200% 100%",
              animation: "shimmer 3s linear infinite",
            }}
          />

          <div className="px-10 py-10 text-center">

            {/* ── Animated checkmark ── */}
            <div
              className="mx-auto mb-6"
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                background: "rgba(197,160,89,0.1)",
                border: "2px solid rgba(197,160,89,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                animation: visible ? "scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) 0.2s both" : "none",
              }}
            >
              <CheckCircle2 size={34} style={{ color: "#C5A059" }} />
            </div>

            {/* ── Greeting ── */}
            <div
              style={{
                animation: visible ? "fadeUp 0.5s ease 0.35s both" : "none",
              }}
            >
              <h1
                className="text-3xl font-semibold mb-2"
                style={{ color: "#1C1917", fontFamily: "Georgia, serif", lineHeight: 1.2 }}
              >
                Welcome,{" "}
                <span style={{ color: "#C5A059" }}>{firstName}</span>.
              </h1>
              <p className="text-base mb-1" style={{ color: "#5C5447", fontFamily: "Georgia, serif" }}>
                Your details have been received.
              </p>
              <p className="text-sm" style={{ color: "#9C9584" }}>
                The team will be with you shortly.
              </p>
            </div>

            {/* ── Divider ── */}
            <div
              className="my-7"
              style={{
                height: 1,
                background: "rgba(197,160,89,0.15)",
                animation: visible ? "fadeUp 0.5s ease 0.45s both" : "none",
              }}
            />

            {/* ── Clinic info ── */}
            <div
              className="space-y-4"
              style={{
                animation: visible ? "fadeUp 0.5s ease 0.5s both" : "none",
              }}
            >
              {/* Clinic name */}
              <div className="flex items-center justify-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(197,160,89,0.1)" }}
                >
                  <Sparkles size={14} style={{ color: "#C5A059" }} />
                </div>
                <span
                  className="text-base font-semibold"
                  style={{ color: "#1C1917", fontFamily: "Georgia, serif" }}
                >
                  {clinic?.name ?? "Aesthetica Clinic"}
                </span>
              </div>

              {/* Address */}
              {clinic?.location && (
                <div className="flex items-center justify-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(197,160,89,0.08)" }}
                  >
                    <MapPin size={14} style={{ color: "#C5A059" }} />
                  </div>
                  <span className="text-sm" style={{ color: "#6B6358" }}>
                    {clinic.location}
                  </span>
                </div>
              )}

              {/* Wait time hint */}
              <div className="flex items-center justify-center gap-2.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(197,160,89,0.08)" }}
                >
                  <Clock size={14} style={{ color: "#C5A059" }} />
                </div>
                <span className="text-sm" style={{ color: "#6B6358" }}>
                  Please take a seat — we&apos;ll call your name shortly
                </span>
              </div>
            </div>

            {/* ── Footer note ── */}
            <div
              className="mt-8 px-6 py-4 rounded-2xl"
              style={{
                background: "rgba(249,247,242,0.8)",
                border: "1px solid rgba(197,160,89,0.15)",
                animation: visible ? "fadeUp 0.5s ease 0.6s both" : "none",
              }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "#9C9584", fontFamily: "Georgia, serif" }}>
                Your consultation details are now with your care team. If you have any urgent concerns,
                please let the reception know.
              </p>
            </div>

            {/* Contact placeholder */}
            <div
              className="flex items-center justify-center gap-2 mt-5"
              style={{
                animation: visible ? "fadeUp 0.5s ease 0.65s both" : "none",
              }}
            >
              <Phone size={12} style={{ color: "rgba(197,160,89,0.5)" }} />
              <p className="text-xs" style={{ color: "#B8AE9C" }}>
                Reception is available for any questions
              </p>
            </div>
          </div>
        </div>

        {/* ── Footer watermark ── */}
        <p className="text-xs mt-6" style={{ color: "rgba(156,149,132,0.4)", letterSpacing: "0.05em" }}>
          Powered by Aesthetica Clinic Suite · 2026
        </p>
      </div>
    </>
  );
}
