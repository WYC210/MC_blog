import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { SURFACE_TILES } from './material-palette.js';

export function buildMaterialReview({ layer, materials }) {
  const selected = new URLSearchParams(location.search).get('materials');
  if (!selected || selected === '0') return null;
  const batch = new BoxBatch(layer), center = -45, row = 7;
  const base = { tex: 'paint', tint: 0xc7c8c3 };
  batch.box(center, 0.22, row + 0.3, 13.8, 0.18, 3.7, base);
  const samples = ['wood', 'stone', 'sand', 'metal', 'cloth', 'rope'].map((id, index) => ({
    id, x: center - 5 + index * 2, y: 1.05, z: row,
  }));
  for (const sample of samples) batch.box(sample.x, 0.4, row, 1.7, 0.22, 1.6, { tex: 'paint', tint: 0x555d60 });

  const wood = { tex: SURFACE_TILES.wood, tint: 0xc3a377 };
  const timber = { tex: SURFACE_TILES.timber, top: SURFACE_TILES.endgrain, bottom: SURFACE_TILES.endgrain, tint: 0xba956c };
  batch.box(samples[0].x, 0.66, row, 1.3, 0.1, 1.2, wood);
  batch.box(samples[0].x - 0.4, 0.76, row - 0.15, 0.26, 0.7, 0.26, timber);
  batch.box(samples[0].x + 0.25, 0.76, row, 0.7, 0.42, 0.85, wood);
  batch.box(samples[0].x + 0.25, 1.19, row, 0.7, 0.025, 0.85, wood);

  batch.box(samples[1].x - 0.36, 0.64, row, 0.62, 0.83, 1.05, { tex: SURFACE_TILES.stone, tint: 0xa5a49e });
  batch.box(samples[1].x + 0.36, 0.64, row, 0.62, 0.55, 1.05, { tex: SURFACE_TILES.smooth, tint: 0xc3c1b8 });
  batch.box(samples[1].x + 0.36, 1.2, row, 0.62, 0.045, 1.05, { tex: 'prada_marble' });

  batch.box(samples[2].x, 0.64, row, 1.4, 0.12, 1.35, wood);
  batch.box(samples[2].x, 0.77, row, 1.22, 0.07, 1.17, { tex: 'sand' });
  for (let edge = -1; edge <= 1; edge += 2) {
    batch.box(samples[2].x + edge * 0.67, 0.76, row, 0.06, 0.13, 1.35, wood);
    batch.box(samples[2].x, 0.76, row + edge * 0.645, 1.35, 0.13, 0.06, wood);
  }

  const metal = { tex: 'stainless' }, chrome = { tex: 'chrome' };
  batch.box(samples[3].x, 0.64, row, 1.22, 0.1, 1.16, metal);
  batch.box(samples[3].x, 0.74, row - 0.32, 1.18, 0.75, 0.055, metal);
  batch.box(samples[3].x + 0.44, 0.74, row + 0.12, 0.07, 0.65, 0.65, { tex: 'black_metal' });
  for (const offset of [-0.48, 0.48]) batch.box(samples[3].x + offset, 1.34, row - 0.275, 0.065, 0.065, 0.04, chrome);
  batch.box(samples[3].x - 0.24, 0.76, row + 0.22, 0.38, 0.24, 0.48, { ...metal, emissive: 0.18 });

  const cloth = { tex: SURFACE_TILES.cloth, tint: 0xd9d6c5 };
  batch.box(samples[4].x, 0.64, row, 1.25, 0.1, 1.1, wood);
  batch.box(samples[4].x, 0.74, row, 1.12, 0.14, 1, cloth);
  batch.box(samples[4].x + 0.11, 0.89, row - 0.06, 0.86, 0.1, 0.83, cloth);
  batch.box(samples[4].x + 0.1, 0.88, row + 0.37, 0.84, 0.025, 0.035, { ...cloth, tint: 0xa7a896 });

  const rope = { tex: SURFACE_TILES.rope, tint: 0xc9b896 };
  batch.box(samples[5].x, 0.64, row, 1.25, 0.1, 1.1, wood);
  for (let strand = 0; strand < 3; strand++) for (let segment = 0; segment < 40; segment++) {
    const phase = segment / 40 * Math.PI * 2, twist = phase * 7 + strand * Math.PI * 2 / 3;
    const radius = 0.34 + Math.cos(twist) * 0.027;
    batch.box(samples[5].x + Math.cos(phase) * radius, 0.78 + Math.sin(twist) * 0.027, row + Math.sin(phase) * radius,
      0.035, 0.035, 0.065, rope, { ry: -phase });
  }
  for (let strand = 0; strand < 3; strand++) for (let segment = 0; segment < 28; segment++) {
    const phase = segment * 0.65 + strand * Math.PI * 2 / 3;
    batch.box(samples[5].x + 0.4 + Math.cos(phase) * 0.025, 0.78 + segment * 0.026, row + 0.24 + Math.sin(phase) * 0.025,
      0.032, 0.038, 0.032, rope, { ry: phase });
  }
  const root = new THREE.Group(); root.name = 'material-review';
  for (const mesh of batch.build(materials)) root.add(mesh);
  const overview = { position: [center, 3.2, row + 12.8], portrait: [center, 4.8, row + 30], look: [center, 1, row] };
  return {
    root, samples, selected,
    focus(id, rig, portrait = false) {
      const sample = samples.find(entry => entry.id === id);
      if (sample) rig.showcase([sample.x + 1.15, 1.7, row + 2.2], [sample.x, 1, row]);
      else rig.showcase(portrait ? overview.portrait : overview.position, overview.look);
    },
  };
}
