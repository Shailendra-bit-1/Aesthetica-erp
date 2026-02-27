import TopBar from "@/components/TopBar";
import Link from "next/link";
import { Crown, Network, Building2, Users, CreditCard, ScrollText } from "lucide-react";

const cards = [
  { icon: Network,   label: "Clinic & Chain Builder", desc: "Create and manage your clinic network", href: "/admin/manage",  color: "#C5A059" },
  { icon: Users,     label: "User Management",         desc: "Staff accounts and permissions",         href: "/admin/users",    color: "#8B7EC8" },
  { icon: CreditCard,label: "Billing & Plans",          desc: "Subscriptions and invoices",             href: "/admin/billing",  color: "#7A9E8E" },
  { icon: ScrollText,label: "Audit Log",                desc: "Full activity history",                  href: "/admin/audit",    color: "#9E8E7A" },
];

export default function AdminDashboard() {
  return (
    <div className="min-h-full" style={{ background: "var(--background)" }}>
      <TopBar />
      <div className="px-8 pb-10">

        {/* Hero banner */}
        <div
          className="rounded-2xl px-8 py-10 mb-8 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, #1C1917 0%, #2C2520 100%)",
            border: "1px solid rgba(197,160,89,0.25)",
          }}
        >
          {/* Decorative rings */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 200, height: 200, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.08)" }} />
          <div style={{ position: "absolute", top: -30, right: -30, width: 140, height: 140, borderRadius: "50%", border: "1px solid rgba(197,160,89,0.12)" }} />

          <div className="flex items-center gap-4 mb-4 relative">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(197,160,89,0.15)", border: "1px solid rgba(197,160,89,0.3)" }}
            >
              <Crown size={22} color="#C5A059" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-widest font-semibold mb-0.5" style={{ color: "rgba(197,160,89,0.6)" }}>
                Superadmin Console
              </p>
              <h1
                className="text-2xl font-semibold"
                style={{ color: "#F9F7F2", fontFamily: "Georgia, serif" }}
              >
                Master Control Panel
              </h1>
            </div>
          </div>
          <p className="text-sm relative" style={{ color: "rgba(232,226,212,0.5)", maxWidth: 400 }}>
            Full access to clinic network management, billing, users, and system logs.
          </p>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-2 gap-5">
          {cards.map(({ icon: Icon, label, desc, href, color }) => (
            <Link
              key={href}
              href={href}
              className="luxury-card rounded-2xl p-6 flex items-start gap-4 group transition-all duration-200"
              style={{ background: "var(--surface)", textDecoration: "none" }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18`, border: `1px solid ${color}28` }}
              >
                <Icon size={20} style={{ color }} />
              </div>
              <div>
                <p
                  className="text-base font-semibold mb-1"
                  style={{ color: "var(--foreground)", fontFamily: "Georgia, serif" }}
                >
                  {label}
                </p>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
