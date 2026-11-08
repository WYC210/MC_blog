const ROBE = { tex: 'paint', tint: 0xc8d3c5 };
const LINEN = { tex: 'paint', tint: 0xeee4ca };
const CLAY = { tex: 'paint', tint: 0xcfae8e };
const FACE = { tex: 'paint', tint: 0xf0d9b7 };
const INK = { tex: 'paint', tint: 0x655d50 };
const TRIM = { tex: 'paint', tint: 0xa18d6d };
const WOOD = { tex: 'wood_panel', tint: 0xba9d79 };
const STONE = { tex: 'travertine', tint: 0xd4cbb7 };
const HERB = { tex: 'paint', tint: 0x849b74 };

export function buildBianQueHealing({ architecture, batch, bakes, obstacles, solids }) {
  let role = 'setting', bounds = null;
  function box(feature, x, y, z, width, height, depth, look = ROBE, rotation = {}) {
    const matrix = batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-bianque:${role}:${feature}` });
    if (!bounds) return;
    const elements = matrix.elements;
    for (const [axis, name] of ['x', 'y', 'z'].entries()) {
      const radius = (Math.abs(elements[axis]) + Math.abs(elements[axis + 4]) + Math.abs(elements[axis + 8])) / 2;
      bounds[`${name}0`] = Math.min(bounds[`${name}0`], elements[12 + axis] - radius - 0.04);
      bounds[`${name}1`] = Math.max(bounds[`${name}1`], elements[12 + axis] + radius + 0.04);
    }
  }
  function section(name, build) {
    role = name;
    bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    build();
    solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
    bounds = null;
  }
  function limb(feature, start, end, width, depth, look = ROBE) {
    const delta = end.map((value, axis) => value - start[axis]), length = Math.hypot(...delta);
    box(feature, (start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      width, length, depth, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length) });
  }
  function head(x, y, z, elder = false) {
    batch.at(x, y, z, 0, () => {
      box('face', 0, 0, 0.03, 0.38, 0.43, 0.36, FACE);
      box('hair', 0, 0.1, -0.15, 0.41, 0.33, 0.13, INK);
      for (const side of [-1, 1]) {
        box('ear', side * 0.21, 0.12, 0.025, 0.07, 0.14, 0.1, FACE);
        box('eye', side * 0.092, 0.255, 0.22, 0.078, 0.025, 0.025, INK);
        box('brow', side * 0.095, 0.31, 0.218, 0.1, 0.028, 0.028, elder ? TRIM : INK);
      }
      box('nose', 0, 0.14, 0.242, 0.075, 0.13, 0.1, FACE);
      box('mouth', 0, 0.085, 0.225, 0.12, 0.024, 0.025, INK);
      box('cap', 0, 0.42, -0.01, 0.43, 0.12, 0.4, elder ? LINEN : TRIM);
      box('cap-band', 0, 0.405, 0.196, 0.44, 0.045, 0.055, elder ? TRIM : LINEN);
      if (elder) {
        for (const side of [-1, 1]) box('moustache', side * 0.075, 0.105, 0.25, 0.12, 0.04, 0.045, TRIM);
        box('beard', 0, -0.06, 0.16, 0.21, 0.14, 0.16, LINEN);
        box('beard-tip', 0, -0.14, 0.17, 0.13, 0.12, 0.12, LINEN);
      } else box('hair-knot', 0, 0.53, -0.035, 0.17, 0.1, 0.18, INK);
    });
  }
  function collar(y, z, robe = ROBE) {
    box('torso', 0, y, z, 0.57, 0.5, 0.42, robe);
    limb('collar', [-0.24, y + 0.49, z + 0.23], [0.17, y + 0.03, z + 0.24], 0.075, 0.045, LINEN);
    limb('collar', [0.23, y + 0.49, z + 0.23], [-0.02, y + 0.24, z + 0.25], 0.07, 0.04, TRIM);
    box('belt', 0, y - 0.025, z, 0.62, 0.085, 0.46, TRIM);
    box('belt-knot', 0.06, y - 0.04, z + 0.26, 0.12, 0.13, 0.08, LINEN);
  }

  section('doctor', () => batch.at(127.95, 0, 20.8, 0.75, () => {
    for (const side of [-1, 1]) for (const end of [-1, 1]) box('chair-leg', side * 0.29, 0, end * 0.26 - 0.05, 0.11, 0.52, 0.11, WOOD);
    box('chair-seat', 0, 0.46, -0.06, 0.79, 0.08, 0.7, WOOD);
    box('chair-back', 0, 0.54, -0.35, 0.76, 0.42, 0.1, WOOD);
    box('robe-lap', 0, 0.55, 0.13, 0.68, 0.42, 0.7);
    for (const side of [-1, 1]) {
      box('draped-knee', side * 0.18, 0.19, 0.43, 0.28, 0.55, 0.31);
      box('shoe', side * 0.19, 0.04, 0.53, 0.23, 0.12, 0.4, INK);
      box('robe-fold', side * 0.19, 0.24, 0.596, 0.035, 0.45, 0.025, TRIM);
    }
    collar(1, 0.07);
    head(0, 1.5, 0.29, true);
    limb('sleeve', [-0.29, 1.43, 0.1], [-0.42, 1.14, 0.51], 0.27, 0.3);
    limb('sleeve', [-0.42, 1.14, 0.51], [-0.02, 1.03, 1.01], 0.23, 0.25);
    limb('sleeve', [0.29, 1.43, 0.1], [0.43, 1.19, 0.52], 0.27, 0.3);
    limb('sleeve', [0.43, 1.19, 0.52], [0.2, 1.1, 0.9], 0.23, 0.25);
    box('support-hand', -0.02, 0.97, 1.06, 0.15, 0.09, 0.21, FACE);
    box('pulse-palm', 0.2, 1.075, 0.97, 0.15, 0.07, 0.16, FACE);
    for (let finger = 0; finger < 3; finger++) box('pulse-finger', 0.15 + finger * 0.05, 1.015, 1.055, 0.034, 0.085, 0.065, FACE);
  }));

  section('bed', () => {
    for (const column of [128.25, 130.75]) for (const row of [22.05, 22.75]) box('leg', column, 0, row, 0.13, 0.58, 0.13, WOOD);
    box('frame', 129.5, 0.51, 22.4, 2.8, 0.16, 1.02, WOOD);
    box('mattress', 129.5, 0.67, 22.4, 2.68, 0.12, 0.91, LINEN);
    box('headboard', 130.94, 0.54, 22.4, 0.1, 0.4, 1.04, WOOD);
    box('pillow', 130.59, 0.79, 22.4, 0.62, 0.16, 0.7, LINEN);
    for (const row of [21.89, 22.91]) box('side-rail', 129.5, 0.55, row, 2.82, 0.06, 0.07, TRIM);
  });
  section('patient', () => {
    box('robe', 129.65, 0.79, 22.4, 1.12, 0.34, 0.61, CLAY);
    box('blanket', 128.75, 0.8, 22.4, 1.2, 0.26, 0.73, ROBE);
    box('blanket-edge', 129.32, 0.8, 22.4, 0.07, 0.29, 0.77, LINEN);
    for (const row of [22.17, 22.4, 22.63]) box('blanket-fold', 128.73, 1.06, row, 1.12, 0.018, 0.025, TRIM);
    box('neck', 130.24, 0.97, 22.4, 0.24, 0.13, 0.22, FACE);
    box('face', 130.55, 0.96, 22.4, 0.5, 0.3, 0.46, FACE);
    box('hair', 130.78, 0.96, 22.4, 0.13, 0.33, 0.49, INK);
    for (const side of [-1, 1]) {
      box('ear', 130.55, 1.06, 22.4 + side * 0.25, 0.13, 0.11, 0.07, FACE);
      box('eye', 130.51, 1.264, 22.4 + side * 0.105, 0.024, 0.016, 0.09, INK);
      box('brow', 130.57, 1.264, 22.4 + side * 0.105, 0.022, 0.018, 0.11, TRIM);
    }
    box('nose', 130.43, 1.25, 22.4, 0.13, 0.1, 0.07, FACE);
    box('mouth', 130.34, 1.264, 22.4, 0.024, 0.016, 0.13, INK);
    limb('resting-sleeve', [130.04, 1.02, 22.66], [129.6, 1.05, 22.76], 0.2, 0.21, CLAY);
    box('resting-hand', 129.35, 1.03, 22.7, 0.29, 0.085, 0.13, FACE);
    limb('pulse-sleeve', [130.03, 1.03, 22.16], [129.51, 1.04, 21.48], 0.2, 0.23, CLAY);
    limb('forearm', [129.48, 1.03, 21.47], [128.87, 1.03, 21.44], 0.14, 0.14, FACE);
    box('wrist', 128.82, 0.98, 21.44, 0.2, 0.08, 0.14, FACE);
    box('palm', 128.67, 0.97, 21.44, 0.19, 0.075, 0.17, FACE);
  });
  section('pulse-table', () => {
    for (const column of [128.64, 129.34]) for (const row of [21.21, 21.7]) box('leg', column, 0, row, 0.09, 0.82, 0.09, WOOD);
    box('top', 128.99, 0.8, 21.45, 0.95, 0.08, 0.7, WOOD);
    box('wrist-cushion', 128.99, 0.88, 21.44, 0.58, 0.1, 0.29, LINEN);
  });

  section('assistant', () => batch.at(131.65, 0, 20.7, -0.45, () => {
    box('robe', 0, 0.18, 0, 0.66, 0.76, 0.53, CLAY);
    for (const side of [-1, 1]) {
      box('shoe', side * 0.18, 0.03, 0.08, 0.23, 0.14, 0.37, INK);
      box('robe-fold', side * 0.2, 0.21, 0.277, 0.03, 0.63, 0.025, TRIM);
      limb('sleeve', [side * 0.28, 1.37, 0], [side * 0.42, 1.1, 0.24], 0.23, 0.25, CLAY);
      limb('sleeve', [side * 0.42, 1.1, 0.24], [side * 0.32, 1.05, 0.57], 0.2, 0.22, CLAY);
      box('hand', side * 0.32, 1.015, 0.62, 0.14, 0.1, 0.16, FACE);
    }
    collar(0.94, 0, CLAY);
    head(0, 1.43, 0.035);
    box('tray', 0, 1.12, 0.6, 0.88, 0.06, 0.5, WOOD);
    for (const side of [-1, 1]) box('tray-edge', side * 0.43, 1.18, 0.6, 0.05, 0.06, 0.52, TRIM);
    box('medicine-bowl', -0.18, 1.18, 0.6, 0.25, 0.14, 0.24, LINEN);
    box('bowl-content', -0.18, 1.31, 0.6, 0.18, 0.02, 0.17, TRIM);
    box('herb-packet', 0.19, 1.18, 0.6, 0.22, 0.16, 0.27, ROBE);
    box('packet-tie', 0.19, 1.18, 0.6, 0.035, 0.18, 0.29, TRIM);
  }));

  section('cabinet', () => {
    box('case', 129.65, 0.12, 19.35, 1.95, 1.37, 0.5, WOOD);
    for (let row = 0; row < 3; row++) for (let column = 0; column < 3; column++) {
      const across = 129.03 + column * 0.62, height = 0.23 + row * 0.39;
      box('drawer', across, height, 19.62, 0.56, 0.33, 0.08, LINEN);
      box('handle', across, height + 0.1, 19.68, 0.12, 0.06, 0.055, TRIM);
      box('label', across, height + 0.23, 19.67, 0.16, 0.035, 0.025, INK);
    }
    for (const column of [128.95, 130.35]) box('foot', column, 0, 19.35, 0.16, 0.15, 0.4, WOOD);
    box('cap', 129.65, 1.49, 19.35, 2.06, 0.09, 0.62, TRIM);
    for (const column of [129.12, 129.65, 130.18]) {
      box('jar', column, 1.58, 19.35, 0.27, 0.29, 0.27, column === 129.65 ? ROBE : CLAY);
      box('jar-lid', column, 1.87, 19.35, 0.31, 0.055, 0.31, LINEN);
    }
  });
  section('herbs', () => {
    for (const column of [125.55, 126.85]) for (const row of [22.5, 23.15]) box('table-leg', column, 0, row, 0.1, 0.73, 0.1, WOOD);
    box('table', 126.2, 0.71, 22.82, 1.55, 0.08, 0.94, WOOD);
    box('mortar-foot', 125.8, 0.79, 22.8, 0.3, 0.08, 0.3, STONE);
    box('mortar', 125.8, 0.87, 22.8, 0.4, 0.16, 0.4, STONE);
    box('mortar-well', 125.8, 1.03, 22.8, 0.25, 0.018, 0.25, INK);
    limb('pestle', [125.83, 1.03, 22.8], [125.99, 1.37, 22.76], 0.09, 0.09, WOOD);
    box('herb-tray', 126.5, 0.79, 22.82, 0.64, 0.07, 0.62, TRIM);
    for (let sprig = 0; sprig < 4; sprig++) {
      const column = 126.3 + sprig * 0.13;
      box('stem', column, 0.87, 22.82, 0.025, 0.025, 0.43, TRIM, { ry: sprig * 0.13 });
      for (const side of [-1, 1]) box('leaf', column + side * 0.04, 0.88, 22.8 + side * 0.09, 0.1, 0.035, 0.15, HERB, { ry: side * 0.5 });
    }
  });
  section('plaque', () => {
    box('base', 129, 0, 26, 4.4, 0.62, 0.42, STONE);
    architecture.sign('扁鹊行医', 129, 0.14, 26.23, 4.05, 0.43);
  });
  role = 'lighting';
  for (const [index, column, row] of [[0, 125.4, 24.6], [1, 132.5, 24.6], [2, 130, 18.3]]) {
    box('base', column, 0.06, row, 0.4, 0.12, 0.3, TRIM);
    box('lens', column, 0.18, row, 0.3, 0.055, 0.22, { tex: 'paint', tint: 0xffdfaf, emissive: 0.5 });
    bakes.push({ id: `qin-bianque-${index}`, position: [column, 1.5, row], power: 1.5, radius: 7.5, direction: null });
  }
}
