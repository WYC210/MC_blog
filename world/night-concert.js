import { t, onLang } from '@engine/lang.js';
import { CONCERT, concertPhase } from './night-concert-layout.js';

export function createNightConcert({ stage, world, nav, player, avatar, rig, sound, audio }) {
  const crowd = world.concertCrowd;
  const panel = document.querySelector('#panel');
  const map = document.querySelector('#bigmap');
  const weather = document.querySelector('#weatherMenu');
  const phone = document.querySelector('#phone');
  const prompt = document.createElement('button');
  prompt.id = 'concertPrompt';
  prompt.className = 'gui';
  prompt.type = 'button';
  prompt.hidden = true;
  prompt.innerHTML = '<kbd>F</kbd><span></span><small></small>';
  document.querySelector('#hud').append(prompt);
  const label = prompt.querySelector('span');
  const hint = prompt.querySelector('small');
  let night = false, elapsed = 0, cycleTime = 0, cheering = 0, uiClock = 0, phase = 'gathering';
  let departing = false, distance = Infinity, ready = false, shown = false;

  function blocked() {
    return document.hidden || rig.introActive || panel.open || !map.hidden || !weather.hidden || phone.classList.contains('up');
  }

  function route(guest, destination) {
    const path = nav.findPath(guest.avatar.root.position, destination);
    guest.path = path || [];
    guest.waypoint = 0;
    guest.walking = !!path?.length;
    guest.arrived = false;
    return guest.walking;
  }

  function arrive() {
    cycleTime = 0;
    phase = 'gathering';
    departing = false;
    crowd.group.visible = true;
    for (let index = 0; index < crowd.guests.length; index++) {
      const guest = crowd.guests[index];
      if (!guest.present) {
        guest.avatar.root.position.set(guest.entryX, nav.heightAt(guest.entryX, guest.entryZ), guest.entryZ);
        guest.fade = 0;
        guest.delay = index * 2;
      } else guest.delay = 0;
      guest.present = route(guest, guest);
    }
  }

  function leave() {
    departing = true;
    cheering = 0;
    for (const guest of crowd.guests) {
      guest.delay = 0;
      if (!guest.present) continue;
      if (!route(guest, { x: guest.entryX, z: guest.entryZ })) guest.fade = 0;
    }
    world.fountain.setPerformance(0);
  }

  function walk(guest, dt) {
    const root = guest.avatar.root;
    if (guest.delay > 0) { guest.delay -= dt; return; }
    const destination = guest.path[guest.waypoint];
    if (destination) {
      const deltaX = destination.x - root.position.x, deltaZ = destination.z - root.position.z;
      const away = Math.hypot(deltaX, deltaZ), step = Math.min(away, dt * 1.12);
      if (away > 0.001) {
        root.position.x += deltaX / away * step;
        root.position.z += deltaZ / away * step;
        const turn = Math.atan2(deltaX, deltaZ) - root.rotation.y;
        root.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 8);
        root.position.y = nav.heightAt(root.position.x, root.position.z);
      }
      if (away <= step + 0.01) guest.waypoint++;
    } else {
      guest.walking = false;
      guest.arrived = !departing;
      if (guest.arrived) {
        const turn = guest.yaw - root.rotation.y;
        root.rotation.y += Math.atan2(Math.sin(turn), Math.cos(turn)) * Math.min(1, dt * 5);
      }
    }
    guest.fade = Math.max(0, Math.min(1, guest.fade + dt * (departing && !guest.walking ? -2 : 2)));
    if (departing && !guest.walking && guest.fade === 0) guest.present = false;
  }

  function canInteract() {
    return night && ready && distance < 5.5 && player.mode === 'ground' && Math.abs(player.floorY) < 0.4 && !player.resting && !blocked();
  }

  function render() {
    const available = canInteract();
    prompt.hidden = !available;
    if (shown !== available) {
      shown = available;
      document.body.classList.toggle('concert-available', shown);
    }
    if (!available) return;
    const breakTime = phase === 'mingling' || phase === 'applause';
    label.textContent = cheering > 0 ? t('谢谢你的掌声！', 'Thanks for cheering!') : breakTime ? t('点一首合奏', 'Request a duet') : t('为乐队鼓掌', 'Cheer for the band');
    hint.textContent = !sound.on ? t('喷泉音乐会 · 右上角开启声音', 'Fountain concert · enable sound above') : phase === 'wind' ? t('正在演奏：电吹管', 'Now playing: wind synth') : phase === 'violin' ? t('正在演奏：小提琴', 'Now playing: violin') : phase === 'duet' ? t('电吹管 × 小提琴', 'Wind synth × violin') : t('海风小夜曲 · 休息时间', 'Island serenade · intermission');
    prompt.setAttribute('aria-label', `${label.textContent} · ${hint.textContent}`);
  }

  function interact() {
    distance = Math.hypot(player.pos.x - CONCERT.x, player.pos.z - CONCERT.z);
    if (!canInteract()) return false;
    if (phase === 'mingling' || phase === 'applause') cycleTime = 62;
    cheering = 3;
    avatar.wave();
    audio.unlock();
    sound.play('click');
    render();
    return true;
  }

  function update(dt) {
    if (document.hidden) return;
    const isNight = world.isNight();
    if (night !== isNight) {
      night = isNight;
      if (night) arrive();
      else leave();
    }
    elapsed += dt;
    cheering = Math.max(0, cheering - dt);
    ready = false;
    let visibleGuests = 0;
    if (crowd.group.visible) {
      for (const guest of crowd.guests) {
        if (!guest.present) continue;
        walk(guest, dt);
        if (guest.present) visibleGuests++;
      }
      ready = crowd.guests[0].arrived && crowd.guests[1].arrived;
      if (night && (cycleTime < 13 || ready)) cycleTime = (cycleTime + dt) % CONCERT.cycle;
      phase = concertPhase(cycleTime);
      crowd.draw(dt, stage.camera, elapsed, night ? phase : 'gathering', cheering);
      if (!night && !visibleGuests) { crowd.group.visible = false; departing = false; }
    }
    const finale = night && ready && cycleTime >= 86 && cycleTime < 106;
    world.fountain.setPerformance(finale ? 0.65 + Math.sin(cycleTime * Math.PI * 3.2) * 0.3 : 0);
    distance = Math.hypot(player.pos.x - CONCERT.x, player.pos.z - CONCERT.z);
    audio.update(night && ready, phase, cycleTime, distance, blocked());
    uiClock += dt;
    if (uiClock >= 0.1) { uiClock = 0; render(); }
  }

  prompt.addEventListener('click', interact);
  onLang(render);
  return {
    update, interact, audio,
    get active() { return night; },
    get phase() { return phase; },
    get time() { return cycleTime; },
    get cheering() { return cheering; },
    get target() { return CONCERT.resident; },
  };
}
