import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../vendor/three/three.module.min.js';
import { createReflectionLandMask, reflectionFootprint } from '../world/reflection-land-mask.js';

const source = readFileSync(new URL('../world/reflection-detail.js', import.meta.url), 'utf8')
  .replace("from 'three'", `from '${new URL('../vendor/three/three.module.min.js', import.meta.url).href}'`)
  .replace("from './reflection-land-mask.js'", `from '${new URL('../world/reflection-land-mask.js', import.meta.url).href}'`);
const { createReflectionDetail } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function fixture(surface = false) {
  const scene = new THREE.Scene(), parent = new THREE.Group(); scene.add(parent);
  const geometry = new THREE.BoxGeometry(1, 1, 1), material = new THREE.MeshBasicMaterial();
  let mesh;
  if (surface) {
    const positions = [], indices = [];
    for (const [column, height] of [[160, 0.5], [120, 25]]) {
      const offset = positions.length / 3;
      for (let index = 0; index < geometry.attributes.position.count; index++) positions.push(geometry.attributes.position.getX(index) + column, geometry.attributes.position.getY(index) + height, geometry.attributes.position.getZ(index) + 18);
      for (const index of geometry.index.array) indices.push(index + offset);
    }
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices);
    geometry.setAttribute('tileLayer', new THREE.Float32BufferAttribute(new Float32Array(positions.length / 3), 1));
    mesh = new THREE.Mesh(geometry, material);
  } else {
    geometry.setAttribute('iLayers', new THREE.InstancedBufferAttribute(new Float32Array(6), 3));
    mesh = new THREE.InstancedMesh(geometry, material, 2);
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(160, 0.5, 18));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(120, 25, 18));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.setColorAt(0, new THREE.Color(0xff0000)); mesh.setColorAt(1, new THREE.Color(0x00ff00));
  }
  parent.add(mesh); scene.updateMatrixWorld();
  const grid = { min: [-60, -20, -80], size: [310, 72, 170], opaqueAt: column => column >= 85 };
  const detail = createReflectionDetail({ scene, grid, level: -0.32 });
  const copy = parent.children.find(child => child.userData.reflectionSource === mesh);
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 400);
  camera.position.set(0, -12.64, 18); camera.lookAt(160, -7.64, 18); camera.updateMatrixWorld();
  return { scene, parent, mesh, copy, detail, camera, grid };
}

test('instanced reflection preserves tall geometry and caches unchanged uploads', () => {
  const { mesh, copy, detail, camera } = fixture();
  const original = [...mesh.instanceMatrix.array];
  detail.beginReflection(camera);
  assert.equal(mesh.visible, false); assert.equal(copy.count, 1);
  assert.equal(copy.instanceMatrix.array[12], 120);
  const version = copy.instanceMatrix.version;
  detail.endReflection(); assert.equal(mesh.visible, true); assert.equal(copy.visible, false);
  detail.beginReflection(camera); assert.equal(copy.instanceMatrix.version, version);
  detail.endReflection(); assert.deepEqual([...mesh.instanceMatrix.array], original);
});

test('same count with different selected members updates matrices and colors', () => {
  const { mesh, copy, detail, camera } = fixture();
  detail.beginReflection(camera); detail.endReflection(); const version = copy.instanceMatrix.version;
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(121, 25, 18));
  mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(160, 0.5, 18)); mesh.instanceMatrix.needsUpdate = true;
  detail.beginReflection(camera);
  assert.equal(copy.count, 1); assert.equal(copy.instanceMatrix.array[12], 121);
  assert.ok(copy.instanceMatrix.version > version);
  assert.equal(copy.instanceColor.array[0], 1); detail.endReflection();
});

test('attribute-only changes upload without stale color or layer data', () => {
  const { mesh, copy, detail, camera } = fixture();
  detail.beginReflection(camera); detail.endReflection();
  mesh.setColorAt(1, new THREE.Color(0x0000ff)); mesh.instanceColor.needsUpdate = true;
  mesh.geometry.attributes.iLayers.setXYZ(1, 3, 4, 5); mesh.geometry.attributes.iLayers.needsUpdate = true;
  detail.beginReflection(camera);
  assert.deepEqual([...copy.instanceColor.array.slice(0, 3)], [0, 0, 1]);
  assert.deepEqual([...copy.geometry.attributes.iLayers.array.slice(0, 3)], [3, 4, 5]); detail.endReflection();
});

test('LOD count and parent transforms invalidate selection', () => {
  const { mesh, parent, scene, copy, detail, camera } = fixture();
  detail.beginReflection(camera); detail.endReflection();
  mesh.count = 1; detail.beginReflection(camera); assert.equal(copy.count, 0); detail.endReflection();
  mesh.count = 2; detail.beginReflection(camera); assert.equal(copy.count, 1); detail.endReflection();
  parent.position.y = 100; scene.updateMatrixWorld(); detail.beginReflection(camera);
  assert.equal(mesh.visible, true); assert.equal(copy.visible, false); detail.endReflection();
});

test('camera motion and projection changes match uncached classification', () => {
  const current = fixture(); current.detail.beginReflection(current.camera); current.detail.endReflection();
  for (const [column, fov] of [[30, 46], [30, 20], [-50, 65]]) {
    const fresh = fixture();
    for (const item of [current, fresh]) {
      item.camera.position.x = column; item.camera.fov = fov; item.camera.updateProjectionMatrix(); item.camera.lookAt(140, 0, 18); item.camera.updateMatrixWorld();
      item.detail.beginReflection(item.camera);
    }
    assert.equal(current.mesh.visible, fresh.mesh.visible);
    if (!current.mesh.visible) {
      assert.equal(current.copy.count, fresh.copy.count);
      assert.deepEqual([...current.copy.instanceMatrix.array.slice(0, current.copy.count * 16)], [...fresh.copy.instanceMatrix.array.slice(0, fresh.copy.count * 16)]);
    }
    current.detail.endReflection(); fresh.detail.endReflection();
  }
});

