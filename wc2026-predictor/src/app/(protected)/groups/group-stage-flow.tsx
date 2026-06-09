"use client";

import { useState, useTransition } from "react";
import {
  saveMatchPredictionAction,
  lockGroupsAction,
} from "@/lib/predictions-actions";
import type {
  GroupStageState,
  GroupView,
  MatchView,
} from "@/lib/predictions-types";
import type { GroupStanding } from "@/lib/engine/types";
import type { ThirdPlaceEntry } from "@/lib/engine/rankThirdPlaceTeams";

const MATCHES_PER_GROUP = 6;

/** Index of the first match without a prediction, or 0 if all are predicted. */
function firstUnpredictedIndex(group: GroupView): number {
  const idx = group.matches.findIndex((m) => m.prediction === null);
  return idx === -1 ? 0 : idx;
}

interface InitialNav {
  activeLetter: string;
  matchIndex: number;
  showStandings: boolean;
  reviewing: boolean;
}

function computeInitialNav(state: GroupStageState): InitialNav {
  if (state.allComplete) {
    return { activeLetter: "A", matchIndex: 0, showStandings: false, reviewing: true };
  }
  const target =
    state.groups.find((g) => g.unlocked && !g.complete) ?? state.groups[0];
  return {
    activeLetter: target.letter,
    matchIndex: firstUnpredictedIndex(target),
    showStandings: false,
    reviewing: false,
  };
}

