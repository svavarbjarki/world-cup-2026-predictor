"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  saveKnockoutPickAction,
  submitFinalAction,
} from "@/lib/predictions-actions";
import type {
  KnockoutBracketState,
  KnockoutMatchView,
} from "@/lib/predictions-types";
import { BracketTree } from "./bracket-tree";

/** All matches across rounds, in official bracket order. */
function allMatches(state: KnockoutBracketState): KnockoutMatchView[] {
  return state.rounds.flatMap((r) => r.matches);
}

/** First match that can be picked but has not been. */
function firstUnpicked(state: KnockoutBracketState): KnockoutMatchView | null {
  return allMatches(state).find((m) => m.determined && m.pick === null) ?? null;
}

export function KnockoutFlow({
  initialState,
}: {
  initialState: KnockoutBracketState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startUnpicked = firstUnpicked(initialState);
  const startReadOnly = initialState.submitted || initialState.lockedByDeadline;
  const [mode, setMode] = useState<"pick" | "review">(
    startReadOnly || !startUnpicked ? "review" : "pick",
  );
  const [focusMatch, setFocusMatch] = useState<number | null>(
    startUnpicked ? startUnpicked.matchNumber : null,
  );
  const [pendingRepick, setPendingRepick] = useState<{
    matchNumber: number;
    teamId: string;
  } | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const matches = allMatches(state);
  const picksMade = matches.filter((m) => m.pick !== null).length;

  const focused =
    mode === "pick"
      ? (matches.find((m) => m.matchNumber === focusMatch) ??
        firstUnpicked(state))
      : null;

  function applyPick(matchNumber: number, teamId: string) {
    startTransition(async () => {
      const res = await saveKnockoutPickAction(matchNumber, teamId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setPendingRepick(null);
      setState(res.state);
      const next = firstUnpicked(res.state);
      if (next) {
        setFocusMatch(next.matchNumber);
      } else {
        setMode("review");
      }
    });
  }

  function choose(match: KnockoutMatchView, teamId: string) {
    if (state.submitted || state.lockedByDeadline) return;
    // Same pick again: just move on.
    if (match.pick === teamId) {
      const next = firstUnpicked(state);
      if (next) setFocusMatch(next.matchNumber);
      else setMode("review");
      return;
    }
    // Changing an existing pick that downstream picks depend on: confirm first.
    if (match.pick !== null) {
      const oldTeam = match.pick;
      const clears = matches.some(
        (m) => m.slot > match.slot && m.pick === oldTeam,
      );
      if (clears) {
        setPendingRepick({ matchNumber: match.matchNumber, teamId });
        return;
      }
    }
    applyPick(match.matchNumber, teamId);
  }

  function openMatch(matchNumber: number) {
    setMode("pick");
    setFocusMatch(matchNumber);
    setPendingRepick(null);
    setError(null);
  }

  function handleSubmit() {
    startTransition(async () => {
      const res = await submitFinalAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setConfirmingSubmit(false);
      // After submitting, send the user back to the front page / dashboard.
      router.push("/");
    });
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <Link href="/" className="text-sm text-blue-600">
        &larr; Back to dashboard
      </Link>
      <header className="mt-2 mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Knockout bracket</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            {state.submitted
              ? "Submitted and locked."
              : state.lockedByDeadline
                ? "Locked (deadline passed)."
                : `${picksMade} of ${matches.length} picks made`}
          </p>
        </div>
        {mode === "pick" ? (
          <button
            onClick={() => setMode("review")}
            className="rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            View bracket
          </button>
        ) : null}
      </header>

      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {mode === "pick" && focused ? (
        <PickCard
          state={state}
          match={focused}
          pending={pending}
          pendingRepick={pendingRepick}
          onChoose={choose}
          onConfirmRepick={() =>
            pendingRepick &&
            applyPick(pendingRepick.matchNumber, pendingRepick.teamId)
          }
          onCancelRepick={() => setPendingRepick(null)}
          onBack={() => setMode("review")}
        />
      ) : (
        <ReviewScreen
          state={state}
          pending={pending}
          confirmingSubmit={confirmingSubmit}
          onOpenMatch={openMatch}
          onStartSubmit={() => setConfirmingSubmit(true)}
          onCancelSubmit={() => setConfirmingSubmit(false)}
          onConfirmSubmit={handleSubmit}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Single pick card
// ---------------------------------------------------------------------------

function PickCard({
  state,
  match,
  pending,
  pendingRepick,
  onChoose,
  onConfirmRepick,
  onCancelRepick,
  onBack,
}: {
  state: KnockoutBracketState;
  match: KnockoutMatchView;
  pending: boolean;
  pendingRepick: { matchNumber: number; teamId: string } | null;
  onChoose: (match: KnockoutMatchView, teamId: string) => void;
  onConfirmRepick: () => void;
  onCancelRepick: () => void;
  onBack: () => void;
}) {
  const round = state.rounds.find((r) => r.name === match.round)!;
  const position = round.matches.findIndex((m) => m.matchNumber === match.matchNumber) + 1;

  const oldTeamName =
    match.pick !== null ? (state.teamNames[match.pick] ?? match.pick) : null;
  const confirming = pendingRepick?.matchNumber === match.matchNumber;

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="mb-4 flex items-center justify-between text-sm text-black/60 dark:text-white/60">
        <span className="font-medium">{round.label}</span>
        <span>
          Match {position} of {round.matches.length}
        </span>
      </div>

      <p className="mb-3 text-center text-sm text-black/50 dark:text-white/50">
        Who goes through?
      </p>

      <div className="flex items-stretch gap-2">
        <TeamPickButton
          name={match.teamA.teamName}
          label={match.teamA.label}
          selected={match.pick === match.teamA.teamId}
          disabled={
            pending ||
            state.submitted ||
            state.lockedByDeadline ||
            match.teamA.teamId === null
          }
          onClick={() =>
            match.teamA.teamId && onChoose(match, match.teamA.teamId)
          }
        />
        <div className="flex shrink-0 items-center text-sm font-medium text-black/40 dark:text-white/40">
          vs
        </div>
        <TeamPickButton
          name={match.teamB.teamName}
          label={match.teamB.label}
          selected={match.pick === match.teamB.teamId}
          disabled={
            pending ||
            state.submitted ||
            state.lockedByDeadline ||
            match.teamB.teamId === null
          }
          onClick={() =>
            match.teamB.teamId && onChoose(match, match.teamB.teamId)
          }
        />
      </div>

      {confirming ? (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700/50 dark:bg-amber-950/40">
          <p>
            Changing this resets your later picks that involved{" "}
            <span className="font-semibold">{oldTeamName}</span>.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onCancelRepick}
              disabled={pending}
              className="flex-1 rounded-lg border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Keep current
            </button>
            <button
              onClick={onConfirmRepick}
              disabled={pending}
              className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              Change it
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 text-center">
        <button onClick={onBack} className="text-sm text-blue-600">
          Back to bracket
        </button>
      </div>
    </div>
  );
}

function TeamPickButton({
  name,
  label,
  selected,
  disabled,
  onClick,
}: {
  name: string | null;
  label: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "min-w-0 flex-1 rounded-xl border p-4 text-center transition " +
        (selected
          ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40"
          : "border-black/15 hover:border-blue-400 dark:border-white/20") +
        (disabled && !selected ? " opacity-60" : "")
      }
    >
      <div className="text-base font-semibold">{name ?? "To be decided"}</div>
      <div className="text-xs text-black/50 dark:text-white/50">{label}</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Review + final submit
// ---------------------------------------------------------------------------

function ReviewScreen({
  state,
  pending,
  confirmingSubmit,
  onOpenMatch,
  onStartSubmit,
  onCancelSubmit,
  onConfirmSubmit,
}: {
  state: KnockoutBracketState;
  pending: boolean;
  confirmingSubmit: boolean;
  onOpenMatch: (matchNumber: number) => void;
  onStartSubmit: () => void;
  onCancelSubmit: () => void;
  onConfirmSubmit: () => void;
}) {
  return (
    <div className="space-y-5">
      {state.submitted ? (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-5 dark:border-emerald-700/50 dark:bg-emerald-950/40">
          <h2 className="font-semibold">Your knockout picks are submitted</h2>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            Your bracket is locked. You can now see others&apos; knockout picks
            once that screen is available.
          </p>
        </div>
      ) : state.lockedByDeadline ? (
        <div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-5 dark:border-neutral-700/50 dark:bg-neutral-900">
          <h2 className="font-semibold">Knockout predictions are closed</h2>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            The deadline has passed, so your bracket can no longer be changed.
          </p>
        </div>
      ) : null}

      {state.championName ? <ChampionBox name={state.championName} /> : null}

      <BracketTree
        rounds={state.rounds}
        onOpenMatch={
          state.submitted || state.lockedByDeadline ? undefined : onOpenMatch
        }
      />

      {!state.submitted && !state.lockedByDeadline ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-950/40">
          <h3 className="font-semibold">Submit your knockout bracket</h3>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            This locks your knockout picks permanently. You cannot change them
            afterwards. Submitting reveals other players&apos; knockout picks to
            you. Your group predictions are not affected.
          </p>

          {!state.complete ? (
            <p className="mt-3 text-sm font-medium text-black/60 dark:text-white/60">
              Pick a winner for every match to enable submission.
            </p>
          ) : confirmingSubmit ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={onCancelSubmit}
                disabled={pending}
                className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={onConfirmSubmit}
                disabled={pending}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {pending ? "Submitting..." : "Yes, submit for good"}
              </button>
            </div>
          ) : (
            <button
              onClick={onStartSubmit}
              className="mt-4 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Submit my predictions
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

// Gold champion banner.
export function ChampionBox({ name }: { name: string }) {
  return (
    <div className="rounded-2xl border border-amber-400 bg-gradient-to-b from-amber-50 to-amber-100 p-5 text-center text-amber-900 shadow-sm dark:border-amber-500/50 dark:from-amber-950/40 dark:to-amber-900/30 dark:text-amber-100">
      <div className="text-sm">Your champion</div>
      <div className="text-2xl font-bold">{name}</div>
    </div>
  );
}
