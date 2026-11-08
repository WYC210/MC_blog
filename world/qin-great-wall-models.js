import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { REFERENCE_SCENES, referenceHeight, buildReferenceScene } from './qin-great-wall-reference-models.js';

export const WALL_MODELS = {
  laolongtou: { kind: 'coast', route: [[-3.4, -1.1], [-1.8, -1.1], [-0.8, -0.5], [0.7, 0.1], [2.8, 0.1]], towers: [1, 4], peaks: [] },
  'south-wing': { kind: 'wing', route: [[-3, -1.5], [-1.4, -1.5], [-1.4, 1.3], [1.7, 1.3], [1.7, -1.5], [3, -1.5]], towers: [0, 2, 3, 5], peaks: [[-2.5, -1.8, 0.2, 1.7]] },
  shanhaiguan: { kind: 'gate', route: [[-3.5, 0], [-1, 0], [1, 0], [3.5, 0]], towers: [0, 3], peaks: [], gate: [0, 0] },
  'north-wing': { kind: 'wing', route: [[-3.3, 1.2], [-2, 1.2], [-2, -1.3], [1, -1.3], [1, 0.8], [3.3, 0.8]], towers: [0, 2, 3, 5], peaks: [[2.8, -1.6, 0.35, 1.4]], village: true },
  jiaoshan: { kind: 'mountain', route: [[-3.3, 1.4], [-2.2, 0.7], [-1.1, 0.8], [-0.4, -0.1], [0.7, -0.3], [1.3, -1.2], [2.8, -1.6]], towers: [0, 2, 4, 6], peaks: [[-1.2, 0.5, 0.55, 1.6], [0.4, -0.2, 0.85, 1.5], [2.3, -1.3, 1.4, 1.3]] },
  sandaoguan: { kind: 'pass', route: [[-3.3, -1.3], [-2.1, -0.8], [-1.4, 0.5], [0, 0.7], [1.4, 0.5], [2, -0.5], [3.3, -1.1]], towers: [0, 2, 4, 6], peaks: [[-2.4, -0.9, 1.35, 1.1], [2.3, -0.7, 1.5, 1.2]], gate: [0, 0.7] },
  yiyuankou: { kind: 'pass', route: [[-3.3, -1.1], [-2.4, 0.2], [-1.4, 0.4], [0.5, 0.4], [1.8, -0.6], [3.3, -1.3]], towers: [0, 2, 5], peaks: [[-2.7, -0.2, 0.9, 1.3], [2.6, -0.8, 1.1, 1.3]], gate: [0, 0.4] },
  dongjiakou: { kind: 'mountain', route: [[-3.3, 0.4], [-2.2, -0.7], [-1, -0.1], [0.4, -1.2], [1.6, -0.9], [3.3, 0.4]], towers: [0, 1, 3, 5], peaks: [[-2.2, -0.6, 1.05, 1.2], [0.3, -1.1, 1.2, 1.2], [2.7, 0, 0.7, 1.2]], village: true },
  banchangyu: { kind: 'mountain', route: [[-3.3, 1.5], [-2.4, 0.8], [-1.6, 1.2], [-0.9, 0.1], [-0.1, 0.4], [0.4, -0.7], [1.4, -0.8], [2.6, -1.5]], towers: [0, 3, 5, 7], peaks: [[-1.2, 0.4, 0.7, 1], [0.7, -0.6, 1.55, 0.95], [2.6, -1.4, 1.15, 1.05]] },
  naziyu: { kind: 'pass', route: [[-3.2, -0.6], [-2, -0.6], [-0.8, 0.1], [0.8, 0.1], [2, -0.8], [3.2, -0.8]], towers: [0, 2, 5], peaks: [[-2.4, -0.6, 0.6, 1.6], [2.6, -0.8, 0.75, 1.3]], gate: [0, 0.1], golden: true },
  huachangyu: { kind: 'mountain', route: [[-3.3, -1.2], [-2, -0.3], [-0.7, -0.9], [0.5, -0.2], [1.9, -1.2], [3.3, -0.7]], towers: [0, 2, 4], peaks: [[-2.4, -0.9, 0.8, 1.3], [0, -0.6, 0.95, 1.4], [2.5, -1, 1.15, 1.2]], village: true },
  chengziyu: { kind: 'mountain', route: [[-3.3, 0.7], [-2.1, 0.9], [-1.3, -0.5], [0.2, -0.9], [1.2, 0.1], [2.1, -0.6], [3.3, -0.8]], towers: [0, 2, 4, 6], peaks: [[-2.2, 0.5, 0.6, 1.2], [-0.5, -0.7, 1.2, 1.3], [2.4, -0.5, 0.9, 1.3]] },
  jielingkou: { kind: 'pass', route: [[-3.2, -0.9], [-2, 0.5], [-0.9, 0.6], [0.9, 0.6], [2, -0.4], [3.2, -1]], towers: [0, 1, 4, 5], peaks: [[-2.7, -0.6, 1.1, 1.1], [2.6, -0.7, 0.85, 1.2]], gate: [0, 0.6], village: true },
  chongyukou: { kind: 'mountain', route: [[-3.3, -0.4], [-2.2, -1.2], [-0.8, -0.7], [0.7, -1.3], [2, -0.3], [3.3, -0.5]], towers: [0, 2, 3, 5], peaks: [[-2.4, -1, 0.75, 1.4], [0.8, -0.9, 1, 1.4]], village: true },
  liujiakou: { kind: 'watergate', route: [[-3.3, -0.6], [-1.8, 0], [-0.7, 0], [0.7, 0], [2.1, -0.7], [3.3, -0.4]], towers: [0, 1, 4, 5], peaks: [[-2.7, -0.4, 0.65, 1.1], [2.7, -0.6, 0.85, 1.1]], gate: [0, 0] },
  taolinkou: { kind: 'watergate', route: [[-3.3, -1.3], [-2.5, -0.3], [-0.8, 0.5], [0.8, 0.5], [2, 0.7], [3.3, -0.4]], towers: [0, 1, 4, 5], peaks: [[-2.7, -0.7, 1.1, 1.2], [2.7, 0.1, 0.7, 1.2]], gate: [0, 0.5] },
  lengkou: { kind: 'pass', route: [[-3.3, -1.4], [-2.2, -0.6], [-1, 0], [1, 0], [1.9, -0.8], [3.3, -1.4]], towers: [0, 1, 4, 5], peaks: [[-2.7, -0.8, 1.4, 1.05], [2.6, -1, 1.4, 1.2]], gate: [0, 0] },
  chengzilingkou: { kind: 'mountain', route: [[-3.3, -1.4], [-2.5, -0.3], [-1.3, -0.8], [0, 0.4], [1.4, 0.6], [2.5, -0.2], [3.3, 0.7]], towers: [0, 2, 4, 6], peaks: [[-2.4, -0.9, 1.1, 1.4], [0.2, 0.4, 0.9, 1.3], [2.8, 0.2, 0.65, 1.3]] },
  luohandong: { kind: 'mountain', route: [[-3.3, 0.2], [-2.1, -0.6], [-1, -1.3], [0.3, -0.9], [1.1, 0.2], [2.3, -0.2], [3.3, -0.8]], towers: [0, 2, 4, 6], peaks: [[-1.5, -0.8, 1.35, 1.3], [1.2, 0.1, 0.7, 1.1], [3, -0.7, 1, 1.2]] },
  jiumenkou: { kind: 'bridge', route: [[-3.3, 0], [3.3, 0]], towers: [0, 1], peaks: [[-3.7, -1.2, 0.8, 0.9], [3.7, -1.2, 0.9, 0.9]] },
};