test('hidden ancestors, layers, warmup and failure restoration retain source state', () => {
  const { mesh, parent, copy, detail, camera } = fixture();
  for (const mode of ['hidden', 'layer', 'warmup']) {
    parent.visible = mode !== 'hidden'; mesh.layers.set(mode === 'layer' ? 1 : 0); detail.warmup(mode === 'warmup');
    detail.beginReflection(camera); assert.equal(mesh.visible, true); assert.equal(copy.visible, false); detail.endReflection();
  }
  parent.visible = true; mesh.layers.set(0); detail.warmup(false);
  assert.throws(() => { try { detail.beginReflection(camera); throw new Error('render failure'); } finally { detail.endReflection(); } }, /render failure/);
  assert.equal(mesh.visible, true); assert.equal(copy.visible, false);
});

test('replaced or deformed geometry uses the original conservatively', () => {
  for (const surface of [false, true]) {
    const { mesh, copy, detail, camera } = fixture(surface);
    detail.beginReflection(camera); detail.endReflection(); mesh.geometry.attributes.position.needsUpdate = true;
    detail.beginReflection(camera); assert.equal(mesh.visible, true); assert.equal(copy.visible, false); detail.endReflection();
  }
});

test('surface selection caches index uploads and handles moving parents', () => {
  const { mesh, parent, scene, copy, detail, camera } = fixture(true);
  detail.beginReflection(camera); assert.equal(mesh.visible, false); assert.ok(copy.geometry.drawRange.count < mesh.geometry.index.count);
  const version = copy.geometry.index.version; detail.endReflection();
  detail.beginReflection(camera); assert.equal(copy.geometry.index.version, version); detail.endReflection();
  parent.position.y = 100; scene.updateMatrixWorld(); detail.beginReflection(camera);
  assert.equal(mesh.visible, true); detail.endReflection();
});

test('explicit invalidation refreshes the land mask after terrain edits', () => {
  const { mesh, detail, camera, grid } = fixture();
  detail.beginReflection(camera); detail.endReflection();
  grid.opaqueAt = () => false; detail.invalidate(); detail.beginReflection(camera);
  assert.equal(mesh.visible, true); detail.endReflection();
  assert.ok(detail.cacheBufferBytes > 0);
});

test('all-visible frames do not upload a redundant reflection copy', () => {
  const { parent, scene, copy, detail, camera } = fixture();
  parent.position.y = 100; scene.updateMatrixWorld();
  const version = copy.instanceMatrix.version;
  detail.beginReflection(camera); detail.endReflection();
  assert.equal(copy.instanceMatrix.version, version);
});

test('grouped filtering never drops an instance retained by the original per-instance test', () => {
  const scene = new THREE.Scene(), geometry = new THREE.BoxGeometry(1, 1, 1), total = 180;
  geometry.setAttribute('iLayers', new THREE.InstancedBufferAttribute(new Float32Array(total * 3), 3));
  const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), total), matrix = new THREE.Matrix4();
  let seed = 17;
  const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
  for (let index = 0; index < total; index++) mesh.setMatrixAt(index, matrix.makeRotationY(random() * Math.PI).scale(new THREE.Vector3(1 + random() * 8, 1 + random() * 25, 1 + random() * 8)).setPosition(85 + random() * 140, random() * 10, -60 + random() * 120));
  mesh.instanceMatrix.needsUpdate = true; scene.add(mesh); scene.updateMatrixWorld();
  const grid = { min: [-60, -20, -80], size: [310, 72, 170], opaqueAt: (column, height, row) => column >= 85 && !(column > 140 && column < 155 && row > 0 && row < 15) };
  const land = createReflectionLandMask(grid), detail = createReflectionDetail({ scene, grid, level: -0.32 });
  const copy = scene.children.find(child => child.userData.reflectionSource === mesh);
  const camera = new THREE.PerspectiveCamera(46, 1.6, 0.1, 400), projection = new THREE.Matrix4(), inverse = new THREE.Matrix4(), bounds = new THREE.Box3(), footprint = {};
  for (let step = 0; step < 24; step++) {
    camera.position.set(Math.sin(step) * 50, -2 - step, 60 * Math.cos(step)); camera.lookAt(160, -8, 0); camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); inverse.copy(projection).invert();
    const expected = [];
    for (let index = 0; index < total; index++) {
      matrix.fromArray(mesh.instanceMatrix.array, index * 16); bounds.copy(geometry.boundingBox).applyMatrix4(matrix);
      if (!(bounds.max.y < -0.32 || reflectionFootprint(camera, projection, inverse, bounds, -0.32, footprint) && land.covers(footprint))) expected.push(index);
    }
    detail.beginReflection(camera);
    const actual = mesh.visible ? mesh : copy;
    assert.ok(actual.count >= expected.length);
    for (const index of expected) {
      const column = mesh.instanceMatrix.array[index * 16 + 12];
      assert.ok(Array.from({ length: actual.count }, (_, offset) => actual.instanceMatrix.array[offset * 16 + 12]).includes(column), `Missing instance ${index}, camera ${step}`);
    }
    detail.endReflection();
  }
});
