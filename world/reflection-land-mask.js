export function createReflectionLandMask(grid) {
  const [originX, , originZ] = grid.min, [width, , depth] = grid.size;
  const stride = width + 1, empty = new Uint32Array(stride * (depth + 1));
  for (let row = 0; row < depth; row++) {
    let holes = 0;
    for (let column = 0; column < width; column++) {
      if (!grid.opaqueAt(originX + column, -1, originZ + row)) holes++;
      empty[(row + 1) * stride + column + 1] = empty[row * stride + column + 1] + holes;
    }
  }
  return {
    covers(bounds) {
      const left = Math.floor(bounds.x0) - originX, right = Math.ceil(bounds.x1) - originX;
      const top = Math.floor(bounds.z0) - originZ, bottom = Math.ceil(bounds.z1) - originZ;
      if (left < 0 || top < 0 || right > width || bottom > depth || right <= left || bottom <= top) return false;
      return empty[bottom * stride + right] - empty[top * stride + right]
        - empty[bottom * stride + left] + empty[top * stride + left] === 0;
    },
  };
}

export function reflectionFootprint(camera, projection, inverse, bounds, level, output) {
  const elements = projection.elements, unproject = inverse.elements;
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (let corner = 0; corner < 8; corner++) {
    const column = corner & 1 ? bounds.max.x : bounds.min.x;
    const height = corner & 2 ? bounds.max.y : Math.max(level, bounds.min.y);
    const row = corner & 4 ? bounds.max.z : bounds.min.z;
    const clipW = elements[3] * column + elements[7] * height + elements[11] * row + elements[15];
    if (clipW <= 0.0001) return false;
    const clipX = (elements[0] * column + elements[4] * height + elements[8] * row + elements[12]) / clipW;
    const clipY = (elements[1] * column + elements[5] * height + elements[9] * row + elements[13]) / clipW;
    left = Math.min(left, clipX); right = Math.max(right, clipX);
    bottom = Math.min(bottom, clipY); top = Math.max(top, clipY);
  }
  left -= 0.05; right += 0.05; bottom -= 0.05; top += 0.05;
  output.x0 = Infinity; output.x1 = -Infinity; output.z0 = Infinity; output.z1 = -Infinity;
  for (let corner = 0; corner < 4; corner++) {
    const column = corner & 1 ? right : left, row = corner & 2 ? top : bottom;
    const worldW = unproject[3] * column + unproject[7] * row + unproject[11] * 0.5 + unproject[15];
    const directionX = unproject[0] * column + unproject[4] * row + unproject[8] * 0.5 + unproject[12] - camera.position.x * worldW;
    const directionY = unproject[1] * column + unproject[5] * row + unproject[9] * 0.5 + unproject[13] - camera.position.y * worldW;
    const directionZ = unproject[2] * column + unproject[6] * row + unproject[10] * 0.5 + unproject[14] - camera.position.z * worldW;
    if (directionY <= 0.000001) return false;
    for (let side = -1; side <= 1; side += 2) {
      const surface = level + side * 0.3;
      const distance = (surface - camera.position.y) / directionY;
      const waterX = camera.position.x + directionX * distance, waterZ = camera.position.z + directionZ * distance;
      output.x0 = Math.min(output.x0, waterX); output.x1 = Math.max(output.x1, waterX);
      output.z0 = Math.min(output.z0, waterZ); output.z1 = Math.max(output.z1, waterZ);
    }
  }
  return Number.isFinite(output.x0 + output.x1 + output.z0 + output.z1);
}
