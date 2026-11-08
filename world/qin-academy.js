const TIMBER = { tex: 'wood_panel', tint: 0xb99169 };
const PLASTER = { tex: 'plaster', tint: 0xe1d5bb };
const PAPER = { tex: 'paint', tint: 0xdcd4b7 };
const BAMBOO = { tex: 'paint', tint: 0xc5aa76 };
const FACE = { tex: 'paint', tint: 0xf0d5af };
const INK = { tex: 'paint', tint: 0x51463c };
const JADE = { tex: 'paint', tint: 0x83958b };

function lantern(architecture, bakes, id, x, y, z, power = 1.2) {
  const { box, looks } = architecture;
  box(x, y + 0.66, z, 0.06, 0.5, 0.06, looks.GOLD);
  box(x, y, z, 0.6, 0.1, 0.6, looks.WOOD);
  box(x, y + 0.1, z, 0.45, 0.53, 0.45, { tex: 'paint', tint: 0xffdfa4, emissive: 0.6 });
  box(x, y + 0.63, z, 0.65, 0.1, 0.65, looks.WOOD);
  for (const side of [-1, 1]) for (const edge of [-1, 1]) box(x + side * 0.24, y + 0.1, z + edge * 0.24, 0.05, 0.53, 0.05, looks.WOOD);
  bakes.push({ id, position: [x, y + 0.35, z], power, radius: 8, direction: null });
}

export function buildWarringGateway({ architecture, bakes }) {
  const { box, block, roof, sign, looks } = architecture;
  for (const offset of [-9.5, -5, 5, 9.5]) {
    const column = 112 + offset, height = Math.abs(offset) === 5 ? 6 : 4.6;
    block(column, 0, 44, 1.1, 0.24, 1.1, looks.STONE);
    box(column, 0.24, 44, 0.85, 0.28, 0.85, looks.PALE);
    block(column, 0.52, 44, 0.52, height - 0.52, 0.52, looks.WOOD, 0);
    for (const level of [0.65, height - 0.55]) box(column, level, 44, 0.6, 0.12, 0.6, looks.GOLD);
    for (let tier = 0; tier < 3; tier++) box(column, height - 0.55 + tier * 0.18, 44, 0.65 + tier * 0.3, 0.16, 0.9 + tier * 0.3, TIMBER);
  }
  box(112, 4.55, 44, 10.7, 1.35, 0.65, looks.WOOD);
  box(112, 5.92, 44, 12.2, 0.25, 0.9, TIMBER);
  box(112, 4.55, 44.36, 10.5, 0.12, 0.12, looks.GOLD);
  for (const offset of [-4, -3.25, 3.25, 4]) {
    box(112 + offset, 4.85, 44.36, 0.5, 0.5, 0.1, looks.GOLD, { tag: 'qin-seven:beam-detail' });
    box(112 + offset, 4.95, 44.43, 0.3, 0.3, 0.05, JADE);
  }
  roof(112, 6.16, 44, 13, 3.6, 1.35);
  sign('战国风情', 112, 4.72, 44.43, 4.8, 1.2);
  for (const side of [-1, 1]) {
    const column = 112 + side * 7.25;
    box(column, 3.6, 44, 4.5, 0.75, 0.5, looks.WOOD);
    box(column, 4.35, 44, 4.7, 0.25, 0.7, TIMBER);
    roof(column, 4.6, 44, 5.2, 3, 0.85);
    lantern(architecture, bakes, `qin-seven-lantern-${side}`, 112 + side * 3.8, 3.2, 44.7);
  }
}

