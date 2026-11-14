import assert from 'node:assert/strict';
import test from 'node:test';
import { createResidentBoatPilot } from '../world/resident-boat-pilot.js';
import { createResidentNavigation } from '../world/resident-navigation.js';

function fixture({ column = 0, row = 0, yaw = 0, water = () => true, path = (_, goal) => [goal] } = {}) {
  const ski = { position: { x: column, z: row }, rotation: { y: yaw } };
  let speed = 0, collisions = 0, minimumSpeed = 0, peakSpeed = 0, plans = 0, inputReference = null;
  function canFloat(column, row, heading) {
    const sine = Math.sin(heading), cosine = Math.cos(heading);
    for (const length of [-1.3, -0.65, 0, 0.7, 1.3, 1.95]) for (const width of [-0.65, 0, 0.65]) {
      if (!water(column + sine * length + cosine * width, row + cosine * length - sine * width)) return false;
    }
    return true;
  }
  const controller = {
    get speed() { return speed; },
    update(dt, input) {
      if (inputReference) assert.equal(input, inputReference, 'Pilot reuses the same input object');
      inputReference = input; assert.equal(input.run, false);
      const throttle = -input.z, desired = input.up ? 0 : throttle > 0.05 ? throttle * 12 : throttle < -0.05 ? throttle * 4 : 0;
      const acceleration = input.up ? 18 : throttle === 0 ? 2.4 : Math.sign(desired) !== Math.sign(speed) && Math.abs(speed) > 0.2 ? 9 : 6;
      speed += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - speed));
      const steering = -input.x * (0.55 + Math.min(1, Math.abs(speed) / 6) * 1.05) * (speed < -0.1 ? -1 : 1);
      const steps = Math.max(1, Math.ceil(Math.abs(speed) * dt / 0.15));
      for (let step = 0; step < steps; step++) {
        let heading = ski.rotation.y + steering * dt / steps;
        if (!canFloat(ski.position.x, ski.position.z, heading)) heading = ski.rotation.y;
        ski.rotation.y = Math.atan2(Math.sin(heading), Math.cos(heading));
        const column = ski.position.x + Math.sin(heading) * speed * dt / steps;
        const row = ski.position.z + Math.cos(heading) * speed * dt / steps;
        if (!canFloat(column, row, heading)) { speed = 0; collisions++; break; }
        ski.position.x = column; ski.position.z = row;
      }
      peakSpeed = Math.max(peakSpeed, speed); minimumSpeed = Math.min(minimumSpeed, speed);
    },
  };
  const pilot = createResidentBoatPilot({ ski, canFloat, findPath(start, goal) { plans++; return path(start, goal, canFloat); } });
  function finish(seconds = 90, dt = 1 / 30) {
    for (let frame = 0; frame < seconds / dt && !['arrived', 'failed'].includes(pilot.state); frame++) {
      const column = ski.position.x, row = ski.position.z;
      pilot.update(dt, controller);
      assert.ok(canFloat(ski.position.x, ski.position.z, ski.rotation.y), 'The hull stays in navigable water');
      assert.ok(Math.hypot(ski.position.x - column, ski.position.z - row) <= 6 * dt + 0.001, 'Recovery cannot teleport the boat');
    }
    return { state: pilot.state, collisions, minimumSpeed, peakSpeed, plans };
  }
  return { ski, controller, pilot, canFloat, finish };
}

test('steering uses the actual vehicle sign and brakes before a large heading change', () => {
  for (const direction of [-1, 1]) {
    const source = fixture();
    source.pilot.start({ x: direction * 20, z: 0 });
    source.pilot.update(1 / 30, source.controller);
    assert.ok(source.ski.rotation.y * direction > 0);
    assert.equal(source.controller.speed, 0);
    const result = source.finish();
    assert.equal(result.state, 'arrived'); assert.equal(result.plans, 1);
    assert.ok(result.peakSpeed <= 6 && Math.abs(source.controller.speed) < 0.15);
    assert.ok(Math.hypot(source.ski.position.x - direction * 20, source.ski.position.z) < 0.4);
  }
});

test('sharp corners and the final docking point slow down without waypoint overshoot', () => {
  for (const dt of [1 / 60, 1 / 30, 0.05]) {
    const source = fixture({ path: (_, goal) => [{ x: 0, z: 16 }, { x: 16, z: 16 }, goal] });
    source.pilot.start({ x: 16, z: -10 });
    assert.equal(source.finish(60, dt).state, 'arrived');
    assert.ok(Math.hypot(source.ski.position.x - 16, source.ski.position.z + 10) < 0.4);
  }
});

