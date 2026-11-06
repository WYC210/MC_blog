import { Vector3, Quaternion } from 'three';
import { t, onLang } from '@engine/lang.js';
import { LOOKOUT } from './layout.js';

const WOOD = { tex: 'walnut' };
const METAL = { tex: 'black_metal', tint: 0x68716a };
const WARM = { tex: 'paint', tint: 0xffdda4, emissive: 0.7 };

export function buildLookout({ grid, B: batch, obstacles, bakes }) {
  const { x0, x1, z0, z1 } = LOOKOUT.bounds;
  grid.fill(x0, -1, z0, x1, 0, z1, 'deck');
  const box = (positionX, bottom, positionZ, width, height, depth, look, rotation = {}) =>
    batch.box(positionX, bottom, positionZ, width, height, depth, look, { ...rotation, tag: 'lookout' });
  const obstacle = (positionX, positionZ, width, depth) => obstacles.push({
    x0: positionX - width / 2 - 0.05, x1: positionX + width / 2 + 0.05,
    z0: positionZ - depth / 2 - 0.05, z1: positionZ + depth / 2 + 0.05, level: 0, floor: 0,
  });
  for (const positionX of [x0 + 0.2, x1 - 0.2]) {
    for (const positionZ of [z0 + 0.25, z1 - 0.25]) box(positionX, 0, positionZ, 0.12, 0.95, 0.12, WOOD);
    box(positionX, 0.86, (z0 + z1) / 2, 0.1, 0.09, z1 - z0 - 0.4, WOOD);
    obstacle(positionX, (z0 + z1) / 2, 0.16, z1 - z0 - 0.4);
  }
  box((x0 + x1) / 2, 0.86, z0 + 0.25, x1 - x0 - 0.4, 0.09, 0.1, WOOD);
  obstacle((x0 + x1) / 2, z0 + 0.25, x1 - x0 - 0.4, 0.16);
  for (const positionX of [x0 + 0.55, x1 - 0.55]) {
    box(positionX, 0, z0 + 0.6, 0.16, 1.45, 0.16, METAL);
    box(positionX, 1.45, z0 + 0.6, 0.24, 0.28, 0.24, WARM);
    box(positionX, 1.73, z0 + 0.6, 0.32, 0.06, 0.32, METAL);
    obstacle(positionX, z0 + 0.6, 0.32, 0.32);
    bakes.push({ id: `lookout-lantern-${positionX}`, position: [positionX, 1.6, z0 + 0.6], power: 0.9, radius: 6, direction: null });
  }
  const telescopeX = 1.75, telescopeZ = -22.8;
  box(telescopeX, 0.02, telescopeZ, 0.45, 0.06, 0.45, METAL);
  box(telescopeX, 0.08, telescopeZ, 0.09, 1.02, 0.09, METAL);
  box(telescopeX, 1.1, telescopeZ, 0.2, 0.18, 0.18, METAL);
  batch.at(telescopeX, 1.25, telescopeZ, 0, () => {
    box(0, 0, 0, 0.2, 0.2, 0.68, WOOD, { rx: -0.2 });
    box(0, 0.06, 0.33, 0.25, 0.25, 0.09, METAL);
    box(0, 0.085, 0.38, 0.17, 0.17, 0.015, { tex: 'paint', tint: 0x779aab });
    box(0, 0.01, -0.4, 0.12, 0.12, 0.15, METAL);
  });
  obstacle(telescopeX, telescopeZ, 0.5, 1.05);
  for (const positionZ of [-20.3, -19.1]) box(0.5, 0.02, positionZ, 0.7, 0.05, 0.58, { tex: 'pavers', tint: 0xa8a090 });
}

