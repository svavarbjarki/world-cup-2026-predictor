"use client";

// Shared styling and helpers for the /stats Recharts components. Everything here
// is theme-driven: colors come from the app's CSS variable tokens (defined in
// globals.css via @theme), so the charts match the near-black + gold palette and
// follow any future token change. SVG resolves `var(--color-...)` for fills and
// strokes, so the tokens are used directly rather than hardcoded hex.

import type { CSSProperties } from "react";

/**
 * Distinct series colors for the per-player charts, ordered so the first few are
 * the strongest on the near-black background. Gold leads (it is the app accent),
 * followed by hues chosen to stay legible and distinguishable on dark. Series
 * cycle through this if there are more players than colors.
 */
export const SERIES_COLORS = [
  "var(--color-gold-bright)",
  "#5b9cf6", // blue
  "#46c79a", // teal-green
  "#e8734a", // orange
  "#b98bdb", // violet
  "#e5689b", // pink
  "#6fd0e0", // cyan
  "#d6c14a", // muted yellow
  "#8fbf5e", // olive-green
  "#d2685f", // soft red
] as const;

/** Color for series index i, cycling through the palette. */
export function seriesColor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length];
}

/** Segment colors for the accuracy stacked bar. */
export const ACCURACY_COLORS = {
  exact: "var(--color-gold-bright)",
  result: "#5b9cf6",
  wrong: "#5b5b66",
} as const;

/** Single-series bar fill (champion / award / predicted goals). */
export const BAR_FILL = "var(--color-gold-bright)";

/** The reference line color on the predicted-vs-actual chart. */
export const REFERENCE_COLOR = "#e5689b";

/** Axis tick text styling, shared by every chart. */
export const axisTick: { fill: string; fontSize: number } = {
  fill: "var(--color-text-muted)",
  fontSize: 11,
};

/** Cartesian grid stroke. */
export const gridStroke = "var(--color-border)";

/** Tooltip styling props (Recharts merges these onto its default tooltip). */
export const tooltipProps = {
  contentStyle: {
    background: "var(--color-surface-raised)",
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--color-text)",
  } as CSSProperties,
  labelStyle: { color: "var(--color-text)", fontWeight: 600 } as CSSProperties,
  itemStyle: { color: "var(--color-text)" } as CSSProperties,
  cursor: { fill: "rgba(255,255,255,0.04)" },
};

/** Legend text styling. */
export const legendStyle: CSSProperties = {
  fontSize: 11,
  color: "var(--color-text-muted)",
};

/** Fixed height for every chart's responsive container. */
export const CHART_HEIGHT = 240;

/**
 * The waiting / empty stand-in, matching the Stage 1 placeholder box so the
 * layout is stable whether or not a chart has data yet.
 */
export function ChartMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface-raised/40 text-center text-xs text-text-muted">
      {children}
    </div>
  );
}
