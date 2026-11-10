import assert from 'node:assert/strict';
import test from 'node:test';
import { buildQinDistanceDetail } from '../world/qin-distance-detail.js';

function box(size, { tag = null, shadow = true, emissive = 0 } = {}) {
  return { matrix: { elements: [size, 0, 0, 0, 0, size, 0, 0, 0, 0, size, 0, 0, 0, 0, 1] }, tag, shadow, emissive };
}

function batch(items) {
  return { items,
    build() {
      const meshes = [];
      for (const list of Object.values(this.items)) for (const shadow of [true, false]) {
        const entries = list.filter(item => item.shadow === shadow);
        if (entries.length) meshes.push({ entries, count: entries.length });
      }
      return meshes;
    },
  };
}

test('distant Qin details preserve material/shadow batches, actors, lights and large structures', () => {
  const small = box(0.2), large = box(4), lamp = box(0.1, { emissive: 1, shadow: false });
  const guard = box(0.1, { tag: 'qin-retinue:0:hand' }), emperor = box(0.1, { tag: 'qin-wanderer:eye', shadow: false });
  const source = batch({ opaque: [small, large, guard, box(0.2, { shadow: false }), lamp, emperor], metal: [], glass: [box(0.2, { shadow: false })] });
  const detail = buildQinDistanceDetail(source, {}), camera = { position: { x: -50, y: 30, z: 0 } };
  const arrays = detail.meshes.map(mesh => mesh.entries);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [3, 3, 1]);
  detail.update(camera);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [2, 2, 0]);
  assert.deepEqual(detail.meshes[0].entries.slice(0, 2), [large, guard]);
  assert.deepEqual(detail.meshes[1].entries.slice(0, 2), [lamp, emperor]);
  camera.position.x = 90; detail.update(camera);
  assert.deepEqual(detail.meshes.map(mesh => mesh.count), [3, 3, 1]);
  detail.meshes.forEach((mesh, index) => assert.equal(mesh.entries, arrays[index]));
});

test('Qin detail switching uses distance to the coast and hysteresis without repeated writes', () => {
  const detail = buildQinDistanceDetail(batch({ opaque: [box(4), box(0.1)] }), {});
  const camera = { position: { x: -8, y: 200, z: 0 } };
  let count = 2, writes = 0;
  Object.defineProperty(detail.meshes[0], 'count', { get: () => count, set(value) { count = value; writes++; } });
  detail.update(camera); assert.equal(detail.distant, false);
  camera.position.x = -20; detail.update(camera); assert.equal(detail.distant, true);
  camera.position.x = -8;
  for (let frame = 0; frame < 100; frame++) detail.update(camera);
  assert.equal(detail.distant, true); assert.equal(writes, 1);
  camera.position.x = 0; detail.update(camera); assert.equal(detail.distant, false);
  camera.position.x = 160; camera.position.z = -180; detail.update(camera); assert.equal(detail.distant, true);
  camera.position.z = 0; detail.update(camera); assert.equal(detail.distant, false);
  assert.equal(writes, 4);
});
