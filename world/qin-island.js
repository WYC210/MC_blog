import * as THREE from 'three';
import { createQinPalaceStructure } from './qin-palace-structure.js';
import { BoxBatch } from '@engine/world/blocks.js';
import { createInteriorLighting } from '@engine/world/lighting.js';
import { QIN_ISLAND, QIN_DOCK, QIN_PALACE, QIN_GALLERY, QIN_POND, QIN_ATTRACTIONS, QIN_STATIONS, QIN_LIGHT_VOLUME, QIN_COURTYARD, QIN_RELIEF_WALLS, QIN_STATE_FLAGS, qinLandAt } from './qin-island-layout.js';
import { createQinArchitecture } from './qin-architecture.js';
import { buildQinRelief } from './qin-reliefs.js';
import { buildWarringGateway, buildJixiaAcademy } from './qin-academy.js';
import { buildYiRiverFarewell } from './qin-warriors.js';
import { buildBianQueHealing } from './qin-bianque.js';
import { buildHanFeiHall } from './qin-hanfei.js';
import { buildQinGateway } from './qin-gateway.js';
import { buildQinEmperor } from './qin-emperor.js';
import { buildQinEastStatues } from './qin-east-statues.js';
import { buildQinGardenLandmarks } from './qin-garden-landmarks.js';
import { buildQinCoastalLandmarks } from './qin-coastal-landmarks.js';
import { buildQinWaterwheel } from './qin-waterwheel.js';
import { buildQinDistanceDetail } from './qin-distance-detail.js';
import { buildQinPalaceMedia } from './qin-palace-media.js';
import { buildQinGreatWall } from './qin-great-wall.js';
import { createQinGreatWallGuide } from './qin-great-wall-guide.js';
import { createQinPalaceFloor } from './qin-palace-floor.js';
import { createQinCinema } from './qin-cinema.js';
import { buildQinWanderingEmperor, bindQinEncounterActors } from './qin-encounter-actors.js';
import { createQinEmperorEncounter } from './qin-emperor-encounter.js';
import { QIN_WARRIORS, QIN_HANFEI, QIN_COURTYARD_GATE, qinFloorAt } from './qin-island-layout.js';

