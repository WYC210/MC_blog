import { buildTradingStudio } from './lehun-trading.js';
import { addRestPoint } from './rest-points.js';

const GROUND = 12;
const FLOOR = 19;
const ROOM = { x0: 9, x1: 18, z0: 37, z1: 50 };

const L = {
  cherry: { tex: 'paint', tint: 0xe3b0a4 },
  cherryLight: { tex: 'paint', tint: 0xefc9bc },
  pink: { tex: 'paint', tint: 0xf2afc0 },
  pinkFloor: { tex: 'paint', tint: 0xd99aaa },
  pinkDeep: { tex: 'paint', tint: 0xe393a8 },
  cream: { tex: 'paint', tint: 0xe4e4e4 },
  white: { tex: 'paint', tint: 0xcfd5d6 },
  graphite: { tex: 'paint', tint: 0x596469, emissive: 0.16 },
  frame: { tex: 'paint', tint: 0x788488, emissive: 0.12 },
  steel: { tex: 'steel' },
  linen: { tex: 'linen' },
  leaf: { tex: 'leaves' },
  terra: { tex: 'paint', tint: 0x876b62 },
  rubber: { tex: 'rubber', tint: 0x35393c },
  gymFloor: { tex: 'paint', tint: 0x718083, emissive: 0.12 },
  gymFrame: { tex: 'paint', tint: 0x93a0a2, emissive: 0.18 },
  gymGraphite: { tex: 'paint', tint: 0x707a7d, emissive: 0.14 },
  glow: (tint, emissive = 1) => ({ tex: 'paint', tint, emissive }),
};

