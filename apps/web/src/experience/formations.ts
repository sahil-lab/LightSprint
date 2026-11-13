export const FLOATS_PER_PARTICLE = 22;

export const OFFSET = {
  vortex: 0,
  graphA: 3,
  graphB: 7,
  field: 11,
  sprint: 14,
  seed: 18,
} as const;

type GraphNode = readonly [x: number, y: number, z: number, weight: number];

// A converging dependency graph: many sources, one final node.
export const GRAPH_NODES: readonly GraphNode[] = [
  [-1, 0.24, 0.1, 1],
  [-1, -0.24, -0.08, 1],
  [-0.5, 0.42, -0.12, 1],
  [-0.5, 0.02, 0.14, 1],
  [-0.5, -0.4, 0.04, 1],
  [0, 0.33, 0.12, 1],
  [0, -0.05, -0.14, 1],
  [0, -0.42, 0.08, 1],
  [0.5, 0.2, -0.06, 1],
  [0.5, -0.22, 0.1, 1],
  [1, 0, 0, 2.6],
];

export const GRAPH_EDGES: readonly (readonly [from: number, to: number])[] = [
  [0, 2],
  [0, 3],
  [1, 3],
  [1, 4],
  [2, 5],
  [3, 5],
  [3, 6],
  [4, 6],
  [4, 7],
  [5, 8],
  [6, 8],
  [6, 9],
  [7, 9],
  [8, 10],
  [9, 10],
];

// Marks graph particles that neither sit on a node nor travel an edge.
export const GRAPH_DUST = -1;

// Fraction of a lane's length covered by one streak, head to tail.
const STREAK_LENGTH = 0.07;

const ORIGIN: GraphNode = [0, 0, 0, 1];
const NO_EDGE: readonly [from: number, to: number] = [0, 0];
const TAU = Math.PI * 2;
const FIELD_ROWS = 96;
const LANES = 26;
const STREAKS_PER_LANE = 6;

function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(weights: readonly number[], total: number, value: number): number {
  let remaining = value * total;
  for (let index = 0; index < weights.length; index += 1) {
    remaining -= weights[index] ?? 0;
    if (remaining <= 0) return index;
  }
  return weights.length - 1;
}

/**
 * Builds every particle's position in all four formations. Particles are independent
 * samples, so drawing only the first N of them thins each formation evenly.
 */