export function createLookout({ stage, player, rig }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const panel = document.querySelector('#panel');
  const map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu');
  const phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'lookoutPrompt';
  prompt.className = 'gui';
  prompt.type = 'button';
  prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span><small></small>';
  document.querySelector('#hud').append(prompt);
  const label = prompt.querySelector('span'), hint = prompt.querySelector('small');
  const canvas = stage.renderer.domElement, camera = stage.camera;
  const focus = new Vector3(...LOOKOUT.focus), offset = new Vector3(), destination = new Vector3();
  const fromPosition = new Vector3(), fromRotation = new Quaternion(), toRotation = new Quaternion();
  const returnPosition = [0, 0, 0], returnFocus = [0, 0, 0];
  const pointers = new Map();
  const movementKeys = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ', 'control', 'shift', 'v', 'e']);
  let active = false, shown = false, entryTime = 0, returnTime = 0, wasFirstPerson = false;
  let yaw = 0, pitch = 0, radius = 0, yawGoal = 0, pitchGoal = 0, radiusGoal = 0;
  let baseRadius = 0, width = 0, height = 0;

  const blocked = () => document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up');
  const distance = () => Math.hypot(player.pos.x - LOOKOUT.at[0], player.pos.z - LOOKOUT.at[1]);
  const onGround = () => player.mode === 'ground' && Math.abs(player.floorY - LOOKOUT.floor) < 0.2;
  const ready = () => onGround() && distance() <= 1.4 && !player.moving && !player.travelling;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function render() {
    label.textContent = active ? t('退出自由视角', 'Exit free view') : t('查看全岛', 'View island');
    hint.textContent = active
      ? t('拖动旋转 · 滚轮/双指缩放 · F / Esc 退出', 'Drag to orbit · Scroll/pinch to zoom · F / Esc to exit')
      : t('北岸观景点 · 按 F 进入', 'North Lookout · Press F to enter');
  }

  function fitView(initial = false) {
    width = innerWidth; height = innerHeight;
    offset.fromArray(camera.aspect < 0.8 ? LOOKOUT.portrait : LOOKOUT.camera).sub(focus);
    const nextRadius = offset.length();
    if (initial) {
      yaw = yawGoal = Math.atan2(offset.x, offset.z);
      pitch = pitchGoal = Math.asin(offset.y / nextRadius);
      radius = radiusGoal = nextRadius;
    } else radiusGoal *= nextRadius / baseRadius;
    baseRadius = nextRadius;
  }

  function placeCamera(dt) {
    const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 12);
    yaw += (yawGoal - yaw) * blend;
    pitch += (pitchGoal - pitch) * blend;
    radius += (radiusGoal - radius) * blend;
    const horizontal = Math.cos(pitch) * radius;
    destination.set(focus.x + Math.sin(yaw) * horizontal, focus.y + Math.sin(pitch) * radius, focus.z + Math.cos(yaw) * horizontal);
    camera.position.copy(destination);
    camera.lookAt(focus);
    if (entryTime < 0.9) {
      entryTime = reducedMotion.matches ? 0.9 : Math.min(0.9, entryTime + dt);
      const progress = entryTime / 0.9, eased = progress * progress * (3 - 2 * progress);
      toRotation.copy(camera.quaternion);
      camera.position.lerpVectors(fromPosition, destination, eased);
      camera.quaternion.slerpQuaternions(fromRotation, toRotation, eased);
    }
    camera.updateMatrixWorld();
  }

  function clearPointers() {
    for (const pointerId of pointers.keys()) if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
    pointers.clear();
  }

  function start() {
    if (blocked() || !ready()) return false;
    if (returnTime === 0) wasFirstPerson = rig.firstPerson;
    fromPosition.copy(camera.position); fromRotation.copy(camera.quaternion);
    active = true; entryTime = 0; returnTime = 0;
    player.cancel();
    rig.skipIntro();
    rig.setFirstPerson(false);
    fitView(true);
    if (reducedMotion.matches) placeCamera(0);
    document.body.classList.add('lookout-viewing');
    render();
    return true;
  }

  function stop() {
    if (!active) return false;
    active = false; returnTime = 1.1;
    clearPointers();
    camera.position.toArray(returnPosition);
    camera.getWorldDirection(offset).multiplyScalar(radius).add(camera.position).toArray(returnFocus);
    rig.showcase(returnPosition, returnFocus);
    rig.skipIntro();
    if (reducedMotion.matches) {
      rig.update(1.1, player); returnTime = 0;
      rig.setFirstPerson(wasFirstPerson, player.heading);
      rig.update(0, player);
      stage.setClearance(0);
    }
    document.body.classList.remove('lookout-viewing');
    render();
    return true;
  }

  function interact() {
    return active ? stop() : start();
  }

  prompt.addEventListener('click', interact);
  const capture = event => { if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation(); };
  addEventListener('keydown', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target.isContentEditable || event.metaKey || event.altKey || event.ctrlKey) return;
    const key = event.key.toLowerCase();
    if (key === 'f' && (active || !blocked() && ready())) {
      capture(event);
      if (!event.repeat) interact();
    } else if (active && key === 'escape') {
      capture(event);
      if (!event.repeat) stop();
    } else if (active && movementKeys.has(key)) capture(event);
  }, true);

  function pinchDistance() {
    let first = null;
    for (const pointer of pointers.values()) {
      if (first) return Math.hypot(first.x - pointer.x, first.y - pointer.y);
      first = pointer;
    }
    return 0;
  }

  function zoom(factor) {
    radiusGoal = clamp(radiusGoal * factor, Math.max(85, baseRadius * 0.65), baseRadius * 1.6);
  }

  canvas.addEventListener('pointerdown', event => {
    if (!active || blocked()) return;
    capture(event);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (!active) return;
    capture(event);
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    const previousDistance = pinchDistance(), deltaX = event.clientX - pointer.x, deltaY = event.clientY - pointer.y;
    pointer.x = event.clientX; pointer.y = event.clientY;
    if (pointers.size > 1) {
      const nextDistance = pinchDistance();
      if (previousDistance > 1 && nextDistance > 1) zoom(previousDistance / nextDistance);
    } else {
      yawGoal -= deltaX * 0.0052;
      pitchGoal = clamp(pitchGoal + deltaY * 0.0042, 0.12, 1.25);
    }
  }, true);
  const release = event => {
    if (!active) return;
    capture(event);
    pointers.delete(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  };
  canvas.addEventListener('pointerup', release, true);
  canvas.addEventListener('pointercancel', release, true);
  canvas.addEventListener('lostpointercapture', event => pointers.delete(event.pointerId));
  canvas.addEventListener('wheel', event => {
    if (!active || blocked()) return;
    capture(event);
    const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    zoom(Math.exp(clamp(event.deltaY * units * 0.001, -0.7, 0.7)));
  }, { capture: true, passive: false });
  canvas.addEventListener('contextmenu', event => { if (active) capture(event); }, true);
  addEventListener('blur', clearPointers);
  onLang(render);
  render();

  function update(dt) {
    if (active) {
      player.cancel();
      if (width !== innerWidth || height !== innerHeight) fitView();
      placeCamera(dt);
    }
    if (active || returnTime > 0) {
      stage.setClearance(camera.position.distanceTo(player.pos));
      returnTime = Math.max(0, returnTime - dt);
      if (!active && returnTime === 0) {
        rig.setFirstPerson(wasFirstPerson, player.heading);
        stage.setClearance(0);
      }
    }
    const visible = !blocked() && (active || ready());
    if (visible !== shown) {
      shown = visible;
      prompt.hidden = !visible;
      document.body.classList.toggle('lookout-available', visible);
    }
  }

  return {
    update, interact,
    tap: () => active,
    get active() { return active; },
  };
}
