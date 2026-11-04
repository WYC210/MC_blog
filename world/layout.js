import { blockGONGLU } from './gonglu-model.js';
import { IKUN_SIZE, IKUN_SCALE } from './ikun-model.js';

// 1 block = 1 m. x east, z south, y up.
// ISLAND covers the sand island AND the swimming bay south of it (the grid
// needs cells there for the sea floor); LAND is the terrain/coast itself.
export const ISLAND = { x0: -60, x1: 62, z0: -50, z1: 62 };
export const LAND = { x0: -36, x1: 38, z0: -26, z1: 31 };
// The swimming bay off the south beach: walk off the sand and swim. The
// engine's pool water renders over this rect (surface = the sea, -0.32) and
// the sea sheet is cut out beneath it. Spans the full island width and runs
// well out to sea.
// The swimmable water rect covers the whole ocean out past the fog — the
// engine's pool water (translucent, caustics, ripples) renders over it and
// the flat sea sheet is cut out entirely. BAY is the dug beach-entry part.
export const POOL = { x0: -400, x1: 400, z0: -400, z1: 400, water: -0.32, bed: -3 };
export const BAY = { x0: -36, x1: 36, z0: 29, z1: 56 };
export const BOARDWALK = { x0: -31, x1: 31, step: 1.5, z: 28.25, width: 1.34, depth: 1.9 };
// Swimmable water: the bay plus the ocean ring around the island (everything
// inside the grid but off the sand). The engine reads this for swimming.
export const inPool = (x, z) => {
  if (x < ISLAND.x0 || x >= ISLAND.x1 || z < ISLAND.z0 || z >= ISLAND.z1) return false;
  // the land test is inset one cell: the terrain coast sits just inside the
  // LAND border, and its border row has no blocks — it is open water.
  const inLand = x >= LAND.x0 + 1 && x < LAND.x1 - 1 && z >= LAND.z0 + 1 && z < LAND.z1 - 1;
  if (inLand) {
    return x >= BAY.x0 && x < BAY.x1 && z >= BAY.z0 && z < BAY.z1; // the bay shallows
  }
  return true; // the ocean ring
};
export const SPAWN = { x: 0.5, z: 18, heading: Math.PI };
export const PIANO = { x: -16.6, z: -0.1 };
export const COMPUTER = { x: -27.32, z: 9.8, floor: 1 };
export const STATIONS = [
  { id: 'computer', name: '电脑', en: 'Computer', icon: 'works', at: [COMPUTER.x + 2.2, COMPUTER.z], look: [COMPUTER.x, COMPUTER.z], floor: COMPUTER.floor },
  { id: 'piano', name: '钢琴', en: 'Piano', icon: 'works', at: [PIANO.x, PIANO.z + 2.2], look: [PIANO.x, PIANO.z] },
  { id: 'mailbox', name: '留言', en: 'Mailbox', icon: 'mail', at: [0.5, 23.9], look: [0.5, 25.5] },
  { id: 'portal', name: '传送门', en: 'Portal', icon: 'portal', at: [8, 23.1], look: [8, 25.5] },
];
export const MAILBOX = { x: 0.5, z: 25.5, yaw: Math.PI };
export const PORTAL = { x: 8, z: 25.5, yaw: Math.PI };
export const TREES = [
  [30, -12],  // original
  // North edge (behind buildings, forming a backdrop)
  [-28, -24], [-12, -24], [8, -24], [24, -22],
];

// A dog roams the beach and central area, following visitors around.
export const PETS = {
  dog: {
    anchors: [
      [0.5, 20],    // near spawn/mailbox
      [-10, 22],    // west beach
      [15, 22],     // east beach
      [0, 5],       // central area
      [-15, 0],     // west side
      [15, 0],      // east side
      [5, -10],     // near IKUN
    ],
    home: [0.5, 20],
  },
};

export const MODEL_ORIGIN = { x: 4, y: -1, z: -6 };
export const IKUN_CENTER = {
  x: MODEL_ORIGIN.x + IKUN_SIZE[0] * IKUN_SCALE[0] / 2,
  z: MODEL_ORIGIN.z + IKUN_SIZE[2] * IKUN_SCALE[2] / 2,
};
export const IKUN_ENTRY = { x: IKUN_CENTER.x, z: MODEL_ORIGIN.z + IKUN_SIZE[2] * IKUN_SCALE[2] + 0.65 };
export const RESIDENT_HOME = {
  approach: { x: IKUN_CENTER.x - 0.1, z: 0.8, y: 4 },
  bed: { id: 'ikun-resident-bed', name: 'IKUN 的床', en: 'IKUN bed', x: IKUN_CENTER.x + 1.45, y: 4.52, z: 0.8, floor: 4, yaw: 0, kind: 'lie' },
};
// The LeHun cottage from a litematic, hovering over the swimming bay: 18
// wide centred on the bay (x -9..8), base four metres above the water (the
// grid tops out at y = 27, so 4 is the highest the 24-layer model can sit).
// Its floor slab (model layer 7) is floor 12 over x ∈ [-7, 7), z ∈ [29, 42).
export const LEHUN_ORIGIN = { x: 1, y: 4, z: 34 };
// The giant crafting-table tower (from 工作台熔炉.litematic, model z 7..22 —
// its companion furnace tower is left out for now), on the north-west lawn.
export const ORIGIN_GONGLU = { x: -36, y: 0, z: -16 };
// The Cinnamoroll ferris wheel, rotated to face the beach, on the east lawn.
export const ORIGIN_FERRIS = { x: 18, y: 0, z: -14 };
export function floorAt(x, z) {
  const ikunX = 2 * IKUN_CENTER.x - x - MODEL_ORIGIN.x;
  const ikunZ = 2 * IKUN_CENTER.z - z - MODEL_ORIGIN.z;
  if (ikunX >= 1 && ikunX < 7 && ikunZ >= 5 && ikunZ < 13) return MODEL_ORIGIN.y + 5;
  // The LeHun hall floor and its doorway threshold — nav cell centres sit on
  // .25/.75, so the ranges must cover them (the west strip mx=1 was missed).
  if (x >= 2 && x < 17 && z >= 36 && z < 50) return 12;
  if (x >= 9 && x < 11 && z >= 50 && z < 51) return 12;
  // The giant crafting-table tower: interior floor (its foundation top) and
// the entrance step up to the porch.
  const mx = x - ORIGIN_GONGLU.x, mz = z - ORIGIN_GONGLU.z;
  // nav cell centres sit on .25/.75 — the ranges must cover them, not just
  // the integer cells (the doorway and step rows were being blocked). The
  // east wall row (centres mx 22.25/22.75) holds the side doorway; past the
  // mx <= 22 bound it read as unsupported sand and the side door was walled.
  if (mx >= 7 && mx < 23 && mz >= 14 && mz < 30) return 1;
  if (mx >= 13 && mx <= 16 && mz >= 13 && mz < 14) return 0.5; // the north entry step
  if (mx >= 13 && mx <= 17 && mz >= 30 && mz < 31) return 0.5;
  return 0;
}

// The baked lamp light covers both litematic cottages (min corner, size in
// metres, texels). The LeHun loft reaches y=27, so the volume must include
// its ceiling fixtures as well as the lower gym.
export const LIGHT_VOLUME = { min: [-30, -1, -16], extent: [68, 30, 70], size: [68, 30, 70] };
