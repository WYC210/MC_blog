export const SHORE_RANGE = 24;
export const DEPTH_RANGE = 8;

export function bakeOceanMap(grid, bounds, water) {
  const margin = SHORE_RANGE + 2;
  const x0 = bounds.x0 - margin, z0 = bounds.z0 - margin;
  const width = bounds.x1 - bounds.x0 + margin * 2, height = bounds.z1 - bounds.z0 + margin * 2;
  const count = width * height, distance = new Float32Array(count), depth = new Float32Array(count);
  const connected = new Uint8Array(count), queue = new Uint32Array(count);
  let head = 0, tail = 0;
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const offset = column + row * width;
    let bottom = water - DEPTH_RANGE;
    for (let level = Math.floor(water); level >= Math.max(grid.min[1], Math.floor(water - DEPTH_RANGE)); level--) {
      if (grid.get(column + x0, level, row + z0)) { bottom = level + 1; break; }
    }
    depth[offset] = Math.max(0, Math.min(DEPTH_RANGE, water - bottom));
    distance[offset] = depth[offset] > 0 ? SHORE_RANGE : 0;
    if (depth[offset] > 0 && (row === 0 || column === 0 || row === height - 1 || column === width - 1)) {
      connected[offset] = 1; queue[tail++] = offset;
    }
  }
  const visit = offset => {
    if (depth[offset] <= 0 || connected[offset]) return;
    connected[offset] = 1; queue[tail++] = offset;
  };
  while (head < tail) {
    const offset = queue[head++], column = offset % width;
    if (column > 0) visit(offset - 1);
    if (column < width - 1) visit(offset + 1);
    if (offset >= width) visit(offset - width);
    if (offset < count - width) visit(offset + width);
  }
  for (let row = 0; row < height; row++) for (let column = 0; column < width; column++) {
    const offset = column + row * width;
    if (column > 0) distance[offset] = Math.min(distance[offset], distance[offset - 1] + 1);
    if (row > 0) {
      distance[offset] = Math.min(distance[offset], distance[offset - width] + 1);
      if (column > 0) distance[offset] = Math.min(distance[offset], distance[offset - width - 1] + Math.SQRT2);
      if (column < width - 1) distance[offset] = Math.min(distance[offset], distance[offset - width + 1] + Math.SQRT2);
    }
  }
  for (let row = height - 1; row >= 0; row--) for (let column = width - 1; column >= 0; column--) {
    const offset = column + row * width;
    if (column < width - 1) distance[offset] = Math.min(distance[offset], distance[offset + 1] + 1);
    if (row < height - 1) {
      distance[offset] = Math.min(distance[offset], distance[offset + width] + 1);
      if (column > 0) distance[offset] = Math.min(distance[offset], distance[offset + width - 1] + Math.SQRT2);
      if (column < width - 1) distance[offset] = Math.min(distance[offset], distance[offset + width + 1] + Math.SQRT2);
    }
  }
  const data = new Uint8Array(count * 4);
  for (let offset = 0; offset < count; offset++) {
    data[offset * 4] = Math.round(Math.max(0, distance[offset] - 0.5) / SHORE_RANGE * 255);
    data[offset * 4 + 1] = Math.round(depth[offset] / DEPTH_RANGE * 255);
    data[offset * 4 + 2] = connected[offset] * 255;
    data[offset * 4 + 3] = 255;
  }
  return { data, width, height, x0, z0 };
}

export const OCEAN_SHORE = /* glsl */`
  uniform sampler2D uOceanShore;
  uniform vec4 uOceanMap;
  vec3 oceanShore(vec2 point) {
    vec2 coordinates = (point - uOceanMap.xy) * uOceanMap.zw;
    vec2 inside = step(vec2(0.0), coordinates) * step(coordinates, vec2(1.0));
    return mix(vec3(1.0), texture2D(uOceanShore, coordinates).rgb, inside.x * inside.y);
  }
`;

export const OCEAN_VERTEX = /* glsl */`
  uniform float uTime, uWind, uOceanHeight;
  uniform vec2 uOceanFocus, uOceanPlayer;
  uniform vec4 uOceanBounds;
  varying vec2 vOceanSlope;
  float oceanAxis(float coordinate, float focus, float lower, float upper) {
    float reach = coordinate < 0.0 ? focus - lower : upper - focus;
    float near = min(24.0, reach);
    return focus + coordinate * (near + coordinate * coordinate * (reach - near));
  }
  vec3 oceanWaves(vec2 point) {
    vec2 first = vec2(0.8, 0.6), second = vec2(-0.6, 0.8);
    float phase = dot(point, first) * 0.43 - uTime * 0.785398163;
    vec3 wave = vec3(sin(phase), first * 0.43 * cos(phase)) * 0.65;
    phase = dot(point, second) * 0.71 - uTime * 1.099557429;
    wave += vec3(sin(phase), second * 0.71 * cos(phase)) * 0.25;
    #if OCEAN_WAVES > 2
      vec2 third = vec2(0.28, -0.96);
      phase = dot(point, third) * 0.97 - uTime * 1.466076572;
      wave += vec3(sin(phase), third * 0.97 * cos(phase)) * 0.1;
    #endif
    return wave;
  }
  void oceanDisplace(inout vec4 world, vec2 coordinate) {
    world.x = oceanAxis(coordinate.x, uOceanFocus.x, uOceanBounds.x, uOceanBounds.z);
    world.z = oceanAxis(-coordinate.y, uOceanFocus.y, uOceanBounds.y, uOceanBounds.w);
    if (uOceanHeight <= 0.0) { vOceanSlope = vec2(0.0); return; }
    vec3 shore = oceanShore(world.xz);
    float shoreFade = smoothstep(2.0, 12.0, shore.r * 24.0) * shore.b;
    float distanceFade = 1.0 - smoothstep(45.0, 100.0, distance(world.xz, uOceanFocus));
    float playerFade = smoothstep(3.0, 8.0, distance(world.xz, uOceanPlayer));
    float strength = uOceanHeight * (0.7 + uWind * 0.6) * shoreFade * distanceFade * playerFade;
    vec3 wave = oceanWaves(world.xz) * strength;
    world.y += wave.x;
    vOceanSlope = wave.yz;
  }
`;
