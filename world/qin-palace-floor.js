import * as THREE from 'three';
import { QIN_GALLERY, QIN_WALL_TABLE, qinFloorAt } from './qin-island-layout.js';

export function createQinPalaceFloor(collides) {
  const floor = 3, entry = { x: 160, z: -23, y: floor };
  const surface = { site: 'qin-palace-lower', x0: 141, x1: 181, z0: -47, z1: -33.25, y: floor };
  const within = (x, z) => x > surface.x0 && x < surface.x1 && z > surface.z0 && z < surface.z1;
  const minX = 141.75, minZ = -46.25, columns = 77, rows = 49, step = 0.5;
  const safe = (x, z) => {
    if (x < minX || x > minX + (columns - 1) * step || z < minZ || z > minZ + (rows - 1) * step) return false;
    if (!within(x, z) && Math.abs(qinFloorAt(x, z) - floor) > 0.05) return false;
    for (let side = 0; side < 8; side++) if (collides(x + Math.cos(side * Math.PI / 4) * 0.31, floor, z + Math.sin(side * Math.PI / 4) * 0.31)) return false;
    return !collides(x, floor, z);
  };
  const cells = new Uint8Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) cells[column + row * columns] = Number(safe(minX + column * step, minZ + row * step));
  const cellOf = point => {
    const column = Math.round((point.x - minX) / step), row = Math.round((point.z - minZ) / step);
    return column >= 0 && column < columns && row >= 0 && row < rows ? column + row * columns : -1;
  };
  const pointOf = cell => ({ x: minX + cell % columns * step, y: floor, z: minZ + Math.floor(cell / columns) * step });
  function clear(start, end) {
    const count = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / 0.2);
    for (let index = 0; index <= count; index++) {
      const fraction = count ? index / count : 0;
      if (!safe(start.x + (end.x - start.x) * fraction, start.z + (end.z - start.z) * fraction)) return false;
    }
    return true;
  }
  function localPath(start, end) {
    if (!safe(start.x, start.z) || !safe(end.x, end.z)) return null;
    if (clear(start, end)) return [{ x: end.x, y: floor, z: end.z }];
    const first = cellOf(start), last = cellOf(end);
    if (first < 0 || last < 0 || !cells[first] || !cells[last]) return null;
    const previous = new Int32Array(cells.length).fill(-1), queue = new Int32Array(cells.length);
    let head = 0, tail = 1; queue[0] = first; previous[first] = first;
    while (head < tail && previous[last] === -1) {
      const cell = queue[head++], column = cell % columns, row = Math.floor(cell / columns);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nextX = column + dx, nextZ = row + dz, next = nextX + nextZ * columns;
        if (nextX < 0 || nextX >= columns || nextZ < 0 || nextZ >= rows || !cells[next] || previous[next] !== -1) continue;
        previous[next] = cell; queue[tail++] = next;
      }
    }
    if (previous[last] === -1) return null;
    const points = [{ x: end.x, y: floor, z: end.z }];
    for (let cell = last; cell !== first; cell = previous[cell]) points.push(pointOf(cell));
    points.push({ x: start.x, y: floor, z: start.z }); points.reverse();
    const simplified = [];
    for (let current = 0; current < points.length - 1;) {
      let next = points.length - 1;
      while (next > current + 1 && !clear(points[current], points[next])) next--;
      simplified.push(points[next]); current = next;
    }
    return simplified;
  }
  function gridPath(start, end, nav) {
    const landing = { x: 178.5, z: -36.5 }, foot = { x: 178.5, z: -22 };
    const fromHeight = nav.heightAt(start.x, start.z), toHeight = nav.heightAt(end.x, end.z);
    const stops = fromHeight >= QIN_GALLERY.floor - 0.1 && toHeight <= floor + 0.1 ? [landing, foot, end]
      : fromHeight <= floor + 0.1 && toHeight >= QIN_GALLERY.floor - 0.1 ? [foot, landing, end] : [end];
    const points = [];
    let previous = start;
    for (const stop of stops) {
      const section = nav.findPath(previous, stop);
      if (!section) return null;
      points.push(...section); previous = stop;
    }
    return points;
  }
  return {
    levels(x, z, out) { if (within(x, z)) out.push(surface); },
    route(from, to, near, targetFloor, nav) {
      const fromLower = within(from.x, from.z) && Math.abs(near - floor) < 0.7;
      const toLower = within(to.x, to.z) && (targetFloor === floor || targetFloor == null && near < 4.5);
      if (!fromLower && !toLower) return null;
      const localStart = Math.abs(near - floor) < 0.1 && safe(from.x, from.z) ? from : entry;
      const localEnd = toLower ? to : entry;
      const path = localPath(localStart, localEnd);
      if (!path) return null;
      const before = localStart === from ? [] : gridPath(from, entry, nav);
      const after = toLower ? [] : gridPath(entry, to, nav);
      if (!before || !after) return null;
      return [...before, ...path, ...after];
    },
    pick(ray) {
      if (ray.origin.y >= QIN_GALLERY.floor - 0.25 || ray.direction.y >= -0.0001) return null;
      const distance = (floor + 0.005 - ray.origin.y) / ray.direction.y;
      if (distance <= 0) return null;
      const point = ray.at(distance, new THREE.Vector3());
      return within(point.x, point.z) ? { t: distance, point, site: surface.site } : null;
    },
    tap(player, picked) {
      if (player.mode !== 'ground' || Math.abs(player.y - floor) > 0.5) return false;
      if (picked.spot?.id === 'qin-great-wall') {
        const column = Math.max(QIN_WALL_TABLE.x - QIN_WALL_TABLE.width / 2 + 1, Math.min(QIN_WALL_TABLE.x + QIN_WALL_TABLE.width / 2 - 1, player.pos.x));
        return player.goTo(column, QIN_WALL_TABLE.at[1], { floor });
      }
      const point = picked.island?.point || picked.block;
      if (!point || Math.abs(point.y - floor) > 0.15 || !within(point.x, point.z)) return false;
      return player.goTo(point.x, point.z, { floor });
    },
  };
}
