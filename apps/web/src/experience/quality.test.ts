import { describe, expect, it } from "vitest";
import { QualityGovernor } from "./quality";
import type { QualityAction } from "./quality";

/** Feeds identical frames and returns every action other than "hold", in order. */
function run(governor: QualityGovernor, seconds: number, frames: number): QualityAction[] {
  const actions: QualityAction[] = [];
  for (let index = 0; index < frames; index += 1) {
    const action = governor.frame(seconds);
    if (action !== "hold") actions.push(action);
  }
  return actions;
}

describe("quality governor", () => {
  it("holds its level while frames arrive at the display's pace", () => {
    const governor = new QualityGovernor(2, 2);
    expect(run(governor, 1 / 60, 600)).toEqual([]);
    expect(governor.current).toBe(2);
  });

  it("raises only after sustained fast frames and never back to a level that was slow", () => {
    const governor = new QualityGovernor(2, 3);
    expect(run(governor, 1 / 60, 140)).toEqual(["raise"]);
    expect(governor.current).toBe(3);
    expect(run(governor, 0.034, 60)).toEqual(["lower"]);
    expect(governor.current).toBe(2);
    expect(run(governor, 1 / 120, 900)).toEqual([]);
    expect(governor.current).toBe(2);
  });

  it("ignores one very long frame among normal ones", () => {
    const governor = new QualityGovernor(2, 2);
    run(governor, 1 / 60, 30);
    expect(governor.frame(1.8)).toBe("hold");
    expect(run(governor, 1 / 60, 200)).toEqual([]);
    expect(governor.current).toBe(2);
  });

  it("drops straight to the lowest level, then stops animating, when frames are very slow", () => {
    const governor = new QualityGovernor(2, 3);
    expect(run(governor, 0.2, 12)).toEqual(["lower"]);
    expect(governor.current).toBe(0);
    // A few more seconds of very slow frames at the lowest level is enough to give up.
    expect(run(governor, 0.2, 24)).toEqual(["still"]);
  });

  it("keeps animating at the lowest level when it is slow but still usable", () => {
    const governor = new QualityGovernor(0, 1);
    expect(run(governor, 0.04, 400)).toEqual([]);
    expect(governor.current).toBe(0);
  });

  it("starts measuring again after a pause instead of judging stale frames", () => {
    const governor = new QualityGovernor(1, 1);
    // Thirty slow frames are recorded but the measuring window is not complete yet.
    expect(run(governor, 0.034, 42)).toEqual([]);
    governor.settle();
    expect(run(governor, 1 / 60, 300)).toEqual([]);
    expect(governor.current).toBe(1);
  });
});