test('a boat pinned against a world boundary backs out before turning and replanning', () => {
  const source = fixture({ row: 18.04, water: (_, row) => row < 20,
    path: (start, goal, canFloat) => {
      for (let sample = 0; sample < 16; sample++) if (!canFloat(start.x, start.z, sample * Math.PI / 8)) return null;
      return [goal];
    },
  });
  source.pilot.start({ x: 0, z: 0 });
  const result = source.finish();
  assert.equal(result.state, 'arrived'); assert.equal(source.pilot.recoveries, 1);
  assert.ok(result.minimumSpeed < -1 && result.plans >= 2);
  assert.equal(result.collisions, 0);
});

test('lookahead stops before a new obstacle, retreats and obtains a different route', () => {
  let obstacle = false;
  const source = fixture({ water: (column, row) => !obstacle || column < -3 || column > 3 || row < 10 || row > 12,
    path: (_, goal) => obstacle ? [{ x: -7, z: 4 }, { x: -7, z: 16 }, goal] : [goal],
  });
  source.pilot.start({ x: 0, z: 24 });
  for (let frame = 0; frame < 30; frame++) source.pilot.update(1 / 30, source.controller);
  obstacle = true;
  const result = source.finish();
  assert.equal(result.state, 'arrived'); assert.equal(result.collisions, 0);
  assert.ok(result.minimumSpeed < 0 && result.plans >= 2);
});

test('unreachable goals have a bounded retry budget instead of endless wall pushing', () => {
  const source = fixture({ path: () => null });
  source.pilot.start({ x: 0, z: 40 });
  const result = source.finish(45);
  assert.equal(result.state, 'failed'); assert.equal(source.pilot.recoveries, 3);
  assert.equal(result.plans, 4); assert.ok(Math.abs(source.controller.speed) < 0.15);
});

test('zero-time updates and cancellation do not advance or allocate another control object', () => {
  const source = fixture();
  source.pilot.start({ x: 10, z: 0 }); source.pilot.update(0, source.controller);
  assert.deepEqual(source.ski, { position: { x: 0, z: 0 }, rotation: { y: 0 } });
  source.pilot.cancel(); source.pilot.update(1, source.controller);
  assert.equal(source.pilot.state, 'idle'); assert.equal(source.controller.speed, 0);
});

function navigation(canFloat, canSwim = canFloat) {
  return createResidentNavigation({ nav: { canStand: () => false }, world: {}, jetSki: { canFloat, canSwim } });
}

function validateRoute(start, route, canFloat) {
  assert.ok(route?.length);
  let previous = start;
  for (const point of route) {
    const steps = Math.ceil(Math.hypot(point.x - previous.x, point.z - previous.z) / 0.1);
    const heading = Math.atan2(point.x - previous.x, point.z - previous.z);
    for (let sample = 0; sample <= steps; sample++) {
      const fraction = steps ? sample / steps : 0;
      assert.ok(canFloat(previous.x + (point.x - previous.x) * fraction, previous.z + (point.z - previous.z) * fraction, heading));
    }
    previous = point;
  }
}

test('water routes validate the full hull rather than a swimmer-only start connector', () => {
  const nav = navigation((column, row) => column > -20 && column < 20 && row > -20 && row < 20, () => true);
  assert.equal(nav.waterPath({ x: -21, z: 0 }, { x: 10, z: 0 }, true), null);
  assert.equal(nav.waterPath({ x: 0, z: 0 }, { x: 25, z: 0 }, true), null);
});

test('coarse A* and line simplification route around an island without clipping corners', () => {
  const source = fixture({ water: (column, row) => column > -40 && column < 40 && row > -30 && row < 30
    && (column < -5 || column > 5 || row < -5 || row > 5) });
  const nav = navigation(source.canFloat, (column, row) => source.canFloat(column, row, 0));
  const start = { x: -20, z: 0 }, goal = { x: 20, z: 0 }, route = nav.waterPath(start, goal, true);
  validateRoute(start, route, source.canFloat); assert.deepEqual(route.at(-1), goal);
});

test('fine-grid fallback preserves a valid water corridor missed by coarse cells', () => {
  const water = (column, row) => column > -10 && column < 10 && row > 0.1 && row < 1.9
    && !(column > -0.5 && column < 0.5 && row < 1);
  const nav = navigation(water), start = { x: -9, z: 0.5 }, goal = { x: 9, z: 0.5 };
  const route = nav.waterPath(start, goal, true);
  validateRoute(start, route, water); assert.deepEqual(route.at(-1), goal);
  validateRoute(goal, nav.waterPath(goal, start), water);
  validateRoute(start, nav.waterPath(start, goal, true), water);
});
