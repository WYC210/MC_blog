export function findShoreExit(nav, x, z, dx, dz, water, reach, result) {
  const length = Math.hypot(dx, dz);
  if (length < 0.05) return false;
  dx /= length;
  dz /= length;
  for (let distance = 0.1; distance <= reach + 0.001; distance += 0.1) {
    const outX = x + dx * distance, outZ = z + dz * distance;
    const height = nav.heightAt(outX, outZ);
    if (height < water - 0.1 || height > water + 1 || !nav.canStand(outX, outZ)) continue;
    let wet = 0, dry = distance;
    for (let step = 0; step < 10; step++) {
      const middle = (wet + dry) / 2;
      if (nav.isBlocked(x + dx * middle, z + dz * middle)) wet = middle;
      else dry = middle;
    }
    result.edge.x = x + dx * Math.max(0, wet - 0.35);
    result.edge.z = z + dz * Math.max(0, wet - 0.35);
    result.out.x = outX;
    result.out.z = outZ;
    result.out.y = height;
    result.ox = dx;
    result.oz = dz;
    return true;
  }
  return false;
}

export function routeShoreExit(nav, x, z, targetX, targetZ, water) {
  const dx = targetX - x, dz = targetZ - z, length = Math.hypot(dx, dz);
  if (length < 0.01) return null;
  const result = { edge: { x: 0, z: 0 }, out: { x: 0, y: 0, z: 0 }, ox: 0, oz: 0 };
  for (let distance = 0; distance < length; distance += 0.25) {
    const along = distance / length;
    if (findShoreExit(nav, x + dx * along, z + dz * along, dx, dz, water, 1.2, result)) return result;
  }
  return null;
}