export function buildJixiaAcademy({ architecture, batch, bakes, obstacles, solids }) {
  const { box, block, roof, sign, person, looks } = architecture;
  function reserve(x, z, width, depth, height, y = 0) {
    const bounds = { x0: x - width / 2 - 0.05, x1: x + width / 2 + 0.05, z0: z - depth / 2 - 0.05, z1: z + depth / 2 + 0.05, y0: y, y1: y + height };
    solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
  }
  function windowPanel(x, z, yaw, width = 2.5) {
    batch.at(x, 0.9, z, yaw, () => {
      box(0, 0, 0, width, 2.5, 0.1, looks.WOOD);
      box(0, 0.14, 0.07, width - 0.24, 2.22, 0.04, PAPER);
      for (let offset = -width / 2 + 0.35; offset < width / 2 - 0.2; offset += 0.36) box(offset, 0.14, 0.12, 0.06, 2.22, 0.06, TIMBER);
      for (const height of [0.7, 1.55]) box(0, height, 0.13, width - 0.24, 0.07, 0.07, TIMBER);
      box(0, -0.12, 0.04, width + 0.18, 0.14, 0.3, looks.STONE);
    });
  }
  function slips(x, y, z, width = 0.65) {
    for (let index = 0; index < 9; index++) box(x - width / 2 + (index + 0.5) * width / 9, y, z, width / 10, 0.035, 0.44, BAMBOO);
    for (const offset of [-0.13, 0.13]) box(x, y + 0.035, z + offset, width, 0.012, 0.025, INK);
    for (const offset of [-0.2, 0, 0.2]) box(x + offset, y + 0.04, z, 0.018, 0.012, 0.14, INK);
  }
  function pupil(x, z, index) {
    const robe = index % 2 ? { tex: 'paint', tint: 0xbba07b } : JADE;
    const shape = (column, height, row, width, tall, depth, material) => box(column, height, row, width, tall, depth, material, { tag: `qin-jixia:pupil-${index}` });
    shape(x, 0.02, z, 0.85, 0.07, 0.85, { tex: 'linen', tint: 0xcab78f });
    for (const side of [-1, 1]) shape(x + side * 0.18, 0.1, z - 0.12, 0.25, 0.26, 0.65, robe);
    shape(x, 0.25, z, 0.56, 0.56, 0.4, robe);
    shape(x, 0.72, z, 0.62, 0.16, 0.42, robe);
    shape(x, 0.84, z - 0.03, 0.37, 0.4, 0.36, FACE);
    shape(x, 1.2, z + 0.015, 0.4, 0.12, 0.38, INK);
    shape(x, 1.32, z + 0.05, 0.2, 0.12, 0.2, INK);
    for (const side of [-1, 1]) {
      shape(x + side * 0.32, 0.49, z - 0.21, 0.2, 0.32, 0.5, robe);
      shape(x + side * 0.25, 0.48, z - 0.48, 0.18, 0.12, 0.23, FACE);
      shape(x + side * 0.09, 1.05, z - 0.215, 0.055, 0.045, 0.025, INK);
    }
    shape(x, 0.39, z, 0.58, 0.07, 0.43, INK);
  }
  function writingDesk(x, z, index) {
    box(x, 0.47, z, 2.65, 0.08, 0.85, TIMBER, { tag: `qin-jixia:desk-${index}` });
    for (const side of [-1, 1]) box(x + side * 1.05, 0.02, z, 0.12, 0.45, 0.62, looks.WOOD);
    for (const side of [-1, 1]) {
      slips(x + side * 0.65, 0.55, z);
      pupil(x + side * 0.65, z + 1.05, index * 2 + (side === 1 ? 1 : 0));
    }
    box(x, 0.55, z + 0.1, 0.22, 0.06, 0.18, INK);
    box(x + 0.2, 0.56, z, 0.025, 0.025, 0.35, looks.WOOD);
    reserve(x, z + 0.5, 2.7, 2, 1.5);
  }
  function scrollCabinet(x, z) {
    box(x, 0.08, z, 0.85, 2.3, 2.6, looks.WOOD);
    const face = x < 112 ? 1 : -1;
    box(x + face * 0.44, 0.2, z, 0.06, 2.04, 2.36, INK);
    for (const height of [0.2, 0.85, 1.5, 2.2]) box(x + face * 0.52, height, z, 0.28, 0.08, 2.4, TIMBER);
    for (const height of [0.3, 0.95, 1.6]) for (const offset of [-0.75, 0, 0.75]) {
      box(x + face * 0.53, height, z + offset, 0.27, 0.33, 0.46, BAMBOO);
      box(x + face * 0.68, height + 0.13, z + offset, 0.025, 0.06, 0.48, looks.WOOD);
    }
    reserve(x, z, 1.4, 2.6, 2.4);
  }

  box(112, -0.12, 25.5, 19, 0.14, 14, looks.STONE);
  box(112, 0.02, 24.5, 17.4, 0.02, 10.6, { tex: 'wood_floor', tint: 0xc7b38d });
  block(112, 0, 19, 18, 4.6, 0.4, PLASTER);
  for (const side of [-1, 1]) {
    const column = 112 + side * 9;
    block(column, 0, 25, 0.4, 4.6, 12, PLASTER);
    box(column, 0, 25, 0.5, 0.55, 12, looks.STONE);
    for (const row of [21.8, 26.8]) for (const face of [-1, 1]) windowPanel(column + face * 0.24, row, face * Math.PI / 2);
    for (const row of [19, 24.2, 29.8]) box(column, 0.55, row, 0.5, 3.95, 0.38, looks.WOOD);
    box(column, 4.25, 25, 0.52, 0.3, 12.3, TIMBER);
    const front = 112 + side * 5.65;
    block(front, 0, 29.8, 6.7, 4.6, 0.34, PLASTER);
    box(front, 0, 30, 6.7, 0.75, 0.16, TIMBER);
    windowPanel(front, 30.01, 0, 4.3);
    windowPanel(front, 29.59, Math.PI, 4.3);
    block(112 + side * 2.4, 0, 29.1, 0.18, 3.05, 1.2, looks.WOOD);
    for (const height of [0.45, 1.4, 2.35]) box(112 + side * 2.28, height, 29.1, 0.06, 0.08, 1, looks.GOLD);
    scrollCabinet(112 + side * 7.7, 21.7);
    for (const [index, row] of [23.4, 26.6].entries()) writingDesk(112 + side * 4.8, row, index + (side === 1 ? 2 : 0));
    lantern(architecture, bakes, `qin-jixia-porch-${side}`, 112 + side * 6.6, 3.15, 31.5);
    for (const row of [22.8, 27.2]) lantern(architecture, bakes, `qin-jixia-hall-${side}-${row}`, 112 + side * 4.8, 3.1, row, 1.5);
  }
  block(112, 3.2, 29.8, 4.6, 1.4, 0.34, PLASTER, 3.2);
  for (const offset of [-8.5, -4.25, 4.25, 8.5]) {
    const column = 112 + offset;
    block(column, 0, 31, 0.8, 0.3, 0.8, looks.STONE);
    block(column, 0.3, 31, 0.42, 4.2, 0.42, looks.WOOD, 0);
    for (let tier = 0; tier < 3; tier++) box(column, 3.85 + tier * 0.2, 31, 0.6 + tier * 0.28, 0.16, 0.65 + tier * 0.22, TIMBER);
  }
  box(112, 4.25, 31, 18.5, 0.35, 0.6, TIMBER);
  box(112, 4.25, 19, 18.5, 0.35, 0.6, TIMBER);
  for (const column of [107.2, 112, 116.8]) box(column, 4.2, 25, 0.22, 0.35, 12, looks.WOOD);
  roof(112, 4.6, 25, 21, 15, 2.2);
  for (const offset of [-1.6, 1.6]) box(112 + offset, 4.08, 31.33, 0.12, 0.25, 0.12, looks.WOOD);
  sign('稷下学宫', 112, 3.1, 31.38, 4, 1);
  block(112, 0.04, 21.1, 6.5, 0.26, 2.6, looks.STONE, 0);
  box(112, 0.3, 21.1, 6.3, 0.04, 2.4, TIMBER);
  box(112, 0.3, 19.3, 4.8, 3.4, 0.12, JADE);
  for (const offset of [-2.5, 2.5]) box(112 + offset, 0.3, 19.4, 0.16, 3.4, 0.16, TIMBER);
  sign('百家争鸣', 112, 2.7, 19.5, 3.6, 0.9);
  person(112, 0.34, 20.8, 1.15, { tex: 'paint', tint: 0xd5ba96 }, 'scholar', 0, { face: FACE, trim: INK, detail: INK });
  box(112, 0.96, 21.75, 3.2, 0.12, 0.8, TIMBER, { tag: 'qin-jixia:lectern' });
  for (const side of [-1, 1]) box(112 + side * 1.25, 0.34, 21.75, 0.14, 0.62, 0.6, looks.WOOD);
  slips(111.4, 1.08, 21.75, 0.95);
  box(112.8, 1.08, 21.8, 0.35, 0.08, 0.25, INK);
  reserve(112, 21.1, 6.5, 2.6, 2.6);
  for (const side of [-1, 1]) lantern(architecture, bakes, `qin-jixia-lectern-${side}`, 112 + side * 3, 3.1, 20.8, 1);
}
