export function selectHdTiles(manifest, layer, depth) {
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
    if (targets.length) selected.push({ ...entry, targets });
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
