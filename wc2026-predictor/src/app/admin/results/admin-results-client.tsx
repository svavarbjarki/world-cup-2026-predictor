"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import {
  saveGroupResultAction,
  saveKnockoutResultAction,
  logoutAdminAction,
} from "@/lib/admin-actions";
import { flagEmoji } from "@/lib/data/teams";
import type { KnockoutBracketState } from "@/lib/predictions-types";
import type {
  GoalEventInput,
  GoalEventView,
  GoalSide,
  PlayerOption,
} from "@/lib/goal-events";

interface GoalFixtureTeam {
  id: string;
  name: string;
  isoCode: string;
}

interface GroupFixtureRow {
  id: string;
  matchNumber: number;
  group: string;
  matchday: number;
  kickoffLabel: string | null;
  home: GoalFixtureTeam;
  away: GoalFixtureTeam;
  result: { homeGoals: number; awayGoals: number } | null;
  goals: GoalEventView[];
}

interface KnockoutStored {
  homeGoals: number | null;
  awayGoals: number | null;
  goals: GoalEventView[];
}

function Flag({ isoCode }: { isoCode: string }) {
  return <span aria-hidden>{flagEmoji(isoCode)}</span>;
}

// ---------------------------------------------------------------------------
// Goal-event editing (shared by group and knockout entry)
// ---------------------------------------------------------------------------

function emptyGoal(side: GoalSide): GoalEventInput {
  return { side, scorerId: null, assisterId: null, minute: null };
}

// Resize the goal rows to match the scoreline, preserving existing entries.
function reconcileGoals(
  goals: GoalEventInput[],
  homeGoals: number,
  awayGoals: number,
): GoalEventInput[] {
  const home = goals.filter((g) => g.side === "home").slice(0, homeGoals);
  while (home.length < homeGoals) home.push(emptyGoal("home"));
  const away = goals.filter((g) => g.side === "away").slice(0, awayGoals);
  while (away.length < awayGoals) away.push(emptyGoal("away"));
  return [...home, ...away];
}

function toInputs(views: GoalEventView[]): GoalEventInput[] {
  return views.map((g) => ({
    side: g.side,
    scorerId: g.scorerId,
    assisterId: g.assisterId,
    minute: g.minute,
  }));
}

function PlayerSelect({
  label,
  players,
  value,
  excludeId,
  onChange,
}: {
  label: string;
  players: PlayerOption[];
  value: string | null;
  excludeId?: string | null;
  onChange: (v: string | null) => void;
}) {
  const options = excludeId ? players.filter((p) => p.id !== excludeId) : players;
  return (
    <select
      aria-label={label}
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || null)}
      className="min-w-0 flex-1 rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 dark:border-white/20"
    >
      <option value="">{label}</option>
      {options.map((p) => (
        <option key={p.id} value={p.id}>
          {p.number != null ? `${p.number}. ${p.name}` : p.name}
        </option>
      ))}
    </select>
  );
}

