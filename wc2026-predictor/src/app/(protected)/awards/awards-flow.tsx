"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { saveAwardPickAction, submitAwardsAction } from "@/lib/award-actions";
import { flagEmoji } from "@/lib/data/teams";
import {
  AWARD_CATEGORIES,
  AWARD_LABELS,
  AWARD_FIELD,
  isPlayerCategory,
  isPlayerEligibleForCategory,
  type AwardCategory,
  type AwardState,
  type AwardTeamOption,
  type AwardPlayerOption,
} from "@/lib/awards";

interface Option {
  id: string;
  label: string;
  sub?: string;
  isoCode: string;
}

export function AwardsFlow({
  teams,
  players,
  initialState,
}: {
  teams: AwardTeamOption[];
  players: AwardPlayerOption[];
  initialState: AwardState;
}) {
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const readOnly = state.submitted || state.lockedByDeadline;

  const teamOptions: Option[] = useMemo(
    () => teams.map((t) => ({ id: t.id, label: t.name, isoCode: t.isoCode })),
    [teams],
  );

  // Eligible player options per category (server re-validates on save).
  const optionsFor = useMemo(() => {
    const playerOption = (p: AwardPlayerOption): Option => ({
      id: p.id,
      label: p.name,
      sub: `${p.teamName} | ${p.position}`,
      isoCode: p.isoCode,
    });
    const map: Record<AwardCategory, Option[]> = {
      WINNER: teamOptions,
      GOLDEN_BALL: [],
      GOLDEN_BOOT: [],
      GOLDEN_GLOVE: [],
      YOUNG_PLAYER: [],
    };
    for (const cat of AWARD_CATEGORIES) {
      if (!isPlayerCategory(cat)) continue;
      map[cat] = players
        .filter((p) => isPlayerEligibleForCategory(cat, p))
        .map(playerOption);
    }
    return map;
  }, [teamOptions, players]);

  function pick(category: AwardCategory, id: string | null) {
    startTransition(async () => {
      const res = await saveAwardPickAction(category, id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setState(res.state);
    });
  }

  function submit() {
    startTransition(async () => {
      const res = await submitAwardsAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setState(res.state);
      setConfirmingSubmit(false);
    });
  }

  const pickedCount = AWARD_CATEGORIES.filter(
    (c) => state.picks[AWARD_FIELD[c]] != null,
  ).length;

  return (
    <main className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <header className="mb-4">
        <Link href="/" className="text-sm text-blue-600">
          &larr; Back to dashboard
        </Link>
        <h1 className="mt-2 text-xl font-semibold">Award predictions</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          {state.submitted
            ? "Submitted and locked."
            : state.lockedByDeadline
              ? "Locked (the tournament has started)."
              : `${pickedCount} of 5 picked. These lock at the first kickoff.`}
        </p>
      </header>

      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-4">
        {AWARD_CATEGORIES.map((cat) => (
          <CategoryPicker
            key={cat}
            label={AWARD_LABELS[cat]}
            options={optionsFor[cat]}
            selectedId={state.picks[AWARD_FIELD[cat]]}
            readOnly={readOnly}
            pending={pending}
            onPick={(id) => pick(cat, id)}
          />
        ))}
      </div>

      {!readOnly ? (
        <div className="mt-5 rounded-2xl border border-amber-300 bg-amber-50 p-5 dark:border-amber-700/50 dark:bg-amber-950/40">
          <h2 className="font-semibold">Submit your awards</h2>
          <p className="mt-1 text-sm text-black/70 dark:text-white/70">
            You can edit until the first kickoff. Submitting locks them and lets
            others see your award picks once they submit theirs.
          </p>
          {!state.complete ? (
            <p className="mt-2 text-sm font-medium text-black/60 dark:text-white/60">
              Pick all five categories to submit.
            </p>
          ) : confirmingSubmit ? (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => setConfirmingSubmit(false)}
                disabled={pending}
                className="flex-1 rounded-lg border border-black/15 px-3 py-2 text-sm font-medium hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={pending}
                className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {pending ? "Submitting..." : "Submit awards"}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingSubmit(true)}
              className="mt-4 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white hover:bg-amber-700"
            >
              Submit awards
            </button>
          )}
        </div>
      ) : null}
    </main>
  );
}

function CategoryPicker({
  label,
  options,
  selectedId,
  readOnly,
  pending,
  onPick,
}: {
  label: string;
  options: Option[];
  selectedId: string | null;
  readOnly: boolean;
  pending: boolean;
  onPick: (id: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.id === selectedId) ?? null;
  const filtered =
    query.trim() === ""
      ? options
      : options.filter((o) =>
          (o.label + " " + (o.sub ?? ""))
            .toLowerCase()
            .includes(query.toLowerCase()),
        );

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-neutral-900">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        {selected ? (
          <span className="text-sm">
            <span aria-hidden className="mr-1">
              {flagEmoji(selected.isoCode)}
            </span>
            {selected.label}
          </span>
        ) : (
          <span className="text-sm text-black/40 dark:text-white/40">
            Not picked
          </span>
        )}
      </div>

      {readOnly ? null : (
        <>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className="text-sm text-blue-600"
            >
              {selected ? "Change pick" : "Choose"}
            </button>
          ) : (
            <div>
              <input
                type="text"
                autoFocus
                value={query}
                placeholder="Search..."
                onChange={(e) => setQuery(e.target.value)}
                className="mb-2 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 dark:border-white/20"
              />
              <div className="max-h-56 overflow-y-auto rounded-lg border border-black/10 dark:border-white/10">
                {filtered.map((o) => (
                  <button
                    key={o.id}
                    disabled={pending}
                    onClick={() => {
                      onPick(o.id);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={
                      "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 " +
                      (o.id === selectedId ? "bg-emerald-50 dark:bg-emerald-950/40" : "")
                    }
                  >
                    <span>
                      <span aria-hidden className="mr-1">
                        {flagEmoji(o.isoCode)}
                      </span>
                      {o.label}
                      {o.sub ? (
                        <span className="ml-1 text-xs text-black/40 dark:text-white/40">
                          {o.sub}
                        </span>
                      ) : null}
                    </span>
                    {o.id === selectedId ? <span aria-hidden>&#10003;</span> : null}
                  </button>
                ))}
                {filtered.length === 0 ? (
                  <p className="px-3 py-2 text-sm text-black/40">No matches.</p>
                ) : null}
              </div>
              <div className="mt-2 flex justify-between text-sm">
                {selected ? (
                  <button
                    onClick={() => {
                      onPick(null);
                      setOpen(false);
                    }}
                    className="text-red-600"
                  >
                    Clear
                  </button>
                ) : (
                  <span />
                )}
                <button
                  onClick={() => {
                    setOpen(false);
                    setQuery("");
                  }}
                  className="text-black/50 dark:text-white/50"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
