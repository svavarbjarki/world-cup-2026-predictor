import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getMatchesPageData, type MatchRow } from "@/lib/matches-page";
import { flagEmoji } from "@/lib/data/teams";
import { MatchAggregateBar } from "../match-aggregate-bar";

export const dynamic = "force-dynamic";

// Iceland is UTC year-round, so format kickoff times in Reykjavik regardless of
// where the server runs.
function formatKickoff(d: Date | null): string {
  if (!d) return "Schedule TBD";
  return d.toLocaleString("en-GB", {
    timeZone: "Atlantic/Reykjavik",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default async function MatchesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // layout guarantees a user

  const sections = await getMatchesPageData(user.id);

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-blue-600">
        &larr; Back to dashboard
      </Link>
      <h1 className="mt-2 mb-4 text-xl font-semibold">All matches</h1>

      <div className="space-y-6">
        {sections.map((section) => (
          <section key={section.title}>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
              {section.title}
            </h2>
            <div className="space-y-2">
              {section.matches.map((m) => (
                <MatchRowCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function TeamSide({
  team,
  align,
}: {
  team: MatchRow["home"];
  align: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      {team ? (
        <>
          <span aria-hidden className="mr-1">
            {flagEmoji(team.isoCode)}
          </span>
          {team.name}
        </>
      ) : (
        <span className="text-black/40 dark:text-white/40">TBD</span>
      )}
    </div>
  );
}

function MatchRowCard({ match }: { match: MatchRow }) {
  const hasTeams = match.home != null && match.away != null;

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="flex items-center justify-between text-xs text-black/45 dark:text-white/45">
        <span>{formatKickoff(match.kickoffAt)}</span>
        {match.venue ? <span className="truncate pl-2">{match.venue}</span> : null}
      </div>

      <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm font-medium">
        <TeamSide team={match.home} align="right" />
        <span className="text-black/30">vs</span>
        <TeamSide team={match.away} align="left" />
      </div>

      {match.played && match.result ? (
        <div className="mt-1 text-center text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {match.phase === "group"
            ? `Result: ${match.result}`
            : `Winner: ${match.result}`}
        </div>
      ) : null}

      {hasTeams && match.aggregate ? (
        <div className="mt-2">
          <MatchAggregateBar
            aggregate={match.aggregate}
            home={match.home!}
            away={match.away!}
            phase={match.phase}
          />
        </div>
      ) : null}
    </div>
  );
}
