const STONE = { tex: 'travertine', tint: 0xd3cbb8 };
const PALE = { tex: 'travertine', tint: 0xeee3cb };
const JOINT = { tex: 'paint', tint: 0xa59d89 };
const SLATE = { tex: 'paint', tint: 0x7d8884 };
const TILE = { tex: 'roof', tint: 0xb4bdb9 };
const DARK = { tex: 'paint', tint: 0x59625f };
const TIMBER = { tex: 'wood_panel', tint: 0x876b50 };
const BRONZE = { tex: 'paint', tint: 0xbca478 };

export function buildQinGateway({ architecture, batch, bakes, obstacles, solids }) {
  const { block, roof, sign } = architecture;
  const center = 160, row = 56;
  const box = (feature, x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    architecture.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-gate:${feature}` });
  function reserve(x, y, z, width, height, depth) {
    const bounds = { x0: x - width / 2 - 0.05, x1: x + width / 2 + 0.05, z0: z - depth / 2 - 0.05, z1: z + depth / 2 + 0.05, y0: y, y1: y + height };
    solids.push(bounds); obstacles.push({ ...bounds, floor: y });
  }
  function light(id, x, y, z, power = 1.2, radius = 10) {
    bakes.push({ id: `qin-gate-${id}`, position: [x, y, z], power, radius, direction: null });
  }
  function brackets(x, y, z, width, depth) {
    for (const side of [-1, 1]) for (let offset = -width / 2 + 0.45; offset < width / 2; offset += 0.8) {
      box('corbel', x + offset, y, z + side * (depth / 2 - 0.13), 0.22, 0.36, 0.45, SLATE);
      box('corbel-cap', x + offset, y + 0.29, z + side * depth / 2, 0.45, 0.16, 0.65, PALE);
    }
    for (const side of [-1, 1]) for (let offset = -depth / 2 + 0.8; offset < depth / 2 - 0.5; offset += 0.85) {
      box('corbel', x + side * (width / 2 - 0.13), y, z + offset, 0.45, 0.36, 0.22, SLATE);
      box('corbel-cap', x + side * width / 2, y + 0.29, z + offset, 0.65, 0.16, 0.45, PALE);
    }
  }
  function tiledRoof(x, y, z, width, depth, rise) {
    roof(x, y, z, width, depth, rise, { surface: TILE, ridge: SLATE, trim: DARK });
    const ridgeWidth = Math.max(1.5, width - depth * 0.65);
    for (const side of [-1, 1]) {
      box('ridge-finial', x + side * (ridgeWidth / 2 - 0.1), y + rise + 0.28, z, 0.28, 0.54, 0.3, SLATE, { rz: side * 0.18 });
      box('ridge-finial', x + side * (ridgeWidth / 2 - 0.2), y + rise + 0.72, z, 0.38, 0.15, 0.36, PALE);
    }
  }
  function tower(column, major) {
    const width = major ? 6 : 4.5, shaftTop = major ? 8.35 : 5.75;
    block(column, 0, row, width + 0.85, 0.22, 7.5, STONE);
    block(column, 0.22, row, width + 0.55, 0.37, 7.15, PALE, 0);
    block(column, 0.59, row, width + 0.1, 0.47, 6.65, STONE, 0);
    box('base-band', column, 0.87, row, width + 0.2, 0.16, 6.75, JOINT);
    const courses = major ? 9 : 6, height = (shaftTop - 1.06) / courses;
    for (let course = 0; course < courses; course++) {
      const shrink = course * 0.055, wide = width - shrink * 2, deep = 6.4 - shrink * 1.1;
      const bottom = 1.06 + course * height;
      block(column, bottom, row, wide, height + 0.005, deep, STONE);
      for (const face of [-1, 1]) {
        box('stone-course', column, bottom + height - 0.045, row + face * (deep / 2 + 0.012), wide, 0.035, 0.022, JOINT);
        for (let offset = -wide / 2 + 0.7 + course % 2 * 0.55; offset < wide / 2 - 0.2; offset += 1.25) {
          box('stone-joint', column + offset, bottom + 0.04, row + face * (deep / 2 + 0.014), 0.026, height - 0.1, 0.024, JOINT);
        }
      }
      for (const face of [-1, 1]) box('stone-course', column + face * (wide / 2 + 0.012), bottom + height - 0.045, row, 0.022, 0.035, deep, JOINT);
    }
    for (let tier = 0; tier < 4; tier++) {
      const wide = width - 0.8 + tier * 0.65, deep = 5.9 + tier * 0.55;
      box('capital', column, shaftTop + tier * 0.28, row, wide, 0.29, deep, tier % 2 ? PALE : STONE);
    }
    brackets(column, shaftTop + 1.1, row, width + 1.15, 7.55);
    tiledRoof(column, shaftTop + 1.58, row, width + 3.2, 9.3, 1.35);
    for (const face of [-1, 1]) {
      box('tower-panel', column, shaftTop - 2.05, row + face * 3.04, width - 2, 1.2, 0.06, PALE);
      box('tower-panel', column, shaftTop - 1.9, row + face * 3.09, width - 2.35, 0.88, 0.045, SLATE);
      for (const offset of [-0.7, 0, 0.7]) {
        box('carved-relief', column + offset, shaftTop - 1.68, row + face * 3.13, 0.4, 0.43, 0.06, BRONZE, { rz: Math.PI / 4 });
      }
      box('uplight', column, 0.08, row + face * 4.2, 0.6, 0.2, 0.4, SLATE);
      box('uplight', column, 0.28, row + face * 4.2, 0.45, 0.06, 0.28, { tex: 'paint', tint: 0xffe0ac, emissive: 0.6 });
      light(`tower-${column}-${face}`, column, 3.5, row + face * 4.2, 1.1, 11);
    }
    if (!major) return;
    const upper = shaftTop + 3;
    block(column, upper, row, 4.6, 2.05, 4.45, STONE);
    for (const face of [-1, 1]) {
      for (const offset of [-1.1, 0, 1.1]) {
        box('upper-recess', column + offset, upper + 0.45, row + face * 2.25, 0.65, 0.85, 0.06, DARK);
        box('upper-lattice', column + offset, upper + 0.45, row + face * 2.3, 0.08, 0.85, 0.045, PALE);
        box('upper-lattice', column + offset, upper + 0.81, row + face * 2.3, 0.65, 0.09, 0.045, PALE);
      }
      box('upper-cornice', column, upper + 1.65, row + face * 2.28, 4.85, 0.18, 0.3, PALE);
    }
    brackets(column, upper + 2.05, row, 5.2, 5.1);
    tiledRoof(column, upper + 2.53, row, 7.7, 7.1, 1.25);
    light(`upper-${column}`, column, upper + 1.3, row + 3.5, 0.85, 9);
  }
  function doorFrame(x, width, height, front) {
    for (const side of [-1, 1]) {
      box('jamb', x + side * width / 2, 0, row + front * 3.04, 0.28, height, 0.28, TIMBER);
      reserve(x + side * width / 2, 0, row + front * 3.04, 0.28, height, 0.28);
    }
    box('lintel', x, height, row + front * 3.04, width + 1, 0.32, 0.4, TIMBER);
    reserve(x, height, row + front * 3.04, width + 1, 0.32, 0.4);
    box('lintel-trim', x, height + 0.33, row + front * 3.08, width + 1.3, 0.13, 0.5, PALE);
  }
  function guardian(column, side) {
    block(column, 0, 65.2, 3, 0.22, 4.4, STONE);
    block(column, 0.22, 65.2, 2.7, 0.35, 4.1, PALE, 0);
    box('guardian-plinth', column, 0.57, 65.2, 2.85, 0.14, 4.25, SLATE);
    batch.at(column, 0.71, 65.2, side * -0.08, () => {
      const piece = (feature, x, y, z, width, height, depth, look = PALE, rotation = {}) =>
        box(`guardian-${side}:${feature}`, x, y, z, width, height, depth, look, rotation);
      piece('body', 0, 0.57, 0, 1.15, 0.85, 1.95);
      piece('chest', 0, 0.63, 0.65, 1.13, 1.15, 0.85);
      for (const edge of [-1, 1]) for (const front of [-1, 1]) {
        piece('leg', edge * 0.43, 0.09, front * 0.66, 0.35, 0.72, 0.4);
        piece('paw', edge * 0.43, 0, front * 0.66 + 0.16, 0.52, 0.22, 0.68);
        for (const toe of [-0.15, 0, 0.15]) piece('claw', edge * 0.43 + toe, 0.03, front * 0.66 + 0.49, 0.065, 0.13, 0.06, JOINT);
      }
      piece('head', 0, 1.56, 0.85, 1.05, 0.78, 0.83);
      piece('muzzle', 0, 1.53, 1.32, 0.78, 0.4, 0.44);
      piece('nose', 0, 1.83, 1.56, 0.33, 0.17, 0.085, SLATE);
      piece('mouth', 0, 1.59, 1.55, 0.66, 0.045, 0.055, JOINT);
      for (const edge of [-1, 1]) {
        piece('eye', edge * 0.31, 2.03, 1.275, 0.15, 0.08, 0.04, DARK);
        piece('brow', edge * 0.32, 2.13, 1.29, 0.3, 0.1, 0.1, PALE, { rz: edge * 0.18 });
        piece('ear', edge * 0.44, 2.27, 0.65, 0.23, 0.4, 0.23, PALE, { rz: edge * -0.18 });
        for (let curl = 0; curl < 4; curl++) piece('mane', edge * 0.55, 1.3 + curl * 0.22, 0.7 - curl * 0.09, 0.18, 0.29, 0.35, curl % 2 ? STONE : PALE);
        for (let feather = 0; feather < 5; feather++) {
          piece('wing', edge * (0.65 + feather * 0.08), 0.83 + feather * 0.19, -0.1 - feather * 0.18,
            0.16, 0.75, 1.16 - feather * 0.1, feather % 2 ? STONE : PALE, { rx: -0.25, rz: edge * -0.32 });
        }
      }
      for (let segment = 0; segment < 4; segment++) piece('tail', 0, 0.8 + segment * 0.23, -1.02 - segment * 0.08, 0.18, 0.35, 0.22, STONE, { rx: -0.2 });
    });
    reserve(column, 0, 65.2, 3, 3.55, 4.4);
    box('guardian-light', column, 0.08, 67.85, 0.6, 0.16, 0.35, SLATE);
    box('guardian-light', column, 0.24, 67.85, 0.43, 0.05, 0.25, { tex: 'paint', tint: 0xffdfa8, emissive: 0.6 });
    light(`guardian-${side}`, column, 1.3, 67.85, 1.25, 8);
  }

  for (const side of [-1, 1]) {
    tower(center + side * 8, true);
    tower(center + side * 19, false);
    const passage = center + side * 14;
    block(passage, 4.55, row, 6.5, 1.75, 5.9, STONE);
    brackets(passage, 6.3, row, 6.4, 6.1);
    tiledRoof(passage, 6.78, row, 7.2, 7.3, 0.9);
    for (const face of [-1, 1]) doorFrame(passage, 4.15, 4.25, face);
    for (const edge of [-1, 1]) {
      const leaf = passage + edge * 2.01;
      block(leaf, 0, row + 1.2, 0.15, 3.8, 2.7, TIMBER);
      for (const level of [0.7, 1.75, 2.8]) for (const offset of [-0.8, 0, 0.8]) box('door-stud', leaf - edge * 0.09, level, row + 1.2 + offset, 0.04, 0.075, 0.075, BRONZE);
    }
    const wallX = center + side * 30;
    block(wallX, 0, row, 17.5, 3.8, 0.8, STONE);
    box('wing-wall-base', wallX, 0, row, 17.7, 0.45, 1, PALE);
    tiledRoof(wallX, 3.8, row, 18, 1.8, 0.5);
    for (const face of [-1, 1]) for (const offset of [-5, 0, 5]) {
      box('wall-relief', wallX + offset, 1.15, row + face * 0.44, 2.9, 1.5, 0.12, PALE);
      box('wall-relief', wallX + offset, 1.35, row + face * 0.52, 2.5, 1.1, 0.08, SLATE);
      for (const edge of [-1, 0, 1]) box('wave-relief', wallX + offset + edge * 0.66, 1.65, row + face * 0.58, 0.5, 0.4, 0.05, PALE, { rz: edge * 0.3 });
    }
    guardian(center + side * 19, side);
  }
  block(center, 5.8, row, 10.8, 1.35, 5.9, STONE);
  for (const face of [-1, 1]) doorFrame(center, 8.25, 5.5, face);
  tiledRoof(center, 7.15, row, 11.8, 7.3, 0.85);
  block(center, 8.02, row, 10.7, 2.55, 5.8, DARK);
  for (const face of [-1, 1]) {
    box('plaque-frame', center, 8.22, row + face * 2.96, 9.15, 1.98, 0.13, BRONZE);
    sign('秦皇求仙入海处', center, 8.4, row + face * 3.06, 8.7, 1.6, face === 1 ? 0 : Math.PI);
    for (const offset of [-4.8, 4.8]) box('plaque-pilaster', center + offset, 8.15, row + face * 2.99, 0.26, 2.25, 0.25, PALE);
    for (const side of [-1, 1]) {
      const column = center + side * 3.35, along = row + face * 2.65;
      box('lantern', column, 4.28, along, 0.53, 0.75, 0.53, { tex: 'paint', tint: 0xffe2b1, emissive: 0.55 });
      for (const height of [4.2, 5.03]) box('lantern', column, height, along, 0.7, 0.1, 0.7, DARK);
      box('lantern', column, 5.13, along, 0.05, 0.37, 0.05, BRONZE);
      light(`passage-${side}-${face}`, column, 4.55, along, 0.8, 8);
    }
  }
  brackets(center, 10.57, row, 11.8, 6.1);
  tiledRoof(center, 11.05, row, 13, 7.1, 1.3);
  for (const side of [-1, 1]) {
    box('plaza-edge', center + side * 24, -0.01, 66, 0.18, 0.03, 10, SLATE);
    box('plaza-inlay', center + side * 6.5, -0.005, 66, 0.14, 0.025, 10, BRONZE);
  }
  box('plaza-edge', center, -0.01, 71, 48, 0.03, 0.18, SLATE);
}
