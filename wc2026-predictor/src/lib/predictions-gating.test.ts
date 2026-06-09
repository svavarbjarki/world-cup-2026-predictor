import { describe, it, expect } from "vitest";
import {
  isValidGoal,
  computeUnlockedFlags,
  canLockGroups,
  MAX_GOALS,
} from "./predictions-gating";

describe("isValidGoal", () => {
  it("accepts whole numbers from 0 to MAX_GOALS", () => {
    expect(isValidGoal(0)).toBe(true);
    expect(isValidGoal(3)).toBe(true);
    expect(isValidGoal(MAX_GOALS)).toBe(true);
  });

  it("rejects negatives, non-integers, and out-of-range values", () => {
    expect(isValidGoal(-1)).toBe(false);
    expect(isValidGoal(1.5)).toBe(false);
    expect(isValidGoal(MAX_GOALS + 1)).toBe(false);
    expect(isValidGoal(NaN)).toBe(false);
  });
});

describe("computeUnlockedFlags (sequential gate, cannot skip ahead)", () => {
  it("unlocks only the first group when nothing is complete", () => {
    const flags = computeUnlockedFlags(Array(12).fill(false));
    expect(flags[0]).toBe(true);
    expect(flags.slice(1).every((f) => f === false)).toBe(true);
  });

  it("unlocks the next group only once the current one is complete", () => {
    // Groups A and B complete, the rest not.
    const complete = [true, true, false, false, false, false, false, false, false, false, false, false];
    const flags = computeUnlockedFlags(complete);
    // A, B, C reachable (C because A and B are done); D onward locked.
    expect(flags.slice(0, 3)).toEqual([true, true, true]);
    expect(flags.slice(3).every((f) => f === false)).toBe(true);
  });

  it("does not unlock a later group when an earlier one is incomplete", () => {
    // A complete, B incomplete, C complete (inconsistent input). C must stay
    // locked because B is not done: the gate is cumulative, not just "previous".
    const complete = [true, false, true, false, false, false, false, false, false, false, false, false];
    const flags = computeUnlockedFlags(complete);
    expect(flags[0]).toBe(true); // A
    expect(flags[1]).toBe(true); // B reachable (A done)
    expect(flags[2]).toBe(false); // C locked (B not done)
    expect(flags[3]).toBe(false);
  });

  it("unlocks every group when all are complete", () => {
    const flags = computeUnlockedFlags(Array(12).fill(true));
    expect(flags.every((f) => f === true)).toBe(true);
  });
});

describe("canLockGroups (cannot lock before all 12 done)", () => {
  it("allows locking only when all complete and not already locked", () => {
    expect(canLockGroups(true, false)).toBe(true);
  });

  it("refuses when not all groups are complete", () => {
    expect(canLockGroups(false, false)).toBe(false);
  });

  it("refuses when already locked", () => {
    expect(canLockGroups(true, true)).toBe(false);
  });
});
