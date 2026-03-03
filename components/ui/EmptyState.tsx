"use client";

import React from "react";

interface EmptyStateProps {
  icon?:    React.ReactNode;
  title:    string;
  message?: string;
  action?:  React.ReactNode;
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 24px", gap: 12 }}>
      {icon && (
        <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--gold-light)", border: "1px solid var(--gold-border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--gold)" }}>
          {icon}
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 600, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0, textAlign: "center" }}>
        {title}
      </p>
      {message && (
        <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, textAlign: "center", maxWidth: 280 }}>
          {message}
        </p>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
