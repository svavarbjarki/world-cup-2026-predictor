// World Cup 2026 match schedule.
//
// Source: full schedule published by Al Jazeera (6 Dec 2025) after the group draw,
// with GMT kickoff times and venues. The published version used "TBD" for the six
// playoff-winner slots; those are resolved here to the now-known teams, since each
// TBD was the only unlisted team in its group for that fixture:
//   Group A 4th = Czechia, Group B 4th = Bosnia and Herzegovina, Group D 4th = Türkiye,
//   Group F 4th = Sweden, Group I = Iraq, Group K = DR Congo.
//
// TIMES: stored as ISO 8601 UTC strings (the source GMT == UTC). Convert/format for
// display in the UI. Where the source gave a "(HH:MM GMT next day)" note, that is
// reflected in the date+time below.
//
// ACCURACY CAVEAT: this comes from a news article, not FIFA directly, and a couple of
// source rows had formatting typos that were resolved to the most sensible value.
// Good enough to drive "next match" ordering and display for a friends' game; worth a
// cross-check against FIFA.com closer to kickoff if exact times matter.
//
// Team names MUST match the `name` values in teams.ts exactly so fixtures can be matched.
// (Note: teams.ts uses "Côte d'Ivoire", "Cabo Verde", "DR Congo", "Türkiye". This file
//  uses those same canonical names.)

export type ScheduleMatch = {
  // Group stage: "A".."L". Knockout: "R32" | "R16" | "QF" | "SF" | "BRONZE" | "FINAL".
  stage: string;
  // Group fixtures name both teams. Knockout time-slots leave teams null (organizer
  // enters real pairings via /admin). homeTeam/awayTeam must match teams.ts names.
  homeTeam: string | null;
  awayTeam: string | null;
  kickoffUtc: string; // ISO 8601 UTC
  venue: string;
};

