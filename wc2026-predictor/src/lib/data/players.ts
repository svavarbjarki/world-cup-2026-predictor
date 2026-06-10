// World Cup 2026 award-contender players (starter set).
//
// PURPOSE: a verifiable starter pool of well-known contenders for the individual
// award predictions (Golden Ball, Golden Boot, Golden Glove, Young Player). This is
// NOT a full squad list (~1,250 players). It is the names people would realistically
// pick. Designed to be extended: add rows here and re-seed.
//
// Sources: cross-referenced from multiple June 2026 World Cup award previews and odds
// pages (Goal, SI, Yahoo, ESPN, Al Jazeera, FOX, William Hill and others). Team
// assignments match the confirmed 2026 groups. Positions and ages are from general
// football knowledge as of mid-2026 and should be spot-checked before the tournament,
// since squad roles and exact ages can shift.
//
// FIELDS
//   name      display name (use accented forms to match real spelling)
//   team      MUST match a team `name` in teams.ts exactly
//   position  "GK" | "DF" | "MF" | "FW"
//   age       approximate age during the tournament (June-July 2026)
//
// ELIGIBILITY (derived, do not hand-maintain a separate flag):
//   Golden Glove  -> position === "GK"
//   Young Player  -> born on/after 1 Jan 2005, i.e. age <= 21 during the tournament.
//                    Use a birthYear where known for a precise check; for this starter
//                    set, age <= 21 is the practical filter. The seed/app should
//                    compute eligibility, not trust a static flag.
//
// NOTE ON YOUNG PLAYER: the precise FIFA rule is "born on or after 1 January 2005".
// Where a player's exact birth date matters (a player who turns 22 mid-tournament but
// was born after the cutoff, or vice versa), verify the birth date. The `age` here is
// a convenience; birthYear is included where it is well established.

export type AwardPlayer = {
  name: string;
  team: string;
  position: "GK" | "DF" | "MF" | "FW";
  age: number;
  birthYear?: number;
};

