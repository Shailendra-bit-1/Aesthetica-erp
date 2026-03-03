"use client";

import React from "react";
import clsx from "clsx";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?:    string;
  hint?:     string;
  error?:    string;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
  required?: boolean;
}

export function Input({
  label,
  hint,
  error,
  icon,
  iconRight,
  className,
  required,
  id,
  ...props
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-label" style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {label}
          {required && <span style={{ color: "var(--gold)" }}>*</span>}
        </label>
      )}
      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
        {icon && (
          <div style={{ position: "absolute", left: 10, pointerEvents: "none", display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            {icon}
          </div>
        )}
        <input
          id={inputId}
          className={clsx("ae-input", className)}
          style={{
            paddingLeft: icon ? 34 : undefined,
            paddingRight: iconRight ? 34 : undefined,
            borderColor: error ? "var(--error)" : undefined,
          }}
          {...props}
        />
        {iconRight && (
          <div style={{ position: "absolute", right: 10, display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            {iconRight}
          </div>
        )}
      </div>
      {error && <p style={{ fontSize: 11, color: "var(--error)", marginTop: 2 }}>{error}</p>}
      {hint && !error && <p style={{ fontSize: 11, color: "var(--text-muted)" }}>{hint}</p>}
    </div>
  );
}
