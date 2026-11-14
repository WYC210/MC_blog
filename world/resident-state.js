import { ISLAND } from './layout.js';

export const RESIDENT_STATE_VERSION = 2;

const STATES = new Set(['sleeping', 'walking', 'resting', 'fishing', 'boating', 'concert']);
const ACTIVITIES = new Set(['sleeping', 'home', 'resting', 'wandering', 'fishing', 'boating', 'concert']);
const LAND_ACTIONS = new Set(['enterHome', 'beginRest', 'beginFishing', 'finishWander', 'boardBoat', 'finishBoatReturn', 'arriveConcert']);
const EXIT_ACTIONS = new Set(['chooseActivity', 'reachConcert', 'leaveHome']);

function pointValid(point) {
  return point && Number.isFinite(point.x) && point.x >= ISLAND.x0 && point.x < ISLAND.x1 &&
    Number.isFinite(point.z) && point.z >= ISLAND.z0 && point.z < ISLAND.z1 &&
    Number.isFinite(point.y) && point.y >= -5 && point.y <= 40;
}

export function validResidentState(saved) {
  if (!saved || saved.version !== RESIDENT_STATE_VERSION || !STATES.has(saved.state) || !ACTIVITIES.has(saved.activity)) return false;
  if (!pointValid(saved.position) || !Number.isFinite(saved.heading) || typeof saved.night !== 'boolean') return false;
  if (!['sit', 'lie'].includes(saved.restKind) || saved.restId !== null && typeof saved.restId !== 'string') return false;
  for (const timer of ['wait', 'activityClock', 'boatCooldown', 'concertClock']) {
    if (!Number.isFinite(saved[timer]) || saved[timer] < 0 || saved[timer] > 1000000) return false;
  }
  if (saved.state === 'walking') {
    const route = saved.route;
    if (!route || !pointValid(route.target) || !Number.isInteger(route.index) || route.index < 0) return false;
    if (route.kind === 'land') { if (!LAND_ACTIONS.has(route.action)) return false; }
    else if (route.kind === 'home-enter') { if (route.action !== 'arriveHome' || route.index >= 4) return false; }
    else if (route.kind === 'home-exit') { if (!EXIT_ACTIONS.has(route.action) || route.index >= 5) return false; }
    else return false;
  } else if (saved.route !== null) return false;
  if (saved.state === 'boating') {
    if (!pointValid(saved.boat) || !Number.isFinite(saved.boat.yaw) || saved.activity !== 'boating') return false;
    if (Math.hypot(saved.position.x - saved.boat.x, saved.position.z - saved.boat.z) > 0.3) return false;
  } else if (saved.boat !== null) return false;
  return true;
}

export function residentStorageKey(url) {
  return `homecraft:resident:${new URL('.', url).pathname}`;
}

export function createResidentStore({ key, storage = () => globalThis.localStorage }) {
  return {
    read() {
      try {
        const text = storage()?.getItem(key);
        if (!text || text.length > 8192) return null;
        const saved = JSON.parse(text);
        return validResidentState(saved) ? saved : null;
      } catch { return null; }
    },
    write(saved) {
      if (!validResidentState(saved)) return false;
      try {
        const target = storage();
        if (!target) return false;
        target.setItem(key, JSON.stringify(saved));
        return true;
      } catch { return false; }
    },
  };
}
