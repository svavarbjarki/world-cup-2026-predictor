import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import {
  getPlayers,
  getAllMatchesForViewer,
  getPredictedChampions,
  getLastMatchPerfectScores,
  getChampionPicks,
} from "@/lib/hub";
import { getLeaderboardWithMovement } from "@/lib/leaderboard";
import { flagEmoji } from "@/lib/data/teams";
import { prisma } from "@/lib/prisma";
import { NextMatches } from "./next-matches";
import { ChampionCarousel } from "./champion-carousel";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  if (status === "SUBMITTED") return "Submitted";
  if (status === "IN_PROGRESS") return "In progress";
  return "Not started";
}

function StatusChip({
  status,
  big = false,
}: {
  status: string;
  big?: boolean;
}) {
  const tone =
    status === "SUBMITTED"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "IN_PROGRESS"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50";
  const size = big ? "px-2.5 py-1 text-sm" : "px-1.5 py-0.5 text-xs";
  return (
    <span className={`rounded font-medium ${size} ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

// Compact inline badge of a user's predicted tournament champion (team flag +
// name). Greyed with a strikethrough once that team is knocked out in real life.
// Colours come from the theme token classes only.
function ChampionBadge({
  name,
  isoCode,
  eliminated,
}: {
  name: string;
  isoCode: string;
  eliminated: boolean;
}) {
  return (
    <span
      title={eliminated ? `${name} (knocked out)` : name}
      className={
        "ml-2 inline-flex items-center gap-1 rounded bg-surface-raised px-1.5 py-0.5 align-middle text-[11px] font-medium " +
        (eliminated ? "text-text-muted opacity-70" : "text-text")
      }
    >
      <span aria-hidden>{flagEmoji(isoCode)}</span>
      <span className={eliminated ? "line-through" : ""}>{name}</span>
    </span>
  );
}

// Rank-change indicator since the most recent result: green up, red down, gray
// dash. Shape (and the title) carry the meaning so it does not rely on colour.
function MoveArrow({ direction }: { direction: "up" | "down" | "same" }) {
  if (direction === "up") {
    return (
      <span className="text-emerald-500" title="Moved up" aria-label="moved up">
        &#9650;
      </span>
    );
  }
  if (direction === "down") {
    return (
      <span className="text-red-500" title="Moved down" aria-label="moved down">
        &#9660;
      </span>
    );
  }
  return (
    <span className="text-text-muted" title="No change" aria-label="no change">
      -
    </span>
  );
}

// Points earned from the most recent result: a small green "+N" badge, or a gray
// "0" when none were earned.
function PointsBadge({ points }: { points: number }) {
  if (points > 0) {
    return (
      <span className="ml-1 rounded bg-emerald-500/15 px-1 text-[10px] font-semibold text-emerald-400">
        +{points}
      </span>
    );
  }
  return <span className="ml-1 text-[10px] text-text-muted">{points}</span>;
}

// One centered status line (e.g. "Groups  Not started"), a bit larger.
function StatusRow({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center gap-2 text-base">
      <span className="font-medium">{label}</span>
      <StatusChip status={status} big />
    </div>
  );
}

// A stacked, full-width nav button coloured by state:
//   red    = not available yet (e.g. knockout before the organizer opens it),
//   yellow = available but you have not submitted this prediction,
//   green  = you have submitted it.
function NavButton({
  href,
  label,
  available,
  submitted,
}: {
  href: string;
  label: string;
  available: boolean;
  submitted: boolean;
}) {
  const tone = !available
    ? "bg-red-600 hover:bg-red-700"
    : submitted
      ? "bg-emerald-600 hover:bg-emerald-700"
      : "bg-amber-500 hover:bg-amber-600";
  return (
    <Link
      href={href}
      className={`w-full max-w-xs rounded-lg px-4 py-3 text-center font-medium text-white ${tone}`}
    >
      {label}
    </Link>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return null; // layout guarantees a user; satisfy types

  const [
    players,
    { rows: leaderboard, movement },
    matchData,
    settings,
    champions,
    perfectScores,
    championPicks,
  ] = await Promise.all([
    getPlayers(),
    getLeaderboardWithMovement(),
    getAllMatchesForViewer(user.id),
    prisma.settings.findUnique({ where: { id: 1 } }),
    getPredictedChampions(),
    getLastMatchPerfectScores(),
    getChampionPicks(),
  ]);

  // Availability of each prediction section (color the nav buttons green/red).
  // "Available" means the section is open to use, regardless of your own
  // submission: group + awards are open pre-tournament until the global first
  // kickoff; knockout opens only once the organizer opens the bracket.
  const now = new Date();
  const preTournamentLocked =
    settings?.kickoffLockAt != null && settings.kickoffLockAt <= now;
  const knockoutLocked =
    settings?.knockoutLockAt != null && settings.knockoutLockAt <= now;
  const groupsAvailable = !preTournamentLocked;
  const awardsAvailable = !preTournamentLocked;
  const knockoutAvailable =
    settings?.knockoutOpenedAt != null && !knockoutLocked;

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">
            World Cup 2026
          </div>
          <h1 className="text-2xl font-bold">Hi {user.displayName}</h1>
        </div>
        <form action={logoutAction}>
          <button className="rounded-lg border border-border px-3 py-1.5 text-sm text-text-muted hover:bg-surface-raised">
            Log out
          </button>
        </form>
      </header>

      {/* Your three submission statuses, stacked and centered. */}
      <div className="mb-5 flex flex-col items-center gap-2">
        <StatusRow label="Groups" status={user.groupStatus} />
        <StatusRow label="Knockout" status={user.knockoutStatus} />
        <StatusRow label="Awards" status={user.awardsStatus} />
      </div>

      {/* Entry points, stacked and centered. Green = available, red = not yet. */}
      <div className="mb-6 flex flex-col items-center gap-3">
        <NavButton
          href="/groups"
          label="Group predictions"
          available={groupsAvailable}
          submitted={user.groupStatus === "SUBMITTED"}
        />
        <NavButton
          href="/knockout"
          label="Knockout bracket"
          available={knockoutAvailable}
          submitted={user.knockoutStatus === "SUBMITTED"}
        />
        <NavButton
          href="/awards"
          label="Awards"
          available={awardsAvailable}
          submitted={user.awardsStatus === "SUBMITTED"}
        />
      </div>

      {/* Matches (swipe through; opens on the next match, scroll back for played) */}
      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Matches
          </h2>
          <Link href="/matches" className="text-sm text-blue-600">
            All matches &rarr;
          </Link>
        </div>
        <NextMatches matches={matchData.matches} nextIndex={matchData.nextIndex} />
      </section>

      {/* Champion-pick ticker: cycles through every submitted player's predicted
          winner. Hidden entirely when nobody has submitted a bracket. */}
      {championPicks.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Champion picks
          </h2>
          <ChampionCarousel picks={championPicks} />
        </section>
      ) : null}

      {/* Perfect score shoutout for the most recent completed group match.
          Hidden entirely when nobody nailed the exact scoreline. */}
      {perfectScores ? (
        <section className="mb-6">
          <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
            <div className="flex items-center gap-2">
              <span aria-hidden className="text-lg">
                &#11088;
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">
                Perfect score
              </h2>
            </div>
            <p className="mt-2 text-sm font-medium text-text">
              {flagEmoji(perfectScores.homeIso)} {perfectScores.homeName}{" "}
              {perfectScores.homeGoals}-{perfectScores.awayGoals}{" "}
              {perfectScores.awayName} {flagEmoji(perfectScores.awayIso)}
            </p>
            <p className="mt-1 text-sm text-text-muted">
              Nailed the exact score:{" "}
              <span className="font-semibold text-text">
                {perfectScores.players.join(", ")}
              </span>
            </p>
          </div>
        </section>
      ) : null}

      {/* Leaderboard */}
      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Leaderboard
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-neutral-900">
          <table className="w-full min-w-[20rem] text-sm">
            <thead>
              <tr className="text-left text-black/50 dark:text-white/50">
                <th className="px-2 py-2.5 sm:px-3 font-medium">#</th>
                <th className="px-2 py-2.5 sm:px-3 font-medium">Player</th>
                <th className="px-2 py-2.5 sm:px-3 text-center font-medium">Grp</th>
                <th className="px-2 py-2.5 sm:px-3 text-center font-medium">KO</th>
                <th className="px-2 py-2.5 sm:px-3 text-center font-medium">Awd</th>
                <th className="px-2 py-2.5 sm:px-3 text-center font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((row) => {
                // Gild the leader only once results give them a real lead.
                const isLeader = row.rank === 1 && row.totalPoints > 0;
                const champion = champions.get(row.userId);
                const move = movement.get(row.userId);
                return (
                  <tr
                    key={row.userId}
                    className={
                      "border-t border-border " +
                      (isLeader ? "bg-gold/10" : "")
                    }
                  >
                    <td
                      className={
                        "px-2 py-2.5 sm:px-3 " +
                        (isLeader
                          ? "font-bold text-gold"
                          : "text-text-muted")
                      }
                    >
                      <span className="inline-flex items-center gap-1">
                        {row.rank}
                        {move ? <MoveArrow direction={move.direction} /> : null}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2.5 sm:px-3">
                      <span className={isLeader ? "font-semibold text-gold" : ""}>
                        {row.displayName}
                      </span>
                      {row.userId === user.id ? (
                        <span className="ml-1 text-xs text-text-muted">(you)</span>
                      ) : null}
                      {champion ? (
                        <ChampionBadge
                          name={champion.name}
                          isoCode={champion.isoCode}
                          eliminated={champion.eliminated}
                        />
                      ) : null}
                    </td>
                    <td className="px-2 py-2.5 sm:px-3 text-center">{row.groupPoints}</td>
                    <td className="px-2 py-2.5 sm:px-3 text-center">{row.knockoutPoints}</td>
                    <td className="px-2 py-2.5 sm:px-3 text-center">{row.awardPoints}</td>
                    <td
                      className={
                        "whitespace-nowrap px-2 py-2.5 sm:px-3 text-center font-semibold " +
                        (isLeader ? "text-gold" : "")
                      }
                    >
                      {row.totalPoints}
                      {move ? <PointsBadge points={move.points} /> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-black/40 dark:text-white/40">
          Points appear once real results are entered. Until then everyone is on
          0.
        </p>
      </section>

      {/* Players */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Players
        </h2>
        <ul className="space-y-2">
          {players.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="font-medium">
                {p.displayName}
                {p.id === user.id ? (
                  <span className="ml-1 text-xs text-black/40">(you)</span>
                ) : null}
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-xs text-black/50 dark:text-white/50">
                <span className="flex items-center gap-1">
                  Groups <StatusChip status={p.groupStatus} />
                </span>
                <span className="flex items-center gap-1">
                  KO <StatusChip status={p.knockoutStatus} />
                </span>
                <span className="flex items-center gap-1">
                  Awd <StatusChip status={p.awardsStatus} />
                </span>
              </div>
              {p.id !== user.id ? (
                <Link
                  href={`/players/${p.id}`}
                  className="mt-3 block rounded-lg border border-black/15 px-3 py-2 text-center text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
                >
                  View
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
