import { describe, it, expect } from "vitest";
import { hasSubmitted, canSeeOthersPredictions } from "./visibility";

describe("hasSubmitted", () => {
  it("is true only for SUBMITTED", () => {
    expect(hasSubmitted("SUBMITTED")).toBe(true);
    expect(hasSubmitted("IN_PROGRESS")).toBe(false);
    expect(hasSubmitted("NOT_STARTED")).toBe(false);
  });
});

describe("canSeeOthersPredictions (the privacy gate)", () => {
  it("denies a viewer who has not submitted, no matter the target", () => {
    expect(canSeeOthersPredictions(false, true)).toBe(false);
    expect(canSeeOthersPredictions(false, false)).toBe(false);
  });

  it("denies when the target has not submitted, even if the viewer has", () => {
    expect(canSeeOthersPredictions(true, false)).toBe(false);
  });

  it("allows only when both viewer and target have submitted", () => {
    expect(canSeeOthersPredictions(true, true)).toBe(true);
  });
});

describe("awards visibility uses the same per-phase gate", () => {
  // getPlayerPredictionsForViewer feeds the viewer's and target's awardsStatus
  // through canSeeOthersPredictions; an un-submitted viewer is denied.
  it("denies an awards-un-submitted viewer", () => {
    const viewerSubmittedAwards = hasSubmitted("IN_PROGRESS");
    const targetSubmittedAwards = hasSubmitted("SUBMITTED");
    expect(
      canSeeOthersPredictions(viewerSubmittedAwards, targetSubmittedAwards),
    ).toBe(false);
  });

  it("allows once both have submitted awards", () => {
    expect(
      canSeeOthersPredictions(hasSubmitted("SUBMITTED"), hasSubmitted("SUBMITTED")),
    ).toBe(true);
  });
});