export function GroupStageFlow({
  initialState,
}: {
  initialState: GroupStageState;
}) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialNav = computeInitialNav(initialState);
  const [activeLetter, setActiveLetter] = useState(initialNav.activeLetter);
  const [matchIndex, setMatchIndex] = useState(initialNav.matchIndex);
  const [showStandings, setShowStandings] = useState(initialNav.showStandings);
  const [reviewing, setReviewing] = useState(initialNav.reviewing);
  const [confirmingLock, setConfirmingLock] = useState(false);

  const activeGroup =
    state.groups.find((g) => g.letter === activeLetter) ?? state.groups[0];

  function openGroup(letter: string) {
    const group = state.groups.find((g) => g.letter === letter);
    if (!group || !group.unlocked) return;
    setReviewing(false);
    setError(null);
    setActiveLetter(letter);
    if (group.complete) {
      setShowStandings(true);
      setMatchIndex(0);
    } else {
      setShowStandings(false);
      setMatchIndex(firstUnpredictedIndex(group));
    }
  }

  function handleSaveCurrent(homeGoals: number, awayGoals: number) {
    const match = activeGroup.matches[matchIndex];
    startTransition(async () => {
      const res = await saveMatchPredictionAction(
        match.fixtureId,
        homeGoals,
        awayGoals,
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setState(res.state);
      if (matchIndex < MATCHES_PER_GROUP - 1) {
        setMatchIndex(matchIndex + 1);
      } else {
        setShowStandings(true);
      }
    });
  }

  function continueFromStandings() {
    const idx = state.groups.findIndex((g) => g.letter === activeLetter);
    const next = state.groups[idx + 1];
    if (next && next.unlocked) {
      openGroup(next.letter);
    } else {
      setReviewing(true);
    }
  }

  function handleLock() {
    startTransition(async () => {
      const res = await lockGroupsAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setState(res.state);
      setConfirmingLock(false);
    });
  }

  if (state.groupsLocked) {
    return <LockedView state={state} />;
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <h1 className="text-xl font-semibold">Group stage predictions</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Predict every scoreline. Groups unlock one at a time, A through L.
        </p>
      </header>

      <GroupNav
        state={state}
        activeLetter={activeLetter}
        onPick={openGroup}
      />

      {state.allComplete && !reviewing ? (
        <button
          onClick={() => setReviewing(true)}
          className="mt-3 w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          All 12 groups done. Review and lock.
        </button>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        {reviewing ? (
          <ReviewScreen
            state={state}
            pending={pending}
            confirmingLock={confirmingLock}
            onStartLock={() => setConfirmingLock(true)}
            onCancelLock={() => setConfirmingLock(false)}
            onConfirmLock={handleLock}
            onEditGroup={openGroup}
          />
        ) : showStandings && activeGroup.standings ? (
          <StandingsPanel
            group={activeGroup}
            teamNames={state.teamNames}
            isLastGroup={activeLetter === state.groups[state.groups.length - 1].letter}
            allComplete={state.allComplete}
            onEdit={() => {
              setShowStandings(false);
              setMatchIndex(0);
            }}
            onContinue={continueFromStandings}
          />
        ) : (
          <MatchCard
            key={activeGroup.matches[matchIndex].fixtureId}
            group={activeGroup}
            match={activeGroup.matches[matchIndex]}
            index={matchIndex}
            pending={pending}
            onSave={handleSaveCurrent}
            onPrev={matchIndex > 0 ? () => setMatchIndex(matchIndex - 1) : undefined}
            onNext={
              matchIndex < MATCHES_PER_GROUP - 1
                ? () => setMatchIndex(matchIndex + 1)
                : undefined
            }
            onSeeStandings={
              activeGroup.complete ? () => setShowStandings(true) : undefined
            }
          />
        )}
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Group navigation (A-L progress)
// ---------------------------------------------------------------------------

function GroupNav({
  state,
  activeLetter,
  onPick,
}: {
  state: GroupStageState;
  activeLetter: string;
  onPick: (letter: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {state.groups.map((g) => {
        const isActive = g.letter === activeLetter;
        const base =
          "h-11 w-11 rounded-lg text-sm font-medium flex items-center justify-center border transition";
        let style: string;
        if (!g.unlocked) {
          style =
            "border-black/10 text-black/30 cursor-not-allowed dark:border-white/10 dark:text-white/30";
        } else if (g.complete) {
          style = "border-emerald-600 bg-emerald-600 text-white";
        } else if (g.predictedCount > 0) {
          style = "border-amber-500 text-amber-700 dark:text-amber-300";
        } else {
          style = "border-black/20 text-black/70 dark:border-white/20 dark:text-white/70";
        }
        const ring = isActive ? " ring-2 ring-blue-500 ring-offset-1" : "";
        return (
          <button
            key={g.letter}
            disabled={!g.unlocked}
            onClick={() => onPick(g.letter)}
            className={base + " " + style + ring}
            title={
              g.unlocked
                ? `Group ${g.letter} (${g.predictedCount}/6)`
                : `Group ${g.letter} locked`
            }
          >
            {g.letter}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Single match card
// ---------------------------------------------------------------------------

function MatchCard({
  group,
  match,
  index,
  pending,
  onSave,
  onPrev,
  onNext,
  onSeeStandings,
}: {
  group: GroupView;
  match: MatchView;
  index: number;
  pending: boolean;
  onSave: (homeGoals: number, awayGoals: number) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onSeeStandings?: () => void;
}) {
  const [home, setHome] = useState(
    match.prediction ? String(match.prediction.homeGoals) : "",
  );
  const [away, setAway] = useState(
    match.prediction ? String(match.prediction.awayGoals) : "",
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const h = Number(home);
    const a = Number(away);
    if (
      home === "" ||
      away === "" ||
      !Number.isInteger(h) ||
      !Number.isInteger(a) ||
      h < 0 ||
      a < 0
    ) {
      setLocalError("Enter a score of 0 or more for both teams.");
      return;
    }
    setLocalError(null);
    onSave(h, a);
  }

  const isLast = index === MATCHES_PER_GROUP - 1;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between text-sm text-black/60 dark:text-white/60">
        <span className="font-medium">Group {group.letter}</span>
        <span>
          Match {index + 1} of {MATCHES_PER_GROUP}
        </span>
      </div>

      <form onSubmit={submit}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 text-right font-medium">{match.home.name}</div>
          <input
            aria-label={`${match.home.name} goals`}
            type="number"
            inputMode="numeric"
            min={0}
            value={home}
            onChange={(e) => setHome(e.target.value)}
            className="w-14 rounded-lg border border-black/15 bg-transparent px-2 py-2 text-center text-lg outline-none focus:border-blue-500 dark:border-white/20"
          />
          <span className="text-black/40">v</span>
          <input
            aria-label={`${match.away.name} goals`}
            type="number"
            inputMode="numeric"
            min={0}
            value={away}
            onChange={(e) => setAway(e.target.value)}
            className="w-14 rounded-lg border border-black/15 bg-transparent px-2 py-2 text-center text-lg outline-none focus:border-blue-500 dark:border-white/20"
          />
          <div className="flex-1 font-medium">{match.away.name}</div>
        </div>

        {localError ? (
          <p className="mt-3 text-sm text-red-600">{localError}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 w-full rounded-lg bg-blue-600 px-3 py-2 font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
        >
          {pending
            ? "Saving..."
            : isLast
              ? "Save and see standings"
              : "Save and next"}
        </button>
      </form>

      <div className="mt-2 flex items-center justify-between text-sm">
        <button
          onClick={onPrev}
          disabled={!onPrev}
          className="px-2 py-2 text-blue-600 disabled:text-black/25 dark:disabled:text-white/25"
        >
          &larr; Previous
        </button>
        {onSeeStandings ? (
          <button onClick={onSeeStandings} className="px-2 py-2 text-blue-600">
            See standings
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={onNext}
          disabled={!onNext}
          className="px-2 py-2 text-blue-600 disabled:text-black/25 dark:disabled:text-white/25"
        >
          Next &rarr;
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Per-group standings panel
// ---------------------------------------------------------------------------

function StandingsPanel({
  group,
  teamNames,
  isLastGroup,
  allComplete,
  onEdit,
  onContinue,
}: {
  group: GroupView;
  teamNames: Record<string, string>;
  isLastGroup: boolean;
  allComplete: boolean;
  onEdit: () => void;
  onContinue: () => void;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <h2 className="mb-1 text-lg font-semibold">Group {group.letter} table</h2>
      <p className="mb-4 text-sm text-black/60 dark:text-white/60">
        Based on your predicted scores. Top two qualify directly.
      </p>

      <StandingsTable standings={group.standings ?? []} teamNames={teamNames} />

      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        <button
          onClick={onEdit}
          className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Edit this group
        </button>
        <button
          onClick={onContinue}
          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {isLastGroup || allComplete
            ? "Review all groups"
            : `Confirm and continue to Group ${nextLetter(group.letter)}`}
        </button>
      </div>
    </div>
  );
}

function nextLetter(letter: string): string {
  return String.fromCharCode(letter.charCodeAt(0) + 1);
}

// ---------------------------------------------------------------------------
// Standings table (shared)
// ---------------------------------------------------------------------------

function StandingsTable({
  standings,
  teamNames,
  compact = false,
}: {
  standings: GroupStanding[];
  teamNames: Record<string, string>;
  compact?: boolean;
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-black/50 dark:text-white/50">
          <th className="py-1 font-medium">#</th>
          <th className="py-1 font-medium">Team</th>
          <th className="py-1 text-center font-medium">Pld</th>
          <th className="py-1 text-center font-medium">Pts</th>
          <th className="py-1 text-center font-medium">GD</th>
          <th className="py-1 text-center font-medium">GF</th>
        </tr>
      </thead>
      <tbody>
        {standings.map((row, i) => {
          const qualifies = i < 2; // top two qualify directly
          return (
            <tr
              key={row.teamId}
              className={
                "border-t border-black/5 dark:border-white/10 " +
                (qualifies ? "font-medium" : "")
              }
            >
              <td className="py-1.5">
                <span
                  className={
                    qualifies
                      ? "inline-block h-2 w-2 rounded-full bg-emerald-500"
                      : i === 2
                        ? "inline-block h-2 w-2 rounded-full bg-amber-400"
                        : "inline-block h-2 w-2 rounded-full bg-transparent"
                  }
                />{" "}
                {i + 1}
              </td>
              <td className="py-1.5">
                {teamNames[row.teamId] ?? row.teamId}
              </td>
              <td className="py-1.5 text-center">{row.played}</td>
              <td className="py-1.5 text-center font-semibold">{row.points}</td>
              <td className="py-1.5 text-center">
                {row.goalDifference > 0 ? "+" : ""}
                {row.goalDifference}
              </td>
              <td className="py-1.5 text-center">{row.goalsFor}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// All-groups review + lock
// ---------------------------------------------------------------------------

function ReviewScreen({
  state,
  pending,
  confirmingLock,
  onStartLock,
  onCancelLock,
  onConfirmLock,
  onEditGroup,
}: {
  state: GroupStageState;
  pending: boolean;
  confirmingLock: boolean;
  onStartLock: () => void;
  onCancelLock: () => void;
  onConfirmLock: () => void;
  onEditGroup: (letter: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">All groups</h2>
        <p className="text-sm text-black/60 dark:text-white/60">
          Tap any group to jump back and change it.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.groups.map((g) => (
          <button
            key={g.letter}
            onClick={() => onEditGroup(g.letter)}
            className="rounded-xl border border-black/10 bg-white p-3 text-left shadow-sm transition hover:border-blue-400 dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="mb-1 text-sm font-semibold">Group {g.letter}</div>
            <StandingsTable
              standings={g.standings ?? []}
              teamNames={state.teamNames}
              compact
            />
          </button>
        ))}
      </div>

      {state.thirdPlaceRanking ? (
        <ThirdPlaceRanking
          ranking={state.thirdPlaceRanking}
          teamNames={state.teamNames}
        />
      ) : null}

      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-950/40">
        <h3 className="font-semibold">Lock your group predictions</h3>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">
          This freezes all 12 group tables and opens the knockout stage. You will
          not be able to edit groups afterwards.
        </p>
        {confirmingLock ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button
              onClick={onCancelLock}
              disabled={pending}
              className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmLock}
              disabled={pending}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? "Locking..." : "Yes, lock my groups"}
            </button>
          </div>
        ) : (
          <button
            onClick={onStartLock}
            className="mt-4 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
          >
            Lock groups
          </button>
        )}
      </div>
    </div>
  );
}

function ThirdPlaceRanking({
  ranking,
  teamNames,
}: {
  ranking: ThirdPlaceEntry[];
  teamNames: Record<string, string>;
}) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <h3 className="mb-1 font-semibold">Third-placed teams</h3>
      <p className="mb-3 text-sm text-black/60 dark:text-white/60">
        The best 8 of 12 advance (highlighted).
      </p>
      <ol className="space-y-1">
        {ranking.map((entry) => (
          <li
            key={entry.standing.teamId}
            className={
              "flex items-center justify-between rounded-lg px-3 py-1.5 text-sm " +
              (entry.qualified
                ? "bg-emerald-50 dark:bg-emerald-950/40"
                : "opacity-60")
            }
          >
            <span>
              <span className="inline-block w-6 text-black/50 dark:text-white/50">
                {entry.rank}.
              </span>
              {teamNames[entry.standing.teamId] ?? entry.standing.teamId}
              <span className="ml-2 text-black/40 dark:text-white/40">
                (Group {entry.group})
              </span>
            </span>
            <span className="flex items-center gap-3 text-black/60 dark:text-white/60">
              <span>{entry.standing.points} pts</span>
              {entry.qualified ? (
                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
                  Q
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Locked placeholder
// ---------------------------------------------------------------------------

function LockedView({ state }: { state: GroupStageState }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="mb-5 rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700/50 dark:bg-emerald-950/40">
        <h1 className="text-xl font-semibold">Your groups are locked</h1>
        <p className="mt-1 text-sm text-black/70 dark:text-white/70">
          Group predictions are now fixed. Knockout predictions open separately
          once the real group stage finishes.
        </p>
        <a
          href="/knockout"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Go to knockout predictions
        </a>
      </div>

      <h2 className="mb-3 text-lg font-semibold">Your final group tables</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {state.groups.map((g) => (
          <div
            key={g.letter}
            className="rounded-xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900"
          >
            <div className="mb-1 text-sm font-semibold">Group {g.letter}</div>
            <StandingsTable
              standings={g.standings ?? []}
              teamNames={state.teamNames}
              compact
            />
          </div>
        ))}
      </div>

      {state.thirdPlaceRanking ? (
        <div className="mt-5">
          <ThirdPlaceRanking
            ranking={state.thirdPlaceRanking}
            teamNames={state.teamNames}
          />
        </div>
      ) : null}
    </main>
  );
}
