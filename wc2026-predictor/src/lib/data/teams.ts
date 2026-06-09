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

export type SeedTeam = {
  name: string;
  isoCode: string;
  group: string;
  pot: number;
};

export const TEAMS: SeedTeam[] = [
  // Group A
  { name: "Mexico", isoCode: "mx", group: "A", pot: 1 },
  { name: "South Africa", isoCode: "za", group: "A", pot: 3 },
  { name: "South Korea", isoCode: "kr", group: "A", pot: 2 },
  { name: "Czechia", isoCode: "cz", group: "A", pot: 4 },

  // Group B
  { name: "Canada", isoCode: "ca", group: "B", pot: 1 },
  { name: "Bosnia and Herzegovina", isoCode: "ba", group: "B", pot: 4 },
  { name: "Qatar", isoCode: "qa", group: "B", pot: 3 },
  { name: "Switzerland", isoCode: "ch", group: "B", pot: 2 },

  // Group C
  { name: "Brazil", isoCode: "br", group: "C", pot: 1 },
  { name: "Morocco", isoCode: "ma", group: "C", pot: 2 },
  { name: "Haiti", isoCode: "ht", group: "C", pot: 4 },
  { name: "Scotland", isoCode: "gb-sct", group: "C", pot: 3 },

  // Group D
  { name: "United States", isoCode: "us", group: "D", pot: 1 },
  { name: "Paraguay", isoCode: "py", group: "D", pot: 3 },
  { name: "Australia", isoCode: "au", group: "D", pot: 2 },
  { name: "Türkiye", isoCode: "tr", group: "D", pot: 4 },

  // Group E
  { name: "Germany", isoCode: "de", group: "E", pot: 1 },
  { name: "Curaçao", isoCode: "cw", group: "E", pot: 4 },
  { name: "Côte d'Ivoire", isoCode: "ci", group: "E", pot: 3 },
  { name: "Ecuador", isoCode: "ec", group: "E", pot: 2 },

  // Group F
  { name: "Netherlands", isoCode: "nl", group: "F", pot: 1 },
  { name: "Japan", isoCode: "jp", group: "F", pot: 2 },
  { name: "Sweden", isoCode: "se", group: "F", pot: 3 },
  { name: "Tunisia", isoCode: "tn", group: "F", pot: 4 },

  // Group G
  { name: "Belgium", isoCode: "be", group: "G", pot: 1 },
  { name: "Egypt", isoCode: "eg", group: "G", pot: 3 },
  { name: "Iran", isoCode: "ir", group: "G", pot: 2 },
  { name: "New Zealand", isoCode: "nz", group: "G", pot: 4 },

  // Group H
  { name: "Spain", isoCode: "es", group: "H", pot: 1 },
  { name: "Cabo Verde", isoCode: "cv", group: "H", pot: 4 },
  { name: "Saudi Arabia", isoCode: "sa", group: "H", pot: 3 },
  { name: "Uruguay", isoCode: "uy", group: "H", pot: 2 },

  // Group I
  { name: "France", isoCode: "fr", group: "I", pot: 1 },
  { name: "Senegal", isoCode: "sn", group: "I", pot: 2 },
  { name: "Iraq", isoCode: "iq", group: "I", pot: 4 },
  { name: "Norway", isoCode: "no", group: "I", pot: 3 },

  // Group J
  { name: "Argentina", isoCode: "ar", group: "J", pot: 1 },
  { name: "Algeria", isoCode: "dz", group: "J", pot: 3 },
  { name: "Austria", isoCode: "at", group: "J", pot: 2 },
  { name: "Jordan", isoCode: "jo", group: "J", pot: 4 },

  // Group K
  { name: "Portugal", isoCode: "pt", group: "K", pot: 1 },
  { name: "DR Congo", isoCode: "cd", group: "K", pot: 4 },
  { name: "Uzbekistan", isoCode: "uz", group: "K", pot: 3 },
  { name: "Colombia", isoCode: "co", group: "K", pot: 2 },

  // Group L
  { name: "England", isoCode: "gb-eng", group: "L", pot: 1 },
  { name: "Croatia", isoCode: "hr", group: "L", pot: 2 },
  { name: "Ghana", isoCode: "gh", group: "L", pot: 3 },
  { name: "Panama", isoCode: "pa", group: "L", pot: 4 },
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
