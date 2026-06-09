// Pure helper that turns the engine's official knockout progression into a
// left-to-right, top-to-bottom bracket-tree layout. Used by the /admin bracket
// view so node placement comes from the engine's source of truth (no hard-coded
// order). No Prisma, no I/O.

import { KNOCKOUT_PROGRESSION } from "@/lib/engine/advanceBracket";

export interface BracketLayoutRound {
  /** Engine round name (e.g. "roundOf32"). */
  name: string;
  /** Short label for display (e.g. "R32"). */
  label: string;
  /** Match numbers in bracket order, top to bottom. */
  matchNumbers: number[];
}

const ROUND_ORDER = [
  "roundOf32",
  "roundOf16",
  "quarterFinals",
  "semiFinals",
  "final",
] as const;

const ROUND_LABEL: Record<string, string> = {
  roundOf32: "R32",
  roundOf16: "R16",
  quarterFinals: "QF",
  semiFinals: "SF",
  final: "Final",
};

/**
 * Build the bracket layout. Each later-round match is fed by two earlier matches
 * (from the progression); an in-order walk of that tree from the final down
 * places every round's matches top to bottom so feeders sit next to each other.
 */
export function computeBracketLayout(): BracketLayoutRound[] {
  const feeders = new Map<number, [number, number]>();
  const roundName = new Map<number, string>();

  for (const stage of KNOCKOUT_PROGRESSION) {
    for (const p of stage.produces) {
      feeders.set(p.matchNumber, [p.fromMatchA, p.fromMatchB]);
      roundName.set(p.matchNumber, stage.name);
    }
  }
  // Any match referenced as a feeder but never produced is a round-of-32 leaf.
  for (const [, [a, b]] of feeders) {
    for (const m of [a, b]) {
      if (!roundName.has(m)) roundName.set(m, "roundOf32");
    }
  }

  // The final is the single match produced by the last stage.
  const lastStage = KNOCKOUT_PROGRESSION[KNOCKOUT_PROGRESSION.length - 1];
  const root = lastStage.produces[0].matchNumber;

  const perRound = new Map<string, number[]>();
  const record = (m: number) => {
    const rn = roundName.get(m)!;
    const list = perRound.get(rn) ?? [];
    list.push(m);
    perRound.set(rn, list);
  };

  // In-order walk: left subtree, self, right subtree. Grouping the visit order
  // by round yields each round's top-to-bottom order.
  const visit = (m: number) => {
    const f = feeders.get(m);
    if (f) visit(f[0]);
    record(m);
    if (f) visit(f[1]);
  };
  visit(root);

  return ROUND_ORDER.map((name) => ({
    name,
    label: ROUND_LABEL[name],
    matchNumbers: perRound.get(name) ?? [],
  }));
}
