import { QIN_PAVILION, QIN_TERRACE } from './qin-island-layout.js';

const STONE = { tex: 'travertine', tint: 0xd2cdbc };
const PALE = { tex: 'paint', tint: 0xe4dfcd };
const WOOD = { tex: 'wood_panel', tint: 0x856851 };
const BRONZE = { tex: 'paint', tint: 0xb7a17a };
const SAGE = { tex: 'paint', tint: 0x7f968d };
const SLATE = { tex: 'paint', tint: 0x687773 };
const TILE = { tex: 'roof', tint: 0xb6c2bc };

export function buildQinGardenLandmarks({ architecture, batch, bakes, obstacles, solids }) {
  let role = 'pavilion';
  const box = (feature, x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-${role}:${feature}` });
  function solid(x, y, z, width, height, depth, floor = null, walkable = false) {
    const bounds = { x0: x - width / 2 - 0.035, x1: x + width / 2 + 0.035, z0: z - depth / 2 - 0.035, z1: z + depth / 2 + 0.035, y0: y, y1: y + height };
    solids.push({ ...bounds, walkable });
    if (floor !== null) obstacles.push({ ...bounds, floor });
  }
  function rail(x, y, z, length, yaw = 0) {
    batch.at(x, y, z, yaw, () => {
      for (const height of [0.16, 0.84]) box('rail', 0, height, 0, length, 0.13, 0.14, STONE);
      const count = Math.max(2, Math.ceil(length / 1.1));
      for (let index = 0; index <= count; index++) {
        const along = -length / 2 + length * index / count;
        box('rail-post', along, 0, 0, 0.18, 1.08, 0.18, STONE);
        box('rail-cap', along, 1.08, 0, 0.27, 0.1, 0.27, PALE);
        if (index < count) box('rail-carving', along + length / count / 2, 0.35, 0, 0.11, 0.42, 0.09, SAGE);
      }
    });
    const across = Math.abs(Math.cos(yaw)), along = Math.abs(Math.sin(yaw));
    solid(x, y, z, length * across + 0.22 * along, 1.2, length * along + 0.22 * across, y);
  }
  function bench(x, y, z, yaw = 0, length = 1.8) {
    batch.at(x, y, z, yaw, () => {
      for (const side of [-1, 1]) box('bench-leg', side * (length / 2 - 0.2), 0, 0, 0.2, 0.36, 0.44, STONE);
      box('bench-seat', 0, 0.36, 0, length, 0.09, 0.5, WOOD);
      for (const side of [-1, 1]) box('bench-back-post', side * (length / 2 - 0.12), 0.45, -0.22, 0.09, 0.45, 0.09, WOOD);
      box('bench-back', 0, 0.65, -0.22, length, 0.2, 0.08, WOOD);
    });
    const across = Math.abs(Math.cos(yaw)), along = Math.abs(Math.sin(yaw));
    solid(x, y, z, length * across + 0.5 * along, 0.94, length * along + 0.5 * across, y);
  }
  function lantern(id, x, y, z, hanging = false) {
    if (hanging) box('lantern-hanger', x, y + 0.52, z, 0.045, 0.4, 0.045, BRONZE);
    else box('lantern-base', x, y - 0.12, z, 0.55, 0.12, 0.55, STONE);
    box('lantern-shade', x, y, z, 0.38, 0.48, 0.38, { tex: 'paint', tint: 0xffdfac, emissive: 0.5 });
    for (const height of [y - 0.06, y + 0.48]) box('lantern-cap', x, height, z, 0.52, 0.08, 0.52, SLATE);
    for (const side of [-1, 1]) for (const face of [-1, 1]) box('lantern-frame', x + side * 0.2, y, z + face * 0.2, 0.045, 0.48, 0.045, WOOD);
    bakes.push({ id: `qin-${role}-${id}`, position: [x, y + 0.22, z], power: 0.95, radius: 9, direction: null });
  }
  function brackets(x, y, z, width, depth) {
    for (const side of [-1, 1]) {
      for (let along = -width / 2 + 0.4; along < width / 2; along += 0.8) {
        box('bracket', x + along, y, z + side * (depth / 2 - 0.2), 0.15, 0.24, 0.5, WOOD);
        box('bracket-cap', x + along, y + 0.18, z + side * depth / 2, 0.37, 0.12, 0.64, BRONZE);
      }
      for (let along = -depth / 2 + 0.6; along < depth / 2; along += 0.8) {
        box('bracket', x + side * (width / 2 - 0.2), y, z + along, 0.5, 0.24, 0.15, WOOD);
        box('bracket-cap', x + side * width / 2, y + 0.18, z + along, 0.64, 0.12, 0.37, BRONZE);
      }
    }
  }
  const pavilion = QIN_PAVILION;
  for (const side of [-1, 1]) {
    box('deck-border', pavilion.x + side * 4.35, 0.002, pavilion.z, 0.13, 0.015, 8.8, SAGE);
    box('deck-border', pavilion.x, 0.002, pavilion.z + side * 4.35, 8.8, 0.015, 0.13, SAGE);
    for (const face of [-1, 1]) {
      const column = pavilion.x + side * 3.3, row = pavilion.z + face * 3.3;
      box('column-foot', column, 0, row, 0.86, 0.15, 0.86, STONE);
      box('column-foot', column, 0.15, row, 0.64, 0.3, 0.64, PALE);
      box('column', column, 0.45, row, 0.42, 2.95, 0.42, WOOD);
      solid(column, 0, row, 0.86, 3.4, 0.86, 0);
      for (const height of [0.48, 3.1]) box('column-band', column, height, row, 0.47, 0.12, 0.47, BRONZE);
      box('capital', column, 3.35, row, 0.82, 0.18, 0.82, WOOD);
      box('capital', column, 3.53, row, 1.08, 0.12, 1.08, BRONZE);
      box('knee-brace', column - side * 0.46, 2.91, row, 0.15, 0.94, 0.17, WOOD, { rz: -side * Math.PI / 4 });
      box('knee-brace', column, 2.91, row - face * 0.46, 0.17, 0.94, 0.15, WOOD, { rx: face * Math.PI / 4 });
      rail(pavilion.x + side * 3.35, 0, pavilion.z + face * 4.35, 1.95);
      rail(pavilion.x + side * 4.35, 0, pavilion.z + face * 3.35, 1.95, Math.PI / 2);
      bench(pavilion.x + side * 3.7, 0, pavilion.z + face * 2.1, side * Math.PI / 2, 1.6);
      lantern(`${side}-${face}`, pavilion.x + side * 2.6, 2.44, pavilion.z + face * 2.6, true);
    }
    box('beam', pavilion.x, 3.55, pavilion.z + side * 3.3, 7.7, 0.28, 0.3, WOOD);
    box('beam-inlay', pavilion.x, 3.65, pavilion.z + side * 3.47, 7.3, 0.09, 0.04, SAGE);
    box('beam', pavilion.x + side * 3.3, 3.55, pavilion.z, 0.3, 0.28, 7.7, WOOD);
    for (const face of [-1, 1]) {
      box('ceiling-lattice', pavilion.x + face * 1.1, 3.77, pavilion.z + side * 1.1, 2.1, 0.12, 0.09, BRONZE);
      box('ceiling-lattice', pavilion.x + side * 1.1, 3.77, pavilion.z + face * 1.1, 0.09, 0.12, 2.1, BRONZE);
    }
  }
  box('ceiling', pavilion.x, 3.88, pavilion.z, 7.45, 0.13, 7.45, WOOD);
  box('ceiling-center', pavilion.x, 3.85, pavilion.z, 1.45, 0.1, 1.45, SAGE, { ry: Math.PI / 4 });
  brackets(pavilion.x, 3.82, pavilion.z, 7.9, 7.9);
  architecture.roof(pavilion.x, 4.18, pavilion.z, 10, 10, 1.35, { surface: TILE, ridge: SLATE, trim: WOOD });
  box('upper-drum', pavilion.x, 5.53, pavilion.z, 3.6, 1, 3.6, SAGE);
  for (const face of [-1, 1]) for (let along = -1.5; along <= 1.5; along += 0.5) {
    box('upper-lattice', pavilion.x + along, 5.71, pavilion.z + face * 1.82, 0.09, 0.65, 0.08, PALE);
    box('upper-lattice', pavilion.x + face * 1.82, 5.71, pavilion.z + along, 0.08, 0.65, 0.09, PALE);
  }
  brackets(pavilion.x, 6.52, pavilion.z, 4.05, 4.05);
  architecture.roof(pavilion.x, 6.88, pavilion.z, 5.9, 5.9, 1.05, { surface: TILE, ridge: SLATE, trim: WOOD });
  box('finial', pavilion.x, 8.15, pavilion.z, 0.45, 0.26, 0.45, BRONZE);
  box('finial', pavilion.x, 8.41, pavilion.z, 0.25, 0.36, 0.25, PALE, { ry: Math.PI / 4 });
  for (const face of [-1, 1]) {
    box('plaque-frame', pavilion.x, 2.95, pavilion.z + face * 3.62, 3.25, 0.65, 0.14, BRONZE);
    architecture.sign('祈寿亭', pavilion.x, 3.02, pavilion.z + face * 3.73, 3.05, 0.48, face === 1 ? 0 : Math.PI);
  }
  solid(pavilion.x, 3.88, pavilion.z, 7.45, 0.25, 7.45);
  for (const column of [204.9, 210.1]) {
    rail(column, 0, -51.55, 10.9, Math.PI / 2);
    rail(column, 0, -31.55, 8.9, Math.PI / 2);
  }
  for (const row of [-44.1, -38.9]) {
    rail(197.5, 0, row, 11, 0);
    rail(218, 0, row, 12, 0);
  }

  role = 'terrace';
  const terrace = QIN_TERRACE, stairs = terrace.stairs;
  box('base', terrace.x, 0, terrace.z, 12, terrace.floor - 0.18, 6, STONE);
  box('deck', terrace.x, terrace.floor - 0.18, terrace.z, 12, 0.18, 6, STONE);
  solid(terrace.x, 0, terrace.z, 12, terrace.floor, 6, null, true);
  for (const side of [-1, 1]) {
    box('cornice', terrace.x, 0.17, terrace.z + side * 2.97, 12, 0.13, 0.1, PALE);
    box('cornice', terrace.x + side * 5.97, 0.17, terrace.z, 0.1, 0.13, 6, PALE);
    for (let along = -4; along <= 4; along += 2) {
      box('wall-relief', terrace.x + along, 0.4, terrace.z + side * 3.015, 1.3, 0.3, 0.035, SAGE);
      for (const curve of [-1, 0, 1]) box('wave-relief', terrace.x + along + curve * 0.33, 0.46,
        terrace.z + side * 3.04, 0.28, 0.12, 0.04, PALE, { rz: curve * 0.3 });
    }
  }
  for (let step = 0; step < stairs.count; step++) {
    const row = stairs.z1 - (step + 0.5) * stairs.run, height = (step + 1) * stairs.rise;
    box('step', terrace.x, 0, row, stairs.x1 - stairs.x0, height, stairs.run, STONE);
    box('step-nosing', terrace.x, height - 0.04, row + stairs.run / 2 - 0.04, 4, 0.05, 0.08, PALE);
    solid(terrace.x, 0, row, 4, height, stairs.run, null, true);
    for (const side of [-1, 1]) {
      box('stair-side', terrace.x + side * 2.17, 0, row, 0.3, height + 0.12, stairs.run, STONE);
      solid(terrace.x + side * 2.17, 0, row, 0.3, height + 0.12, stairs.run, 0);
      if (step % 2 === 0) {
        box('stair-post', terrace.x + side * 2.17, height, row, 0.18, 0.96, 0.18, STONE);
        box('stair-cap', terrace.x + side * 2.17, height + 0.96, row, 0.26, 0.1, 0.26, PALE);
        solid(terrace.x + side * 2.17, height, row, 0.23, 1.06, 0.23);
      }
    }
  }
  const railLength = Math.hypot(3, 1.02);
  for (const side of [-1, 1]) {
    box('stair-handrail', terrace.x + side * 2.17, 1.655 - 0.12 / 2, -60.75, 0.14, 0.12, railLength,
      STONE, { rx: Math.atan2(1.02, 3) });
    solid(terrace.x + side * 2.17, 0.35, -60.5, 0.22, 1.9, 2.85);
    rail(terrace.x + side * 4.02, terrace.floor, -62.25, 3.45);
    rail(terrace.x + side * 5.75, terrace.floor, terrace.z, 5.5, Math.PI / 2);
    bench(terrace.x + side * 4.8, terrace.floor, terrace.z, side * Math.PI / 2, 2);
    for (const front of [-1, 1]) {
      const column = terrace.x + side * 5.35, row = terrace.z + front * 2.35;
      box('lamp-pedestal', column, terrace.floor, row, 0.54, 0.55, 0.54, STONE);
      solid(column, terrace.floor, row, 0.54, 1.25, 0.54, terrace.floor);
      lantern(`${side}-${front}`, column, terrace.floor + 0.55, row);
    }
  }
  rail(terrace.x, terrace.floor, -67.75, 11.5);
  for (let segment = 0; segment < 24; segment++) {
    const angle = segment * Math.PI / 12;
    box('floor-ring', terrace.x + Math.sin(angle) * 1.4, terrace.floor + 0.003, terrace.z + Math.cos(angle) * 1.4,
      0.38, 0.012, 0.06, SAGE, { ry: angle });
  }
  box('floor-star', terrace.x, terrace.floor + 0.004, terrace.z, 0.7, 0.013, 0.7, BRONZE, { ry: Math.PI / 4 });
  for (const [angle, width] of [[0, 1.95], [Math.PI / 2, 1.95], [Math.PI / 4, 1.55], [-Math.PI / 4, 1.55]])
    box('floor-ray', terrace.x, terrace.floor + 0.003, terrace.z, width, 0.01, 0.05, SAGE, { ry: angle });
  architecture.block(203, 0, -59.65, 3.1, 0.8, 0.45, STONE, 0);
  architecture.sign('升仙台', 203, 0.18, -59.4, 2.75, 0.5);
  bakes.push({ id: 'qin-terrace-stairs', position: [terrace.x, 1.4, -59.8], power: 0.75, radius: 7, direction: null });
}
