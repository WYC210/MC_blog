import * as THREE from 'three';
import { t, onLang } from '@engine/lang.js';
import { BOARDWALK, BAY, POOL } from './layout.js';

const FISH = [
  { name: '海鲈', en: 'Sea bass' },
  { name: '金鲷', en: 'Sea bream' },
  { name: '沙丁鱼', en: 'Sardine' },
];

export function createFishing({ stage, player, avatar, rig, sound }) {
  const hud = document.querySelector('#hud');
  const panel = document.querySelector('#panel');
  const map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu');
  const phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'fishingPrompt';
  prompt.type = 'button';
  prompt.className = 'gui';
  prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21 16 4l3 2-4 6M17 5l3-2v13a3 3 0 0 1-6 0v-2"/></svg><span></span>';
  const status = document.createElement('aside');
  status.id = 'fishingStatus';
  status.className = 'gui';
  status.hidden = true;
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.innerHTML = '<strong></strong><span></span><meter min="0" max="1" value="1" hidden></meter>';
  hud.append(prompt, status);
  const promptText = prompt.querySelector('span');
  const title = status.querySelector('strong');
  const detail = status.querySelector('span');
  const meter = status.querySelector('meter');
  const visuals = buildFishingVisuals(stage.scene);
  const hand = new THREE.Vector3();
  let phase = 'idle', elapsed = 0, waiting = 0, caught = 0, result = '', catchKind = FISH[0];
  let originX = 0, originZ = 0, floatX = 0, floatZ = 0, wasAvailable = false;
  const lastPlank = BOARDWALK.x0 + Math.floor((BOARDWALK.x1 - BOARDWALK.x0) / BOARDWALK.step) * BOARDWALK.step;
  const active = () => phase === 'casting' || phase === 'waiting' || phase === 'bite';
  const available = () => !document.hidden && !rig.introActive && !panel.open && map.hidden && weather.hidden && !phone.classList.contains('up') &&
    player.mode === 'ground' && player.floorY < 0.4 && !player.moving && !player.travelling &&
    player.pos.x >= BOARDWALK.x0 - BOARDWALK.width / 2 && player.pos.x <= lastPlank + BOARDWALK.width / 2 &&
    player.pos.z >= BOARDWALK.z - BOARDWALK.depth / 2 && player.pos.z < BAY.z0 - 0.28;

  function render() {
    promptText.textContent = phase === 'bite' ? t('收竿！', 'Reel in!') : active() ? t('收竿', 'Reel in') : t('钓鱼', 'Fish');
    prompt.setAttribute('aria-label', promptText.textContent);
    status.hidden = phase === 'idle' || !wasAvailable;
    meter.hidden = phase !== 'bite';
    prompt.dataset.phase = phase;
    status.dataset.phase = phase;
    if (phase === 'casting') {
      title.textContent = t('抛竿入海', 'Casting out');
      detail.textContent = t('等浮漂落水，安静等待鱼儿。', 'Let the float settle. Give the fish a moment.');
    } else if (phase === 'waiting') {
      title.textContent = t('等待咬钩…', 'Waiting for a bite…');
      detail.textContent = t('浮漂下沉时按 F 或点击收竿 · 移动可取消', 'Reel in when the float dips · Move to cancel');
    } else if (phase === 'bite') {
      title.textContent = t('鱼儿咬钩了！', 'You have a bite!');
      detail.textContent = t('现在按 F 或点击收竿！', 'Press F or tap Reel in now!');
    } else if (phase === 'result') {
      title.textContent = result === 'caught' ? t(`钓到一条${catchKind.name}！`, `Caught a ${catchKind.en}!`) :
        result === 'missed' ? t('鱼儿溜走了', 'The fish got away') : t('已收竿', 'Line reeled in');
      detail.textContent = result === 'caught' ? t(`本次收获 ${caught} 条 · 可以继续抛竿`, `${caught} caught this visit · Cast again anytime`) :
        t('再试一次，留意浮漂下沉的瞬间。', 'Try again. Watch for the float dipping.');
    }
  }

  function setPhase(next) {
    phase = next;
    elapsed = 0;
    visuals.root.visible = active();
    render();
  }

  function cancel() {
    if (phase === 'idle') return;
    setPhase('idle');
  }

  function interact() {
    if (!available()) return false;
    if (active()) {
      result = phase === 'bite' ? 'caught' : 'early';
      if (result === 'caught') {
        caught++;
        catchKind = FISH[Math.floor(Math.random() * FISH.length)];
        sound.play('drip');
      }
      setPhase('result');
    } else {
      player.cancel();
      originX = player.pos.x;
      originZ = player.pos.z;
      floatX = originX - 0.34;
      floatZ = BAY.z0 + 3.8 + Math.random() * 0.8;
      waiting = 3 + Math.random() * 4;
      setPhase('casting');
      sound.play('click');
    }
    return true;
  }

  prompt.addEventListener('click', interact);
  window.addEventListener('keydown', event => {
    if (event.target.closest('input, textarea, select, [contenteditable]') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape' && active()) {
      cancel();
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (event.key.toLowerCase() === 'f' && available() && !document.body.classList.contains('furniture-available') && !document.body.classList.contains('jet-ski-available')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) interact();
    }
  }, true);
  document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
  onLang(render);
  render();

  function update(dt) {
    const canFish = available();
    if (!canFish || active() && Math.hypot(player.pos.x - originX, player.pos.z - originZ) > 0.15) cancel();
    if (canFish !== wasAvailable) {
      wasAvailable = canFish;
      prompt.hidden = !canFish;
      document.body.classList.toggle('fishing-available', canFish);
      render();
    }
    if (phase === 'idle') return;
    elapsed += dt;
    if (phase === 'result') {
      if (elapsed > 3.2) setPhase('idle');
      return;
    }
    if (phase === 'casting' && elapsed >= 0.7) {
      setPhase('waiting');
      sound.play('drip');
    } else if (phase === 'waiting' && elapsed >= waiting) {
      setPhase('bite');
      sound.play('drip');
    } else if (phase === 'bite' && elapsed >= 1.8) {
      result = 'missed';
      setPhase('result');
      return;
    }
    if (phase === 'bite') meter.value = Math.max(0, 1 - elapsed / 1.8);
    avatar.root.rotation.y = 0;
    applyFishingPose(avatar);
    avatar.root.updateMatrixWorld(true);
    avatar.hand.getWorldPosition(hand);
    visuals.update(hand, floatX, floatZ, phase, elapsed);
  }

  return { update, interact, cancel, get phase() { return phase; }, get caught() { return caught; } };
}

