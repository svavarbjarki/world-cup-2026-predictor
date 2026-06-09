import { describe, it, expect } from "vitest";
import {
  findDuplicateTeamId,
  isR32Complete,
  r32OpenError,
  R32_SLOTS,
  type R32SlotAssignment,
} from "./admin-r32";

/** Build 16 filled slots with distinct team ids unless overrides are given. */
function filledSlots(
  overrides: Partial<Record<number, [string | null, string | null]>> = {},
): R32SlotAssignment[] {
  return R32_SLOTS.map(({ matchNumber }, i) => {
    const o = overrides[matchNumber];
    return {
      matchNumber,
      homeTeamId: o ? o[0] : `home-${i}`,
      awayTeamId: o ? o[1] : `away-${i}`,
    };
  });
}

describe("findDuplicateTeamId", () => {
  it("returns null when every assigned team is unique", () => {
    expect(findDuplicateTeamId(filledSlots())).toBeNull();
  });

  it("detects a team used in two different matches", () => {
    const slots = filledSlots({ 73: ["DUP", "x"], 80: ["y", "DUP"] });
    expect(findDuplicateTeamId(slots)).toBe("DUP");
  });

  it("detects a team set against itself in one match", () => {
    const slots = filledSlots({ 75: ["SAME", "SAME"] });
    expect(findDuplicateTeamId(slots)).toBe("SAME");
  });

  it("ignores unassigned slots", () => {
    const slots = filledSlots({ 73: [null, null], 74: ["a", null] });
    expect(findDuplicateTeamId(slots)).toBeNull();
  });
});

describe("isR32Complete", () => {
  it("is true only when all 16 matches have both teams", () => {
    expect(isR32Complete(filledSlots())).toBe(true);
  });

  it("is false when any match is missing a team", () => {
    expect(isR32Complete(filledSlots({ 88: ["a", null] }))).toBe(false);
  });
});

describe("r32OpenError (cannot open until valid)", () => {
  it("blocks opening until all 16 matches are filled", () => {
    expect(r32OpenError(filledSlots({ 80: [null, null] }))).toMatch(
      /need both teams/,
    );
  });

  it("blocks opening when a team appears twice", () => {
    const slots = filledSlots({ 73: ["DUP", "x"], 81: ["DUP", "z"] });
    expect(r32OpenError(slots)).toMatch(/more than one match/);
  });

  it("allows opening when complete and all teams unique", () => {
    expect(r32OpenError(filledSlots())).toBeNull();
  });
});
