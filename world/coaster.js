import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { createCoasterRoute } from './coaster-route.js';
import { buildCoasterTrack } from './coaster-track.js';
import { buildCoasterTrain } from './coaster-train.js';
import { buildCoasterSwitch } from './coaster-switch.js';

const RAIL = { tex: 'steel', tint: 0xd0d9d6, emissive: 0.16 };
const WOOD = { tex: 'walnut' };
const FRAME = { tex: 'black_metal', tint: 0x53635f, emissive: 0.1 };
const RED = { tex: 'paint', tint: 0xa94035, emissive: 0.18 };
const GOLD = { tex: 'paint', tint: 0xffd28a, emissive: 0.65 };

export function buildCoaster({ B: batch, layer, materials, bakes }) {
  const group = new THREE.Group(); group.name = 'coasters';
  const box = (column, bottom, row, width, height, depth, look, options = {}) =>
    batch.box(column, bottom, row, width, height, depth, look, { ...options, shadow: false, tag: 'coaster-track' });
  for (const column of [13, 17]) {
    box(column, 5.45, -29, 0.5, 0.2, 0.5, GOLD);
    bakes.push({ id: `coaster-station-${column}`, position: [column, 5.35, -29], power: 2.2, radius: 9, direction: [0, -1, 0] });
  }
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 96;
  const context = canvas.getContext('2d');
  context.fillStyle = '#243c38'; context.fillRect(0, 0, 512, 96);
  context.textAlign = 'center'; context.fillStyle = '#ffe4aa'; context.font = 'bold 27px sans-serif';
  context.fillText('北岸过山车站 · 上车选线', 256, 39);
  context.font = 'bold 17px sans-serif'; context.fillText('ISLAND LOOP  /  QIN ISLAND', 256, 74);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 1.35), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  sign.position.set(15, 5.2, -24.52); group.add(sign);
  const lines = ['loop', 'qin'].map(id => {
    const route = createCoasterRoute(id), track = buildCoasterTrack(route, layer, materials);
    track.mesh.visible = id === 'qin';
    group.add(track.mesh); return { id, route, track };
  });
  const train = buildCoasterTrain(buildCar(layer), layer, materials, lines[1].route);
  const turnout = buildCoasterSwitch(batch, layer, materials);
  group.add(train.group, turnout.group);
  return { group, lines, train, turnout, sign };
}

function buildCar(layer) {
  const carBatch = new BoxBatch(layer);
  const carBox = (column, bottom, row, width, height, depth, look) =>
    carBatch.box(column, bottom, row, width, height, depth, look, { shadow: false });
  carBox(0, 0.24, 0, 1.24, 0.18, 2.05, FRAME);
  carBox(0, 0.42, 0, 1.15, 0.14, 1.95, WOOD);
  const cushion = { tex: 'leather', tint: 0x333c3c }, rubber = { tex: 'rubber', tint: 0x22282a };
  for (const offset of [-0.64, 0.64]) {
    carBox(offset, 0.42, 0, 0.13, 0.45, 2.05, RED);
    carBox(offset, 0.83, 0, 0.16, 0.06, 2.05, GOLD);
    carBox(offset, 0.39, 0, 0.16, 0.07, 2.05, RAIL);
    for (const row of [-0.7, 0.7]) {
      carBox(offset, -0.04, row, 0.18, 0.3, 0.34, rubber);
      carBox(offset * 1.13, 0.02, row, 0.05, 0.18, 0.18, RAIL);
      carBox(offset * 0.74, -0.17, row, 0.12, 0.12, 0.25, rubber);
      carBox(offset, 0.26, row, 0.21, 0.09, 0.44, FRAME);
    }
    carBox(offset, 0.87, 0.28, 0.07, 0.24, 0.07, RAIL);
  }
  for (const row of [-0.7, 0.7]) carBox(0, 0.13, row, 1.3, 0.08, 0.1, RAIL);
  carBox(0, 0.42, 0.98, 1.28, 0.48, 0.12, RED);
  carBox(0, 0.42, 1.08, 1.1, 0.3, 0.25, RED);
  carBox(0, 0.42, 1.23, 0.8, 0.16, 0.16, RED);
  carBox(0, 0.36, 1.29, 0.88, 0.08, 0.12, FRAME);
  carBox(0, 0.73, 1.05, 0.85, 0.07, 0.03, GOLD);
  carBox(0, 0.61, -0.14, 0.9, 0.15, 0.83, cushion);
  carBox(0, 0.76, -0.58, 0.94, 0.65, 0.16, cushion);
  carBox(0, 1.4, -0.58, 0.52, 0.22, 0.21, cushion);
  for (const offset of [-0.44, 0.44]) carBox(offset, 0.76, -0.47, 0.09, 0.58, 0.22, RED);
  carBox(0, 1.04, 0.28, 1.28, 0.07, 0.07, RAIL);
  carBox(0, 1.01, 0.28, 0.76, 0.13, 0.13, cushion);
  carBox(0, 1.03, 0.36, 0.16, 0.08, 0.05, GOLD);
  carBox(0, 0.19, -1.19, 0.18, 0.12, 0.38, FRAME);
  return carBatch;
}

export { createCoaster } from './coaster-ui.js';
