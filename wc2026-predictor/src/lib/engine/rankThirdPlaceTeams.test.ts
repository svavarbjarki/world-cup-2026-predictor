import { describe, it, expect } from "vitest";
import {
  rankThirdPlaceTeams,
  type GroupTablesByLetter,
} from "./rankThirdPlaceTeams";
import { computeGroupTable } from "./computeGroupTable";
import type { GroupLetter, GroupMatch, GroupStanding } from "./types";

/** Build a GroupStanding fixture; only the ranking fields really matter here. */
function standing(
  teamId: string,
  points: number,
  goalDifference: number,
  goalsFor: number,
): GroupStanding {
  return {
    teamId,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor,
    goalsAgainst: goalsFor - goalDifference,
    goalDifference,
    points,
  };
}

/**
 * Wrap a third-placed standing in a plausible 4-row table. Only index 2 is read
 * by rankThirdPlaceTeams, so the other three rows are throwaway placeholders.
 */
function tableAround(third: GroupStanding): GroupStanding[] {
  const placeholder = (suffix: string) =>
    standing(`${third.teamId}-${suffix}`, 0, 0, 0);
  return [placeholder("1st"), placeholder("2nd"), third, placeholder("4th")];
}

/** Turn a map of group -> third-placed standing into full group tables. */
function tablesFromThirds(
  thirds: Map<GroupLetter, GroupStanding>,
): GroupTablesByLetter {
  const tables: GroupTablesByLetter = new Map();
  for (const [group, third] of thirds) {
    tables.set(group, tableAround(third));
  }
  return tables;
}

/** A clearly-ordered field of 12 thirds, A (best) down to L (worst). */
function orderedField(): Map<GroupLetter, GroupStanding> {
  return new Map<GroupLetter, GroupStanding>([
    ["A", standing("t-A", 6, 4, 6)],
    ["B", standing("t-B", 6, 3, 5)],
    ["C", standing("t-C", 5, 2, 4)],
    ["D", standing("t-D", 5, 1, 4)],
    ["E", standing("t-E", 4, 3, 5)],
    ["F", standing("t-F", 4, 2, 4)],
    ["G", standing("t-G", 4, 1, 3)],
    ["H", standing("t-H", 3, 2, 4)],
    ["I", standing("t-I", 3, 1, 3)],
    ["J", standing("t-J", 2, 0, 2)],
    ["K", standing("t-K", 1, -2, 1)],
    ["L", standing("t-L", 0, -5, 0)],
  ]);
}

