import * as THREE from 'three';
import { createAvatar } from '@engine/world/avatar.js';
import { createResidentNavigation } from './resident-navigation.js';
import { REST_POINTS } from './rest-points.js';
import { applyFishingPose } from './fishing.js';
import { IKUN_ENTRY, RESIDENT_HOME } from './layout.js';

const WALK_SPEED = 1.35;
const GREETING_DISTANCE = 3.8;
const BOAT_DOCK = { x: -14, z: -28.5 };
const FISHING_SPOT = { x: -8, z: 27.35, y: 0.18, yaw: 0 };
const WANDER_SPOTS = [
  { x: -5, z: 16 }, { x: 8, z: 16 }, { x: -19, z: 12 },
  { x: 23, z: 10 }, { x: -10, z: -4 }, { x: 21, z: -4 },
];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleBetween(first, second) {
  return Math.atan2(second.x - first.x, second.z - first.z);
}

function shortestAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

export function createResident({ stage, world, nav, player, jetSki, config }) {
  const settings = config.resident;
  if (!settings?.enabled) return null;

  const avatar = createAvatar(settings.skin || 'assets/terry-skin.png');
  const shadow = avatar.blob;
  const navigation = createResidentNavigation({ nav, world, jetSki });
  const beachSeats = REST_POINTS.filter(point => point.id?.startsWith('beach-'));
  const greeting = document.createElement('div');
  greeting.className = 'resident-greeting';
  greeting.hidden = true;
  greeting.innerHTML = `<b></b><span>你好！ · Hello!</span>`;
  document.body.append(greeting);
  stage.scene.add(avatar.root, shadow);

  const bed = RESIDENT_HOME.bed;
  const position = { x: bed.x, z: bed.z };
  const rideInput = { x: 0, z: -1, run: true, up: false, down: false };
  const projection = new THREE.Vector3();
  const rod = createFishingRod(avatar.root);
  const boatEnd = { x: BOAT_DOCK.x, z: BOAT_DOCK.z };
  let height = bed.y, heading = 0;
  let state = 'sleeping';
  let activity = 'sleeping';
  let route = [];
  let routeIndex = 0;
  let routeDone = null;
  let restPoint = null;
  let restKind = 'sit';
  let wait = 0;
  let activityClock = 0;
  let boatRoute = null;
  let boatIndex = 0;
  let boatClock = 0;
  let greetingClock = 0;
  let greetingCooldown = 0;
  let bubbleClock = 0;
  let bubbleClockStep = 0;
  let lastNight = world.isNight();
  let lookYaw = 0;

  greeting.querySelector('b').textContent = settings.name || 'Terry';
  avatar.root.position.set(position.x, height, position.z);
  avatar.root.rotation.y = heading;
  avatar.update(0, { speed: 0, fly: -1, rest: 'lie' });
  shadow.visible = false;

  function setPosition(x, z, y = nav.heightAt(x, z)) {
    position.x = x; position.z = z; height = y;
    avatar.root.position.set(x, y, z);
  }

  function clearRoute() {
    route.length = 0; routeIndex = 0; routeDone = null;
  }

  function makeLandRoute(target, done) {
    const path = nav.findPath(position, target);
    if (!path?.length) return false;
    route = path.map(point => ({ x: point.x, z: point.z, y: nav.heightAt(point.x, point.z) }));
    routeIndex = 0;
    routeDone = done;
    state = 'walking';
    return true;
  }

  function makeHomeRoute() {
    const path = nav.findPath(position, IKUN_ENTRY);
    const stairs = navigation.homeRoute(true);
    if (!path?.length) return false;
    route = path.map(point => ({ x: point.x, z: point.z, y: nav.heightAt(point.x, point.z) }));
    route.push(...stairs.slice(1));
    routeIndex = 0;
    routeDone = arriveHome;
    state = 'walking';
    activity = 'home';
    return true;
  }

  function arriveHome() {
    clearRoute();
    setPosition(bed.x, bed.z, bed.y);
    heading = bed.yaw;
    state = 'sleeping';
    activity = 'sleeping';
    wait = 0;
    rod.visible = false;
  }

  function chooseRest() {
    if (!beachSeats.length) return false;
    const point = beachSeats[Math.floor(Math.random() * beachSeats.length)];
    restPoint = point;
    restKind = point.kind || 'sit';
    return makeLandRoute(point, beginRest);
  }

  function beginRest() {
    clearRoute();
    const restY = restKind === 'lie' ? restPoint.y : restPoint.y - 0.675;
    setPosition(restPoint.x, restPoint.z, restY);
    heading = restPoint.yaw || 0;
    state = 'resting';
    activity = 'resting';
    wait = 10 + Math.random() * 14;
  }

  function beginFishing() {
    clearRoute();
    setPosition(FISHING_SPOT.x, FISHING_SPOT.z, FISHING_SPOT.y);
    heading = FISHING_SPOT.yaw;
    state = 'fishing';
    activity = 'fishing';
    wait = 12 + Math.random() * 14;
    rod.visible = true;
  }

  function beginWander() {
    const target = WANDER_SPOTS[Math.floor(Math.random() * WANDER_SPOTS.length)];
    return makeLandRoute(target, () => {
      clearRoute(); state = 'resting'; activity = 'wandering'; wait = 4 + Math.random() * 8;
    });
  }

  function beginBoat() {
    const path = nav.findPath(position, { x: -14, z: -23.5 });
    if (!path?.length) return false;
    route = path.map(point => ({ x: point.x, z: point.z, y: nav.heightAt(point.x, point.z) }));
    routeIndex = 0;
    routeDone = boardBoat;
    state = 'walking';
    activity = 'boating';
    return true;
  }

  function boardBoat() {
    clearRoute();
    setPosition(jetSki.ski.position.x, jetSki.ski.position.z, 0);
    state = 'swim';
    if (!jetSki.reserve(resident)) { chooseActivity(); return; }
    if (!jetSki.boardNPC(resident, resident)) { jetSki.release(resident); chooseActivity(); return; }
    boatRoute = navigation.waterPath({ x: jetSki.ski.position.x, z: jetSki.ski.position.z }, boatEnd, true);
    if (!boatRoute?.length) { dismountBoat(); return; }
    boatIndex = 0;
    boatClock = 0;
    state = 'boating';
  }

  function dismountBoat() {
    if (!resident.vehicle) return;
    const controller = resident.vehicle;
    controller.stop();
    resident.vehicle = null;
    setPosition(BOAT_DOCK.x, BOAT_DOCK.z, nav.heightAt(BOAT_DOCK.x, BOAT_DOCK.z));
    state = 'walking';
    activity = 'boating';
    route = [];
    routeIndex = 0;
    routeDone = () => { state = 'resting'; wait = 4; };
    const shore = nav.nearestStand(BOAT_DOCK.x, -26.1);
    if (shore) makeLandRoute(shore, routeDone);
  }

  function chooseActivity() {
    activityClock = 0;
    const roll = Math.random();
    if (roll < 0.25 && chooseRest()) return;
    if (roll < 0.5 && beginFishingRoute()) return;
    if (roll < 0.7 && beginBoat()) return;
    if (beginWander()) return;
    wait = 4;
  }

  function beginFishingRoute() {
    return makeLandRoute(FISHING_SPOT, beginFishing);
  }

  function beginHome() {
    greeting.hidden = true;
    rod.visible = false;
    if (resident.vehicle) dismountBoat();
    if (state === 'swim') setPosition(BOAT_DOCK.x, BOAT_DOCK.z, 0);
    if (!makeHomeRoute()) arriveHome();
  }

  function updateWalking(dt) {
    const target = route[routeIndex];
    if (!target) { routeDone?.(); return; }
    const dx = target.x - position.x, dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, dt * WALK_SPEED);
    if (distance > 0.001) {
      position.x += dx / distance * step;
      position.z += dz / distance * step;
      heading += shortestAngle(Math.atan2(dx, dz) - heading) * Math.min(1, dt * 7);
      height += (target.y - height) * Math.min(1, dt * 8);
    }
    if (distance <= step + 0.02) {
      position.x = target.x; position.z = target.z; height = target.y;
      if (++routeIndex >= route.length) { const done = routeDone; clearRoute(); done?.(); }
    }
  }

  function updateBoat(dt) {
    if (!resident.vehicle || !boatRoute?.length) { dismountBoat(); return; }
    const target = boatRoute[boatIndex];
    const dx = target.x - jetSki.ski.position.x, dz = target.z - jetSki.ski.position.z;
    const distance = Math.hypot(dx, dz);
    const desired = Math.atan2(dx, dz);
    rideInput.x = clamp(shortestAngle(desired - jetSki.ski.rotation.y) * 1.8, -1, 1);
    rideInput.z = -1;
    resident.vehicle.update(dt, rideInput);
    position.x = jetSki.ski.position.x; position.z = jetSki.ski.position.z;
    heading = jetSki.ski.rotation.y; height = resident.vehicle.rider.y;
    boatClock += dt;
    if (distance < 1.4 && ++boatIndex >= boatRoute.length || boatClock > 30) dismountBoat();
  }

  function updateGreeting(dt) {
    greetingCooldown = Math.max(0, greetingCooldown - dt);
    const distance = Math.hypot(player.pos.x - position.x, player.pos.z - position.z);
    const near = distance < GREETING_DISTANCE && state !== 'sleeping' && state !== 'boating';
    if (near) {
      lookYaw = clamp(shortestAngle(angleBetween(position, player.pos) - heading), -1.1, 1.1);
      if (greetingCooldown <= 0) {
        avatar.wave(); greetingCooldown = 8;
        bubbleClock = 2.4;
      }
      if (bubbleClock > 0) bubbleClock -= dt;
      greeting.hidden = bubbleClock <= 0;
    } else {
      bubbleClock = 0; greeting.hidden = true;
      lookYaw = 0;
    }
  }

  function updateBubble() {
    if (greeting.hidden) return;
    projection.set(position.x, height + 2.65, position.z).project(stage.camera);
    const x = (projection.x * 0.5 + 0.5) * innerWidth;
    const y = (-projection.y * 0.5 + 0.5) * innerHeight;
    greeting.style.transform = `translate(${x}px, ${y}px)`;
  }

  function update(dt) {
    const night = world.isNight();
    if (night !== lastNight) { lastNight = night; if (night) beginHome(); else if (state === 'sleeping') { state = 'walking'; route = navigation.homeRoute(false); routeIndex = 0; routeDone = () => { setPosition(IKUN_ENTRY.x, IKUN_ENTRY.z, 0); chooseActivity(); }; } }
    if (night && state !== 'sleeping' && state !== 'walking' && activity !== 'home') beginHome();

    if (state === 'walking') updateWalking(dt);
    else if (state === 'boating') updateBoat(dt);
    else if (state === 'resting' || state === 'fishing') {
      wait -= dt; activityClock += dt;
      if (state === 'fishing') rod.rotation.y = Math.sin(activityClock * 1.8) * 0.04;
      if (wait <= 0 && !night) {
        if (state === 'fishing') rod.visible = false;
        chooseActivity();
      }
    } else if (state === 'sleeping') {
      avatar.update(dt, { speed: 0, fly: -1, rest: 'lie', lookYaw });
    }

    updateGreeting(dt);
    if (state === 'walking') avatar.update(dt, { speed: WALK_SPEED / 3, fly: -1, lookYaw });
    else if (state === 'boating') avatar.update(dt, resident.vehicle?.pose || { speed: 0, fly: -1, ride: true });
    else if (state === 'resting') avatar.update(dt, { speed: 0, fly: -1, rest: restKind, lookYaw });
    else if (state === 'fishing') {
      avatar.update(dt, { speed: 0, fly: -1, lookYaw });
      applyFishingPose(avatar);
    }

    avatar.root.position.set(position.x, height, position.z);
    avatar.root.rotation.y = heading;
    shadow.visible = false;
    bubbleClockStep += dt;
    if (bubbleClockStep > 0.1) { bubbleClockStep = 0; updateBubble(); }
  }

  const resident = {
    root: avatar.root,
    avatar,
    pos: position,
    get y() { return height; },
    get mode() { return state === 'boating' ? 'vehicle' : state === 'swim' ? 'swim' : 'ground'; },
    vehicle: null,
    mountVehicle(controller) { this.vehicle = controller; state = 'boating'; return true; },
    dismountVehicle() { dismountBoat(); return true; },
    update,
  };
  if (lastNight) arriveHome();
  else {
    route = navigation.homeRoute(false);
    routeIndex = 0;
    routeDone = () => { setPosition(IKUN_ENTRY.x, IKUN_ENTRY.z, 0); chooseActivity(); };
    state = 'walking';
    activity = 'home';
  }
  return resident;
}

function createFishingRod(root) {
  const group = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.028, 1.7, 6), new THREE.MeshLambertMaterial({ color: 0x564338 }));
  pole.rotation.x = Math.PI / 2;
  pole.position.set(0.28, 1.03, 0.72);
  const line = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 4), new THREE.MeshBasicMaterial({ color: 0xd8e4e4 }));
  line.rotation.x = Math.PI / 2;
  line.position.set(0.28, 0.92, 1.68);
  const float = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshLambertMaterial({ color: 0xf07d78 }));
  float.position.set(0.28, 0.52, 2.05);
  group.add(pole, line, float);
  group.visible = false;
  root.add(group);
  return group;
}
