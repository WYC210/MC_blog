import * as THREE from 'three';
import { t, onLang } from '@engine/lang.js';
import { COASTER_STATIONS, COASTER_PLATFORM } from './coaster-route.js';
import { createCoasterService } from './coaster-service.js';

export function createCoaster({ stage, player, rig, sound, world }) {
  const panel = document.querySelector('#panel'), map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu'), phone = document.querySelector('#phone');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const prompt = document.createElement('button');
  prompt.id = 'coasterPrompt'; prompt.type = 'button'; prompt.className = 'gui'; prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span>';
  const status = document.createElement('aside');
  status.id = 'coasterStatus'; status.className = 'gui'; status.hidden = true;
  status.innerHTML = `<strong></strong><small></small><progress max='1' value='0'></progress>`;
  const picker = document.createElement('div'); picker.id = 'coasterRoutes'; picker.className = 'gui'; picker.hidden = true;
  picker.setAttribute('role', 'dialog');
  picker.innerHTML = `<strong></strong><small></small><div class='coaster-options'><button type='button' data-route='loop'></button><button type='button' data-route='qin'></button></div><div class='coaster-actions'><button type='button' data-action='depart'></button><button type='button' data-action='cancel'></button></div>`;
  const center = document.createElement('button');
  center.id = 'coasterCenter'; center.type = 'button'; center.className = 'gui'; center.hidden = true;
  document.querySelector('#hud').append(prompt, status, picker, center);
  const label = prompt.querySelector('span'), title = status.querySelector('strong'), hint = status.querySelector('small');
  const progress = status.querySelector('progress'), choices = [...picker.querySelectorAll('[data-route]')];
  const boardTitle = picker.querySelector('strong'), boardHint = picker.querySelector('small');
  const confirm = picker.querySelector('[data-action=depart]'), cancel = picker.querySelector('[data-action=cancel]');
  const camera = stage.camera, canvas = stage.renderer.domElement;
  const blocked = () => document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up');
  const active = createCoasterService(world.coaster, { player, camera, sound, reduced, blocked });
  let clock = 0, rideFirstPerson = false;
  let viewLocked = false, savedFirstPerson = false, savedYaw = 0, savedPitch = 0, savedDistance = 0, savedLookPitch = 0;
  let lookPointer = null, lookColumn = 0, lookLeft = false, lookRight = false;
  const savedLook = new THREE.Vector3(), screen = new THREE.Vector2(), raycaster = new THREE.Raycaster();
  const mounted = () => active.riding;
  function lockView() {
    savedFirstPerson = rig.firstPerson; savedYaw = rig.yaw; savedDistance = rig.distance;
    camera.getWorldDirection(savedLook); savedLookPitch = Math.asin(THREE.MathUtils.clamp(savedLook.y, -1, 1));
    const vertical = camera.position.y - player.y - 1.25;
    savedPitch = THREE.MathUtils.clamp(Math.atan2(vertical, Math.hypot(camera.position.x - player.pos.x, camera.position.z - player.pos.z)), 0.06, 1.38);
    viewLocked = true;
    rideFirstPerson = savedFirstPerson;
    active.view.reset(active.eyeDistance, active.direction);
    active.view.setFirstPerson(rideFirstPerson, true);
    rig.setFirstPerson(rideFirstPerson, active.controller.rider.heading);
    dispatchEvent(new Event('blur'));
  }
  function restoreView() {
    if (!viewLocked) return;
    clearLookInput();
    viewLocked = false;
    rig.setFirstPerson(false); rig.set(savedYaw, savedPitch, savedDistance); rig.recenter(player);
    if (savedFirstPerson) {
      rig.setFirstPerson(true); rig.orbit(0, (-0.12 - savedLookPitch) / 0.0036); rig.update(0, player);
    }
  }
  function updateView(dt = 0) {
    if (!mounted()) { restoreView(); return; }
    const paused = blocked();
    if (paused) clearLookInput();
    else active.view.turn((Number(lookLeft) - Number(lookRight)) * Math.min(dt, 0.05) * 1.6);
    rig.setFirstPerson(rideFirstPerson, active.controller.rider.heading);
    active.view.update(active.eyeDistance, active.direction, active.speed, paused ? 0 : dt, reduced.matches);
  }
  function blockCameraInput(event) {
    if (!mounted()) return;
    event.preventDefault(); event.stopImmediatePropagation();
  }
  function clearLookInput() {
    const pointer = lookPointer;
    lookPointer = null; lookLeft = false; lookRight = false;
    if (pointer !== null && canvas.hasPointerCapture(pointer)) canvas.releasePointerCapture(pointer);
  }
  function lookInput(event) {
    if (!mounted()) return;
    blockCameraInput(event);
    if (blocked()) { clearLookInput(); return; }
    if (event.type === 'pointerdown' && lookPointer === null && event.isPrimary) {
      lookPointer = event.pointerId; lookColumn = event.clientX;
      canvas.setPointerCapture(lookPointer);
    } else if (event.type === 'pointermove' && event.pointerId === lookPointer) {
      active.view.turn(-(event.clientX - lookColumn) * 0.005); lookColumn = event.clientX;
    } else if (event.type !== 'pointermove' && event.pointerId === lookPointer) {
      clearLookInput();
    }
  }
  for (const event of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(event, lookInput, { capture: true, passive: false });
  canvas.addEventListener('wheel', event => {
    if (!mounted()) return;
    blockCameraInput(event);
    if (!blocked()) active.view.zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY, -200, 200) * 0.0015));
  }, { capture: true, passive: false });
  function toggleView(event) {
    if (!mounted()) return;
    blockCameraInput(event);
    if (blocked() || event.repeat) return;
    rideFirstPerson = !rideFirstPerson;
    active.view.setFirstPerson(rideFirstPerson);
    rig.setFirstPerson(rideFirstPerson, active.controller.rider.heading);
    sound.play('click'); updateView(); render();
  }
  document.querySelector('#viewButton')?.addEventListener('click', toggleView, true);
  addEventListener('keydown', event => {
    if (mounted() && !blocked() && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
      if (event.code === 'ArrowLeft') lookLeft = true; else lookRight = true;
      blockCameraInput(event);
    }
    if (event.code === 'KeyV' || event.key.toLowerCase() === 'v') toggleView(event);
    if (mounted() && active.state === 'boarding' && event.code === 'Escape') {
      blockCameraInput(event); cancelBoarding();
    }
  }, true);
  addEventListener('keyup', event => {
    if (event.code === 'ArrowLeft') lookLeft = false;
    if (event.code === 'ArrowRight') lookRight = false;
    if (event.code === 'ArrowLeft' || event.code === 'ArrowRight') blockCameraInput(event);
  }, true);
  addEventListener('blur', clearLookInput);
  function nearby() {
    if (player.mode !== 'ground' || player.resting || player.travelling) return -1;
    if (Math.abs(player.floorY - COASTER_PLATFORM.y) < 0.35 && player.pos.x > COASTER_PLATFORM.x0 + 0.4 && player.pos.x < COASTER_PLATFORM.x1 - 0.4
      && player.pos.z > COASTER_PLATFORM.z0 + 0.4 && player.pos.z < COASTER_PLATFORM.z1) return 0;
    const station = COASTER_STATIONS[1];
    return Math.abs(player.floorY - station.y) < 0.35 && Math.hypot(player.pos.x - station.x, player.pos.z - station.z) < 3 ? 1 : -1;
  }
  function choose(id) {
    if (blocked() || !mounted() || active.state !== 'boarding') return false;
    const accepted = active.choose(id);
    if (accepted) { sound.play('click'); updateView(); render(); }
    return accepted;
  }
  function cancelBoarding() {
    if (blocked() || !mounted() || active.state !== 'boarding') return false;
    const exited = player.dismountVehicle(); restoreView(); render(); prompt.focus(); return exited;
  }
  function interact() {
    if (blocked()) return false;
    if (mounted()) {
      if (active.state === 'boarding') {
        active.depart(1 - active.terminal, true);
        active.view.reset(active.eyeDistance, active.direction); updateView();
        canvas.focus();
      } else if (active.state === 'idle' && player.dismountVehicle()) restoreView();
      render(); return true;
    }
    const station = nearby();
    if (station < 0) return false;
    if (active.state !== 'idle') return true;
    if (station !== active.station) active.call(station);
    else {
      if (!player.mountVehicle(active.controller)) return false;
      active.board();
      if (station === 1) active.depart(0, true);
      lockView(); rig.skipIntro(); updateView();
    }
    sound.play('click'); render();
    if (active.state === 'boarding') choices.find(choice => choice.dataset.route === active.id)?.focus();
    return true;
  }
  function render() {
    const riding = mounted(), station = nearby(), available = !blocked() && (riding || station >= 0);
    const boarding = riding && active.state === 'boarding';
    prompt.hidden = !available || boarding; status.hidden = !available || boarding; picker.hidden = !available || !boarding;
    center.hidden = !available || !riding || boarding;
    document.body.classList.toggle('coaster-available', available);
    document.body.classList.toggle('coaster-riding', riding);
    if (!available) return;
    const moving = active.state !== 'idle' && !boarding, loop = active.id === 'loop';
    const target = COASTER_STATIONS[riding || moving ? active.destination : 1 - station];
    const name = t(target.name, target.en);
    label.textContent = riding ? moving ? t('行驶中', 'Riding') : t('到站下车', 'Dismount')
      : moving ? t('列车驶来中', 'Train on its way') : station !== active.station ? t('呼叫三节列车', 'Call train')
        : station === 0 ? t('上车选择线路', 'Board and choose route') : t('乘车返回主岛', 'Ride to Home Island');
    prompt.disabled = moving;
    title.textContent = active.state === 'switching' ? t('道岔切换中 · 锁定后发车', 'Switching tracks · Waiting for lock')
      : active.state === 'departing' ? t('安全压杆已锁定，即将发车', 'Restraint locked · Departing')
      : riding && !moving ? t(`已到达 · ${name}`, `Arrived · ${name}`)
      : riding && loop ? active.section ? t(`缓速观景 · ${active.section.name}`, `Scenic cruise · ${active.section.en}`)
        : t('刺激路段 · 沿海爬升与俯冲', 'Thrill section · Coastal climbs and drops')
      : loop ? t('环岛过山车', 'Island loop') : t(`秦岛专线 → ${name}`, `Qin line → ${name}`);
    hint.textContent = riding ? t(`${rideFirstPerson ? '第一' : '第三'}人称 · 拖动环顾 · V 切换 · F 下车`, `${rideFirstPerson ? 'First' : 'Third'} person · Drag to look · V to switch · F to exit`)
      : loop ? t('高空俯冲 + 四面海岸缓速观景 · 环岛回站', 'Thrilling drops + four coastal panoramas · Round trip')
      : t('主岛北岸 ↔ 秦岛码头 · 三节车厢', 'North Shore ↔ Qin Island · Three cars');
    picker.setAttribute('aria-label', t('上车选线', 'Choose your ride'));
    boardTitle.textContent = t('已上车 · 选择目的地', 'All aboard · Choose your destination');
    boardHint.textContent = t('同一列三节车厢 · 仅显示所选轨道 · 道岔锁定后发车', 'One three-car train · Selected track only · Switch locks before departure');
    for (const choice of choices) {
      const isLoop = choice.dataset.route === 'loop';
      choice.textContent = isLoop ? t('环岛 · 刺激 + 观景', 'Island loop · Thrills + views') : t('去秦岛 · 跨海往返', 'Qin Island · Sea crossing');
      choice.setAttribute('aria-pressed', String(choice.dataset.route === active.id));
    }
    progress.setAttribute('aria-label', t('乘车进度', 'Ride progress'));
    confirm.textContent = t('确认发车 · F', 'Depart · F'); cancel.textContent = t('取消下车', 'Cancel and exit');
    center.textContent = t('回正视角', 'Look forward');
    progress.hidden = !moving; progress.value = active.progress;
  }
  function tap(column, row, picked) {
    if (mounted()) return true;
    const station = nearby();
    if (blocked() || station < 0) return false;
    screen.set(column / innerWidth * 2 - 1, 1 - row / innerHeight * 2);
    raycaster.setFromCamera(screen, camera);
    if (active.station !== station || !active.group.visible) return false;
    const hit = raycaster.intersectObject(active.group, true)[0];
    if (!hit || picked?.block && picked.block.t < hit.distance - 0.2) return false;
    return interact();
  }
  for (const choice of choices) choice.addEventListener('click', () => choose(choice.dataset.route));
  confirm.addEventListener('click', interact); cancel.addEventListener('click', cancelBoarding);
  center.addEventListener('click', () => { if (mounted() && !blocked()) { clearLookInput(); active.view.center(); } });
  prompt.addEventListener('click', interact); onLang(render);
  return { service: active, lines: world.coaster.lines, turnout: world.coaster.turnout, interact, tap, choose, cancelBoarding,
    get routeId() { return active.id; }, get car() { return active.car; }, get cars() { return active.cars; }, get route() { return active.route; },
    get riding() { return mounted(); }, get state() { return active.state; }, get distance() { return active.distance; },
    get speed() { return active.speed; }, get station() { return active.station; },
    get lookYaw() { return active.view.yaw; },
    get section() { return active.section; },
    update(dt) {
      if (!blocked()) world.coaster.turnout.update(dt);
      if (!active.riding) active.drive(dt);
      updateView(dt);
      const visible = active.riding || camera.position.distanceToSquared(active.cars[1].position) < 110 ** 2;
      const appeared = visible && !active.group.visible;
      active.group.visible = visible;
      if (appeared) active.sync();
      active.track.update(camera, active.riding);
      world.coaster.sign.visible = camera.position.distanceToSquared(world.coaster.sign.position) < 90 ** 2;
      clock += dt;
      if (clock >= 0.1 || dt === 0) { clock = 0; render(); }
    } };
}
