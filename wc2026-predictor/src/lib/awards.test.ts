import { describe, it, expect } from "vitest";
import {
  isGoalkeeper,
  isYoungEligible,
  isPlayerEligibleForCategory,
} from "./awards";

describe("isGoalkeeper", () => {
  it("is true only for GK", () => {
    expect(isGoalkeeper({ position: "GK" })).toBe(true);
    expect(isGoalkeeper({ position: "FW" })).toBe(false);
  });
});

describe("isYoungEligible", () => {
  it("uses birthYear when known (>= 2005 eligible)", () => {
    expect(isYoungEligible({ age: 30, birthYear: 2005 })).toBe(true);
    expect(isYoungEligible({ age: 18, birthYear: 2004 })).toBe(false);
  });

  it("falls back to age <= 21 when birthYear is missing", () => {
    expect(isYoungEligible({ age: 21 })).toBe(true);
    expect(isYoungEligible({ age: 22 })).toBe(false);
    expect(isYoungEligible({ age: 22, birthYear: null })).toBe(false);
  });
});

describe("isPlayerEligibleForCategory", () => {
  const gkYoung = { position: "GK", age: 20, birthYear: 2006 };
  const fwOld = { position: "FW", age: 30, birthYear: 1995 };

  it("Golden Ball and Boot accept any player", () => {
    expect(isPlayerEligibleForCategory("GOLDEN_BALL", fwOld)).toBe(true);
    expect(isPlayerEligibleForCategory("GOLDEN_BOOT", fwOld)).toBe(true);
  });

  it("Golden Glove requires a goalkeeper", () => {
    expect(isPlayerEligibleForCategory("GOLDEN_GLOVE", gkYoung)).toBe(true);
    expect(isPlayerEligibleForCategory("GOLDEN_GLOVE", fwOld)).toBe(false);
  });

  it("Young Player requires eligibility", () => {
    expect(isPlayerEligibleForCategory("YOUNG_PLAYER", gkYoung)).toBe(true);
    expect(isPlayerEligibleForCategory("YOUNG_PLAYER", fwOld)).toBe(false);
  });

  it("no player is eligible for WINNER (a team award)", () => {
    expect(isPlayerEligibleForCategory("WINNER", gkYoung)).toBe(false);
  });
});
