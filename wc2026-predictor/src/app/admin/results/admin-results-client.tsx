"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  saveGroupResultAction,
  saveKnockoutResultAction,
  logoutAdminAction,
} from "@/lib/admin-actions";
import { flagEmoji } from "@/lib/data/teams";
import type { KnockoutBracketState } from "@/lib/predictions-types";

interface GroupFixtureRow {
  id: string;
  matchNumber: number;
  group: string;
  matchday: number;
  kickoffLabel: string | null;
  home: { id: string; name: string; isoCode: string };
  away: { id: string; name: string; isoCode: string };
  result: { homeGoals: number; awayGoals: number } | null;
}

function Flag({ isoCode }: { isoCode: string }) {
  return <span aria-hidden>{flagEmoji(isoCode)}</span>;
}

export function AdminResults({
  groupFixtures,
  knockoutState,
  teamFlags,
}: {
  groupFixtures: GroupFixtureRow[];
  knockoutState: KnockoutBracketState | null;
  teamFlags: Record<string, string>;
}) {
  // Track entered results in parent state so the summary and filter stay live.
  const [results, setResults] = useState<
    Record<string, { homeGoals: number; awayGoals: number }>
  >(() => {
    const init: Record<string, { homeGoals: number; awayGoals: number }> = {};
    for (const f of groupFixtures) if (f.result) init[f.id] = f.result;
    return init;
  });
  const [needsOnly, setNeedsOnly] = useState(false);

  const entered = Object.keys(results).length;

  const visible = needsOnly
    ? groupFixtures.filter((f) => !results[f.id])
    : groupFixtures;

  // Group the (already ordered) fixtures by letter for display.
  const byGroup = new Map<string, GroupFixtureRow[]>();
  for (const f of visible) {
    const list = byGroup.get(f.group) ?? [];
    list.push(f);
    byGroup.set(f.group, list);
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Enter results</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {entered} of {groupFixtures.length} group results in.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin"
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Dashboard
          </Link>
          <form action={logoutAdminAction}>
            <button className="rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10">
              Log out
            </button>
          </form>
        </div>
      </header>

      {/* Group results */}
      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
            Group results
          </h2>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="checkbox"
              checked={needsOnly}
              onChange={(e) => setNeedsOnly(e.target.checked)}
            />
            Needs result only
          </label>
        </div>

        {[...byGroup.entries()].map(([letter, rows]) => (
          <div key={letter} className="mb-4">
            <div className="mb-1 text-xs font-semibold text-black/40 dark:text-white/40">
              Group {letter}
            </div>
            <div className="space-y-2">
              {rows.map((f) => (
                <GroupResultRow
                  key={f.id}
                  fixture={f}
                  saved={results[f.id] ?? null}
                  onSaved={(r) =>
                    setResults((prev) => ({ ...prev, [f.id]: r }))
                  }
                />
              ))}
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <p className="text-sm text-black/50 dark:text-white/50">
            All group results are in.
          </p>
        ) : null}
      </section>

      {/* Knockout results */}
      <section>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
          Knockout results
        </h2>
        {knockoutState ? (
          <KnockoutResults initial={knockoutState} teamFlags={teamFlags} />
        ) : (
          <p className="rounded-xl border border-dashed border-black/15 bg-black/[0.02] p-4 text-sm text-black/60 dark:border-white/15 dark:bg-white/[0.02] dark:text-white/60">
            Open the knockout phase and enter the Round of 32 on the R32 setup
            page first. Then real knockout results can be entered here.
          </p>
        )}
      </section>
    </main>
  );
}

function GroupResultRow({
  fixture,
  saved,
  onSaved,
}: {
  fixture: GroupFixtureRow;
  saved: { homeGoals: number; awayGoals: number } | null;
  onSaved: (r: { homeGoals: number; awayGoals: number }) => void;
}) {
  const [home, setHome] = useState(saved ? String(saved.homeGoals) : "");
  const [away, setAway] = useState(saved ? String(saved.awayGoals) : "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    const h = Number(home);
    const a = Number(away);
    if (home === "" || away === "" || !Number.isInteger(h) || !Number.isInteger(a) || h < 0 || a < 0) {
      setError("Enter a score of 0 or more for both teams.");
      return;
    }
    startTransition(async () => {
      const res = await saveGroupResultAction(fixture.id, h, a);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      onSaved({ homeGoals: h, awayGoals: a });
    });
  }

  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-900">
      <div className="mb-1 flex items-center justify-between text-[11px] text-black/40 dark:text-white/40">
        <span>{fixture.kickoffLabel ?? "Schedule TBD"}</span>
        {saved ? (
          <span className="font-medium text-emerald-600">Result in</span>
        ) : (
          <span>No result</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1 truncate text-right text-sm">
          <Flag isoCode={fixture.home.isoCode} /> {fixture.home.name}
        </div>
        <input
          aria-label={`${fixture.home.name} goals`}
          type="number"
          inputMode="numeric"
          min={0}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          className="w-12 shrink-0 rounded-lg border border-black/15 bg-transparent px-1 py-1.5 text-center outline-none focus:border-blue-500 dark:border-white/20"
        />
        <span className="shrink-0 text-black/30">-</span>
        <input
          aria-label={`${fixture.away.name} goals`}
          type="number"
          inputMode="numeric"
          min={0}
          value={away}
          onChange={(e) => setAway(e.target.value)}
          className="w-12 shrink-0 rounded-lg border border-black/15 bg-transparent px-1 py-1.5 text-center outline-none focus:border-blue-500 dark:border-white/20"
        />
        <div className="min-w-0 flex-1 truncate text-sm">
          {fixture.away.name} <Flag isoCode={fixture.away.isoCode} />
        </div>
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-[#0b0b0e] hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
      >
        {pending ? "Saving..." : saved ? "Edit result" : "Save result"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

function KnockoutResults({
  initial,
  teamFlags,
}: {
  initial: KnockoutBracketState;
  teamFlags: Record<string, string>;
}) {
  const [state, setState] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function setWinner(matchNumber: number, teamId: string) {
    startTransition(async () => {
      const res = await saveKnockoutResultAction(matchNumber, teamId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setState(res.state);
    });
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}
      {state.championName ? (
        <div className="rounded-xl border border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 p-3 text-center text-amber-900 dark:border-amber-500/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:text-amber-100">
          <div className="text-xs opacity-70">Champion</div>
          <div className="text-lg font-bold">{state.championName}</div>
        </div>
      ) : null}
      {state.rounds.map((round) => (
        <div key={round.name}>
          <h3 className="mb-1 text-sm font-semibold">{round.label}</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {round.matches.map((m) => {
              const determined =
                m.teamA.teamId !== null && m.teamB.teamId !== null;
              return (
                <div
                  key={m.matchNumber}
                  className="rounded-lg border border-black/10 p-2 dark:border-white/10"
                >
                  {[m.teamA, m.teamB].map((side, idx) => {
                    const isWinner = m.pick !== null && m.pick === side.teamId;
                    const canPick = determined && side.teamId !== null && !pending;
                    return (
                      <button
                        key={idx}
                        disabled={!canPick}
                        onClick={() =>
                          side.teamId && setWinner(m.matchNumber, side.teamId)
                        }
                        className={
                          "flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm transition " +
                          (isWinner
                            ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                            : canPick
                              ? "hover:bg-black/5 dark:hover:bg-white/10"
                              : "text-black/40 dark:text-white/40")
                        }
                      >
                        <span>
                          {side.teamId ? (
                            <>
                              <Flag isoCode={teamFlags[side.teamId] ?? ""} />{" "}
                              {side.teamName}
                            </>
                          ) : (
                            side.label
                          )}
                        </span>
                        {isWinner ? <span aria-hidden>&#10003;</span> : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
