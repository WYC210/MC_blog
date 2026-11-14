import assert from 'node:assert/strict';
import test from 'node:test';
import { createResidentEventTrigger, residentEventAt, RESIDENT_EVENTS } from '../world/resident-events.js';

function player(x, y, z, mode = 'ground') {
  return { pos: { x, z }, y, mode };
}

test('LeHun entry includes both floors, stairs and the entrance threshold', () => {
  for (const point of [[9.8, 12, 46.5], [9.8, 12, 50.5], [16, 15, 44], [14.1, 19, 40]]) {
    assert.equal(residentEventAt(player(...point)), 'lehun');
  }
  assert.equal(residentEventAt(player(12, 19, 47.7, 'rest')), 'lehun');
});

test('water beneath LeHun, rooftops and flyovers do not trigger events', () => {
  for (const point of [[9.8, -0.32, 46.5], [9.8, 26, 46.5], [0, 12, 46.5], [9.8, 12, 53]]) {
    assert.equal(residentEventAt(player(...point)), null);
  }
  for (const mode of ['fly', 'air', 'swim', 'vehicle']) {
    assert.equal(residentEventAt(player(12, 19, 40, mode)), null);
    assert.equal(residentEventAt(player(160, 0, 19, mode)), null);
  }
});

test('Qin uses the rounded island shoreline, not its rectangular map bounds', () => {
  assert.equal(residentEventAt(player(89, 0, 18)), 'qin');
  assert.equal(residentEventAt(player(160, 0, 19)), 'qin');
  for (const point of [[80, 0, 18], [84, 0, -72], [235, 0, 77], [0.5, 0, 18]]) {
    assert.equal(residentEventAt(player(...point)), null);
  }
});

test('events remain stable through jumps and brief boundary crossings', () => {
  const trigger = createResidentEventTrigger();
  assert.equal(trigger.update(player(12, 19, 40), 0), 'lehun');
  assert.equal(trigger.update(player(12, 20, 40, 'air'), 3), 'lehun');
  assert.equal(trigger.update(player(9.8, 12, 51.2), 5), 'lehun');
  assert.equal(trigger.update(player(0.5, 0, 18), 1.9), 'lehun');
  assert.equal(trigger.update(player(12, 19, 40), 0), 'lehun');
  assert.equal(trigger.update(player(0.5, 0, 18), 1.9), 'lehun');
  assert.equal(trigger.update(player(0.5, 0, 18), 0.1), null);
});

test('travelling between regions switches immediately and re-entry retriggers', () => {
  const trigger = createResidentEventTrigger();
  assert.equal(trigger.update(player(12, 19, 40), 0), 'lehun');
  assert.equal(trigger.update(player(89, 0, 18), 0), 'qin');
  assert.equal(trigger.update(player(12, 19, 40), 0), 'lehun');
  assert.equal(trigger.update(player(0.5, 0, 18), 2), null);
  assert.equal(trigger.update(player(89, 0, 18), 0), 'qin');
});

test('event anchors and bilingual speech are defined without real market data', () => {
  assert.ok(Math.abs(RESIDENT_EVENTS.lehun.position.y + 0.675 - 19.54) < 0.001);
  assert.equal(RESIDENT_EVENTS.lehun.heading, Math.PI);
  assert.ok(RESIDENT_EVENTS.qin.position.z > 16 && RESIDENT_EVENTS.qin.position.z < 24);
  for (const event of Object.values(RESIDENT_EVENTS)) {
    assert.ok(event.lines.length >= 3);
    assert.ok(event.lines.every(line => line.length === 2 && line.every(text => typeof text === 'string' && text.length > 0)));
  }
});
