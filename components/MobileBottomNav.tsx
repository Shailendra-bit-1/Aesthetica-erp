"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Calendar, Target, Grid3X3 } from "lucide-react";


const NAV = [
  { label: "Home",      href: "/",          icon: LayoutDashboard },
  { label: "Patients",  href: "/patients",   icon: Users           },
  { label: "Scheduler", href: "/scheduler",  icon: Calendar        },
  { label: "CRM",       href: "/crm",        icon: Target          },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/intake")) return null;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      height: 60,
      background: "var(--primary)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-around",
      zIndex: "var(--z-topbar)" as React.CSSProperties["zIndex"],
      boxShadow: "0 -2px 12px rgba(0,0,0,0.15)",
    }} className="md:hidden">
      {NAV.map(item => (
        <Link key={item.href} href={item.href} style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
          textDecoration: "none",
          padding: "6px 12px",
          borderRadius: 8,
          color: isActive(item.href) ? "#fff" : "rgba(255,255,255,0.55)",
          background: isActive(item.href) ? "rgba(255,255,255,0.15)" : "transparent",
          minWidth: 60,
        }}>
          <item.icon size={18} />
          <span style={{ fontSize: 10, fontWeight: isActive(item.href) ? 600 : 400 }}>{item.label}</span>
        </Link>
      ))}
      <Link href="/scheduler" style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
        textDecoration: "none", padding: "6px 12px", borderRadius: 8,
        color: "rgba(255,255,255,0.55)", minWidth: 60,
      }}>
        <Grid3X3 size={18} />
        <span style={{ fontSize: 10 }}>Apps</span>
      </Link>
    </nav>
  );
}
