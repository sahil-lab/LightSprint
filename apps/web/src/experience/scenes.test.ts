import { describe, expect, it } from "vitest";
import { pinProgress, sceneAt } from "./scenes";

// A 1000px viewport over a hero, a tall pinned section, a long section and a short last one.
const bands = [
  { top: 0, bottom: 1000 },
  { top: 1000, bottom: 3500 },
  { top: 3500, bottom: 6000 },
  { top: 6000, bottom: 6800 },
];

describe("scroll to scene mapping", () => {
  it("holds each section's scene while the view is well inside it", () => {
    expect(sceneAt(500, bands, 1000)).toBe(0);
    expect(sceneAt(2200, bands, 1000)).toBe(1);
    expect(sceneAt(4800, bands, 1000)).toBe(2);
    expect(sceneAt(6500, bands, 1000)).toBe(3);
  });

  it("blends continuously and never backwards across every boundary", () => {
    let previous = sceneAt(0, bands, 1000);
    for (let center = 0; center <= 7600; center += 20) {
      const value = sceneAt(center, bands, 1000);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value - previous).toBeLessThan(0.08);
      previous = value;
    }
    expect(sceneAt(1025, bands, 1000)).toBeCloseTo(0.5, 5);
  });

  it("stays on the first and last scenes beyond the ends of the page", () => {
    expect(sceneAt(-400, bands, 1000)).toBe(0);
    expect(sceneAt(99_000, bands, 1000)).toBe(3);
    expect(sceneAt(100, [], 1000)).toBe(0);
  });
});

describe("pinned section progress", () => {
  it("runs from 0 to 1 over the distance the section stays pinned", () => {
    expect(pinProgress(900, 1000, 2500, 1000)).toBe(0);
    expect(pinProgress(1000, 1000, 2500, 1000)).toBe(0);
    expect(pinProgress(1750, 1000, 2500, 1000)).toBeCloseTo(0.5, 5);
    expect(pinProgress(2500, 1000, 2500, 1000)).toBe(1);
    expect(pinProgress(4000, 1000, 2500, 1000)).toBe(1);
  });

  it("treats a section no taller than the viewport as complete once reached", () => {
    expect(pinProgress(500, 1000, 800, 1000)).toBe(0);
    expect(pinProgress(1000, 1000, 800, 1000)).toBe(1);
  });
});
