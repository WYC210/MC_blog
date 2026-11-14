import assert from 'node:assert/strict';
import test from 'node:test';
import { RESIDENT_TOPICS, RESIDENT_WELCOME, residentWithinTalkingDistance } from '../world/resident-dialogue-data.js';

function pair() {
  return { player: { pos: { x: 1, z: 1 }, y: 0, mode: 'ground' }, resident: { pos: { x: 0, z: 0 }, y: 0, state: 'walking', vehicle: null } };
}

test('all requested topics have unique choices and distinct bilingual answers', () => {
  const expected = ['qin-legend', 'home-fun', 'night-concert', 'qin-cinema', 'great-wall', 'about-host'];
  assert.deepEqual(RESIDENT_TOPICS.map(topic => topic.id), expected);
  for (const language of [0, 1]) {
    assert.equal(new Set(RESIDENT_TOPICS.map(topic => topic.answer[language])).size, expected.length);
    assert.ok(RESIDENT_WELCOME[language].length > 10);
    for (const topic of RESIDENT_TOPICS) {
      assert.ok(topic.label[language].length > 0);
      assert.ok(topic.answer[language].length > 50);
    }
  }
  assert.match(RESIDENT_TOPICS[0].answer[0], /玉玺.*兵马俑/);
});

test('talking is available for nearby daily and scene activities', () => {
  const { player, resident } = pair();
  for (const state of ['walking', 'resting', 'fishing', 'concert', 'researching', 'investigating']) {
    resident.state = state;
    assert.equal(residentWithinTalkingDistance(player, resident), true);
  }
  player.mode = 'rest';
  assert.equal(residentWithinTalkingDistance(player, resident), true);
});

test('sleeping, driving, flying and swimming cannot start a conversation', () => {
  const { player, resident } = pair();
  for (const state of ['sleeping', 'boating', 'swim']) {
    resident.state = state;
    assert.equal(residentWithinTalkingDistance(player, resident), false);
  }
  resident.state = 'walking'; resident.vehicle = {};
  assert.equal(residentWithinTalkingDistance(player, resident), false);
  resident.vehicle = null;
  for (const mode of ['fly', 'air', 'swim', 'vehicle', 'ladder']) {
    player.mode = mode;
    assert.equal(residentWithinTalkingDistance(player, resident), false);
  }
});

test('conversation range accounts for floors and horizontal distance', () => {
  const { player, resident } = pair();
  player.pos.x = 4;
  assert.equal(residentWithinTalkingDistance(player, resident), false);
  player.pos.x = 0; player.y = 12; resident.y = 18.865;
  assert.equal(residentWithinTalkingDistance(player, resident), false);
  player.y = 19;
  assert.equal(residentWithinTalkingDistance(player, resident), true);
});
