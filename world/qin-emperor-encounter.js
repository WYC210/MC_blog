import * as THREE from 'three';
import { t, onLang, langSwitch } from '@engine/lang.js';
import { QIN_MUSTER, QIN_PATROL } from './qin-encounter-actors.js';
import { createImperialSkin } from './qin-emperor-skin.js';
import { createQinArmyFollow, QIN_ARMY_WAIT_SECONDS } from './qin-army-follow.js';
import { qinLandAt } from './qin-island-layout.js';
import { createQinCinematicOcclusion } from './qin-cinematic-occlusion.js';

const LINES = {
  hello: ['旅人，且来一叙。朕正访求长生之道。', 'Traveler, approach. I seek the path to immortality.'],
  steal: ['大胆！竟敢夺朕玉玺！', 'How dare you seize my imperial seal!'],
  summon: ['众将听令，苏醒护驾！', 'Awaken, my warriors! Guard your Emperor!'],
  answer: ['护驾！列阵，保护圣上！', 'To arms! Form ranks! Protect His Majesty!'],
  guard: ['禁卫已列阵，不得近前！', 'The imperial guard stands ready. Keep your distance!'],
  return: ['危机已解，众将归位。', 'The danger has passed. Return to your posts.'],
  again: ['你竟又来了……莫非还想取代朕？', 'You return… Do you dare take my place?'],
  takeover: ['帝冕加身，众将听令！', 'The imperial crown is yours. Warriors, heed my command!'],
  recall: ['碣石旧阵，听朕号令，再度苏醒！', 'Warriors of Jieshi, awaken at my command!'],
  oath: ['参见陛下！列阵随驾，守卫宫门！', 'Hail Your Majesty! We shall follow and guard the palace gates!'],
};
const ease = value => { const amount = Math.max(0, Math.min(1, value)); return amount * amount * (3 - 2 * amount); };
const cinematicPhase = phase => phase === 'reaction' || phase === 'awakening' || phase === 'march' || phase === 'salute';
const arrived = guard => guard.arrived;

