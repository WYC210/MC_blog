import * as THREE from 'three';
import { lang, onLang } from '@engine/lang.js';

export const QIN_QUEST_ACT_SECONDS = 12;
export const QIN_QUEST_ACTS = [
  { id: 'procession', zh: '一 · 秦军东巡', en: 'I · Eastern March',
    captionZh: '秦始皇率军东巡，\n旌旗引路，奔赴海岸。', captionEn: 'Qin Shi Huang\nleads his men east.' },
  { id: 'arrival', zh: '二 · 始皇抵海', en: 'II · At the Coast',
    captionZh: '始皇车驾抵达海岸，\n登岸远望苍茫大海。', captionEn: 'The Emperor arrives\nand looks out to sea.' },
  { id: 'quest', zh: '三 · 临海求仙', en: 'III · Seeking Immortality',
    captionZh: '始皇问询仙山，\n命人备船出海寻访。', captionEn: 'He seeks immortality\nand orders a voyage.' },
  { id: 'voyage', zh: '四 · 遣船远航', en: 'IV · Setting Sail',
    captionZh: '船队驶向远海，\n始皇与军士留岸送行。', captionEn: 'The fleet sails out.\nHe watches from shore.' },
];
const CAPTION_LINES = QIN_QUEST_ACTS.map(act => ({ zh: act.captionZh.split('\n'), en: act.captionEn.split('\n') }));

const GALLERY_TITLES = [
  { zh: '旌旗东巡', en: 'The Procession' }, { zh: '车驾抵海', en: 'At the Coast' },
  { zh: '始皇问仙', en: 'The Quest' }, { zh: '方士请命', en: 'The Commission' },
  { zh: '楼船远航', en: 'Setting Sail' },
];

