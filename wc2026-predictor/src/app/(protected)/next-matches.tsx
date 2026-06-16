"use client";

import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { flagEmoji } from "@/lib/data/teams";
import { rawTeamColor } from "@/lib/team-colors";
import type { NextMatchView } from "@/lib/hub";
import type { GoalEventView } from "@/lib/goal-events";
import { MatchAggregateBar } from "./match-aggregate-bar";
import { PlayerAvatar } from "./player-avatar";

function Flag({ isoCode }: { isoCode: string }) {
  return (
    <span aria-hidden className="mr-1">
      {flagEmoji(isoCode)}
    </span>
  );
}

// "[Scorer] [min]' (assist: [Assister])" with the minute and assist clause
// dropped when absent. A null scorer is an own goal or an unlisted player.
function goalLine(g: GoalEventView): string {
  const scorer = g.scorerName ?? "Own goal";
  const minute = g.minute != null ? ` ${g.minute}'` : "";
  const assist = g.assisterName ? ` (assist: ${g.assisterName})` : "";
  return `${scorer}${minute}${assist}`;
}

/**
 * Goal list grouped home-left / away-right, with the running scoreline after each
 * goal so it is clear which goal a scorer scored (1-0, 2-0, 2-1, ...). The score
 * is tallied in chronological order (goals arrive sorted by minute).
 */
function MatchGoals({
  goals,
  homeIso,
  awayIso,
}: {
  goals: GoalEventView[];
  homeIso: string;
  awayIso: string;
}) {
  let home = 0;
  let away = 0;
  const rows = goals.map((g) => {
    if (g.side === "home") home += 1;
    else away += 1;
    return { g, score: `${home}-${away}` };
  });
  const scoreClass = "font-semibold tabular-nums text-black/45 dark:text-white/45";

  return (
    <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-black/60 dark:text-white/60">
      <ul className="space-y-1 text-left">
        {rows
          .filter((r) => r.g.side === "home")
          .map((r, i) => (
            <li key={`h${i}`} className="flex items-center gap-1">
              <span className={scoreClass}>{r.score}</span>
              <PlayerAvatar
                photo={r.g.scorerPhoto}
                isoCode={homeIso}
                alt={r.g.scorerName ?? ""}
                size={16}
              />
              <span className="min-w-0 truncate">{goalLine(r.g)}</span>
            </li>
          ))}
      </ul>
      <ul className="space-y-1 text-right">
        {rows
          .filter((r) => r.g.side === "away")
          .map((r, i) => (
            <li key={`a${i}`} className="flex items-center justify-end gap-1">
              <span className="min-w-0 truncate">{goalLine(r.g)}</span>
              <PlayerAvatar
                photo={r.g.scorerPhoto}
                isoCode={awayIso}
                alt={r.g.scorerName ?? ""}
                size={16}
              />
              <span className={scoreClass}>{r.score}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/**
 * Parse a "#RRGGBB" hex string into its rgb triple, or null when missing or
 * malformed. Tailwind cannot generate arbitrary colour classes at runtime, so the
 * team colours are applied as inline rgb()/rgba() styles built from this.
 */
function hexToRgb(hex: string | null): { r: number; g: number; b: number } | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** A faint team-colour background tint, or undefined to keep the neutral style. */
function tintStyle(color: string | null): CSSProperties | undefined {
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  // Roughly 22% opacity so text stays readable over the near-black surface.
  return { backgroundColor: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.22)` };
}

/** Full-opacity team colour for a label, or undefined to inherit the default. */
function labelStyle(color: string | null): CSSProperties | undefined {
  const rgb = hexToRgb(color);
  if (!rgb) return undefined;
  return { color: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})` };
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
              <span style={labelStyle(rawTeamColor(m.home.isoCode))}>
                <Flag isoCode={m.home.isoCode} />
                {m.home.name}
              </span>
              <span className="text-black/30">vs</span>
              <span style={labelStyle(rawTeamColor(m.away.isoCode))}>
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

            {m.played && m.goals.length > 0 ? (
              <MatchGoals
                goals={m.goals}
                homeIso={m.home.isoCode}
                awayIso={m.away.isoCode}
              />
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
                      <li
                        key={p.displayName}
                        className="rounded px-2 py-1 text-center"
                        style={tintStyle(p.color)}
                      >
                        {/* White text over the team-colour tint reads cleanly
                            regardless of the team's colour. */}
                        <span className="text-white/70">{p.displayName}</span>
                        <div className="font-medium text-white">{p.text}</div>
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
