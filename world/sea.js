// The bay's toys: a diving tower off the beach's north edge, a duck swim ring
// and a jet ski bobbing on the water. The tower is ground of its own — walk up
// its steps and jump — while the floats are built in their own groups so they
// can rock.
import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';

const WATER = -0.3; // the open sea surface (engine sea sheet sits at -0.32)
const OAK = { tex: 'oak' }, WALNUT = { tex: 'walnut' }, STEEL = { tex: 'steel' };
const paint = tint => ({ tex: 'paint', tint });
const WHITE = paint(0xf1efe9), RED = paint(0xc94f43), BLACK = paint(0x2f3438);
const YELLOW = paint(0xf2c53d), ORANGE = paint(0xe8862f);

// The tower's walkable surfaces, beach step first: 0.45 m rises from the sand.
// It stands at the island's north edge, so a jump off the platform lands in
// the sea (the island ends at z = 31).
const TOWER = { x0: 13.5, x1: 16.5 };
const LEVELS = [
  { ...TOWER, z0: -25.5, z1: -24.8, y: 0.45 },
  { ...TOWER, z0: -26.2, z1: -25.5, y: 0.9 },
  { ...TOWER, z0: -26.9, z1: -26.2, y: 1.35 },
  { ...TOWER, z0: -27.6, z1: -26.9, y: 1.8 },
  { ...TOWER, z0: -31.3, z1: -27.6, y: 2.25 },
];

export function buildSeaToys(layer, materials) {
  const root = new THREE.Group(); root.name = 'sea-toys';
  const box = (x, y, z, w, h, d, look, opts = {}) => B.box(x, y, z, w, h, d, look, { shadow: false, ...opts });
  let B = null;
  function part(name, x, y, z, build) {
    const outer = B; B = new BoxBatch(layer); build();
    const group = new THREE.Group(); group.name = name; group.position.set(x, y, z);
    for (const m of B.build(materials)) group.add(m);
    B = outer; root.add(group); return group;
  }

  // The diving tower: oak treads on timber piles, rails on three sides.
  part('sea-tower', 0, 0, 0, () => {
    for (const [z0, z1, y] of LEVELS.map(({ z0, z1, y }) => [z0, z1, y])) {
      box(15, y - 0.12, (z0 + z1) / 2, 3, 0.12, z1 - z0, OAK);
      box(15, y - 0.62, (z0 + z1) / 2, 2.7, 0.5, z1 - z0 - 0.2, WALNUT);
    }
    for (const [px, pz] of [[13.7, -25.3], [16.3, -25.3], [13.7, -31], [16.3, -31]]) box(px, -3, pz, 0.18, 5.35, 0.18, WALNUT);
    for (const px of [13.65, 16.35]) for (const pz of [-25.2, -27.2]) box(px, -3, pz, 0.15, 3.3, 0.15, WALNUT);
    for (const px of [13.6, 16.4]) {
      for (const pz of [-28.5, -31.1]) box(px, 2.25, pz, 0.09, 1.05, 0.09, STEEL);
      box(px, 3.2, -29.8, 0.07, 0.07, 2.7, STEEL);
    }
    for (const px of [13.7, 16.3]) box(px, 3.2, -31.2, 2.8, 0.07, 0.07, STEEL);
    for (const px of [14.3, 15, 15.7]) box(px, 2.25, -31.15, 0.09, 1.05, 0.09, STEEL);
    box(15, 3.2, -31.15, 2.9, 0.07, 0.07, STEEL);
  });

  // A duck swim ring riding the swell off the beach.
  const duck = part('sea-duck', 0.5, WATER - 0.08, -33.5, () => {
    box(-0.62, 0, 0, 0.42, 0.35, 2.2, YELLOW);
    box(0.62, 0, 0, 0.42, 0.35, 2.2, YELLOW);
    box(0, 0, 0.92, 1.66, 0.35, 0.36, YELLOW);
    box(0, 0, -0.92, 1.66, 0.35, 0.36, YELLOW);
    box(0, 0.32, 0.78, 0.46, 0.52, 0.42, YELLOW);
    box(0, 0.82, 0.84, 0.6, 0.5, 0.58, YELLOW);
    box(0, 0.76, 1.24, 0.34, 0.15, 0.3, ORANGE);
    for (const s of [-1, 1]) box(s * 0.31, 1.02, 0.98, 0.07, 0.13, 0.08, BLACK);
  });

  // A jet ski moored off the beach's west end.
  const ski = part('sea-ski', -14, WATER - 0.12, -33, () => {
    box(0, 0, 0, 1.15, 0.45, 2.6, WHITE);
    box(0, 0.12, 1.5, 0.78, 0.32, 0.8, WHITE);
    box(0, 0.45, -0.1, 1, 0.12, 2, RED);
    for (const s of [-1, 1]) box(s * 0.58, 0.1, -0.1, 0.07, 0.2, 2.3, RED);
    box(0, 0.57, -0.35, 0.5, 0.32, 1.3, BLACK);
    box(0, 0.57, 0.72, 0.12, 0.5, 0.12, BLACK);
    box(0, 1.04, 0.75, 0.72, 0.1, 0.1, BLACK);
  });
  ski.rotation.y = -0.6;

  const boxes = LEVELS.map(({ x0, x1, z0, z1, y }) => ({
    rect: { site: 'jump', x0, x1, z0, z1, y },
    box: new THREE.Box3(new THREE.Vector3(x0, y - 0.15, z0), new THREE.Vector3(x1, y + 0.15, z1)),
  }));
  const hit = new THREE.Vector3();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let t = 0;

  return {
    group: root,
    ski,
    duck,
    foot: { x: 15, z: -25.2 },
    levels(x, z, out) {
      for (const { rect } of boxes) {
        if (x >= rect.x0 && x <= rect.x1 && z >= rect.z0 && z <= rect.z1) out.push(rect);
      }
    },
    pick(ray) {
      let best = null;
      for (const { box, rect } of boxes) {
        if (ray.intersectBox(box, hit)) {
          const d = hit.distanceTo(ray.origin);
          if (!best || d < best.t) best = { t: d, point: hit.clone(), site: rect.site };
        }
      }
      return best;
    },
    spots: () => [{ x: 15, z: -25.2 }],
    update(dt) {
      if (reduced.matches) return;
      t += dt;
      duck.position.y = WATER - 0.08 + Math.sin(t * 0.9) * 0.06;
      duck.rotation.z = Math.sin(t * 0.7) * 0.05;
      duck.rotation.x = Math.sin(t * 0.5) * 0.03;
    },
  };
}