export function furnishLeHun({ B, walk, obstacles, bakes }) {
  const foot = (x, z, w, d, level = 1) => obstacles.push({
    x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, level,
    // LeHun floats above the water, so its semantic levels (0/1) do not
    // match the absolute y values used by the navigation grid.
    floor: level === 1 ? FLOOR : GROUND,
  });
  const bake = (id, x, y, z, power, radius, direction = null) => bakes.push({
    id, position: [x, y, z], power, radius, direction,
  });
  const tread = (x, z, y) => walk.push([x, z, y, true]);
  const planes = [];

  // Ground floor: keep the original pink activity room alive below the new
  // lounge. The south doorway and the central passage stay clear for entry.
  B.box(10.5, GROUND + 0.005, 43.5, 8, 0.03, 8, L.gymFloor);
  for (const [x, z, w, d] of [
    [10.5, 39.58, 8, 0.16], [10.5, 47.42, 8, 0.16],
    [6.58, 43.5, 0.16, 8], [14.42, 43.5, 0.16, 8],
  ]) B.box(x, GROUND + 0.01, z, w, 0.02, d, L.pinkDeep);

  // Pull-up frame at the west wall.
  for (const x of [6.8, 8.0]) B.box(x, GROUND, 40.8, 0.09, 2.4, 0.09, L.gymFrame);
  B.box(7.4, GROUND + 2.32, 40.8, 1.4, 0.07, 0.07, L.gymFrame);
  B.box(7.4, GROUND + 2.32, 40.8, 0.5, 0.075, 0.075, L.pinkDeep);
  foot(7.4, 40.8, 1.6, 0.5, 0);

  // Cable tower and weight stacks at the north-east side.
  B.box(12.6, GROUND, 40.8, 2.1, 0.08, 0.8, L.gymFrame);
  for (const x of [11.95, 13.25]) {
    B.box(x, GROUND + 0.08, 40.8, 0.09, 2.2, 0.09, L.gymFrame);
    B.box(x, GROUND + 0.08, 41.05, 0.4, 0.75, 0.3, L.gymGraphite);
    for (let i = 0; i < 6; i++) B.box(x, GROUND + 0.15 + i * 0.1, 41.22, 0.3, 0.025, 0.025, L.gymFrame);
    B.box(x, GROUND + 0.8, 40.42, 0.025, 1.25, 0.025, L.pinkDeep);
    B.box(x, GROUND + 2.0, 40.6, 0.22, 0.22, 0.1, L.gymGraphite);
  }
  B.box(12.6, GROUND + 2.2, 40.8, 2.05, 0.1, 0.12, L.gymFrame);
  foot(12.6, 40.8, 2.2, 1, 0);

  // Bench and treadmill form the centre and south-east activity line.
  B.box(9.6, GROUND + 0.25, 43.0, 1.6, 0.14, 0.5, L.gymFrame);
  B.box(9.6, GROUND + 0.39, 43.0, 1.5, 0.07, 0.44, L.pink);
  for (const x of [8.95, 10.25]) B.box(x, GROUND, 43.0, 0.09, 0.25, 0.45, L.gymFrame);
  foot(9.6, 43.0, 1.7, 0.6, 0);
  addRestPoint({ id: 'lehun-gym-bench', name: '乐魂健身凳', en: 'LeHun gym bench', x: 9.6, y: GROUND + 0.46, z: 43, floor: GROUND });
  B.box(12.5, GROUND + 0.05, 45.9, 1.15, 0.18, 2.05, L.gymFrame);
  B.box(12.5, GROUND + 0.23, 45.95, 0.86, 0.035, 1.7, L.gymGraphite);
  for (const x of [11.97, 13.03]) {
    B.box(x, GROUND + 0.22, 45.07, 0.075, 1.05, 0.075, L.gymFrame);
    B.box(x, GROUND + 1.1, 45.28, 0.075, 0.06, 0.55, L.gymGraphite);
  }
  B.box(12.5, GROUND + 1.15, 45.05, 1.02, 0.32, 0.18, L.gymGraphite, { rx: -0.2 });
  B.box(12.5, GROUND + 1.24, 45.15, 0.35, 0.15, 0.025, L.pinkDeep);
  foot(12.5, 45.9, 1.25, 2.2, 0);

  // A bike, dumbbell rack and two mats use the remaining south-west corner.
  B.box(7.2, GROUND + 0.05, 45.9, 0.95, 0.18, 1.4, L.gymFrame);
  B.box(7.2, GROUND + 0.23, 45.9, 0.65, 0.035, 1.05, L.gymGraphite);
  B.box(7.2, GROUND + 0.95, 45.25, 0.38, 0.08, 0.2, L.gymGraphite);
  foot(7.2, 45.9, 1.1, 1.6, 0);
  B.box(14.0, GROUND, 43.8, 0.8, 0.55, 2.2, L.gymFrame);
  B.box(14.0, GROUND + 0.55, 43.8, 0.9, 0.06, 2.3, L.cherry);
  foot(14.0, 43.8, 1, 2.4, 0);
  for (const [x, z] of [[13.0, 43.0], [13.0, 43.8], [13.0, 44.6]]) {
    B.box(x, GROUND + 0.09, z, 0.55, 0.09, 0.09, L.steel);
    for (const dx of [-0.31, 0.31]) B.box(x + dx, GROUND + 0.04, z, 0.13, 0.2, 0.13, L.gymGraphite);
  }
  B.box(7.8, GROUND + 0.01, 38.0, 0.62, 0.02, 1.7, L.pink);
  B.box(8.75, GROUND + 0.01, 38.3, 0.62, 0.02, 1.7, L.cream);
  for (const [x, z] of [[7.8, 38], [8.75, 38.3]]) addRestPoint({ id: `lehun-mat-${x}`, name: '乐魂休息垫', en: 'LeHun exercise mat', x, y: GROUND + 0.03, z, floor: GROUND, kind: 'lie' });
  B.box(8.3, GROUND, 37.45, 1.1, 0.4, 0.35, L.cherry);
  B.box(8.3, GROUND + 0.4, 37.45, 1.2, 0.05, 0.42, L.white);
  foot(8.3, 37.45, 1.3, 0.5, 0);
  B.box(11.5, GROUND, 48.35, 1.4, 0.9, 0.5, L.cherry);
  B.box(11.5, GROUND + 0.9, 48.35, 1.55, 0.06, 0.6, L.white);
  B.box(11.2, GROUND + 0.96, 48.35, 0.09, 0.24, 0.09, L.steel);
  B.box(11.85, GROUND + 0.96, 48.35, 0.12, 0.2, 0.12, L.pink);
  foot(11.5, 48.35, 1.55, 0.7, 0);
  // The ceiling is high above the gym floor, so the main pool needs a broad
  // radius; otherwise the inverse falloff leaves the floor almost unlit.
  bake('ground-gym', 10.5, GROUND + 5.5, 43.5, 6.0, 14, [0, -1, 0]);
  bake('ground-gym-west', 7.4, GROUND + 4.8, 40.5, 4.2, 10, [0, -1, 0]);
  bake('ground-gym-east', 13.5, GROUND + 4.8, 46.5, 4.2, 10, [0, -1, 0]);
  // Warm ceiling fixtures keep the gym readable after sunset. They sit just
  // below the upper slab, so the glow is visible without exposing a lamp body.
  for (const [i, [x, z]] of [[0, [7.6, 40.2]], [1, [13.4, 40.2]], [2, [7.6, 46.5]], [3, [13.4, 46.5]]]) {
    B.box(x, GROUND + 6.72, z, 0.22, 0.08, 0.22, L.glow(0xffd9a0));
    bake('gym-ceiling-' + i, x, GROUND + 6.7, z, 5.0, 11, [0, -1, 0]);
  }

  B.box(12.25, FLOOR - 0.04, 43.0, 5.5, 0.08, 12, { tex: 'wood_floor', tint: 0xd3c9b4, emissive: 0.18 });
  for (let x = ROOM.x0; x < ROOM.x1; x++) for (let z = ROOM.z0; z < ROOM.z1; z++) {
    if (x >= 15) continue;
    tread(x, z, FLOOR);
  }

  // Thirteen half-metre steps use the full east edge of the cottage. Every
  // adjacent cell rises only 0.5 m, so the player can walk from the gym to the
  // upper landing without a jump or a one-metre ledge.
  for (let i = 0; i < 13; i++) {
    const z = 49 - i, top = 12.5 + i * 0.5;
    for (const x of [15, 16]) {
      B.box(x + 0.5, top - 0.5, z + 0.5, 1, 0.5, 1, L.cherry);
      tread(x, z, top);
    }
  }
  // The final half-step supports the player's body while turning onto the
  // upper floor; it is a landing, not a passage beyond the cottage wall.
  for (const x of [15, 16]) {
    B.box(x + 0.5, FLOOR - 0.5, 36.5, 1, 0.5, 1, L.cherry);
    tread(x, 36, FLOOR);
  }

  B.box(12.0, FLOOR, 49.42, 5.5, 0.82, 0.12, { tex: 'wood_panel', tint: 0xc5b499 });
  B.box(12.0, FLOOR + 0.82, 49.42, 5.5, 0.06, 0.16, { tex: 'paint', tint: 0x303a3d });
  B.box(17.0, FLOOR, 49.42, 1, 0.82, 0.12, { tex: 'wood_panel', tint: 0xc5b499 });
  B.box(17.0, FLOOR + 0.82, 49.42, 1, 0.06, 0.16, { tex: 'paint', tint: 0x303a3d });
  B.box(17.42, FLOOR, 43.5, 0.12, 0.82, 10.7, { tex: 'wood_panel', tint: 0xc5b499 });
  B.box(17.42, FLOOR + 0.82, 43.5, 0.16, 0.06, 10.7, { tex: 'paint', tint: 0x303a3d });

  planes.push(buildTradingStudio({ B, foot, bake, floor: FLOOR }));

  return planes;
}
