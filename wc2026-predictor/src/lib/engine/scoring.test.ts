import { describe, it, expect } from "vitest";
import {
  scoreGroupMatch,
  scoreKnockoutMatch,
  DEFAULT_GROUP_SCORING,
  DEFAULT_KNOCKOUT_SCORING,
} from "./scoring";

describe("scoreGroupMatch", () => {
  it("awards 3 for an exact scoreline", () => {
    expect(
      scoreGroupMatch({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }),
    ).toBe(3);
  });

  it("awards 1 for the right winner but wrong score", () => {
    expect(
      scoreGroupMatch({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 3, awayGoals: 0 }),
    ).toBe(1);
  });

  it("awards 1 for a correctly predicted draw with a different score", () => {
    expect(
      scoreGroupMatch({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 2 }),
    ).toBe(1);
  });

  it("awards 0 for a wrong result", () => {
    // Predicted home win, actual away win.
    expect(
      scoreGroupMatch({ homeGoals: 2, awayGoals: 1 }, { homeGoals: 0, awayGoals: 1 }),
    ).toBe(0);
    // Predicted draw, actual home win.
    expect(
      scoreGroupMatch({ homeGoals: 1, awayGoals: 1 }, { homeGoals: 2, awayGoals: 1 }),
    ).toBe(0);
  });

  it("respects a custom config", () => {
    const config = { exact: 10, result: 4, wrong: -1 };
    expect(
      scoreGroupMatch({ homeGoals: 0, awayGoals: 0 }, { homeGoals: 0, awayGoals: 0 }, config),
    ).toBe(10);
    expect(
      scoreGroupMatch({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 1, awayGoals: 0 }, config),
    ).toBe(4);
    expect(
      scoreGroupMatch({ homeGoals: 2, awayGoals: 0 }, { homeGoals: 0, awayGoals: 2 }, config),
    ).toBe(-1);
  });

  it("exposes the documented defaults", () => {
    expect(DEFAULT_GROUP_SCORING).toEqual({ exact: 3, result: 1, wrong: 0 });
  });
});

describe("scoreKnockoutMatch", () => {
  it("awards 3 when the correct team advances", () => {
    expect(scoreKnockoutMatch("BRA", "BRA")).toBe(3);
  });

  it("awards 0 when the wrong team advances", () => {
    expect(scoreKnockoutMatch("BRA", "ARG")).toBe(0);
  });

  it("respects a custom config", () => {
    const config = { correct: 5, wrong: -2 };
    expect(scoreKnockoutMatch("BRA", "BRA", config)).toBe(5);
    expect(scoreKnockoutMatch("BRA", "ARG", config)).toBe(-2);
  });

  it("exposes the documented defaults", () => {
    expect(DEFAULT_KNOCKOUT_SCORING).toEqual({ correct: 3, wrong: 0 });
  });
});
