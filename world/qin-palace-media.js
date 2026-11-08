import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { createQinQuestStory } from './qin-quest-story.js';
import { addRestPoint } from './rest-points.js';

const STONE = { tex: 'travertine', tint: 0xd2cdbc };
const WOOD = { tex: 'wood_panel', tint: 0x96785b };
const BRONZE = { tex: 'paint', tint: 0xb7a17a };
const INK = { tex: 'paint', tint: 0x243d42 };
const PALE = { tex: 'paint', tint: 0xe9dfc5 };
const SAGE = { tex: 'paint', tint: 0x82998c };
const WATER = { tex: 'water', tint: 0x599b9d, emissive: 0.12 };

export function buildQinPalaceMedia({ architecture, batch, layer, materials, bakes, obstacles, solids }) {
  const root = new THREE.Group(); root.name = 'qin-palace-media';
  const positions = [], coordinates = [], indices = [];
  let role = 'cinema';
  const box = (feature, x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-${role}:${feature}` });
  function solid(x, y, z, width, height, depth, floor) {
    const bounds = { x0: x - width / 2 - 0.035, x1: x + width / 2 + 0.035,
      z0: z - depth / 2 - 0.035, z1: z + depth / 2 + 0.035, y0: y, y1: y + height };
    solids.push(bounds); obstacles.push({ ...bounds, floor });
  }
  function panel(leftX, leftZ, rightX, rightZ, bottom, top, start, end, low, high) {
    const vertex = positions.length / 3;
    positions.push(leftX, bottom, leftZ, rightX, bottom, rightZ, rightX, top, rightZ, leftX, top, leftZ);
    coordinates.push(start, low, end, low, end, high, start, high);
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
  }
  const arc = [];
  for (let segment = 0; segment <= 24; segment++) {
    const angle = -Math.PI / 2 + segment * Math.PI / 24;
    arc.push({ x: 150 + Math.sin(angle) * 7, z: -28 - Math.cos(angle) * 4 });
  }
  for (let segment = 0; segment < 24; segment++) {
    const left = arc[segment], right = arc[segment + 1];
    const across = right.x - left.x, along = right.z - left.z, length = Math.hypot(across, along);
    const yaw = -Math.atan2(along, across), column = (left.x + right.x) / 2, row = (left.z + right.z) / 2;
    batch.at(column, 3.55, row, yaw, () => {
      box('screen-back', 0, 0, -0.13, length + 0.015, 3.12, 0.18, INK);
      for (const height of [0, 3.02]) box('screen-frame', 0, height, 0.015, length + 0.01, 0.1, 0.1, BRONZE);
    });
    solid(column, 3.55, row, Math.abs(across) + 0.22, 3.12, Math.abs(along) + 0.22, 3);
    panel(left.x, left.z, right.x, right.z, 3.66, 6.55, segment / 24, (segment + 1) / 24, 0.004, 0.496);
  }
  for (const column of [143, 157]) box('screen-end', column, 3.55, -28, 0.12, 3.12, 0.14, BRONZE);
  for (const row of [-23.1, -24.7, -26.3]) for (const column of [144.6, 145.9, 147.2, 151.2, 152.5, 153.8]) {
    for (const side of [-1, 1]) box('seat-leg', column + side * 0.24, 3, row, 0.1, 0.36, 0.46, WOOD);
    box('seat', column, 3.36, row, 0.7, 0.09, 0.65, { tex: 'leather', tint: 0x82958c });
    box('seat-back', column, 3.45, row + 0.29, 0.7, 0.52, 0.12, WOOD);
    for (const side of [-1, 1]) box('armrest', column + side * 0.35, 3.59, row, 0.08, 0.08, 0.58, BRONZE);
    solid(column, 3, row, 0.78, 0.97, 0.71, 3);
    addRestPoint({ id: `qin-cinema-seat-${column}-${row}`, name: '环幕影院 · 沉浸观影', en: 'Cinema · Immersive screening',
      x: column, y: 3.45, z: row, floor: 3, yaw: Math.PI });
  }
  for (const column of [148.25, 150.15]) box('aisle-light', column, 3.012, -24.6, 0.07, 0.016, 5.8, { tex: 'paint', tint: 0xe7cf93, emissive: 0.4 });
  for (const column of [144, 150, 156]) bakes.push({ id: `qin-cinema-${column}`, position: [column, 5.6, -29], power: 0.85, radius: 8, direction: null });
  architecture.sign('环幕影院', 149, 6.1, -21.2, 4.5, 0.75, Math.PI);

  role = 'panorama';
  function boat(source, x, y, z, scale = 1, sails = true) {
    source.box(x, y, z, 1.8 * scale, 0.16 * scale, 0.62 * scale, WOOD);
    source.box(x, y + 0.16 * scale, z, 1.5 * scale, 0.08 * scale, 0.72 * scale, BRONZE);
    for (const side of [-1, 1]) source.box(x + side * 0.88 * scale, y + 0.1 * scale, z, 0.22 * scale, 0.22 * scale, 0.44 * scale, WOOD);
    if (!sails) {
      for (const offset of [-0.5, 0, 0.5]) source.box(x + offset * scale, y + 0.24 * scale, z, 0.06 * scale, 0.15 * scale, 0.65 * scale, PALE);
      return;
    }
    for (const side of [-1, 1]) {
      const mast = x + side * 0.4 * scale;
      source.box(mast, y + 0.24 * scale, z, 0.055 * scale, 1.2 * scale, 0.055 * scale, WOOD);
      source.box(mast + 0.17 * scale, y + 0.6 * scale, z, 0.6 * scale, 0.65 * scale, 0.045 * scale, PALE);
      for (const height of [0.65, 0.85, 1.05]) source.box(mast + 0.17 * scale, y + height * scale, z + 0.03 * scale, 0.6 * scale, 0.025 * scale, 0.025 * scale, BRONZE);
      source.box(mast + 0.14 * scale, y + 1.35 * scale, z, 0.3 * scale, 0.12 * scale, 0.035 * scale, { tex: 'paint', tint: 0xa6533e });
    }
  }
  const columns = [145, 151.5, 158, 164.5, 171];
  for (const [index, column] of columns.entries()) {
    box('display-base', column, 7, -44.6, 5.3, 0.24, 1.8);
    box('display-band', column, 7.17, -43.685, 5.05, 0.055, 0.04, BRONZE);
    box('display-back', column, 7.68, -45.75, 5.4, 2.15, 0.2, WOOD);
    panel(column - 2.55, -45.63, column + 2.55, -45.63, 7.85, 9.66, index / 5, (index + 1) / 5, 0.504, 0.996);
    solid(column, 7, -44.6, 5.4, 2.83, 2.5, 7);
    box('display-water', column, 7.24, -44.6, 5, 0.03, 1.5, WATER);
    if (index === 0 || index === 3) {
      for (let step = 0; step < 3; step++) box('coastal-rock', column - 0.6, 7.27 + step * 0.18, -44.55, 2.7 - step * 0.65, 0.2, 1.1 - step * 0.2, { tex: 'stone', tint: 0xb3b8a9 });
      if (index === 0) {
        for (const side of [-1, 1]) box('lookout-post', column - 0.6 + side * 0.35, 7.87, -44.55, 0.08, 0.5, 0.08, WOOD);
        box('lookout-roof', column - 0.6, 8.37, -44.55, 1.1, 0.12, 0.7, SAGE);
      } else {
        for (const offset of [-1.3, 0, 1.3]) {
          box('island-tree', column + offset, 7.65, -44.5, 0.06, 0.6, 0.06, WOOD);
          box('island-canopy', column + offset, 8, -44.5, 0.55, 0.3, 0.45, SAGE);
        }
      }
    } else if (index === 1) {
      boat(batch, column, 7.32, -44.4, 1, false);
      for (const side of [-1, 1]) box('shipyard-post', column + side * 1.2, 7.27, -44.6, 0.1, 1, 0.1, WOOD);
      box('shipyard-beam', column, 8.27, -44.6, 2.6, 0.12, 0.12, WOOD);
    } else if (index === 2) {
      boat(batch, column - 0.9, 7.3, -44.45, 0.8); boat(batch, column + 1.1, 7.3, -44.6, 0.55);
    } else {
      box('harbor', column, 7.27, -44.8, 3.7, 0.12, 0.5, WOOD);
      for (const offset of [-1.6, -0.8, 0, 0.8, 1.6]) box('harbor-post', column + offset, 7.27, -44.55, 0.08, 0.4, 0.08, WOOD);
      boat(batch, column + 0.6, 7.3, -44.05, 0.65);
    }
    bakes.push({ id: `qin-panorama-${index}`, position: [column, 9.2, -43.1], power: 0.75, radius: 7, direction: null });
  }
  box('table-base', 159, 7, -39.5, 7.8, 0.64, 2.8, STONE);
  box('table-water', 159, 7.64, -39.5, 7.5, 0.05, 2.5, WATER);
  for (const side of [-1, 1]) {
    box('table-rim', 159, 7.64, -39.5 + side * 1.34, 7.8, 0.13, 0.12, BRONZE);
    box('table-rim', 159 + side * 3.84, 7.64, -39.5, 0.12, 0.13, 2.56, BRONZE);
  }
  solid(159, 7, -39.5, 7.8, 0.77, 2.8, 7);
  const shipBatch = new BoxBatch(layer);
  boat(shipBatch, -0.7, 0, 0.2, 1); boat(shipBatch, 1.4, 0, -0.5, 0.65);
  const vessels = new THREE.Group(); vessels.name = 'qin-panorama-vessels';
  for (const mesh of shipBatch.build(materials)) vessels.add(mesh);
  vessels.position.set(159, 7.72, -39.5); root.add(vessels);
  architecture.sign('动态全景馆', 159, 9.95, -45.4, 7, 0.6);
  bakes.push({ id: 'qin-panorama-table', position: [159, 9.6, -39.5], power: 0.9, radius: 8, direction: null });

  const imagery = createQinQuestStory(), geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  const screen = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: imagery.texture, toneMapped: false }));
  screen.name = 'qin-voyage-screens'; screen.userData.frames = 1; screen.userData.cinemaSegments = 24; screen.userData.galleryPanels = 5;
  root.add(screen);
  const cinemaBounds = new THREE.Box3(new THREE.Vector3(142.8, 3.5, -32.3), new THREE.Vector3(157.2, 6.7, -27.8));
  const galleryBounds = new THREE.Box3(new THREE.Vector3(142, 7, -46), new THREE.Vector3(174, 10.7, -38));
  const center = new THREE.Vector3(159, 7, -35);
  let time = 0, elapsed = 0;
  return {
    root, screen, vessels, story: imagery,
    restart() { time = elapsed = 0; imagery.draw(0); screen.userData.frames++; },
    update(dt, camera, frustum, immersive = false) {
      if (!immersive && camera.position.distanceToSquared(center) > 2500) return;
      const cinemaVisible = immersive || frustum.intersectsBox(cinemaBounds), galleryVisible = !immersive && frustum.intersectsBox(galleryBounds);
      if (!cinemaVisible && !galleryVisible) return;
      time += Math.min(dt, 0.1); elapsed += dt;
      if (galleryVisible) {
        vessels.position.x = 159 + Math.sin(time * 0.24) * 0.65;
        vessels.position.y = 7.72 + Math.sin(time * 1.1) * 0.025;
        vessels.rotation.x = Math.sin(time * 0.8) * 0.025;
      }
      if (elapsed < 0.125) return;
      elapsed %= 0.125; imagery.draw(time); screen.userData.frames++;
    },
  };
}
