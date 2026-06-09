// Shared single-elimination bracket-tree renderer. Used read-only when viewing
// another player's bracket, and interactively (nodes clickable to edit a pick) in
// the user's own knockout review. Vertical placement of each round's matches
// comes from the engine's official progression (computeBracketLayout), so feeders
// sit next to each other and the connectors read as a real bracket.

import { computeBracketLayout } from "@/lib/admin-bracket";
import type {
  KnockoutRoundView,
  KnockoutMatchView,
} from "@/lib/predictions-types";
import styles from "./bracket-tree.module.css";

function pairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

export function BracketTree({
  rounds,
  onOpenMatch,
}: {
  rounds: KnockoutRoundView[];
  /** When provided, determined matches become clickable (to edit the pick). */
  onOpenMatch?: (matchNumber: number) => void;
}) {
  const layout = computeBracketLayout();
  const byNumber = new Map<number, KnockoutMatchView>();
  for (const r of rounds) for (const m of r.matches) byNumber.set(m.matchNumber, m);

  return (
    <div className="overflow-x-auto pb-2">
      <p className="mb-1 text-xs text-black/40 dark:text-white/40">
        Scroll sideways to see all rounds.
      </p>
      <div className={styles.bracket}>
        {layout.map((round, ri) => {
          const feeding = ri < layout.length - 1;
          const fed = ri > 0;
          return (
            <div key={round.name} className="flex flex-col">
              <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                {round.label}
              </div>
              <div
                className={[
                  styles.round,
                  feeding ? styles.feeding : "",
                  fed ? styles.fed : "",
                  "flex-1",
                ].join(" ")}
              >
                {pairs(round.matchNumbers).map((pair, pi) => (
                  <div key={pi} className={styles.pair}>
                    {pair.map((mn) => (
                      <div key={mn} className={styles.node}>
                        <MatchNode
                          match={byNumber.get(mn)}
                          onOpenMatch={onOpenMatch}
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Side({
  side,
  picked,
}: {
  side: KnockoutMatchView["teamA"];
  picked: boolean;
}) {
  return (
    <div
      className={
        "flex items-center justify-between gap-1 px-2 py-1 " +
        (picked
          ? "font-semibold text-emerald-700 dark:text-emerald-300"
          : "text-black/70 dark:text-white/70")
      }
    >
      <span className="truncate">{side.teamName ?? side.label}</span>
      {picked ? <span aria-hidden>&#10003;</span> : null}
    </div>
  );
}

function MatchNode({
  match,
  onOpenMatch,
}: {
  match?: KnockoutMatchView;
  onOpenMatch?: (matchNumber: number) => void;
}) {
  if (!match) return <div className="w-40" />;

  const pickedA = match.pick !== null && match.pick === match.teamA.teamId;
  const pickedB = match.pick !== null && match.pick === match.teamB.teamId;
  const clickable = onOpenMatch !== undefined && match.determined;

  const inner = (
    <>
      <Side side={match.teamA} picked={pickedA} />
      <div className="border-t border-black/5 dark:border-white/10" />
      <Side side={match.teamB} picked={pickedB} />
    </>
  );

  const base =
    "w-40 rounded-lg border bg-white text-xs shadow-sm dark:bg-neutral-900 ";

  if (clickable) {
    return (
      <button
        onClick={() => onOpenMatch(match.matchNumber)}
        className={
          base +
          "block w-40 border-black/15 text-left transition hover:border-blue-400 dark:border-white/20"
        }
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={base + "border-black/15 dark:border-white/20"}>{inner}</div>
  );
}