export function applyFishingPose(avatar) {
  avatar.armR.rotation.set(-1.15, 0, 0.08);
  avatar.armL.rotation.set(-0.6, 0, -0.15);
}

function buildFishingVisuals(scene) {
  const root = new THREE.Group();
  root.name = 'beach-fishing';
  root.visible = false;
  scene.add(root);
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshLambertMaterial();
  const matrix = new THREE.Object3D();
  const tint = new THREE.Color();
  function boxes(parts) {
    const mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    parts.forEach(([x, y, z, width, height, depth, angle, color], index) => {
      matrix.position.set(x, y, z);
      matrix.rotation.set(angle, 0, 0);
      matrix.scale.set(width, height, depth);
      matrix.updateMatrix();
      mesh.setMatrixAt(index, matrix.matrix);
      mesh.setColorAt(index, tint.setHex(color));
    });
    mesh.frustumCulled = false;
    root.add(mesh);
    return mesh;
  }
  const angle = -Math.atan2(1.2, 2.35);
  const rod = boxes([
    [0, 0.6, 1.175, 0.035, 0.035, Math.hypot(1.2, 2.35), angle, 0x6f492b],
    [0, 0.07, 0.14, 0.075, 0.075, 0.4, angle, 0x30383c],
    [0.08, 0.12, 0.3, 0.13, 0.16, 0.13, angle, 0xb2b7b5],
  ]);
  const bobber = boxes([
    [0, 0.03, 0, 0.105, 0.1, 0.105, 0, 0xf7eee0],
    [0, 0.1, 0, 0.105, 0.06, 0.105, 0, 0xe45c46],
  ]);
  const points = new Float32Array(25 * 3);
  const lineGeometry = new THREE.BufferGeometry();
  const position = new THREE.BufferAttribute(points, 3);
  position.setUsage(THREE.DynamicDrawUsage);
  lineGeometry.setAttribute('position', position);
  const line = new THREE.Line(lineGeometry, new THREE.LineBasicMaterial({ color: 0xe4e8d8, transparent: true, opacity: 0.8 }));
  line.frustumCulled = false;
  root.add(line);
  const ripple = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.195, 24), new THREE.MeshBasicMaterial({ color: 0xe7f4e4, transparent: true, opacity: 0.4, depthWrite: false }));
  ripple.rotation.x = -Math.PI / 2;
  root.add(ripple);
  const tip = new THREE.Vector3();

  function update(hand, x, z, phase, elapsed) {
    rod.position.copy(hand);
    tip.set(hand.x, hand.y + 1.2, hand.z + 2.35);
    let bobX = x, bobZ = z, bobY = POOL.water + Math.sin(elapsed * 2.5) * 0.025;
    if (phase === 'casting') {
      const along = Math.min(1, elapsed / 0.7);
      bobX = tip.x + (x - tip.x) * along;
      bobZ = tip.z + (z - tip.z) * along;
      bobY = tip.y + (POOL.water - tip.y) * along + Math.sin(along * Math.PI) * 1.1;
    } else if (phase === 'bite') bobY -= 0.1 + Math.abs(Math.sin(elapsed * 13)) * 0.13;
    bobber.position.set(bobX, bobY, bobZ);
    for (let index = 0; index < 25; index++) {
      const along = index / 24, offset = index * 3;
      points[offset] = tip.x + (bobX - tip.x) * along;
      points[offset + 1] = tip.y + (bobY + 0.1 - tip.y) * along - Math.sin(along * Math.PI) * 0.24;
      points[offset + 2] = tip.z + (bobZ - tip.z) * along;
    }
    position.needsUpdate = true;
    ripple.visible = phase !== 'casting';
    ripple.position.set(x, POOL.water + 0.015, z);
    ripple.scale.setScalar(phase === 'bite' ? 1.5 + Math.sin(elapsed * 12) * 0.35 : 1 + Math.sin(elapsed * 2) * 0.2);
  }
  return { root, update };
}