export function buildParticles(count: number, seed = 0x51a7c0de): Float32Array {
  const random = createRandom(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(TAU * random());
  const data = new Float32Array(count * FLOATS_PER_PARTICLE);
  const nodeWeights = GRAPH_NODES.map((node) => node[3]);
  const nodeTotal = nodeWeights.reduce((sum, weight) => sum + weight, 0);
  const edgeLengths = GRAPH_EDGES.map(([from, to]) => {
    const a = GRAPH_NODES[from] ?? ORIGIN;
    const b = GRAPH_NODES[to] ?? ORIGIN;
    return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  });
  const edgeTotal = edgeLengths.reduce((sum, length) => sum + length, 0);
  // Lanes are spread evenly over the height, each at its own depth and speed.
  const lanes = Array.from({ length: LANES }, (_, index) => ({
    y: ((index + random()) / LANES) * 2 - 1,
    z: random(),
    speed: 0.6 + random() * 2.4,
  }));

  for (let index = 0; index < count; index += 1) {
    const base = index * FLOATS_PER_PARTICLE;
    const seedX = random();
    // Drives size and brightness in the shader, so the largest particles lead each streak.
    const seedY = random();
    const seedZ = random();
    const seedW = random();
    data[base + OFFSET.seed] = seedX;
    data[base + OFFSET.seed + 1] = seedY;
    data[base + OFFSET.seed + 2] = seedZ;
    data[base + OFFSET.seed + 3] = seedW;

    // Vortex: stored as radius, angle and height so the shader can keep it orbiting.
    const kind = random();
    let radius: number;
    let angle: number;
    let height: number;
    if (kind < 0.08) {
      radius = 2.6 + random() * 4.2;
      angle = random() * TAU;
      height = (random() - 0.5) * 5;
    } else if (kind < 0.17) {
      radius = Math.abs(gauss()) * 0.32;
      angle = random() * TAU;
      height = gauss() * 0.16;
    } else {
      radius = 0.3 + 2.1 * Math.pow(random(), 0.8);
      const arm = Math.floor(random() * 3);
      angle =
        random() < 0.24
          ? random() * TAU
          : arm * (TAU / 3) + radius * 1.9 + gauss() * (0.2 + 0.1 * radius);
      height = gauss() * (0.035 + 0.02 * radius);
    }
    data[base + OFFSET.vortex] = radius;
    data[base + OFFSET.vortex + 1] = angle;
    data[base + OFFSET.vortex + 2] = height;

    // Graph: both ends of a path. Nodes and dust have identical ends.
    const role = random();
    let ax: number;
    let ay: number;
    let az: number;
    let bx: number;
    let by: number;
    let bz: number;
    let phase = random();
    let speed: number;
    if (role < 0.2) {
      ax = bx = random() * 3.6 - 1.8;
      ay = by = random() * 2.2 - 1.1;
      az = bz = random() * 2.8 - 1.4;
      speed = GRAPH_DUST;
    } else if (role < 0.32) {
      const node = GRAPH_NODES[pick(nodeWeights, nodeTotal, random())] ?? ORIGIN;
      const spread = 0.042 * Math.sqrt(node[3]);
      ax = bx = node[0] + gauss() * spread;
      ay = by = node[1] + gauss() * spread;
      az = bz = node[2] + gauss() * spread;
      speed = 0;
    } else {
      const edgeIndex = pick(edgeLengths, edgeTotal, random());
      const [from, to] = GRAPH_EDGES[edgeIndex] ?? NO_EDGE;
      const a = GRAPH_NODES[from] ?? ORIGIN;
      const b = GRAPH_NODES[to] ?? ORIGIN;
      const offsetY = gauss() * 0.015;
      const offsetZ = gauss() * 0.015;
      ax = a[0];
      ay = a[1] + offsetY;
      az = a[2] + offsetZ;
      bx = b[0];
      by = b[1] + offsetY;
      bz = b[2] + offsetZ;
      // Most edge particles travel in packets so the direction of flow is readable.
      if (random() < 0.62) {
        phase = Math.floor(random() * 3) / 3 + gauss() * 0.03 + edgeIndex * 0.137;
      }
      speed = 0.085 + (edgeIndex % 4) * 0.012;
    }
    data[base + OFFSET.graphA] = ax;
    data[base + OFFSET.graphA + 1] = ay;
    data[base + OFFSET.graphA + 2] = az;
    data[base + OFFSET.graphA + 3] = phase;
    data[base + OFFSET.graphB] = bx;
    data[base + OFFSET.graphB + 1] = by;
    data[base + OFFSET.graphB + 2] = bz;
    data[base + OFFSET.graphB + 3] = speed;

    // Field: a point on one of a fixed set of rows receding from the camera.
    data[base + OFFSET.field] = random() * 2 - 1;
    data[base + OFFSET.field + 1] = Math.floor(random() * FIELD_ROWS) / (FIELD_ROWS - 1);
    data[base + OFFSET.field + 2] = random();

    // Sprint: streaks running along lanes, with slower loose particles between them.
    if (random() < 0.84) {
      const laneIndex = Math.floor(random() * LANES);
      const lane = lanes[laneIndex] ?? { y: 0, z: 0.5, speed: 1 };
      const streak = Math.floor(random() * STREAKS_PER_LANE);
      const head = (streak + 0.5) / STREAKS_PER_LANE + laneIndex * 0.618034;
      const along = head - (1 - seedY) * STREAK_LENGTH;
      data[base + OFFSET.sprint] = along - Math.floor(along);
      data[base + OFFSET.sprint + 1] = lane.y + gauss() * 0.004;
      data[base + OFFSET.sprint + 2] = lane.z + gauss() * 0.006;
      data[base + OFFSET.sprint + 3] = lane.speed;
    } else {
      data[base + OFFSET.sprint] = random();
      data[base + OFFSET.sprint + 1] = random() * 2 - 1;
      data[base + OFFSET.sprint + 2] = random();
      data[base + OFFSET.sprint + 3] = 0.25 + random() * 0.9;
    }
  }

  return data;
}
