// Static lookup of each team's identity colour, keyed by isoCode. Kept as a
// static import (like the rest of the team reference data) so the split bar can
// resolve a colour from the isoCode it already has, with no DB column needed.

import { TEAMS } from "@/lib/data/teams";

const colorByIso = new Map(TEAMS.map((t) => [t.isoCode, t.color]));

const FALLBACK = "#6b7280"; // neutral gray for an unknown team

/** The team's primary colour (hex), or a neutral gray if unknown. */
export function getTeamColor(isoCode: string): string {
  return colorByIso.get(isoCode) ?? FALLBACK;
}

/**
 * Black or white text that reads on the given hex background, by relative
 * luminance. Used for the percentage label drawn inside a coloured bar segment.
 */
export function readableTextColor(hex: string): "#000000" | "#ffffff" {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  // Perceptual luminance (sRGB coefficients), 0-255.
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? "#000000" : "#ffffff";
}
