import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from '../vendor/three/three.module.min.js';
import { createQinLodSource, qinLodErrorPixels } from '../world/qin-lod.js';
import { buildQinDistanceDetail } from '../world/qin-distance-detail.js';

class Batch {
  constructor() {
    this.items = { opaque: [], metal: [], cutout: [], glass: [] };
    this.stack = [new THREE.Matrix4()];
  }
  box(column, bottom, row, width, height, depth, look = {}, options = {}) {
    const matrix = new THREE.Matrix4().makeScale(width, height, depth).setPosition(column, bottom + height / 2, row);
    matrix.premultiply(this.stack[this.stack.length - 1]);
    this.items.opaque.push({ matrix, shadow: options.shadow !== false && !look.emissive, emissive: look.emissive || 0, tag: options.tag });
  }
  build() {
    const meshes = [];
    for (const items of Object.values(this.items)) for (const shadow of [true, false]) {
      const entries = items.filter(item => item.shadow === shadow);
      if (entries.length) meshes.push({ count: entries.length, entries, castShadow: shadow, userData: { tags: entries.map(item => item.tag) } });
    }
    return meshes;
  }
}

function fixture(enabled = true) {
  const batch = new Batch(), source = createQinLodSource(() => new Batch(), enabled);
  batch.box(160, 0, 0, 4, 4, 0.2, {}, { tag: 'qin-hanfei:desk-1' });
  source.replace(batch, () => {
    for (const offset of [-1, 0, 1]) batch.box(160 + offset, 1, 0.2, 0.1, 2, 0.1);
  }, proxy => proxy.box(160, 1, 0.2, 0.1, 2, 0.1));
  batch.box(160, 0, 1, 0.1, 0.1, 0.1);
  batch.box(160, 0, 3, 0.1, 0.1, 0.1, {}, { shadow: false, tag: 'qin-wanderer:eye' });
  const detail = buildQinDistanceDetail(batch, {}, source);
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(-60, 10, 0); camera.lookAt(160, 2, 0); camera.updateMatrixWorld();
  return { batch, source, detail, camera };
}

test('proxy replaces authored static details without changing source order or actor identity', () => {
  const { detail, camera } = fixture();
  const original = detail.meshes.map(mesh => [...mesh.entries]);
  assert.equal(detail.proxy.instances, 2);
  detail.update(camera, 900);
  assert.equal(detail.proxied, true);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [0, 1]);
  assert.equal(detail.proxyMeshes[0].count, 2);
  assert.equal(detail.proxyMeshes[0].castShadow, false);
  assert.deepEqual(detail.proxyMeshes[0].userData.tags, []);
  assert.ok(detail.meshes[0].userData.tags.includes('qin-hanfei:desk-1'));
  assert.equal(detail.meshes[1].entries[0].tag, 'qin-wanderer:eye');
  camera.position.set(160, 5, 10); camera.lookAt(160, 2, 0); camera.updateMatrixWorld();
  detail.update(camera, 900);
  assert.equal(detail.proxied, false);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [5, 1]);
  assert.equal(detail.proxyMeshes[0].count, 0);
  assert.deepEqual(detail.meshes.map(mesh => mesh.entries), original);
});

test('screen error uses actual height, FOV, view direction and conservative bounds', () => {
  const { detail, camera } = fixture();
  const bounds = detail.proxy.bounds, error = detail.proxy.error;
  const base = qinLodErrorPixels(camera, 900, bounds, error);
  assert.ok(base > 0 && base < 2.5);
  assert.equal(qinLodErrorPixels(camera, 1800, bounds, error), base * 2);
  camera.fov = 15; camera.updateProjectionMatrix();
  assert.ok(qinLodErrorPixels(camera, 900, bounds, error) > 3.25);
  camera.lookAt(-200, 10, 0); camera.updateMatrixWorld();
  assert.equal(qinLodErrorPixels(camera, 900, bounds, error), Infinity);
  assert.equal(qinLodErrorPixels(camera, 0, bounds, error), Infinity);
  camera.position.set(160, 2, 0.2); camera.lookAt(160, 2, -10); camera.updateMatrixWorld();
  assert.equal(qinLodErrorPixels(camera, 900, bounds, error), Infinity);
});

test('pixel hysteresis holds the representation and zoom/force restore it immediately', () => {
  const { detail, camera } = fixture();
  const unit = qinLodErrorPixels(camera, 1, detail.proxy.bounds, detail.proxy.error);
  for (const [pixels, expected] of [[2, true], [3, true], [3.5, false], [3, false], [2, true]]) {
    detail.update(camera, pixels / unit);
    assert.equal(detail.proxied, expected);
  }
  detail.update(camera, 2 / unit, true);
  assert.equal(detail.distant, false);
  assert.equal(detail.meshes[0].count, 5);
  detail.update(camera, 2 / unit);
  assert.equal(detail.proxied, true);
  detail.update(camera);
  assert.equal(detail.proxied, false);
  assert.equal(detail.meshes[0].count, 4);
});

test('full shadows and warmup restore the selected main-pass count', () => {
  const { detail, camera } = fixture();
  detail.update(camera, 900);
  const mesh = detail.meshes[0];
  for (let frame = 0; frame < 3; frame++) {
    mesh.onBeforeShadow(); assert.equal(mesh.count, 5);
    mesh.onAfterShadow(); assert.equal(mesh.count, 0);
  }
  detail.warmup(true);
  assert.equal(mesh.count, 5); assert.equal(detail.proxyMeshes[0].count, 2);
  mesh.onBeforeShadow(); mesh.onAfterShadow(); assert.equal(mesh.count, 5);
  detail.warmup(false); assert.equal(mesh.count, 0);
  detail.update(camera, 900, true);
  detail.warmup(true); detail.warmup(false);
  assert.equal(mesh.count, 5); assert.equal(detail.proxyMeshes[0].count, 0);
});

test('disabled proxy retains the original distance policy without allocating a proxy mesh', () => {
  const { detail, camera } = fixture(false);
  assert.equal(detail.proxy, null); assert.deepEqual(detail.proxyMeshes, []);
  detail.update(camera, 900);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [4, 1]);
});

test('replacement bounds and proxy inherit the source transform', () => {
  const batch = new Batch(), source = createQinLodSource(() => new Batch());
  batch.stack[0].makeRotationY(Math.PI / 2).setPosition(10, 2, 20);
  source.replace(batch, () => batch.box(0, 0, 0, 4, 2, 1), proxy => proxy.box(0, 0, 0, 4, 2, 1));
  const proxy = source.build(batch, () => true);
  assert.deepEqual(proxy.bounds, { x0: 9.5, x1: 10.5, y0: 2, y1: 4, z0: 18, z1: 22 });
  assert.deepEqual(proxy.batch.items.opaque[0].matrix.elements, batch.items.opaque[0].matrix.elements);
});

test('moving or non-shadow parts cannot accidentally enter a static replacement', () => {
  for (const options of [{ shadow: false }, { tag: 'qin-retinue:0:hand' }]) {
    const batch = new Batch(), source = createQinLodSource(() => new Batch());
    assert.throws(() => source.replace(batch, () => batch.box(0, 0, 0, 1, 1, 1, {}, options), () => {}), /static shadow-casting/);
  }
});
