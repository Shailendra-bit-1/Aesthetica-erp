"use client";

import React from "react";
import clsx from "clsx";

type BadgeVariant = "gold" | "success" | "warning" | "error" | "info" | "neutral";

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?:    React.ReactNode;
  className?: string;
  dot?:     boolean;
}

const VARIANT_MAP: Record<BadgeVariant, string> = {
  gold:    "badge-gold",
  success: "badge-success",
  warning: "badge-warning",
  error:   "badge-error",
  info:    "badge-info",
  neutral: "badge-neutral",
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  gold:    "var(--gold)",
  success: "var(--success)",
  warning: "var(--warning)",
  error:   "var(--error)",
  info:    "var(--info)",
  neutral: "var(--text-muted)",
};

export function Badge({ variant = "neutral", children, icon, className, dot }: BadgeProps) {
  return (
    <span className={clsx("badge", VARIANT_MAP[variant], className)}>
      {dot && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: DOT_COLORS[variant], flexShrink: 0, display: "inline-block" }} />
      )}
      {icon}
      {children}
    </span>
  );
}
