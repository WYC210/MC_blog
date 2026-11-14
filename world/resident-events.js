import { qinLandAt } from './qin-island-layout.js';

export const RESIDENT_EVENTS = {
  lehun: {
    state: 'researching',
    position: { x: 11.65, y: 19 + 0.54 - 0.675, z: 40.25 },
    heading: Math.PI,
    distance: 7,
    lines: [
      ['先看看这段 K 线，再把复盘笔记整理一下。', 'Let me study this chart and organize my research notes.'],
      ['成交量、走势……还得再研究研究。', 'Volume, price trends... there is more to study.'],
      ['这间研究室真不错，安静下来慢慢琢磨。', 'A quiet research room. Just the place to think things through.'],
    ],
  },
  qin: {
    state: 'investigating',
    position: { x: 156.5, y: 0, z: 18 },
    heading: 0.28,
    distance: 14,
    lines: [
      ['听说秦始皇像前面这些小兵会复活……', 'They say the soldiers in front of this statue can come to life...'],
      ['这附近那位四处走动的人，好像知道些什么。', 'That person wandering nearby seems to know something.'],
      ['要不靠近问候一下？说不定会有意想不到的事。', 'Perhaps go over and say hello? Something unexpected might happen.'],
    ],
  },
};

function insideEvent(id, player, margin = 0) {
  const { x, z } = player.pos;
  if (id === 'qin') return qinLandAt(x, z);
  return x >= 2 - margin && x < 18 + margin && z >= 36 - margin && z < 51 + margin &&
    player.y >= 11.5 && player.y < 22;
}

export function residentEventAt(player) {
  if (player.mode !== 'ground' && player.mode !== 'rest') return null;
  if (insideEvent('lehun', player)) return 'lehun';
  if (insideEvent('qin', player)) return 'qin';
  return null;
}

export function createResidentEventTrigger() {
  let current = null, away = 0;
  return {
    update(player, dt) {
      const next = residentEventAt(player);
      if (next) { current = next; away = 0; }
      else if (current && insideEvent(current, player, 0.6)) away = 0;
      else if (current) {
        away += dt;
        if (away >= 2) { current = null; away = 0; }
      }
      return current;
    },
  };
}
