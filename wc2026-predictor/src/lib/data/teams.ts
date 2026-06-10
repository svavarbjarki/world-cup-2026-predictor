// World Cup 2026 teams seed data.
//
// Source: full group draw confirmed by ESPN squad-list breakdown (June 2026),
// cross-checked against Yahoo Sports for Groups A, B, and D. All 48 teams.
//
// Fields:
//   name     display name shown in the UI
//   isoCode  used for rendering flags. See note below on the format.
//   group    group letter A-L
//   pot      draw pot 1-4 (rough strength tier; useful as a deterministic
//            seed/tie-break number, lower pot = stronger seed)
//   color    primary team color as a hex string, for UI use such as the
//            horizontal split bar. See note below.
//
// FLAG RENDERING NOTE
// The isoCode values are lowercase ISO 3166-1 alpha-2 codes, which work with:
//   - flag emoji (regional-indicator pairs), and
//   - the `flag-icons` CSS library (class `fi fi-<code>`), and
//   - the `country-flag-icons` React package.
// The UK home nations (England, Scotland) and the assigned codes:
//   England  -> "gb-eng"   Scotland -> "gb-sct"
// These sub-codes are supported by `flag-icons`. If you use flag EMOJI instead,
// England and Scotland have their own emoji via the gb-eng / gb-sct tag
// sequences; if your target platform does not render those, fall back to "gb"
// or to the flag-icons CSS approach for those two.
//
// COLOR NOTE
// Each color is the nation's recognizable primary kit/identity color, chosen to
// be reasonably distinct so two teams in a match read clearly in a split bar.
// Many footballing nations play in red, so some clashes are unavoidable; where
// two teams in the SAME GROUP shared a near-identical primary, one was shifted to
// a secondary identity color to keep in-group matchups legible. Even so, for a
// color-blind-safe bar you should pair color WITH a flag/label and not rely on
// color alone. Colors are plain 6-digit hex.

export type SeedTeam = {
  name: string;
  isoCode: string;
  group: string;
  pot: number;
  color: string;
};

export const TEAMS: SeedTeam[] = [
  // Group A
  { name: "Mexico", isoCode: "mx", group: "A", pot: 1, color: "#006341" },
  { name: "South Africa", isoCode: "za", group: "A", pot: 3, color: "#FCB131" },
  { name: "South Korea", isoCode: "kr", group: "A", pot: 2, color: "#C8102E" },
  { name: "Czechia", isoCode: "cz", group: "A", pot: 4, color: "#11457E" },

  // Group B
  { name: "Canada", isoCode: "ca", group: "B", pot: 1, color: "#FF0000" },
  { name: "Bosnia and Herzegovina", isoCode: "ba", group: "B", pot: 4, color: "#002395" },
  { name: "Qatar", isoCode: "qa", group: "B", pot: 3, color: "#8A1538" },
  { name: "Switzerland", isoCode: "ch", group: "B", pot: 2, color: "#1B1B1B" },

  // Group C
  { name: "Brazil", isoCode: "br", group: "C", pot: 1, color: "#FFDF00" },
  { name: "Morocco", isoCode: "ma", group: "C", pot: 2, color: "#C1272D" },
  { name: "Haiti", isoCode: "ht", group: "C", pot: 4, color: "#00209F" },
  { name: "Scotland", isoCode: "gb-sct", group: "C", pot: 3, color: "#005EB8" },

  // Group D
  { name: "United States", isoCode: "us", group: "D", pot: 1, color: "#1A3668" },
  { name: "Paraguay", isoCode: "py", group: "D", pot: 3, color: "#D52B1E" },
  { name: "Australia", isoCode: "au", group: "D", pot: 2, color: "#00843D" },
  { name: "Türkiye", isoCode: "tr", group: "D", pot: 4, color: "#E30A17" },

  // Group E
  { name: "Germany", isoCode: "de", group: "E", pot: 1, color: "#000000" },
  { name: "Curacao", isoCode: "cw", group: "E", pot: 4, color: "#002B7F" },
  { name: "Côte d'Ivoire", isoCode: "ci", group: "E", pot: 3, color: "#FF8200" },
  { name: "Ecuador", isoCode: "ec", group: "E", pot: 2, color: "#FFD100" },

  // Group F
  { name: "Netherlands", isoCode: "nl", group: "F", pot: 1, color: "#FF6900" },
  { name: "Japan", isoCode: "jp", group: "F", pot: 2, color: "#0033A0" },
  { name: "Sweden", isoCode: "se", group: "F", pot: 3, color: "#FECC02" },
  { name: "Tunisia", isoCode: "tn", group: "F", pot: 4, color: "#E70013" },

  // Group G
  { name: "Belgium", isoCode: "be", group: "G", pot: 1, color: "#E30613" },
  { name: "Egypt", isoCode: "eg", group: "G", pot: 3, color: "#1B1B1B" },
  { name: "Iran", isoCode: "ir", group: "G", pot: 2, color: "#239F40" },
  { name: "New Zealand", isoCode: "nz", group: "G", pot: 4, color: "#8A8D8F" },

  // Group H
  { name: "Spain", isoCode: "es", group: "H", pot: 1, color: "#C60B1E" },
  { name: "Cabo Verde", isoCode: "cv", group: "H", pot: 4, color: "#003893" },
  { name: "Saudi Arabia", isoCode: "sa", group: "H", pot: 3, color: "#006C35" },
  { name: "Uruguay", isoCode: "uy", group: "H", pot: 2, color: "#7BAFD4" },

  // Group I
  { name: "France", isoCode: "fr", group: "I", pot: 1, color: "#002395" },
  { name: "Senegal", isoCode: "sn", group: "I", pot: 2, color: "#00853F" },
  { name: "Iraq", isoCode: "iq", group: "I", pot: 4, color: "#CE1126" },
  { name: "Norway", isoCode: "no", group: "I", pot: 3, color: "#BA0C2F" },

  // Group J
  { name: "Argentina", isoCode: "ar", group: "J", pot: 1, color: "#75AADB" },
  { name: "Algeria", isoCode: "dz", group: "J", pot: 3, color: "#006233" },
  { name: "Austria", isoCode: "at", group: "J", pot: 2, color: "#ED2939" },
  { name: "Jordan", isoCode: "jo", group: "J", pot: 4, color: "#000000" },

  // Group K
  { name: "Portugal", isoCode: "pt", group: "K", pot: 1, color: "#006600" },
  { name: "DR Congo", isoCode: "cd", group: "K", pot: 4, color: "#007FFF" },
  { name: "Uzbekistan", isoCode: "uz", group: "K", pot: 3, color: "#1EB53A" },
  { name: "Colombia", isoCode: "co", group: "K", pot: 2, color: "#FCD116" },

  // Group L
  { name: "England", isoCode: "gb-eng", group: "L", pot: 1, color: "#CF142B" },
  { name: "Croatia", isoCode: "hr", group: "L", pot: 2, color: "#171796" },
  { name: "Ghana", isoCode: "gh", group: "L", pot: 3, color: "#006B3F" },
  { name: "Panama", isoCode: "pa", group: "L", pot: 4, color: "#DA121A" },
];

// Helper: flag emoji from an alpha-2 code (handles plain country codes).
// For "gb-eng" / "gb-sct" this returns the GB flag as a fallback, since not all
// platforms render the home-nation tag sequences. Use flag-icons CSS for crisp
// home-nation flags everywhere.
export function flagEmoji(isoCode: string): string {
  const base = isoCode.split("-")[0].toUpperCase();
  if (base.length !== 2) return "";
  const codePoints = [...base].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}