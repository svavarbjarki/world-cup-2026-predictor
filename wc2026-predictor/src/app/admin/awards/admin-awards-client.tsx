"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setAwardResultAction, logoutAdminAction } from "@/lib/admin-actions";
import {
  AWARD_CATEGORIES,
  AWARD_LABELS,
  AWARD_FIELD,
  isPlayerCategory,
  isPlayerEligibleForCategory,
  type AwardCategory,
  type AwardPicksIds,
  type AwardTeamOption,
  type AwardPlayerOption,
} from "@/lib/awards";

export function AdminAwards({
  teams,
  players,
  initialPicks,
}: {
  teams: AwardTeamOption[];
  players: AwardPlayerOption[];
  initialPicks: AwardPicksIds;
}) {
  const [picks, setPicks] = useState(initialPicks);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function set(category: AwardCategory, value: string) {
    const id = value === "" ? null : value;
    startTransition(async () => {
      const res = await setAwardResultAction(category, id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setPicks(res.picks);
    });
  }

  function optionsFor(category: AwardCategory) {
    if (!isPlayerCategory(category)) {
      return teams.map((t) => ({ id: t.id, label: t.name }));
    }
    return players
      .filter((p) => isPlayerEligibleForCategory(category, p))
      .map((p) => ({ id: p.id, label: `${p.name} (${p.teamName})` }));
  }

  return (
    <main className="mx-auto w-full max-w-xl p-4 sm:p-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Actual award winners</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Enter the real winners (editable). Scoring updates automatically.
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

      {error ? (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {AWARD_CATEGORIES.map((cat) => {
          const value = picks[AWARD_FIELD[cat]] ?? "";
          return (
            <label
              key={cat}
              className="block rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-neutral-900"
            >
              <div className="mb-1 text-sm font-semibold">{AWARD_LABELS[cat]}</div>
              <select
                value={value}
                disabled={pending}
                onChange={(e) => set(cat, e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-transparent px-2 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-white/20"
              >
                <option value="">-- not decided --</option>
                {optionsFor(cat).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </main>
  );
}
