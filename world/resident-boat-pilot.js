const CRUISE_SPEED = 6;
const PROBE_INTERVAL = 0.1;
const BRAKING = 18;

function angleDifference(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function createResidentBoatPilot({ ski, canFloat, findPath }) {
  const input = { x: 0, z: 0, run: false, up: false, down: false };
  const goal = { x: 0, z: 0 }, retreat = { x: 0, z: 0 };
  let route = null, index = 0, state = 'idle', recoveries = 0;
  let clock = 0, budget = 60, probeClock = 0, clear = true, stalled = 0;
  let anchorX = 0, anchorZ = 0, anchorYaw = 0, retreatDirection = -1, retreatClock = 0;

  function resetProgress() {
    anchorX = ski.position.x; anchorZ = ski.position.z; anchorYaw = ski.rotation.y;
    stalled = 0; probeClock = 0;
  }

  function plan() {
    route = findPath(ski.position, goal, true); index = 0;
    resetProgress();
    if (!route?.length) return false;
    let length = 0, previous = ski.position;
    for (const point of route) { length += Math.hypot(point.x - previous.x, point.z - previous.z); previous = point; }
    budget = Math.max(budget, Math.min(300, clock + length / 2 + 30));
    state = 'navigating';
    return true;
  }

  function canTurn(column, row) {
    for (let sample = 0; sample < 16; sample++) {
      if (!canFloat(column, row, sample * Math.PI / 8)) return false;
    }
    return true;
  }

  function recover() {
    if (recoveries >= 3) { state = 'failed'; return; }
    recoveries++;
    const sine = Math.sin(ski.rotation.y), cosine = Math.cos(ski.rotation.y);
    for (let direction = -1; direction <= 1; direction += 2) {
      for (let distance = 0.25; distance <= 6; distance += 0.25) {
        const column = ski.position.x + sine * distance * direction, row = ski.position.z + cosine * distance * direction;
        if (!canFloat(column, row, ski.rotation.y)) break;
        if (distance < 1.5 || !canTurn(column, row)) continue;
        retreat.x = column; retreat.z = row; retreatDirection = direction; retreatClock = 0;
        state = 'recovering'; resetProgress(); return;
      }
    }
    state = 'failed';
  }

  function probe(speed, steering, turn) {
    const distance = speed * speed / (2 * BRAKING) + speed * (PROBE_INTERVAL + 0.1) + 0.6;
    const steps = Math.max(1, Math.ceil(distance / 0.2));
    const step = distance / steps, yawRate = -steering * (0.55 + Math.min(1, speed / 6) * 1.05);
    let column = ski.position.x, row = ski.position.z, yaw = ski.rotation.y, rotated = 0;
    for (let sample = 0; sample < steps; sample++) {
      const delta = Math.sign(turn) * Math.min(Math.abs(yawRate) * step / Math.max(1, speed), Math.max(0, Math.abs(turn) - Math.abs(rotated)));
      yaw += delta; rotated += delta;
      column += Math.sin(yaw) * step; row += Math.cos(yaw) * step;
      if (!canFloat(column, row, yaw)) return false;
    }
    return true;
  }

  function update(dt, controller) {
    input.x = 0; input.z = 0; input.up = true;
    if (!(dt > 0) || state === 'idle') return state;
    clock += dt;
    if (clock > budget && state !== 'arrived') state = 'failed';
    if (state === 'recovering') {
      retreatClock += dt;
      const distance = Math.hypot(retreat.x - ski.position.x, retreat.z - ski.position.z);
      if (distance < 0.2) {
        if (Math.abs(controller.speed) < 0.15 && !plan()) recover();
      } else if (retreatClock > 6) {
        state = 'failed';
      } else if (controller.speed * retreatDirection >= -0.1) {
        input.up = false;
        const speed = Math.min(2, Math.max(0.4, distance * 2));
        input.z = retreatDirection < 0 ? speed / 4 : -speed / 12;
      }
    } else if (state === 'navigating') {
      let target = route[index], distance = Math.hypot(target.x - ski.position.x, target.z - ski.position.z);
      if (distance < 0.4 && Math.abs(controller.speed) < 1) {
        if (++index >= route.length) {
          if (Math.abs(controller.speed) < 0.15) state = 'arrived';
          else index--;
        } else { target = route[index]; distance = Math.hypot(target.x - ski.position.x, target.z - ski.position.z); }
      }
      if (state === 'navigating' && distance >= 0.4) {
        const turn = angleDifference(Math.atan2(target.x - ski.position.x, target.z - ski.position.z) - ski.rotation.y);
        input.x = -Math.max(-1, Math.min(1, turn * 2));
        const speed = Math.min(CRUISE_SPEED, distance * 1.5, Math.abs(turn) > 0.55 ? 0 : Math.abs(turn) > 0.25 ? 2 : CRUISE_SPEED);
        probeClock -= dt;
        if (probeClock <= 0) {
          clear = probe(Math.max(Math.abs(controller.speed), speed), input.x, turn);
          probeClock = PROBE_INTERVAL;
        }
        input.up = !clear || Math.abs(controller.speed) > speed + 0.15 || speed === 0;
        input.z = input.up ? 0 : -speed / 12;
      }
    }
    controller.update(dt, input);
    if (state === 'navigating') {
      const moved = Math.hypot(ski.position.x - anchorX, ski.position.z - anchorZ);
      const turned = Math.abs(angleDifference(ski.rotation.y - anchorYaw));
      if (moved > 0.15 || turned > 0.08) {
        anchorX = ski.position.x; anchorZ = ski.position.z; anchorYaw = ski.rotation.y; stalled = 0;
      } else stalled += dt;
      if (stalled > 1.2) recover();
    }
    return state;
  }

  return {
    start(destination) {
      goal.x = destination.x; goal.z = destination.z; clock = 0; budget = 60; recoveries = 0;
      if (!plan()) recover();
      return state !== 'failed';
    },
    update,
    cancel() { route = null; state = 'idle'; },
    get state() { return state; },
    get recoveries() { return recoveries; },
  };
}
