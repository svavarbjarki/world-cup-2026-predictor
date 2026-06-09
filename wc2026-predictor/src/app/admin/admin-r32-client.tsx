"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  saveR32MatchAction,
  openKnockoutPhaseAction,
  logoutAdminAction,
} from "@/lib/admin-actions";
import { r32OpenError } from "@/lib/admin-r32";
import { computeBracketLayout } from "@/lib/admin-bracket";
import styles from "./admin-bracket.module.css";

interface Row {
  matchNumber: number;
  slot: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
}

interface TeamOption {
  id: string;
  label: string;
}

/** Split a list into consecutive pairs ([a,b],[c,d],...); a trailing single is its own group. */
function pairs<T>(arr: T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += 2) out.push(arr.slice(i, i + 2));
  return out;
}

export function AdminR32({
  initialRows,
  teams,
  initiallyOpened,
}: {
  initialRows: Row[];
  teams: TeamOption[];
  initiallyOpened: boolean;
}) {
  const [rows, setRows] = useState(initialRows);
  const [opened, setOpened] = useState(initiallyOpened);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Bracket node placement comes from the engine's official progression.
  const layout = computeBracketLayout();
  const rowByMatch = new Map(rows.map((r) => [r.matchNumber, r]));

  const usedIds = new Set<string>();
  for (const r of rows) {
    if (r.homeTeamId) usedIds.add(r.homeTeamId);
    if (r.awayTeamId) usedIds.add(r.awayTeamId);
  }

  const openErr = r32OpenError(
    rows.map((r) => ({
      matchNumber: r.matchNumber,
      homeTeamId: r.homeTeamId,
      awayTeamId: r.awayTeamId,
    })),
  );

  function change(matchNumber: number, side: "home" | "away", value: string) {
    if (opened) return;
    const prev = rows;
    const next = rows.map((r) => {
      if (r.matchNumber !== matchNumber) return r;
      return side === "home"
        ? { ...r, homeTeamId: value || null }
        : { ...r, awayTeamId: value || null };
    });
    setRows(next);
    const row = next.find((r) => r.matchNumber === matchNumber)!;
    startTransition(async () => {
      const res = await saveR32MatchAction(
        matchNumber,
        row.homeTeamId,
        row.awayTeamId,
      );
      if (!res.ok) {
        setError(res.error);
        setRows(prev); // revert to the persisted state
        return;
      }
      setError(null);
    });
  }

  function open() {
    startTransition(async () => {
      const res = await openKnockoutPhaseAction();
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setError(null);
      setOpened(true);
    });
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-4 sm:p-6">
      <header className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">Real Round of 32</h1>
          <p className="text-sm text-black/60 dark:text-white/60">
            Fill the 16 Round-of-32 matchups in the bracket, then open the
            knockout phase. Later rounds are placeholders for context.
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

      {opened ? (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-700/50 dark:bg-emerald-950/40">
          Knockout phase is <span className="font-semibold">OPEN</span>. The
          matchups are now frozen.
        </div>
      ) : null}

      {error ? (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!opened ? (
        <div className="mb-5 rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700/50 dark:bg-amber-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Open the knockout phase</h2>
              <p className="mt-1 text-sm text-black/70 dark:text-white/70">
                Freezes the Round of 32 and opens knockout predictions for
                players.
                {openErr ? (
                  <span className="block font-medium text-black/60 dark:text-white/60">
                    {openErr}
                  </span>
                ) : null}
              </p>
            </div>
            <button
              onClick={open}
              disabled={opened || openErr !== null || pending}
              className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {pending ? "Working..." : "Open knockout phase"}
            </button>
          </div>
        </div>
      ) : null}

      {/* The bracket is wide; it scrolls horizontally (and the page scrolls
          vertically). No separate mobile layout, since /admin is a single
          organizer tool, not a primary user surface. */}
      <p className="mb-1 text-xs text-black/40 dark:text-white/40">
        Scroll sideways to see all rounds.
      </p>
      <div className="overflow-x-auto pb-4">
        <div className={styles.bracket}>
          {layout.map((round, ri) => {
            const feeding = ri < layout.length - 1;
            const fed = ri > 0;
            const isR32 = round.name === "roundOf32";
            return (
              <div key={round.name} className="flex flex-col">
                <div className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-black/50 dark:text-white/50">
                  {round.label}
                </div>
                <div
                  className={[
                    styles.round,
                    feeding ? styles.feeding : "",
                    fed ? styles.fed : "",
                    "flex-1",
                  ].join(" ")}
                >
                  {pairs(round.matchNumbers).map((pair, pi) => (
                    <div key={pi} className={styles.pair}>
                      {pair.map((mn) =>
                        isR32 ? (
                          <div key={mn} className={styles.node}>
                            <R32Node
                              row={rowByMatch.get(mn)!}
                              teams={teams}
                              usedIds={usedIds}
                              disabled={opened || pending}
                              onChange={change}
                            />
                          </div>
                        ) : (
                          <div key={mn} className={styles.node}>
                            <PlaceholderNode label={round.label} />
                          </div>
                        ),
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function R32Node({
  row,
  teams,
  usedIds,
  disabled,
  onChange,
}: {
  row: Row;
  teams: TeamOption[];
  usedIds: Set<string>;
  disabled: boolean;
  onChange: (matchNumber: number, side: "home" | "away", value: string) => void;
}) {
  return (
    <div className="w-56 rounded-lg border border-black/15 bg-white p-2 shadow-sm dark:border-white/15 dark:bg-neutral-900">
      <div className="mb-1 text-[10px] font-medium text-black/40 dark:text-white/40">
        Match {row.matchNumber}
      </div>
      <TeamSelect
        value={row.homeTeamId}
        teams={teams}
        usedIds={usedIds}
        disabled={disabled}
        onChange={(v) => onChange(row.matchNumber, "home", v)}
      />
      <div className="my-1 text-center text-[10px] text-black/30 dark:text-white/30">
        v
      </div>
      <TeamSelect
        value={row.awayTeamId}
        teams={teams}
        usedIds={usedIds}
        disabled={disabled}
        onChange={(v) => onChange(row.matchNumber, "away", v)}
      />
    </div>
  );
}

function PlaceholderNode({ label }: { label: string }) {
  return (
    <div className="w-32 rounded-lg border border-dashed border-black/15 bg-black/[0.02] p-2 text-center dark:border-white/15 dark:bg-white/[0.02]">
      <div className="text-[10px] uppercase tracking-wide text-black/30 dark:text-white/30">
        {label}
      </div>
      <div className="mt-1 space-y-1">
        <div className="h-4 rounded bg-black/5 dark:bg-white/10" />
        <div className="h-4 rounded bg-black/5 dark:bg-white/10" />
      </div>
      <div className="mt-1 text-[10px] text-black/25 dark:text-white/25">TBD</div>
    </div>
  );
}

function TeamSelect({
  value,
  teams,
  usedIds,
  disabled,
  onChange,
}: {
  value: string | null;
  teams: TeamOption[];
  usedIds: Set<string>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className="w-full min-w-0 rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm outline-none focus:border-blue-500 disabled:opacity-60 dark:border-white/20"
    >
      <option value="">-- team --</option>
      {teams.map((t) => (
        <option
          key={t.id}
          value={t.id}
          // Disable teams already used elsewhere, but keep this select's own pick.
          disabled={t.id !== value && usedIds.has(t.id)}
        >
          {t.label}
        </option>
      ))}
    </select>
  );
}