export const GROUP_SCHEDULE: ScheduleMatch[] = [
  // Thursday, June 11
  { stage: "A", homeTeam: "Mexico", awayTeam: "South Africa", kickoffUtc: "2026-06-11T21:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "A", homeTeam: "South Korea", awayTeam: "Czechia", kickoffUtc: "2026-06-12T04:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Friday, June 12
  { stage: "B", homeTeam: "Canada", awayTeam: "Bosnia and Herzegovina", kickoffUtc: "2026-06-12T20:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "D", homeTeam: "United States", awayTeam: "Paraguay", kickoffUtc: "2026-06-13T05:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },

  // Saturday, June 13
  { stage: "B", homeTeam: "Qatar", awayTeam: "Switzerland", kickoffUtc: "2026-06-13T23:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },
  { stage: "C", homeTeam: "Brazil", awayTeam: "Morocco", kickoffUtc: "2026-06-13T23:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "C", homeTeam: "Haiti", awayTeam: "Scotland", kickoffUtc: "2026-06-14T02:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "D", homeTeam: "Australia", awayTeam: "Türkiye", kickoffUtc: "2026-06-14T08:00:00Z", venue: "BC Place, Vancouver" },

  // Sunday, June 14
  { stage: "E", homeTeam: "Germany", awayTeam: "Curacao", kickoffUtc: "2026-06-14T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "F", homeTeam: "Netherlands", awayTeam: "Japan", kickoffUtc: "2026-06-14T22:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "E", homeTeam: "Cote d'Ivoire", awayTeam: "Ecuador", kickoffUtc: "2026-06-15T00:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "F", homeTeam: "Sweden", awayTeam: "Tunisia", kickoffUtc: "2026-06-15T04:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Monday, June 15
  { stage: "H", homeTeam: "Spain", awayTeam: "Cabo Verde", kickoffUtc: "2026-06-15T17:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "G", homeTeam: "Belgium", awayTeam: "Egypt", kickoffUtc: "2026-06-15T23:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "H", homeTeam: "Saudi Arabia", awayTeam: "Uruguay", kickoffUtc: "2026-06-15T23:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "G", homeTeam: "Iran", awayTeam: "New Zealand", kickoffUtc: "2026-06-16T05:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },

  // Tuesday, June 16
  { stage: "I", homeTeam: "France", awayTeam: "Senegal", kickoffUtc: "2026-06-16T20:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "I", homeTeam: "Iraq", awayTeam: "Norway", kickoffUtc: "2026-06-16T23:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "J", homeTeam: "Argentina", awayTeam: "Algeria", kickoffUtc: "2026-06-17T03:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "J", homeTeam: "Austria", awayTeam: "Jordan", kickoffUtc: "2026-06-17T08:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Wednesday, June 17
  { stage: "K", homeTeam: "Portugal", awayTeam: "DR Congo", kickoffUtc: "2026-06-17T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "L", homeTeam: "England", awayTeam: "Croatia", kickoffUtc: "2026-06-17T22:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "L", homeTeam: "Ghana", awayTeam: "Panama", kickoffUtc: "2026-06-18T00:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "K", homeTeam: "Uzbekistan", awayTeam: "Colombia", kickoffUtc: "2026-06-18T04:00:00Z", venue: "Mexico City Stadium, Mexico City" },

  // Thursday, June 18
  { stage: "A", homeTeam: "Czechia", awayTeam: "South Africa", kickoffUtc: "2026-06-18T17:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "B", homeTeam: "Switzerland", awayTeam: "Bosnia and Herzegovina", kickoffUtc: "2026-06-18T23:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "B", homeTeam: "Canada", awayTeam: "Qatar", kickoffUtc: "2026-06-19T02:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "A", homeTeam: "Mexico", awayTeam: "South Korea", kickoffUtc: "2026-06-19T03:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Friday, June 19
  { stage: "D", homeTeam: "United States", awayTeam: "Australia", kickoffUtc: "2026-06-19T23:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "C", homeTeam: "Scotland", awayTeam: "Morocco", kickoffUtc: "2026-06-19T23:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "C", homeTeam: "Brazil", awayTeam: "Haiti", kickoffUtc: "2026-06-20T02:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "D", homeTeam: "Türkiye", awayTeam: "Paraguay", kickoffUtc: "2026-06-20T08:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Saturday, June 20
  { stage: "F", homeTeam: "Netherlands", awayTeam: "Sweden", kickoffUtc: "2026-06-20T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "E", homeTeam: "Germany", awayTeam: "Cote d'Ivoire", kickoffUtc: "2026-06-20T21:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "E", homeTeam: "Ecuador", awayTeam: "Curacao", kickoffUtc: "2026-06-21T04:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "F", homeTeam: "Tunisia", awayTeam: "Japan", kickoffUtc: "2026-06-21T06:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Sunday, June 21
  { stage: "H", homeTeam: "Spain", awayTeam: "Saudi Arabia", kickoffUtc: "2026-06-21T17:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "G", homeTeam: "Belgium", awayTeam: "Iran", kickoffUtc: "2026-06-21T23:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "H", homeTeam: "Uruguay", awayTeam: "Cabo Verde", kickoffUtc: "2026-06-21T23:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "G", homeTeam: "New Zealand", awayTeam: "Egypt", kickoffUtc: "2026-06-22T05:00:00Z", venue: "BC Place, Vancouver" },

  // Monday, June 22
  { stage: "J", homeTeam: "Argentina", awayTeam: "Austria", kickoffUtc: "2026-06-22T19:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "I", homeTeam: "France", awayTeam: "Iraq", kickoffUtc: "2026-06-22T22:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "I", homeTeam: "Norway", awayTeam: "Senegal", kickoffUtc: "2026-06-23T01:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "J", homeTeam: "Jordan", awayTeam: "Algeria", kickoffUtc: "2026-06-23T07:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Tuesday, June 23
  { stage: "K", homeTeam: "Portugal", awayTeam: "Uzbekistan", kickoffUtc: "2026-06-23T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "L", homeTeam: "England", awayTeam: "Ghana", kickoffUtc: "2026-06-23T21:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "L", homeTeam: "Panama", awayTeam: "Croatia", kickoffUtc: "2026-06-24T00:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "K", homeTeam: "Colombia", awayTeam: "DR Congo", kickoffUtc: "2026-06-24T04:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Wednesday, June 24
  { stage: "B", homeTeam: "Switzerland", awayTeam: "Canada", kickoffUtc: "2026-06-24T23:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "B", homeTeam: "Bosnia and Herzegovina", awayTeam: "Qatar", kickoffUtc: "2026-06-24T23:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "C", homeTeam: "Scotland", awayTeam: "Brazil", kickoffUtc: "2026-06-24T23:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "C", homeTeam: "Morocco", awayTeam: "Haiti", kickoffUtc: "2026-06-24T23:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "A", homeTeam: "Czechia", awayTeam: "Mexico", kickoffUtc: "2026-06-25T03:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "A", homeTeam: "South Africa", awayTeam: "South Korea", kickoffUtc: "2026-06-25T03:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Thursday, June 25
  { stage: "E", homeTeam: "Ecuador", awayTeam: "Germany", kickoffUtc: "2026-06-25T21:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "E", homeTeam: "Curacao", awayTeam: "Cote d'Ivoire", kickoffUtc: "2026-06-25T21:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "F", homeTeam: "Japan", awayTeam: "Sweden", kickoffUtc: "2026-06-26T01:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "F", homeTeam: "Tunisia", awayTeam: "Netherlands", kickoffUtc: "2026-06-26T01:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "D", homeTeam: "Türkiye", awayTeam: "United States", kickoffUtc: "2026-06-26T06:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "D", homeTeam: "Paraguay", awayTeam: "Australia", kickoffUtc: "2026-06-26T06:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Friday, June 26
  { stage: "I", homeTeam: "Norway", awayTeam: "France", kickoffUtc: "2026-06-26T20:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "I", homeTeam: "Senegal", awayTeam: "Iraq", kickoffUtc: "2026-06-26T20:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "H", homeTeam: "Cabo Verde", awayTeam: "Saudi Arabia", kickoffUtc: "2026-06-27T02:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "H", homeTeam: "Uruguay", awayTeam: "Spain", kickoffUtc: "2026-06-27T02:00:00Z", venue: "Estadio Guadalajara, Zapopan" },
  { stage: "G", homeTeam: "Egypt", awayTeam: "Iran", kickoffUtc: "2026-06-27T07:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "G", homeTeam: "New Zealand", awayTeam: "Belgium", kickoffUtc: "2026-06-27T07:00:00Z", venue: "BC Place, Vancouver" },

  // Saturday, June 27
  { stage: "L", homeTeam: "Panama", awayTeam: "England", kickoffUtc: "2026-06-27T22:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "L", homeTeam: "Croatia", awayTeam: "Ghana", kickoffUtc: "2026-06-27T22:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "K", homeTeam: "Colombia", awayTeam: "Portugal", kickoffUtc: "2026-06-28T02:30:00Z", venue: "Miami Stadium, Miami" },
  { stage: "K", homeTeam: "DR Congo", awayTeam: "Uzbekistan", kickoffUtc: "2026-06-28T02:30:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "J", homeTeam: "Algeria", awayTeam: "Austria", kickoffUtc: "2026-06-28T04:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "J", homeTeam: "Jordan", awayTeam: "Argentina", kickoffUtc: "2026-06-28T04:00:00Z", venue: "Dallas Stadium, Dallas" },
];

// Knockout round TIME SLOTS only. Real team pairings are entered by the organizer via
// /admin as results come in, so teams are null here. These give the knockout lock and
// "next match" logic something to anchor to. Each entry is one match slot in that round.
export const KNOCKOUT_SCHEDULE: ScheduleMatch[] = [
  // Round of 32: June 28 - July 3 (16 matches)
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-28T23:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-29T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-29T22:30:00Z", venue: "Boston Stadium, Boston" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T03:00:00Z", venue: "Estadio Monterrey, Guadalupe" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T19:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T22:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-01T03:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-01T17:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T00:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T04:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T23:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T00:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T07:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T21:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T23:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T03:30:00Z", venue: "Kansas City Stadium, Kansas City" },

  // Round of 16: July 4 - 7 (8 matches)
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T19:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T22:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-05T21:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-06T02:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-06T21:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-07T04:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-07T17:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-08T00:00:00Z", venue: "BC Place, Vancouver" },

  // Quarterfinals: July 9 - 11 (4 matches)
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-09T21:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-10T23:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-11T22:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-12T03:00:00Z", venue: "Kansas City Stadium, Kansas City" },

  // Semifinals: July 14 - 15 (2 matches)
  { stage: "SF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-14T21:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "SF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-15T20:00:00Z", venue: "Atlanta Stadium, Atlanta" },

  // Bronze medal match: July 18
  { stage: "BRONZE", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-18T22:00:00Z", venue: "Miami Stadium, Miami" },

  // Final: July 19
  { stage: "FINAL", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-19T20:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
];
