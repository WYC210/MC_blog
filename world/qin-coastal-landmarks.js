import { QIN_CORRIDOR, QIN_WELL } from './qin-island-layout.js';

const STONE = { tex: 'travertine', tint: 0xd2cdbc };
const PALE = { tex: 'paint', tint: 0xe4dfcd };
const WOOD = { tex: 'wood_panel', tint: 0x96785b };
const BRONZE = { tex: 'paint', tint: 0xb7a17a };
const SAGE = { tex: 'paint', tint: 0x7f968d };
const SLATE = { tex: 'paint', tint: 0x687773 };
const TILE = { tex: 'roof', tint: 0xb6c2bc };

export function buildQinCoastalLandmarks({ architecture, batch, grid, bakes, obstacles, solids }) {
  let role = 'corridor';
  const box = (feature, x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-${role}:${feature}` });
  function solid(x, y, z, width, height, depth, ground = true) {
    const bounds = { x0: x - width / 2 - 0.035, x1: x + width / 2 + 0.035,
      z0: z - depth / 2 - 0.035, z1: z + depth / 2 + 0.035, y0: y, y1: y + height };
    solids.push(bounds);
    if (ground) obstacles.push({ ...bounds, floor: 0 });
  }
  function lantern(id, x, z) {
    box('lantern-hanger', x, 3.12, z, 0.045, 0.42, 0.045, BRONZE);
    box('lantern-shade', x, 2.66, z, 0.36, 0.46, 0.36, { tex: 'paint', tint: 0xffdfac, emissive: 0.5 });
    for (const height of [2.6, 3.12]) box('lantern-cap', x, height, z, 0.5, 0.07, 0.5, SLATE);
    for (const side of [-1, 1]) for (const face of [-1, 1]) box('lantern-frame', x + side * 0.19, 2.66, z + face * 0.19, 0.04, 0.46, 0.04, WOOD);
    bakes.push({ id: `qin-${role}-${id}`, position: [x, 2.85, z], power: 1.05, radius: 9, direction: null });
  }
  const corridor = QIN_CORRIDOR;
  grid.fill(224, -1, -65, 231, 0, -19, 'qin-plinth', 'qin-ground');
  for (let row = -62; row <= -22; row += 5) {
    for (const side of [-1, 1]) {
      if (side === -1 && row === -42) continue;
      const column = corridor.x + side * 2.5;
      box('column-base', column, 0, row, 0.68, 0.2, 0.68);
      box('column-base', column, 0.2, row, 0.48, 0.12, 0.48, PALE);
      box('column', column, 0.32, row, 0.28, 2.9, 0.28, WOOD);
      box('column-cap', column, 3.22, row, 0.5, 0.16, 0.5, BRONZE);
      box('brace', column - side * 0.42, 2.79, row, 0.16, 1.08, 0.18, WOOD, { rz: side * 0.72 });
      solid(column, 0, row, 0.68, 3.38, 0.68);
    }
    box('crossbeam', corridor.x, 3.3, row, 5.6, 0.25, 0.3, WOOD);
    box('beam-inlay', corridor.x, 3.36, row + 0.16, 4.9, 0.08, 0.025, SAGE);
  }
  for (const side of [-1, 1]) box('long-beam', corridor.x + side * 2.5, 3.32, corridor.z, 0.3, 0.25, 44, WOOD);
  box('ceiling', corridor.x, 3.56, corridor.z, 5.6, 0.12, 44, WOOD);
  solid(corridor.x, 3.56, corridor.z, 5.6, 0.12, 44, false);
  batch.at(corridor.x, 0, corridor.z, Math.PI / 2, () => {
    architecture.roof(0, 3.68, 0, 44, 6.7, 1.1, { surface: TILE, ridge: SLATE, trim: WOOD });
  });
  for (const height of [0.18, 0.88]) box('sea-rail', 230.6, height, corridor.z, 0.14, 0.13, 42);
  for (let row = -63; row <= -21; row += 2) {
    box('rail-post', 230.6, 0, row, 0.2, 1.06, 0.2);
    box('rail-cap', 230.6, 1.06, row, 0.3, 0.1, 0.3, PALE);
    if (row < -21) box('rail-inlay', 230.6, 0.39, row + 1, 0.1, 0.37, 0.2, SAGE);
  }
  solid(230.6, 0, corridor.z, 0.3, 1.16, 42);
  for (const row of [-29.5, -39.5, -49.5, -59.5]) {
    for (const offset of [-0.85, 0.85]) box('bench-leg', 229.1, 0, row + offset, 0.42, 0.36, 0.18);
    box('bench-seat', 229.1, 0.36, row, 0.5, 0.09, 2.2, WOOD);
    box('bench-back', 228.88, 0.62, row, 0.09, 0.22, 2.2, WOOD);
    for (const offset of [-0.98, 0.98]) box('bench-back-post', 228.88, 0.45, row + offset, 0.09, 0.39, 0.09, WOOD);
    solid(229.1, 0, row, 0.5, 0.84, 2.2);
  }
  for (const row of [-22, -32, -42, -52, -62]) lantern(String(-row), corridor.x, row);
  for (const [row, yaw] of [[-19.75, 0], [-64.25, Math.PI]]) {
    architecture.sign('望海长廊', corridor.x, 2.55, row, 4.3, 0.65, yaw);
    for (const side of [-1, 1]) box('sign-hanger', corridor.x + side * 1.65, 3.28, row - Math.cos(yaw) * 0.08, 0.07, 0.28, 0.07, BRONZE);
  }

  role = 'well';
  const well = QIN_WELL;
  grid.fill(222, -1, -16, 229, 0, -8, 'qin-plinth', 'qin-ground');
  grid.fill(well.x - 1, -3, well.z - 1, well.x + 1, 0, well.z + 1, null);
  for (const side of [-1, 1]) {
    box('shaft-wall', well.x, -3, well.z + side * 1.15, 2.6, 3.8, 0.3);
    box('shaft-wall', well.x + side * 1.15, -3, well.z, 0.3, 3.8, 2);
    box('rim', well.x, 0.8, well.z + side * 1.4, 3.12, 0.18, 0.32, PALE);
    box('rim', well.x + side * 1.4, 0.8, well.z, 0.32, 0.18, 2.48, PALE);
    const column = well.x + side * 1.9;
    box('column-base', column, 0, well.z, 0.56, 0.24, 0.56);
    box('column', column, 0.24, well.z, 0.28, 3.04, 0.28, WOOD);
    box('column-cap', column, 3.28, well.z, 0.5, 0.16, 0.5, BRONZE);
    box('brace', column - side * 0.46, 2.83, well.z, 0.16, 1.05, 0.18, WOOD, { rz: side * 0.72 });
    solid(column, 0, well.z, 0.56, 3.44, 0.56);
  }
  solid(well.x, -3, well.z, 3.12, 3.98, 3.12);
  for (const offset of [-0.65, 0, 0.65]) box('stone-inlay', well.x + offset, 0.28, well.z + 1.305, 0.22, 0.25, 0.025, SAGE);
  box('water', well.x, -1.65, well.z, 1.96, 0.06, 1.96, { tex: 'water', tint: 0x518d88, emissive: 0.08 });
  box('axle', well.x, 1.87, well.z, 4.05, 0.16, 0.16, WOOD);
  box('drum', well.x, 1.66, well.z, 0.7, 0.54, 0.54, WOOD);
  for (const side of [-1, 1]) box('drum-band', well.x + side * 0.28, 1.63, well.z, 0.08, 0.6, 0.6, BRONZE);
  box('crank', well.x + 2.1, 1.43, well.z, 0.13, 0.56, 0.13, BRONZE);
  box('crank-grip', well.x + 2.3, 1.43, well.z, 0.52, 0.12, 0.12, WOOD);
  solid(well.x + 2.22, 1.43, well.z, 0.7, 0.56, 0.16);
  box('rope', well.x, -0.22, well.z + 0.32, 0.045, 2.2, 0.045, BRONZE);
  box('bucket-bottom', well.x, -0.9, well.z + 0.32, 0.5, 0.06, 0.5, WOOD);
  for (const side of [-1, 1]) {
    box('bucket-wall', well.x + side * 0.215, -0.84, well.z + 0.32, 0.07, 0.38, 0.5, WOOD);
    box('bucket-wall', well.x, -0.84, well.z + 0.32 + side * 0.215, 0.36, 0.38, 0.07, WOOD);
    box('bucket-handle', well.x + side * 0.2, -0.46, well.z + 0.32, 0.035, 0.24, 0.035, BRONZE);
  }
  box('bucket-handle', well.x, -0.24, well.z + 0.32, 0.44, 0.035, 0.035, BRONZE);
  box('crossbeam', well.x, 3.22, well.z, 4.4, 0.25, 0.3, WOOD);
  box('ceiling', well.x, 3.48, well.z, 4.25, 0.12, 3, WOOD);
  solid(well.x, 3.48, well.z, 4.25, 0.12, 3, false);
  architecture.roof(well.x, 3.6, well.z, 5, 4, 1, { surface: TILE, ridge: SLATE, trim: WOOD });
  for (const side of [-1, 1]) lantern(side === -1 ? 'left' : 'right', well.x + side * 1.2, well.z + 1.2);
  box('plaque-base', 223.4, 0, -8.9, 2.9, 0.65, 0.42);
  solid(223.4, 0, -8.9, 2.9, 0.65, 0.42);
  architecture.sign('秦皇井', 223.4, 0.14, -8.66, 2.65, 0.45);
}
