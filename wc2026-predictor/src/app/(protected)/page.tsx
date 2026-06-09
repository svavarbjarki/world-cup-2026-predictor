import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { getPlayers, getAllMatchesForViewer } from "@/lib/hub";
import { getLeaderboard } from "@/lib/leaderboard";
import { prisma } from "@/lib/prisma";
import { NextMatches } from "./next-matches";

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

  const [players, leaderboard, matchData, settings] = await Promise.all([
    getPlayers(),
    getLeaderboard(),
    getAllMatchesForViewer(user.id),
    prisma.settings.findUnique({ where: { id: 1 } }),
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
        <h1 className="text-2xl font-semibold">Hi {user.displayName}</h1>
        <form action={logoutAction}>
          <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
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
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Matches
        </h2>
        <NextMatches matches={matchData.matches} nextIndex={matchData.nextIndex} />
      </section>

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
              {leaderboard.map((row) => (
                <tr
                  key={row.userId}
                  className="border-t border-black/5 dark:border-white/10"
                >
                  <td className="px-2 py-2.5 sm:px-3 text-black/50 dark:text-white/50">
                    {row.rank}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3">
                    {row.displayName}
                    {row.userId === user.id ? (
                      <span className="ml-1 text-xs text-black/40">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-2.5 sm:px-3 text-center">{row.groupPoints}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-center">{row.knockoutPoints}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-center">{row.awardPoints}</td>
                  <td className="px-2 py-2.5 sm:px-3 text-center font-semibold">
                    {row.totalPoints}
                  </td>
                </tr>
              ))}
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
