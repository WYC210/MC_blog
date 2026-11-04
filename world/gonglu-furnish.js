// Interior of the giant crafting-table tower: a warm little home in the
// example-home manner — living room around a TV wall, a sofa, a study desk
// along the west wall and a bed in the south-east corner.
// Everything rides the tower's `model` BoxBatch (no extra draw calls); all
// lighting is baked, and each piece registers an obstacle for the nav.
import * as THREE from 'three';
import { canvasTexture } from '@engine/world/textures.js';
import { PIANO, COMPUTER } from './layout.js';
import { addRestPoint } from './rest-points.js';

const FLOOR = 1;

const L = {
  oak: { tex: 'wood_panel', tint: 0xb4905a },
  walnut: { tex: 'walnut' },
  dark: { tex: 'paint', tint: 0x2a2d31 },
  steel: { tex: 'steel' },
  linen: { tex: 'linen' },
  sheet: { tex: 'paint', tint: 0xd8d3c8 },
  marble: { tex: 'prada_marble' },
  terra: { tex: 'paint', tint: 0x876b62 },
  rug: { tex: 'linen', tint: 0xb0a692 },
  mat: { tex: 'paint', tint: 0x4a4038 },
  leaf: { tex: 'leaves' },
  sage: tint => ({ tex: 'paint', tint }),
  glow: (tint, emissive = 1) => ({ tex: 'paint', tint, emissive }),
};

