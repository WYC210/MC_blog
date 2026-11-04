import { RESIDENT_HOME } from './layout.js';
import { addRestPoint } from './rest-points.js';

export function furnishIKUN({ B, obstacles, bakes }) {
  const { bed } = RESIDENT_HOME;
  const oak = { tex: 'oak' }, linen = { tex: 'linen', tint: 0xe5dfd0 };
  B.box(bed.x, 4.05, bed.z, 1.38, 0.22, 2.2, oak);
  B.box(bed.x, 4.27, bed.z, 1.3, 0.25, 2.12, linen);
  B.box(bed.x, 4.52, bed.z + 0.3, 1.31, 0.04, 1.5, { tex: 'linen', tint: 0x8a9a88 });
  B.box(bed.x, 4.52, bed.z - 0.75, 1.08, 0.12, 0.42, linen);
  B.box(bed.x, 4.05, bed.z - 1.13, 1.46, 0.85, 0.1, oak);
  obstacles.push({ x0: bed.x - 0.75, x1: bed.x + 0.75, z0: bed.z - 1.25, z1: bed.z + 1.2, floor: 4 });
  addRestPoint(bed);
  bakes.push({ id: 'ikun-bedside', position: [bed.x, 5.3, bed.z - 0.6], power: 0.65, radius: 3, direction: [0, -1, 0] });
}
