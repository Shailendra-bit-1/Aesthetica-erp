"use client";

import React from "react";
import clsx from "clsx";

interface CardProps {
  children:  React.ReactNode;
  className?: string;
  elevated?:  boolean;
  style?:     React.CSSProperties;
  onClick?:   () => void;
  padding?:   number | string;
}

export function Card({ children, className, elevated, style, onClick, padding = "20px" }: CardProps) {
  return (
    <div
      className={clsx(elevated ? "card-elevated" : "card", onClick && "cursor-pointer", className)}
      style={{ padding, ...style }}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── KPI / Stat Card ────────────────────────────────────────────────────────

interface StatCardProps {
  label:  string;
  value:  React.ReactNode;
  icon?:  React.ReactNode;
  color?: string;
  hint?:  string;
  trend?: { value: string; up: boolean };
}

export function StatCard({ label, value, icon, color = "var(--gold)", hint, trend }: StatCardProps) {
  return (
    <div className="kpi-card">
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        {icon && <span style={{ color, flexShrink: 0 }}>{icon}</span>}
        <span className="text-label">{label}</span>
        {trend && (
          <span style={{
            marginLeft: "auto", fontSize: 10, fontWeight: 600,
            color: trend.up ? "var(--success)" : "var(--error)",
            padding: "1px 5px", borderRadius: "var(--radius-pill)",
            background: trend.up ? "var(--success-bg)" : "var(--error-bg)",
          }}>
            {trend.up ? "↑" : "↓"} {trend.value}
          </span>
        )}
      </div>
      <p style={{ fontSize: 24, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0, lineHeight: 1.2 }}>
        {value}
      </p>
      {hint && <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{hint}</p>}
    </div>
  );
}
