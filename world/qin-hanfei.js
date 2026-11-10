import { QIN_HANFEI } from './qin-island-layout.js';

const PLASTER = { tex: 'plaster', tint: 0xe2d8c2 };
const TIMBER = { tex: 'wood_panel', tint: 0xb38a60 };
const PAPER = { tex: 'paint', tint: 0xd8cfb4 };
const BAMBOO = { tex: 'paint', tint: 0xc9ad75 };
const BLUE = { tex: 'paint', tint: 0x829997 };
const FACE = { tex: 'paint', tint: 0xf0d6b3 };
const INK = { tex: 'paint', tint: 0x51463d };

export function buildHanFeiHall({ architecture, batch, obstacles, solids, bakes, lod }) {
  const { x: center, z: row, width, depth } = QIN_HANFEI;
  const { block, roof, sign, looks } = architecture;
  const box = (x, y, z, wide, tall, deep, look = TIMBER, rotation = {}) =>
    architecture.box(x, y, z, wide, tall, deep, look, { tag: 'qin-hanfei:architecture', ...rotation });
  function reserve(x, z, wide, deep, tall, bottom = 0) {
    const bounds = { x0: x - wide / 2 - 0.05, x1: x + wide / 2 + 0.05, z0: z - deep / 2 - 0.05, z1: z + deep / 2 + 0.05, y0: bottom, y1: bottom + tall };
    solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
  }
  function beam(start, end, wide, look, tag) {
    const delta = end.map((value, axis) => value - start[axis]), length = Math.hypot(...delta);
    box((start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      wide, length, wide, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length), tag });
  }
  function lantern(id, x, z, y = 3.15, power = 1.3) {
    box(x, y + 0.65, z, 0.045, 0.75, 0.045, looks.WOOD);
    box(x, y, z, 0.6, 0.08, 0.6, looks.WOOD);
    box(x, y + 0.08, z, 0.46, 0.5, 0.46, { tex: 'paint', tint: 0xffdda0, emissive: 0.65 });
    box(x, y + 0.58, z, 0.64, 0.09, 0.64, looks.WOOD);
    for (const side of [-1, 1]) for (const edge of [-1, 1]) box(x + side * 0.25, y + 0.08, z + edge * 0.25, 0.045, 0.5, 0.045, TIMBER);
    bakes.push({ id: `qin-hanfei-${id}`, position: [x, y + 0.3, z], power, radius: 8, direction: null });
  }
  function lattice(x, z, yaw, wide, bottom = 0.9, tall = 2.7) {
    lod.replace(batch, () => batch.at(x, bottom, z, yaw, () => {
      box(0, 0, 0, wide, tall, 0.12, looks.WOOD);
      box(0, 0.12, 0.075, wide - 0.2, tall - 0.24, 0.04, PAPER, { tag: 'qin-hanfei:window-backing' });
      for (let offset = -wide / 2 + 0.25; offset < wide / 2 - 0.1; offset += 0.38) box(offset, 0.12, 0.13, 0.065, tall - 0.24, 0.065, TIMBER);
      for (let height = 0.45; height < tall - 0.1; height += 0.6) box(0, height, 0.13, wide - 0.18, 0.07, 0.065, TIMBER);
      box(0, -0.12, 0.02, wide + 0.16, 0.14, 0.3, looks.STONE);
    }), proxy => proxy.at(x, bottom, z, yaw, () => {
      proxy.box(0, 0, 0, wide, tall, 0.12, looks.WOOD);
      proxy.box(0, 0.12, 0.075, wide - 0.2, tall - 0.24, 0.04, PAPER);
      proxy.box(0, 0.12, 0.13, 0.065, tall - 0.24, 0.065, TIMBER);
      proxy.box(0, tall / 2, 0.13, wide - 0.18, 0.07, 0.065, TIMBER);
      proxy.box(0, -0.12, 0.02, wide + 0.16, 0.14, 0.3, looks.STONE);
    }));
  }
  function slips(x, y, z, wide = 0.65) {
    for (let strip = 0; strip < 9; strip++) box(x - wide / 2 + (strip + 0.5) * wide / 9, y, z, wide / 10, 0.035, 0.4, BAMBOO, { tag: 'qin-hanfei:slips' });
    for (const offset of [-0.12, 0.12]) box(x, y + 0.037, z + offset, wide, 0.012, 0.022, INK);
    for (const offset of [-0.2, 0, 0.2]) box(x + offset, y + 0.04, z, 0.018, 0.012, 0.13, INK);
  }
  function scholar(x, y, z, id, yaw, seated, writing = false) {
    batch.at(x, y, z, yaw, () => {
      const tag = `qin-hanfei:${id}`, robe = id === 'teacher' ? BLUE : writing ? { tex: 'paint', tint: 0xc3ab8b } : { tex: 'paint', tint: 0xa7b8ae };
      const shape = (column, height, along, wide, tall, deep, look = robe, feature = id) =>
        box(column, height, along, wide, tall, deep, look, { tag: `qin-hanfei:${feature}` });
      const body = seated ? 0.42 : 0.96;
      if (seated) {
        shape(0, 0, 0, 0.95, 0.065, 0.95, { tex: 'linen', tint: 0xc5b58e }, 'mat');
        shape(0, 0.07, -0.14, 0.5, 0.28, 0.5);
        for (const side of [-1, 1]) shape(side * 0.2, 0.12, 0.21, 0.27, 0.27, 0.6);
      } else {
        for (const side of [-1, 1]) shape(side * 0.2, 0, 0.07, 0.24, 0.14, 0.39, INK);
        for (let tier = 0; tier < 7; tier++) shape(0, 0.13 + tier * 0.12, 0, 0.78 - tier * 0.025, 0.14, 0.49 - tier * 0.013);
      }
      shape(0, body, 0, 0.61, 0.47, 0.42);
      shape(0, body + 0.02, 0, 0.64, 0.07, 0.45, INK);
      beam([-0.22, body + 0.47, 0.24], [0.18, body + 0.08, 0.24], 0.065, PAPER, tag);
      shape(0, body + 0.46, 0, 0.2, 0.15, 0.23, FACE);
      shape(0, body + 0.58, 0.015, 0.34, 0.37, 0.33, FACE, `${id}-face`);
      shape(0, body + 0.93, 0, 0.38, 0.12, 0.36, INK);
      shape(0, body + 1.05, -0.04, 0.18, 0.11, 0.2, INK);
      for (const side of [-1, 1]) shape(side * 0.08, body + 0.79, 0.19, 0.065, 0.035, 0.025, INK);
      shape(0, body + 0.68, 0.205, 0.065, 0.1, 0.085, FACE);
      shape(0, body + 0.62, 0.19, 0.09, 0.02, 0.025, INK);
      for (const side of [-1, 1]) {
        const hand = id === 'teacher' && side === 1 ? [0.62, body + 0.47, 0.35]
          : writing && side === 1 ? [0.27, body + 0.06, 0.6] : [side * 0.21, body + 0.16, 0.49];
        const elbow = [side * 0.42, body + 0.1, 0.25];
        beam([side * 0.35, body + 0.4, 0], elbow, 0.23, robe, tag);
        beam(elbow, hand, 0.2, robe, tag);
        shape(hand[0], hand[1] - 0.055, hand[2], 0.15, 0.11, 0.14, FACE);
        if (writing && side === 1) box(hand[0], hand[1] - 0.12, hand[2] + 0.03, 0.025, 0.3, 0.025, looks.WOOD, { rz: -0.2, tag: 'qin-hanfei:writing-brush' });
      }
      if (!writing) {
        box(-0.08, body + 0.19, 0.55, 0.5, 0.32, 0.055, BAMBOO, { rx: -0.35, tag: 'qin-hanfei:held-slips' });
        for (const offset of [-0.24, -0.12, 0, 0.12]) box(offset, body + 0.25, 0.61, 0.018, 0.17, 0.015, INK);
      }
    });
    reserve(x, z, seated ? 1.05 : 1.6, 1.15, seated ? 1.7 : 2.3, y);
  }
  function cabinet(x, z) {
    box(x, 0.08, z, 2.8, 2.55, 0.6, looks.WOOD, { tag: 'qin-hanfei:archive' });
    box(x, 0.2, z + 0.32, 2.52, 2.2, 0.045, INK);
    for (const height of [0.2, 0.9, 1.6, 2.35]) box(x, height, z + 0.42, 2.7, 0.09, 0.45, TIMBER);
    for (const side of [-1, 1]) box(x + side * 0.45, 0.2, z + 0.42, 0.08, 2.2, 0.4, TIMBER);
    for (const height of [0.31, 1.01, 1.71]) for (const offset of [-0.9, 0, 0.9]) {
      box(x + offset, height, z + 0.48, 0.6, 0.34, 0.34, BAMBOO);
      box(x + offset, height + 0.13, z + 0.66, 0.63, 0.06, 0.035, looks.WOOD);
    }
    reserve(x, z + 0.17, 2.85, 1.05, 2.65);
  }

  box(center, -0.12, row + 0.5, width + 1, 0.14, depth + 2, looks.STONE);
  box(center, 0.02, row - 0.45, width - 0.6, 0.025, depth - 1.2, { tex: 'wood_floor', tint: 0xc9b18c });
  block(center, 0, row - depth / 2, width, 4.6, 0.4, PLASTER);
  for (const side of [-1, 1]) {
    const outer = center + side * width / 2;
    block(outer, 0, row, 0.4, 4.6, depth, PLASTER);
    box(outer, 0, row, 0.5, 0.6, depth, looks.STONE);
    for (const face of [-1, 1]) lattice(outer + face * 0.25, row, face * Math.PI / 2, 4.4);
    for (const offset of [-4.8, 0, 4.8]) box(outer, 0.6, row + offset, 0.52, 3.8, 0.42, looks.WOOD);
    const facade = center + side * 6.2;
    block(facade, 0, row + 3.8, 7.6, 4.6, 0.34, looks.WOOD);
    box(facade, 0, row + 4.01, 7.5, 0.85, 0.16, TIMBER);
    for (const offset of [-2.45, 0, 2.45]) {
      lattice(facade + offset, row + 4.02, 0, 2.25);
      lattice(facade + offset, row + 3.58, Math.PI, 2.25);
    }
    block(center + side * 2.5, 0, row + 3.1, 0.18, 3.25, 1.35, looks.WOOD);
    for (const height of [0.5, 1.5, 2.5]) box(center + side * 2.39, height, row + 3.1, 0.06, 0.09, 1.1, looks.GOLD);
    cabinet(center + side * 7.3, row - 4.25);
    for (const face of [-1, 1]) lattice(center + side * 6, row - 5 + face * 0.25, face === 1 ? 0 : Math.PI, 3, 2.9, 1.25);
    const deskX = center + side * 5.6, deskZ = row + 0.9;
    box(deskX, 0.49, deskZ, 3, 0.09, 0.85, TIMBER, { tag: `qin-hanfei:desk-${side}` });
    for (const edge of [-1, 1]) box(deskX + edge * 1.22, 0.04, deskZ, 0.14, 0.45, 0.65, looks.WOOD);
    for (const [index, offset] of [-0.7, 0.7].entries()) {
      slips(deskX + offset, 0.58, deskZ);
      scholar(deskX + offset, 0.04, deskZ + 0.95, `pupil-${side}-${index}`, Math.PI, true, index === 0);
    }
    box(deskX, 0.58, deskZ + 0.1, 0.27, 0.065, 0.2, INK);
    reserve(deskX, deskZ, 3.05, 0.95, 0.65);
    lantern(`porch-${side}`, center + side * 6.4, row + 5.3);
    for (const offset of [-2.8, 1.5]) lantern(`interior-${side}-${offset}`, center + side * 5.6, row + offset, 3.1, 1.5);
    lantern(`teacher-${side}`, center + side * 2.8, row - 3.3, 3.15, 1);
  }
  block(center, 3.35, row + 3.8, 4.8, 1.25, 0.34, looks.WOOD, 3.35);
  for (const offset of [-9.5, -4.5, 4.5, 9.5]) {
    block(center + offset, 0, row + 5.2, 0.8, 0.25, 0.8, looks.STONE);
    block(center + offset, 0.25, row + 5.2, 0.43, 4.35, 0.43, looks.WOOD, 0);
    for (let tier = 0; tier < 3; tier++) box(center + offset, 3.95 + tier * 0.19, row + 5.2, 0.65 + tier * 0.3, 0.17, 0.8 + tier * 0.25, TIMBER);
  }
  for (const offset of [-5, 3.8, 5.2]) box(center, 4.3, row + offset, width + 0.5, 0.3, 0.55, TIMBER);
  for (const offset of [-7, 0, 7]) box(center + offset, 4.25, row, 0.25, 0.35, depth, looks.WOOD);
  roof(center, 4.65, row, width + 3, depth + 4, 2.1);
  for (const offset of [-1.8, 1.8]) box(center + offset, 4.15, row + 5.42, 0.1, 0.27, 0.1, looks.WOOD);
  sign('韩非讲学堂', center, 3.15, row + 5.45, 4.7, 1);
  block(center, 0.04, row - 3.15, 6, 0.26, 2.9, looks.STONE, 0);
  box(center, 0.3, row - 3.15, 5.9, 0.035, 2.8, TIMBER);
  box(center, 0.3, row - 4.68, 5.4, 3.45, 0.12, BLUE);
  for (const offset of [-2.8, 2.8]) box(center + offset, 0.3, row - 4.55, 0.14, 3.45, 0.16, TIMBER);
  sign('研读 · 思辨', center, 2.85, row - 4.5, 3.8, 0.8);
  scholar(center, 0.335, row - 3.1, 'teacher', 0, false);
  box(center, 1.1, row - 2.25, 3.8, 0.13, 0.95, TIMBER, { tag: 'qin-hanfei:lectern' });
  for (const side of [-1, 1]) box(center + side * 1.5, 0.335, row - 2.25, 0.18, 0.765, 0.75, looks.WOOD);
  slips(center - 0.9, 1.23, row - 2.25, 1.1);
  box(center + 1.05, 1.23, row - 2.25, 0.42, 0.08, 0.28, INK);
  box(center + 0.58, 1.25, row - 2.25, 0.03, 0.03, 0.43, looks.WOOD);
  reserve(center, row - 3.1, 6, 3.15, 2.65);
  for (const side of [-1, 1]) {
    const benchX = center + side * 6;
    block(benchX, 0.38, row + 12.5, 2.8, 0.12, 0.65, looks.STONE, 0);
    for (const offset of [-0.95, 0.95]) box(benchX + offset, 0, row + 12.5, 0.28, 0.38, 0.55, looks.STONE);
    const planterX = center + side * 8;
    block(planterX, 0, row + 9.2, 1.6, 0.35, 1.6, looks.STONE);
    box(planterX, 0.35, row + 9.2, 1.35, 0.25, 1.35, { tex: 'hedge', tint: 0x9da981 });
    for (const offset of [-0.3, 0.3]) box(planterX + offset, 0.6, row + 9.2, 0.12, 0.15, 0.12, { tex: 'paint', tint: 0xe5d6a6 });
  }
}
