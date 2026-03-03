"use client";

import React from "react";

interface SkeletonProps {
  width?:  number | string;
  height?: number | string;
  circle?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ width, height = 12, circle, className, style }: SkeletonProps) {
  return (
    <div
      className={`skeleton ${className ?? ""}`}
      style={{
        width:  width  ?? "100%",
        height: height ?? 12,
        borderRadius: circle ? "50%" : undefined,
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

// ── Pre-built skeletons ────────────────────────────────────────────────────

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "12px 14px" }}>
          <Skeleton height={12} width={`${60 + Math.random() * 30}%`} />
        </td>
      ))}
    </tr>
  );
}

export function CardSkeleton() {
  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton height={14} width="60%" />
      <Skeleton height={10} width="40%" />
      <Skeleton height={28} width="80%" style={{ marginTop: 4 }} />
    </div>
  );
}

export function KpiSkeleton() {
  return (
    <div className="kpi-card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Skeleton height={10} width="50%" />
      <Skeleton height={28} width="70%" />
    </div>
  );
}