function GoalEventEditor({
  goals,
  onChange,
  home,
  away,
  playersByTeam,
}: {
  goals: GoalEventInput[];
  onChange: (next: GoalEventInput[]) => void;
  home: { teamId: string; name: string };
  away: { teamId: string; name: string };
  playersByTeam: Record<string, PlayerOption[]>;
}) {
  if (goals.length === 0) return null;

  function update(index: number, patch: Partial<GoalEventInput>) {
    onChange(goals.map((g, i) => (i === index ? { ...g, ...patch } : g)));
  }

  return (
    <div className="mt-3 space-y-3 border-t border-black/5 pt-3 dark:border-white/10">
      {(["home", "away"] as const).map((side) => {
        const rows = goals
          .map((g, i) => ({ g, i }))
          .filter((x) => x.g.side === side);
        if (rows.length === 0) return null;
        const team = side === "home" ? home : away;
        const players = playersByTeam[team.teamId] ?? [];
        return (
          <div key={side}>
            <div className="mb-1 text-xs font-semibold text-black/45 dark:text-white/45">
              {team.name} goals
            </div>
            <div className="space-y-2">
              {rows.map(({ g, i }) => (
                <div key={i} className="flex items-center gap-2">
                  <PlayerSelect
                    label="Scorer"
                    players={players}
                    value={g.scorerId}
                    onChange={(v) =>
                      update(i, {
                        scorerId: v,
                        assisterId: v && v === g.assisterId ? null : g.assisterId,
                      })
                    }
                  />
                  <PlayerSelect
                    label="Assist (optional)"
                    players={players}
                    value={g.assisterId}
                    excludeId={g.scorerId}
                    onChange={(v) => update(i, { assisterId: v })}
                  />
                  <input
                    aria-label="Minute"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={130}
                    placeholder="min"
                    value={g.minute ?? ""}
                    onChange={(e) =>
                      update(i, {
                        minute: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    className="w-14 shrink-0 rounded-lg border border-black/15 bg-transparent px-1 py-1.5 text-center text-sm outline-none focus:border-blue-500 dark:border-white/20"
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AdminResults({
  groupFixtures,
  knockoutState,
  teamFlags,
  playersByTeam,
  knockoutData,
}: {
  groupFixtures: GroupFixtureRow[];
  knockoutState: KnockoutBracketState | null;
  teamFlags: Record<string, string>;
  playersByTeam: Record<string, PlayerOption[]>;
  knockoutData: Record<number, KnockoutStored>;
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
                  playersByTeam={playersByTeam}
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
          <KnockoutResults
            initial={knockoutState}
            teamFlags={teamFlags}
            playersByTeam={playersByTeam}
            knockoutData={knockoutData}
          />
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
  playersByTeam,
  onSaved,
}: {
  fixture: GroupFixtureRow;
  saved: { homeGoals: number; awayGoals: number } | null;
  playersByTeam: Record<string, PlayerOption[]>;
  onSaved: (r: { homeGoals: number; awayGoals: number }) => void;
}) {
  const [home, setHome] = useState(saved ? String(saved.homeGoals) : "");
  const [away, setAway] = useState(saved ? String(saved.awayGoals) : "");
  const [goals, setGoals] = useState<GoalEventInput[]>(() =>
    toInputs(fixture.goals),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hg = Number(home);
  const ag = Number(away);
  const scoreValid =
    home !== "" &&
    away !== "" &&
    Number.isInteger(hg) &&
    Number.isInteger(ag) &&
    hg >= 0 &&
    ag >= 0;

  // Keep the goal rows in step with the score as it is typed.
  useEffect(() => {
    if (!scoreValid) return;
    setGoals((prev) => reconcileGoals(prev, hg, ag));
  }, [hg, ag, scoreValid]);

  function save() {
    if (!scoreValid) {
      setError("Enter a score of 0 or more for both teams.");
      return;
    }
    startTransition(async () => {
      const res = await saveGroupResultAction(fixture.id, hg, ag, goals);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      onSaved({ homeGoals: hg, awayGoals: ag });
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

      <GoalEventEditor
        goals={goals}
        onChange={setGoals}
        home={{ teamId: fixture.home.id, name: fixture.home.name }}
        away={{ teamId: fixture.away.id, name: fixture.away.name }}
        playersByTeam={playersByTeam}
      />

      <button
        onClick={save}
        disabled={pending}
        className="mt-3 w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-[#0b0b0e] hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
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
  playersByTeam,
  knockoutData,
}: {
  initial: KnockoutBracketState;
  teamFlags: Record<string, string>;
  playersByTeam: Record<string, PlayerOption[]>;
  knockoutData: Record<number, KnockoutStored>;
}) {
  const [state, setState] = useState(initial);

  return (
    <div className="space-y-4">
      {state.championName ? (
        <div className="rounded-xl border border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 p-3 text-center text-amber-900 dark:border-amber-500/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:text-amber-100">
          <div className="text-xs opacity-70">Champion</div>
          <div className="text-lg font-bold">{state.championName}</div>
        </div>
      ) : null}
      {state.rounds.map((round) => (
        <div key={round.name}>
          <h3 className="mb-1 text-sm font-semibold">{round.label}</h3>
          <div className="space-y-2">
            {round.matches.map((m) => {
              const determined =
                m.teamA.teamId !== null && m.teamB.teamId !== null;
              if (!determined) {
                return (
                  <div
                    key={m.matchNumber}
                    className="rounded-lg border border-dashed border-black/10 p-2 text-xs text-black/40 dark:border-white/10 dark:text-white/40"
                  >
                    {m.teamA.label} vs {m.teamB.label} (enter earlier results first)
                  </div>
                );
              }
              const stored = knockoutData[m.matchNumber];
              return (
                <KnockoutMatchEditor
                  // Remount when the matchup changes so a winner edit upstream
                  // resets this match's local form.
                  key={`${m.matchNumber}-${m.teamA.teamId}-${m.teamB.teamId}`}
                  match={m}
                  teamFlags={teamFlags}
                  playersByTeam={playersByTeam}
                  stored={stored}
                  onSaved={setState}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function KnockoutMatchEditor({
  match,
  teamFlags,
  playersByTeam,
  stored,
  onSaved,
}: {
  match: KnockoutBracketState["rounds"][number]["matches"][number];
  teamFlags: Record<string, string>;
  playersByTeam: Record<string, PlayerOption[]>;
  stored: KnockoutStored | undefined;
  onSaved: (state: KnockoutBracketState) => void;
}) {
  const teamAId = match.teamA.teamId as string;
  const teamBId = match.teamB.teamId as string;
  const [winner, setWinner] = useState<string | null>(match.pick);
  const [home, setHome] = useState(
    stored?.homeGoals != null ? String(stored.homeGoals) : "",
  );
  const [away, setAway] = useState(
    stored?.awayGoals != null ? String(stored.awayGoals) : "",
  );
  const [goals, setGoals] = useState<GoalEventInput[]>(() =>
    toInputs(stored?.goals ?? []),
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const hasScore = home !== "" && away !== "";
  const hg = Number(home);
  const ag = Number(away);
  const scoreValid =
    hasScore && Number.isInteger(hg) && Number.isInteger(ag) && hg >= 0 && ag >= 0;

  useEffect(() => {
    if (!scoreValid) return;
    setGoals((prev) => reconcileGoals(prev, hg, ag));
  }, [hg, ag, scoreValid]);

  function save() {
    if (!winner) {
      setError("Pick the winner.");
      return;
    }
    if (hasScore && !scoreValid) {
      setError("Enter whole numbers for the score.");
      return;
    }
    const score = scoreValid ? { homeGoals: hg, awayGoals: ag } : null;
    startTransition(async () => {
      const res = await saveKnockoutResultAction(
        match.matchNumber,
        winner,
        score,
        score ? goals : [],
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      onSaved(res.state);
    });
  }

  const sides: { id: string; view: typeof match.teamA }[] = [
    { id: teamAId, view: match.teamA },
    { id: teamBId, view: match.teamB },
  ];

  return (
    <div className="rounded-lg border border-black/10 p-2.5 dark:border-white/10">
      <div className="flex flex-wrap items-center gap-2">
        {sides.map(({ id, view }) => {
          const selected = winner === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setWinner(id)}
              className={
                "rounded px-2 py-1 text-left text-sm transition " +
                (selected
                  ? "bg-emerald-100 font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                  : "hover:bg-black/5 dark:hover:bg-white/10")
              }
            >
              <Flag isoCode={teamFlags[id] ?? ""} /> {view.teamName}
              {selected ? " ✓" : ""}
            </button>
          );
        })}
        <span className="ml-auto flex items-center gap-1 text-xs text-black/40 dark:text-white/40">
          <input
            aria-label={`${match.teamA.teamName} goals`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="-"
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="w-10 rounded border border-black/15 bg-transparent px-1 py-1 text-center outline-none focus:border-blue-500 dark:border-white/20"
          />
          <span>-</span>
          <input
            aria-label={`${match.teamB.teamName} goals`}
            type="number"
            inputMode="numeric"
            min={0}
            placeholder="-"
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="w-10 rounded border border-black/15 bg-transparent px-1 py-1 text-center outline-none focus:border-blue-500 dark:border-white/20"
          />
        </span>
      </div>

      <GoalEventEditor
        goals={goals}
        onChange={setGoals}
        home={{ teamId: teamAId, name: match.teamA.teamName ?? "Home" }}
        away={{ teamId: teamBId, name: match.teamB.teamName ?? "Away" }}
        playersByTeam={playersByTeam}
      />

      <button
        onClick={save}
        disabled={pending}
        className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-[#0b0b0e] hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Saving..." : "Save"}
      </button>
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
