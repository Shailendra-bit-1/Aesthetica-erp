"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open:       boolean;
  onClose:    () => void;
  title:      string;
  subtitle?:  string;
  children:   React.ReactNode;
  footer?:    React.ReactNode;
  size?:      "sm" | "md" | "lg";
  headerActions?: React.ReactNode;
}

const SIZES = {
  sm: 420,
  md: 560,
  lg: 680,
};

export function Drawer({ open, onClose, title, subtitle, children, footer, size = "md", headerActions }: DrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="drawer-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ zIndex: 200 }}
    >
      <div
        className="drawer-panel animate-slide-right"
        style={{ width: SIZES[size] }}
      >
        {/* Header */}
        <div className="drawer-header">
          <div>
            <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0 }}>
              {title}
            </h2>
            {subtitle && (
              <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{subtitle}</p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {headerActions}
            <button
              onClick={onClose}
              style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "var(--bg-surface)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X size={14} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="drawer-body">
          {children}
        </div>

        {/* Footer */}
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
