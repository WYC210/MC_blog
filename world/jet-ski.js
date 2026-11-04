import * as THREE from 'three';
import { t, onLang } from '@engine/lang.js';
import { ISLAND, POOL } from './layout.js';

const HULL_LENGTHS = [-1.3, -0.65, 0, 0.7, 1.3, 1.95];
const HULL_WIDTHS = [-0.65, 0, 0.65];
const WATER_HEIGHTS = [-0.1, 0.5, 1.6];
const EXIT_ANGLES = [Math.PI / 2, -Math.PI / 2, Math.PI, 0];

export function createJetSki({ stage, player, rig, sound, world, toys }) {
  const ski = toys.ski;
  const panel = document.querySelector('#panel');
  const map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu');
  const phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'jetSkiPrompt'; prompt.className = 'gui'; prompt.type = 'button'; prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span>';
  const status = document.createElement('aside');
  status.id = 'jetSkiStatus'; status.className = 'gui'; status.hidden = true;
  status.innerHTML = '<strong></strong><span></span><small></small>';
  const pad = document.createElement('div');
  pad.id = 'jetSkiPad'; pad.hidden = true;
  pad.innerHTML = '<div class="steer"><button class="wheel" type="button"><span class="wheel-knob" aria-hidden="true"></span></button></div><div class="power"><button class="gui" type="button" data-control="boost"></button><button class="gui" type="button" data-control="brake"></button></div>';
  document.querySelector('#hud').append(prompt, status, pad);
  const label = prompt.querySelector('span');
  const title = status.querySelector('strong');
  const speedText = status.querySelector('span');
  const help = status.querySelector('small');
  const buttons = [...pad.querySelectorAll('[data-control]')];
  const wheel = pad.querySelector('.wheel');
  const knob = wheel.querySelector('.wheel-knob');
  const wheelKeys = new Set();
  let steeringPointer = null;
  const held = new Map();
  const controls = { x: 0, z: 0, boost: false, brake: false };
  const raycaster = new THREE.Raycaster();
  const screen = new THREE.Vector2();
  const localRay = new THREE.Ray();
  const inverse = new THREE.Matrix4();
  const bounds = new THREE.Box3(new THREE.Vector3(-0.7, 0, -1.35), new THREE.Vector3(0.7, 1.2, 1.95));
  const hit = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projection = new THREE.Matrix4();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 3);
  const exitPoint = { x: 0, y: 0, z: 0, water: true };
  const rider = { x: 0, y: 0, z: 0, heading: ski.rotation.y };
  const pose = { speed: 0, fly: -1, ride: true };
  const wake = createWake();
  stage.scene.add(wake);
  let speed = 0, time = 0, clock = 0, shown = false;
  let reservedBy = null, npcActor = null;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const driving = () => player.vehicle === controller;
  const npcDriving = () => npcActor?.vehicle === npcController;
  const occupied = () => driving() || npcDriving();
  const blocked = () => document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up');

  function clearControls() {
    held.clear(); resetWheel(); controls.boost = false; controls.brake = false;
    for (const button of buttons) { button.classList.remove('on'); button.setAttribute('aria-pressed', 'false'); }
  }

  function syncControls() {
    controls.boost = false; controls.brake = false;
    for (const button of buttons) {
      const active = [...held.values()].includes(button);
      button.classList.toggle('on', active); button.setAttribute('aria-pressed', String(active));
      if (!active) continue;
      if (button.dataset.control === 'boost') controls.boost = true;
      if (button.dataset.control === 'brake') controls.brake = true;
    }
  }

  function setWheel(horizontal, vertical, travel) {
    const length = Math.hypot(horizontal, vertical);
    const distance = Math.min(1, length);
    const amount = Math.max(0, (distance - 0.12) / 0.88);
    const directionX = length > 0 ? horizontal / length : 0;
    const directionZ = length > 0 ? vertical / length : 0;
    controls.x = directionX * amount; controls.z = directionZ * amount;
    knob.style.transform = `translate(${directionX * distance * travel}px, ${directionZ * distance * travel}px)`;
    wheel.classList.toggle('on', amount > 0);
  }

  function aimWheel(event) {
    const bounds = wheel.getBoundingClientRect();
    const travel = Math.max(1, (bounds.width - knob.offsetWidth) / 2 - 10);
    setWheel((event.clientX - bounds.left - bounds.width / 2) / travel,
      (event.clientY - bounds.top - bounds.height / 2) / travel, travel);
  }

  function resetWheel() {
    const pointer = steeringPointer;
    steeringPointer = null; wheelKeys.clear();
    setWheel(0, 0, 0);
    if (pointer !== null && wheel.hasPointerCapture(pointer)) wheel.releasePointerCapture(pointer);
  }

  wheel.addEventListener('pointerdown', event => {
    if (steeringPointer !== null || blocked() || !driving()) return;
    event.preventDefault(); wheelKeys.clear();
    steeringPointer = event.pointerId; wheel.setPointerCapture(event.pointerId); aimWheel(event);
  });
  wheel.addEventListener('pointermove', event => {
    if (event.pointerId === steeringPointer) aimWheel(event);
  });
  const releaseWheel = event => { if (event.pointerId === steeringPointer) resetWheel(); };
  wheel.addEventListener('pointerup', releaseWheel);
  wheel.addEventListener('pointercancel', releaseWheel);
  wheel.addEventListener('lostpointercapture', releaseWheel);
  wheel.addEventListener('contextmenu', event => event.preventDefault());
  const wheelKeyboard = event => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    if (event.type === 'keyup') wheelKeys.delete(event.key);
    else if (!blocked() && driving()) wheelKeys.add(event.key);
    if (steeringPointer !== null) return;
    const travel = Math.max(1, (wheel.clientWidth - knob.offsetWidth) / 2 - 10);
    setWheel(Number(wheelKeys.has('ArrowRight')) - Number(wheelKeys.has('ArrowLeft')),
      Number(wheelKeys.has('ArrowDown')) - Number(wheelKeys.has('ArrowUp')), travel);
  };
  wheel.addEventListener('keydown', wheelKeyboard);
  wheel.addEventListener('keyup', wheelKeyboard);
  wheel.addEventListener('blur', () => { if (steeringPointer === null) resetWheel(); });

  for (const button of buttons) {
    button.addEventListener('pointerdown', event => {
      if (blocked() || !driving()) return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      held.set(event.pointerId, button); syncControls();
    });
    const release = event => { held.delete(event.pointerId); syncControls(); };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
    button.addEventListener('keydown', event => {
      if (![' ', 'Enter'].includes(event.key) || blocked() || !driving()) return;
      event.preventDefault(); event.stopPropagation(); held.set(button, button); syncControls();
    });
    button.addEventListener('keyup', event => {
      if (![' ', 'Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation(); held.delete(button); syncControls();
    });
    button.addEventListener('blur', () => { held.delete(button); syncControls(); });
  }
  window.addEventListener('blur', () => { clearControls(); speed = 0; });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearControls(); speed = 0; } });

  function clearWater(x, z, radius = 0) {
    if (x < ISLAND.x0 + 1 + radius || x >= ISLAND.x1 - 1 - radius || z < ISLAND.z0 + 1 + radius || z >= ISLAND.z1 - 1 - radius) return false;
    if (x > 13.2 - radius && x < 16.8 + radius && z > -31.6 - radius && z < -24.6 + radius) return false;
    if (Math.abs(x - toys.duck.position.x) < 1.1 + radius && Math.abs(z - toys.duck.position.z) < 1.5 + radius) return false;
    for (const height of WATER_HEIGHTS) {
      if (world.grid.type(Math.floor(x), Math.floor(POOL.water + height), Math.floor(z))) return false;
    }
    return !world.ground.collides(x, POOL.water + 0.15, z);
  }

  function canFloat(x, z, yaw) {
    const sine = Math.sin(yaw), cosine = Math.cos(yaw);
    for (const length of HULL_LENGTHS) for (const width of HULL_WIDTHS) {
      if (!clearWater(x + sine * length + cosine * width, z + cosine * length - sine * width)) return false;
    }
    return true;
  }

  function syncRider() {
    rider.x = ski.position.x - Math.sin(ski.rotation.y) * 0.05;
    rider.z = ski.position.z - Math.cos(ski.rotation.y) * 0.05;
    rider.y = ski.position.y + 0.89 - 0.675;
    rider.heading = ski.rotation.y;
    pose.speed = Math.min(1, Math.abs(speed) / 18);
  }

  function canBoard() {
    if (reservedBy || npcDriving() || blocked() || player.resting || !['ground', 'swim'].includes(player.mode)) return false;
    if (player.swimming && (!player.swim.surface || player.diving)) return false;
    if (player.mode === 'ground' && Math.abs(player.floorY - POOL.water) > 1) return false;
    if (Math.hypot(player.pos.x - ski.position.x, player.pos.z - ski.position.z) > 3) return false;
    const distance = Math.hypot(player.pos.x - ski.position.x, player.pos.z - ski.position.z);
    for (let step = 1; step < distance / 0.25; step++) {
      const amount = step * 0.25 / distance;
      const x = player.pos.x + (ski.position.x - player.pos.x) * amount;
      const z = player.pos.z + (ski.position.z - player.pos.z) * amount;
      if (world.grid.type(Math.floor(x), 0, Math.floor(z))) return false;
    }
    return canFloat(ski.position.x, ski.position.z, ski.rotation.y);
  }

  function exit() {
    const yaw = ski.rotation.y;
    for (const water of [false, true]) for (const radius of [1.65, 2.15, 2.65]) for (const angle of EXIT_ANGLES) {
      const x = ski.position.x + Math.sin(yaw + angle) * radius;
      const z = ski.position.z + Math.cos(yaw + angle) * radius;
      const support = water ? null : world.ground.canStand(x, z, 0);
      if (water) {
        if (!clearWater(x, z, 0.35)) continue;
        let safe = true;
        for (const side of [-1, 1]) if (!clearWater(x + side * 0.35, z) || !clearWater(x, z + side * 0.35)) safe = false;
        if (!safe) continue;
      } else if (!support || support.y < -0.1 || support.y > 0.6) continue;
      let clear = true;
      for (let step = 1; step <= 10; step++) {
        const sampleX = ski.position.x + (x - ski.position.x) * step / 10;
        const sampleZ = ski.position.z + (z - ski.position.z) * step / 10;
        if (world.grid.type(Math.floor(sampleX), 1, Math.floor(sampleZ))) clear = false;
      }
      if (!clear) continue;
      exitPoint.x = x; exitPoint.z = z; exitPoint.y = support?.y ?? POOL.water; exitPoint.water = water;
      return exitPoint;
    }
    return null;
  }

  function drive(dt, input, autonomous = false) {
    if (!autonomous && blocked()) { clearControls(); speed = 0; syncRider(); return; }
    const throttle = -input.z;
    const brake = input.up || (!autonomous && controls.brake);
    const maximum = input.run || (!autonomous && controls.boost) ? 18 : 12;
    const desired = brake ? 0 : throttle > 0.05 ? throttle * maximum : throttle < -0.05 ? throttle * 4 : 0;
    const acceleration = brake ? 18 : throttle === 0 ? 2.4 : Math.sign(desired) !== Math.sign(speed) && Math.abs(speed) > 0.2 ? 9 : 6;
    speed += Math.max(-acceleration * dt, Math.min(acceleration * dt, desired - speed));
    const steering = -input.x * (0.55 + Math.min(1, Math.abs(speed) / 6) * 1.05) * (speed < -0.1 ? -1 : 1);
    const steps = Math.max(1, Math.ceil(Math.abs(speed) * dt / 0.15));
    for (let step = 0; step < steps; step++) {
      let yaw = ski.rotation.y + steering * dt / steps;
      if (!canFloat(ski.position.x, ski.position.z, yaw)) yaw = ski.rotation.y;
      ski.rotation.y = Math.atan2(Math.sin(yaw), Math.cos(yaw));
      const x = ski.position.x + Math.sin(yaw) * speed * dt / steps;
      const z = ski.position.z + Math.cos(yaw) * speed * dt / steps;
      if (!canFloat(x, z, yaw)) { speed = 0; break; }
      ski.position.x = x; ski.position.z = z;
    }
    if (!reduced.matches) {
      ski.rotation.z += (input.x * Math.min(1, Math.abs(speed) / 12) * 0.16 - ski.rotation.z) * (1 - Math.exp(-dt * 7));
      ski.rotation.x = Math.min(0.07, Math.abs(speed) * 0.005);
    }
    syncRider();
  }

  function stop() {
    speed = 0; clearControls(); wake.visible = false;
  }

  const controller = { rider, pose, update: drive, exit, stop, get speed() { return speed; } };
  const npcController = { rider, pose, update: (dt, input) => drive(dt, input, true), exit,
    stop() { stop(); npcActor = null; reservedBy = null; }, get speed() { return speed; } };
  function reserve(owner) {
    if (!owner || driving() || (reservedBy && reservedBy !== owner)) return false;
    reservedBy = owner;
    return true;
  }
  function release(owner) { if (reservedBy === owner && !npcDriving()) reservedBy = null; }
  function boardNPC(owner, actor) {
    if (reservedBy !== owner || occupied() || !['swim', 'ground'].includes(actor.mode)) return false;
    if (Math.hypot(actor.pos.x - ski.position.x, actor.pos.z - ski.position.z) > 3 || actor.y > 0.8) return false;
    stop(); syncRider(); npcActor = actor;
    if (actor.mountVehicle(npcController)) return true;
    npcActor = null; release(owner);
    return false;
  }
  syncRider();

  function interact() {
    if (blocked()) return false;
    let accepted = false;
    if (driving()) accepted = player.dismountVehicle();
    else if (canBoard()) { stop(); syncRider(); accepted = player.mountVehicle(controller); }
    if (!accepted) return false;
    sound.play('click'); render();
    return true;
  }

  function tap(clientX, clientY, picked) {
    if (blocked()) return false;
    if (driving()) return true;
    if (!canBoard()) return false;
    screen.set(clientX / innerWidth * 2 - 1, 1 - clientY / innerHeight * 2);
    raycaster.setFromCamera(screen, stage.camera);
    ski.updateWorldMatrix(true, false);
    inverse.copy(ski.matrixWorld).invert();
    localRay.copy(raycaster.ray).applyMatrix4(inverse);
    if (!localRay.intersectBox(bounds, hit)) return false;
    hit.applyMatrix4(ski.matrixWorld);
    if (picked.block && picked.block.t < hit.distanceTo(raycaster.ray.origin) - 0.2) return false;
    return interact();
  }

  function render() {
    const mounted = driving();
    const available = !blocked() && (mounted || canBoard());
    prompt.hidden = !available; status.hidden = !mounted || blocked(); pad.hidden = status.hidden;
    if (available !== shown) { document.body.classList.toggle('jet-ski-available', available); shown = available; }
    document.body.classList.toggle('jet-ski-driving', mounted);
    label.textContent = mounted ? t('下艇', 'Dismount') : t('驾驶摩托艇', 'Ride jet ski');
    title.textContent = t('摩托艇', 'Jet ski');
    speedText.textContent = `${Math.round(Math.abs(speed) * 3.6)} km/h`;
    help.textContent = t('W/S 前进倒退 · A/D 转向 · Shift 加速 · 空格刹车', 'W/S throttle · A/D steer · Shift boost · Space brake');
  }
  function localize() {
    wheel.setAttribute('aria-label', t('驾驶轮盘：上推前进，下拉倒退，左右转向', 'Steering joystick: push up to accelerate, pull down to reverse, drag sideways to turn'));
    const labels = { boost: t('加速', 'Boost'), brake: t('刹车', 'Brake') };
    for (const button of buttons) {
      button.setAttribute('aria-label', labels[button.dataset.control]);
      if (['boost', 'brake'].includes(button.dataset.control)) button.textContent = labels[button.dataset.control];
    }
    render();
  }
  prompt.addEventListener('click', interact);
  onLang(localize);

  function update(dt) {
    time += dt; clock += dt;
    projection.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection); sphere.center.copy(ski.position);
    if (occupied() || frustum.intersectsSphere(sphere)) {
      ski.position.y = POOL.water - 0.1 + (reduced.matches ? 0 : Math.sin(time * 1.1 + 1.7) * 0.035);
      if (!occupied()) {
        ski.rotation.z = reduced.matches ? 0 : Math.sin(time * 0.8 + 0.6) * 0.045;
        ski.rotation.x = reduced.matches ? 0 : Math.sin(time * 0.6) * 0.025;
      }
      syncRider();
    }
    wake.visible = occupied() && Math.abs(speed) > 0.6;
    if (wake.visible) {
      wake.position.set(ski.position.x, POOL.water + 0.025, ski.position.z);
      wake.rotation.y = ski.rotation.y + (speed < 0 ? Math.PI : 0);
      wake.scale.z = Math.min(1.6, 0.4 + Math.abs(speed) / 12);
      wake.material.opacity = Math.min(0.5, Math.abs(speed) / 24);
    }
    if (blocked() && (held.size || steeringPointer !== null || wheelKeys.size)) clearControls();
    if (clock >= 0.1) { clock = 0; render(); }
  }

  localize();
  return { update, interact, tap, canBoard, canFloat, ski, controls, reserve, release, boardNPC,
    canSwim(x, z) { return clearWater(x, z, 0.35) && clearWater(x - 0.35, z) && clearWater(x + 0.35, z) && clearWater(x, z - 0.35) && clearWater(x, z + 0.35); },
    get reservedBy() { return reservedBy; }, get occupied() { return occupied(); },
    get driving() { return driving(); }, get speed() { return speed; },
    pad: () => driving() ? controls : null };
}

function createWake() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -0.3, 0, -1.2, -1.25, 0, -4.3, -0.8, 0, -4.1,
    0.3, 0, -1.2, 0.8, 0, -4.1, 1.25, 0, -4.3,
  ], 3));
  const wake = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xf3fcff, transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide }));
  wake.name = 'jet-ski-wake'; wake.visible = false;
  return wake;
}