export function createQinQuestStory() {
  const canvas = document.createElement('canvas'), frame = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256; frame.width = 512; frame.height = 128;
  const atlas = canvas.getContext('2d');
  let paint = frame.getContext('2d');
  atlas.imageSmoothingEnabled = false; paint.imageSmoothingEnabled = false;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const state = { phase: 0, act: 'procession', progress: 0, time: 0, language: lang,
    title: '', caption: '', duration: QIN_QUEST_ACT_SECONDS * QIN_QUEST_ACTS.length };
  texture.userData.story = state;
  const ridges = [0, 11, 5, 20, 37, 18, 22, 9, 3, 8, 21, 15, 32, 43, 25, 18, 5, 12, 28, 13, 19, 4];
  function landProfile(phase, height = 128, horizon = 63) {
    const offset = horizon - 63;
    paint.fillStyle = '#afaa8e'; paint.beginPath();
    paint.moveTo(0, offset + (phase ? 70 : 76));
    if (phase === 0) {
      paint.lineTo(512, offset + 76); paint.lineTo(512, height);
    } else {
      const edge = phase === 1 ? 355 : phase === 2 ? 330 : 163;
      paint.lineTo(edge - 28, offset + 70); paint.lineTo(edge, offset + 77); paint.lineTo(edge - 17, offset + 86);
      paint.lineTo(edge + 23, offset + 97); paint.lineTo(edge - 5, offset + 114); paint.lineTo(edge + 19, height);
    }
    paint.lineTo(0, height); paint.closePath(); paint.fill();
    paint.fillStyle = '#d1c4a1'; paint.fillRect(0, offset + 82, phase === 0 ? 512 : phase === 1 ? 324 : phase === 2 ? 297 : 135, 3);
    paint.fillStyle = '#8b917a';
    for (let rock = 0; rock < (phase === 0 ? 17 : phase === 3 ? 5 : 10); rock++) paint.fillRect(rock * 29 + 9, offset + 105 + rock % 3 * 4, 15, 3);
  }
  function landscape(phase, time, height = 128, horizon = 63) {
    paint.fillStyle = phase === 3 ? '#e2c195' : '#c6d7cd'; paint.fillRect(0, 0, 512, height);
    paint.fillStyle = '#f7e7b5'; paint.fillRect(421, horizon / 3, 17, 17);
    paint.fillStyle = '#8eaaa0'; paint.beginPath(); paint.moveTo(0, horizon + 7);
    for (let index = 0; index < ridges.length; index++) paint.lineTo(index * 25, horizon + 4 - ridges[index] * 0.75);
    paint.lineTo(512, horizon + 7); paint.closePath(); paint.fill();
    paint.fillStyle = '#497e83'; paint.fillRect(0, horizon, 512, height - horizon);
    paint.fillStyle = '#335e69'; paint.fillRect(0, horizon + 33, 512, height - horizon - 33);
    paint.fillStyle = '#7cb3af';
    for (let wave = 0; wave < 35; wave++) {
      const column = (wave * 67 + time * (wave % 2 ? 3 : -2) + 2048) % 535 - 15;
      paint.fillRect(column, horizon + 5 + wave % 8 * (height === 128 ? 7 : (height - horizon) / 9), 9 + wave % 3 * 5, 1);
    }
    paint.fillStyle = '#f2ecda';
    for (let cloud = 0; cloud < 6; cloud++) {
      const column = (cloud * 101 + time * 1.1) % 575 - 38, row = horizon * 23 / 63 + cloud % 3 * 9;
      paint.fillRect(column, row, 28, 2); paint.fillRect(column + 9, row - 2, 11, 2);
    }
    landProfile(phase, height, horizon);
  }
  function banner(column, feet, time, scale = 1) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet)); paint.scale(scale, scale);
    paint.fillStyle = '#675440'; paint.fillRect(0, -48, 2, 48);
    paint.fillStyle = '#d5b26b'; paint.fillRect(-2, -51, 6, 3);
    const flutter = Math.round(Math.sin(time * 2.1 + column) * 2);
    paint.fillStyle = '#9b4e3e'; paint.fillRect(2, -47, 19, 25); paint.fillRect(21, -47 + flutter, 3, 25);
    paint.fillStyle = '#d5b26b'; paint.fillRect(2, -47, 19, 2); paint.fillRect(2, -24, 19, 2);
    paint.fillStyle = '#f4deb0'; paint.font = 'bold 13px "Microsoft YaHei", sans-serif'; paint.textAlign = 'center'; paint.textBaseline = 'alphabetic';
    paint.fillText('秦', 12, -29);
    paint.restore();
  }
  function soldier(column, feet, time, scale = 1, walking = true) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet)); paint.scale(scale, scale);
    const step = walking ? Math.round(Math.sin(time * 5.3 + column * 0.15) * 2) : 0;
    paint.fillStyle = '#424b47'; paint.fillRect(-5 + step, -10, 3, 9); paint.fillRect(2 - step, -10, 3, 9);
    paint.fillStyle = '#292f2e'; paint.fillRect(-6 + step, -2, 5, 2); paint.fillRect(1 - step, -2, 5, 2);
    paint.fillStyle = '#b5845c'; paint.fillRect(-4, -29, 7, 7); paint.fillRect(3, -26, 3, 3);
    paint.fillStyle = '#364341'; paint.fillRect(-5, -32, 10, 4); paint.fillRect(-2, -35, 4, 3);
    paint.fillStyle = '#718279'; paint.fillRect(-6, -22, 12, 13);
    paint.fillStyle = '#b9b092';
    for (let row = 0; row < 3; row++) for (let plate = 0; plate < 3; plate++) paint.fillRect(-4 + plate * 3, -20 + row * 4, 2, 2);
    paint.fillStyle = '#a5523d'; paint.fillRect(-6, -10, 12, 2);
    paint.fillStyle = '#b5845c'; paint.fillRect(6, -19, 3, 7);
    paint.fillStyle = '#66523d'; paint.fillRect(10, -39, 1, 39);
    paint.fillStyle = '#dbd5b8'; paint.fillRect(9, -44, 3, 6);
    paint.restore();
  }
  function emperor(column, feet, time, scale = 1, gesture = false) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet)); paint.scale(scale, scale);
    paint.fillStyle = '#242f30'; paint.fillRect(-9, -28, 18, 24); paint.fillRect(-12, -22, 24, 16);
    paint.fillStyle = '#dab778'; paint.fillRect(-3, -28, 3, 24); paint.fillRect(-9, -11, 18, 3);
    paint.fillStyle = '#a3553f'; paint.fillRect(0, -24, 4, 18); paint.fillRect(-4, -3, 8, 2);
    paint.fillStyle = '#e1bd8c'; paint.fillRect(-5, -39, 10, 11); paint.fillRect(5, -35, 3, 3);
    paint.fillStyle = '#42392e'; paint.fillRect(-1, -30, 7, 5); paint.fillRect(2, -26, 3, 4); paint.fillRect(2, -36, 2, 1);
    paint.fillStyle = '#263333'; paint.fillRect(-6, -43, 12, 4); paint.fillRect(-11, -46, 23, 3);
    paint.fillStyle = '#d9bc79';
    for (let bead = 0; bead < 6; bead++) { paint.fillRect(-9 + bead * 4, -43, 1, 8); paint.fillRect(-9 + bead * 4, -35, 2, 2); }
    if (gesture) {
      const lift = Math.round(Math.sin(time * 0.8) * 1.5);
      paint.fillStyle = '#263333'; paint.fillRect(7, -25 + lift, 14, 6);
      paint.fillStyle = '#dab778'; paint.fillRect(18, -25 + lift, 2, 6);
      paint.fillStyle = '#e1bd8c'; paint.fillRect(20, -24 + lift, 7, 3);
    } else {
      paint.fillStyle = '#e1bd8c'; paint.fillRect(5, -22, 6, 3);
      paint.fillStyle = '#e8d9af'; paint.fillRect(9, -25, 3, 10);
    }
    paint.fillStyle = '#252c2b'; paint.fillRect(-7, -2, 6, 2); paint.fillRect(3, -2, 6, 2);
    paint.restore();
  }
  function horse(column, feet, time, walking = true) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet));
    paint.fillStyle = '#846449'; paint.fillRect(-15, -23, 27, 11); paint.fillRect(7, -32, 8, 16); paint.fillRect(10, -35, 15, 7);
    paint.fillStyle = '#51483a'; paint.fillRect(7, -34, 4, 15); paint.fillRect(-19, -23, 4, 17);
    for (let leg = 0; leg < 4; leg++) {
      const stride = walking ? Math.round(Math.sin(time * 5 + leg * 2) * 3) : 0;
      paint.fillStyle = leg % 2 ? '#6e553f' : '#9b7752'; paint.fillRect(-11 + leg * 7 + stride, -14, 3, 12);
      paint.fillStyle = '#343731'; paint.fillRect(-10 + leg * 7 + stride, -3, 4, 3);
    }
    paint.fillStyle = '#c8aa73'; paint.fillRect(-8, -24, 14, 3); paint.fillRect(17, -33, 2, 7);
    paint.fillStyle = '#29302b'; paint.fillRect(20, -33, 2, 1);
    paint.restore();
  }
  function chariot(column, feet, time, walking = true, occupied = true) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet));
    paint.fillStyle = '#b89965'; paint.fillRect(18, -15, 27, 2);
    horse(61, 0, time, walking);
    paint.fillStyle = '#77513e'; paint.fillRect(-23, -25, 48, 17);
    if (occupied) emperor(1, -18, time, 0.8);
    paint.fillStyle = '#c5a369'; paint.fillRect(-24, -27, 49, 4); paint.fillRect(-24, -12, 49, 3);
    paint.fillStyle = '#805440'; paint.fillRect(-20, -63, 3, 40); paint.fillRect(19, -63, 3, 40);
    paint.fillStyle = '#ad5c42'; paint.fillRect(-29, -66, 60, 5); paint.fillRect(-22, -70, 46, 4);
    paint.fillStyle = '#d9bb77'; paint.fillRect(-29, -62, 60, 2);
    for (let wheel = 0; wheel < 2; wheel++) {
      paint.save(); paint.translate(wheel ? 18 : -18, -8); paint.rotate(walking ? time * 1.5 : 0);
      paint.strokeStyle = '#d1b377'; paint.lineWidth = 2; paint.strokeRect(-7, -7, 14, 14);
      paint.fillStyle = '#5c4635'; paint.fillRect(-1, -7, 2, 14); paint.fillRect(-7, -1, 14, 2);
      paint.restore();
    }
    paint.restore();
  }
  function envoy(column, feet, time, scale = 1) {
    paint.save(); paint.translate(Math.round(column), Math.round(feet)); paint.scale(scale, scale);
    const bow = Math.sin(time * 0.6) * 0.04 + 0.1;
    paint.rotate(-bow);
    paint.fillStyle = '#ded9bb'; paint.fillRect(-6, -27, 13, 26); paint.fillRect(-11, -24, 20, 11);
    paint.fillStyle = '#81958a'; paint.fillRect(-5, -14, 12, 3);
    paint.fillStyle = '#d8b58a'; paint.fillRect(-5, -38, 9, 10); paint.fillRect(-8, -35, 3, 3);
    paint.fillStyle = '#50554b'; paint.fillRect(-5, -41, 10, 4); paint.fillRect(1, -45, 4, 4); paint.fillRect(-5, -29, 4, 7);
    paint.fillStyle = '#e3c591'; paint.fillRect(-16, -24, 14, 4);
    paint.fillStyle = '#907b52';
    for (let slip = 0; slip < 5; slip++) paint.fillRect(-15 + slip * 3, -27, 2, 9);
    paint.fillStyle = '#4b5048'; paint.fillRect(-7, -2, 6, 2); paint.fillRect(2, -2, 6, 2);
    paint.restore();
  }
  function ship(column, row, scale, time) {
    paint.save(); paint.translate(column, row); paint.rotate(Math.sin(time) * 0.025); paint.scale(scale, scale);
    paint.fillStyle = '#d9ddbc'; paint.fillRect(-27, 6, 56, 2);
    paint.fillStyle = '#77503b'; paint.beginPath(); paint.moveTo(-22, -4); paint.lineTo(24, -4); paint.lineTo(15, 5); paint.lineTo(-14, 5); paint.closePath(); paint.fill();
    paint.fillStyle = '#c39e66'; paint.fillRect(-19, -4, 38, 3);
    paint.fillStyle = '#423b31'; paint.fillRect(-2, -37, 2, 34); paint.fillRect(12, -26, 2, 22);
    paint.fillStyle = '#eee1ba'; paint.fillRect(-17, -33, 14, 24); paint.fillRect(2, -31, 12, 21); paint.fillRect(15, -24, 8, 16);
    paint.fillStyle = '#ae9164';
    for (let rowIndex = -29; rowIndex < -9; rowIndex += 5) paint.fillRect(-17, rowIndex, 31, 1);
    paint.fillStyle = '#a6533e'; paint.fillRect(0, -38, 10, 4);
    paint.restore();
  }
  function scene(phase, time, progress, audience = false) {
    landscape(phase, time);
    if (phase === 0) {
      for (let rank = 0; rank < 2; rank++) for (let guard = 0; guard < 9; guard++) {
        const column = (guard * 56 + progress * 100 + rank * 17) % 535 - 14;
        if (column > 159 && column < 305) continue;
        soldier(column, 88 + rank * 15, time + rank, rank ? 0.88 : 0.62);
      }
      banner(128 + progress * 24, 98, time, 1); banner(375 + progress * 24, 96, time + 2, 0.9);
      chariot(213 + progress * 33, 103, time);
    } else if (phase === 1) {
      const arrival = Math.min(1, progress * 2.3), advance = Math.max(0, Math.min(1, (progress - 0.42) * 2));
      banner(80, 98, time); soldier(105, 100, time, 0.9, false); soldier(71, 102, time, 0.9, false);
      chariot(142 + arrival * 27, 101, time, arrival < 1, advance === 0);
      if (advance > 0) emperor(201 + advance * 91, 101, time, 1.06, advance > 0.8);
      ship(431 + Math.sin(time * 0.3) * 7, 90, 0.7, time);
    } else if (phase === 2) {
      for (let guard = 0; guard < 4; guard++) soldier(57 + guard * 29, 103 - guard % 2 * 5, time, 0.85, false);
      banner(67, 98, time, 1.08);
      paint.fillStyle = '#858b7c'; paint.fillRect(179, 97, 75, 7); paint.fillRect(184, 93, 65, 4);
      emperor(214, 94, time, 1.1, progress > 0.35);
      envoy(audience ? 267 : 277, 102, time, 1);
      paint.fillStyle = '#d9d4af'; paint.fillRect(306, 75, 22, 2);
      ship(414 + Math.sin(time * 0.2) * 6, 95, 0.72, time);
    } else {
      for (let guard = 0; guard < 3; guard++) soldier(32 + guard * 25, 104, time, 0.78, false);
      banner(35, 96, time, 0.95); emperor(116, 99, time, 0.9, true);
      for (let vessel = 0; vessel < 3; vessel++) {
        const distance = progress * (75 + vessel * 15), scale = (1.05 - vessel * 0.19) * (1 - progress * 0.24);
        ship(237 + vessel * 71 + distance, 103 - vessel * 12 - progress * 7 + Math.sin(time + vessel) * 0.7, scale, time + vessel);
      }
    }
  }
  function draw(time) {
    state.time = time;
    const cycle = time % state.duration;
    state.phase = Math.floor(cycle / QIN_QUEST_ACT_SECONDS); state.progress = cycle % QIN_QUEST_ACT_SECONDS / QIN_QUEST_ACT_SECONDS;
    const act = QIN_QUEST_ACTS[state.phase], english = lang === 'en';
    state.act = act.id; state.language = lang; state.title = english ? act.en : act.zh; state.caption = english ? act.captionEn : act.captionZh;
    scene(state.phase, time, state.progress);
    paint.fillStyle = '#253c3d'; paint.fillRect(202, 2, 108, 17); paint.fillRect(0, 105, 512, 23);
    paint.textAlign = 'center'; paint.textBaseline = 'middle';
    paint.fillStyle = '#f7e2b3'; paint.font = 'bold 11px "Microsoft YaHei", sans-serif'; paint.fillText(state.title, 256, 11, 96);
    paint.fillStyle = '#f1e9d2'; paint.font = '9px "Microsoft YaHei", sans-serif';
    const lines = CAPTION_LINES[state.phase][state.language];
    for (let line = 0; line < lines.length; line++) paint.fillText(lines[line], 256, 111 + line * 10, 96);
    for (let chapter = 0; chapter < 4; chapter++) {
      paint.fillStyle = chapter === state.phase ? '#d9ba7c' : '#697a70'; paint.fillRect(230 + chapter * 14, 20, 10, 2);
    }
    const fade = Math.max(0, 1 - cycle % QIN_QUEST_ACT_SECONDS / 0.5, 1 - (QIN_QUEST_ACT_SECONDS - cycle % QIN_QUEST_ACT_SECONDS) / 0.5);
    if (fade > 0) { paint.fillStyle = '#253c3d'; paint.globalAlpha = fade * 0.65; paint.fillRect(0, 23, 512, 82); paint.globalAlpha = 1; }
    atlas.drawImage(frame, 0, 128);
    for (let panel = 0; panel < 5; panel++) {
      const column = panel * 512 / 5, phase = panel === 4 ? 3 : Math.min(panel, 2);
      scene(phase, time + panel * 0.7, phase === 1 ? 0.82 : phase === 2 ? 0.75 : state.progress, panel === 3);
      atlas.fillStyle = '#253c3d'; atlas.fillRect(column, 0, 512 / 5, 128);
      atlas.drawImage(frame, 0, 20, 512, 89, column + 1, 30, 512 / 5 - 2, 87);
      atlas.save(); atlas.translate(column + 512 / 10, 16); atlas.scale(0.28, 1);
      atlas.fillStyle = '#f2dfb1'; atlas.font = 'bold 18px "Microsoft YaHei", sans-serif'; atlas.textAlign = 'center'; atlas.textBaseline = 'middle';
      atlas.fillText(english ? GALLERY_TITLES[panel].en : GALLERY_TITLES[panel].zh, 0, 0, 330);
      atlas.restore();
      atlas.fillStyle = panel === state.phase || panel === 4 && state.phase === 3 ? '#d9ba7c' : '#61776c'; atlas.fillRect(column + 20, 122, 512 / 5 - 40, 2);
    }
    texture.needsUpdate = true;
  }
  function drawImmersive(context, width, height) {
    const previous = paint;
    paint = context;
    paint.save(); paint.setTransform(width / 512, 0, 0, width / 512, 0, 0); paint.imageSmoothingEnabled = false;
    const tall = height > width, extent = height * 512 / width, horizon = extent * 0.46;
    const feet = horizon + (tall ? 140 : 64), scale = tall ? 1.75 : 1.28;
    const { phase, time, progress } = state;
    landscape(phase, time, extent, horizon);
    if (phase === 0) {
      for (let rank = 0; rank < 2; rank++) for (let guard = 0; guard < 9; guard++) {
        const column = (guard * 56 + progress * 100 + rank * 17) % 535 - 14;
        if (column > 145 && column < 365) continue;
        soldier(column, feet - 12 + rank * 24, time + rank, scale * (rank ? 0.78 : 0.55));
      }
      banner(80 + progress * 24, feet, time, scale); banner(420, feet - 10, time + 2, scale * 0.8);
      paint.save(); paint.translate(230 + progress * 22, feet); paint.scale(scale, scale);
      chariot(0, 0, time); paint.restore();
    } else if (phase === 1) {
      const arrival = Math.min(1, progress * 2.3), advance = Math.max(0, Math.min(1, (progress - 0.42) * 2));
      banner(45, feet - 12, time, scale); soldier(67, feet + 4, time, scale * 0.8, false);
      paint.save(); paint.translate(130 + arrival * 27, feet); paint.scale(scale * 0.8, scale * 0.8);
      chariot(0, 0, time, arrival < 1, advance === 0); paint.restore();
      if (advance > 0) emperor(210 + advance * 82, feet + 14, time, scale, advance > 0.8);
      ship(431 + Math.sin(time * 0.3) * 7, horizon + 65, scale * 0.7, time);
    } else if (phase === 2) {
      for (let guard = 0; guard < 3; guard++) soldier(38 + guard * 38, feet + 8 - guard % 2 * 14, time, scale * 0.75, false);
      banner(50, feet - 8, time, scale);
      paint.fillStyle = '#858b7c'; paint.fillRect(178, feet - 7, 76, 12); paint.fillRect(184, feet - 13, 64, 6);
      emperor(214, feet - 12, time, scale, progress > 0.35);
      envoy(290, feet + 7, time, scale * 0.9);
      ship(424 + Math.sin(time * 0.2) * 6, horizon + 70, scale * 0.72, time);
    } else {
      for (let guard = 0; guard < 2; guard++) soldier(26 + guard * 38, feet + 12, time, scale * 0.7, false);
      banner(29, feet - 2, time, scale * 0.85); emperor(130, feet + 4, time, scale * 0.9, true);
      for (let vessel = 0; vessel < 3; vessel++) {
        const distance = progress * (75 + vessel * 15), size = (1.05 - vessel * 0.19) * (1 - progress * 0.24);
        ship(237 + vessel * 71 + distance, horizon + 100 - vessel * 26 - progress * 7 + Math.sin(time + vessel) * 0.7, size * scale, time + vessel);
      }
    }
    const fade = Math.max(0, 1 - progress * QIN_QUEST_ACT_SECONDS / 0.5, 1 - (1 - progress) * QIN_QUEST_ACT_SECONDS / 0.5);
    if (fade > 0) { paint.fillStyle = '#253c3d'; paint.globalAlpha = fade * 0.65; paint.fillRect(0, 0, 512, extent); }
    paint.restore(); paint = previous;
  }
  draw(0);
  onLang(() => draw(state.time));
  return { texture, draw, drawImmersive, state };
}
