import * as THREE from 'three';
import { COASTER_STATIONS, COASTER_CAR_SPACING, COASTER_BRAKING } from './coaster-route.js';
import { createCoasterView } from './coaster-view.js';

export function createCoasterService(coaster, { player, camera, sound, reduced, blocked }) {
  const { train, lines, turnout } = coaster;
  let line = lines[1], route = line.route;
  const rider = { x: 0, y: 0, z: 0, heading: 0 }, pose = { speed: 0, fly: -1, ride: true };
  const position = new THREE.Vector3(), tangent = new THREE.Vector3(), seat = new THREE.Vector3();
  const view = createCoasterView(route, camera);
  let distance = route.start, speed = 0, direction = 1, terminal = 0, destination = 0, state = 'idle', departure = 0;
  const mounted = () => player.vehicle === controller;
  const lead = () => train.cars[direction === 1 ? 0 : 2];
  function sync() {
    train.sync(route, distance, direction);
    const car = lead();
    seat.set(0, 0.76, -0.12).applyEuler(car.rotation).add(car.position);
    rider.x = seat.x; rider.y = seat.y - 0.675; rider.z = seat.z; rider.heading = car.rotation.y;
  }
  function choose(id) {
    if (state !== 'boarding' || route.id === 'qin' && terminal !== 0) return false;
    const next = lines.find(item => item.id === id);
    if (!next) return false;
    if (next !== line) {
      line = next; route = next.route; distance = route.start; direction = 1; terminal = destination = 0;
      view.setRoute(route); sync(); view.reset(distance + COASTER_CAR_SPACING, direction);
    }
    for (const item of lines) item.track.mesh.visible = item === line;
    turnout.select(id);
    return true;
  }
  function depart(target, occupied) {
    destination = target; direction = target === 1 ? 1 : -1; speed = 0;
    departure = occupied ? 1.5 : 0; state = turnout.moving ? 'switching' : occupied ? 'departing' : 'summoning'; sync();
  }
  function drive(dt) {
    if (state === 'idle' || state === 'boarding' || blocked() || dt <= 0) return;
    const elapsed = Math.min(dt, 0.1);
    if (turnout.moving) { state = 'switching'; return; }
    if (state === 'switching') state = mounted() ? 'departing' : 'summoning';
    if (departure > 0) { departure = Math.max(0, departure - elapsed); return; }
    if (mounted()) state = 'riding';
    route.sample(distance, position, tangent);
    const remaining = Math.max(0, destination === 1 ? route.end - distance : distance - route.start);
    const slope = tangent.y * direction;
    const preview = distance + direction * (speed * elapsed + 0.1);
    const limit = reduced.matches ? 6 : Math.min(THREE.MathUtils.clamp(14 - slope * 28, 6, 30), route.speedLimit(preview, direction));
    const braking = Math.sqrt(2 * COASTER_BRAKING * remaining), target = Math.min(limit, braking);
    const acceleration = slope < 0 ? 9 + -slope * 15 : 4;
    speed = Math.min(braking, speed + THREE.MathUtils.clamp(target - speed, -COASTER_BRAKING * elapsed, acceleration * elapsed));
    distance += direction * Math.min(remaining, Math.max(0.08, speed) * elapsed);
    if (remaining < 0.025) {
      distance = destination === 1 ? route.end : route.start; terminal = destination; speed = 0; state = 'idle';
      if (mounted()) sound.play('click');
    }
    sync();
  }
  const controller = { rider, pose, update: drive,
    stop() {
      if (state === 'boarding') state = 'idle';
      else if (state !== 'idle') depart(distance < (route.start + route.end) / 2 ? 0 : 1, false);
    },
    exit: () => state !== 'idle' && state !== 'boarding' ? null : COASTER_STATIONS[route.id === 'loop' ? 0 : terminal].exit,
    get speed() { return speed; },
  };
  sync();
  return { ...train, view, controller, depart, sync, drive, choose,
    board() { if (state === 'idle') state = 'boarding'; },
    call(station) {
      if (state !== 'idle') return false;
      if (route.id === 'loop' && station === 1) {
        state = 'boarding'; choose('qin'); state = 'idle';
      }
      depart(station, false); return true;
    },
    get id() { return line.id; }, get route() { return route; }, get track() { return line.track; },
    get car() { return lead(); }, get riding() { return mounted(); }, get state() { return state; },
    get distance() { return distance; }, get speed() { return speed; }, get direction() { return direction; },
    get terminal() { return terminal; }, get station() { return route.id === 'loop' ? 0 : terminal; },
    get destination() { return route.id === 'loop' ? 0 : destination; },
    get section() { return route.sectionAt(distance); },
    get progress() { return direction === 1 ? (distance - route.start) / (route.end - route.start) : (route.end - distance) / (route.end - route.start); },
    get eyeDistance() { return distance + direction * COASTER_CAR_SPACING; },
  };
}
