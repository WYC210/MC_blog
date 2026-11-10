import { QIN_ISLAND } from './qin-island-layout.js';
import { qinLodErrorPixels } from './qin-lod.js';

function prominent(item) {
  if (item.emissive || item.tag?.startsWith('qin-retinue:') || item.tag?.startsWith('qin-wanderer:')) return true;
  const elements = item.matrix.elements;
  return Math.max(
    elements[0] ** 2 + elements[1] ** 2 + elements[2] ** 2,
    elements[4] ** 2 + elements[5] ** 2 + elements[6] ** 2,
    elements[8] ** 2 + elements[9] ** 2 + elements[10] ** 2,
  ) >= 1;
}

export function buildQinDistanceDetail(batch, materials, source = null) {
  const counts = [];
  for (const [kind, items] of Object.entries(batch.items)) {
    const major = [], minor = [];
    for (const item of items) (prominent(item) ? major : minor).push(item);
    batch.items[kind] = major.concat(minor);
    for (const shadow of [true, false]) {
      const full = items.filter(item => item.shadow === shadow).length;
      if (full) counts.push({ kind, shadow, full, far: major.filter(item => item.shadow === shadow).length, main: full });
    }
  }
  const meshes = batch.build(materials);
  const proxy = source?.build(batch, prominent), proxyMeshes = proxy ? proxy.batch.build(materials) : [];
  const proxyCounts = proxyMeshes.map(mesh => mesh.count);
  for (const mesh of proxyMeshes) {
    mesh.name = 'qin-far-proxy'; mesh.castShadow = false; mesh.count = 0; mesh.userData.tags = [];
  }
  for (let index = 0; index < meshes.length; index++) {
    const mesh = meshes[index], state = counts[index];
    if (!mesh.castShadow) continue;
    const before = mesh.onBeforeShadow, after = mesh.onAfterShadow;
    mesh.onBeforeShadow = function(renderer, object, camera, shadowCamera, geometry, material, group) {
      before?.call(this, renderer, object, camera, shadowCamera, geometry, material, group);
      this.count = state.full;
    };
    mesh.onAfterShadow = function(renderer, object, camera, shadowCamera, geometry, material, group) {
      this.count = state.main;
      after?.call(this, renderer, object, camera, shadowCamera, geometry, material, group);
    };
  }
  let distant = false, proxied = false, warming = false, errorPixels = Infinity;
  function apply() {
    for (let index = 0; index < meshes.length; index++) {
      const state = counts[index];
      state.main = warming ? state.full : proxied && state.kind === 'opaque' && state.shadow ? 0 : distant ? state.far : state.full;
      if (meshes[index].count !== state.main) meshes[index].count = state.main;
    }
    for (let index = 0; index < proxyMeshes.length; index++) {
      const count = warming || proxied ? proxyCounts[index] : 0;
      if (proxyMeshes[index].count !== count) proxyMeshes[index].count = count;
    }
  }
  return { meshes, proxyMeshes,
    proxy: proxy ? { bounds: proxy.bounds, error: proxy.error, instances: proxyCounts.reduce((sum, count) => sum + count, 0) } : null,
    get distant() { return distant; },
    get proxied() { return proxied; },
    get errorPixels() { return errorPixels; },
    warmup(on) { warming = on; apply(); },
    update(camera, height = 0, force = false) {
      const column = Math.max(QIN_ISLAND.x0 - camera.position.x, 0, camera.position.x - QIN_ISLAND.x1);
      const row = Math.max(QIN_ISLAND.z0 - camera.position.z, 0, camera.position.z - QIN_ISLAND.z1);
      const next = !force && column * column + row * row > (distant ? 85 : 100) ** 2;
      errorPixels = proxy ? qinLodErrorPixels(camera, height, proxy.bounds, proxy.error) : Infinity;
      const nextProxy = !!proxy && next && errorPixels < (proxied ? 3.25 : 2.5);
      if (next === distant && nextProxy === proxied) return;
      distant = next; proxied = nextProxy; apply();
    },
  };
}
