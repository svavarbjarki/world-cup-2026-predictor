"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { flagEmoji } from "@/lib/data/teams";
import { submitBonusPickAction } from "@/lib/bonus-actions";
import type {
  BonusActiveView,
  BonusBoxView,
  BonusRecapView,
  BonusTallyEntry,
} from "@/lib/bonus-hub";

export function BonusBox({ view }: { view: BonusBoxView }) {
  if (!view.active && !view.recap) return null;
  return (
    <div className="rounded-2xl border border-gold/40 bg-gold/[0.06] p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span aria-hidden className="text-base">
          &#127919;
        </span>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gold">
          Bonus prediction
        </h2>
      </div>
      {view.recap ? <Recap recap={view.recap} /> : null}
      {view.active ? <Active active={view.active} /> : <AllDone />}
    </div>
  );
}

function AllDone() {
  return (
    <p className="text-sm text-text-muted">
      No upcoming match to predict right now. Check back when the next one is
      scheduled.
    </p>
  );
}

/** A compact recap of the most recently resolved bonus prediction. */
function Recap({ recap }: { recap: BonusRecapView }) {
  let verdict: { text: string; cls: string };
  if (recap.userWasRight === true) {
    verdict = { text: "You were right", cls: "text-emerald-400" };
  } else if (recap.userWasRight === false) {
    verdict = { text: "You were wrong", cls: "text-red-400" };
  } else if (recap.userPickLabel == null) {
    verdict = { text: "You did not pick", cls: "text-text-muted" };
  } else {
    verdict = { text: "No result", cls: "text-text-muted" };
  }
  return (
    <div className="mb-3 rounded-xl border border-border bg-surface/60 p-3 text-xs">
      <div className="mb-1 text-text-muted">
        Last: <span className="text-text">{recap.matchLabel}</span>
      </div>
      <div className="text-text">{recap.question}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-text-muted">
        <span>
          Answer:{" "}
          <span className="font-medium text-text">
            {recap.correctAnswerLabel ?? "No correct answer"}
          </span>
        </span>
        {recap.userPickLabel != null ? (
          <span>
            Your pick:{" "}
            <span className="font-medium text-text">{recap.userPickLabel}</span>
          </span>
        ) : null}
        <span className={`font-semibold ${verdict.cls}`}>{verdict.text}</span>
      </div>
    </div>
  );
}

/** The active question for the next match: input, reveal-after-pick, lock. */
function Active({ active }: { active: BonusActiveView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Local select value for the first-goalscorer case (others submit on click).
  const [scorerChoice, setScorerChoice] = useState(active.userChoice ?? "");

  function submit(choice: string) {
    setError(null);
    startTransition(async () => {
      const res = await submitBonusPickAction(active.bonusId, choice);
      if (!res.ok) {
        setError(res.error ?? "Could not save your pick.");
        return;
      }
      router.refresh();
    });
  }

  const picked = active.userChoice != null;

  return (
    <div>
      <div className="mb-1 text-xs text-text-muted">
        Next: {flagEmoji(active.home.isoCode)} {active.home.name} vs{" "}
        {active.away.name} {flagEmoji(active.away.isoCode)}
      </div>
      <div className="mb-3 text-base font-semibold text-text">{active.question}</div>

      {active.locked ? (
        <div className="mb-2 rounded-lg border border-border bg-surface/60 px-3 py-2 text-xs text-text-muted">
          {picked
            ? "Locked at kickoff. Your pick is in."
            : "Locked at kickoff. You did not pick in time."}
        </div>
      ) : (
        <BonusInput
          active={active}
          pending={pending}
          scorerChoice={scorerChoice}
          onScorerChange={setScorerChoice}
          onSubmit={submit}
        />
      )}

      {error ? <p className="mt-2 text-xs text-red-400">{error}</p> : null}

      {/* Reveal everyone's picks only once the viewer has made their own. */}
      {picked && active.tally ? (
        <Tally tally={active.tally} total={active.totalPicks} mine={active.userChoice} />
      ) : null}
    </div>
  );
}

/** The type-specific input control. */
function BonusInput({
  active,
  pending,
  scorerChoice,
  onScorerChange,
  onSubmit,
}: {
  active: BonusActiveView;
  pending: boolean;
  scorerChoice: string;
  onScorerChange: (v: string) => void;
  onSubmit: (choice: string) => void;
}) {
  if (active.type === "FIRST_SCORER" && active.scorerOptions) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={scorerChoice}
          disabled={pending}
          onChange={(e) => onScorerChange(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text"
        >
          <option value="">Select a player...</option>
          {active.scorerOptions.map((p) => (
            <option key={p.id} value={p.id}>
              {flagEmoji(p.isoCode)} {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={pending || scorerChoice === "" || scorerChoice === active.userChoice}
          onClick={() => onSubmit(scorerChoice)}
          className="rounded-lg bg-gold px-4 py-2 text-sm font-medium text-bg hover:bg-gold-bright disabled:opacity-50"
        >
          {active.userChoice ? "Update" : "Save"}
        </button>
      </div>
    );
  }

  // Two-option choices: yes/no, over/under, or the two teams.
  const options: { value: string; label: string }[] =
    active.type === "BTTS"
      ? [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ]
      : active.type === "OVER_UNDER"
        ? [
            { value: "over", label: `Over ${active.line ?? ""}`.trim() },
            { value: "under", label: `Under ${active.line ?? ""}`.trim() },
          ]
        : [
            {
              value: active.home.id,
              label: `${flagEmoji(active.home.isoCode)} ${active.home.name}`,
            },
            {
              value: active.away.id,
              label: `${flagEmoji(active.away.isoCode)} ${active.away.name}`,
            },
          ];

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = active.userChoice === o.value;
        return (
          <button
            key={o.value}
            type="button"
            disabled={pending}
            onClick={() => onSubmit(o.value)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-50 ${
              selected
                ? "border-gold bg-gold text-bg"
                : "border-border bg-surface text-text hover:bg-surface-raised"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** The live tally of everyone's picks, shown after the viewer has picked. */
function Tally({
  tally,
  total,
  mine,
}: {
  tally: BonusTallyEntry[];
  total: number;
  mine: string | null;
}) {
  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-1.5 text-[11px] uppercase tracking-wide text-text-muted">
        Everyone&apos;s picks ({total})
      </div>
      <ul className="space-y-1.5">
        {tally.map((t) => {
          const pct = total > 0 ? Math.round((t.count / total) * 100) : 0;
          const isMine = t.choice === mine;
          return (
            <li key={t.choice} className="text-xs">
              <div className="mb-0.5 flex items-center justify-between">
                <span className={isMine ? "font-semibold text-gold" : "text-text"}>
                  {t.label}
                  {isMine ? " (you)" : ""}
                </span>
                <span className="text-text-muted">
                  {t.count} ({pct}%)
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-raised">
                <div
                  className={`h-full rounded-full ${isMine ? "bg-gold" : "bg-text-muted/50"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
