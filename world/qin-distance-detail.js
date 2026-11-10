import { QIN_ISLAND } from './qin-island-layout.js';

function prominent(item) {
  if (item.emissive || item.tag?.startsWith('qin-retinue:') || item.tag?.startsWith('qin-wanderer:')) return true;
  const elements = item.matrix.elements;
  return Math.max(
    elements[0] ** 2 + elements[1] ** 2 + elements[2] ** 2,
    elements[4] ** 2 + elements[5] ** 2 + elements[6] ** 2,
    elements[8] ** 2 + elements[9] ** 2 + elements[10] ** 2,
  ) >= 1;
}

export function buildQinDistanceDetail(batch, materials) {
  const counts = [];
  for (const [kind, items] of Object.entries(batch.items)) {
    const major = [], minor = [];
    for (const item of items) (prominent(item) ? major : minor).push(item);
    batch.items[kind] = major.concat(minor);
    for (const shadow of [true, false]) {
      const full = items.filter(item => item.shadow === shadow).length;
      if (full) counts.push({ full, far: major.filter(item => item.shadow === shadow).length });
    }
  }
  const meshes = batch.build(materials);
  let distant = false;
  return { meshes,
    get distant() { return distant; },
    update(camera) {
      const column = Math.max(QIN_ISLAND.x0 - camera.position.x, 0, camera.position.x - QIN_ISLAND.x1);
      const row = Math.max(QIN_ISLAND.z0 - camera.position.z, 0, camera.position.z - QIN_ISLAND.z1);
      const next = column * column + row * row > (distant ? 85 : 100) ** 2;
      if (next === distant) return;
      distant = next;
      for (let index = 0; index < meshes.length; index++) meshes[index].count = distant ? counts[index].far : counts[index].full;
    },
  };
}