// A 16:9 code-editor wallpaper shared by both monitors, and one small painting.
const monitorArt = canvasTexture(256, 144, (ctx, w, h) => {
  ctx.fillStyle = '#1d2226';
  ctx.fillRect(0, 0, w, h);
  const tones = ['#7ec9a0', '#8fb7d8', '#d8c08a', '#c98f8f', '#9aa1a6'];
  for (let row = 0; row < 11; row++) {
    let x = 14 + (row % 4) * 10;
    const runs = 2 + (row * 7) % 4;
    for (let r = 0; r < runs && x < w - 30; r++) {
      const len = 18 + (row * 13 + r * 29) % 60;
      ctx.fillStyle = tones[(row + r) % tones.length];
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x, 12 + row * 11, len, 5);
      ctx.globalAlpha = 1;
      x += len + 8;
    }
  }
  ctx.fillStyle = '#d8c08a';
  ctx.fillRect(w - 26, 12, 12, 5);
});
const bedArt = canvasTexture(128, 96, (ctx, w, h) => {
  // A quiet sunset over the sea, echoing the view outside the tower.
  const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
  sky.addColorStop(0, '#f2b46a');
  sky.addColorStop(1, '#e58a5a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h * 0.62);
  ctx.fillStyle = '#3e6c8e';
  ctx.fillRect(0, h * 0.62, w, h * 0.38);
  ctx.fillStyle = '#f8dfa8';
  ctx.beginPath();
  ctx.arc(w * 0.62, h * 0.5, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(62,108,142,0.55)';
  for (const [x, y, ww] of [[8, 78, 34], [52, 86, 44], [96, 80, 24]]) ctx.fillRect(x, y, ww, 2);
});

export function furnishGONGLU({ B, obstacles, bakes, surfaces, hotspots }) {
  const foot = (x, z, w, d) => obstacles.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, level: 0 });
  const hotspot = (id, x, y, z, w, h, d) => hotspots.push({
    id,
    box: new THREE.Box3(new THREE.Vector3(x - w / 2, y, z - d / 2), new THREE.Vector3(x + w / 2, y + h, z + d / 2)),
  });
  const bake = (id, x, y, z, power, radius, direction = null) => bakes.push({ id, position: [x, y, z], power, radius, direction });
  const plane = (w, h, tex, x, y, z, ry = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tex ? new THREE.MeshLambertMaterial({ map: tex }) : new THREE.MeshBasicMaterial());
    mesh.position.set(x, y, z);
    mesh.rotation.set(0, ry, 0, 'YXZ');
    return mesh;
  };
  const planes = [];

  // ——— Living room: TV wall along the north wall ———
  B.box(-23.5, FLOOR, -0.55, 4.0, 0.5, 0.62, L.walnut);
  B.box(-23.5, FLOOR + 0.5, -0.55, 4.2, 0.06, 0.72, L.oak);
  B.box(-24.7, FLOOR + 0.56, -0.55, 0.4, 0.1, 0.26, L.dark);
  B.box(-22.25, FLOOR + 0.56, -0.6, 0.13, 0.3, 0.13, L.terra);
  foot(-23.5, -0.55, 4.3, 0.85);
  // The TV itself plays the engine's night-city footage.
  B.box(-23.5, FLOOR + 0.92, -0.97, 2.78, 1.64, 0.07, L.dark);
  const tv = plane(2.6, 1.46, null, -23.5, FLOOR + 1.71, -0.92);
  planes.push(tv);
  surfaces.tvScreen = tv;
  B.box(-23.5, FLOOR + 2.72, -0.9, 2.4, 0.05, 0.09, L.glow(0xffd9a0));
  bake('tv-wash', -23.5, FLOOR + 2.7, -0.6, 1.2, 6, [0, -0.9, 0.5]);

  // Sofa facing the TV, with a marble-top coffee table on a wool rug.
  B.box(-23.5, FLOOR + 0.01, 2.1, 4.6, 0.02, 3.6, L.rug);
  B.box(-23.5, FLOOR + 0.1, 3.75, 3.4, 0.38, 1.05, L.dark);
  B.box(-23.5, FLOOR + 0.48, 4.16, 3.4, 0.6, 0.22, L.dark);
  for (const x of [-25.05, -21.95]) B.box(x, FLOOR + 0.1, 3.75, 0.3, 0.6, 1.05, L.dark);
  B.box(-24.2, FLOOR + 0.48, 3.62, 1.5, 0.12, 0.85, { tex: 'paint', tint: 0x35393d });
  B.box(-22.8, FLOOR + 0.48, 3.62, 1.5, 0.12, 0.85, { tex: 'paint', tint: 0x35393d });
  B.box(-24.9, FLOOR + 0.55, 3.95, 0.42, 0.42, 0.14, L.sage(0x6e7f5e), { ry: 0.5 });
  B.box(-22.15, FLOOR + 0.55, 3.95, 0.42, 0.42, 0.14, L.sage(0x9a6a55), { ry: -0.4 });
  foot(-23.5, 3.8, 3.7, 1.3);
  for (const x of [-24.2, -22.8]) addRestPoint({ id: `home-sofa-${x}`, name: '客厅沙发', en: 'Living room sofa', x, y: FLOOR + 0.6, z: 3.62, floor: FLOOR, yaw: Math.PI });
  B.box(-23.5, FLOOR + 0.4, 1.5, 1.3, 0.06, 0.7, L.marble);
  for (const [dx, dz] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) {
    B.box(-23.5 + dx, FLOOR, 1.5 + dz, 0.05, 0.4, 0.05, L.steel);
  }
  B.box(-23.75, FLOOR + 0.46, 1.42, 0.24, 0.05, 0.17, L.sage(0x8a4f3e));
  B.box(-23.15, FLOOR + 0.46, 1.55, 0.17, 0.045, 0.12, L.sheet);
  foot(-23.5, 1.5, 1.45, 0.85);
  B.box(-26.3, FLOOR, 3.4, 0.3, 0.04, 0.3, L.steel);
  B.box(-26.3, FLOOR + 0.04, 3.4, 0.06, 1.68, 0.06, L.steel);
  B.box(-26.3, FLOOR + 1.72, 3.4, 0.5, 0.24, 0.5, L.linen);
  B.box(-26.3, FLOOR + 1.7, 3.4, 0.36, 0.02, 0.36, L.glow(0xffe4ba));
  foot(-26.3, 3.4, 0.4, 0.4);
  bake('sofa-lamp', -26.3, FLOOR + 1.68, 3.4, 1.0, 6, [0, -1, 0]);

  // Two pendants over the rug, hung from the model's beam grid.
  for (const [i, x] of [-24.3, -22.7].entries()) {
    B.box(x, FLOOR + 3.6, 1.5, 0.04, 8.6, 0.04, L.steel);
    B.box(x, FLOOR + 3.52, 1.5, 0.5, 0.09, 0.5, L.steel);
    B.box(x, FLOOR + 3.49, 1.5, 0.36, 0.03, 0.36, L.glow(0xffe4ba));
    bake('pendant' + i, x, FLOOR + 3.4, 1.5, 3.2, 10, [0, -1, 0]);
  }

  const deskX = COMPUTER.x, deskZ = COMPUTER.z;
  B.box(-26.5, FLOOR + 0.004, deskZ, 2.85, 0.016, 3.65, L.rug);
  B.box(-26.5, FLOOR + 0.02, deskZ, 2.65, 0.006, 3.45, { tex: 'linen', tint: 0xc0b7a4 });
  B.at(deskX, FLOOR, deskZ, Math.PI / 2, () => {
    B.box(0, 0.72, 0, 2.8, 0.06, 0.84, L.oak);
    B.box(0, 0.68, -0.32, 2.6, 0.04, 0.06, L.dark);
    for (const side of [-1, 1]) {
      for (const depth of [-0.32, 0.32]) B.box(side * 1.27, 0.04, depth, 0.055, 0.68, 0.055, L.dark);
      B.box(side * 1.27, 0.025, 0, 0.12, 0.035, 0.76, L.dark);
    }
    B.box(1.01, 0.12, -0.02, 0.43, 0.52, 0.62, L.walnut);
    for (const height of [0.15, 0.4]) {
      B.box(1.01, height, 0.301, 0.38, 0.21, 0.018, L.oak);
      B.box(1.01, height + 0.14, 0.317, 0.1, 0.016, 0.014, L.dark);
    }
    B.box(-1.04, 0.1, -0.04, 0.31, 0.51, 0.52, L.dark);
    B.box(-1.04, 0.14, 0.224, 0.25, 0.41, 0.016, { tex: 'paint', tint: 0x3b4143 });
    for (const height of [0.22, 0.38]) {
      B.box(-1.04, height, 0.235, 0.13, 0.11, 0.008, L.steel);
      B.box(-1.04, height + 0.025, 0.24, 0.05, 0.06, 0.008, L.dark);
    }
    B.box(-0.95, 0.56, 0.237, 0.02, 0.02, 0.01, L.glow(0x9ab8a5, 0.4));
    B.box(0, 0.782, 0.14, 1.45, 0.008, 0.42, { tex: 'leather', tint: 0x41483f });
    B.box(0.15, 0.792, 0.17, 0.62, 0.025, 0.2, L.dark);
    for (let row = 0; row < 3; row++) {
      for (let key = 0; key < 11; key++) B.box(-0.11 + key * 0.05, 0.817, 0.11 + row * 0.05, 0.039, 0.008, 0.036, { tex: 'paint', tint: 0xb5bab0 });
    }
    B.box(-0.44, 0.792, 0.19, 0.09, 0.035, 0.14, L.dark);
    for (const offset of [-0.47, 0.47]) {
      B.box(offset, 0.78, -0.24, 0.28, 0.025, 0.2, L.dark);
      B.box(offset, 0.805, -0.26, 0.045, 0.29, 0.045, L.steel);
      B.box(offset, 1.075, -0.235, 0.93, 0.55, 0.055, L.dark);
      B.box(offset + 0.38, 1.087, -0.202, 0.015, 0.009, 0.006, L.glow(0xa9c7aa, 0.4));
    }
    B.box(1.13, 0.78, -0.18, 0.22, 0.025, 0.22, L.dark);
    B.box(1.13, 0.805, -0.18, 0.025, 0.67, 0.025, L.dark);
    B.box(1.13, 1.46, 0, 0.025, 0.025, 0.38, L.dark);
    B.box(1.13, 1.415, 0.16, 0.3, 0.07, 0.12, L.walnut);
    B.box(1.13, 1.405, 0.16, 0.25, 0.012, 0.1, L.glow(0xffe4ba, 0.8));
    B.box(-1.15, 0.78, -0.23, 0.16, 0.15, 0.16, L.terra);
    B.box(-1.15, 0.93, -0.23, 0.2, 0.14, 0.18, L.leaf);
  });
  for (const offset of [-0.47, 0.47]) planes.push(plane(0.87, 0.49, monitorArt, deskX - 0.204, FLOOR + 1.36, deskZ - offset, Math.PI / 2));
  hotspot('computer', deskX, FLOOR + 0.72, deskZ, 0.9, 1.1, 2.1);
  bake('desk-screen', deskX + 0.05, FLOOR + 1.3, deskZ, 0.5, 3, [0.7, -0.2, 0]);
  bake('desk-lamp', deskX + 0.16, FLOOR + 1.4, deskZ - 1.13, 0.9, 4, [0, -1, 0]);
  foot(deskX, deskZ, 0.94, 2.9);
  ergonomicChair(B, -26.08, deskZ, Math.PI / 2);
  foot(-26.08, deskZ, 0.9, 0.9);

  const bedX = -17.1, bedZ = 11.4;
  const bedding = { tex: 'linen', tint: 0xe5dfd0 };
  const accent = { tex: 'linen', tint: 0x73816d };
  B.box(bedX, FLOOR + 0.004, 10.55, 4.4, 0.016, 4.4, L.rug);
  B.box(bedX, FLOOR + 0.02, 10.55, 4.16, 0.008, 4.16, { tex: 'linen', tint: 0xc6bfad });
  B.box(bedX, FLOOR + 0.04, 12.72, 2.25, 1.12, 0.16, L.walnut);
  for (const offset of [-0.51, 0.51]) B.box(bedX + offset, FLOOR + 0.44, 12.617, 0.99, 0.63, 0.075, accent);
  for (const offsetX of [-0.85, 0.85]) {
    for (const offsetZ of [-0.94, 0.94]) B.box(bedX + offsetX, FLOOR + 0.03, bedZ + offsetZ, 0.09, 0.17, 0.09, L.walnut);
  }
  B.box(bedX, FLOOR + 0.16, bedZ, 2.1, 0.18, 2.4, L.walnut);
  B.box(bedX, FLOOR + 0.34, bedZ, 1.98, 0.18, 2.28, L.linen);
  B.box(bedX, FLOOR + 0.52, 11.08, 1.99, 0.09, 1.66, bedding);
  for (const offset of [-0.98, 0.98]) B.box(bedX + offset, FLOOR + 0.4, 11.04, 0.045, 0.2, 1.72, bedding);
  for (const offset of [-0.49, 0.49]) {
    B.box(bedX + offset, FLOOR + 0.52, 12.18, 0.88, 0.14, 0.49, bedding);
    B.box(bedX + offset, FLOOR + 0.6, 12.36, 0.7, 0.2, 0.16, L.linen, { rx: -0.16 });
  }
  B.box(bedX, FLOOR + 0.611, 10.62, 2.02, 0.035, 0.53, accent);
  for (const offset of [-0.99, 0.99]) B.box(bedX + offset, FLOOR + 0.35, 10.62, 0.045, 0.26, 0.53, accent);
  foot(bedX, 11.5, 2.23, 2.65);
  addRestPoint({ id: 'home-bed', name: '卧室床', en: 'Bed', x: bedX, y: FLOOR + 0.61, z: 11.45, floor: FLOOR, yaw: Math.PI, kind: 'lie' });
  for (const side of [-1, 1]) {
    const nightstandX = bedX + side * 1.5;
    for (const offset of [-0.2, 0.2]) B.box(nightstandX + offset, FLOOR + 0.03, 12.28, 0.045, 0.15, 0.42, L.dark);
    B.box(nightstandX, FLOOR + 0.18, 12.28, 0.57, 0.3, 0.48, L.walnut);
    B.box(nightstandX, FLOOR + 0.48, 12.28, 0.63, 0.04, 0.54, L.oak);
    B.box(nightstandX, FLOOR + 0.22, 12.031, 0.49, 0.21, 0.02, L.oak);
    B.box(nightstandX, FLOOR + 0.36, 12.014, 0.12, 0.015, 0.018, L.dark);
    B.box(nightstandX, FLOOR + 0.52, 12.32, 0.19, 0.025, 0.19, L.walnut);
    B.box(nightstandX, FLOOR + 0.545, 12.32, 0.025, 0.22, 0.025, L.steel);
    B.box(nightstandX, FLOOR + 0.75, 12.32, 0.32, 0.23, 0.28, L.linen);
    B.box(nightstandX, FLOOR + 0.738, 12.32, 0.26, 0.015, 0.22, L.glow(0xffe4ba, 0.8));
    foot(nightstandX, 12.28, 0.73, 0.64);
    bake('bedside' + (side < 0 ? '-w' : '-e'), nightstandX, FLOOR + 0.73, 12.28, 0.85, 4, [0, -1, -0.2]);
  }
  const bedBenchZ = 8.65;
  for (const offsetX of [-0.65, 0.65]) {
    for (const offsetZ of [-0.16, 0.16]) B.box(bedX + offsetX, FLOOR + 0.03, bedBenchZ + offsetZ, 0.055, 0.34, 0.055, L.dark);
  }
  B.box(bedX, FLOOR + 0.34, bedBenchZ, 1.6, 0.05, 0.46, L.walnut);
  B.box(bedX, FLOOR + 0.39, bedBenchZ, 1.63, 0.09, 0.48, { tex: 'linen', tint: 0x555f53 });
  B.box(bedX + 0.47, FLOOR + 0.48, bedBenchZ, 0.33, 0.025, 0.49, bedding);
  foot(bedX, bedBenchZ, 1.73, 0.58);
  for (const offset of [-0.4, 0.4]) addRestPoint({ id: `home-bed-bench-${offset}`, name: '床尾凳', en: 'Bedroom bench', x: bedX + offset, y: FLOOR + 0.48, z: bedBenchZ, floor: FLOOR, yaw: Math.PI });
  B.box(bedX, FLOOR + 1.7, 12.88, 1.45, 0.9, 0.06, L.walnut);
  planes.push(plane(1.3, 0.75, bedArt, bedX, FLOOR + 2.15, 12.84, Math.PI));
  bake('bed-art', bedX, FLOOR + 2.7, 12.6, 0.6, 3.5, [0, -0.5, -1]);

  // ——— Plants and door mats ———
  for (const [x, z, s] of [[-27.5, 0.4, 1], [-19.9, 12.5, 0.75]]) {
    B.box(x, FLOOR, z, 0.3 * s, 0.34 * s, 0.3 * s, L.terra);
    B.box(x, FLOOR + 0.34 * s, z, 0.34 * s, 0.06, 0.34 * s, L.terra);
    B.box(x, FLOOR + 0.4 * s, z, 0.62 * s, 0.5 * s, 0.62 * s, L.leaf);
    B.box(x, FLOOR + 0.82 * s, z, 0.4 * s, 0.3 * s, 0.4 * s, L.leaf);
    foot(x, z, 0.45 * s, 0.45 * s);
  }
  B.box(-21.5, FLOOR + 0.005, 12.2, 1.8, 0.02, 0.9, L.mat);
  B.box(-14.9, FLOOR + 0.005, 5.9, 0.9, 0.02, 1.8, L.mat);

  const pianoX = PIANO.x, pianoZ = PIANO.z;
  const lacquer = { tex: 'paint', tint: 0x252b30 };
  const panel = { tex: 'paint', tint: 0x353b40 };
  const brass = { tex: 'paint', tint: 0xb39761 };
  const ivory = { tex: 'paint', tint: 0xeee9da };
  const ebony = { tex: 'paint', tint: 0x111619 };
  const felt = { tex: 'paint', tint: 0x70352f };
  B.box(pianoX, FLOOR + 0.004, pianoZ + 0.85, 3.75, 0.016, 2.7, { tex: 'linen', tint: 0x7f8975 });
  B.box(pianoX, FLOOR + 0.02, pianoZ + 0.85, 3.53, 0.008, 2.48, { tex: 'linen', tint: 0xb8b4a4 });
  B.at(pianoX, FLOOR, pianoZ, 0, () => {
    B.box(0, 0.06, -0.08, 2.76, 0.12, 0.72, lacquer);
    B.box(0, 0.18, -0.22, 2.62, 1.66, 0.48, lacquer);
    B.box(0, 0.23, 0.035, 2.36, 0.47, 0.04, panel);
    B.box(0, 0.26, 0.06, 2.18, 0.015, 0.012, brass);
    for (const side of [-1, 1]) {
      B.box(side * 1.33, 0.18, -0.1, 0.16, 1.68, 0.7, lacquer);
      B.box(side * 1.255, 0.19, 0.36, 0.12, 0.55, 0.13, lacquer);
      B.box(side * 1.255, 0.07, 0.24, 0.19, 0.12, 0.49, lacquer);
      B.box(side * 1.31, 0.78, 0.3, 0.18, 0.21, 0.54, lacquer);
      B.box(side * 1.31, 0.975, 0.3, 0.19, 0.025, 0.56, panel);
      for (const depth of [-0.3, 0.37]) B.box(side * 1.255, 0, depth, 0.09, 0.07, 0.09, brass);
    }
    B.box(0, 1.06, 0.035, 2.46, 0.71, 0.045, panel);
    for (const height of [1.075, 1.745]) B.box(0, height, 0.065, 2.37, 0.015, 0.012, brass);
    B.box(0, 1.8, -0.1, 2.78, 0.06, 0.68, lacquer);
    B.box(0, 1.855, -0.1, 2.8, 0.012, 0.7, brass);
    B.box(0, 1.87, -0.1, 2.86, 0.07, 0.74, lacquer);
    B.box(0, 0.735, 0.27, 2.8, 0.065, 0.63, lacquer);
    B.box(0, 0.8, 0.28, 2.44, 0.02, 0.46, ebony);
    B.box(0, 0.8, 0.575, 2.48, 0.025, 0.025, brass);
    B.box(0, 0.91, 0.08, 2.44, 0.14, 0.07, lacquer);
    B.box(0, 1.005, 0.119, 0.26, 0.025, 0.012, brass);
    B.box(0, 0.86, 0.102, 2.4, 0.025, 0.02, felt);
    const whiteKeyWidth = 2.4 / 52;
    let whiteKeys = 0;
    for (let midi = 21; midi <= 108; midi++) {
      const pitch = midi % 12;
      const isBlack = pitch === 1 || pitch === 3 || pitch === 6 || pitch === 8 || pitch === 10;
      if (isBlack) {
        B.box(-1.2 + whiteKeys * whiteKeyWidth, 0.865, 0.21,
          whiteKeyWidth * 0.58, 0.045, 0.2, ebony);
      } else {
        B.box(-1.2 + (whiteKeys + 0.5) * whiteKeyWidth, 0.82, 0.3,
          whiteKeyWidth - 0.003, 0.045, 0.36, ivory);
        whiteKeys++;
      }
    }
    B.box(0, 1.17, 0.12, 1.15, 0.53, 0.045, lacquer, { rx: -0.16 });
    B.box(0, 1.165, 0.2, 1.2, 0.035, 0.16, lacquer);
    B.box(0, 1.2, 0.282, 1.17, 0.012, 0.015, brass);
    for (const side of [-1, 1]) {
      B.box(side * 0.213, 1.225, 0.151, 0.416, 0.43, 0.009, ivory, { rx: -0.16 });
      for (let system = 0; system < 2; system++) {
        for (let staff = 0; staff < 5; staff++) {
          const height = 1.29 + system * 0.18 + staff * 0.016;
          B.box(side * 0.213, height, 0.16 - (height - 1.44) * Math.sin(0.16),
            0.35, 0.003, 0.004, panel, { rx: -0.16 });
        }
        for (let note = 0; note < 5; note++) {
          const noteX = side * 0.213 - 0.13 + note * 0.063;
          const height = 1.306 + system * 0.18 + ((note * 3 + system) % 5) * 0.008;
          B.box(noteX, height, 0.164 - (height - 1.44) * Math.sin(0.16),
            0.018, 0.011, 0.006, ebony, { rx: -0.16 });
          B.box(noteX + 0.007, height, 0.164 - (height + 0.02 - 1.44) * Math.sin(0.16),
            0.003, 0.044, 0.006, ebony, { rx: -0.16 });
        }
      }
    }
    B.box(0, 0.13, 0.105, 0.58, 0.12, 0.055, lacquer);
    for (const offset of [-0.18, 0, 0.18]) {
      B.box(offset, 0.11, 0.3, 0.055, 0.035, 0.33, brass, { rx: -0.12 });
      B.box(offset, 0.105, 0.455, 0.09, 0.035, 0.11, brass);
    }
    B.box(0, 1.94, -0.12, 0.29, 0.035, 0.2, brass);
    B.box(0, 1.975, -0.18, 0.025, 0.2, 0.025, brass);
    B.box(0, 2.15, -0.025, 0.025, 0.025, 0.33, brass);
    B.box(0, 2.115, 0.12, 0.66, 0.065, 0.14, brass);
    B.box(0, 2.108, 0.12, 0.57, 0.012, 0.11, L.glow(0xffe4ba, 0.8));
  });
  const benchZ = pianoZ + 1.3;
  B.box(pianoX, FLOOR + 0.36, benchZ, 1.06, 0.06, 0.5, lacquer);
  B.box(pianoX, FLOOR + 0.42, benchZ, 1.08, 0.08, 0.51, { tex: 'leather', tint: 0x35302d });
  for (const dx of [-0.43, 0.43]) {
    for (const dz of [-0.17, 0.17]) {
      B.box(pianoX + dx, FLOOR + 0.035, benchZ + dz, 0.075, 0.325, 0.075, lacquer);
      B.box(pianoX + dx, FLOOR, benchZ + dz, 0.08, 0.035, 0.08, brass);
    }
    for (const dz of [-0.12, 0.12]) B.box(pianoX + dx * 0.6, FLOOR + 0.499, benchZ + dz, 0.025, 0.003, 0.025, lacquer);
  }
  foot(pianoX, pianoZ + 0.05, 2.96, 1.12);
  foot(pianoX, benchZ, 1.18, 0.61);
  hotspot('piano', pianoX, FLOOR, pianoZ + 0.75, 2.96, 2.2, 2.3);
  bake('piano-warmth', pianoX, FLOOR + 2.08, pianoZ + 0.22, 0.95, 4.5, [0, -1, 0.25]);

  const lampX = pianoX - 2.05, lampZ = pianoZ + 0.3;
  B.box(lampX, FLOOR, lampZ, 0.43, 0.05, 0.43, lacquer);
  B.box(lampX, FLOOR + 0.05, lampZ, 0.035, 1.65, 0.035, brass);
  B.box(lampX, FLOOR + 1.7, lampZ, 0.57, 0.28, 0.57, L.linen);
  B.box(lampX, FLOOR + 1.688, lampZ, 0.45, 0.018, 0.45, L.glow(0xffe4ba, 0.8));
  foot(lampX, lampZ, 0.55, 0.55);
  bake('piano-corner-lamp', lampX, FLOOR + 1.68, lampZ, 1, 5.5, [0, -1, 0]);

  B.box(pianoX, FLOOR + 2.47, -0.9, 1.74, 0.92, 0.065, L.walnut);
  B.box(pianoX, FLOOR + 2.53, -0.86, 1.62, 0.8, 0.025, ivory);
  for (let bar = 0; bar < 17; bar++) {
    const height = 0.08 + 0.34 * Math.abs(Math.sin(bar * 0.65));
    B.box(pianoX + (bar - 8) * 0.068, FLOOR + 2.92 - height / 2, -0.84,
      0.025, height, 0.012, { tex: 'paint', tint: 0x516b59 });
  }
  B.box(pianoX + 0.57, FLOOR + 3.13, -0.84, 0.11, 0.11, 0.012, brass);

  const plantX = -14.7, plantZ = 0.75;
  B.at(plantX, FLOOR, plantZ, 0, () => {
    B.box(0, 0, 0, 0.37, 0.42, 0.37, L.terra);
    B.box(0, 0.39, 0, 0.42, 0.06, 0.42, L.terra);
    B.box(0, 0.45, 0, 0.32, 0.015, 0.32, L.mat);
    B.box(0, 0.46, 0, 0.055, 1.1, 0.055, L.walnut);
    for (const [height, yaw] of [[0.8, 0.3], [1.02, 2.4], [1.25, 4.2], [1.46, 1.4]]) {
      B.at(0, height, 0, yaw, () => {
        B.box(0, 0, 0.12, 0.025, 0.025, 0.27, L.walnut, { rx: -0.3 });
        for (let band = 0; band < 5; band++) {
          B.box(0, 0.06 + band * 0.025, 0.1 + band * 0.075,
            [0.12, 0.24, 0.3, 0.23, 0.11][band], 0.035, 0.08,
            { tex: 'leaves_olive', tint: 0x78906a });
        }
      });
    }
  });
  foot(plantX, plantZ, 0.55, 0.55);

  return planes;
}

