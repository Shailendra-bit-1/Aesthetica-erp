"use client";

import React from "react";

interface PageHeaderProps {
  title:      string;
  subtitle?:  string;
  badge?:     React.ReactNode;
  actions?:   React.ReactNode;
  tabs?:      React.ReactNode;
}

export function PageHeader({ title, subtitle, badge, actions, tabs }: PageHeaderProps) {
  return (
    <div style={{ marginBottom: tabs ? 0 : 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0 }}>
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      {tabs && <div style={{ marginTop: 16 }}>{tabs}</div>}
    </div>
  );
}
