import * as THREE from 'three';
import { createAvatar } from '@engine/world/avatar.js';
import { t, onLang } from '@engine/lang.js';
import { createResidentNavigation } from './resident-navigation.js';
import { createResidentBoatPilot } from './resident-boat-pilot.js';
import { createResidentStore, residentStorageKey, RESIDENT_STATE_VERSION } from './resident-state.js';
import { REST_POINTS } from './rest-points.js';
import { applyFishingPose } from './fishing.js';
import { RESIDENT_HOME } from './layout.js';
import { createResidentEventTrigger, RESIDENT_EVENTS } from './resident-events.js';
import { createResidentDialogue } from './resident-dialogue.js';

const WALK_SPEED = 1.35;
const FLY_SPEED = 4.2;
const SWORD_LIFT = 0.55;
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

export function createResident({ stage, world, nav, player, jetSki, config, nightConcert, qinIsland, rig, sound }) {
  const settings = config.resident;
  if (!settings?.enabled) return null;

  const avatar = createAvatar(settings.skin || config.skin);
  const shadow = avatar.blob;
  const navigation = createResidentNavigation({ nav, world, jetSki });
  const boatPilot = createResidentBoatPilot({ ski: jetSki.ski, canFloat: jetSki.canFloat, findPath: navigation.waterPath });
  const storageKey = residentStorageKey(location.href);
  const store = createResidentStore({ key: storageKey });
  const beachSeats = REST_POINTS.filter(point => point.id?.startsWith('beach-'));
  const greeting = document.createElement('div');
  greeting.className = 'resident-greeting';
  greeting.hidden = true;
  greeting.innerHTML = '<b></b><span></span>';
  const greetingText = greeting.querySelector('span');
  let spokenLine = ['你好，欢迎来到我的世界，随意参观吧', 'Hello, welcome to my world. Feel free to explore!'];
  const welcomeLine = spokenLine;
  const labelGreeting = () => { greetingText.textContent = t(...spokenLine); };
  labelGreeting(); onLang(labelGreeting);
  document.body.append(greeting);
  stage.scene.add(avatar.root, shadow);

  const bed = RESIDENT_HOME.bed;
  const position = { x: bed.x, z: bed.z };
  const projection = new THREE.Vector3();
  const rod = createFishingRod(avatar.root);
  const sword = createFlyingSword(avatar.root);
  let lift = 0;
  let height = bed.y, heading = 0;
  let state = 'sleeping';
  let activity = 'sleeping';
  let route = [];
  let routeIndex = 0;
  let routeDone = null;
  let routeKind = 'land';
  let restPoint = null;
  let restKind = 'sit';
  let wait = 0;
  let activityClock = 0;
  let boatCooldown = 0;
  let greetingClock = 0;
  let greetingCooldown = 0;
  let bubbleClock = 0;
  let bubbleClockStep = 0;
  let lastNight = world.isNight();
  let lookYaw = 0;
  let concertClock = 0;
  let saveClock = 0;
  const eventTrigger = createResidentEventTrigger();
  let sceneEvent = null, suspended = null;
  let eventVisible = false;
  let eventClock = 0, speechCooldown = 0, speechIndex = 0;
  const idlePose = { speed: 0, fly: -1, lookYaw: 0 };
  const researchPose = { speed: 0, fly: -1, rest: 'sit', lookYaw: 0, lookPitch: 0.12 };
  const talkingPose = { speed: 0, fly: -1, rest: null, lookYaw: 0 };

  greeting.querySelector('b').textContent = settings.name || config.name || 'Host';
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
    routeKind = 'land';
    state = 'walking';
    return true;
  }

  function makeHomeRoute() {
    if (!makeLandRoute(RESIDENT_HOME.entry, 'enterHome')) return false;
    activity = 'home';
    return true;
  }

  function enterHome() {
    route = navigation.homeRoute(true).slice(1);
    routeIndex = 0; routeDone = 'arriveHome'; routeKind = 'home-enter'; state = 'walking';
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
    return makeLandRoute(point, 'beginRest');
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
    return makeLandRoute(target, 'finishWander');
  }

  function finishWander() {
    clearRoute(); state = 'resting'; activity = 'wandering'; wait = 4 + Math.random() * 8;
  }

  function beginBoat() {
    if (boatCooldown > 0 || jetSki.occupied || jetSki.reservedBy) return false;
    if (!makeLandRoute({ x: -14, z: -23.5 }, 'boardBoat')) return false;
    activity = 'boating';
    return true;
  }

  function boardBoat() {
    clearRoute();
    if (!jetSki.reserve(resident)) { state = 'resting'; boatCooldown = 20; chooseActivity(); return; }
    const previousX = position.x, previousZ = position.z, previousY = height;
    setPosition(jetSki.ski.position.x, jetSki.ski.position.z, 0);
    state = 'swim';
    if (!jetSki.boardNPC(resident, resident)) {
      jetSki.release(resident); setPosition(previousX, previousZ, previousY);
      state = 'resting'; boatCooldown = 20; chooseActivity(); return;
    }
    if (!boatPilot.start(BOAT_DOCK)) { boatCooldown = 90; dismountBoat(); return; }
    state = 'boating';
  }

  function dismountBoat() {
    if (!resident.vehicle) return;
    boatPilot.cancel(); boatCooldown = Math.max(boatCooldown, 30);
    const controller = resident.vehicle;
    controller.stop();
    resident.vehicle = null;
    setPosition(BOAT_DOCK.x, BOAT_DOCK.z, nav.heightAt(BOAT_DOCK.x, BOAT_DOCK.z));
    state = 'walking';
    activity = 'boating';
    route = [];
    routeIndex = 0;
    routeDone = 'finishBoatReturn';
    const shore = nav.nearestStand(BOAT_DOCK.x, -26.1);
    if (shore) makeLandRoute(shore, routeDone);
  }

  function finishBoatReturn() {
    clearRoute(); state = 'resting'; wait = 4;
  }

  function chooseActivity() {
    if (world.isNight()) {
      if (nightConcert?.active && concertClock < 180) beginConcert();
      else beginHome();
      return;
    }
    activityClock = 0;
    const roll = Math.random();
    if (roll < 0.25 && chooseRest()) return;
    if (roll < 0.5 && beginFishingRoute()) return;
    if (roll < 0.7 && beginBoat()) return;
    if (beginWander()) return;
    wait = 4;
  }

  function beginFishingRoute() {
    return makeLandRoute(FISHING_SPOT, 'beginFishing');
  }

  function beginHome() {
    greeting.hidden = true;
    rod.visible = false;
    if (resident.vehicle) dismountBoat();
    if (state === 'swim') setPosition(BOAT_DOCK.x, BOAT_DOCK.z, 0);
    if (!makeHomeRoute()) arriveHome();
  }

  function exitHome(done) {
    route = navigation.homeRoute(false);
    let closest = 0, distance = Infinity;
    for (let index = 0; index < route.length; index++) {
      const point = route[index];
      const away = Math.hypot(point.x - position.x, point.z - position.z, point.y - height);
      if (away < distance) { distance = away; closest = index; }
    }
    routeIndex = closest;
    routeDone = done;
    routeKind = 'home-exit';
    state = 'walking';
  }

  function leaveHome() {
    setPosition(RESIDENT_HOME.entry.x, RESIDENT_HOME.entry.z, RESIDENT_HOME.entry.y); chooseActivity();
  }

  function reachConcert() {
    activity = 'concert';
    if (!makeLandRoute(nightConcert.target, 'arriveConcert')) beginHome();
  }

  function arriveConcert() {
    clearRoute(); state = 'concert'; heading = -Math.PI / 2;
  }

  function beginConcert() {
    greeting.hidden = true;
    rod.visible = false;
    if (resident.vehicle) dismountBoat();
    if (state === 'swim') setPosition(BOAT_DOCK.x, BOAT_DOCK.z, 0);
    activity = 'concert';
    if (height > 0.5) exitHome('reachConcert');
    else reachConcert();
  }

  function updateWalking(dt) {
    const target = route[routeIndex];
    if (!target) { actions[routeDone]?.(); return; }
    const dx = target.x - position.x, dz = target.z - position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, dt * (routeKind === 'land' ? FLY_SPEED : WALK_SPEED));
    if (distance > 0.001) {
      position.x += dx / distance * step;
      position.z += dz / distance * step;
      heading += shortestAngle(Math.atan2(dx, dz) - heading) * Math.min(1, dt * 7);
      height += (target.y - height) * Math.min(1, dt * 8);
    }
    if (distance <= step + 0.02) {
      position.x = target.x; position.z = target.z; height = target.y;
      if (++routeIndex >= route.length) { const done = routeDone; clearRoute(); actions[done]?.(); }
    }
  }

  function updateBoat(dt) {
    if (!resident.vehicle) return;
    const result = boatPilot.update(dt, resident.vehicle);
    position.x = jetSki.ski.position.x; position.z = jetSki.ski.position.z;
    heading = jetSki.ski.rotation.y; height = resident.vehicle.rider.y;
    if (result === 'failed') boatCooldown = 90;
    if (result === 'arrived' || result === 'failed') dismountBoat();
  }

  function updateGreeting(dt) {
    greetingCooldown = Math.max(0, greetingCooldown - dt);
    const distance = Math.hypot(player.pos.x - position.x, player.pos.z - position.z);
    const near = distance < GREETING_DISTANCE && Math.abs(player.y - height) < 2 && state !== 'sleeping' && state !== 'boating';
    if (near) {
      lookYaw = clamp(shortestAngle(angleBetween(position, player.pos) - heading), -1.1, 1.1);
      if (greetingCooldown <= 0) {
        avatar.wave(); greetingCooldown = 8;
        bubbleClock = 5;
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
    projection.set(position.x, height + lift + 2.65, position.z).project(stage.camera);
    if (projection.z < -1 || projection.z > 1 || Math.abs(projection.x) > 1 || Math.abs(projection.y) > 1) {
      greeting.hidden = true;
      return;
    }
    const halfWidth = greeting.offsetWidth / 2;
    const x = clamp((projection.x * 0.5 + 0.5) * innerWidth, halfWidth + 12, innerWidth - halfWidth - 12);
    const y = clamp((-projection.y * 0.5 + 0.5) * innerHeight, greeting.offsetHeight + 16, innerHeight - 16);
    greeting.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
  }

  function update(dt) {
    dialogue.update(dt);
    if (dialogue.active) {
      greeting.hidden = true;
      talkingPose.rest = state === 'researching' ? 'sit' : state === 'resting' && activity === 'resting' ? restKind : null;
      talkingPose.lookYaw = clamp(shortestAngle(angleBetween(position, player.pos) - heading), -1.1, 1.1);
      avatar.update(dt, talkingPose);
      return;
    }
    boatCooldown = Math.max(0, boatCooldown - dt);
    const nextEvent = eventTrigger.update(player, dt);
    if (nextEvent !== sceneEvent) changeEvent(nextEvent);
    if (sceneEvent) {
      updateEvent(dt);
      updatePose(dt);
      bubbleClockStep += dt;
      if (bubbleClockStep > 0.1) { bubbleClockStep = 0; updateBubble(); }
      return;
    }
    const night = world.isNight();
    if (night !== lastNight) {
      lastNight = night;
      concertClock = 0;
      if (night) {
        if (nightConcert?.active) beginConcert();
        else beginHome();
      } else if (state === 'sleeping' || activity === 'home' || activity === 'concert') {
        if (height > 0.5) exitHome('chooseActivity');
        else chooseActivity();
      }
    }
    if (night && activity === 'concert') {
      concertClock += dt;
      if (concertClock >= 180) beginHome();
    }
    if (night && state !== 'sleeping' && state !== 'walking' && activity !== 'home' && activity !== 'concert') beginHome();

    if (state === 'walking') updateWalking(dt);
    else if (state === 'boating') updateBoat(dt);
    else if (state === 'resting' || state === 'fishing') {
      wait -= dt; activityClock += dt;
      if (state === 'fishing') rod.rotation.y = Math.sin(activityClock * 1.8) * 0.04;
      if (wait <= 0 && !night) {
        if (state === 'fishing') rod.visible = false;
        chooseActivity();
      }
    }

    updateGreeting(dt);
    updatePose(dt);
    bubbleClockStep += dt;
    if (bubbleClockStep > 0.1) { bubbleClockStep = 0; updateBubble(); }
    saveClock += dt;
    if (saveClock >= 3) { saveClock = 0; save(); }
  }

  function updatePose(dt) {
    if (state === 'researching') {
      if (!eventVisible) return;
      researchPose.lookYaw = Math.sin(eventClock * 0.48) * 0.18;
      avatar.update(dt, researchPose);
      avatar.armR.rotation.set(-1.12 + Math.sin(eventClock * 5) * 0.045, 0, 0.08);
      avatar.armL.rotation.set(-1.08 + Math.sin(eventClock * 5 + 1.3) * 0.04, 0, -0.08);
    } else if (state === 'investigating') {
      if (!eventVisible) return;
      idlePose.lookYaw = Math.sin(eventClock * 0.38) * 0.32;
      avatar.update(dt, idlePose);
      avatar.armR.rotation.set(-0.45 + Math.sin(eventClock * 0.7) * 0.12, 0, 0.15);
    } else if (state === 'walking') {
      // Outdoor routes ride a sword; stairs and rooms are still walked.
      if (routeKind === 'land') avatar.update(dt, { speed: 0, fly: 0.2, lookYaw });
      else avatar.update(dt, { speed: WALK_SPEED / 3, fly: -1, lookYaw });
    }
    else if (state === 'sleeping') avatar.update(dt, { speed: 0, fly: -1, rest: 'lie', lookYaw });
    else if (state === 'boating') avatar.update(dt, resident.vehicle?.pose || { speed: 0, fly: -1, ride: true });
    // Only a seat rest sits down; wandering, or returning from the boat, stands still.
    else if (state === 'resting') avatar.update(dt, { speed: 0, fly: -1, rest: activity === 'resting' ? restKind : null, lookYaw });
    else if (state === 'fishing') {
      avatar.update(dt, { speed: 0, fly: -1, lookYaw });
      applyFishingPose(avatar);
    } else if (state === 'concert') {
      idlePose.lookYaw = lookYaw;
      avatar.update(dt, idlePose);
      if (nightConcert.phase === 'applause' || nightConcert.cheering > 0) {
        const clap = Math.abs(Math.sin(concertClock * 7));
        avatar.armR.rotation.set(-1.2, -0.3, -0.35 - clap * 0.35);
        avatar.armL.rotation.set(-1.2, 0.3, 0.35 + clap * 0.35);
      }
    }

    // Lift the sword rider off the ground while flying; land (snap down) once any other activity starts.
    const liftTarget = state === 'walking' && routeKind === 'land' ? SWORD_LIFT : 0;
    if (state !== 'walking') lift = 0;
    else lift += (liftTarget - lift) * Math.min(1, dt * 6);
    sword.visible = lift > 0.02;
    avatar.root.position.set(position.x, height + lift, position.z);
    avatar.root.rotation.y = heading;
    shadow.visible = false;
  }

  const actions = { enterHome, arriveHome, beginRest, beginFishing, finishWander, boardBoat,
    finishBoatReturn, arriveConcert, chooseActivity, reachConcert, leaveHome };

  function changeEvent(next) {
    if (next) {
      if (!sceneEvent) suspended = snapshot();
      if (resident.vehicle) dismountBoat();
      boatPilot.cancel(); jetSki.release(resident);
      clearRoute(); rod.visible = false;
      const event = RESIDENT_EVENTS[next];
      setPosition(event.position.x, event.position.z, event.position.y);
      heading = event.heading; state = event.state; activity = event.state;
      avatar.root.rotation.y = heading;
    } else {
      clearRoute();
      if (!restore(suspended)) {
        arriveHome(); lastNight = world.isNight();
        if (!lastNight) { exitHome('leaveHome'); activity = 'home'; }
        else if (nightConcert?.active) beginConcert();
      }
      suspended = null;
    }
    sceneEvent = next;
    eventClock = 0; speechCooldown = 0; speechIndex = 0;
    bubbleClock = 0; greetingCooldown = 0; lookYaw = 0; greeting.hidden = true;
    spokenLine = welcomeLine; labelGreeting();
    save();
  }

  function updateEvent(dt) {
    const event = RESIDENT_EVENTS[sceneEvent];
    eventClock += dt;
    projection.set(position.x, height + 1, position.z).project(stage.camera);
    eventVisible = projection.z >= -1 && projection.z <= 1 && Math.abs(projection.x) < 1.2 && Math.abs(projection.y) < 1.2;
    const distance = Math.hypot(player.pos.x - position.x, player.pos.z - position.z);
    const blocked = qinIsland?.encounter.active || document.querySelector('dialog[open]');
    if (distance > event.distance || Math.abs(player.y - height) > 2.5 || blocked) {
      greeting.hidden = true; bubbleClock = 0; speechCooldown = 0;
      return;
    }
    speechCooldown = Math.max(0, speechCooldown - dt);
    bubbleClock = Math.max(0, bubbleClock - dt);
    if (speechCooldown <= 0) {
      spokenLine = event.lines[speechIndex]; labelGreeting();
      speechIndex = (speechIndex + 1) % event.lines.length;
      bubbleClock = 6; speechCooldown = 15;
    }
    greeting.hidden = bubbleClock <= 0;
  }

  function snapshot() {
    const target = route[route.length - 1];
    return {
      version: RESIDENT_STATE_VERSION, position: { x: position.x, y: height, z: position.z }, heading: shortestAngle(heading), state, activity,
      night: lastNight, restId: restPoint?.id || null, restKind, wait: Math.max(0, wait), activityClock, boatCooldown, concertClock,
      route: state === 'walking' && target ? { kind: routeKind, index: routeIndex, action: routeDone,
        target: { x: target.x, y: target.y, z: target.z } } : null,
      boat: state === 'boating' ? { x: jetSki.ski.position.x, y: jetSki.ski.position.y, z: jetSki.ski.position.z,
        yaw: shortestAngle(jetSki.ski.rotation.y) } : null,
    };
  }

  function save() {
    if (settings.persistent === false) return false;
    return store.write(suspended || snapshot());
  }

  function onHomeSegment(point, points, index, entering) {
    const target = points[index], previous = points[index - 1] || (entering ? RESIDENT_HOME.entry : bed);
    if (!target) return false;
    const dx = target.x - previous.x, dz = target.z - previous.z;
    const length = dx * dx + dz * dz;
    const fraction = length ? clamp(((point.x - previous.x) * dx + (point.z - previous.z) * dz) / length, 0, 1) : 1;
    return Math.hypot(point.x - previous.x - dx * fraction, point.z - previous.z - dz * fraction) < 0.4 &&
      point.y >= Math.min(previous.y, target.y) - 0.8 && point.y <= Math.max(previous.y, target.y) + 0.8;
  }

  function restore(saved) {
    if (!saved) return false;
    const point = saved.position, seat = beachSeats.find(candidate => candidate.id === saved.restId);
    let homePath = null;
    if (saved.state === 'boating') {
      if (jetSki.occupied || jetSki.reservedBy || !jetSki.canFloat(saved.boat.x, saved.boat.z, saved.boat.yaw)) return false;
    } else if (saved.state === 'sleeping' || saved.state === 'fishing' || saved.state === 'resting' && saved.activity === 'resting') {
      const target = saved.state === 'sleeping' ? bed : saved.state === 'fishing' ? FISHING_SPOT : seat;
      if (!target) return false;
      const targetY = target === seat && seat.kind !== 'lie' ? seat.y - 0.675 : target.y;
      if (Math.hypot(point.x - target.x, point.z - target.z, point.y - targetY) > 0.25) return false;
    } else if (saved.state === 'walking' && saved.route.kind !== 'land') {
      const entering = saved.route.kind === 'home-enter';
      homePath = navigation.homeRoute(entering);
      if (entering) homePath = homePath.slice(1);
      if (!onHomeSegment(point, homePath, saved.route.index, entering)) return false;
    } else if (!nav.canStand(point.x, point.z) || Math.abs(point.y - nav.heightAt(point.x, point.z)) > 1.25) return false;
    if (saved.state === 'concert' && !nightConcert) return false;
    if (saved.route?.action === 'beginRest' && !seat) return false;
    if (['reachConcert', 'arriveConcert'].includes(saved.route?.action) && !nightConcert) return false;
    setPosition(point.x, point.z, point.y);
    heading = saved.heading; state = saved.state; activity = saved.activity; lastNight = saved.night;
    restPoint = seat || null; restKind = saved.restKind; wait = saved.wait; activityClock = saved.activityClock;
    boatCooldown = saved.boatCooldown; concertClock = saved.concertClock;
    if (state === 'walking') {
      if (homePath) {
        route = homePath; routeIndex = saved.route.index; routeDone = saved.route.action; routeKind = saved.route.kind;
      } else if (!makeLandRoute(saved.route.target, saved.route.action)) return false;
    } else if (state === 'boating') {
      const previousX = jetSki.ski.position.x, previousY = jetSki.ski.position.y, previousZ = jetSki.ski.position.z, previousYaw = jetSki.ski.rotation.y;
      if (!jetSki.reserve(resident)) return false;
      jetSki.ski.position.set(saved.boat.x, saved.boat.y, saved.boat.z); jetSki.ski.rotation.set(0, saved.boat.yaw, 0);
      state = 'swim'; height = 0;
      if (!jetSki.boardNPC(resident, resident) || !boatPilot.start(BOAT_DOCK)) {
        resident.vehicle?.stop(); resident.vehicle = null; jetSki.release(resident); boatPilot.cancel();
        jetSki.ski.position.set(previousX, previousY, previousZ); jetSki.ski.rotation.set(0, previousYaw, 0);
        return false;
      }
      height = resident.vehicle.rider.y;
    }
    rod.visible = state === 'fishing';
    return true;
  }

  const resident = {
    root: avatar.root,
    avatar,
    pos: position,
    get y() { return height; },
    get mode() { return state === 'boating' ? 'vehicle' : state === 'swim' ? 'swim' : 'ground'; },
    get activity() { return activity; },
    get state() { return state; },
    get event() { return sceneEvent; },
    get dialogue() { return dialogue; },
    interact: () => dialogue.interact(),
    tap: (x, y, picked) => dialogue.tap(x, y, picked),
    get restored() { return restored; },
    storageKey,
    save,
    vehicle: null,
    mountVehicle(controller) { this.vehicle = controller; state = 'boating'; return true; },
    dismountVehicle() { dismountBoat(); return true; },
    update,
  };
  const restored = settings.persistent !== false && restore(store.read());
  const dialogue = createResidentDialogue({ resident, player, stage, rig, sound, qinIsland, name: settings.name || config.name || 'Host' });
  if (!restored) {
    arriveHome(); lastNight = world.isNight();
    if (lastNight) { if (nightConcert?.active) beginConcert(); }
    else { exitHome('leaveHome'); activity = 'home'; }
  }
  updatePose(0);
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  return resident;
}

// A plain flying sword hovering under the feet: one blade, a guard and a grip.
// Built once and only shown while the resident flies a land route.
function createFlyingSword(root) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.014, 1.6), new THREE.MeshLambertMaterial({ color: 0xcfefff, emissive: 0x2c7fa0, emissiveIntensity: 0.6 }));
  const guard = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.03, 0.04), new THREE.MeshLambertMaterial({ color: 0xd8b56a }));
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.04, 0.22), new THREE.MeshLambertMaterial({ color: 0x3a2a24 }));
  blade.position.set(0, 0, 0.1);
  guard.position.set(0, 0, -0.7);
  grip.position.set(0, 0, -0.84);
  group.add(blade, guard, grip);
  group.position.set(0, -0.1, 0);
  group.visible = false;
  root.add(group);
  return group;
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
