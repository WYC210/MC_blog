const actor = item => item.tag?.startsWith('qin-retinue:') || item.tag?.startsWith('qin-wanderer:');

export function createQinLodSource(createBatch, enabled = true) {
  const replaced = new WeakSet(), substitutes = [];
  const bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
  let error = 0;
  return {
    replace(batch, detailed, simplified, deviation = 0.35) {
      if (!enabled) return detailed();
      const start = batch.items.opaque.length, result = detailed();
      for (let index = start; index < batch.items.opaque.length; index++) {
        const item = batch.items.opaque[index];
        if (!item.shadow || actor(item)) throw new Error('Qin LOD replacements must be static shadow-casting boxes');
        replaced.add(item);
        const elements = item.matrix.elements;
        const width = (Math.abs(elements[0]) + Math.abs(elements[4]) + Math.abs(elements[8])) / 2;
        const height = (Math.abs(elements[1]) + Math.abs(elements[5]) + Math.abs(elements[9])) / 2;
        const depth = (Math.abs(elements[2]) + Math.abs(elements[6]) + Math.abs(elements[10])) / 2;
        bounds.x0 = Math.min(bounds.x0, elements[12] - width); bounds.x1 = Math.max(bounds.x1, elements[12] + width);
        bounds.y0 = Math.min(bounds.y0, elements[13] - height); bounds.y1 = Math.max(bounds.y1, elements[13] + height);
        bounds.z0 = Math.min(bounds.z0, elements[14] - depth); bounds.z1 = Math.max(bounds.z1, elements[14] + depth);
      }
      const proxy = createBatch(); proxy.stack[0].copy(batch.stack[batch.stack.length - 1]);
      simplified(proxy);
      substitutes.push(...proxy.items.opaque);
      error = Math.max(error, deviation);
      return result;
    },
    build(batch, prominent) {
      if (!enabled || !substitutes.length || batch.items.opaque.some(item => item.shadow && actor(item))) return null;
      const proxy = createBatch();
      proxy.items.opaque = batch.items.opaque.filter(item => item.shadow && prominent(item) && !replaced.has(item)).concat(substitutes);
      return { batch: proxy, bounds, error };
    },
  };
}

export function qinLodErrorPixels(camera, height, bounds, error) {
  if (!(height > 0) || !camera.matrixWorldInverse || !camera.projectionMatrix) return Infinity;
  const inverse = camera.matrixWorldInverse.elements;
  const centerX = (bounds.x0 + bounds.x1) / 2, centerY = (bounds.y0 + bounds.y1) / 2, centerZ = (bounds.z0 + bounds.z1) / 2;
  const radius = (Math.abs(inverse[2]) * (bounds.x1 - bounds.x0) + Math.abs(inverse[6]) * (bounds.y1 - bounds.y0)
    + Math.abs(inverse[10]) * (bounds.z1 - bounds.z0)) / 2;
  const depth = -(inverse[2] * centerX + inverse[6] * centerY + inverse[10] * centerZ + inverse[14]) - radius;
  return depth > (camera.near ?? 0.1) ? error * height * Math.abs(camera.projectionMatrix.elements[5]) / (2 * depth) : Infinity;
}
