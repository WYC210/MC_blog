export const HD_MIN_USAGE = 4;

export function collectHdUsage(scene) {
  const usage = new Map();
  const add = value => {
    if (!Number.isInteger(value) || value < 0) return;
    usage.set(value, (usage.get(value) || 0) + 1);
  };
  scene?.traverse(object => {
    if (object.userData?.reflectionSource) return;
    const attributes = object.geometry?.attributes;
    if (attributes?.tileLayer) {
      for (const value of attributes.tileLayer.array) add(value);
    }
    if (attributes?.iLayers) {
      const values = attributes.iLayers.array;
      for (let index = 0; index < values.length; index++) add(values[index]);
    }
  });
  return usage;
}

export function selectHdTiles(manifest, layer, depth, usage = null, minUsage = HD_MIN_USAGE) {
  if (manifest?.version !== 1 || manifest.size !== 256 || !Array.isArray(manifest.tiles) || manifest.tiles.length > 64) {
    throw new Error('Unsupported HD material manifest');
  }
  const selected = [], assigned = new Set();
  for (const entry of manifest.tiles) {
    if (!Array.isArray(entry.targets) || !entry.targets.length || !/^[a-z0-9_-]+\.png$/.test(entry.color)
      || !/^[a-z0-9_-]+\.png$/.test(entry.detail)) throw new Error('Invalid HD tile entry');
    const targets = [];
    for (const name of entry.targets) {
      if (typeof name !== 'string' || assigned.has(name)) throw new Error('Duplicate or invalid HD tile target');
      assigned.add(name);
      if (!Object.hasOwn(layer, name)) continue;
      if (!Number.isInteger(layer[name]) || layer[name] < 0 || layer[name] >= depth) throw new Error('Invalid HD tile layer');
      targets.push(name);
    }
    const filtered = usage ? targets.filter(name => (usage.get(layer[name]) || 0) >= minUsage) : targets;
    if (filtered.length) selected.push({ ...entry, targets: filtered });
  }
  if (!selected.length) throw new Error('No compatible HD tiles');
  return selected;
}

export function writeHdTile(target, source, size, index) {
  const stride = size * 4, offset = index * size * stride;
  if (source.length !== size * stride || index < 0 || offset + source.length > target.length) throw new Error('Invalid HD tile pixels');
  for (let row = 0; row < size; row++) {
    target.set(source.subarray(row * stride, (row + 1) * stride), offset + (size - 1 - row) * stride);
  }
}
