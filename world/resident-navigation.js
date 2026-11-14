import { ISLAND, RESIDENT_HOME } from './layout.js';

const DIRECTIONS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BOAT_HEADINGS = Array.from({ length: 8 }, (_, index) => index * Math.PI / 4);
const SHORE_ACCESS = [
  { land: { x: -14, z: -23.5 }, water: { x: -14, z: -28.5 } },
  { land: { x: -32.5, z: 4 }, water: { x: -38.5, z: 4 } },
  { land: { x: 34.5, z: 14 }, water: { x: 40, z: 14 } },
  { land: { x: -8, z: 27.5 }, water: { x: -8, z: 32.5 } },
];

export function createResidentNavigation({ nav, world, jetSki }) {
  const spanX = ISLAND.x1 - ISLAND.x0, spanZ = ISLAND.z1 - ISLAND.z0;
  const size = spanX * spanZ;
  let width = spanX, depth = spanZ, spacing = 1;
  const cache = new Int8Array(size);
  const parent = new Int32Array(size);
  const queue = new Int32Array(size);
  const cost = new Int32Array(size);
  const queued = new Int32Array(size);
  const shores = SHORE_ACCESS.filter(shore => nav.canStand(shore.land.x, shore.land.z) && jetSki.canSwim(shore.water.x, shore.water.z));
  const xOf = index => ISLAND.x0 + (index % width + 0.5) * spacing;
  const zOf = index => ISLAND.z0 + (Math.floor(index / width) + 0.5) * spacing;

  function pass(x, z, boat) {
    if (!jetSki.canSwim(x, z)) return false;
    if (!boat) return true;
    for (const yaw of BOAT_HEADINGS) if (!jetSki.canFloat(x, z, yaw)) return false;
    return true;
  }

  function line(first, second, boat) {
    const steps = Math.max(1, Math.ceil(Math.hypot(second.x - first.x, second.z - first.z) / 0.25));
    const yaw = Math.atan2(second.x - first.x, second.z - first.z);
    for (let index = 0; index <= steps; index++) {
      const column = first.x + (second.x - first.x) * index / steps, row = first.z + (second.z - first.z) * index / steps;
      if (boat ? !jetSki.canFloat(column, row, yaw) : !jetSki.canSwim(column, row)) return false;
    }
    return true;
  }

  function cellPass(index, boat) {
    if (!cache[index]) cache[index] = pass(xOf(index), zOf(index), boat) ? 1 : -1;
    return cache[index] === 1;
  }

  function nearest(point, boat) {
    let best = -1, distance = 4;
    const column = Math.floor((point.x - ISLAND.x0) / spacing), row = Math.floor((point.z - ISLAND.z0) / spacing);
    for (let dz = -3; dz <= 3; dz++) for (let dx = -3; dx <= 3; dx++) {
      const x = column + dx, z = row + dz;
      if (x < 0 || x >= width || z < 0 || z >= depth) continue;
      const index = x + z * width;
      const away = Math.hypot(xOf(index) - point.x, zOf(index) - point.z);
      if (away >= distance || !cellPass(index, boat)) continue;
      if (!line(point, { x: xOf(index), z: zOf(index) }, boat)) continue;
      best = index; distance = away;
    }
    return best;
  }

  function waterPath(start, goal, boat = false) {
    return search(start, goal, boat, boat ? 4 : 1) || (boat ? search(start, goal, true, 1) : null);
  }

  function search(start, goal, boat, step) {
    spacing = step; width = Math.ceil(spanX / spacing); depth = Math.ceil(spanZ / spacing);
    cache.fill(0); parent.fill(-2);
    if (boat && (!pass(start.x, start.z, true) || !pass(goal.x, goal.z, true))) return null;
    if (pass(goal.x, goal.z, boat) && line(start, goal, boat)) return [{ x: goal.x, z: goal.z }];
    const first = nearest(start, boat), last = nearest(goal, boat);
    if (first < 0 || last < 0) return null;
    const lastColumn = last % width, lastRow = Math.floor(last / width);
    cost.fill(0x7fffffff); queued.fill(-1);
    let count = 0;
    function score(index) {
      return cost[index] + Math.abs(index % width - lastColumn) + Math.abs(Math.floor(index / width) - lastRow);
    }
    function before(first, second) {
      const difference = score(first) - score(second);
      return difference < 0 || difference === 0 && cost[first] > cost[second];
    }
    function enqueue(index) {
      let slot = queued[index];
      if (slot < 0) slot = count++;
      while (slot > 0) {
        const above = (slot - 1) >> 1, previous = queue[above];
        if (!before(index, previous)) break;
        queue[slot] = previous; queued[previous] = slot; slot = above;
      }
      queue[slot] = index; queued[index] = slot;
    }
    function dequeue() {
      const result = queue[0], replacement = queue[--count];
      let slot = 0;
      while (slot * 2 + 1 < count) {
        let child = slot * 2 + 1;
        if (child + 1 < count && before(queue[child + 1], queue[child])) child++;
        if (!before(queue[child], replacement)) break;
        queue[slot] = queue[child]; queued[queue[slot]] = slot; slot = child;
      }
      if (count) { queue[slot] = replacement; queued[replacement] = slot; }
      queued[result] = -2;
      return result;
    }
    cost[first] = 0; parent[first] = -1; enqueue(first);
    while (count) {
      const index = dequeue(), column = index % width, row = Math.floor(index / width);
      if (index === last) break;
      for (const [dx, dz] of DIRECTIONS) {
        const x = column + dx, z = row + dz;
        if (x < 0 || x >= width || z < 0 || z >= depth) continue;
        const next = x + z * width;
        if (queued[next] === -2 || cost[next] <= cost[index] + 1 || !cellPass(next, boat)) continue;
        if (!line({ x: xOf(index), z: zOf(index) }, { x: xOf(next), z: zOf(next) }, boat)) continue;
        parent[next] = index; cost[next] = cost[index] + 1; enqueue(next);
      }
    }
    if (parent[last] === -2) return null;
    const points = [];
    for (let index = last; index >= 0; index = parent[index]) points.push({ x: xOf(index), z: zOf(index) });
    points.reverse();
    const corners = [points[0]];
    for (let index = 1; index < points.length - 1; index++) {
      const previous = points[index - 1], current = points[index], next = points[index + 1];
      if (current.x - previous.x !== next.x - current.x || current.z - previous.z !== next.z - current.z) corners.push(current);
    }
    if (points.length > 1) corners.push(points[points.length - 1]);
    if (pass(goal.x, goal.z, boat) && line(corners[corners.length - 1], goal, boat)) corners.push({ x: goal.x, z: goal.z });
    const result = [];
    let anchor = start, next = 0;
    while (next < corners.length) {
      let end = next;
      if (!line(anchor, corners[next], boat)) return null;
      while (end + 1 < corners.length && line(anchor, corners[end + 1], boat)) end++;
      result.push(corners[end]); anchor = corners[end]; next = end + 1;
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
      RESIDENT_HOME.entry,
      { x: -21.5, z: 14.5, y: 0.5 },
      { x: -21.5, z: 13.5, y: 1 },
      { x: -20.375, z: 11.625, y: 1 },
      RESIDENT_HOME.approach,
    ];
    return entering ? points : points.reverse();
  }

  return { waterPath, shoreFor, approach, homeRoute, shores, world };
}
