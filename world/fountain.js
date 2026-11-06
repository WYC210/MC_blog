import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { FOUNTAIN } from './layout.js';

const STONE = { tex: 'travertine', tint: 0xe3e5dc };
const TRIM = { tex: 'stone', tint: 0x899d9c };
const TILE = { tex: 'pool_tile', tint: 0xa4d9d6 };
const WATER = { tex: 'water', emissive: 0.22 };
const FOAM = { tex: 'paint', tint: 0xbcebf0, emissive: 0.3 };
const METAL = { tex: 'black_metal', tint: 0x53676a };
const LAMP = { tex: 'paint', tint: 0xffe5bc, emissive: 0.85 };
const WATER_Y = 0.42;

export function buildFountain({ B: batch, layer, materials, obstacles, bakes }) {
  const cell = FOUNTAIN.radius / 5.5;
  const inside = (column, row) => Math.abs(column) <= 5 && Math.abs(row) <= 5 && Math.abs(column) + Math.abs(row) <= 8;
  const box = (x, y, z, width, height, depth, look, shadow = true) =>
    batch.box(FOUNTAIN.x + x, y, FOUNTAIN.z + z, width, height, depth, look, { shadow, tag: 'fountain' });

  for (let row = -5; row <= 5; row++) {
    const half = Math.min(5, 8 - Math.abs(row));
    const width = (half * 2 + 1) * cell;
    box(0, 0.02, row * cell, width, 0.12, cell, STONE);
    obstacles.push({
      x0: FOUNTAIN.x - width / 2 - 0.05, x1: FOUNTAIN.x + width / 2 + 0.05,
      z0: FOUNTAIN.z + (row - 0.5) * cell - 0.05, z1: FOUNTAIN.z + (row + 0.5) * cell + 0.05,
      level: 0, floor: 0,
    });
    for (let column = -half; column <= half; column++) {
      if (inside(column - 1, row) && inside(column + 1, row) && inside(column, row - 1) && inside(column, row + 1)) continue;
      box(column * cell, 0.14, row * cell, cell, 0.12, cell, TRIM);
      box(column * cell, 0.26, row * cell, cell, 0.27, cell, STONE);
      box(column * cell, 0.53, row * cell, cell, 0.14, cell, STONE);
    }
    if (Math.abs(row) > 4) continue;
    const innerWidth = (Math.min(4, 7 - Math.abs(row)) * 2 + 1) * cell;
    box(0, 0.14, row * cell, innerWidth, 0.07, cell, TILE);
    box(0, WATER_Y - 0.06, row * cell, innerWidth, 0.06, cell, WATER, false);
  }

  function bowl(size, bottom, waterY) {
    const lip = 0.14;
    box(0, bottom, 0, size, 0.12, size, STONE);
    for (const side of [-1, 1]) {
      box(0, bottom + 0.12, side * (size - lip) / 2, size, 0.22, lip, STONE);
      box(side * (size - lip) / 2, bottom + 0.12, 0, lip, 0.22, size - lip * 2, STONE);
    }
    box(0, waterY - 0.04, 0, size - lip * 2, 0.04, size - lip * 2, WATER, false);
  }

  box(0, 0.2, 0, 1.05, 0.28, 1.05, TRIM);
  box(0, 0.48, 0, 0.68, 0.7, 0.68, STONE);
  box(0, 1.08, 0, 1.2, 0.14, 1.2, TRIM);
  bowl(1.95, 1.22, 1.57);
  box(0, 1.34, 0, 0.38, 0.76, 0.38, STONE);
  box(0, 2.02, 0, 0.7, 0.1, 0.7, TRIM);
  bowl(1.05, 2.12, 2.47);
  box(0, 2.24, 0, 0.2, 0.38, 0.2, METAL);
  box(0, 2.61, 0, 0.26, 0.06, 0.26, TRIM);

  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    const offsetX = Math.sin(angle), offsetZ = Math.cos(angle);
    box(offsetX * 2.18, 0.43, offsetZ * 2.18, 0.2, 0.08, 0.2, LAMP, false);
    bakes.push({
      id: `fountain-lamp-${side}`, position: [FOUNTAIN.x + offsetX * 1.9, 0.7, FOUNTAIN.z + offsetZ * 1.9],
      power: 0.9, radius: 3.5, direction: null,
    });
    const edge = FOUNTAIN.radius + 0.012;
    box(offsetX * edge, 0.47, offsetZ * edge, side % 2 ? 0.024 : 1.4, 0.045, side % 2 ? 1.4 : 0.024, LAMP, false);
    bakes.push({
      id: `fountain-rim-${side}`, position: [FOUNTAIN.x + offsetX * (edge + 0.18), 0.55, FOUNTAIN.z + offsetZ * (edge + 0.18)],
      power: 0.65, radius: 5, direction: [offsetX, -0.15, offsetZ],
    });
  }

  const waterBatch = new BoxBatch(layer);
  const drops = [], ripples = [];
  function stream(directionX, directionZ, startRadius, endRadius, startY, endY, lift, count, width, speed) {
    for (let index = 0; index < count; index++) {
      drops.push({ directionX, directionZ, startRadius, endRadius, startY, endY, lift, width, speed, phase: index / count });
      waterBatch.box(FOUNTAIN.x, startY, FOUNTAIN.z, width, width * 1.45, width, index % 5 === 0 ? FOAM : WATER, { shadow: false });
    }
  }
  for (let side = 0; side < 4; side++) {
    const angle = side * Math.PI / 2;
    const directionX = Math.sin(angle), directionZ = Math.cos(angle);
    stream(directionX, directionZ, 0, 0.35, 2.67, 2.47, 0.78, 14, 0.075, 0.7);
    stream(directionX, directionZ, 0.46, 0.75, 2.47, 1.57, 0.06, 12, 0.12, 0.9);
    stream(directionX, directionZ, 0.9, 1.82, 1.57, WATER_Y, 0.15, 16, 0.17, 0.65);
    for (let ring = 0; ring < 2; ring++) {
      ripples.push({ x: FOUNTAIN.x + directionX * 1.82, z: FOUNTAIN.z + directionZ * 1.82, phase: ring / 2 + side / 8 });
    }
  }
  for (let index = 0; index < ripples.length * 4; index++) {
    waterBatch.box(FOUNTAIN.x, WATER_Y, FOUNTAIN.z, 0.1, 0.012, 0.1, FOAM, { shadow: false });
  }

  const [mesh] = waterBatch.build(materials);
  mesh.name = 'fountain-water';
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(FOUNTAIN.x, 1.7, FOUNTAIN.z), 3.2);
  mesh.boundingBox = new THREE.Box3(
    new THREE.Vector3(FOUNTAIN.x - 2.3, WATER_Y - 0.15, FOUNTAIN.z - 2.3),
    new THREE.Vector3(FOUNTAIN.x + 2.3, 4.4, FOUNTAIN.z + 2.3),
  );
  const matrix = new THREE.Matrix4(), projection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  let elapsed = 0;
  let performance = 0, performanceTarget = 0;

  function draw() {
    let instance = 0;
    for (const drop of drops) {
      const phase = (elapsed * drop.speed + drop.phase) % 1;
      const radius = drop.startRadius + (drop.endRadius - drop.startRadius) * phase;
      const lift = drop.lift + (drop.startY > 2.6 ? performance * 0.75 : performance * 0.1);
      const height = drop.startY + (drop.endY - drop.startY) * phase * phase + lift * 4 * phase * (1 - phase);
      matrix.makeScale(drop.width, drop.width * 1.45, drop.width).setPosition(
        FOUNTAIN.x + drop.directionX * radius, height, FOUNTAIN.z + drop.directionZ * radius,
      );
      mesh.setMatrixAt(instance++, matrix);
    }
    for (const ripple of ripples) {
      const phase = (elapsed * 0.8 + ripple.phase) % 1;
      const radius = 0.04 + phase * 0.3, thickness = 0.035 * (1 - phase) + 0.004;
      for (let side = 0; side < 4; side++) {
        const alongX = side < 2, sign = side % 2 ? 1 : -1;
        matrix.makeScale(alongX ? radius * 2 : thickness, 0.012, alongX ? thickness : radius * 2).setPosition(
          ripple.x + (alongX ? 0 : sign * radius), WATER_Y + 0.012,
          ripple.z + (alongX ? sign * radius : 0),
        );
        mesh.setMatrixAt(instance++, matrix);
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
  draw();

  return {
    mesh,
    setPerformance(value) { performanceTarget = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0; },
    get performance() { return performanceTarget; },
    update(dt, camera) {
      if (!mesh.visible) return;
      camera.updateMatrixWorld();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection);
      if (!frustum.intersectsSphere(mesh.boundingSphere)) return;
      elapsed += dt;
      performance += (performanceTarget - performance) * Math.min(1, dt * 5);
      draw();
    },
  };
}