export function createQinEmperorEncounter({ world, stage, nav, player, avatar, rig, sound }) {
  const park = world.qinIsland, actors = park.encounterActors, emperor = actors.emperor, guards = actors.guards;
  const skin = createImperialSkin(avatar), army = createQinArmyFollow({ nav, player, guards });
  const occlusion = createQinCinematicOcclusion({ root: park.root, camera: stage.camera });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const panel = document.querySelector('#panel'), map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu'), phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'qinEmperorPrompt'; prompt.type = 'button'; prompt.className = 'gui'; prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span><small></small>';
  document.querySelector('#hud').append(prompt);
  const bubble = document.createElement('div');
  bubble.id = 'qinEmperorBubble'; bubble.className = 'gui'; bubble.hidden = true; bubble.setAttribute('aria-live', 'polite');
  bubble.innerHTML = '<b></b><span></span>'; document.body.append(bubble);
  const status = document.createElement('div');
  status.id = 'qinEncounterStatus'; status.className = 'gui'; status.hidden = true; status.setAttribute('role', 'status');
  document.querySelector('#hud').append(status);
  const dialog = document.createElement('dialog');
  dialog.id = 'qinEncounterScene'; dialog.setAttribute('aria-labelledby', 'qinEncounterTitle');
  dialog.innerHTML = '<header><h2 id="qinEncounterTitle"></h2><button type="button" class="gui encounter-skip" autofocus></button></header><section aria-live="polite" aria-atomic="true"><b></b><p></p><small></small></section>';
  dialog.querySelector('header').prepend(langSwitch()); document.body.append(dialog);
  const skip = dialog.querySelector('.encounter-skip'), caption = dialog.querySelector('section p');
  const speaker = dialog.querySelector('section b'), instruction = dialog.querySelector('section small');
  const projected = new THREE.Vector3(), cameraTarget = new THREE.Vector3(), cameraPosition = new THREE.Vector3(), lookTarget = new THREE.Vector3(), cameraLook = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), viewBounds = new THREE.Sphere(new THREE.Vector3(160, 2, 25), 32);
  const dynamicObstacles = [], safeView = { x: 168.5, z: 24 }, commandView = { x: 160, z: 28.7, look: [160, 24] };
  const savedCamera = { yaw: 0, pitch: 0.3, distance: 8, firstPerson: false };
  let phase = 'patrol', elapsed = 0, uiClock = 0, farTime = 0, greetingTime = 0, greetingCooldown = 0;
  let patrolIndex = 1, hasSeal = false, line = 'hello', shown = false, wasNear = false, ready = false, returningCamera = 0;
  let protectionInstalled = false, rendering = true;
  let sceneKind = 'seal', sceneAwake = false, commandUnlocked = false, takeoverArmed = false, commandStatus = '', countdown = -1;

  const blocked = () => document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up') || !!document.querySelector('#qinCinema[open]');
  function text() {
    prompt.querySelector('span').textContent = hasSeal ? t('取代秦始皇', 'Become the Emperor') : t('夺取玉玺', 'Seize the imperial seal');
    prompt.querySelector('small').textContent = t('秦始皇', 'Qin Shi Huang');
    prompt.setAttribute('aria-label', prompt.querySelector('span').textContent);
    dialog.querySelector('h2').textContent = sceneKind === 'seal' ? t('玉玺风波', 'The Stolen Imperial Seal') : t('帝冕与军令', 'The Crown and the Command');
    skip.textContent = t('跳过演出 · Esc', 'Skip scene · Esc');
    instruction.textContent = t('剧情演出中 · 结束后恢复操作', 'Story scene · Controls return when it ends');
    const words = LINES[line];
    caption.textContent = t(words[0], words[1]);
    speaker.textContent = line === 'answer' || line === 'guard' || line === 'oath' ? t('秦军禁卫', 'Imperial Guard') : t('秦始皇', 'Qin Shi Huang');
    bubble.querySelector('b').textContent = speaker.textContent;
    bubble.querySelector('span').textContent = caption.textContent;
    if (phase === 'command') {
      status.textContent = army.status === 'waiting' ? t(`军队原地候驾 · ${Math.max(0, Math.ceil(QIN_ARMY_WAIT_SECONDS - army.waitTime))} 秒后归位 · 落地回岛可继续随行`, `Guards await you · Returning in ${Math.max(0, Math.ceil(QIN_ARMY_WAIT_SECONDS - army.waitTime))}s · Land on this island to resume`)
        : army.status === 'door-guard' ? t('军队在门外列阵警戒 · 出门后继续随行', 'Guards hold formation outside · They will follow when you leave')
        : army.status === 'returning' ? t('候驾超时 · 军队正在返回碣石行', 'Wait expired · Guards are returning to Jieshi')
        : t('帝冕加身 · 秦军列阵随行 · 入室守门，飞行或离岛时原地候驾', 'Imperial escort · Guards follow outdoors, hold at doors and wait when you fly or leave');
    } else if (phase === 'guarded') status.textContent = t('玉玺已夺取 · 禁卫护驾。退后再靠近，可按 F 取代秦始皇。', 'Imperial seal seized · Guards protect the Emperor. Step away and approach again to take his place with F.');
    else if (phase === 'dormant') status.textContent = t('军队已化作雕像 · 靠近碣石行按 F，在介绍中唤醒军队', 'The army rests as statues · Press F at Jieshi and choose Awaken the army');
    else status.textContent = t('军阵正在归位，稍后可再次互动。', 'The guard is returning. You can interact again shortly.');
    guide();
  }
  function canRecall() {
    return commandUnlocked && phase === 'dormant' && player.mode === 'ground' && !player.flying && !player.swimming
      && qinLandAt(player.pos.x, player.pos.z) && Math.hypot(player.pos.x - 160, player.pos.z - 33) < 26;
  }
  function guide() {
    for (const controls of document.querySelectorAll('[data-qin-army-controls]')) {
      controls.hidden = !commandUnlocked;
      const button = controls.querySelector('[data-qin-awaken]');
      button.disabled = !canRecall(); button.textContent = t('唤醒军队', 'Awaken the army');
      controls.querySelector('p').textContent = phase === 'dormant'
        ? canRecall() ? t('帝冕尚在。可再次唤醒碣石军阵，随你巡行。', 'The crown is yours. Awaken the Jieshi guard to escort you again.')
          : t('请回到碣石行附近，在地面唤醒军队。', 'Return to Jieshi on foot to awaken the army.')
        : t('军队已出列或正在归位，化为雕像后可再次唤醒。', 'The army is already active or returning. Recall it once it rests as statues.');
    }
  }
  function say(key) { if (line === key) return; line = key; text(); }
  function state(next) {
    phase = next; elapsed = 0; farTime = 0;
    dialog.dataset.phase = next; prompt.dataset.phase = next;
    text();
  }
  function route(owner, target) {
    const found = nav.findPath({ x: owner.x, z: owner.z }, target);
    if (!found?.length) return false;
    owner.path = found.map(point => ({ x: point.x, y: 0, z: point.z }));
    owner.path.push({ x: target.x, y: 0, z: target.z });
    owner.waypoint = 0; owner.arrived = false;
    return true;
  }
  function walk(owner, dt, speed) {
    if (owner.arrived) { owner.speed = 0; return; }
    let remaining = speed * dt;
    while (owner.waypoint < owner.path.length) {
      const target = owner.path[owner.waypoint], across = target.x - owner.x, rise = target.y - owner.y, along = target.z - owner.z;
      const distance = Math.hypot(across, rise, along);
      if (distance < 0.001 || distance <= remaining) {
        owner.x = target.x; owner.y = target.y; owner.z = target.z; remaining -= distance; owner.waypoint++;
        continue;
      }
      owner.x += across / distance * remaining; owner.y += rise / distance * remaining; owner.z += along / distance * remaining;
      const difference = Math.atan2(Math.sin(Math.atan2(across, along) - owner.yaw), Math.cos(Math.atan2(across, along) - owner.yaw));
      owner.yaw += difference * Math.min(1, dt * 7); owner.speed = 1; owner.stride += dt * 7;
      return;
    }
    owner.arrived = true; owner.speed = 0;
  }
  function prepareRanks(commanding = false) {
    const routes = [];
    for (let index = 0; index < guards.length; index++) {
      const guard = guards[index], angle = index % 16 * Math.PI / 8, radius = index < 16 ? 3.65 : 4.95;
      const target = commanding ? { x: QIN_MUSTER.x + (index % 8 - 3.5) * 1.3, z: 21 + Math.floor(index / 8) * 1.4 }
        : { x: QIN_MUSTER.x + Math.sin(angle) * radius, z: QIN_MUSTER.z + Math.cos(angle) * radius };
      const awake = guard.life === 1 && guard.y < 0.2;
      const exit = awake ? { x: guard.x, z: guard.z } : { x: guard.originX, z: index < 16 ? 29.8 : 36.2 };
      const path = nav.findPath(exit, target);
      if (!path?.length || !nav.canStand(target.x, target.z)) return false;
      const start = awake ? [{ x: guard.x, y: guard.y, z: guard.z }] : [{ x: guard.originX, y: guard.originY, z: guard.originZ },
        { x: exit.x, y: guard.originY, z: index < 16 ? 30.65 : 35.35 }, { x: exit.x, y: 0, z: exit.z }];
      routes.push({ path: [...start, ...path.map(point => ({ x: point.x, y: 0, z: point.z })), { x: target.x, y: 0, z: target.z }], yaw: commanding ? 0 : angle });
    }
    if (!commanding && !route(emperor, QIN_MUSTER)) return false;
    for (let index = 0; index < guards.length; index++) {
      const guard = guards[index];
      guard.route = routes[index].path;
      guard.path = guard.route; guard.waypoint = 0; guard.arrived = false; guard.delay = index % 8 * 0.16;
      guard.targetYaw = routes[index].yaw;
    }
    if (commanding) { emperor.arrived = true; emperor.speed = 0; }
    return true;
  }
  function march(dt) {
    for (const guard of guards) {
      if (elapsed >= guard.delay) walk(guard, dt, 3.8);
      if (guard.arrived) guard.yaw = guard.targetYaw;
    }
  }
  function protection(on) {
    if (protectionInstalled === on) return;
    protectionInstalled = on; park.protection.active = on;
    if (on) {
      for (let row = 0; row < 16; row++) {
        const start = -park.protection.radius + row * park.protection.radius / 8, end = start + park.protection.radius / 8;
        const near = Math.min(Math.abs(start), Math.abs(end)), half = Math.sqrt(Math.max(0, park.protection.radius ** 2 - near ** 2));
        dynamicObstacles.push({ x0: QIN_MUSTER.x - half, x1: QIN_MUSTER.x + half, z0: QIN_MUSTER.z + start, z1: QIN_MUSTER.z + end, floor: 0 });
      }
      for (const guard of guards) {
        const bounds = { x0: guard.x - 0.38, x1: guard.x + 0.38, z0: guard.z - 0.38, z1: guard.z + 0.38, floor: 0 };
        dynamicObstacles.push(bounds); park.protection.solids.push(bounds);
      }
      world.obstacles.push(...dynamicObstacles);
    } else {
      for (const bounds of dynamicObstacles) {
        const index = world.obstacles.indexOf(bounds);
        if (index >= 0) world.obstacles.splice(index, 1);
      }
      dynamicObstacles.length = 0; park.protection.solids.length = 0;
    }
    nav.rebuild();
  }
  function releaseCamera() {
    occlusion.reset();
    if (!dialog.open) return;
    const camera = stage.camera;
    rig.set(savedCamera.yaw, savedCamera.pitch, savedCamera.distance);
    rig.showcase(camera.position.toArray(), cameraLook.toArray()); rig.skipIntro();
    rig.setFirstPerson(savedCamera.firstPerson, player.heading);
    returningCamera = 1.2;
    dialog.close(); document.body.classList.remove('qin-encounter-cinematic');
    dispatchEvent(new Event('blur'));
  }
  function finish(skipped = false) {
    if (!cinematicPhase(phase)) return;
    for (const guard of guards) {
      const target = guard.route.at(-1);
      guard.x = target.x; guard.y = 0; guard.z = target.z; guard.yaw = guard.targetYaw;
      guard.life = 1; guard.speed = 0; guard.wave = 0; guard.arrived = true; actors.pose(guard);
    }
    emperor.x = QIN_MUSTER.x; emperor.y = 0; emperor.z = QIN_MUSTER.z; emperor.yaw = Math.PI / 2;
    emperor.speed = emperor.wave = 0; emperor.arrived = true; actors.pose(emperor); actors.upload();
    player.cancel();
    if (sceneKind === 'seal') {
      if (skipped || Math.hypot(player.pos.x - QIN_MUSTER.x, player.pos.z - QIN_MUSTER.z) < 6.2) player.teleport(safeView.x, safeView.z);
      takeoverArmed = false; protection(true); state('guarded'); say('guard'); greetingTime = 5;
    } else {
      emperor.visible = false; actors.pose(emperor); actors.upload();
      if (skipped) player.teleport(commandView.x, commandView.z, commandView);
      army.start(); state('command'); say('oath'); greetingTime = 4;
    }
    releaseCamera();
  }
  function startScene(kind) {
    sceneKind = kind;
    sceneAwake = guards[0].life === 1;
    savedCamera.yaw = rig.yaw; savedCamera.distance = rig.distance; savedCamera.firstPerson = rig.firstPerson;
    savedCamera.pitch = Math.asin(THREE.MathUtils.clamp((stage.camera.position.y - player.y - 1.25) / Math.max(1, rig.distance), -0.9, 0.98));
    cameraPosition.copy(stage.camera.position);
    player.cancel(); dispatchEvent(new Event('blur')); rig.skipIntro(); rig.setFirstPerson(false);
    if (kind === 'seal') player.goTo(safeView.x, safeView.z);
    else {
      protection(false); commandUnlocked = true; skin.wear(); emperor.visible = false; actors.pose(emperor); actors.upload();
      player.goTo(commandView.x, commandView.z, commandView);
    }
    hasSeal = true; emperor.seal = 0; greetingTime = 0; ready = false;
    state('reaction'); say(kind === 'seal' ? 'steal' : kind === 'recall' ? 'recall' : 'takeover');
    cameraLook.set(kind === 'seal' ? emperor.x : player.pos.x, 1.5, kind === 'seal' ? emperor.z : player.pos.z);
    document.body.classList.add('qin-encounter-cinematic'); document.body.classList.remove('qin-emperor-available');
    dialog.showModal(); prompt.hidden = true; bubble.hidden = true; sound.play('click');
  }
  function interact() {
    if (cinematicPhase(phase)) return true;
    const guarded = phase === 'guarded' && takeoverArmed;
    if (blocked() || phase !== 'patrol' && !guarded || player.mode !== 'ground' || Math.abs(player.y - emperor.y) > 0.45 || Math.hypot(player.pos.x - emperor.x, player.pos.z - emperor.z) > (guarded ? 9.2 : 2.8)) return false;
    if (guarded) protection(false);
    if (!prepareRanks(hasSeal)) { if (guarded) protection(true); return false; }
    startScene(hasSeal ? 'takeover' : 'seal');
    return true;
  }
  function recall() {
    if (!canRecall() || !prepareRanks(true)) return false;
    if (panel.open) panel.close();
    startScene('recall');
    return true;
  }
  function reset(clearProgress = false) {
    protection(false); army.stop(); state('patrol'); releaseCamera(); actors.restore();
    if (clearProgress) { hasSeal = commandUnlocked = takeoverArmed = false; skin.restore(); }
    emperor.seal = hasSeal ? 0 : 1; emperor.visible = !commandUnlocked; actors.pose(emperor); actors.upload();
    patrolIndex = 1; greetingTime = greetingCooldown = 0; wasNear = false;
    state(commandUnlocked ? 'dormant' : 'patrol'); say(hasSeal ? 'again' : 'hello');
  }
  function beginReturn() {
    protection(false); state('returning'); say('return');
    for (const guard of guards) { guard.path = guard.route.slice().reverse(); guard.waypoint = 0; guard.arrived = false; guard.delay = 0; }
    route(emperor, { x: QIN_PATROL[0][0], z: QIN_PATROL[0][1] });
  }
  function placeCamera(dt) {
    const portrait = stage.camera.aspect < 0.8;
    if (phase === 'reaction') {
      const focusX = sceneKind === 'seal' ? emperor.x : player.pos.x, focusZ = sceneKind === 'seal' ? emperor.z : player.pos.z;
      cameraTarget.set(focusX + (portrait ? 4 : 3), portrait ? 3.4 : 2.6, focusZ + (portrait ? 6.4 : 4.6));
      lookTarget.set(focusX, 1.2, focusZ);
    } else if (sceneKind !== 'seal' && (sceneAwake || phase !== 'awakening')) {
      cameraTarget.set(portrait ? 178 : 172, portrait ? 20 : 11, portrait ? 47 : 39);
      lookTarget.set(160, 1.4, 24);
    } else if (phase === 'awakening') {
      cameraTarget.set(160, portrait ? 17 : 10, portrait ? 7 : 18);
      lookTarget.set(160, 2.5, 33);
    } else {
      const focusX = emperor.arrived ? QIN_MUSTER.x : (emperor.x + QIN_MUSTER.x) / 2;
      const focusZ = emperor.arrived ? QIN_MUSTER.z : (emperor.z + QIN_MUSTER.z) / 2;
      cameraTarget.set(focusX + (portrait ? 18 : 12), portrait ? 15 : 10, focusZ + (portrait ? 13 : 9));
      lookTarget.set(focusX, 1.1, focusZ);
    }
    const blend = reducedMotion.matches ? 1 : 1 - Math.exp(-dt * 3);
    cameraPosition.lerp(cameraTarget, blend); stage.camera.position.copy(cameraPosition); cameraLook.lerp(lookTarget, blend); stage.camera.lookAt(cameraLook);
    stage.camera.updateMatrixWorld(); stage.setClearance(stage.camera.position.distanceTo(player.pos));
    occlusion.update(dt, cameraLook);
  }
  function ui() {
    const unavailable = blocked(), near = Math.hypot(player.pos.x - emperor.x, player.pos.z - emperor.z);
    ready = (phase === 'patrol' || phase === 'guarded' && takeoverArmed) && !unavailable && player.mode === 'ground' && Math.abs(player.y - emperor.y) < 0.45 && near <= (phase === 'guarded' ? 9.2 : 2.8);
    prompt.hidden = !ready;
    if (ready !== shown) { shown = ready; document.body.classList.toggle('qin-emperor-available', ready); }
    status.hidden = unavailable || cinematicPhase(phase) || phase === 'patrol' || phase !== 'command' && Math.hypot(player.pos.x - QIN_MUSTER.x, player.pos.z - QIN_MUSTER.z) > 26;
    if (phase === 'command' && (commandStatus !== army.status || countdown !== Math.ceil(army.waitTime))) {
      commandStatus = army.status; countdown = Math.ceil(army.waitTime); text();
    }
    if (panel.open && panel.dataset.station === 'qin-procession') guide();
    const speakingGuard = phase === 'awakening', anchor = speakingGuard ? guards[8] : emperor;
    bubble.hidden = unavailable || !emperor.visible || (!speakingGuard && greetingTime <= 0) || phase === 'march' || phase === 'reaction';
    if (!bubble.hidden) {
      projected.set(anchor.x, anchor.y + 2.8, anchor.z).project(stage.camera);
      bubble.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 0.95 || Math.abs(projected.y) > 0.95;
      bubble.style.left = `${Math.max(120, Math.min(innerWidth - 120, (projected.x + 1) * innerWidth / 2))}px`;
      bubble.style.top = `${Math.max(95, (1 - projected.y) * innerHeight / 2)}px`;
    }
  }
  prompt.addEventListener('click', interact);
  skip.addEventListener('click', () => finish(true));
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(true); });
  dialog.addEventListener('close', () => { if (!dialog.open && cinematicPhase(phase)) finish(true); });
  panel.addEventListener('click', event => { if (event.target.closest('[data-qin-awaken]')) recall(); });
  new MutationObserver(guide).observe(panel.querySelector('.body'), { childList: true });
  addEventListener('keydown', event => {
    if (!cinematicPhase(phase)) return;
    event.stopImmediatePropagation();
    if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) finish(true); }
    else if (event.key !== 'Tab' && event.key !== 'Enter' && event.key !== ' ') event.preventDefault();
  }, true);
  onLang(text); text();

  function update(dt) {
    if (document.hidden) return;
    dt = Math.min(dt, 0.05); elapsed += dt; uiClock += dt;
    greetingTime = Math.max(0, greetingTime - dt); greetingCooldown = Math.max(0, greetingCooldown - dt);
    const distance = Math.hypot(player.pos.x - QIN_MUSTER.x, player.pos.z - QIN_MUSTER.z);
    if (returningCamera > 0) {
      returningCamera = Math.max(0, returningCamera - dt);
      stage.setClearance(returningCamera > 0 ? stage.camera.position.distanceTo(player.pos) : 0);
    }
    if (phase === 'patrol' && distance < 85 && !blocked()) {
      const near = player.mode === 'ground' && Math.abs(player.y - emperor.y) < 1 && Math.hypot(player.pos.x - emperor.x, player.pos.z - emperor.z) < 6;
      if (near) {
        emperor.speed = 0;
        const direction = Math.atan2(player.pos.x - emperor.x, player.pos.z - emperor.z);
        emperor.yaw += Math.atan2(Math.sin(direction - emperor.yaw), Math.cos(direction - emperor.yaw)) * Math.min(1, dt * 4);
        if (!wasNear && greetingCooldown <= 0) { greetingTime = 5; greetingCooldown = 18; say(hasSeal ? 'again' : 'hello'); }
        emperor.wave = reducedMotion.matches ? 0 : Math.max(0, Math.sin(Math.min(1, (5 - greetingTime) / 1.6) * Math.PI)) * 0.35;
      } else {
        emperor.wave = 0;
        if (emperor.arrived) {
          const target = QIN_PATROL[patrolIndex];
          if (route(emperor, { x: target[0], z: target[1] })) patrolIndex = (patrolIndex + 1) % QIN_PATROL.length;
        }
        walk(emperor, dt, 1.1);
      }
      wasNear = near;
    } else if (phase === 'reaction') {
      emperor.speed = 0; emperor.wave = ease((elapsed - 0.6) / 1.1);
      if (sceneKind !== 'seal' && sceneAwake) march(dt);
      if (elapsed > 2.4) { state('awakening'); say(sceneKind === 'seal' ? 'summon' : 'oath'); }
    } else if (phase === 'awakening') {
      emperor.wave = 1 - ease((elapsed - 1.6) / 1.8);
      for (let index = 0; index < guards.length; index++) guards[index].life = Math.max(guards[index].life, ease((elapsed - index * 0.035) / 2.8));
      if (sceneKind !== 'seal' && sceneAwake) march(dt);
      if (elapsed > 2) say(sceneKind === 'seal' ? 'answer' : 'oath');
      if (elapsed >= 4.4) { for (const guard of guards) guard.life = 1; state('march'); }
    } else if (phase === 'march') {
      emperor.wave = 0; walk(emperor, dt, 3.1);
      march(dt);
      if (emperor.arrived && guards.every(arrived) && !player.travelling) {
        if (sceneKind === 'seal') finish();
        else state('salute');
      }
      else if (elapsed > 30) finish(true);
    } else if (phase === 'salute') {
      if (elapsed >= 2.2) finish();
    } else if (phase === 'guarded') {
      if (distance > 12) takeoverArmed = true;
      farTime = distance > 48 ? farTime + dt : 0;
      if (farTime > 2) beginReturn();
    } else if (phase === 'command') {
      army.update(dt);
      if (army.status === 'returned') state('refreezing');
    } else if (phase === 'returning') {
      walk(emperor, dt, 2.4);
      for (const guard of guards) walk(guard, dt, 3.8);
      if (emperor.arrived && guards.every(arrived)) state('refreezing');
    } else if (phase === 'refreezing') {
      for (const guard of guards) {
        guard.life = 1 - ease(elapsed / 2.5); guard.speed = 0;
        guard.yaw += Math.atan2(Math.sin(guard.originYaw - guard.yaw), Math.cos(guard.originYaw - guard.yaw)) * Math.min(1, dt * 5);
      }
      if (elapsed >= 2.5) reset();
    }
    if (cinematicPhase(phase)) placeCamera(dt);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse));
    if (phase === 'command') {
      let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
      for (const guard of guards) { minX = Math.min(minX, guard.x); maxX = Math.max(maxX, guard.x); minZ = Math.min(minZ, guard.z); maxZ = Math.max(maxZ, guard.z); }
      viewBounds.center.set((minX + maxX) / 2, 1.5, (minZ + maxZ) / 2); viewBounds.radius = Math.hypot(maxX - minX, maxZ - minZ) / 2 + 3;
    } else { viewBounds.center.set(160, 2, 25); viewBounds.radius = 32; }
    rendering = cinematicPhase(phase) || frustum.intersectsSphere(viewBounds);
    if (rendering) {
      actors.pose(emperor);
      if (phase !== 'patrol' && phase !== 'guarded' && phase !== 'dormant') for (const guard of guards) actors.pose(guard);
      actors.upload();
    }
    if (uiClock >= 0.1) { uiClock = 0; ui(); }
  }
  return { update, interact, reset, recall, skip: () => finish(true), get phase() { return phase; }, get active() { return cinematicPhase(phase); },
    get hasSeal() { return hasSeal; }, get commandUnlocked() { return commandUnlocked; }, get ready() { return ready; }, get rendering() { return rendering; }, emperor, guards, army, skin, occlusion };
}
