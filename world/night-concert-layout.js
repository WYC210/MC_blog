import { FOUNTAIN } from './layout.js';

export const CONCERT = {
  x: FOUNTAIN.x - 0.6,
  z: FOUNTAIN.z - 7.5,
  cycle: 180,
  resident: { x: FOUNTAIN.x + 3.2, z: FOUNTAIN.z - 7.7 },
};

export const CONCERT_GUESTS = [
  { role: 'wind', x: FOUNTAIN.x - 2, z: FOUNTAIN.z - 5.9, entryX: -8, entryZ: -22, shirt: 0x487f89, yaw: Math.PI },
  { role: 'violin', x: FOUNTAIN.x + 0.8, z: FOUNTAIN.z - 5.9, entryX: -4, entryZ: -23, shirt: 0xa86a59, yaw: Math.PI },
  { role: 'audience', x: FOUNTAIN.x - 2.8, z: FOUNTAIN.z - 9.2, entryX: -11.5, entryZ: -22, shirt: 0xc39b56, yaw: 0.35 },
  { role: 'audience', x: FOUNTAIN.x + 1.3, z: FOUNTAIN.z - 10.1, entryX: -0.2, entryZ: -22, shirt: 0x7777a0, yaw: -0.25 },
];

export function concertPhase(time) {
  if (time < 14) return 'gathering';
  if (time < 38) return 'wind';
  if (time < 62) return 'violin';
  if (time < 106) return 'duet';
  if (time < 114) return 'applause';
  return 'mingling';
}
