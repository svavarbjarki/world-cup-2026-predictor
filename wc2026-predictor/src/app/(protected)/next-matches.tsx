"use client";

import { useEffect, useRef } from "react";
import { flagEmoji } from "@/lib/data/teams";
import type { NextMatchView } from "@/lib/hub";
import { MatchAggregateBar } from "./match-aggregate-bar";

function Flag({ isoCode }: { isoCode: string }) {
  return (
    <span aria-hidden className="mr-1">
      {flagEmoji(isoCode)}
    </span>
  );
}

/**
 * Horizontally swipeable list of all matches (played and upcoming) with their
 * gated picks. Opens on `nextIndex` (the next unplayed match); the user can
 * scroll back to already-played matches.
 */
export function NextMatches({
  matches,
  nextIndex,
}: {
  matches: NextMatchView[];
  nextIndex: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // Start scrolled to the next unplayed match.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const child = el.children[nextIndex] as HTMLElement | undefined;
    if (child) el.scrollLeft = child.offsetLeft;
  }, [nextIndex]);

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-5 text-sm text-black/50 shadow-sm dark:border-white/10 dark:bg-neutral-900 dark:text-white/50">
        No matches to show yet.
      </div>
    );
  }

  function scroll(direction: 1 | -1) {
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div>
      <div
        ref={scroller}
        className="relative flex snap-x snap-mandatory gap-3 overflow-x-auto pb-1"
      >
        {matches.map((m, i) => (
          <div
            key={i}
            className="w-full shrink-0 snap-start rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="flex items-center justify-between text-xs text-black/50 dark:text-white/50">
              <span>
                {m.label}
                {m.played ? " - played" : ""}
              </span>
              <span>
                {m.kickoffAt
                  ? new Date(m.kickoffAt).toLocaleString()
                  : "Schedule TBD"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-lg font-medium">
              <span>
                <Flag isoCode={m.home.isoCode} />
                {m.home.name}
              </span>
              <span className="text-black/30">vs</span>
              <span>
                <Flag isoCode={m.away.isoCode} />
                {m.away.name}
              </span>
            </div>

            {m.played && m.result ? (
              <div className="mt-2 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {m.phase === "group"
                  ? `Final: ${m.result}`
                  : `Winner: ${m.result}`}
              </div>
            ) : null}

            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              <MatchAggregateBar
                aggregate={m.aggregate}
                home={m.home}
                away={m.away}
                phase={m.phase}
              />

              {m.picksVisible ? (
                m.picks && m.picks.length > 0 ? (
                  <ul className="mt-3 space-y-1 text-sm">
                    {m.picks.map((p) => (
                      <li key={p.displayName} className="text-center">
                        <span className="text-black/60 dark:text-white/60">
                          {p.displayName}
                        </span>
                        <div className="font-medium">{p.text}</div>
                      </li>
                    ))}
                  </ul>
                ) : null
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {matches.length > 1 ? (
        <div className="mt-2 flex items-center justify-center gap-4 text-sm">
          <button onClick={() => scroll(-1)} className="px-2 py-1 text-blue-600">
            &larr; Prev
          </button>
          <span className="text-xs text-black/40 dark:text-white/40">
            Swipe between matches
          </span>
          <button onClick={() => scroll(1)} className="px-2 py-1 text-blue-600">
            Next &rarr;
          </button>
        </div>
      ) : null}
    </div>
  );
}