export function wallModelHeight(model, across, along) {
  if (model.kind === 'coast') return across > 0.3 ? 0.025 : 0.14 + Math.max(0, -across - 1) * 0.018;
  let height = 0.07;
  for (const [peakX, peakZ, rise, spread] of model.peaks) height += rise * Math.exp(-((across - peakX) ** 2 + (along - peakZ) ** 2) / (spread * spread));
  if (model.kind === 'watergate' || model.kind === 'bridge') height *= Math.min(1, Math.abs(across) / 0.8);
  return height;
}

export function createWallSectionModel({ layer, materials, width = 7.8, depth = 4.6 }) {
  const root = new THREE.Group(); root.name = 'qin-wall-section';
  const columns = Math.ceil(width / 0.45), rows = 16, scaleX = width / 7.8, scaleZ = depth / 4.6;
  const positions = new Float32Array((columns + 1) * (rows + 1) * 3), indices = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const vertex = row * (columns + 1) + column;
    indices.push(vertex, vertex + columns + 1, vertex + 1, vertex + 1, vertex + columns + 1, vertex + columns + 2);
  }
  const terrain = new THREE.BufferGeometry();
  terrain.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage)); terrain.setIndex(indices);
  const land = new THREE.Mesh(terrain, new THREE.MeshBasicMaterial({ color: 0x194c55, transparent: true, opacity: 0.78, side: THREE.DoubleSide, forceSinglePass: true, depthWrite: false, toneMapped: false }));
  land.name = 'qin-wall-relief'; root.add(land);
  const edges = new Float32Array(((rows + 1) * columns + (columns + 1) * rows) * 6);
  const wire = new THREE.BufferGeometry(); wire.setAttribute('position', new THREE.BufferAttribute(edges, 3).setUsage(THREE.DynamicDrawUsage));
  const contours = new THREE.LineSegments(wire, new THREE.LineBasicMaterial({ color: 0x62d5d7, transparent: true, opacity: 0.4, toneMapped: false }));
  contours.name = 'qin-wall-contours'; root.add(contours);
  const glow = { tex: 'paint', tint: 0xa2eddd, emissive: 0.9 };
  const gold = { tex: 'paint', tint: 0xf2cd89, emissive: 0.85 };
  const dark = { tex: 'paint', tint: 0x287d86, emissive: 0.75 };
  const water = { tex: 'paint', tint: 0x286882, emissive: 0.9 };
  const palette = {
    stone: { tex: 'paint', tint: 0x83c6bd, emissive: 0.65 },
    rock: { tex: 'paint', tint: 0x4f797e, emissive: 0.5 },
    walk: { tex: 'paint', tint: 0x456c73, emissive: 0.45 },
    sandstone: { tex: 'paint', tint: 0xb5a274, emissive: 0.5 },
    roof: { tex: 'paint', tint: 0x526e75, emissive: 0.55 },
    timber: { tex: 'paint', tint: 0x779b94, emissive: 0.55 },
    opening: { tex: 'paint', tint: 0x173c48, emissive: 0.4 },
    context: { tex: 'paint', tint: 0x356570, emissive: 0.45 },
    earth: { tex: 'paint', tint: 0x8c8e78, emissive: 0.5 },
    water,
  };
  const seed = new BoxBatch(layer), capacity = 1024;
  for (let index = 0; index < capacity; index++) seed.box(0, 0, 0, 0.01, 0.01, 0.01, glow);
  const mesh = seed.build(materials)[0]; mesh.name = 'qin-wall-detail'; mesh.count = 0; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); root.add(mesh);
  const focus = new THREE.Vector3();
  const state = { selected: null, kind: null, version: 0, instances: 0, reference: false };
  function select(id) {
    const source = WALL_MODELS[id];
    if (!source) return false;
    if (state.selected === id) return true;
    const model = { ...source, route: source.route.map(point => [point[0] * scaleX, point[1] * scaleZ]),
      gate: source.gate && [source.gate[0] * scaleX, source.gate[1] * scaleZ] };
    const reference = REFERENCE_SCENES[id], sceneScale = Math.min(width / 31.2, depth / 3.6);
    const ground = reference ? (across, along) => referenceHeight(reference, across / sceneScale, along / sceneScale) * sceneScale
      : (across, along) => wallModelHeight(source, across / scaleX, along / scaleZ);
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const across = (column / columns - 0.5) * width, along = (row / rows - 0.5) * depth, offset = (row * (columns + 1) + column) * 3;
      positions[offset] = across; positions[offset + 1] = ground(across, along); positions[offset + 2] = along;
    }
    let edgeOffset = 0;
    function edge(start, end) {
      for (const vertex of [start, end]) for (let axis = 0; axis < 3; axis++) edges[edgeOffset++] = positions[vertex * 3 + axis];
    }
    for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
      const vertex = row * (columns + 1) + column;
      if (column < columns) edge(vertex, vertex + 1);
      if (row < rows) edge(vertex, vertex + columns + 1);
    }
    terrain.attributes.position.needsUpdate = true; terrain.computeBoundingSphere();
    wire.attributes.position.needsUpdate = true; wire.computeBoundingSphere();
    const boxes = new BoxBatch(layer), tags = [];
    const box = (feature, across, height, along, sizeX, sizeY, sizeZ, look = glow, rotation = {}) =>
      boxes.box(across, height, along, sizeX, sizeY, sizeZ, look, { ...rotation, tag: `qin-wall-detail:${feature}` });
    function tower(across, along, raised = null) {
      const base = raised ?? ground(across, along);
      box('tower', across, base, along, 0.43, 0.49, 0.43);
      box('tower-cap', across, base + 0.49, along, 0.49, 0.045, 0.49, model.golden ? gold : glow);
      for (const side of [-1, 1]) {
        box('tower-window', across, base + 0.21, along + side * 0.219, 0.11, 0.15, 0.008, dark);
        for (const end of [-1, 1]) box('tower-merlon', across + end * 0.19, base + 0.535, along + side * 0.19, 0.11, 0.12, 0.11);
      }
    }
    function gate(across, along, large = false) {
      const base = ground(across, along), scale = large ? 1.25 : 0.8;
      for (const side of [-1, 1]) box('gate-pier', across + side * 0.5 * scale, base, along, 0.36 * scale, 0.75 * scale, 0.6 * scale);
      box('gate-lintel', across, base + 0.65 * scale, along, 1.4 * scale, 0.28 * scale, 0.65 * scale);
      box('gate-chamber', across, base + 0.93 * scale, along, 1.1 * scale, 0.38 * scale, 0.54 * scale);
      for (let tier = 0; tier < 3; tier++) box('gate-roof', across, base + (1.31 + tier * 0.08) * scale, along,
        (1.65 - tier * 0.27) * scale, 0.08 * scale, (0.95 - tier * 0.17) * scale, gold);
      for (const offset of [-0.35, 0, 0.35]) box('gate-window', across + offset * scale, base + 1.03 * scale, along + 0.274 * scale, 0.13 * scale, 0.17 * scale, 0.01, dark);
    }
    if (reference) {
      buildReferenceScene(id, (tag, across, height, along, sizeX, sizeY, sizeZ, look = 'stone', rotation = {}) =>
        box(tag, across * sceneScale, height * sceneScale, along * sceneScale, sizeX * sceneScale, sizeY * sceneScale, sizeZ * sceneScale, palette[look], rotation));
      focus.fromArray(reference.focus).multiplyScalar(sceneScale);
    } else {
      if (model.kind === 'coast') {
        box('sea', 2.05 * scaleX, 0.035, 0, 3.45 * scaleX, 0.025, 4.5 * scaleZ, water);
        for (let wave = 0; wave < 7; wave++) box('sea-wave', (2.1 + wave % 2 * 0.2) * scaleX, 0.062, (-1.85 + wave * 0.56) * scaleZ, 2.55 * scaleX, 0.008, 0.025, dark);
        box('seaward-platform', 2.8 * scaleX, 0.03, 0.1 * scaleZ, 0.95, 0.35, 0.85, dark);
      }
      if (model.kind === 'watergate' || model.kind === 'bridge') {
        box('river', 0, 0.025, 0, (model.kind === 'bridge' ? 5.55 : 1.15) * scaleX, 0.03, 4.5 * scaleZ, water);
        for (let wave = 0; wave < 8; wave++) box('river-wave', 0, 0.059, (-2 + wave * 0.54) * scaleZ, (model.kind === 'bridge' ? 5.3 : 0.9) * scaleX, 0.008, 0.025, dark);
      }
      if (model.kind === 'bridge') {
        for (let pier = 0; pier <= 9; pier++) box('bridge-pier', (-2.97 + pier * 0.66) * scaleX, 0.04, 0, 0.19 * scaleX, 0.67, 0.49);
        box('bridge-deck', 0, 0.71, 0, 6.45 * scaleX, 0.16, 0.58);
        for (const side of [-1, 1]) {
          box('bridge-parapet', 0, 0.87, side * 0.25, 6.45 * scaleX, 0.14, 0.09);
          for (let merlon = 0; merlon < Math.ceil(24 * scaleX); merlon++) box('bridge-merlon', -3.08 * scaleX + merlon * 0.268, 1.01, side * 0.25, 0.12, 0.11, 0.1);
        }
        for (const side of [-1, 1]) tower(side * 3.25 * scaleX, 0, 0.55);
        focus.set(0, 1.1, 0);
      } else {
        for (let index = 1; index < model.route.length; index++) {
          const start = model.route[index - 1], end = model.route[index], length = Math.hypot(end[0] - start[0], end[1] - start[1]);
          const count = Math.ceil(length / 0.2), yaw = -Math.atan2(end[1] - start[1], end[0] - start[0]);
          for (let segment = 0; segment < count; segment++) {
            const fraction = (segment + 0.5) / count, across = start[0] + (end[0] - start[0]) * fraction, along = start[1] + (end[1] - start[1]) * fraction;
            if (model.gate && Math.hypot(across - model.gate[0], along - model.gate[1]) < (model.kind === 'gate' ? 0.82 : 0.55)) continue;
            const height = ground(across, along), step = length / count;
            const rise = ground(across + Math.cos(yaw) * step / 2, along - Math.sin(yaw) * step / 2) - ground(across - Math.cos(yaw) * step / 2, along + Math.sin(yaw) * step / 2);
            const rotation = { ry: yaw, rz: Math.atan2(rise, step) };
            box('wall', across, height, along, step + 0.012, 0.22, 0.15, glow, rotation);
            if (segment % 2 === 0) box('merlon', across, height + 0.22, along, 0.1, 0.085, 0.17, model.golden ? gold : glow, rotation);
            if (model.golden) box('golden-band', across, height + 0.16, along, step + 0.015, 0.04, 0.16, gold, rotation);
          }
        }
        for (const index of model.towers) {
          const point = model.route[index]; tower(point[0], point[1], model.kind === 'coast' && index === 4 ? 0.38 : null);
        }
        if (model.gate) gate(...model.gate, model.kind === 'gate');
        const point = model.gate || model.route[model.towers[Math.floor(model.towers.length / 2)]];
        const focusHeight = model.gate ? (model.kind === 'gate' ? 1.95 : 1.3) : model.kind === 'coast' ? 1.1 : ground(...point) + 0.71;
        focus.set(point[0], model.gate ? ground(...point) + focusHeight : focusHeight, point[1]);
      }
      if (model.village) for (let house = 0; house < 5; house++) {
        const across = (-1.5 + house * 0.65) * scaleX, along = (1.55 + house % 2 * 0.22) * scaleZ, height = ground(across, along);
        box('village-house', across, height, along, 0.38, 0.23, 0.3, dark);
        box('village-roof', across, height + 0.23, along, 0.44, 0.07, 0.38, gold);
      }
    }
    const items = boxes.items.opaque;
    if (items.length > capacity) throw new Error(`Great Wall projection capacity exceeded: ${items.length}`);
    for (const [index, item] of items.entries()) {
      mesh.setMatrixAt(index, item.matrix); mesh.setColorAt(index, item.color); tags.push(item.tag);
      mesh.geometry.attributes.iEmissive.array[index] = item.emissive;
    }
    mesh.geometry.attributes.iEmissive.needsUpdate = true;
    mesh.count = items.length; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere();
    mesh.userData.tags = tags; root.userData.section = id;
    state.selected = id; state.kind = reference?.kind || model.kind; state.version++; state.instances = items.length; state.reference = !!reference;
    return true;
  }
  return { root, state, select, focus, terrain, mesh };
}
