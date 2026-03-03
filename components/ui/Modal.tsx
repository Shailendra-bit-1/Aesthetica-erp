"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open:      boolean;
  onClose:   () => void;
  title:     string;
  subtitle?: string;
  children:  React.ReactNode;
  footer?:   React.ReactNode;
  maxWidth?: number;
}

export function Modal({ open, onClose, title, subtitle, children, footer, maxWidth = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-overlay animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel animate-fade-up" style={{ maxWidth }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 15, fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--text-primary)", margin: 0 }}>
                {title}
              </h2>
              {subtitle && (
                <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>{subtitle}</p>
              )}
            </div>
            <button
              onClick={onClose}
              style={{ width: 30, height: 30, borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              <X size={13} color="var(--text-muted)" />
            </button>
          </div>
        </div>

        <div className="modal-body">{children}</div>

        {footer && (
          <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