function buildLabels(labels) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const context = canvas.getContext('2d');
  const positions = [], coordinates = [], indices = [];
  const transform = new THREE.Matrix4(), point = new THREE.Vector3();
  labels.forEach((label, index) => {
    const column = index % 4 * 128, row = Math.floor(index / 4) * 32;
    const banner = label.kind === 'banner', tileWidth = banner ? 32 : 128;
    context.fillStyle = banner ? '#8f3932' : '#332820'; context.fillRect(column, row, tileWidth, 32);
    context.strokeStyle = '#9a7f4d'; context.strokeRect(column + 2, row + 2, tileWidth - 4, 28);
    context.fillStyle = banner ? '#ffe0a3' : '#ead4a0'; context.font = `bold ${banner ? 24 : 16}px "Microsoft YaHei", sans-serif`;
    context.textAlign = 'center'; context.textBaseline = banner ? 'alphabetic' : 'middle';
    const metrics = banner ? context.measureText(label.text) : null;
    const baseline = row + 16 + (metrics ? (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2 : 0);
    context.fillText(label.text, column + tileWidth / 2, baseline, banner ? 24 : 118);
    transform.makeRotationY(label.yaw).setPosition(label.x, label.y, label.z);
    for (const [horizontal, vertical] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      point.set(horizontal * label.width / 2, vertical * label.height / 2, 0).applyMatrix4(transform);
      positions.push(point.x, point.y, point.z);
      coordinates.push((column + (horizontal + 1) * tileWidth / 2) / 512, 1 - (row + (1 - vertical) * 16) / 512);
    }
    const vertex = index * 4;
    indices.push(vertex, vertex + 1, vertex + 2, vertex, vertex + 2, vertex + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setIndex(indices);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
  mesh.name = 'qin-inscriptions';
  mesh.userData.labels = labels;
  return mesh;
}

export function buildQinIsland({ grid, layer, materials, obstacles, hotspots }) {
  grid.define('qin-grass', { tex: { top: 'grass_top', side: 'dirt' }, tint: 0xc3c5ab, merge: true, map: '#7d9666' });
  grid.define('qin-sand', { tex: { all: 'sand' }, merge: true, map: '#d5c8a7' });
  grid.define('qin-rock', { tex: { all: 'stone' }, merge: true, map: '#858681' });
  grid.define('qin-path', { tex: { all: 'pavers' }, tint: 0xc6beb0, merge: true, map: '#b3afa6' });
  grid.define('qin-dock-deck', { tex: { all: 'deck' }, merge: true, map: '#bd956a' });
  grid.define('qin-plinth', { tex: { all: 'travertine' }, tint: 0xc9c3b6, merge: true, map: '#bdb7aa' });
  grid.define('qin-plaster', { tex: { all: 'plaster' }, tint: 0xe6dfcd, merge: true, map: '#ded6c3' });
  const groupName = 'qin-ground';
  for (let column = QIN_ISLAND.x0; column < QIN_ISLAND.x1; column++) {
    for (let row = QIN_ISLAND.z0; row < QIN_ISLAND.z1; row++) {
      if (!qinLandAt(column + 0.5, row + 0.5)) continue;
      const edge = Math.min(column - QIN_ISLAND.x0, QIN_ISLAND.x1 - column, row - QIN_ISLAND.z0, QIN_ISLAND.z1 - row);
      grid.fill(column, -4, row, column + 1, -1, row + 1, 'qin-rock', groupName);
      grid.set(column, -1, row, edge < 5 ? 'qin-sand' : 'qin-grass', groupName);
    }
  }
  const path = (x0, z0, x1, z1) => {
    for (let column = x0; column < x1; column++) for (let row = z0; row < z1; row++) {
      if (qinLandAt(column + 0.5, row + 0.5)) grid.set(column, -1, row, 'qin-path', groupName);
    }
  };
  path(85, 15, 102, 22); path(97, 16, 102, 67); path(98, 62, 222, 67);
  path(136, 60, 184, 71);
  path(143, 45, 149, 64); path(171, 45, 177, 64);
  path(154, -64, 166, 68); path(133, 20, 187, 47); path(140, -7, 180, 22);
  path(106, -66, 118, 45); path(119, 41, 199, 46); path(185, -65, 190, 61);
  path(121, -24, 140, -19); path(100, -68, 229, -63); path(224, -66, 230, 66);
  path(185, -24, 229, -19); path(199, -20, 215, 40); path(190, 49, 222, 61);
  path(205, -63, 210, -55);
  path(QIN_COURTYARD.x0, QIN_COURTYARD.z0, QIN_COURTYARD.x1, QIN_COURTYARD.z1);
  path(121, QIN_COURTYARD.z0 - 7, 125, QIN_COURTYARD.z1 + 5);
  path(98, QIN_HANFEI.z - 8, 127, QIN_HANFEI.z - 5);
  path(98, QIN_HANFEI.z - 7, 101, QIN_COURTYARD.z1 + 5);
  path(123, QIN_HANFEI.z - 7, 127, QIN_COURTYARD.z0 - 3);
  path(99, QIN_HANFEI.z + 10, 126, QIN_HANFEI.z + 15);
  path(109, QIN_HANFEI.z + 5, 115, QIN_HANFEI.z + 15);
  path(124, 18, 134, 30);
  grid.fill(QIN_PALACE.x0, 0, QIN_PALACE.z0, QIN_PALACE.x1, 3, QIN_PALACE.z1, 'qin-plinth', groupName);
  for (const [x0, z0, x1, z1] of [[137.5, -51.5, 138, -14.5], [182, -51.5, 182.5, -14.5], [138, -51.5, 182, -51], [138, -15, 156, -14.5], [164, -15, 182, -14.5], [155.5, -15, 156, -6], [164, -15, 164.5, -6]]) {
    obstacles.push({ x0, x1, z0, z1, floor: 0 });
  }

  const batch = new BoxBatch(layer), labels = [], bakes = [], solids = [];
  const root = new THREE.Group(); root.name = 'qin-sanctuary';
  let media = null, greatWall = null, watermill = null;
  let gallerySlab = null;
  const palaceStairs = [];
  const palaceRoof = new THREE.Group(); palaceRoof.name = 'qin-palace-roof';
  const roofBatch = new BoxBatch(layer);
  const roofBuilder = createQinArchitecture({ batch: roofBatch, labels, obstacles, solids });
  const architecture = createQinArchitecture({ batch, labels, obstacles, solids });
  const { box, block, sign, roof, railing, person, horse, wheel, pine, looks } = architecture;
  const { STONE, PALE, WOOD, GOLD, BRONZE, DARK } = looks;
  const attraction = id => QIN_ATTRACTIONS.find(item => item.id === id);
  function lamp(x, z, y = 0, height = 2.4) {
    box(x, y, z, 0.3, 0.16, 0.3, STONE);
    box(x, y + 0.16, z, 0.12, height, 0.12, DARK);
    box(x, y + height - 0.2, z, 0.42, 0.55, 0.42, { tex: 'paint', tint: 0xffdc9f, emissive: 0.75 });
    box(x, y + height + 0.36, z, 0.62, 0.12, 0.62, DARK);
    bakes.push({ id: `qin-lamp-${bakes.length}`, position: [x, y + height, z], power: 0.85, radius: 8, direction: null });
  }
  function flood(x, y, z, power = 1.1, radius = 14) {
    bakes.push({ id: `qin-flood-${bakes.length}`, position: [x, y, z], power, radius, direction: null });
  }
  function sculptureLight(id, x, z, power = 1.6, radius = 10) {
    box(x, 0.12, z, 0.5, 0.18, 0.34, { tex: 'paint', tint: 0x958169 });
    box(x, 0.3, z, 0.38, 0.06, 0.24, { tex: 'paint', tint: 0xffdcaa, emissive: 0.65 });
    bakes.push({ id, position: [x, 0.65, z], power, radius, direction: null });
  }
  function plaque(name, x, z) {
    block(x, 0, z, 3.5, 0.75, 0.4, STONE);
    sign(name, x, 0.18, z + 0.22, 3.1, 0.5);
  }
  function gate() {
    buildQinGateway({ architecture, batch, bakes, obstacles, solids });
  }
  function procession() {
    const clay = { tex: 'paint', tint: 0xd0b696 };
    const face = { tex: 'paint', tint: 0xe1c7a3 };
    const horseStone = { tex: 'paint', tint: 0xb7b8ad };
    const bronzeTrim = { tex: 'paint', tint: 0x958169 };
    const chariot = { tex: 'paint', tint: 0xc0a67e };
    const canopy = { tex: 'paint', tint: 0x9da7a4 };
    block(160, 0, 33, 40, 0.8, 5, STONE);
    for (let rock = 0; rock < 20; rock++) box(141 + rock * 2, 0.8, 33, 2.1, 0.55 + rock % 3 * 0.16, 4.5, { tex: 'stone', tint: 0x9b968b }, { ry: rock % 2 * 0.12 });
    for (let index = 0; index < 20; index++) horse(142 + Math.floor(index / 2) * 3.7, 1.35, 32 + index % 2 * 2, 1.1, Math.PI / 2, horseStone, bronzeTrim);
    for (let index = 0; index < 32; index++) {
      const column = 141 + index % 16 * 2.45, row = 31.2 + Math.floor(index / 16) * 3.7;
      person(column, 1.35, row, 1.15, clay, index % 4 ? 'guard' : 'court', Math.PI / 2, { face, trim: bronzeTrim, actor: `qin-retinue:${index}` });
    }
    for (const column of [151, 169]) {
      box(column, 2.1, 33, 2.6, 0.45, 3.5, chariot);
      box(column, 2.5, 33, 0.25, 2.7, 0.25, chariot);
      roof(column, 5, 33, 3.1, 3.3, 0.75, { surface: canopy, ridge: chariot, trim: bronzeTrim });
      wheel(column, 1.7, 31.15, 0.85, 0, chariot);
      wheel(column, 1.7, 34.85, 0.85, 0, chariot);
    }
    for (const column of [143, 151.5, 160, 168.5, 177]) for (const side of [-1, 1]) {
      sculptureLight(`qin-procession-${column}-${side}`, column, 33 + side * 2.8);
    }
    plaque('始皇碣石行', 160, 37);
  }
  function emperor() {
    buildQinEmperor({ architecture, batch, bakes, obstacles, solids });
    plaque('千古一帝 · 面海求仙', 160, 17);
  }
  function palace() {
    for (let step = 0; step < 18; step++) palaceStairs.push(box(160, 0, -6.25 - step * 0.5, 8, (step + 1) / 6, 0.5, STONE));
    for (let step = 0; step < 24; step++) palaceStairs.push(box(178.5, 3, -23.25 - step * 0.5, 5, (step + 1) / 6, 0.5, STONE));
    gallerySlab = box((QIN_GALLERY.x0 + QIN_GALLERY.x1) / 2, QIN_GALLERY.floor - 0.25, (QIN_GALLERY.z0 + QIN_GALLERY.z1) / 2,
      QIN_GALLERY.x1 - QIN_GALLERY.x0, 0.25, QIN_GALLERY.z1 - QIN_GALLERY.z0, STONE);
    for (const column of [140, 146, 153, 167, 174, 180]) {
      block(column, 3, -18, 0.65, 7.4, 0.65, WOOD, 3);
      box(column, 10.4, -18, 1.1, 0.45, 1.1, GOLD);
    }
    for (const [x0, y0, z0, x1, y1, z1] of [
      [140, 3, -48, 141, 11, -27],
      [140, 3, -24, 141, 11, -19],
      [140, 6, -27, 141, 11, -24],
      [181, 3, -48, 182, 11, -19],
      [140, 3, -48, 182, 11, -47],
    ]) {
      grid.fill(x0, y0, z0, x1, y1, z1, 'qin-plinth', groupName);
      solids.push({ x0, y0, z0, x1, y1, z1 });
    }
    function windowPanel(x, y, z, yaw, width = 3.1, height = 1.8) {
      batch.at(x, y, z, yaw, () => {
        box(0, 0, 0, width, height, 0.12, WOOD);
        box(0, 0.16, 0.08, width - 0.3, height - 0.32, 0.06, { tex: 'paint', tint: 0x38494c });
        for (const side of [-1, 1]) box(side * (width / 2 - 0.1), 0, 0.13, 0.15, height, 0.14, WOOD);
        for (let bar = -width / 2 + 0.4; bar < width / 2 - 0.2; bar += 0.42) box(bar, 0.18, 0.14, 0.07, height - 0.36, 0.09, GOLD);
        for (const rail of [0.18, height / 2, height - 0.26]) box(0, rail, 0.14, width - 0.3, 0.08, 0.09, WOOD);
        box(0, -0.16, 0.03, width + 0.4, 0.16, 0.3, PALE);
        box(0, height, 0, width + 0.3, 0.18, 0.26, WOOD);
      });
    }
    for (const column of [145, 152, 160, 168, 177]) for (const height of [4, 8]) {
      windowPanel(column, height, -48.03, Math.PI);
      windowPanel(column, height, -46.97, 0);
    }
    for (const row of [-43, -36, -29, -22]) for (const height of [4, 8]) {
      windowPanel(182.03, height, row, Math.PI / 2);
      windowPanel(180.97, height, row, -Math.PI / 2);
      windowPanel(139.97, height, row, -Math.PI / 2);
      windowPanel(141.03, height, row, Math.PI / 2);
    }
    for (const height of [3.16, 6.8, 10.5]) {
      box(161, height, -48.06, 42.3, 0.22, 0.25, STONE);
      for (const column of [139.94, 182.06]) {
        if (height < 6) {
          for (const [row, depth] of [[-37.5, 21], [-21.5, 5]]) box(column, height, row, 0.25, 0.22, depth, STONE);
        } else box(column, height, -33.5, 0.25, 0.22, 29.3, STONE);
      }
    }
    for (const column of [140.15, 148.5, 156.5, 164.5, 172.5, 181.85]) box(column, 3.4, -48.09, 0.32, 7.1, 0.25, WOOD);
    for (const column of [139.91, 182.09]) for (const row of [-47.7, -39.5, -32.5, -26.9, -24.1, -19.2]) box(column, 3.4, row, 0.25, 7.1, 0.3, WOOD);
    for (const row of [-27, -24]) box(140.5, 3, row, 1.18, 3, 0.14, WOOD);
    box(140.5, 5.95, -25.5, 1.18, 0.2, 3.15, WOOD);
    for (const [x0, y0, x1, y1] of [[141, 3, 156, 11], [164, 3, 181, 11], [156, 7, 164, 11]]) {
      grid.fill(x0, y0, -21, x1, y1, -20, 'qin-plaster', groupName);
      solids.push({ x0, y0, z0: -21, x1, y1, z1: -20 });
    }
    for (const column of [143.5, 149, 153.5, 166.5, 172, 177.5]) for (const height of [4.1, 8]) {
      windowPanel(column, height, -19.97, 0, 3.1, 1.8);
      windowPanel(column, height, -21.03, Math.PI, 3.1, 1.8);
    }
    for (const column of [141.2, 146.2, 151.5, 155.8, 164.2, 169.2, 174.5, 180.8]) box(column, 3, -19.85, 0.24, 7.8, 0.24, WOOD);
    for (const height of [3.2, 6.85, 10.55]) {
      box(148.5, height, -19.85, 15, 0.18, 0.24, WOOD);
      box(172.5, height, -19.85, 17, 0.18, 0.24, WOOD);
    }
    box(160, 6.95, -19.85, 8.2, 0.32, 0.32, WOOD);
    box(160, 10.55, -19.85, 8.2, 0.18, 0.24, WOOD);
    for (const side of [-1, 1]) {
      const column = 160 + side * 3.7;
      block(column, 3, -21.9, 0.18, 3.8, 1.8, WOOD, 3);
      for (const edge of [-22.7, -21.1]) box(column - side * 0.12, 3.15, edge, 0.08, 3.5, 0.1, GOLD);
      for (const height of [3.2, 4.35, 5.5, 6.65]) box(column - side * 0.12, height, -21.9, 0.08, 0.08, 1.6, GOLD);
      box(column - side * 0.17, 4.6, -22.45, 0.1, 0.3, 0.25, GOLD);
    }
    for (const column of [140, 146, 153, 167, 174, 180]) {
      box(column, 9.9, -19, 0.48, 0.28, 2.5, WOOD);
      for (const side of [-1, 1]) box(column + side * 0.55, 9.35, -18, 1.15, 0.25, 0.38, WOOD, { rz: side * 0.42 });
    }
    box(160, 10.2, -18, 41, 0.42, 0.58, WOOD);
    box(160, 8.15, -18, 14, 0.28, 0.42, WOOD);
    sign('求仙殿', 160, 8.45, -17.65, 5.5, 1.1);
    roofBuilder.roof(160, 10.8, -33, 45, 33, 3.1);
    roofBuilder.box(160, 13.8, -34, 29, 3.3, 17, { tex: 'plaster', tint: 0xe6dfcd });
    roofBuilder.box(160, 13.55, -24.6, 30, 0.25, 2.3, WOOD);
    roofBuilder.railing(160, 13.8, -23.6, 29, 0, WOOD);
    for (const column of [146, 151.5, 157, 163, 168.5, 174]) {
      roofBuilder.box(column, 13.8, -24, 0.3, 3.3, 0.3, WOOD);
      roofBuilder.box(column, 12.5, -24.7, 0.32, 1.15, 0.34, WOOD);
      roofBuilder.box(column, 16.75, -24.8, 0.4, 0.28, 1.9, WOOD);
    }
    for (const column of [148.8, 154.5, 160, 165.5, 171.2]) {
      roofBuilder.box(column, 14.6, -25.4, 3.2, 1.65, 0.12, WOOD);
      roofBuilder.box(column, 14.78, -25.3, 2.85, 1.29, 0.06, { tex: 'paint', tint: 0x38494c });
      for (const offset of [-1, -0.5, 0, 0.5, 1]) roofBuilder.box(column + offset, 14.78, -25.23, 0.07, 1.29, 0.08, GOLD);
      roofBuilder.box(column, 15.4, -25.22, 2.85, 0.1, 0.1, WOOD);
    }
    roofBuilder.box(160, 16.85, -24, 29, 0.25, 0.4, WOOD);
    roofBuilder.roof(160, 17.1, -34, 33, 21, 2.5);
    railing(147, 3, -15, 16); railing(173, 3, -15, 16);
    railing(138, 3, -33, 34, Math.PI / 2);
    railing(159, 7, -35, 31);
    for (let index = 0; index < 24; index++) {
      const column = 143 + index * 1.42;
      box(column, 3, -49, 0.14, 2.5, 0.14, WOOD);
      for (let face = 0; face < 4; face++) box(column, 3.45, -49, 0.66, 1.5, 0.66, BRONZE, { ry: face * Math.PI / 4 });
      for (const bottom of [3.6, 4.2, 4.8]) box(column, bottom, -48.64, 0.5, 0.08, 0.04, GOLD);
    }
    sign('望海祈福圆梦轮', 160, 6.1, -48.2, 9, 0.8, Math.PI);
    media = buildQinPalaceMedia({ architecture, batch, layer, materials, bakes, obstacles, solids });
    root.add(media.root);
    greatWall = buildQinGreatWall({ architecture, batch, layer, materials, bakes, obstacles, solids, hotspots });
    root.add(greatWall.root);
    for (const column of [145, 160, 177]) {
      flood(column, 6, -22, 1.1, 12); flood(column, 9, -43, 0.8, 10);
      flood(column, 11, -17, 0.45, 10);
    }
  }
  function sideGardens() {
    const figureStone = { tex: 'paint', tint: 0xcfb596 };
    const figurePalette = {
      face: { tex: 'paint', tint: 0xefd5b2 },
      trim: { tex: 'paint', tint: 0x948069 },
      detail: { tex: 'paint', tint: 0x5e5146 },
    };
    buildJixiaAcademy({ architecture, batch, bakes, obstacles, solids });
    buildHanFeiHall({ architecture, batch, obstacles, solids, bakes });
    for (const wall of QIN_RELIEF_WALLS) {
      const across = Math.abs(Math.cos(wall.yaw)), along = Math.abs(Math.sin(wall.yaw));
      block(wall.x, 0, wall.z, across * wall.length + along * 0.5, 4.7, along * wall.length + across * 0.5, STONE);
      buildQinRelief(batch, wall);
      batch.at(wall.x, 0, wall.z, wall.yaw, () => {
        box(0, 4.7, 0, wall.length + 0.2, 0.3, 0.9, looks.ROOF);
      });
      const exhibitX = wall.x + Math.sin(wall.yaw) * 1.4, exhibitZ = wall.z + Math.cos(wall.yaw) * 1.4;
      const width = across * 15.5 + along * 2.4, depth = along * 15.5 + across * 2.4;
      const bounds = { x0: exhibitX - width / 2, x1: exhibitX + width / 2, z0: exhibitZ - depth / 2, z1: exhibitZ + depth / 2, y0: 0, y1: 4.6 };
      solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
      for (const offset of [-4, 4]) {
        sculptureLight(`qin-relief-${wall.id}-${offset}`, wall.x + Math.cos(wall.yaw) * offset + Math.sin(wall.yaw) * 2.9, wall.z - Math.sin(wall.yaw) * offset + Math.cos(wall.yaw) * 2.9, 1.7, 10);
      }
      const plaqueDepth = 3.3;
      const plaqueX = wall.x + Math.sin(wall.yaw) * plaqueDepth, plaqueZ = wall.z + Math.cos(wall.yaw) * plaqueDepth;
      block(plaqueX, 0, plaqueZ, across * 3.5 + along * 0.4, 0.75, along * 3.5 + across * 0.4, STONE);
      sign(attraction(wall.id).name, plaqueX + Math.sin(wall.yaw) * 0.22, 0.18, plaqueZ + Math.cos(wall.yaw) * 0.22, 3.1, 0.5, wall.yaw);
    }
    buildBianQueHealing({ architecture, batch, bakes, obstacles, solids });
    buildYiRiverFarewell({ architecture, batch, obstacles, solids });
    for (const offset of [-3, 0, 3]) sculptureLight(`qin-warriors-${offset}`, QIN_WARRIORS.x + (offset === 3 ? 4.85 : offset), QIN_WARRIORS.baseZ + (offset === 3 ? -0.4 : 2.95), 1.45, 8);
    horse(126, 0.4, -17, 1.45, 0, { tex: 'paint', tint: 0xb7b8ad }, figurePalette.trim);
    person(126, 2.5, -17, 0.85, figureStone, 'guard', 0, figurePalette);
    sculptureLight('qin-archery-front', 124, -14.8, 1.5, 8);
    sculptureLight('qin-archery-rear', 128.5, -18.5, 1.5, 8);
    for (let segment = 0; segment < 7; segment++) {
      const angle = -Math.PI / 2 + segment * Math.PI / 6;
      box(126.7 + Math.cos(angle) * 0.5, 3.8 + Math.sin(angle) * 0.8, -16.4, 0.1, 0.3, 0.1, figurePalette.trim, { rz: -angle });
    }
    box(126.7, 3, -16.4, 0.035, 1.6, 0.04, DARK);
    for (const column of [QIN_COURTYARD_GATE.x - 6, QIN_COURTYARD_GATE.x + 6]) {
      block(column, 0, QIN_COURTYARD_GATE.z, 0.6, 4.3, 0.6, WOOD);
      roof(column, 4.3, QIN_COURTYARD_GATE.z, 2, 2, 0.6);
    }
    box(QIN_COURTYARD_GATE.x, 3.8, QIN_COURTYARD_GATE.z, 12, 0.4, 0.6, WOOD);
    for (const [id, column, row] of [['qin-warriors', QIN_WARRIORS.x, QIN_WARRIORS.plaqueZ], ['qin-archery', 127, -13]]) plaque(attraction(id).name, column, row);
    buildWarringGateway({ architecture, bakes });
    for (const flag of QIN_STATE_FLAGS) {
      const center = flag.x + flag.side * 1.15;
      block(flag.x, 0, flag.z, 0.7, 0.3, 0.7, STONE);
      block(flag.x, 0.3, flag.z, 0.18, 5.9, 0.18, WOOD, 0);
      box(flag.x, 6.2, flag.z, 0.28, 0.25, 0.28, GOLD);
      box(center, 2.35, flag.z, 1.9, 3.4, 0.08, { tex: 'paint', tint: 0x8f3932 }, { tag: `qin-flag:${flag.state}` });
      box(center, 5.78, flag.z, 2.3, 0.12, 0.16, GOLD);
      for (const edge of [-1, 1]) box(center + edge * 0.9, 2.35, flag.z, 0.08, 3.4, 0.1, GOLD);
      for (const height of [2.35, 5.67]) box(center, height, flag.z, 1.9, 0.08, 0.1, GOLD);
      for (const face of [-1, 1]) labels.push({ text: flag.state, kind: 'banner', x: center, y: 4.25, z: flag.z + face * 0.055, width: 1.25, height: 1.25, yaw: face === 1 ? 0 : Math.PI });
    }
    for (const [column, row, name, height] of [[128, 48, '史记刻石', 5.1], [204, 54, '望海祈福', 4.5]]) {
      block(column, 0, row, 4, 0.6, 3, STONE);
      block(column, 0.6, row, 2.9, height, 1.7, PALE);
      sign(name, column, 2.5, row + 0.87, 2.4, 1.4);
      for (let line = 0; line < 7; line++) for (let character = 0; character < 6; character++) box(column - 0.9 + character * 0.33, 1 + line * 0.18, row + 0.87, 0.11, 0.1, 0.03, WOOD);
    }
    watermill = buildQinWaterwheel({ batch, layer, materials, grid, obstacles, solids, bakes });
    buildQinEastStatues({ architecture, batch, bakes, obstacles, solids });
    plaque('屈原', 207, 8); plaque('徐福像', 207, -12);
    box(191, 0, -15, 3.6, 0.75, 2.9, STONE);
    box(191, 0.6, -15, 2.9, 0.6, 2.3, PALE);
    box(191, 1.2, -15, 1.7, 2.6, 0.75, PALE);
    box(191, 0.45, -13.2, 0.9, 0.65, 1.1, STONE);
    plaque('赑屃残碑', 191, -11);
  }
  function immortalGarden() {
    grid.fill(QIN_POND.x0, -2, QIN_POND.z0, QIN_POND.x1, -1, QIN_POND.z1, 'qin-plinth', groupName);
    grid.fill(QIN_POND.x0, -1, QIN_POND.z0, QIN_POND.x1, 0, QIN_POND.z1, null);
    grid.fill(205, -1, -58, 210, 0, -26, 'qin-plinth', groupName);
    grid.fill(192, -1, -44, 224, 0, -39, 'qin-plinth', groupName);
    box(208, -0.16, -42, 30, 0.1, 30, { tex: 'water', tint: 0x467e76, emissive: 0.06 });
    grid.fill(203, -1, -46, 212, 0, -37, 'qin-plinth', groupName);
    for (const [x0, x1] of [[193, 205], [210, 223]]) for (const [z0, z1] of [[-57, -46], [-37, -27]]) obstacles.push({ x0, x1, z0, z1, floor: 0 });
    for (const [x0, x1] of [[193, 203], [212, 223]]) for (const [z0, z1] of [[-46, -44], [-39, -37]]) obstacles.push({ x0, x1, z0, z1, floor: 0 });
    buildQinGardenLandmarks({ architecture, batch, bakes, obstacles, solids });
    buildQinCoastalLandmarks({ architecture, batch, grid, bakes, obstacles, solids });
    for (const [column, row] of [[195, -59], [219, -60], [190, -36], [219, -23]]) pine(column, row, 6);
    for (let stone = 0; stone < 6; stone++) {
      const column = 192 + stone * 5.2;
      block(column, 0, -5, 1.2, 2 + stone % 3 * 0.35, 0.55, PALE);
      box(column, 0.6, -4.7, 0.65, 1.1, 0.03, WOOD);
    }
  }
  gate(); procession(); emperor(); palace(); sideGardens(); immortalGarden();
  buildQinWanderingEmperor(batch);
  grid.fill(85, -1, 15, 95, 0, 22, 'qin-dock-deck', groupName);
  for (const row of [15, 22]) for (const column of [86, 89, 93]) box(column, -1.3, row, 0.2, 1.8, 0.2, WOOD);
  sign('求仙岛 · 游客码头', 94.7, 2.4, 18.5, 5.6, 0.85, -Math.PI / 2);
  for (const row of [15.6, 21.4]) block(94.88, 0, row, 0.2, 3.4, 0.2, WOOD);
  for (const row of [14, 23]) lamp(90, row);
  for (const [column, row] of [[100, 56], [125, 64], [188, 64], [218, 64], [151, 47], [169, 47], [137, 26], [183, 26], [148, 9], [172, 9], [151, -5], [169, -5], [99, 34], [120, 34], [99, 8], [120, 8], [99, QIN_COURTYARD.z1 + 9], [121.8, QIN_COURTYARD.z1 + 5], [99, QIN_COURTYARD.z0 + 1], [120, QIN_HANFEI.z + 13], [188, -28], [215, -22], [223, -61], [192, -61], [214, 35], [214, 9]]) lamp(column, row);
  for (const column of [95, 128, 192, 228]) for (let row = -61; row <= 57; row += 23) {
    if (column === 192 && row < -20 || column === 228 && row < -10) continue;
    const position = column === 128 && row === -15 ? [133, -27] : column === 128 && row === 31 ? [128, 36] : [column, row];
    pine(...position, 5 + (row + 61) % 3);
  }
  for (const row of [46, 20, -7]) for (const column of [135, 185]) {
    block(column, 0, row, 3.2, 0.45, 0.6, WOOD);
    box(column, 0.45, row - 0.25, 3.2, 0.5, 0.12, WOOD);
  }
  for (const station of QIN_STATIONS) hotspots.push({ id: station.id, box: new THREE.Box3(new THREE.Vector3(station.look[0] - 1.5, station.floor || 0, station.look[1] - 1.5), new THREE.Vector3(station.look[0] + 1.5, (station.floor || 0) + 4, station.look[1] + 1.5)) });
  hotspots.push({ id: 'qin-hanfei', box: new THREE.Box3(new THREE.Vector3(QIN_HANFEI.x - 1.9, 0, QIN_HANFEI.z - 1.5), new THREE.Vector3(QIN_HANFEI.x + 1.9, 3.2, QIN_HANFEI.z + 5.8)) });
  if (labels.length > 64) throw new Error('Qin inscription atlas capacity exceeded');
  const distanceDetail = buildQinDistanceDetail(batch, materials);
  for (const mesh of distanceDetail.meshes) root.add(mesh);
  for (const mesh of roofBatch.build(materials)) palaceRoof.add(mesh);
  root.add(palaceRoof, watermill.wheel, watermill.details);
  root.add(buildLabels(labels));
  const encounterActors = bindQinEncounterActors(root);
  const protection = { active: false, x: 160, z: 24, radius: 2.95, solids: [] };
  const lighting = createInteriorLighting(grid, bakes, QIN_LIGHT_VOLUME);
  const structure = createQinPalaceStructure({ slab: gallerySlab, stairs: palaceStairs, roofs: Object.values(roofBatch.items).flat() });
  function collides(x, feet, z) {
    if (x < QIN_ISLAND.x0) return false;
    if (structure.collides(x, feet, z)) return true;
    if (protection.active && feet < 4.5 && feet + 1.7 > 0) {
      if (Math.hypot(x - protection.x, z - protection.z) < protection.radius + 0.28) return true;
      for (const guard of protection.solids) if (feet < 2.7 && x > guard.x0 - 0.28 && x < guard.x1 + 0.28 && z > guard.z0 - 0.28 && z < guard.z1 + 0.28) return true;
    }
    for (const bounds of solids) {
      if (bounds.walkable && feet >= qinFloorAt(x, z) - 0.23) continue;
      if (x > bounds.x0 - 0.28 && x < bounds.x1 + 0.28 && z > bounds.z0 - 0.28 && z < bounds.z1 + 0.28 && feet < bounds.y1 - 0.05 && feet + 1.7 > bounds.y0 + 0.1) return true;
    }
    return false;
  }
  const lowerFloor = createQinPalaceFloor(collides);
  return {
    root, palaceRoof, structure, distanceDetail, waterwheel: watermill.wheel, watermill, media, greatWall, lowerFloor, encounterActors, protection, lighting, bakes, attractions: QIN_ATTRACTIONS, dock: QIN_DOCK,
    site: { ...lowerFloor, levels(x, z, out) { lowerFloor.levels(x, z, out); structure.levels(x, z, out); },
      collides, obstructed(x, z, feet) { return collides(x, feet, z); } },
    stats: { boxes: watermill.boxes + [batch, roofBatch].reduce((total, source) => total + Object.values(source.items).reduce((count, items) => count + items.length, 0), 0), signs: labels.length, people: 32, horses: 20, chariots: 2, prayerWheels: 24 },
  };
}

export function drawQinMap(context, projectX, projectZ, scale) {
  context.save();
  context.fillStyle = '#527f78';
  context.fillRect(projectX(193), projectZ(-57), 30 * scale, 30 * scale);
  context.fillStyle = '#c6bfae';
  context.fillRect(projectX(205), projectZ(-57), 5 * scale, 30 * scale);
  context.fillRect(projectX(193), projectZ(-44), 30 * scale, 5 * scale);
  for (const item of QIN_ATTRACTIONS) {
    if (item.kind === 'interior' || item.kind === 'wheels') continue;
    context.fillStyle = ['hall', 'palace', 'pavilion', 'gate', 'corridor'].includes(item.kind) ? '#535859' : '#bcb5a2';
    const width = item.width || (item.kind === 'corridor' ? 6 : 4);
    const depth = item.depth || (item.kind === 'corridor' ? 40 : 4);
    context.fillRect(projectX(item.x - width / 2), projectZ(item.z - depth / 2), width * scale, depth * scale);
  }
  context.fillStyle = '#463a2f';
  context.font = `bold ${2 * scale}px "Microsoft YaHei", sans-serif`;
  context.textAlign = 'center';
  context.fillText('秦皇求仙入海处', projectX(160), projectZ(73));
  context.restore();
}

export function setupQinIsland({ world, player, avatar, stage, nav, rig, sound }) {
  const sanctuary = world.qinIsland;
  const cinema = createQinCinema({ media: sanctuary.media, player });
  const greatWall = createQinGreatWallGuide(sanctuary.greatWall);
  const encounter = createQinEmperorEncounter({ world, stage, nav, player, avatar, rig, sound });
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  const wheelBounds = new THREE.Sphere(sanctuary.waterwheel.position.clone(), 3.6);
  const materials = new Map();
  const roots = [sanctuary.root, world.groups['qin-ground']];
  for (const root of roots) root?.traverse(object => {
    if (!object.material?.isMeshLambertMaterial) return;
    const original = object.material;
    if (!materials.has(original)) {
      const copy = original.clone();
      copy.onBeforeCompile = original.onBeforeCompile;
      copy.customProgramCacheKey = original.customProgramCacheKey;
      materials.set(original, { material: copy, compile: copy.onBeforeCompile, cacheKey: copy.customProgramCacheKey });
    }
    object.material = materials.get(original).material;
  });
  let installed = false;
  return {
    cinema, encounter, greatWall,
    tap: (x, y, picked) => sanctuary.lowerFloor.tap(player, picked),
    warmup(on) {
      if (!on || installed) return;
      installed = true;
      for (const { material, compile, cacheKey } of materials.values()) {
        material.onBeforeCompile = compile; material.customProgramCacheKey = cacheKey;
      }
      for (const root of roots) if (root) sanctuary.lighting.apply(root);
    },
    update(dt) {
      sanctuary.distanceDetail.update(stage.camera);
      encounter.update(dt);
      sanctuary.lighting.uniforms.uInteriorBoost.value = world.lighting.uniforms.uInteriorBoost.value;
      sanctuary.palaceRoof.visible = sanctuary.structure.roofVisible(player, stage.camera);
      cinema.update();
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse));
      sanctuary.watermill.update(dt, stage.camera, frustum, reducedMotion.matches, document.hidden || cinema.active);
      sanctuary.greatWall.update(dt, stage.camera, frustum, player, reducedMotion.matches, document.hidden || cinema.active);
      if (cinema.active) {
        if (!document.hidden && cinema.playing) sanctuary.media.update(dt, stage.camera, frustum, true);
        cinema.render();
        return;
      }
      if (document.hidden || reducedMotion.matches || stage.camera.position.distanceToSquared(wheelBounds.center) > 22500) return;
      sanctuary.media.update(dt, stage.camera, frustum);
    },
  };
}
