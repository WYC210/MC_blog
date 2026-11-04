import * as THREE from 'three';
import { createTradingArt, TRADING_ART } from './lehun-trading-art.js';
import { addRestPoint } from './rest-points.js';

export function buildTradingStudio({ B, foot, bake, floor }) {
  const wood = { tex: 'wood_panel', tint: 0xc5b499, emissive: 0.1 };
  const walnut = { tex: 'walnut' };
  const metal = { tex: 'paint', tint: 0x303a3d };
  const linen = { tex: 'linen', tint: 0xc7c5b6 };
  const green = { tex: 'linen', tint: 0x59695b };
  const paper = { tex: 'paint', tint: 0xe6e1d0 };
  const glow = { tex: 'paint', tint: 0xffedcc, emissive: 1 };
  const positions = [], normals = [], coordinates = [], indices = [];
  const display = (region, width, height, x, y, z, yaw = 0) => {
    const cosine = Math.cos(yaw), sine = Math.sin(yaw), base = positions.length / 3;
    for (const [horizontal, vertical] of [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]]) {
      positions.push(x + horizontal * width * cosine, y + vertical * height, z - horizontal * width * sine);
      normals.push(sine, 0, cosine);
      coordinates.push((region.x + (horizontal + 0.5) * region.width) / 1024, 1 - (region.y + (0.5 - vertical) * region.height) / 1024);
    }
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  B.box(9.54, floor, 44.5, 0.1, 3.5, 8, wood);
  for (const z of [40.56, 48.44]) B.box(9.6, floor + 0.08, z, 0.04, 3.34, 0.05, walnut);
  foot(9.56, 44.5, 0.24, 8.1);
  B.box(9.66, floor + 0.83, 43.5, 0.12, 2.36, 3.67, walnut);
  display(TRADING_ART.research, 3.5, 2.2, 9.727, floor + 2.01, 43.5, Math.PI / 2);
  B.box(9.66, floor + 1.03, 47, 0.12, 1.75, 2.55, metal);
  display(TRADING_ART.review, 2.4, 1.6, 9.727, floor + 1.905, 47, Math.PI / 2);
  B.box(9.85, floor + 3.3, 43.5, 0.32, 0.05, 3.5, metal);
  B.box(9.92, floor + 3.285, 43.5, 0.18, 0.015, 3.3, glow);
  B.box(9.85, floor + 2.91, 47, 0.32, 0.05, 2.45, metal);
  B.box(9.92, floor + 2.895, 47, 0.18, 0.015, 2.25, glow);
  bake('trading-research-wash', 10.05, floor + 3.2, 43.5, 0.9, 4.5, [-0.4, -1, 0]);
  bake('trading-review-wash', 10.05, floor + 2.8, 47, 0.65, 3.5, [-0.4, -1, 0]);

  B.box(10.03, floor + 0.08, 43.6, 0.56, 0.57, 2.65, walnut);
  B.box(10.03, floor + 0.65, 43.6, 0.6, 0.04, 2.72, wood);
  for (const offset of [-0.85, 0, 0.85]) {
    B.box(10.318, floor + 0.16, 43.6 + offset, 0.022, 0.42, 0.8, wood);
    B.box(10.339, floor + 0.48, 43.6 + offset, 0.02, 0.015, 0.12, metal);
  }
  B.box(10.04, floor + 0.69, 42.86, 0.31, 0.025, 0.4, green);
  B.box(10.04, floor + 0.715, 42.86, 0.27, 0.012, 0.36, paper);
  foot(10.03, 43.6, 0.68, 2.82);

  const deskX = 11.65, deskZ = 38.65;
  B.box(deskX, floor + 0.004, 39.65, 4.05, 0.016, 3.5, linen);
  B.box(deskX, floor + 0.02, 39.65, 3.87, 0.006, 3.32, { tex: 'linen', tint: 0xd9d4c3 });
  B.at(deskX, floor, deskZ, 0, () => {
    B.box(0, 0.74, 0, 3.7, 0.06, 0.95, wood);
    for (const side of [-1, 1]) {
      for (const depth of [-0.35, 0.35]) B.box(side * 1.66, 0.04, depth, 0.06, 0.7, 0.06, metal);
      B.box(side * 1.66, 0.025, 0, 0.14, 0.035, 0.87, metal);
    }
    B.box(0, 0.67, -0.36, 3.3, 0.055, 0.06, metal);
    B.box(0, 0.798, 0.17, 1.65, 0.008, 0.42, green);
    B.box(-0.15, 0.806, 0.18, 0.7, 0.025, 0.2, metal);
    for (let row = 0; row < 3; row++) {
      for (let key = 0; key < 12; key++) B.box(-0.449 + key * 0.054, 0.831, 0.12 + row * 0.05, 0.043, 0.007, 0.036, paper);
    }
    B.box(0.5, 0.806, 0.19, 0.09, 0.035, 0.14, metal);
    B.box(-1.31, 0.8, 0.1, 0.34, 0.025, 0.25, green);
    B.box(-1.31, 0.825, 0.1, 0.3, 0.012, 0.22, paper);
    B.box(-1.23, 0.84, 0.1, 0.014, 0.014, 0.2, metal);
    B.box(1.25, 0.8, 0.14, 0.13, 0.15, 0.13, paper);
    B.box(1.25, 0.95, 0.14, 0.105, 0.005, 0.105, { tex: 'paint', tint: 0x493d31 });
    B.box(1.33, 0.83, 0.14, 0.035, 0.07, 0.035, paper);
    B.box(1.35, 0.08, -0.03, 0.32, 0.55, 0.55, metal);
    B.box(1.35, 0.14, 0.25, 0.26, 0.41, 0.015, { tex: 'paint', tint: 0x53605d });
    for (const height of [0.22, 0.38]) {
      B.box(1.35, height, 0.263, 0.15, 0.11, 0.008, metal);
      B.box(1.35, height + 0.023, 0.27, 0.055, 0.065, 0.008, { tex: 'paint', tint: 0x8ba396 });
    }
    B.box(-1.32, 0.1, -0.02, 0.48, 0.53, 0.64, walnut);
    for (const height of [0.16, 0.4]) {
      B.box(-1.32, height, 0.309, 0.42, 0.19, 0.02, wood);
      B.box(-1.32, height + 0.12, 0.326, 0.13, 0.014, 0.016, metal);
    }
    for (const column of [-1, 0, 1]) {
      B.box(column * 1.08, 0.8, -0.25, 0.3, 0.025, 0.22, metal);
      B.box(column * 1.08, 0.825, -0.27, 0.04, 1.25, 0.04, metal);
      for (const row of [0, 1]) B.box(column * 1.08, 0.99 + row * 0.65, -0.21 + Math.abs(column) * 0.06, 1.045, 0.61, 0.065, metal, { ry: -column * 0.13 });
    }
    B.box(0, 2.27, -0.15, 2.8, 0.05, 0.13, metal);
    B.box(0, 2.255, -0.08, 2.65, 0.015, 0.08, glow);
  });
  for (const row of [0, 1]) for (const column of [-1, 0, 1]) {
    const yaw = -column * 0.13;
    display(TRADING_ART.screens[row * 3 + column + 1], 0.985, 0.55,
      deskX + column * 1.08 + Math.sin(yaw) * 0.034, floor + 1.295 + row * 0.65,
      deskZ - 0.21 + Math.abs(column) * 0.06 + Math.cos(yaw) * 0.034, yaw);
  }
  B.box(deskX, floor + 2.78, 37.23, 4.18, 0.49, 0.09, metal);
  display(TRADING_ART.ticker, 4.02, 0.377, deskX, floor + 3.025, 37.279);
  bake('trading-screen-fill', deskX, floor + 1.55, deskZ + 0.18, 0.55, 3.8, [0, -0.3, 1]);
  bake('trading-desk-task', deskX, floor + 2.2, deskZ + 0.05, 0.85, 4, [0, -1, 0.25]);
  foot(deskX, deskZ, 3.8, 1.05);

  B.at(deskX, floor, 40.25, 0, () => {
    B.box(0, 0.12, 0, 0.075, 0.33, 0.075, metal);
    B.box(0, 0.45, 0, 0.6, 0.09, 0.55, { tex: 'leather', tint: 0x374341 });
    B.box(0, 0.52, 0.26, 0.55, 0.68, 0.065, { tex: 'chair_mesh', tint: 0x87918b }, { rx: -0.1 });
    B.box(0, 0.7, 0.29, 0.42, 0.14, 0.1, metal);
    B.box(0, 1.21, 0.3, 0.08, 0.12, 0.06, metal);
    B.box(0, 1.32, 0.32, 0.4, 0.14, 0.08, { tex: 'chair_mesh' });
    for (const side of [-1, 1]) {
      B.box(side * 0.34, 0.47, 0.08, 0.035, 0.23, 0.035, metal);
      B.box(side * 0.34, 0.7, 0.05, 0.08, 0.035, 0.34, metal);
    }
    for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) B.at(0, 0, 0, yaw, () => {
      B.box(0, 0.1, 0.18, 0.06, 0.045, 0.38, metal);
      B.box(0, 0.025, 0.34, 0.1, 0.075, 0.09, metal);
    });
  });
  foot(deskX, 40.25, 0.9, 0.95);

  B.box(12.2, floor + 0.004, 46.6, 3.7, 0.016, 3.7, linen);
  for (const offsetX of [-1.04, 1.04]) {
    for (const offsetZ of [-0.23, 0.23]) B.box(12.2 + offsetX, floor + 0.03, 47.7 + offsetZ, 0.055, 0.32, 0.055, metal);
  }
  B.box(12.2, floor + 0.32, 47.7, 2.5, 0.09, 0.7, walnut);
  for (const offset of [-0.62, 0.62]) B.box(12.2 + offset, floor + 0.41, 47.7, 1.21, 0.1, 0.65, green);
  B.box(12.2, floor + 0.51, 48.01, 2.5, 0.49, 0.12, green);
  B.box(11.3, floor + 0.52, 47.91, 0.38, 0.3, 0.1, linen, { ry: 0.15 });
  foot(12.2, 47.7, 2.6, 0.85);
  for (const offset of [-0.62, 0.62]) addRestPoint({ id: `lehun-sofa-${offset}`, name: '乐魂沙发', en: 'LeHun sofa', x: 12.2 + offset, y: floor + 0.51, z: 47.65, floor, yaw: Math.PI });
  B.box(12.2, floor + 0.42, 45.6, 1.25, 0.05, 0.6, wood);
  for (const offsetX of [-0.51, 0.51]) {
    for (const offsetZ of [-0.21, 0.21]) B.box(12.2 + offsetX, floor + 0.02, 45.6 + offsetZ, 0.045, 0.4, 0.045, metal);
  }
  B.box(12.1, floor + 0.47, 45.6, 0.34, 0.025, 0.25, green);
  B.box(12.1, floor + 0.495, 45.6, 0.3, 0.008, 0.22, paper);
  foot(12.2, 45.6, 1.35, 0.7);
  B.box(10.25, floor + 0.03, 48.35, 0.34, 0.38, 0.34, { tex: 'terracotta', tint: 0xc0a48b });
  B.box(10.25, floor + 0.39, 48.35, 0.38, 0.06, 0.38, wood);
  for (const [offsetX, height, offsetZ, yaw] of [[-0.2, 0.86, 0.02, -0.4], [0.15, 1.1, -0.08, 0.4], [-0.05, 1.4, 0.1, -0.2]]) {
    B.box(10.25 + offsetX * 0.3, floor + 0.45, 48.35 + offsetZ, 0.025, height - 0.42, 0.025, walnut);
    B.box(10.25 + offsetX, floor + height, 48.35 + offsetZ, 0.4, 0.12, 0.24, { tex: 'leaves_olive' }, { rz: yaw });
  }
  foot(10.25, 48.35, 0.58, 0.58);

  for (const z of [39, 41, 43, 45, 47, 49]) B.box(14.91, floor, z, 0.045, 1.05, 0.045, metal);
  B.box(14.91, floor + 1.02, 43.8, 0.09, 0.06, 10.5, walnut);
  B.box(14.91, floor + 0.16, 43.8, 0.04, 0.035, 10.5, metal);
  foot(14.91, 43.8, 0.14, 10.6);

  for (const [index, z] of [41.1, 45.5].entries()) {
    for (const x of [10.75, 13.25]) B.box(x, floor + 4.38, z, 0.025, 3.57, 0.025, metal);
    B.box(12, floor + 4.3, z, 3.8, 0.08, 0.34, metal);
    B.box(12, floor + 4.275, z, 3.57, 0.025, 0.24, glow);
    for (const [side, x] of [10.9, 13.1].entries()) bake(`trading-ceiling-${index}-${side}`, x, floor + 4.2, z, 1.8, 7, [0, -1, 0]);
  }
  B.box(15.7, floor + 3.05, 37.3, 0.6, 0.09, 0.6, metal);
  B.box(15.7, floor + 3.025, 37.3, 0.48, 0.025, 0.48, glow);
  B.box(15.7, floor + 3.14, 37.3, 0.03, 4.8, 0.03, metal);
  bake('trading-stair-landing', 15.7, floor + 2.98, 37.3, 1.3, 5, [0, -1, 0]);
  B.box(12.2, floor + 1.1, 49.31, 2.9, 0.035, 0.05, glow);
  bake('trading-lounge-fill', 12.2, floor + 1.2, 49.05, 0.7, 4.5, [0, 0.2, -1]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  const panels = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: createTradingArt() }));
  panels.name = 'lehun-trading-displays';
  return panels;
}
