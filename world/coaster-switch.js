import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';

export function buildCoasterSwitch(batch, layer, materials) {
  const steel = { tex: 'steel', tint: 0xd0d9d6, emissive: 0.16 };
  const frame = { tex: 'black_metal', tint: 0x53635f };
  const gold = { tex: 'paint', tint: 0xffd28a, emissive: 0.35 };
  batch.box(17, 2.12, -36.7, 0.8, 0.34, 1, frame, { shadow: false });
  batch.box(16, 2.32, -36.7, 1.7, 0.1, 0.1, steel, { shadow: false });
  const blade = new BoxBatch(layer);
  for (const offset of [-0.49, 0.49]) blade.box(offset, -0.05, -1.25, 0.09, 0.1, 2.5, steel, { shadow: false });
  blade.box(1.9, -0.06, 0.2, 0.1, 0.65, 0.1, frame, { shadow: false });
  blade.box(1.9, 0.59, 0.2, 0.48, 0.24, 0.1, gold, { shadow: false });
  const group = new THREE.Group(); group.name = 'coaster-switch'; group.position.set(15, 2.56, -35.3);
  for (const mesh of blade.build(materials)) group.add(mesh);
  let selected = 'qin', angle = -0.11, target = angle;
  group.rotation.y = angle;
  return { group,
    select(id) { selected = id; target = id === 'loop' ? 0.11 : -0.11; },
    get selected() { return selected; },
    get moving() { return Math.abs(target - angle) > 1e-6; },
    update(dt) {
      if (angle === target || dt <= 0) return;
      angle += THREE.MathUtils.clamp(target - angle, -Math.min(dt, 0.1) * 0.2, Math.min(dt, 0.1) * 0.2);
      group.rotation.y = angle;
    },
  };
}