export const PLAYERS: AwardPlayer[] = [
  // ---- Goalkeepers (Golden Glove pool) ----
  { name: "Emiliano Martínez", team: "Argentina", position: "GK", age: 33, birthYear: 1992 },
  { name: "Geronimo Rulli", team: "Argentina", position: "GK", age: 34, birthYear: 1992 },
  { name: "Alisson Becker", team: "Brazil", position: "GK", age: 33, birthYear: 1992 },
  { name: "Ederson", team: "Brazil", position: "GK", age: 32, birthYear: 1993 },
  { name: "Thibaut Courtois", team: "Belgium", position: "GK", age: 34, birthYear: 1992 },
  { name: "Mike Maignan", team: "France", position: "GK", age: 30, birthYear: 1995 },
  { name: "Brice Samba", team: "France", position: "GK", age: 31, birthYear: 1994 },
  { name: "Unai Simón", team: "Spain", position: "GK", age: 29, birthYear: 1997 },
  { name: "Jordan Pickford", team: "England", position: "GK", age: 32, birthYear: 1994 },
  { name: "Dean Henderson", team: "England", position: "GK", age: 29, birthYear: 1997 },
  { name: "Bart Verbruggen", team: "Netherlands", position: "GK", age: 23, birthYear: 2002 },
  { name: "Yann Sommer", team: "Switzerland", position: "GK", age: 37, birthYear: 1988 },
  { name: "Gregor Kobel", team: "Switzerland", position: "GK", age: 28, birthYear: 1997 },
  { name: "Diogo Costa", team: "Portugal", position: "GK", age: 26, birthYear: 2000 },
  { name: "Marc-André ter Stegen", team: "Germany", position: "GK", age: 34, birthYear: 1992 },
  { name: "André Onana", team: "Cameroon", position: "GK", age: 30, birthYear: 1996 },
  { name: "Yassine Bounou", team: "Morocco", position: "GK", age: 35, birthYear: 1991 },
  { name: "Edouard Mendy", team: "Senegal", position: "GK", age: 34, birthYear: 1992 },
  { name: "Dominik Livaković", team: "Croatia", position: "GK", age: 31, birthYear: 1995 },
  { name: "Wojciech Szczęsny", team: "Poland", position: "GK", age: 36, birthYear: 1990 },
  { name: "Guillermo Ochoa", team: "Mexico", position: "GK", age: 40, birthYear: 1986 },
  { name: "Matt Turner", team: "United States", position: "GK", age: 32, birthYear: 1994 },
  { name: "Maxime Crépeau", team: "Canada", position: "GK", age: 32, birthYear: 1994 },
  { name: "Mathew Ryan", team: "Australia", position: "GK", age: 34, birthYear: 1992 },
  { name: "Alireza Beiranvand", team: "Iran", position: "GK", age: 34, birthYear: 1992 },
  { name: "Mohammed Al-Owais", team: "Saudi Arabia", position: "GK", age: 34, birthYear: 1992 },
  { name: "Zion Suzuki", team: "Japan", position: "GK", age: 23, birthYear: 2002 },
  { name: "Kim Seung-gyu", team: "South Korea", position: "GK", age: 35, birthYear: 1991 },
  { name: "Ronwen Williams", team: "South Africa", position: "GK", age: 34, birthYear: 1992 },
  { name: "Eloy Room", team: "Curacao", position: "GK", age: 37, birthYear: 1989 },

  // ---- Forwards (Golden Boot / Golden Ball) ----
  { name: "Kylian Mbappé", team: "France", position: "FW", age: 27, birthYear: 1998 },
  { name: "Harry Kane", team: "England", position: "FW", age: 32, birthYear: 1993 },
  { name: "Erling Haaland", team: "Norway", position: "FW", age: 25, birthYear: 2000 },
  { name: "Lionel Messi", team: "Argentina", position: "FW", age: 38, birthYear: 1987 },
  { name: "Lautaro Martínez", team: "Argentina", position: "FW", age: 28, birthYear: 1997 },
  { name: "Vinícius Júnior", team: "Brazil", position: "FW", age: 25, birthYear: 2000 },
  { name: "Ousmane Dembélé", team: "France", position: "FW", age: 29, birthYear: 1997 },
  { name: "Folarin Balogun", team: "United States", position: "FW", age: 24, birthYear: 2001 },
  { name: "Mikel Oyarzabal", team: "Spain", position: "FW", age: 29, birthYear: 1997 },
  { name: "Cristiano Ronaldo", team: "Portugal", position: "FW", age: 41, birthYear: 1985 },
  { name: "Romelu Lukaku", team: "Belgium", position: "FW", age: 33, birthYear: 1993 },
  { name: "Memphis Depay", team: "Netherlands", position: "FW", age: 32, birthYear: 1994 },
  { name: "Julián Álvarez", team: "Argentina", position: "FW", age: 26, birthYear: 1999 },

  // ---- Midfielders / attacking mids (Golden Ball) ----
  { name: "Jude Bellingham", team: "England", position: "MF", age: 22, birthYear: 2003 },
  { name: "Pedri", team: "Spain", position: "MF", age: 23, birthYear: 2002 },
  { name: "Florian Wirtz", team: "Germany", position: "MF", age: 23, birthYear: 2003 },
  { name: "Jamal Musiala", team: "Germany", position: "MF", age: 23, birthYear: 2003 },
  { name: "Michael Olise", team: "France", position: "MF", age: 24, birthYear: 2001 },
  { name: "Bruno Fernandes", team: "Portugal", position: "MF", age: 31, birthYear: 1994 },
  { name: "Kevin De Bruyne", team: "Belgium", position: "MF", age: 34, birthYear: 1991 },
  { name: "Rodri", team: "Spain", position: "MF", age: 29, birthYear: 1996 },

  // ---- Young Player contenders (born on/after 1 Jan 2005) ----
  { name: "Lamine Yamal", team: "Spain", position: "FW", age: 18, birthYear: 2007 },
  { name: "Endrick", team: "Brazil", position: "FW", age: 19, birthYear: 2006 },
  { name: "Désiré Doué", team: "France", position: "FW", age: 20, birthYear: 2005 },
  { name: "Warren Zaïre-Emery", team: "France", position: "MF", age: 20, birthYear: 2006 },
  { name: "Pau Cubarsí", team: "Spain", position: "DF", age: 19, birthYear: 2007 },
  { name: "Arda Güler", team: "Türkiye", position: "MF", age: 21, birthYear: 2005 },
  { name: "Kenan Yıldız", team: "Türkiye", position: "FW", age: 21, birthYear: 2005 },
  { name: "Antonio Nusa", team: "Norway", position: "FW", age: 21, birthYear: 2005 },
  { name: "Yan Diomande", team: "Côte d'Ivoire", position: "FW", age: 20, birthYear: 2005 },
  { name: "Lucas Bergvall", team: "Sweden", position: "MF", age: 20, birthYear: 2006 },
  { name: "Kobbie Mainoo", team: "England", position: "MF", age: 21, birthYear: 2005 },
  { name: "Lennart Karl", team: "Germany", position: "MF", age: 18, birthYear: 2007 },
];
