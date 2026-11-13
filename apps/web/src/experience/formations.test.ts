import { describe, expect, it } from "vitest";
import {
  FLOATS_PER_PARTICLE,
  GRAPH_DUST,
  GRAPH_EDGES,
  GRAPH_NODES,
  OFFSET,
  buildParticles,
} from "./formations";

describe("particle formations", () => {
  it("keeps every formation intact when only the first particles are drawn", () => {
    const full = buildParticles(4000);
    const thinned = buildParticles(1000);
    expect(full.length).toBe(4000 * FLOATS_PER_PARTICLE);
    expect(Array.from(full.subarray(0, thinned.length))).toEqual(Array.from(thinned));
    expect(full.every(Number.isFinite)).toBe(true);
  });

  it("puts graph particles on a node, on a forward edge, or in the surrounding dust", () => {
    const data = buildParticles(3000);
    const roles = { node: 0, edge: 0, dust: 0 };
    for (let index = 0; index < 3000; index += 1) {
      const base = index * FLOATS_PER_PARTICLE;
      const [ax = 0, ay = 0, az = 0] = data.subarray(
        base + OFFSET.graphA,
        base + OFFSET.graphA + 3,
      );
      const [bx = 0, by = 0, bz = 0, speed = 0] = data.subarray(
        base + OFFSET.graphB,
        base + OFFSET.graphB + 4,
      );
      if (speed === GRAPH_DUST) {
        roles.dust += 1;
        expect([bx, by, bz]).toEqual([ax, ay, az]);
      } else if (speed === 0) {
        roles.node += 1;
        const nearest = Math.min(
          ...GRAPH_NODES.map((node) => Math.hypot(ax - node[0], ay - node[1], az - node[2])),
        );
        expect(nearest).toBeLessThan(0.4);
        expect([bx, by, bz]).toEqual([ax, ay, az]);
      } else {
        roles.edge += 1;
        // Every edge runs left to right, so flow always moves toward the final node.
        expect(bx).toBeGreaterThan(ax);
        expect(speed).toBeGreaterThan(0);
      }
    }
    expect(roles.node).toBeGreaterThan(250);
    expect(roles.edge).toBeGreaterThan(1850);
    expect(roles.dust).toBeGreaterThan(450);
  });

  it("describes a graph in which every path ends at the single final node", () => {
    const last = GRAPH_NODES.length - 1;
    const outgoing = new Set(GRAPH_EDGES.map(([from]) => from));
    const sinks = GRAPH_NODES.map((_, index) => index).filter((index) => !outgoing.has(index));
    expect(sinks).toEqual([last]);
    for (const [from, to] of GRAPH_EDGES) {
      expect(GRAPH_NODES[to]?.[0]).toBeGreaterThan(GRAPH_NODES[from]?.[0] ?? Infinity);
    }
  });
});
