import { getTeamTop3 } from "@/lib/team-top3";

// Compact, secondary list of a team's top 3 players (position badge + name),
// shown under a team while predicting. Renders nothing when the team is unknown
// or has no players, so it never adds empty space or noise. Inherits the parent's
// text alignment so it sits cleanly under a left- or right-aligned team name.
export function TeamTopPlayers({ team }: { team: string | null | undefined }) {
  const players = team ? getTeamTop3(team) : [];
  if (players.length === 0) return null;

  return (
    <ul className="mt-1 space-y-0.5 text-[11px] leading-tight text-black/45 dark:text-white/45">
      {players.map((p) => (
        <li key={p.name}>
          <span className="mr-1 inline-block rounded bg-black/5 px-1 text-[9px] font-semibold uppercase text-black/45 dark:bg-white/10 dark:text-white/45">
            {p.position}
          </span>
          {p.name}
        </li>
      ))}
    </ul>
  );
}
