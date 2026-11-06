import { MOODS } from '@engine/world/stage.js';
import { FOUNTAIN, ORIGIN_GONGLU } from './layout.js';

const WOOD = { tex: 'walnut' };
const METAL = { tex: 'black_metal', tint: 0x68716a };
const STONE = { tex: 'travertine', tint: 0xe3e5dc };
const WARM = { tex: 'paint', tint: 0xffdda4, emissive: 0.7 };

export function buildNightLighting({ B: batch, obstacles, bakes }) {
  Object.assign(MOODS.night, {
    sunIntensity: 0.42,
    hemiSky: 0xb0bac8,
    hemiGround: 0x8d867d,
    hemiIntensity: 1.15,
    exposure: 1.14,
  });

  const box = (positionX, bottom, positionZ, width, height, depth, look) =>
    batch.box(positionX, bottom, positionZ, width, height, depth, look, { tag: 'night-lighting' });
  const bake = (id, positionX, height, positionZ, power, radius, direction = null) =>
    bakes.push({ id: `night-${id}`, position: [positionX, height, positionZ], power, radius, direction });

  function lantern(positionX, bottom, positionZ, size = 1) {
    box(positionX, bottom, positionZ, 0.34 * size, 0.055 * size, 0.34 * size, METAL);
    box(positionX, bottom + 0.055 * size, positionZ, 0.23 * size, 0.26 * size, 0.23 * size, WARM);
    for (const offsetX of [-0.135, 0.135]) for (const offsetZ of [-0.135, 0.135]) {
      box(positionX + offsetX * size, bottom + 0.055 * size, positionZ + offsetZ * size, 0.035 * size, 0.28 * size, 0.035 * size, METAL);
    }
    box(positionX, bottom + 0.315 * size, positionZ, 0.38 * size, 0.06 * size, 0.38 * size, METAL);
  }

  function bollard(id, positionX, positionZ, stone = false) {
    box(positionX, 0.02, positionZ, 0.4, 0.09, 0.4, STONE);
    box(positionX, 0.11, positionZ, stone ? 0.24 : 0.16, 0.61, stone ? 0.24 : 0.16, stone ? STONE : WOOD);
    lantern(positionX, 0.72, positionZ);
    bake(id, positionX, 0.94, positionZ, stone ? 0.75 : 0.95, stone ? 6.5 : 7.5);
    obstacles.push({ x0: positionX - 0.25, x1: positionX + 0.25, z0: positionZ - 0.25, z1: positionZ + 0.25, level: 0, floor: 0 });
  }

  for (const [index, position] of [
    [-1.1, -19], [2.1, -13], [2.1, -7], [-1.1, -1], [2.1, 5], [-1.1, 11], [2.1, 17],
    [-10.8, -13.7], [-16.2, -10.3], [-21.5, -13.7], [-21.5, -18.7],
    [-3.8, 7.5], [-8.2, 4.1],
  ].entries()) {
    bollard(`path-${index}`, ...position);
  }
  for (let index = 0; index < 4; index++) {
    const angle = Math.PI / 4 + index * Math.PI / 2, radius = FOUNTAIN.radius + 2.05;
    bollard(`plaza-${index}`, FOUNTAIN.x + Math.sin(angle) * radius, FOUNTAIN.z + Math.cos(angle) * radius, true);
  }

  function uplight(id, positionX, positionZ, power, radius, direction) {
    box(positionX, 0.02, positionZ, 0.32, 0.08, 0.32, METAL);
    box(positionX, 0.105, positionZ, 0.2, 0.025, 0.2, WARM);
    bake(id, positionX, 0.35, positionZ, power, radius, direction);
  }

  const north = ORIGIN_GONGLU.z + 14;
  const east = ORIGIN_GONGLU.x + 23;
  for (const offset of [8.5, 12.5, 17.5, 21.5]) {
    const positionX = ORIGIN_GONGLU.x + offset;
    uplight(`facade-base-${offset}`, positionX, north - 1.2, 1.8, 12, [0, 1, 0.6]);
  }
  for (const offset of [9, 21]) {
    const positionX = ORIGIN_GONGLU.x + offset;
    box(positionX, 13.5, north - 0.13, 0.12, 0.1, 0.3, METAL);
    box(positionX, 13.16, north - 0.3, 0.035, 0.4, 0.035, METAL);
    lantern(positionX, 12.74, north - 0.3, 1.1);
    bake(`facade-eaves-${offset}`, positionX, 12.95, north - 0.55, 2.6, 12, [0, -1, -0.3]);
  }
  for (const offset of [16, 26]) {
    const positionZ = ORIGIN_GONGLU.z + offset;
    uplight(`side-base-${offset}`, east + 0.8, positionZ, 1.4, 9, [-0.6, 1, 0]);
  }
  for (const positionZ of [4.25, 7.75]) {
    box(east + 0.18, 3.9, positionZ, 0.45, 0.1, 0.12, METAL);
    box(east + 0.36, 3.52, positionZ, 0.035, 0.4, 0.035, METAL);
    lantern(east + 0.36, 3.08, positionZ, 1.15);
    bake(`entrance-${positionZ}`, east + 0.55, 3.3, positionZ, 1.6, 7, [0.7, -1, 0]);
  }
  for (const [index, position] of [[-10.3, -23.5], [-26.3, -23.5]].entries()) {
    uplight(`grove-${index}`, ...position, 1.8, 9, [-0.25, 1, 0]);
  }
}
