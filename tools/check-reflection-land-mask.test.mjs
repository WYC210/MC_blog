import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import { createReflectionLandMask, reflectionFootprint } from '../world/reflection-land-mask.js';

test('land mask requires every covered cell to be opaque and preserves bays, ponds and out-of-grid water', () => {
  const grid = { min: [-10, -20, -10], size: [20, 40, 20], opaqueAt: (column, height, row) => column !== 0 || row !== 0 };
  const mask = createReflectionLandMask(grid);
  assert.equal(mask.covers({ x0: -8, x1: -2, z0: -8, z1: -2 }), true);
  assert.equal(mask.covers({ x0: -1, x1: 2, z0: -1, z1: 2 }), false);
  assert.equal(mask.covers({ x0: -11, x1: -2, z0: -8, z1: -2 }), false);
  assert.equal(mask.covers({ x0: -8, x1: 11, z0: -8, z1: -2 }), false);
  assert.equal(mask.covers({ x0: -8, x1: -7.99, z0: -8, z1: -7.99 }), true);
});

function fixture(position, target) {
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 400);
  camera.position.set(...position); camera.lookAt(...target); camera.updateMatrixWorld();
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return { camera, projection, inverse: projection.clone().invert(), footprint: {} };
}

function clipAtWater(camera, level = -0.32) {
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -level).applyMatrix4(camera.matrixWorldInverse);
  const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
  const elements = camera.projectionMatrix.elements;
  const corner = new THREE.Vector4((Math.sign(clip.x) + elements[8]) / elements[0], (Math.sign(clip.y) + elements[9]) / elements[5], -1, (1 + elements[10]) / elements[14]);
  clip.multiplyScalar(2 / clip.dot(corner));
  elements[2] = clip.x; elements[6] = clip.y; elements[10] = clip.z + 1 - 0.003; elements[14] = clip.w;
  const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return { projection, inverse: projection.clone().invert() };
}

test('oblique water clipping cannot reverse footprint rays or retain hidden inland geometry', () => {
  const original = fixture([34, -12.64, 18], [160, -7.64, 10]);
  const low = new THREE.Box3(new THREE.Vector3(148.5, 0, 52.25), new THREE.Vector3(155.5, 0.22, 59.75));
  const expected = {};
  assert.equal(reflectionFootprint(original.camera, original.projection, original.inverse, low, -0.32, expected), true);
  const clipped = clipAtWater(original.camera), actual = {};
  const center = low.getCenter(new THREE.Vector3()).applyMatrix4(clipped.projection);
  const unproject = clipped.inverse.elements;
  const worldW = unproject[3] * center.x + unproject[7] * center.y + unproject[11] * 0.5 + unproject[15];
  assert.ok(worldW < 0, 'This regression must exercise a sampled point behind the mirror camera');
  assert.equal(reflectionFootprint(original.camera, clipped.projection, clipped.inverse, low, -0.32, actual), true);
  for (const coordinate of ['x0', 'x1', 'z0', 'z1']) assert.ok(Math.abs(actual[coordinate] - expected[coordinate]) < 1e-7, coordinate);
  const land = createReflectionLandMask({ min: [-60, -20, -80], size: [310, 72, 170], opaqueAt: column => column >= 85 });
  assert.equal(land.covers(actual), true);
  const statue = new THREE.Box3(new THREE.Vector3(158, 1.45, 8), new THREE.Vector3(162, 18, 12));
  assert.equal(reflectionFootprint(original.camera, clipped.projection, clipped.inverse, statue, -0.32, actual), true);
  assert.equal(land.covers(actual), false, 'The high statue must still reflect onto real water');
});

