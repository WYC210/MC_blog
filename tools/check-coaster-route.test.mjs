import assert from 'node:assert/strict';
import test from 'node:test';
import { COASTER_STATIONS, COASTER_CAR_COUNT, COASTER_CAR_SPACING, COASTER_STEPS, COASTER_PLATFORM, createCoasterRoute } from '../world/coaster-route.js';

test('the Qin line stops on both platforms with buffers for three cars', () => {
  const route = createCoasterRoute(), position = {}, tangent = {};
  assert.ok(route.length > 280 && route.length < 330);
  for (const [index, station] of COASTER_STATIONS.entries()) {
    route.sample(index ? route.end : route.start, position, tangent);
    assert.ok(Math.abs(position.x - station.x) < 1e-8);
    assert.ok(Math.abs(position.y - station.y - 0.18) < 1e-8);
    assert.ok(Math.abs(position.z - station.z) < 1e-8);
    assert.ok(tangent.z * (index ? 1 : -1) > 0.95);
  }
  assert.equal(COASTER_CAR_COUNT, 3);
  assert.ok(route.start > COASTER_CAR_SPACING + 1.4);
  assert.ok(route.length - route.end > COASTER_CAR_SPACING + 1.4);
});

test('distance sampling is continuous, finite and stays away from the main island buildings', () => {
  const route = createCoasterRoute(), position = {}, tangent = {}, previous = {};
  let highest = 0, steepest = 0;
  route.sample(0, previous, tangent);
  for (let distance = 0; distance <= route.length; distance += 0.1) {
    route.sample(distance, position, tangent);
    assert.ok(Object.values(position).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(tangent.x, tangent.y, tangent.z) - 1) < 1e-8);
    assert.ok(Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z) <= 0.101);
    assert.ok(position.x >= 14.5 && position.x < 89 && position.z > -68 && position.z <= 24.6);
    assert.ok(position.x > 38 || position.z < -25);
    assert.ok(position.y > 0.05);
    highest = Math.max(highest, position.y); steepest = Math.max(steepest, Math.abs(tangent.y));
    Object.assign(previous, position);
  }
  assert.ok(highest >= 42 && highest < 43);
  assert.ok(steepest > 0.94 && steepest < 0.99);
});

test('the island loop circles all four coasts and returns to the shared platform', () => {
  const route = createCoasterRoute('loop'), position = {}, tangent = {};
  const bounds = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  assert.ok(route.end - route.start > 400);
  for (const distance of [route.start, route.end]) {
    route.sample(distance, position, tangent);
    assert.ok(Math.abs(position.x - 15) < 1e-8);
    assert.ok(Math.abs(position.z + 31) < 1e-8);
    assert.ok(Math.abs(position.y - COASTER_PLATFORM.y - 0.18) < 1e-8);
  }
  for (let distance = 0; distance <= route.length; distance += 0.2) {
    route.sample(distance, position, tangent);
    assert.ok(Object.values(position).every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(tangent.x, tangent.y, tangent.z) - 1) < 1e-8);
    assert.ok(position.x < -39 || position.x > 41 || position.z < -25 || position.z > 57 || position.z > 34 && (position.x < -10 || position.x > 22));
    bounds.x0 = Math.min(bounds.x0, position.x); bounds.x1 = Math.max(bounds.x1, position.x);
    bounds.z0 = Math.min(bounds.z0, position.z); bounds.z1 = Math.max(bounds.z1, position.z);
  }
  assert.ok(bounds.x0 < -49 && bounds.x1 > 50 && bounds.z0 < -50 && bounds.z1 > 62);
});

test('all cars stay separated and supported throughout either line', () => {
  for (const id of ['loop', 'qin']) {
    const route = createCoasterRoute(id), position = {}, previous = {}, tangent = {};
    for (let distance = route.start; distance <= route.end; distance += 0.4) {
      for (let car = 0; car < COASTER_CAR_COUNT; car++) {
        route.sample(distance + (1 - car) * COASTER_CAR_SPACING, position, tangent);
        if (car) assert.ok(Math.hypot(position.x - previous.x, position.y - previous.y, position.z - previous.z) > 2.35);
        Object.assign(previous, position);
      }
    }
  }
});

test('wide island stairs reach the larger station without jumping', () => {
  assert.ok(COASTER_PLATFORM.x1 - COASTER_PLATFORM.x0 >= 13);
  assert.ok(COASTER_PLATFORM.z1 - COASTER_PLATFORM.z0 >= 11);
  let floor = 0, edge = -19.6;
  for (const step of COASTER_STEPS) {
    assert.ok(step.y - floor > 0 && step.y - floor < 0.18);
    assert.ok(Math.abs(step.z1 - edge) < 1e-8);
    assert.ok(step.x1 - step.x0 > 4);
    floor = step.y; edge = step.z0;
  }
  assert.equal(floor, COASTER_PLATFORM.y);
  assert.ok(Math.abs(edge - COASTER_PLATFORM.z1) < 1e-8);
});

test('four elevated scenic sections brake in advance in either direction', () => {
  const route = createCoasterRoute('loop'), position = {}, tangent = {};
  assert.deepEqual(route.sections.map(section => section.id), ['north', 'west', 'south', 'east']);
  assert.ok(route.length > 500 && route.length < 550);
  for (const section of route.sections) {
    const middle = (section.start + section.end) / 2;
    assert.equal(route.sectionAt(middle).id, section.id);
    route.sample(middle, position, tangent);
    assert.ok(position.y >= 28);
    assert.ok(section.end - section.start > 30);
    for (const direction of [1, -1]) {
      assert.equal(route.speedLimit(middle, direction), 7);
      const entry = direction === 1 ? section.start : section.end;
      assert.ok(route.speedLimit(entry - direction * 10, direction) < 17);
      assert.equal(route.speedLimit(entry, direction), 7);
    }
  }
  assert.equal(createCoasterRoute('qin').sections.length, 0);
});

test('the shared train can change routes without shifting any parked carriage', () => {
  const qin = createCoasterRoute(), loop = createCoasterRoute('loop'), position = {}, expected = {}, tangent = {};
  for (let distance = 0; distance <= 12; distance += 0.1) {
    qin.sample(distance, position, tangent); loop.sample(distance, expected, tangent);
    assert.ok(Math.hypot(position.x - expected.x, position.y - expected.y, position.z - expected.z) < 1e-8);
  }
  for (const offset of [-COASTER_CAR_SPACING, 0, COASTER_CAR_SPACING]) {
    qin.sample(qin.start + offset, expected, tangent); loop.sample(loop.end - offset, position, tangent);
    assert.ok(Math.hypot(position.x - expected.x, position.y - expected.y, position.z - expected.z) < 1e-8);
  }
});

test('sampling clamps to the two terminal stops', () => {
  const route = createCoasterRoute(), position = {}, expected = {}, tangent = {};
  route.sample(-100, position, tangent); route.sample(0, expected, tangent); assert.deepEqual(position, expected);
  route.sample(route.length + 100, position, tangent); route.sample(route.length, expected, tangent); assert.deepEqual(position, expected);
});
