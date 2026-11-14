import assert from 'node:assert/strict';
import test from 'node:test';
import { createResidentStore, residentStorageKey, validResidentState, RESIDENT_STATE_VERSION } from '../world/resident-state.js';

function snapshot() {
  return { version: RESIDENT_STATE_VERSION, position: { x: 0, y: 0, z: 16 }, heading: 0, state: 'resting', activity: 'wandering', night: false,
    restId: null, restKind: 'sit', wait: 5, activityClock: 0, boatCooldown: 0, concertClock: 0, route: null, boat: null };
}

test('resident snapshots round-trip without sharing runtime objects', () => {
  const data = new Map(), storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const store = createResidentStore({ key: 'resident', storage: () => storage }), saved = snapshot();
  assert.equal(store.read(), null);
  assert.equal(store.write(saved), true);
  assert.deepEqual(store.read(), saved);
  saved.position.x = 15;
  assert.equal(store.read().position.x, 0);
});

test('invalid, obsolete, oversized and unavailable storage falls back safely', () => {
  for (const text of ['broken', 'null', '{}', JSON.stringify({ ...snapshot(), version: 0 }), JSON.stringify({ ...snapshot(), version: 1 }), ' '.repeat(8193)]) {
    assert.equal(createResidentStore({ key: 'resident', storage: () => ({ getItem: () => text }) }).read(), null);
  }
  for (const storage of [() => undefined, () => { throw new Error('SecurityError'); },
    () => ({ getItem() { throw new Error('SecurityError'); }, setItem() { throw new Error('QuotaExceededError'); } })]) {
    const store = createResidentStore({ key: 'resident', storage });
    assert.equal(store.read(), null);
    assert.equal(store.write(snapshot()), false);
  }
});

test('snapshot validation rejects invalid coordinates, timers and continuations', () => {
  for (const change of [saved => saved.position.x = Infinity, saved => saved.position.z = 10000,
    saved => saved.position.y = null, saved => saved.heading = NaN, saved => saved.wait = -1,
    saved => saved.night = 'true', saved => saved.state = 'unknown', saved => saved.restKind = 'unknown',
    saved => saved.route = { action: 'constructor' }, saved => saved.boat = { x: 0, z: 0 }]) {
    const saved = snapshot(); change(saved);
    assert.equal(validResidentState(saved), false);
  }
  for (const [kind, action, index] of [['land', 'finishWander', 0], ['home-exit', 'leaveHome', 3], ['home-enter', 'arriveHome', 3]]) {
    const saved = { ...snapshot(), state: 'walking', route: { kind, action, index, target: { x: 5, y: 0, z: 16 } } };
    assert.equal(validResidentState(saved), true);
    saved.route.action = 'constructor';
    assert.equal(validResidentState(saved), false);
  }
});

test('home snapshots use the workbench route bounds rather than the former IKUN stairs', () => {
  for (const [kind, action, limit] of [['home-enter', 'arriveHome', 4], ['home-exit', 'leaveHome', 5]]) {
    const saved = { ...snapshot(), state: 'walking', route: { kind, action, index: limit - 1, target: { x: -21.5, y: 0, z: 15.5 } } };
    assert.equal(validResidentState(saved), true);
    saved.route.index = limit;
    assert.equal(validResidentState(saved), false);
  }
});

test('a saved rider must belong to the saved boat and boating activity', () => {
  const saved = { ...snapshot(), state: 'boating', activity: 'boating', boat: { x: 0, y: -0.42, z: 16, yaw: 0 } };
  assert.equal(validResidentState(saved), true);
  saved.boat.x = 20;
  assert.equal(validResidentState(saved), false);
  saved.boat.x = 0; saved.boat.yaw = Infinity;
  assert.equal(validResidentState(saved), false);
});

test('storage keys ignore view parameters and separate worlds on one origin', () => {
  assert.equal(residentStorageKey('http://localhost:8765/?lang=zh#about'), residentStorageKey('http://localhost:8765/index.html?debug'));
  assert.notEqual(residentStorageKey('http://localhost:8765/'), residentStorageKey('http://localhost:8765/examples/terry-home/'));
});