test('a homogeneous point at infinity still defines a valid footprint ray', () => {
  const { camera, projection, inverse } = fixture([0, -12.64, 18], [160, -7.64, 18]);
  const bounds = new THREE.Box3(new THREE.Vector3(158, 0, 16), new THREE.Vector3(162, 1, 20)), expected = {}, actual = {};
  assert.equal(reflectionFootprint(camera, projection, inverse, bounds, -0.32, expected), true);
  camera.projectionMatrix.elements[10] = -0.5;
  camera.projectionMatrix.elements[14] = -0.2;
  const remapped = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), unproject = remapped.clone().invert();
  const elements = unproject.elements;
  assert.ok(Math.abs(elements[11] * 0.5 + elements[15]) < 1e-10);
  assert.equal(reflectionFootprint(camera, remapped, unproject, bounds, -0.32, actual), true);
  for (const coordinate of ['x0', 'x1', 'z0', 'z1']) assert.ok(Math.abs(actual[coordinate] - expected[coordinate]) < 1e-7, coordinate);
});

test('water clipping preserves footprint decisions across camera heights, zoom and mirrored up vectors', () => {
  const bounds = [
    new THREE.Box3(new THREE.Vector3(158, 0, 8), new THREE.Vector3(162, 1, 12)),
    new THREE.Box3(new THREE.Vector3(158, 1.45, 8), new THREE.Vector3(162, 18, 12)),
    new THREE.Box3(new THREE.Vector3(85, 0, 16), new THREE.Vector3(89, 3, 20)),
    new THREE.Box3(new THREE.Vector3(-20, 0, 16), new THREE.Vector3(-18, 3, 20)),
  ];
  for (const height of [2.5, 8, 12, 28]) for (const fov of [35, 46, 75]) for (const up of [-1, 1]) {
    const camera = new THREE.PerspectiveCamera(fov, 1.6, 0.1, 400);
    camera.position.set(34, -0.64 - height, 18); camera.up.set(0, up, 0);
    camera.lookAt(160, -7.64, 10); camera.updateMatrixWorld();
    const projection = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), inverse = projection.clone().invert();
    const clipped = clipAtWater(camera);
    for (const box of bounds) {
      const expected = {}, actual = {}, reference = reflectionFootprint(camera, projection, inverse, box, -0.32, expected);
      assert.equal(reflectionFootprint(camera, clipped.projection, clipped.inverse, box, -0.32, actual), reference);
      if (reference) for (const coordinate of ['x0', 'x1', 'z0', 'z1']) {
        assert.ok(Math.abs(actual[coordinate] - expected[coordinate]) < 1e-6, `${height}/${fov}/${up}: ${coordinate}`);
      }
    }
  }
});

test('reflection footprint preserves tall inland structures whose image falls in front of the shore', () => {
  const { camera, projection, inverse, footprint } = fixture([0, -12.64, 18], [160, -7.64, 18]);
  const land = createReflectionLandMask({ min: [-60, -20, -80], size: [310, 72, 170], opaqueAt: column => column >= 85 });
  const low = new THREE.Box3(new THREE.Vector3(158, 0, 16), new THREE.Vector3(162, 1, 20));
  assert.equal(reflectionFootprint(camera, projection, inverse, low, -0.32, footprint), true);
  assert.equal(land.covers(footprint), true);
  const tall = new THREE.Box3(new THREE.Vector3(118, 0, 16), new THREE.Vector3(122, 25, 20));
  assert.equal(reflectionFootprint(camera, projection, inverse, tall, -0.32, footprint), true);
  assert.equal(land.covers(footprint), false);
  const coast = new THREE.Box3(new THREE.Vector3(85, 0, 16), new THREE.Vector3(89, 2, 20));
  assert.equal(reflectionFootprint(camera, projection, inverse, coast, -0.32, footprint), true);
  assert.equal(land.covers(footprint), false);
});

test('uncertain horizon-crossing and behind-camera bounds are never land-culled', () => {
  const { camera, projection, inverse, footprint } = fixture([0, -2, 0], [160, -2, 0]);
  const distant = new THREE.Box3(new THREE.Vector3(190, 0, -1), new THREE.Vector3(192, 1, 1));
  assert.equal(reflectionFootprint(camera, projection, inverse, distant, -0.32, footprint), false);
  const behind = new THREE.Box3(new THREE.Vector3(-10, 0, -1), new THREE.Vector3(-8, 1, 1));
  assert.equal(reflectionFootprint(camera, projection, inverse, behind, -0.32, footprint), false);
});
