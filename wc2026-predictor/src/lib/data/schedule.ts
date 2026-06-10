// World Cup 2026 match schedule.
//
// Source: full schedule published by Al Jazeera (6 Dec 2025) after the group draw,
// with GMT kickoff times and venues. The published version used "TBD" for the six
// playoff-winner slots; those are resolved here to the now-known teams, since each
// TBD was the only unlisted team in its group for that fixture:
//   Group A 4th = Czechia, Group B 4th = Bosnia and Herzegovina, Group D 4th = Türkiye,
//   Group F 4th = Sweden, Group I = Iraq, Group K = DR Congo.
//
// TIMES: stored as ISO 8601 UTC strings. The source labelled its kickoff times
// "GMT" but they were actually 2 hours ahead of true UTC (the published times were
// UTC+2), so every time here has been corrected by -2 hours to be real UTC. The UI
// formats these for Iceland, which is UTC year-round, so they display as local
// Iceland time. Reseed (npx prisma db seed) after changing any time so the DB
// kickoffAt values update.
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
  { stage: "A", homeTeam: "Mexico", awayTeam: "South Africa", kickoffUtc: "2026-06-11T19:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "A", homeTeam: "South Korea", awayTeam: "Czechia", kickoffUtc: "2026-06-12T02:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Friday, June 12
  { stage: "B", homeTeam: "Canada", awayTeam: "Bosnia and Herzegovina", kickoffUtc: "2026-06-12T19:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "D", homeTeam: "United States", awayTeam: "Paraguay", kickoffUtc: "2026-06-13T01:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },

  // Saturday, June 13
  { stage: "B", homeTeam: "Qatar", awayTeam: "Switzerland", kickoffUtc: "2026-06-13T19:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },
  { stage: "C", homeTeam: "Brazil", awayTeam: "Morocco", kickoffUtc: "2026-06-13T22:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "C", homeTeam: "Haiti", awayTeam: "Scotland", kickoffUtc: "2026-06-14T01:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "D", homeTeam: "Australia", awayTeam: "Turkey", kickoffUtc: "2026-06-14T04:00:00Z", venue: "BC Place, Vancouver" },

  // Sunday, June 14
  { stage: "E", homeTeam: "Germany", awayTeam: "Curacao", kickoffUtc: "2026-06-14T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "F", homeTeam: "Netherlands", awayTeam: "Japan", kickoffUtc: "2026-06-14T20:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "E", homeTeam: "Cote d'Ivoire", awayTeam: "Ecuador", kickoffUtc: "2026-06-14T23:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "F", homeTeam: "Sweden", awayTeam: "Tunisia", kickoffUtc: "2026-06-15T02:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Monday, June 15
  { stage: "H", homeTeam: "Spain", awayTeam: "Cabo Verde", kickoffUtc: "2026-06-15T16:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "G", homeTeam: "Belgium", awayTeam: "Egypt", kickoffUtc: "2026-06-15T19:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "H", homeTeam: "Saudi Arabia", awayTeam: "Uruguay", kickoffUtc: "2026-06-15T22:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "G", homeTeam: "Iran", awayTeam: "New Zealand", kickoffUtc: "2026-06-16T01:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },

  // Tuesday, June 16
  { stage: "I", homeTeam: "France", awayTeam: "Senegal", kickoffUtc: "2026-06-16T19:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "I", homeTeam: "Iraq", awayTeam: "Norway", kickoffUtc: "2026-06-16T22:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "J", homeTeam: "Argentina", awayTeam: "Algeria", kickoffUtc: "2026-06-17T01:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "J", homeTeam: "Austria", awayTeam: "Jordan", kickoffUtc: "2026-06-17T04:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Wednesday, June 17
  { stage: "K", homeTeam: "Portugal", awayTeam: "DR Congo", kickoffUtc: "2026-06-17T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "L", homeTeam: "England", awayTeam: "Croatia", kickoffUtc: "2026-06-17T20:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "L", homeTeam: "Ghana", awayTeam: "Panama", kickoffUtc: "2026-06-17T23:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "K", homeTeam: "Uzbekistan", awayTeam: "Colombia", kickoffUtc: "2026-06-18T02:00:00Z", venue: "Mexico City Stadium, Mexico City" },

  // Thursday, June 18
  { stage: "A", homeTeam: "Czechia", awayTeam: "South Africa", kickoffUtc: "2026-06-18T16:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "B", homeTeam: "Switzerland", awayTeam: "Bosnia and Herzegovina", kickoffUtc: "2026-06-18T19:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "B", homeTeam: "Canada", awayTeam: "Qatar", kickoffUtc: "2026-06-18T22:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "A", homeTeam: "Mexico", awayTeam: "South Korea", kickoffUtc: "2026-06-19T01:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Friday, June 19
  { stage: "D", homeTeam: "United States", awayTeam: "Australia", kickoffUtc: "2026-06-19T19:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "C", homeTeam: "Scotland", awayTeam: "Morocco", kickoffUtc: "2026-06-19T22:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "C", homeTeam: "Brazil", awayTeam: "Haiti", kickoffUtc: "2026-06-20T00:30:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "D", homeTeam: "Turkey", awayTeam: "Paraguay", kickoffUtc: "2026-06-20T03:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Saturday, June 20
  { stage: "F", homeTeam: "Netherlands", awayTeam: "Sweden", kickoffUtc: "2026-06-20T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "E", homeTeam: "Germany", awayTeam: "Cote d'Ivoire", kickoffUtc: "2026-06-20T20:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "E", homeTeam: "Ecuador", awayTeam: "Curacao", kickoffUtc: "2026-06-21T00:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "F", homeTeam: "Tunisia", awayTeam: "Japan", kickoffUtc: "2026-06-21T04:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Sunday, June 21
  { stage: "H", homeTeam: "Spain", awayTeam: "Saudi Arabia", kickoffUtc: "2026-06-21T16:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "G", homeTeam: "Belgium", awayTeam: "Iran", kickoffUtc: "2026-06-21T19:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "H", homeTeam: "Uruguay", awayTeam: "Cabo Verde", kickoffUtc: "2026-06-21T22:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "G", homeTeam: "New Zealand", awayTeam: "Egypt", kickoffUtc: "2026-06-22T01:00:00Z", venue: "BC Place, Vancouver" },

  // Monday, June 22
  { stage: "J", homeTeam: "Argentina", awayTeam: "Austria", kickoffUtc: "2026-06-22T17:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "I", homeTeam: "France", awayTeam: "Iraq", kickoffUtc: "2026-06-22T21:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "I", homeTeam: "Norway", awayTeam: "Senegal", kickoffUtc: "2026-06-23T00:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "J", homeTeam: "Jordan", awayTeam: "Algeria", kickoffUtc: "2026-06-23T03:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Tuesday, June 23
  { stage: "K", homeTeam: "Portugal", awayTeam: "Uzbekistan", kickoffUtc: "2026-06-23T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "L", homeTeam: "England", awayTeam: "Ghana", kickoffUtc: "2026-06-23T20:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "L", homeTeam: "Panama", awayTeam: "Croatia", kickoffUtc: "2026-06-23T23:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "K", homeTeam: "Colombia", awayTeam: "DR Congo", kickoffUtc: "2026-06-24T02:00:00Z", venue: "Estadio Guadalajara, Zapopan" },

  // Wednesday, June 24
  { stage: "B", homeTeam: "Switzerland", awayTeam: "Canada", kickoffUtc: "2026-06-24T19:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "B", homeTeam: "Bosnia and Herzegovina", awayTeam: "Qatar", kickoffUtc: "2026-06-24T19:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "C", homeTeam: "Scotland", awayTeam: "Brazil", kickoffUtc: "2026-06-24T22:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "C", homeTeam: "Morocco", awayTeam: "Haiti", kickoffUtc: "2026-06-24T22:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "A", homeTeam: "Czechia", awayTeam: "Mexico", kickoffUtc: "2026-06-25T01:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "A", homeTeam: "South Africa", awayTeam: "South Korea", kickoffUtc: "2026-06-25T01:00:00Z", venue: "Estadio Monterrey, Guadalupe" },

  // Thursday, June 25
  { stage: "E", homeTeam: "Ecuador", awayTeam: "Germany", kickoffUtc: "2026-06-25T20:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "E", homeTeam: "Curacao", awayTeam: "Cote d'Ivoire", kickoffUtc: "2026-06-25T20:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "F", homeTeam: "Japan", awayTeam: "Sweden", kickoffUtc: "2026-06-25T23:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "F", homeTeam: "Tunisia", awayTeam: "Netherlands", kickoffUtc: "2026-06-25T23:00:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "D", homeTeam: "Turkey", awayTeam: "United States", kickoffUtc: "2026-06-26T02:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "D", homeTeam: "Paraguay", awayTeam: "Australia", kickoffUtc: "2026-06-26T02:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },

  // Friday, June 26
  { stage: "I", homeTeam: "Norway", awayTeam: "France", kickoffUtc: "2026-06-26T19:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "I", homeTeam: "Senegal", awayTeam: "Iraq", kickoffUtc: "2026-06-26T19:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "H", homeTeam: "Cabo Verde", awayTeam: "Saudi Arabia", kickoffUtc: "2026-06-27T00:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "H", homeTeam: "Uruguay", awayTeam: "Spain", kickoffUtc: "2026-06-27T00:00:00Z", venue: "Estadio Guadalajara, Zapopan" },
  { stage: "G", homeTeam: "Egypt", awayTeam: "Iran", kickoffUtc: "2026-06-27T03:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "G", homeTeam: "New Zealand", awayTeam: "Belgium", kickoffUtc: "2026-06-27T03:00:00Z", venue: "BC Place, Vancouver" },

  // Saturday, June 27
  { stage: "L", homeTeam: "Panama", awayTeam: "England", kickoffUtc: "2026-06-27T21:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "L", homeTeam: "Croatia", awayTeam: "Ghana", kickoffUtc: "2026-06-27T21:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "K", homeTeam: "Colombia", awayTeam: "Portugal", kickoffUtc: "2026-06-27T23:30:00Z", venue: "Miami Stadium, Miami" },
  { stage: "K", homeTeam: "DR Congo", awayTeam: "Uzbekistan", kickoffUtc: "2026-06-27T23:30:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "J", homeTeam: "Algeria", awayTeam: "Austria", kickoffUtc: "2026-06-28T02:02:00Z", venue: "Kansas City Stadium, Kansas City" },
  { stage: "J", homeTeam: "Jordan", awayTeam: "Argentina", kickoffUtc: "2026-06-28T02:02:00Z", venue: "Dallas Stadium, Dallas" },
];

// Knockout round TIME SLOTS only. Real team pairings are entered by the organizer via
// /admin as results come in, so teams are null here. These give the knockout lock and
// "next match" logic something to anchor to. Each entry is one match slot in that round.
export const KNOCKOUT_SCHEDULE: ScheduleMatch[] = [
  // Round of 32: June 28 - July 3 (16 matches)
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-28T19:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-29T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-29T20:30:00Z", venue: "Boston Stadium, Boston" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T01:00:00Z", venue: "Estadio Monterrey, Guadalupe" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T17:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-06-30T21:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-01T01:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-01T16:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-01T20:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T00:00:00Z", venue: "San Francisco Bay Area Stadium, San Francisco" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T19:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-02T23:00:00Z", venue: "Toronto Stadium, Toronto" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T03:00:00Z", venue: "BC Place, Vancouver" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T18:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-03T22:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "R32", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T01:30:00Z", venue: "Kansas City Stadium, Kansas City" },

  // Round of 16: July 4 - 7 (8 matches)
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T17:00:00Z", venue: "Houston Stadium, Houston" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-04T21:00:00Z", venue: "Philadelphia Stadium, Philadelphia" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-05T20:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-06T00:00:00Z", venue: "Mexico City Stadium, Mexico City" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-06T19:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-07T00:00:00Z", venue: "Seattle Stadium, Seattle" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-07T16:00:00Z", venue: "Atlanta Stadium, Atlanta" },
  { stage: "R16", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-07T20:00:00Z", venue: "BC Place, Vancouver" },

  // Quarterfinals: July 9 - 11 (4 matches)
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-09T20:00:00Z", venue: "Boston Stadium, Boston" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-10T19:00:00Z", venue: "Los Angeles Stadium, Los Angeles" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-11T21:00:00Z", venue: "Miami Stadium, Miami" },
  { stage: "QF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-12T01:00:00Z", venue: "Kansas City Stadium, Kansas City" },

  // Semifinals: July 14 - 15 (2 matches)
  { stage: "SF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-14T19:00:00Z", venue: "Dallas Stadium, Dallas" },
  { stage: "SF", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-15T19:00:00Z", venue: "Atlanta Stadium, Atlanta" },

  // Bronze medal match: July 18
  { stage: "BRONZE", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-18T21:00:00Z", venue: "Miami Stadium, Miami" },

  // Final: July 19
  { stage: "FINAL", homeTeam: null, awayTeam: null, kickoffUtc: "2026-07-19T19:00:00Z", venue: "New York New Jersey Stadium, New Jersey" },
];
