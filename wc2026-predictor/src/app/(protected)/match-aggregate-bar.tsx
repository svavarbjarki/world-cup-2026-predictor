import { flagEmoji } from "@/lib/data/teams";
import { getTeamColor, readableTextColor } from "@/lib/team-colors";
import type { MatchAggregate, OutcomeKey } from "@/lib/aggregates";

interface TeamLite {
  name: string;
  isoCode: string;
}

const DRAW_COLOR = "#a3a3a3"; // neutral gray for the draw segment

/**
 * Compact horizontal split bar of how submitted players called a match
 * (home win / draw / away win for group, home / away for knockout). The
 * percentage text is always shown in the legend, so it does not rely on colour
 * alone. Renders a locked placeholder when the viewer has not earned visibility,
 * and nothing at all when there is no aggregate to show.
 */
export function MatchAggregateBar({
  aggregate,
  home,
  away,
  phase,
}: {
  aggregate: MatchAggregate | null;
  home: TeamLite;
  away: TeamLite;
  phase: "group" | "knockout";
}) {
  if (!aggregate) return null;

  if (!aggregate.allowed) {
    return (
      <p className="text-center text-xs text-black/45 dark:text-white/45">
        Submit your {phase === "group" ? "group" : "knockout"} predictions to see
        how everyone called it.
      </p>
    );
  }

  if (aggregate.total === 0) {
    return (
      <p className="text-center text-xs text-black/45 dark:text-white/45">
        No predictions yet.
      </p>
    );
  }

  const pctOf = (key: OutcomeKey) =>
    aggregate.segments.find((s) => s.key === key)?.pct ?? 0;
  const hasDraw = aggregate.segments.some((s) => s.key === "draw");
  const colorOf = (key: OutcomeKey) =>
    key === "home"
      ? getTeamColor(home.isoCode)
      : key === "away"
        ? getTeamColor(away.isoCode)
        : DRAW_COLOR;

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full text-[9px] font-semibold">
        {aggregate.segments
          .filter((s) => s.count > 0)
          .map((s) => {
            const bg = colorOf(s.key);
            return (
              <div
                key={s.key}
                style={{
                  flexGrow: s.count,
                  backgroundColor: bg,
                  color: readableTextColor(bg),
                }}
                className="flex items-center justify-center"
              >
                {s.pct >= 15 ? `${s.pct}%` : ""}
              </div>
            );
          })}
      </div>
      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-3 gap-y-0.5 text-[11px] text-black/60 dark:text-white/60">
        <span>
          <span aria-hidden className="mr-0.5">
            {flagEmoji(home.isoCode)}
          </span>
          {pctOf("home")}%
        </span>
        {hasDraw ? <span>Draw {pctOf("draw")}%</span> : null}
        <span>
          <span aria-hidden className="mr-0.5">
            {flagEmoji(away.isoCode)}
          </span>
          {pctOf("away")}%
        </span>
        <span className="text-black/35 dark:text-white/35">
          ({aggregate.total})
        </span>
      </div>
    </div>
  );
}
