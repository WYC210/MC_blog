import * as THREE from 'three';

export const QIN_MUSTER = { x: 160, z: 24 };
export const QIN_PATROL = [[168, 20], [170, 16], [170, 3], [150, 3], [150, 16], [152, 20]];

export function buildQinWanderingEmperor(batch) {
  const ink = { tex: 'paint', tint: 0x39454b }, gold = { tex: 'paint', tint: 0xe2bf78 };
  const face = { tex: 'paint', tint: 0xe4b887 }, beard = { tex: 'paint', tint: 0x6b5745 };
  const red = { tex: 'paint', tint: 0xa96347 };
  const box = (feature, x, y, z, width, height, depth, look, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-wanderer:${feature}`, shadow: false });
  batch.at(QIN_PATROL[0][0], 0, QIN_PATROL[0][1], Math.PI, () => {
    for (const side of [-1, 1]) {
      box(`leg-${side}`, side * 0.18, 0.04, 0, 0.23, 0.69, 0.28, ink);
      box(`shoe-${side}`, side * 0.18, 0.02, 0.09, 0.25, 0.14, 0.4, beard);
    }
    box('robe', 0, 0.4, 0, 0.72, 0.56, 0.51, ink);
    box('torso', 0, 0.95, 0, 0.64, 0.55, 0.46, ink);
    box('apron', 0, 0.42, 0.265, 0.27, 0.96, 0.055, red);
    for (const side of [-1, 1]) box('gold-seam', side * 0.16, 0.43, 0.295, 0.045, 0.96, 0.035, gold);
    box('belt', 0, 0.93, 0, 0.76, 0.11, 0.56, gold);
    box('clasp', 0, 0.94, 0.31, 0.17, 0.09, 0.055, red);
    for (const side of [-1, 1]) {
      box('collar', side * 0.13, 1.22, 0.25, 0.06, 0.34, 0.045, gold, { rz: side * -0.55 });
      box(`arm-${side}`, side * 0.41, 0.95, 0.02, 0.31, 0.51, 0.38, ink, { rz: side * 0.12 });
      box(`cuff-${side}`, side * 0.43, 0.91, 0.075, 0.32, 0.09, 0.39, gold);
      box(`hand-${side}`, side * 0.43, 0.8, 0.17, 0.16, 0.16, 0.2, face);
    }
    box('face', 0, 1.5, 0.025, 0.38, 0.43, 0.36, face);
    box('hair', 0, 1.59, -0.14, 0.41, 0.32, 0.15, beard);
    for (const side of [-1, 1]) {
      box('ear', side * 0.21, 1.62, 0.02, 0.07, 0.13, 0.1, face);
      box('eye', side * 0.09, 1.76, 0.217, 0.075, 0.026, 0.028, beard);
      box('brow', side * 0.09, 1.82, 0.217, 0.1, 0.035, 0.035, beard);
      box('moustache', side * 0.065, 1.6, 0.235, 0.11, 0.045, 0.045, beard);
    }
    box('nose', 0, 1.65, 0.245, 0.075, 0.13, 0.1, face);
    box('beard', 0, 1.44, 0.16, 0.22, 0.18, 0.16, beard);
    box('beard-tip', 0, 1.36, 0.16, 0.13, 0.13, 0.12, beard);
    box('crown', 0, 1.94, 0, 0.39, 0.17, 0.35, ink);
    box('crown-board', 0, 2.1, 0, 0.58, 0.07, 0.58, ink);
    for (const end of [-1, 1]) {
      box('crown-rim', 0, 2.1, end * 0.285, 0.6, 0.045, 0.04, gold);
      for (let strand = 0; strand < 5; strand++) box('crown-beads', -0.23 + strand * 0.115, 1.85, end * 0.27, 0.022, 0.26, 0.024, gold);
    }
    box('seal', -0.43, 0.93, 0.23, 0.22, 0.14, 0.22, { tex: 'paint', tint: 0xc5dcc0, emissive: 0.12 });
    box('seal-handle', -0.43, 1.07, 0.23, 0.11, 0.075, 0.1, gold);
  });
}

export function bindQinEncounterActors(root) {
  const actors = [];
  function actor(id, x, y, z, yaw, emperor = false) {
    const origin = new THREE.Matrix4().makeRotationY(yaw).setPosition(x, y, z);
    const value = { id, x, y, z, yaw, originX: x, originY: y, originZ: z, originYaw: yaw, emperor,
      parts: [], attachments: [], inverse: origin.clone().invert(), matrix: origin, life: emperor ? 1 : 0, stride: 0, wave: 0, speed: 0, seal: 1,
      path: [], waypoint: 0, arrived: true, route: [], delay: 0, visible: true, lastLife: -1 };
    actors.push(value);
    return value;
  }
  const emperor = actor('emperor', QIN_PATROL[0][0], 0, QIN_PATROL[0][1], Math.PI, true);
  for (let index = 0; index < 32; index++) actor(index, 141 + index % 16 * 2.45, 1.35, 31.2 + Math.floor(index / 16) * 3.7, Math.PI / 2);
  const meshes = new Set(), hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  root.traverse(mesh => {
    for (const [index, tag] of (mesh.userData.tags || []).entries()) {
      if (!tag?.startsWith('qin-retinue:') && !tag?.startsWith('qin-wanderer:')) continue;
      const fields = tag.split(':'), owner = fields[0] === 'qin-wanderer' ? emperor : actors[Number(fields[1]) + 1];
      const feature = fields.at(-1), original = new THREE.Matrix4(), color = new THREE.Color();
      mesh.getMatrixAt(index, original); mesh.getColorAt(index, color);
      const local = owner.inverse.clone().multiply(original), living = color.clone();
      if (!owner.emperor) living.setHex(/face|nose|hand/.test(feature) ? 0xe7b989 : /eye|leg/.test(feature) ? 0x4c4c42
        : feature === 'helmet' ? 0x76817b : feature === 'spear' ? 0xb49b6a : Number(owner.id) % 4 ? 0x6f858b : 0xad765c);
      const hiddenInStone = !owner.emperor && (feature.startsWith('leg-') || feature === 'eye');
      owner.parts.push({ mesh, index, feature, original, local, color, living, current: color.clone(), hiddenInStone,
        attachment: null, mount: null, gripMatrix: feature.startsWith('hand-') ? new THREE.Matrix4() : null,
        arm: /^(arm|hand|cuff)-/.test(feature) || feature === 'spear' || feature.startsWith('seal'), leg: /^(leg|shoe)-/.test(feature),
        seal: feature.startsWith('seal'), side: feature.endsWith('--1') || feature.startsWith('seal') ? -1 : 1, robeLevel: feature.startsWith('robe-') ? Number(feature.slice(5)) : -1 });
      if (hiddenInStone) mesh.setMatrixAt(index, hidden);
      meshes.add(mesh);
    }
  });
  for (const owner of actors) for (const part of owner.parts) {
    if (part.feature !== 'spear' && !part.seal) continue;
    const hand = owner.parts.find(candidate => candidate.feature === (part.seal ? 'hand--1' : 'hand-1'));
    if (!hand) continue;
    part.attachment = hand; part.mount = hand.local.clone().invert().multiply(part.local);
    owner.attachments.push(part);
  }
  const changed = [...meshes], local = new THREE.Matrix4(), joint = new THREE.Matrix4(), rotation = new THREE.Matrix4();
  const shift = new THREE.Matrix4(), output = new THREE.Matrix4(), scaleVector = new THREE.Vector3();
  let colorsChanged = true;
  function pose(owner) {
    const tintChanged = !owner.emperor && owner.life !== owner.lastLife;
    owner.matrix.makeRotationY(owner.yaw).setPosition(owner.x, owner.y + Math.abs(Math.sin(owner.stride)) * owner.speed * 0.025, owner.z);
    for (const part of owner.parts) {
      if (part.attachment) continue;
      if (!owner.visible || part.hiddenInStone && owner.life <= 0 || part.seal && owner.seal === 0) {
        part.mesh.setMatrixAt(part.index, hidden);
        continue;
      }
      local.copy(part.local);
      if (part.robeLevel >= 0) {
        local.elements[13] += owner.life * (0.57 - part.robeLevel * 0.065);
        scaleVector.set(1, 1 - owner.life * 0.43, 1); local.scale(scaleVector);
      }
      if (part.hiddenInStone) { scaleVector.set(owner.life, owner.life, owner.life); local.scale(scaleVector); }
      const arm = part.arm, leg = part.leg;
      if (arm || leg) {
        const side = part.side;
        const pivotY = leg ? owner.emperor ? 0.7 : 0.8 : owner.emperor ? 1.45 : 1.5;
        const pivotX = side * (leg ? 0.2 : 0.4);
        const swing = Math.sin(owner.stride + (side === 1 ? Math.PI : 0)) * owner.speed * (leg ? 0.55 : -0.24);
        const salute = arm && side === 1 ? owner.wave : 0;
        joint.makeTranslation(pivotX, pivotY, 0);
        rotation.makeRotationX(swing - salute * 1.8); joint.multiply(rotation);
        if (salute) { rotation.makeRotationZ(-salute * 0.8); joint.multiply(rotation); }
        shift.makeTranslation(-pivotX, -pivotY, 0); joint.multiply(shift); local.premultiply(joint);
      }
      output.multiplyMatrices(owner.matrix, local); part.mesh.setMatrixAt(part.index, output);
      if (part.gripMatrix) part.gripMatrix.copy(output);
      if (tintChanged) { part.current.copy(part.color).lerp(part.living, owner.life); part.mesh.setColorAt(part.index, part.current); }
    }
    for (const part of owner.attachments) {
      if (!owner.visible || part.seal && owner.seal === 0) { part.mesh.setMatrixAt(part.index, hidden); continue; }
      output.multiplyMatrices(part.attachment.gripMatrix, part.mount); part.mesh.setMatrixAt(part.index, output);
      if (tintChanged) { part.current.copy(part.color).lerp(part.living, owner.life); part.mesh.setColorAt(part.index, part.current); }
    }
    owner.lastLife = owner.life; colorsChanged ||= tintChanged;
  }
  function upload() {
    for (const mesh of changed) { mesh.instanceMatrix.needsUpdate = true; if (colorsChanged) mesh.instanceColor.needsUpdate = true; }
    colorsChanged = false;
  }
  function restore() {
    for (const owner of actors) {
      owner.x = owner.originX; owner.y = owner.originY; owner.z = owner.originZ; owner.yaw = owner.originYaw;
      owner.life = owner.emperor ? 1 : 0; owner.speed = owner.stride = owner.wave = 0; owner.seal = 1;
      owner.visible = true; owner.lastLife = -1; colorsChanged = true;
      owner.arrived = true; owner.path.length = 0; owner.route.length = 0; owner.waypoint = 0; owner.delay = 0;
      for (const part of owner.parts) { part.mesh.setMatrixAt(part.index, part.hiddenInStone ? hidden : part.original); part.mesh.setColorAt(part.index, part.color); }
    }
    upload();
  }
  restore();
  return { emperor, guards: actors.slice(1), pose, upload, restore };
}
