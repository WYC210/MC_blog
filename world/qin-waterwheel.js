import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';

export const QIN_WATERWHEEL = { x: 207, y: 2.5, z: 19, radius: 2.65, water: -0.12,
  channel: { x0: 200, x1: 214, z0: 17, z1: 21 } };

const WOOD = { tex: 'wood_panel', tint: 0xd4b78e };
const EDGE = { tex: 'oak', tint: 0xbc9670 };
const METAL = { tex: 'paint', tint: 0x667c76 };
const STONE = { tex: 'travertine', tint: 0xc9c3b3 };
const WATER = { tex: 'water', tint: 0x72a9a4, emissive: 0.08 };
const FOAM = { tex: 'paint', tint: 0xb9e0d7, emissive: 0.1 };

export function buildQinWaterwheel({ batch, layer, materials, grid, obstacles, solids, bakes }) {
  const settings = QIN_WATERWHEEL, channel = settings.channel;
  const wheel = new THREE.Group(); wheel.name = 'qin-waterwheel'; wheel.position.set(settings.x, settings.y, settings.z);
  const details = new THREE.Group(); details.name = 'qin-waterwheel-details';
  const detailBatch = new BoxBatch(layer), flowBatch = new BoxBatch(layer);
  const box = (source, tag, column, bottom, row, width, height, depth, look, options = {}) =>
    source.box(column, bottom, row, width, height, depth, look, { ...options, shadow: false, tag: `qin-waterwheel:${tag}` });
  const axis = new THREE.Vector3(), start = new THREE.Vector3(), end = new THREE.Vector3();
  function beam(source, tag, from, to, width, depth, look) {
    axis.subVectors(to, from);
    box(source, tag, (from.x + to.x) / 2, (from.y + to.y) / 2 - depth / 2, (from.z + to.z) / 2,
      width, depth, axis.length(), look, { rx: -Math.atan2(axis.y, Math.hypot(axis.x, axis.z)), ry: Math.atan2(axis.x, axis.z), order: 'YXZ' });
  }
  function rotor(detailed) {
    const source = new BoxBatch(layer), segments = detailed ? 20 : 12, radius = settings.radius;
    for (let segment = 0; segment < segments; segment++) {
      const angle = segment * Math.PI * 2 / segments, cosine = Math.cos(angle), sine = Math.sin(angle);
      for (const face of detailed ? [-0.56, 0.56] : [0]) {
        box(source, 'rim', cosine * radius, sine * radius - 0.13, face,
          radius * Math.PI * 2 / segments + 0.03, 0.26, detailed ? 0.16 : 0.9, EDGE, { rz: angle + Math.PI / 2 });
        if (detailed && segment % 2 === 0) box(source, 'rim-band', cosine * radius, sine * radius - 0.145, face + Math.sign(face) * 0.09,
          0.3, 0.29, 0.035, METAL, { rz: angle });
      }
      box(source, 'paddle', cosine * (radius - 0.12), sine * (radius - 0.12) - 0.06, 0,
        0.5, 0.12, 1.22, WOOD, { rz: angle });
    }
    for (const face of detailed ? [-0.48, 0.48] : [0]) {
      for (let spoke = 0; spoke < 6; spoke++) box(source, 'spoke', 0, -0.07, face, 4.95, 0.14, 0.14, WOOD, { rz: spoke * Math.PI / 6 });
      box(source, 'hub', 0, -0.32, face, 0.64, 0.64, 0.24, EDGE, { rz: Math.PI / 4 });
      if (detailed) box(source, 'hub-cap', 0, -0.19, face + Math.sign(face) * 0.16, 0.38, 0.38, 0.07, METAL, { rz: Math.PI / 4 });
    }
    const mesh = source.build(materials)[0]; mesh.name = detailed ? 'qin-waterwheel-near' : 'qin-waterwheel-far';
    wheel.add(mesh); return mesh;
  }
  const far = rotor(false), near = rotor(true); near.visible = false;
  grid.fill(channel.x0, -1, channel.z0, channel.x1, 0, channel.z1, null);
  box(batch, 'water', 207, settings.water - 0.06, 19, 14, 0.06, 4, WATER);
  for (const row of [16.82, 21.18]) box(batch, 'channel-rim', 207, -0.16, row, 14.72, 0.32, 0.36, STONE);
  for (const column of [199.82, 214.18]) box(batch, 'channel-end', column, -0.16, 19, 0.36, 0.32, 4, STONE);
  const basin = { x0: 199.64, x1: 214.36, z0: 16.64, z1: 21.36, y0: -0.8, y1: 0.18 };
  solids.push(basin); obstacles.push({ ...basin, floor: 0 });
  box(batch, 'axle', 207, 2.34, 19, 0.32, 0.32, 5.7, EDGE);
  for (const row of [16.35, 21.65]) {
    for (const sign of [-1, 1]) {
      const column = 207 + sign * 1.08;
      box(batch, 'footing', column, 0, row, 0.72, 0.32, 0.72, STONE);
      start.set(column, 0.32, row); end.set(207 + sign * 0.12, 2.6, row);
      beam(batch, 'support', start, end, 0.24, 0.28, WOOD);
      box(detailBatch, 'support-band', column, 0.34, row, 0.3, 0.16, 0.32, METAL);
    }
    box(detailBatch, 'crossbrace', 207, 1.1, row, 1.55, 0.18, 0.22, EDGE);
    box(batch, 'bearing', 207, 2.3, row, 0.74, 0.48, 0.5, METAL);
    box(detailBatch, 'bearing-cap', 207, 2.78, row, 0.84, 0.09, 0.56, EDGE);
    const support = { x0: 205.5, x1: 208.5, z0: row - 0.4, z1: row + 0.4, y0: 0, y1: 2.88 };
    solids.push(support); obstacles.push({ ...support, floor: 0 });
  }
  for (const [column, row] of [[203.5, 21.65], [210.5, 16.35]]) {
    box(batch, 'lamp-base', column, 0, row, 0.52, 0.32, 0.4, METAL);
    box(batch, 'lamp', column, 0.32, row, 0.4, 0.07, 0.28, { tex: 'paint', tint: 0xffdc9e, emissive: 0.65 });
    bakes.push({ id: `qin-waterwheel-${row}`, position: [column, 0.75, row], power: 1.8, radius: 10, direction: null });
  }
  for (let index = 0; index < 7; index++) for (const row of [16.82, 21.18])
    box(detailBatch, 'coping', 200.9 + index * 2, 0.16, row, 1.94, 0.08, 0.4, STONE);
  box(detailBatch, 'inlet-bed', 213.35, 0.18, 19, 1.2, 0.18, 1.3, STONE);
  for (const row of [18.3, 19.7]) box(detailBatch, 'inlet-side', 213.35, 0.18, row, 1.2, 0.46, 0.14, STONE);
  box(detailBatch, 'inlet-water', 213.35, 0.36, 19, 1.2, 0.04, 1.25, WATER);
  box(detailBatch, 'inlet-fall', 212.76, -0.12, 19, 0.04, 0.52, 1.2, WATER);
  for (let index = 0; index < 5; index++) box(detailBatch, 'outlet-grate', 200.12, -0.1, 17.6 + index * 0.7, 0.18, 0.18, 0.06, METAL);
  for (const mesh of detailBatch.build(materials)) details.add(mesh);
  for (let index = 0; index < 24; index++) box(flowBatch, index < 16 ? 'flow' : 'splash', 207, -0.1, 19, 1, 1, 1, FOAM);
  const flow = flowBatch.build(materials)[0]; flow.name = 'qin-waterwheel-flow';
  const flowGeometry = new THREE.PlaneGeometry(1, 1);
  flowGeometry.setAttribute('iLayers', flow.geometry.getAttribute('iLayers'));
  flowGeometry.setAttribute('iEmissive', flow.geometry.getAttribute('iEmissive'));
  flow.geometry.dispose(); flow.geometry = flowGeometry;
  flow.instanceMatrix.setUsage(THREE.DynamicDrawUsage); flow.frustumCulled = false; details.add(flow);
  const transform = new THREE.Matrix4(), scale = new THREE.Vector3(), position = new THREE.Vector3(), rotation = new THREE.Quaternion();
  const surfaceRotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
  const bounds = new THREE.Sphere(new THREE.Vector3(207, 2, 19), 8);
  let elapsed = 0, detailed = false;
  function updateFlow(camera) {
    for (let index = 0; index < 24; index++) {
      if (index < 16) {
        const phase = (elapsed * 0.1 + index / 16) % 1;
        position.set(213.6 - phase * 13.2, settings.water + 0.013, 17.45 + (index * 7 % 13) / 13 * 3.1);
        scale.set(0.28 + index % 3 * 0.14, 0.035 + index % 2 * 0.025, 1);
        rotation.copy(surfaceRotation);
      } else {
        const phase = (elapsed * 0.9 + (index - 16) / 8) % 1;
        position.set(206.1 - phase * 0.7, settings.water + Math.sin(phase * Math.PI) * 0.42, 18.42 + (index - 16) / 7 * 1.16);
        scale.set(0.045, 0.06 + Math.sin(phase * Math.PI) * 0.07, 0.045);
        if (camera) rotation.copy(camera.quaternion); else rotation.identity();
      }
      transform.compose(position, rotation, scale); flow.setMatrixAt(index, transform);
    }
    flow.instanceMatrix.needsUpdate = true;
  }
  updateFlow(); details.visible = false;
  return { wheel, details,
    update(dt, camera, frustum, reduced, paused) {
      const distance = camera.position.distanceToSquared(bounds.center), visible = frustum.intersectsSphere(bounds);
      detailed = visible && distance < (detailed ? 40 ** 2 : 35 ** 2);
      near.visible = detailed; far.visible = !detailed; details.visible = detailed;
      flow.visible = !reduced;
      if (paused || reduced || !visible || distance > 150 ** 2 || dt <= 0) return;
      const step = Math.min(dt, 0.05);
      wheel.rotation.z = (wheel.rotation.z - step * 0.18) % (Math.PI * 2);
      if (detailed) { elapsed = (elapsed + step) % 120; updateFlow(camera); }
    },
    boxes: far.count + near.count + flow.count + detailBatch.items.opaque.length,
  };
}
