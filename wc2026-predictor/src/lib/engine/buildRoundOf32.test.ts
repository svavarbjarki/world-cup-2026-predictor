import { describe, it, expect } from "vitest";
import { buildRoundOf32 } from "./buildRoundOf32";
import { ANNEX_C } from "./annexC";
import type { ThirdPlaceEntry } from "./rankThirdPlaceTeams";
import type { GroupLetter, GroupStanding } from "./types";

const ALL_GROUPS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];

/** Winners keyed by group, with predictable ids like "W-A". */
function fullWinners(): Map<GroupLetter, string> {
  return new Map(ALL_GROUPS.map((g) => [g, `W-${g}`]));
}

/** Runners-up keyed by group, with predictable ids like "RU-A". */
function fullRunnersUp(): Map<GroupLetter, string> {
  return new Map(ALL_GROUPS.map((g) => [g, `RU-${g}`]));
}

/** A minimal standing whose only meaningful field here is the team id. */
function standing(teamId: string): GroupStanding {
  return {
    teamId,
    played: 3,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDifference: 0,
    points: 0,
  };
}

/** Build qualifying third-place entries for the given groups (ids like "3-A"). */
function makeThirds(groups: GroupLetter[]): ThirdPlaceEntry[] {
  return groups.map((group, index) => ({
    group,
    standing: standing(`3-${group}`),
    rank: index + 1,
    qualified: true,
  }));
}

