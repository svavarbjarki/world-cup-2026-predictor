import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { getPlayerPredictionsForViewer } from "@/lib/hub";
import { BracketTree } from "../../knockout/bracket-tree";
import type { ResolvedAwardPicks } from "@/lib/awards-server";
import type {
  GroupStageState,
  KnockoutBracketState,
} from "@/lib/predictions-types";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await getCurrentUser();
  if (!viewer) return null;

  const data = await getPlayerPredictionsForViewer(viewer.id, id);

  if (!data.target) {
    return (
      <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
        <BackLink />
        <p className="mt-4 text-sm text-black/60 dark:text-white/60">
          Player not found.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <BackLink />
      <h1 className="mt-2 mb-4 text-xl font-semibold">
        {data.target.displayName}&apos;s predictions
      </h1>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Group stage
        </h2>
        {data.group.allowed && data.group.state ? (
          <GroupTablesReadOnly state={data.group.state} />
        ) : (
          <LockedCard
            message={
              data.group.targetSubmitted
                ? "Submit your own group predictions to see others'."
                : "This player has not submitted their group predictions yet."
            }
          />
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Knockout
        </h2>
        {data.knockout.allowed ? (
          data.knockout.state ? (
            <KnockoutReadOnly state={data.knockout.state} />
          ) : (
            <LockedCard message="The knockout phase is not open yet." />
          )
        ) : (
          <LockedCard
            message={
              data.knockout.targetSubmitted
                ? "Submit your own knockout picks to see others'."
                : "This player has not submitted their knockout picks yet."
            }
          />
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Awards
        </h2>
        {data.awards.allowed && data.awards.picks ? (
          <AwardsReadOnly picks={data.awards.picks} />
        ) : (
          <LockedCard
            message={
              data.awards.targetSubmitted
                ? "Submit your own award picks to see others'."
                : "This player has not submitted their award picks yet."
            }
          />
        )}
      </section>
    </main>
  );
}

function AwardsReadOnly({ picks }: { picks: ResolvedAwardPicks }) {
  const rows: { label: string; value: { label: string; isoCode: string } | null }[] = [
    { label: "The Winner", value: picks.winner },
    { label: "Golden Ball", value: picks.goldenBall },
    { label: "Golden Boot", value: picks.goldenBoot },
    { label: "Golden Glove", value: picks.goldenGlove },
    { label: "Young Player", value: picks.youngPlayer },
  ];
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="border-t border-black/5 first:border-0 dark:border-white/10"
            >
              <td className="py-1.5 text-black/50 dark:text-white/50">
                {r.label}
              </td>
              <td className="py-1.5 text-right font-medium">
                {r.value ? r.value.label : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BackLink() {
  return (
    <Link href="/" className="text-sm text-blue-600">
      &larr; Back to home
    </Link>
  );
}

function LockedCard({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-black/60 dark:border-white/15 dark:bg-white/[0.02] dark:text-white/60">
      {message}
    </div>
  );
}

function GroupTablesReadOnly({ state }: { state: GroupStageState }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {state.groups.map((g) => (
        <div
          key={g.letter}
          className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
        >
          <div className="mb-1 text-sm font-semibold">Group {g.letter}</div>
          {g.standings ? (
            <table className="w-full text-sm">
              <tbody>
                {g.standings.map((row, i) => (
                  <tr
                    key={row.teamId}
                    className="border-t border-black/5 first:border-0 dark:border-white/10"
                  >
                    <td className="py-1 pr-2 text-black/40">{i + 1}</td>
                    <td className="py-1">
                      {state.teamNames[row.teamId] ?? row.teamId}
                    </td>
                    <td className="py-1 text-center font-semibold">
                      {row.points}
                    </td>
                    <td className="py-1 pl-2 text-center text-black/50 dark:text-white/50">
                      {row.goalDifference > 0 ? "+" : ""}
                      {row.goalDifference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-xs text-black/40">Incomplete</p>
          )}
        </div>
      ))}
    </div>
  );
}

function KnockoutReadOnly({ state }: { state: KnockoutBracketState }) {
  return (
    <div className="space-y-4">
      {state.championName ? (
        <div className="rounded-xl border border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 p-3 text-center text-amber-900 dark:border-amber-500/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:text-amber-100">
          <div className="text-xs opacity-70">Champion</div>
          <div className="text-lg font-bold">{state.championName}</div>
        </div>
      ) : null}
      <BracketTree rounds={state.rounds} />
    </div>
  );
}
