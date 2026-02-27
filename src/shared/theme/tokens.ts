/**
 * Linen & Gold Design Tokens
 * ──────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all brand/style values.
 * These mirror the CSS variables in app/globals.css.
 *
 * Usage (in TS/TSX inline styles):
 *   import { tokens, gold } from "@shared/theme/tokens";
 *   style={{ background: tokens.color.surface, color: gold(0.6) }}
 *
 * When a rebrand happens, change values HERE — all components inherit.
 * ──────────────────────────────────────────────────────────────────────────────
 */

export const tokens = {
  color: {
    background:   "#F9F7F2",
    foreground:   "#1A1A1A",
    gold:         "#C5A059",
    goldLight:    "#D4B472",
    goldDark:     "#A8853A",
    surface:      "#FFFFFF",
    surfaceWarm:  "#F4F1EA",
    border:       "#E8E2D4",
    textMuted:    "#8A8078",
    sidebarBg:    "#1C1917",
    sidebarText:  "#E8E2D4",
    cardBg:       "#FFFFFF",
    inputBg:      "#F4F1EA",
    // Status colours
    success:      "#4A8A4A",
    warning:      "#D4A017",
    danger:       "#B43C3C",
    info:         "#2A4A8A",
  },
  font: {
    serif:  "Georgia, 'Times New Roman', serif",
    sans:   "var(--font-geist-sans), system-ui, sans-serif",
    mono:   "var(--font-geist-mono), 'Courier New', monospace",
  },
  radius: {
    sm:   6,
    md:   10,
    lg:   14,
    xl:   18,
    full: 9999,
  },
  shadow: {
    card:   "0 2px 12px rgba(28,25,23,0.08)",
    modal:  "0 24px 72px rgba(28,25,23,0.22)",
    goldGlow: "0 0 18px rgba(197,160,89,0.35)",
  },
  transition: {
    fast:   "0.15s ease",
    normal: "0.25s ease",
    slow:   "0.3s cubic-bezier(0.4, 0, 0.2, 1)",
  },
} as const;

/** Helper: rgba gold with arbitrary opacity */
export const gold = (opacity = 1) => `rgba(197,160,89,${opacity})`;

/** Gradient helpers */
export const goldGradient = "linear-gradient(135deg, #C5A059, #A8853A)";
export const sidebarGradient = "linear-gradient(180deg, #1C1917 0%, #141210 100%)";

/** Common inline style presets */
export const stylePresets = {
  goldButton: {
    background:  goldGradient,
    color:       "white",
    border:      "none",
    borderRadius: tokens.radius.lg,
    fontFamily:  tokens.font.serif,
    fontWeight:  600,
    boxShadow:   "0 4px 14px rgba(197,160,89,0.35)",
    cursor:      "pointer",
  },
  card: {
    background:  tokens.color.cardBg,
    border:      `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.xl,
  },
  input: {
    background:  tokens.color.inputBg,
    border:      `1px solid ${tokens.color.border}`,
    borderRadius: tokens.radius.md,
    fontFamily:  tokens.font.serif,
    color:       tokens.color.foreground,
    outline:     "none",
    width:       "100%",
    padding:     "10px 13px",
    boxSizing:   "border-box" as const,
    fontSize:    14,
  },
} as const;