describe("buildRoundOf32", () => {
  it("produces the official 16 matchups for the baseline combination ABCDEFGH", () => {
    const matches = buildRoundOf32(
      fullWinners(),
      fullRunnersUp(),
      makeThirds(["A", "B", "C", "D", "E", "F", "G", "H"]),
    );

    // Annex C row ABCDEFGH = [H, G, B, C, A, F, D, E] for winners A,B,D,E,G,I,K,L.
    // So: A->3H, B->3G, D->3B, E->3C, G->3A, I->3F, K->3D, L->3E.
    const expected = [
      [1, 73, "RU-A", "RU-B"],
      [2, 74, "W-E", "3-C"], // winner E v third assigned to E
      [3, 75, "W-F", "RU-C"],
      [4, 76, "W-C", "RU-F"],
      [5, 77, "W-I", "3-F"],
      [6, 78, "RU-E", "RU-I"],
      [7, 79, "W-A", "3-H"],
      [8, 80, "W-L", "3-E"],
      [9, 81, "W-D", "3-B"],
      [10, 82, "W-G", "3-A"],
      [11, 83, "RU-K", "RU-L"],
      [12, 84, "W-H", "RU-J"],
      [13, 85, "W-B", "3-G"],
      [14, 86, "W-J", "RU-H"],
      [15, 87, "W-K", "3-D"],
      [16, 88, "RU-D", "RU-G"],
    ];

    expect(
      matches.map((m) => [m.slot, m.matchNumber, m.teamA.teamId, m.teamB.teamId]),
    ).toEqual(expected);

    // Sanity on shape: 16 matches, contiguous slots 1-16 and match numbers 73-88.
    expect(matches.map((m) => m.slot)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    expect(matches.map((m) => m.matchNumber)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 73),
    );
  });

  it("produces a different, correct mapping for combination EFGHIJKL", () => {
    const baseline = buildRoundOf32(
      fullWinners(),
      fullRunnersUp(),
      makeThirds(["A", "B", "C", "D", "E", "F", "G", "H"]),
    );
    const matches = buildRoundOf32(
      fullWinners(),
      fullRunnersUp(),
      makeThirds(["E", "F", "G", "H", "I", "J", "K", "L"]),
    );

    // Annex C row EFGHIJKL = [E, J, I, F, H, G, L, K] for winners A,B,D,E,G,I,K,L.
    // So: A->3E, B->3J, D->3I, E->3F, G->3H, I->3G, K->3L, L->3K.
    const winnerThirdPairings = matches.flatMap((m) =>
      m.teamB.source.type === "third"
        ? [[m.teamA.source, m.teamB.source.group]]
        : [],
    );

    expect(winnerThirdPairings).toEqual([
      [{ type: "winner", group: "E" }, "F"],
      [{ type: "winner", group: "I" }, "G"],
      [{ type: "winner", group: "A" }, "E"],
      [{ type: "winner", group: "L" }, "K"],
      [{ type: "winner", group: "D" }, "I"],
      [{ type: "winner", group: "G" }, "H"],
      [{ type: "winner", group: "B" }, "J"],
      [{ type: "winner", group: "K" }, "L"],
    ]);

    // The two combinations must differ (different thirds qualify and slot in).
    expect(matches).not.toEqual(baseline);
  });

  it("never pairs a third-place team with the winner of its own group", () => {
    // Check across several genuinely different combinations from Annex C.
    const combos: GroupLetter[][] = [
      ["A", "B", "C", "D", "E", "F", "G", "H"],
      ["E", "F", "G", "H", "I", "J", "K", "L"],
      ["A", "C", "E", "G", "I", "K", "B", "D"],
      ["B", "D", "F", "H", "J", "L", "A", "C"],
      ["A", "B", "C", "D", "I", "J", "K", "L"],
    ];

    for (const combo of combos) {
      const matches = buildRoundOf32(
        fullWinners(),
        fullRunnersUp(),
        makeThirds(combo),
      );
      for (const match of matches) {
        const sources = [match.teamA.source, match.teamB.source];
        const winner = sources.find((s) => s.type === "winner");
        const third = sources.find((s) => s.type === "third");
        if (winner?.type === "winner" && third?.type === "third") {
          expect(third.group).not.toBe(winner.group);
        }
      }
    }
  });

  it("always sends the winners of C, F, H and J against runners-up, never thirds", () => {
    const combos: GroupLetter[][] = [
      ["A", "B", "C", "D", "E", "F", "G", "H"],
      ["E", "F", "G", "H", "I", "J", "K", "L"],
      ["A", "B", "C", "D", "I", "J", "K", "L"],
    ];

    for (const combo of combos) {
      const matches = buildRoundOf32(
        fullWinners(),
        fullRunnersUp(),
        makeThirds(combo),
      );

      for (const winnerGroup of ["C", "F", "H", "J"] as GroupLetter[]) {
        const match = matches.find(
          (m) =>
            (m.teamA.source.type === "winner" &&
              m.teamA.source.group === winnerGroup) ||
            (m.teamB.source.type === "winner" &&
              m.teamB.source.group === winnerGroup),
        );
        expect(match, `expected a match for winner ${winnerGroup}`).toBeDefined();

        const opponent =
          match!.teamA.source.type === "winner" &&
          match!.teamA.source.group === winnerGroup
            ? match!.teamB
            : match!.teamA;
        expect(opponent.source.type).toBe("runnerUp");
      }
    }
  });

  it("covers every Annex C combination without error and matches the table", () => {
    // Exhaustive: build all 495 brackets and confirm each winner-vs-third slot
    // matches the encoded Annex C row exactly. This guards the whole pipeline.
    const winners = fullWinners();
    const runnersUp = fullRunnersUp();
    const COLS: GroupLetter[] = ["A", "B", "D", "E", "G", "I", "K", "L"];

    const keys = Object.keys(ANNEX_C);
    expect(keys).toHaveLength(495);

    for (const key of keys) {
      const groups = key.split("") as GroupLetter[];
      const matches = buildRoundOf32(winners, runnersUp, makeThirds(groups));

      const opponentOf = (winnerGroup: GroupLetter): GroupLetter => {
        const match = matches.find(
          (m) =>
            m.teamA.source.type === "winner" &&
            m.teamA.source.group === winnerGroup,
        )!;
        if (match.teamB.source.type !== "third") {
          throw new Error(`winner ${winnerGroup} did not face a third`);
        }
        return match.teamB.source.group;
      };

      const expectedRow = ANNEX_C[key];
      const actualRow = COLS.map((w) => opponentOf(w));
      expect(actualRow).toEqual(expectedRow);
    }
  });

  it("rejects a set that does not contain exactly 8 qualifying thirds", () => {
    const sevenThirds = makeThirds(["A", "B", "C", "D", "E", "F", "G"]);
    expect(() =>
      buildRoundOf32(fullWinners(), fullRunnersUp(), sevenThirds),
    ).toThrow(/exactly 8 qualifying third-place teams/);

    // Extra non-qualified entries are ignored, so this still fails as "7".
    const sevenPlusUnqualified: ThirdPlaceEntry[] = [
      ...sevenThirds,
      { group: "H", standing: standing("3-H"), rank: 9, qualified: false },
    ];
    expect(() =>
      buildRoundOf32(fullWinners(), fullRunnersUp(), sevenPlusUnqualified),
    ).toThrow(/exactly 8 qualifying third-place teams/);
  });

  it("rejects incomplete winner or runner-up inputs", () => {
    const partialWinners = new Map(fullWinners());
    partialWinners.delete("C");
    expect(() =>
      buildRoundOf32(
        partialWinners,
        fullRunnersUp(),
        makeThirds(["A", "B", "C", "D", "E", "F", "G", "H"]),
      ),
    ).toThrow(/Missing winners for group\(s\): C/);
  });
});
