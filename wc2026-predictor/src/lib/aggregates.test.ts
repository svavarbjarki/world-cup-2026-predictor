import { describe, it, expect } from "vitest";
import { groupAggregate, knockoutAggregate } from "./aggregates";

const score = (h: number, a: number) => ({ homeGoals: h, awayGoals: a });

function pctByKey(agg: ReturnType<typeof groupAggregate>) {
  if (!agg.allowed) throw new Error("not allowed");
  return Object.fromEntries(agg.segments.map((s) => [s.key, s.pct]));
}

describe("groupAggregate", () => {
  it("denies a viewer who has not submitted (the per-phase gate), even with data", () => {
    const agg = groupAggregate(false, [score(2, 1), score(0, 0)]);
    expect(agg.allowed).toBe(false);
  });

  it("buckets scorelines into home / draw / away via match outcome", () => {
    const agg = groupAggregate(true, [
      score(2, 1), // home
      score(1, 0), // home
      score(0, 0), // draw
      score(1, 3), // away
    ]);
    expect(agg.allowed).toBe(true);
    if (!agg.allowed) return;
    expect(agg.total).toBe(4);
    const counts = Object.fromEntries(agg.segments.map((s) => [s.key, s.count]));
    expect(counts).toEqual({ home: 2, draw: 1, away: 1 });
    expect(pctByKey(agg)).toEqual({ home: 50, draw: 25, away: 25 });
  });

  it("handles zero predictions gracefully", () => {
    const agg = groupAggregate(true, []);
    expect(agg.allowed).toBe(true);
    if (!agg.allowed) return;
    expect(agg.total).toBe(0);
    expect(agg.segments.every((s) => s.count === 0 && s.pct === 0)).toBe(true);
  });
});

describe("knockoutAggregate", () => {
  it("denies a viewer who has not submitted", () => {
    expect(knockoutAggregate(false, ["br", "br"], "br").allowed).toBe(false);
  });

  it("tallies home vs away by the real home team", () => {
    const agg = knockoutAggregate(true, ["br", "ar", "br"], "br");
    expect(agg.allowed).toBe(true);
    if (!agg.allowed) return;
    expect(agg.total).toBe(3);
    const counts = Object.fromEntries(agg.segments.map((s) => [s.key, s.count]));
    expect(counts).toEqual({ home: 2, away: 1 });
    const pct = Object.fromEntries(agg.segments.map((s) => [s.key, s.pct]));
    expect(pct.home).toBe(67);
    expect(pct.away).toBe(33);
  });
});
