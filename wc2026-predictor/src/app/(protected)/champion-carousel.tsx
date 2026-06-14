"use client";

import { useEffect, useState } from "react";
import { flagEmoji } from "@/lib/data/teams";
import type { ChampionPick } from "@/lib/hub";

const SLIDE_MS = 3000; // dwell time per player
const ANIM_MS = 500; // slide transition duration

function Slide({ pick }: { pick: ChampionPick }) {
  return (
    <div className="flex w-full shrink-0 items-center justify-center gap-2 px-3 text-center text-sm">
      <span className="text-text-muted">{pick.displayName}</span>
      <span className="text-text-muted">picks</span>
      <span className="font-semibold text-text">
        <span aria-hidden className="mr-1">
          {flagEmoji(pick.isoCode)}
        </span>
        {pick.teamName}
      </span>
    </div>
  );
}

/**
 * A compact ticker that cycles through every submitted player's predicted
 * champion, one every few seconds, looping seamlessly. A single pick is shown
 * statically. Rendering nothing for an empty list is handled by the caller.
 */
export function ChampionCarousel({ picks }: { picks: ChampionPick[] }) {
  const count = picks.length;
  const [index, setIndex] = useState(0);
  const [animate, setAnimate] = useState(true);

  // Advance one slide every SLIDE_MS, but only when there is more than one.
  useEffect(() => {
    if (count <= 1) return;
    const id = setInterval(() => setIndex((i) => i + 1), SLIDE_MS);
    return () => clearInterval(id);
  }, [count]);

  // After sliding onto the cloned first slide (index === count), jump back to the
  // real first slide without animation so the loop has no visible rewind.
  function handleTransitionEnd() {
    if (index === count) {
      setAnimate(false);
      setIndex(0);
    }
  }
  // Re-enable the transition on the next frame after a silent reset.
  useEffect(() => {
    if (animate) return;
    const r = requestAnimationFrame(() => setAnimate(true));
    return () => cancelAnimationFrame(r);
  }, [animate]);

  if (count === 0) return null;

  const shell =
    "overflow-hidden rounded-2xl border border-black/10 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-neutral-900";

  if (count === 1) {
    return (
      <div className={shell}>
        <Slide pick={picks[0]} />
      </div>
    );
  }

  // A clone of the first slide trails the list so the final transition lands on
  // an identical frame before the seamless reset.
  const slides = [...picks, picks[0]];

  return (
    <div className={shell}>
      <div
        className="flex"
        style={{
          transform: `translateX(-${index * 100}%)`,
          transition: animate ? `transform ${ANIM_MS}ms ease` : "none",
        }}
        onTransitionEnd={handleTransitionEnd}
      >
        {slides.map((p, i) => (
          <Slide key={i} pick={p} />
        ))}
      </div>
    </div>
  );
}
