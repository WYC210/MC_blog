import * as THREE from 'three';
import { t, nameOf, onLang } from '@engine/lang.js';
import { REST_POINTS } from './rest-points.js';

export function createFurnitureInteraction({ stage, player, rig, sound, world }) {
  const panel = document.querySelector('#panel');
  const map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu');
  const phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'furniturePrompt';
  prompt.className = 'gui';
  prompt.type = 'button';
  prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span><small></small>';
  document.querySelector('#hud').append(prompt);
  const label = prompt.querySelector('span');
  const hint = prompt.querySelector('small');
  const raycaster = new THREE.Raycaster();
  const screen = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const origin = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const boxes = REST_POINTS.map(point => ({ point, box: new THREE.Box3(
    new THREE.Vector3(point.x - 0.48, point.y - 0.05, point.z - (point.kind === 'lie' ? 1 : 0.55)),
    new THREE.Vector3(point.x + 0.48, point.y + (point.kind === 'sit' ? 0.55 : 0.8), point.z + (point.kind === 'lie' ? 1 : 0.55)),
  ) }));
  let target = null, clock = 0, wasShown = false;
  const solidWall = (type, group) => type.kind !== 'glass' && !world.hidden.has(group);

  const blocked = () => document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up');

  function canReach(point) {
    if (point.occupiedBy) return false;
    if (player.mode !== 'ground' || Math.abs(player.floorY - point.floor) > 0.4 || Math.hypot(player.pos.x - point.x, player.pos.z - point.z) > 2.25) return false;
    origin.set(player.pos.x, player.floorY + 1.1, player.pos.z);
    direction.set(point.x - origin.x, point.y + 0.35 - origin.y, point.z - origin.z);
    const distance = direction.length();
    direction.normalize();
    const wall = world.grid.raycast(origin, direction, distance, solidWall);
    return !wall || wall.t >= distance - 0.2;
  }

  function nearest() {
    let best = null, distance = 2.25;
    for (const point of REST_POINTS) {
      const away = Math.hypot(player.pos.x - point.x, player.pos.z - point.z);
      if (away < distance && canReach(point)) { best = point; distance = away; }
    }
    return best;
  }

  function render() {
    const shown = !!target && !blocked();
    prompt.hidden = !shown;
    if (shown !== wasShown) {
      document.body.classList.toggle('furniture-available', shown);
      wasShown = shown;
    }
    if (!shown) return;
    const resting = !!player.resting;
    label.textContent = resting ? t('起身', 'Stand up') : target.kind === 'sit' ? t('坐下', 'Sit down') : t('躺下', 'Lie down');
    hint.textContent = nameOf(target);
    prompt.setAttribute('aria-label', `${label.textContent} · ${hint.textContent}`);
    prompt.dataset.furniture = target.id;
    prompt.dataset.state = resting ? 'resting' : 'available';
  }

  function use(point) {
    if (blocked()) return false;
    const accepted = player.resting ? player.standUp() : point && canReach(point) && player.restAt(point);
    if (!accepted) return false;
    sound.play('click');
    target = player.resting || nearest();
    render();
    return true;
  }

  function interact() {
    if (blocked()) return false;
    return use(player.resting || nearest());
  }

  function tap(clientX, clientY, picked) {
    if (blocked()) return false;
    screen.set(clientX / innerWidth * 2 - 1, 1 - clientY / innerHeight * 2);
    raycaster.setFromCamera(screen, stage.camera);
    let best = null, distance = Infinity;
    for (const candidate of boxes) {
      if (!raycaster.ray.intersectBox(candidate.box, hit)) continue;
      const away = hit.distanceTo(raycaster.ray.origin);
      if ((picked.block && picked.block.t < away - 0.2) || away >= distance) continue;
      if (player.resting?.id !== candidate.point.id && !canReach(candidate.point)) continue;
      best = candidate.point; distance = away;
    }
    return best ? use(best) : false;
  }

  prompt.addEventListener('click', () => use(player.resting || target));
  onLang(render);

  function update(dt) {
    clock += dt;
    if (clock < 0.1 && !player.resting && !blocked()) return;
    clock = 0;
    target = blocked() ? null : player.resting || nearest();
    render();
  }

  return { update, interact, tap, get target() { return target; }, points: REST_POINTS };
}
