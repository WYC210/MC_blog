import { QIN_ISLAND, QIN_PALACE, QIN_HANFEI, qinLandAt } from './qin-island-layout.js';

export const QIN_ARMY_WAIT_SECONDS = 25;
export const QIN_ARMY_ROOMS = [
  { id: 'palace', x0: QIN_PALACE.x0 - 0.4, x1: QIN_PALACE.x1 + 0.4, z0: QIN_PALACE.z0 - 0.4, z1: -6, doorX: 160, doorZ: -4.5 },
  { id: 'jixia', x0: 102.5, x1: 121.5, z0: 18.5, z1: 31.5, doorX: 112, doorZ: 32.5 },
  { id: 'hanfei', x0: QIN_HANFEI.x - 10.5, x1: QIN_HANFEI.x + 10.5, z0: QIN_HANFEI.z - 5.5, z1: QIN_HANFEI.z + 5.5, doorX: 112, doorZ: -38.5 },
];

export function qinArmyRoomAt(x, z) {
  for (const room of QIN_ARMY_ROOMS) if (x > room.x0 && x < room.x1 && z > room.z0 && z < room.z1) return room;
  return null;
}

export function createQinArmyFollow({ nav, player, guards }) {
  const columns = QIN_ISLAND.x1 - QIN_ISLAND.x0, rows = QIN_ISLAND.z1 - QIN_ISLAND.z0, cells = columns * rows;
  const open = new Uint8Array(cells), visited = new Uint32Array(cells), reserved = new Uint32Array(cells);
  const links = new Uint8Array(cells), components = new Uint16Array(cells);
  const parents = new Int32Array(cells), queue = new Int32Array(cells), reverse = new Int32Array(cells);
  let built = false, stamp = 0, reservation = 0, active = false, status = 'sleeping', waitTime = 0, replan = 0;
  let anchorX = 160, anchorZ = 24, anchorYaw = 0, room = null, plans = 0, returning = false;
  const destination = { x: 0, z: 0 };
  for (const guard of guards) {
    guard.commandPath = new Float32Array(1536); guard.commandCount = guard.commandIndex = 0;
    guard.commandGroundCount = 0; guard.commandYaw = 0;
  }
  const columnOf = cell => cell % columns;
  const rowOf = cell => Math.floor(cell / columns);
  const columnX = cell => QIN_ISLAND.x0 + columnOf(cell) + 0.5;
  const rowZ = cell => QIN_ISLAND.z0 + rowOf(cell) + 0.5;
  function walkable(x, z) {
    return qinLandAt(x, z) && !qinArmyRoomAt(x, z) && Math.abs(nav.heightAt(x, z)) < 0.2 && nav.canStand(x, z);
  }
  function clearSegment(startX, startZ, endX, endZ) {
    const steps = Math.max(1, Math.ceil(Math.hypot(endX - startX, endZ - startZ) / 0.18));
    for (let step = 1; step <= steps; step++) if (!walkable(startX + (endX - startX) * step / steps, startZ + (endZ - startZ) * step / steps)) return false;
    return true;
  }
  function build() {
    if (built) return;
    for (let cell = 0; cell < cells; cell++) open[cell] = walkable(columnX(cell), rowZ(cell)) ? 1 : 0;
    for (let cell = 0; cell < cells; cell++) {
      if (!open[cell]) continue;
      if (columnOf(cell) + 1 < columns && open[cell + 1] && clearSegment(columnX(cell), rowZ(cell), columnX(cell + 1), rowZ(cell + 1))) {
        links[cell] |= 2; links[cell + 1] |= 1;
      }
      if (rowOf(cell) + 1 < rows && open[cell + columns] && clearSegment(columnX(cell), rowZ(cell), columnX(cell + columns), rowZ(cell + columns))) {
        links[cell] |= 8; links[cell + columns] |= 4;
      }
    }
    let component = 0;
    for (let start = 0; start < cells; start++) {
      if (!open[start] || components[start]) continue;
      component++; components[start] = component;
      let read = 0, write = 1; queue[0] = start;
      while (read < write) {
        const cell = queue[read++];
        for (let direction = 0; direction < 4; direction++) {
          if (!(links[cell] & 1 << direction)) continue;
          const next = cell + (direction === 0 ? -1 : direction === 1 ? 1 : direction === 2 ? -columns : columns);
          if (components[next]) continue;
          components[next] = component; queue[write++] = next;
        }
      }
    }
    built = true;
  }
  function nearest(x, z, unique = false, component = 0, connected = false) {
    const centerX = Math.floor(x - QIN_ISLAND.x0), centerZ = Math.floor(z - QIN_ISLAND.z0);
    let best = -1, distance = Infinity;
    for (let radius = 0; radius <= 6; radius++) {
      for (let row = centerZ - radius; row <= centerZ + radius; row++) for (let column = centerX - radius; column <= centerX + radius; column++) {
        if (column < 0 || column >= columns || row < 0 || row >= rows || Math.max(Math.abs(column - centerX), Math.abs(row - centerZ)) !== radius) continue;
        const cell = column + row * columns;
        if (!open[cell] || unique && reserved[cell] === reservation || component && components[cell] !== component) continue;
        if (connected && !clearSegment(x, z, columnX(cell), rowZ(cell))) continue;
        const squared = (columnX(cell) - x) ** 2 + (rowZ(cell) - z) ** 2;
        if (squared < distance) { best = cell; distance = squared; }
      }
      if (best >= 0) break;
    }
    return best;
  }
  function append(guard, x, y, z) {
    if (guard.commandCount >= 512) return false;
    const offset = guard.commandCount++ * 3;
    guard.commandPath[offset] = x; guard.commandPath[offset + 1] = y; guard.commandPath[offset + 2] = z;
    return true;
  }
  function path(guard, x, z, unique = true) {
    build(); guard.commandCount = guard.commandIndex = 0;
    const start = nearest(guard.x, guard.z, false, 0, true), end = nearest(x, z, unique, start >= 0 ? components[start] : 0);
    if (start < 0 || end < 0) return false;
    stamp++; let read = 0, write = 1; queue[0] = start; visited[start] = stamp; parents[start] = -1;
    while (read < write && visited[end] !== stamp) {
      const cell = queue[read++];
      for (let direction = 0; direction < 4; direction++) {
        if (!(links[cell] & 1 << direction)) continue;
        const next = cell + (direction === 0 ? -1 : direction === 1 ? 1 : direction === 2 ? -columns : columns);
        if (!open[next] || visited[next] === stamp) continue;
        visited[next] = stamp; parents[next] = cell; queue[write++] = next;
      }
    }
    if (visited[end] !== stamp) return false;
    let count = 0, cell = end;
    while (cell >= 0) { reverse[count++] = cell; cell = parents[cell]; }
    if (count > 509) return false;
    for (let index = count - 1; index >= 0; index--) append(guard, columnX(reverse[index]), 0, rowZ(reverse[index]));
    guard.commandGroundCount = guard.commandCount;
    if (unique) reserved[end] = reservation;
    plans++;
    return true;
  }
  function planFormation() {
    reservation++;
    const forwardX = Math.sin(anchorYaw), forwardZ = Math.cos(anchorYaw);
    for (let index = 0; index < guards.length; index++) {
      let lateral, behind;
      if (room) {
        lateral = (index % 8 - 3.5) * 1.2 + (index % 8 < 4 ? -1 : 1);
        behind = 1.5 + Math.floor(index / 8) * 1.2;
        destination.x = room.doorX + lateral; destination.z = room.doorZ + behind;
      } else {
        lateral = (index % 4 - 1.5) * 1.3; behind = 3.2 + Math.floor(index / 4) * 1.3;
        destination.x = anchorX - forwardX * behind + forwardZ * lateral;
        destination.z = anchorZ - forwardZ * behind - forwardX * lateral;
      }
      guards[index].commandYaw = room ? 0 : anchorYaw;
      path(guards[index], destination.x, destination.z);
    }
    replan = 0;
  }
  function step(guard, dt) {
    let remaining = dt * 3.6;
    guard.speed = 0;
    while (guard.commandIndex < guard.commandCount) {
      const offset = guard.commandIndex * 3, across = guard.commandPath[offset] - guard.x;
      const rise = guard.commandPath[offset + 1] - guard.y, along = guard.commandPath[offset + 2] - guard.z;
      const distance = Math.hypot(across, rise, along), amount = Math.min(remaining, distance);
      if (distance < 0.005) {
        guard.x = guard.commandPath[offset]; guard.y = guard.commandPath[offset + 1]; guard.z = guard.commandPath[offset + 2];
        guard.commandIndex++; continue;
      }
      const nextX = guard.x + across / distance * amount, nextY = guard.y + rise / distance * amount, nextZ = guard.z + along / distance * amount;
      if (guard.commandIndex < guard.commandGroundCount && !walkable(nextX, nextZ)) return;
      guard.x = nextX; guard.y = nextY; guard.z = nextZ; guard.speed = 1;
      const heading = Math.atan2(across, along);
      guard.yaw += Math.atan2(Math.sin(heading - guard.yaw), Math.cos(heading - guard.yaw)) * Math.min(1, dt * 8);
      remaining -= amount;
      if (distance <= amount) guard.commandIndex++;
      if (remaining <= 0.001) break;
    }
    guard.stride += dt * 7 * guard.speed;
    if (guard.commandIndex >= guard.commandCount) {
      guard.speed = 0;
      guard.yaw += Math.atan2(Math.sin(guard.commandYaw - guard.yaw), Math.cos(guard.commandYaw - guard.yaw)) * Math.min(1, dt * 5);
    }
  }
  function beginReturn() {
    active = true; returning = true; status = 'returning'; room = null;
    for (let index = 0; index < guards.length; index++) {
      const guard = guards[index], exitZ = index < 16 ? 29.8 : 36.2;
      if (!path(guard, guard.originX, exitZ, false)) { guard.commandCount = 0; continue; }
      append(guard, guard.originX, 0, exitZ);
      append(guard, guard.originX, guard.originY, index < 16 ? 30.65 : 35.35);
      append(guard, guard.originX, guard.originY, guard.originZ);
      guard.commandYaw = guard.originYaw;
    }
  }
  function update(dt) {
    if (!active) return;
    if (returning) {
      let arrived = true;
      for (const guard of guards) { step(guard, dt); if (guard.commandIndex < guard.commandCount || Math.hypot(guard.x - guard.originX, guard.z - guard.originZ) > 0.1) arrived = false; }
      if (arrived) { status = 'returned'; active = false; }
      return;
    }
    const separated = player.flying || player.zipping || player.swimming || player.mode === 'vehicle' || !qinLandAt(player.pos.x, player.pos.z);
    if (separated) {
      if (status !== 'waiting') { status = 'waiting'; waitTime = 0; }
      waitTime += dt;
      for (const guard of guards) guard.speed = 0;
      if (waitTime >= QIN_ARMY_WAIT_SECONDS) beginReturn();
      return;
    }
    const nextRoom = qinArmyRoomAt(player.pos.x, player.pos.z), nextStatus = nextRoom ? 'door-guard' : 'following';
    const changed = status !== nextStatus || room !== nextRoom;
    status = nextStatus; room = nextRoom; waitTime = 0; replan += dt;
    if (changed || !room && replan >= 1 && (Math.hypot(player.pos.x - anchorX, player.pos.z - anchorZ) > 1.8 || Math.abs(Math.atan2(Math.sin(player.heading - anchorYaw), Math.cos(player.heading - anchorYaw))) > 0.7)) {
      anchorX = player.pos.x; anchorZ = player.pos.z; anchorYaw = player.heading; planFormation();
    }
    for (const guard of guards) step(guard, dt);
  }
  return {
    update, beginReturn, walkable,
    start() { build(); active = true; returning = false; status = 'assembling'; waitTime = 0; replan = 2; },
    stop() { active = false; returning = false; status = 'sleeping'; waitTime = 0; },
    get status() { return status; }, get waitTime() { return waitTime; }, get room() { return room?.id || null; }, get plans() { return plans; },
  };
}
