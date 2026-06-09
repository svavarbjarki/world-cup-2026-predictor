import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/lib/auth-actions";
import { getPlayers, getNextMatchForViewer } from "@/lib/hub";
import { getLeaderboard } from "@/lib/leaderboard";
import { flagEmoji } from "@/lib/data/teams";

export const dynamic = "force-dynamic";

function statusLabel(status: string): string {
  if (status === "SUBMITTED") return "Submitted";
  if (status === "IN_PROGRESS") return "In progress";
  return "Not started";
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "SUBMITTED"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "IN_PROGRESS"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
        : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50";
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>
      {statusLabel(status)}
    </span>
  );
}

function Flag({ isoCode }: { isoCode: string }) {
  return (
    <span aria-hidden className="mr-1">
      {flagEmoji(isoCode)}
    </span>
  );
}

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) return null; // layout guarantees a user; satisfy types

  const [players, leaderboard, nextMatch] = await Promise.all([
    getPlayers(),
    getLeaderboard(),
    getNextMatchForViewer(user.id),
  ]);

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hi {user.displayName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/60 dark:text-white/60">
            <span className="flex items-center gap-1">
              Groups <StatusChip status={user.groupStatus} />
            </span>
            <span className="flex items-center gap-1">
              Knockout <StatusChip status={user.knockoutStatus} />
            </span>
            <span className="flex items-center gap-1">
              Awards <StatusChip status={user.awardsStatus} />
            </span>
          </div>
        </div>
        <form action={logoutAction}>
          <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
            Log out
          </button>
        </form>
      </header>

      <div className="mb-5 flex flex-wrap gap-2">
        <Link
          href="/groups"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Group predictions
        </Link>
        <Link
          href="/knockout"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Knockout bracket
        </Link>
        <Link
          href="/awards"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Awards
        </Link>
      </div>

      {/* Next match */}
      <section className="mb-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Next match
        </h2>
        {nextMatch ? (
          <>
            <div className="flex items-center justify-between text-xs text-black/50 dark:text-white/50">
              <span>{nextMatch.label}</span>
              <span>
                {nextMatch.kickoffAt
                  ? nextMatch.kickoffAt.toLocaleString()
                  : "Schedule TBD"}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-center gap-3 text-lg font-medium">
              <span>
                <Flag isoCode={nextMatch.home.isoCode} />
                {nextMatch.home.name}
              </span>
              <span className="text-black/30">vs</span>
              <span>
                <Flag isoCode={nextMatch.away.isoCode} />
                {nextMatch.away.name}
              </span>
            </div>

            <div className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
              {nextMatch.picksVisible ? (
                nextMatch.picks && nextMatch.picks.length > 0 ? (
                  <ul className="space-y-1 text-sm">
                    {nextMatch.picks.map((p) => (
                      <li key={p.displayName} className="text-center">
                        <span className="text-black/60 dark:text-white/60">
                          {p.displayName}
                        </span>
                        <div className="font-medium">{p.text}</div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-black/50 dark:text-white/50">
                    No submitted predictions for this match yet.
                  </p>
                )
              ) : (
                <p className="text-sm text-black/50 dark:text-white/50">
                  Submit your{" "}
                  {nextMatch.phase === "group" ? "group" : "knockout"}{" "}
                  predictions to see what everyone picked.
                </p>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-black/50 dark:text-white/50">
            No upcoming matches to show yet.
          </p>
        )}
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
              className="flex items-center justify-between rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
            >
              <div>
                <div className="font-medium">
                  {p.displayName}
                  {p.id === user.id ? (
                    <span className="ml-1 text-xs text-black/40">(you)</span>
                  ) : null}
                </div>
                <div className="mt-1 flex gap-2 text-xs text-black/50 dark:text-white/50">
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
              </div>
              {p.id !== user.id ? (
                <Link
                  href={`/players/${p.id}`}
                  className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
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