// Black seat, lumbar pad and arms, with a black mesh back and headrest —
// the example home's desk chair, rebuilt on this module's own batch.
function ergonomicChair(B, x, z, ry) {
  const black = L.dark, mesh = { tex: 'chair_mesh' };
  B.at(x, FLOOR, z, ry, () => {
    B.box(0, 0.13, 0, 0.09, 0.32, 0.09, L.sage(0x8d9799));
    B.box(0, 0.45, 0, 0.58, 0.1, 0.55, black);
    B.box(0, 0.51, 0.27, 0.52, 0.67, 0.065, mesh, { rx: -0.1 });
    for (const cx of [-0.28, 0.28]) B.box(cx, 0.5, 0.28, 0.04, 0.72, 0.07, L.steel, { rx: -0.1 });
    B.box(0, 0.73, 0.3, 0.42, 0.12, 0.11, black);
    B.box(0, 1.18, 0.31, 0.08, 0.14, 0.05, L.steel);
    B.box(0, 1.3, 0.33, 0.4, 0.17, 0.1, mesh);
    for (const cx of [-0.36, 0.36]) {
      B.box(cx, 0.48, 0.08, 0.045, 0.23, 0.05, L.sage(0x747b7c));
      B.box(cx, 0.7, 0, 0.09, 0.04, 0.36, black);
    }
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) B.at(0, 0, 0, a, () => {
      B.box(0, 0.1, 0.18, 0.07, 0.05, 0.38, L.sage(0x747b7c));
      B.box(0, 0.02, 0.34, 0.12, 0.08, 0.1, black);
    });
  });
}
