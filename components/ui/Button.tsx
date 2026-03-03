"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  icon?:     React.ReactNode;
  iconRight?: React.ReactNode;
}

const VARIANT_STYLES: Record<Variant, string> = {
  primary:   "btn btn-primary",
  secondary: "btn btn-secondary",
  ghost:     "btn btn-ghost",
  danger:    "btn btn-danger",
};

const SIZE_STYLES: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  icon,
  iconRight,
  children,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(VARIANT_STYLES[variant], SIZE_STYLES[size], className)}
      {...props}
    >
      {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  );
}
