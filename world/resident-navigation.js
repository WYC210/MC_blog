import { IKUN_ENTRY, ISLAND, RESIDENT_HOME } from './layout.js';

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const SHORE_ACCESS = [
  { land: { x: -14, z: -23.5 }, water: { x: -14, z: -28.5 } },
  { land: { x: -32.5, z: 4 }, water: { x: -38.5, z: 4 } },
  { land: { x: 34.5, z: 14 }, water: { x: 40, z: 14 } },
  { land: { x: -8, z: 27.5 }, water: { x: -8, z: 32.5 } },
];

export function createResidentNavigation({ nav, world, jetSki }) {
  const width = ISLAND.x1 - ISLAND.x0, depth = ISLAND.z1 - ISLAND.z0;
  const size = width * depth;
  const cache = new Int8Array(size);
  const parent = new Int32Array(size);
  const queue = new Int32Array(size);
  const shores = SHORE_ACCESS.filter(shore => nav.canStand(shore.land.x, shore.land.z) && jetSki.canSwim(shore.water.x, shore.water.z));
  const xOf = index => ISLAND.x0 + index % width + 0.5;
  const zOf = index => ISLAND.z0 + Math.floor(index / width) + 0.5;

  function pass(x, z, boat) {
    if (!jetSki.canSwim(x, z)) return false;
    if (!boat) return true;
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) if (!jetSki.canFloat(x, z, yaw)) return false;
    return true;
  }

  function line(first, second, boat) {
    const steps = Math.max(1, Math.ceil(Math.hypot(second.x - first.x, second.z - first.z) / 0.25));
    for (let index = 1; index <= steps; index++) {
      if (!pass(first.x + (second.x - first.x) * index / steps, first.z + (second.z - first.z) * index / steps, boat)) return false;
    }
    return true;
  }

  function cellPass(index, boat) {
    if (!cache[index]) cache[index] = pass(xOf(index), zOf(index), boat) ? 1 : -1;
    return cache[index] === 1;
  }

  function nearest(point, boat) {
    let best = -1, distance = 4;
    const column = Math.floor(point.x - ISLAND.x0), row = Math.floor(point.z - ISLAND.z0);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const x = column + dx, z = row + dz;
      if (x < 0 || x >= width || z < 0 || z >= depth) continue;
      const index = x + z * width;
      const away = Math.hypot(xOf(index) - point.x, zOf(index) - point.z);
      if (away >= distance || !cellPass(index, boat)) continue;
      if (!line(point, { x: xOf(index), z: zOf(index) }, false)) continue;
      best = index; distance = away;
    }
    return best;
  }

  function waterPath(start, goal, boat = false) {
    cache.fill(0); parent.fill(-2);
    if (pass(goal.x, goal.z, boat) && line(start, goal, boat)) return [{ x: goal.x, z: goal.z }];
    const first = nearest(start, boat), last = nearest(goal, boat);
    if (first < 0 || last < 0) return null;
    let head = 0, tail = 0;
    queue[tail++] = first; parent[first] = -1;
    while (head < tail && parent[last] === -2) {
      const index = queue[head++], column = index % width, row = Math.floor(index / width);
      for (const [dx, dz] of DIRECTIONS) {
        const x = column + dx, z = row + dz;
        if (x < 0 || x >= width || z < 0 || z >= depth) continue;
        const next = x + z * width;
        if (parent[next] !== -2 || !cellPass(next, boat)) continue;
        parent[next] = index; queue[tail++] = next;
      }
    }
    if (parent[last] === -2) return null;
    const points = [];
    for (let index = last; index >= 0; index = parent[index]) points.push({ x: xOf(index), z: zOf(index) });
    points.reverse();
    if (pass(goal.x, goal.z, boat) && line(points[points.length - 1], goal, boat)) points.push({ x: goal.x, z: goal.z });
    const result = [];
    let anchor = start, next = 0;
    while (next < points.length) {
      let end = next;
      while (end + 1 < points.length && line(anchor, points[end + 1], boat)) end++;
      result.push(points[end]); anchor = points[end]; next = end + 1;
    }
    return result;
  }

  function shoreFor(position, fromLand) {
    let best = null, cost = Infinity;
    for (const shore of shores) {
      const route = fromLand ? nav.findPath(position, shore.land) : waterPath(position, shore.water);
      if (!route) continue;
      let length = 0, previous = position;
      for (const point of route) { length += Math.hypot(point.x - previous.x, point.z - previous.z); previous = point; }
      if (length < cost) { best = { ...shore, route }; cost = length; }
    }
    return best;
  }

  function approach(point, from) {
    for (let radius = 0.8; radius <= 2.2; radius += 0.2) for (let angle = 0; angle < 16; angle++) {
      const x = point.x + Math.sin(angle * Math.PI / 8) * radius;
      const z = point.z + Math.cos(angle * Math.PI / 8) * radius;
      if (!nav.canStand(x, z, point.floor) || Math.abs(nav.heightAt(x, z) - point.floor) > 0.2) continue;
      const candidate = { x, z };
      if (nav.findPath(from, candidate)) return candidate;
    }
    return null;
  }

  function homeRoute(entering) {
    const points = [
      { x: IKUN_ENTRY.x, z: IKUN_ENTRY.z, y: 0 },
      { x: IKUN_ENTRY.x, z: 10.5, y: 0 },
      { x: IKUN_ENTRY.x, z: 9.5, y: 1 },
      { x: IKUN_ENTRY.x, z: 8.5, y: 2 },
      { x: IKUN_ENTRY.x, z: 7.5, y: 3 },
      { x: IKUN_ENTRY.x, z: 6.5, y: 4 },
      { x: IKUN_ENTRY.x, z: 5.5, y: 4 },
      { x: RESIDENT_HOME.approach.x, z: RESIDENT_HOME.approach.z, y: 4 },
    ];
    return entering ? points : points.reverse();
  }

  return { waterPath, shoreFor, approach, homeRoute, shores, world };
}