describe("rankThirdPlaceTeams", () => {
  it("qualifies the best 8 of 12 third-place teams in a clearly ordered field", () => {
    const ranked = rankThirdPlaceTeams(tablesFromThirds(orderedField()));

    expect(ranked).toHaveLength(12);
    expect(ranked.map((e) => e.rank)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);

    const qualified = ranked.filter((e) => e.qualified).map((e) => e.group);
    const out = ranked.filter((e) => !e.qualified).map((e) => e.group);

    expect(qualified).toEqual(["A", "B", "C", "D", "E", "F", "G", "H"]);
    expect(out).toEqual(["I", "J", "K", "L"]);
  });

  it("tags every entry with its group of origin", () => {
    const ranked = rankThirdPlaceTeams(tablesFromThirds(orderedField()));

    // In this fixture team ids are "t-<group>", so each entry's standing must
    // line up with the group letter it is reported under.
    for (const entry of ranked) {
      expect(entry.standing.teamId).toBe(`t-${entry.group}`);
    }
  });

  it("separates the 8th and 9th teams by goals scored when level on points and goal difference", () => {
    const thirds = new Map<GroupLetter, GroupStanding>([
      ["A", standing("t-A", 7, 5, 7)],
      ["B", standing("t-B", 7, 4, 6)],
      ["C", standing("t-C", 6, 3, 5)],
      ["D", standing("t-D", 6, 2, 4)],
      ["E", standing("t-E", 5, 3, 5)],
      ["F", standing("t-F", 5, 1, 3)],
      ["G", standing("t-G", 4, 2, 4)],
      // The decisive pair: equal points (3) and goal difference (0).
      ["H", standing("t-H", 3, 0, 4)], // more goals scored -> 8th, qualifies
      ["I", standing("t-I", 3, 0, 2)], // fewer goals scored -> 9th, out
      ["J", standing("t-J", 2, -1, 2)],
      ["K", standing("t-K", 1, -3, 1)],
      ["L", standing("t-L", 0, -6, 0)],
    ]);

    const ranked = rankThirdPlaceTeams(tablesFromThirds(thirds));
    const h = ranked.find((e) => e.group === "H")!;
    const i = ranked.find((e) => e.group === "I")!;

    expect(h.standing.points).toBe(i.standing.points);
    expect(h.standing.goalDifference).toBe(i.standing.goalDifference);
    expect(h.standing.goalsFor).toBeGreaterThan(i.standing.goalsFor);

    expect(h.rank).toBe(8);
    expect(h.qualified).toBe(true);
    expect(i.rank).toBe(9);
    expect(i.qualified).toBe(false);
  });

  it("breaks an exact tie deterministically by team id, regardless of insertion order", () => {
    // Two teams identical on points, goal difference and goals scored sit on the
    // 8th/9th boundary. The alphabetically earlier team id must qualify.
    const tiedEarly = standing("t-aaa", 3, 0, 3);
    const tiedLate = standing("t-zzz", 3, 0, 3);

    const thirds = new Map<GroupLetter, GroupStanding>([
      ["A", standing("t-A", 9, 6, 8)],
      ["B", standing("t-B", 8, 5, 7)],
      ["C", standing("t-C", 7, 4, 6)],
      ["D", standing("t-D", 6, 3, 5)],
      ["E", standing("t-E", 5, 2, 4)],
      ["F", standing("t-F", 4, 1, 3)],
      ["G", standing("t-G", 4, 0, 2)],
      // Insert the alphabetically LAST id first to prove the tie-break is by
      // team id, not insertion order or group letter.
      ["H", tiedLate],
      ["I", tiedEarly],
      ["J", standing("t-J", 2, -2, 1)],
      ["K", standing("t-K", 1, -4, 0)],
      ["L", standing("t-L", 0, -6, 0)],
    ]);

    const ranked = rankThirdPlaceTeams(tablesFromThirds(thirds));
    const early = ranked.find((e) => e.standing.teamId === "t-aaa")!;
    const late = ranked.find((e) => e.standing.teamId === "t-zzz")!;

    expect(early.rank).toBe(8);
    expect(early.qualified).toBe(true);
    expect(late.rank).toBe(9);
    expect(late.qualified).toBe(false);

    // Stable: the same input always produces an identical result.
    const again = rankThirdPlaceTeams(tablesFromThirds(thirds));
    expect(again).toEqual(ranked);
  });

  it("works end to end from real matches through computeGroupTable", () => {
    // A real group whose ranked table is a1 > a2 > a3 > a4, so a3 is third.
    const realMatches: GroupMatch[] = [
      { homeTeamId: "a1", awayTeamId: "a2", homeGoals: 2, awayGoals: 0 },
      { homeTeamId: "a1", awayTeamId: "a3", homeGoals: 2, awayGoals: 0 },
      { homeTeamId: "a1", awayTeamId: "a4", homeGoals: 2, awayGoals: 0 },
      { homeTeamId: "a2", awayTeamId: "a3", homeGoals: 1, awayGoals: 0 },
      { homeTeamId: "a2", awayTeamId: "a4", homeGoals: 1, awayGoals: 0 },
      { homeTeamId: "a3", awayTeamId: "a4", homeGoals: 1, awayGoals: 0 },
    ];
    const realTableA = computeGroupTable(realMatches);
    expect(realTableA[2].teamId).toBe("a3"); // sanity: a3 really is third

    // Fill the other 11 groups with clearly weaker thirds so a3 qualifies.
    const weakThirds = new Map<GroupLetter, GroupStanding>();
    for (const g of ["B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"] as GroupLetter[]) {
      weakThirds.set(g, standing(`t-${g}`, 0, 0, 0));
    }
    const tables = tablesFromThirds(weakThirds);
    tables.set("A", realTableA);

    const ranked = rankThirdPlaceTeams(tables);
    const a = ranked.find((e) => e.group === "A")!;

    expect(a.standing.teamId).toBe("a3");
    expect(a.qualified).toBe(true);
    expect(ranked).toHaveLength(12);
  });
});
