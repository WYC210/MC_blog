import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { COASTER_PLATFORM, COASTER_STEPS } from './coaster-route.js';

const WATER = -0.3; // the open sea surface (engine sea sheet sits at -0.32)
const OAK = { tex: 'oak' }, WALNUT = { tex: 'walnut' }, STEEL = { tex: 'steel' };
const paint = tint => ({ tex: 'paint', tint });
const WHITE = paint(0xf1efe9), RED = paint(0xc94f43), BLACK = paint(0x2f3438);
const YELLOW = paint(0xf2c53d), ORANGE = paint(0xe8862f);

const LEVELS = [...COASTER_STEPS, COASTER_PLATFORM];

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

  part('coaster-station', 0, 0, 0, () => {
    for (const { x0, x1, z0, z1, y } of LEVELS) {
      box((x0 + x1) / 2, y - 0.16, (z0 + z1) / 2, x1 - x0, 0.16, z1 - z0, OAK);
      box((x0 + x1) / 2, y - 0.36, (z0 + z1) / 2, x1 - x0 - 0.2, 0.2, z1 - z0, WALNUT);
    }
    for (const column of [8.8, 12.2, 17.8, 21.2]) for (const row of [-25.1, -30.6, -36.2]) {
      box(column, -3, row, 0.28, 5.25, 0.28, WALNUT);
    }
    for (const column of [8.65, 21.35]) {
      for (const row of [-25, -28.7, -32.4, -36.3]) box(column, 2.25, row, 0.1, 1.05, 0.1, STEEL);
      for (const height of [2.75, 3.25]) box(column, height, -30.65, 0.08, 0.08, 11.3, STEEL);
    }
    for (const column of [12.3, 17.7]) for (const row of [-25.2, -35.8]) box(column, 2.25, row, 0.2, 3.5, 0.2, WALNUT);
    box(15, 5.75, -30.5, 7.4, 0.22, 11.6, WALNUT);
    box(15, 5.97, -30.5, 7.7, 0.16, 11.9, { tex: 'paint', tint: 0x405954 });
    for (const column of [13.85, 16.15]) box(column, 2.252, -30.8, 0.14, 0.025, 10.5, YELLOW);
    for (const column of [9.1, 20.9]) {
      box(column, 2.25, -27, 0.36, 0.3, 1.9, WALNUT);
      box(column, 2.55, -27, 0.52, 0.15, 2.1, OAK);
    }
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
    foot: { x: 15, z: -19.6 },
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
    spots: () => [{ x: 15, z: -19.6 }],
    update(dt) {
      if (reduced.matches) return;
      t += dt;
      duck.position.y = WATER - 0.08 + Math.sin(t * 0.9) * 0.06;
      duck.rotation.z = Math.sin(t * 0.7) * 0.05;
      duck.rotation.x = Math.sin(t * 0.5) * 0.03;
    },
  };
}
