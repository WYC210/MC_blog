import { QIN_WARRIORS } from './qin-island-layout.js';

const LIMESTONE = { tex: 'paint', tint: 0xded5bd };
const CLAY = { tex: 'paint', tint: 0xd2b493 };
const SAGE = { tex: 'paint', tint: 0xb7c2b5 };
const FACE = { tex: 'paint', tint: 0xf1d8b7 };
const INK = { tex: 'paint', tint: 0x61564d };
const TRIM = { tex: 'paint', tint: 0xa38c6c };
const RIVER = { tex: 'paint', tint: 0x819c9b };

export function buildYiRiverFarewell({ architecture, batch, obstacles, solids }) {
  let role = 'setting', bounds = null;
  function box(feature, x, y, z, width, height, depth, look, rotation = {}) {
    const matrix = batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-warriors:${role}:${feature}` });
    if (bounds) {
      const elements = matrix.elements;
      for (const [axis, name] of ['x', 'y', 'z'].entries()) {
        const radius = (Math.abs(elements[axis]) + Math.abs(elements[axis + 4]) + Math.abs(elements[axis + 8])) / 2;
        bounds[`${name}0`] = Math.min(bounds[`${name}0`], elements[12 + axis] - radius - 0.05);
        bounds[`${name}1`] = Math.max(bounds[`${name}1`], elements[12 + axis] + radius + 0.05);
      }
    }
  }
  function beam(feature, start, end, width, look, depth = width) {
    const delta = end.map((coordinate, axis) => coordinate - start[axis]);
    const length = Math.hypot(...delta);
    box(feature, (start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      width, length, depth, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length) });
  }
  function actor(name, x, z, scale, yaw, robe, build) {
    role = name;
    bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    batch.at(x, 0.55, z, yaw, () => {
      const shape = (feature, column, height, row, width, tall, depth, look = robe, rotation = {}) =>
        box(feature, column * scale, height * scale, row * scale, width * scale, tall * scale, depth * scale, look, rotation);
      const limb = (feature, start, end, width, look = robe, depth = width) =>
        beam(feature, start.map(value => value * scale), end.map(value => value * scale), width * scale, look, depth * scale);
      function handPoint(point) {
        const column = point[0] - x, row = point[2] - z;
        return [(Math.cos(yaw) * column - Math.sin(yaw) * row) / scale, (point[1] - 0.55) / scale,
          (Math.sin(yaw) * column + Math.cos(yaw) * row) / scale];
      }
      function arm(side, elbow, hand, sleeve = 0.34) {
        limb(`sleeve-${side}`, [side * 0.42, 1.46, 0], elbow, sleeve);
        const length = Math.hypot(...hand.map((value, axis) => value - elbow[axis]));
        const wrist = hand.map((value, axis) => value - (value - elbow[axis]) / length * 0.13);
        const cuff = wrist.map((value, axis) => value - (hand[axis] - elbow[axis]) / length * 0.13);
        limb(`forearm-${side}`, elbow, cuff, sleeve * 0.92);
        limb(`cuff-${side}`, cuff, wrist, sleeve * 0.96, TRIM);
        shape(`hand-${side}`, hand[0], hand[1] - 0.085, hand[2], 0.2, 0.17, 0.22, FACE);
        for (let finger = 0; finger < 3; finger++) shape('fingers', hand[0] - 0.06 + finger * 0.06, hand[1] - 0.065, hand[2] + 0.115, 0.016, 0.1, 0.012, TRIM);
      }
      function head(hat, headYaw, beard = false) {
        shape('neck', 0, 1.49, 0, 0.22, 0.2, 0.24, FACE);
        batch.at(0, 1.63 * scale, 0, headYaw, () => {
          shape('face', 0, 0, 0.035, 0.38, 0.42, 0.37, FACE);
          shape('hair', 0, 0.08, -0.13, 0.41, 0.38, 0.15, INK);
          for (const side of [-1, 1]) {
            shape('ear', side * 0.21, 0.11, 0.015, 0.07, 0.16, 0.12, FACE);
            shape('eye', side * 0.09, 0.245, 0.226, 0.085, 0.034, 0.022, INK);
            shape('brow', side * 0.095, 0.3, 0.225, 0.105, 0.025, 0.024, INK, { rz: side * 0.14 });
          }
          shape('nose', 0, 0.13, 0.245, 0.075, 0.13, 0.13, FACE);
          shape('mouth', 0, 0.075, 0.226, 0.12, 0.025, 0.025, INK);
          shape('hair', 0, 0.4, 0, 0.42, 0.08, 0.4, INK);
          if (hat === 'knot') {
            shape('topknot', 0, 0.48, -0.045, 0.22, 0.24, 0.23, INK);
            shape('hair-tie', 0, 0.51, -0.045, 0.25, 0.06, 0.26, TRIM);
            shape('hair-pin', 0, 0.59, -0.045, 0.4, 0.035, 0.045, TRIM);
          } else if (hat === 'crown') {
            shape('crown', 0, 0.46, -0.04, 0.34, 0.35, 0.32, TRIM);
            shape('crown', 0, 0.78, -0.04, 0.41, 0.055, 0.37, INK);
            shape('crown-band', 0, 0.49, 0.13, 0.06, 0.29, 0.03, LIMESTONE);
          } else {
            shape('cap', 0, 0.46, -0.025, 0.43, 0.18, 0.4, TRIM);
            for (const side of [-1, 1]) shape('cap-tail', side * 0.21, 0.16, -0.12, 0.075, 0.31, 0.14, TRIM);
          }
          if (beard) {
            shape('beard', 0, -0.12, 0.16, 0.19, 0.17, 0.15, INK);
            for (const side of [-1, 1]) shape('moustache', side * 0.065, 0.1, 0.238, 0.09, 0.035, 0.035, INK, { rz: side * -0.15 });
          }
        });
      }
      shape('torso', 0, 0.99, 0, 0.62, 0.53, 0.46);
      shape('shoulders', 0, 1.36, -0.025, 0.84, 0.18, 0.43);
      limb('lapel', [-0.27, 1.54, 0.255], [0.2, 1.02, 0.255], 0.085, LIMESTONE, 0.045);
      limb('lapel', [0.26, 1.53, 0.26], [0.02, 1.27, 0.26], 0.075, TRIM, 0.045);
      shape('belt', 0, 0.99, 0, 0.68, 0.1, 0.51, INK);
      shape('belt-clasp', 0.08, 1, 0.27, 0.15, 0.085, 0.045, TRIM);
      build({ shape, limb, arm, head, handPoint });
    });
    solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
    bounds = null;
  }

  const { block, looks } = architecture;
  const { x: center, baseZ } = QIN_WARRIORS;
  block(center, 0, baseZ, 8.8, 0.24, 5.2, looks.STONE);
  block(center, 0.24, baseZ, 8.5, 0.2, 4.95, { tex: 'travertine', tint: 0xc8bea7 }, 0);
  block(center, 0.44, baseZ, 8.6, 0.11, 5, looks.PALE, 0);
  block(center, 0.55, baseZ - 2.3, 8.2, 1.08, 0.28, { tex: 'paint', tint: 0xa6b4aa }, 0);
  batch.at(center, 0, baseZ, 0, () => {
    for (const row of [-0.18, 0.08]) box('base-inlay', 0, 0.28 + row, 2.61, 8.45, 0.045, 0.025, TRIM);
    for (let ridge = 0; ridge < 3; ridge++) {
      for (let segment = 0; segment < 16; segment++) {
        const column = -3.8 + segment * 0.48, next = column + 0.48;
        beam('river-carving', [column, 0.78 + ridge * 0.22 + Math.sin(segment * 0.8) * 0.07, -2.145],
          [next, 0.78 + ridge * 0.22 + Math.sin((segment + 1) * 0.8) * 0.07, -2.145], 0.055, RIVER, 0.04);
      }
    }
    for (const side of [-1, 1]) for (let reed = 0; reed < 3; reed++) {
      const column = side * (3.55 + reed * 0.15), top = 1.2 + reed * 0.15;
      beam('reed', [column, 0.55, -1.65], [column + side * 0.12, top, -1.65], 0.045, TRIM);
      box('reed-head', column + side * 0.12, top - 0.05, -1.65, 0.09, 0.23, 0.09, LIMESTONE, { rz: -side * 0.12 });
    }
    const farewellHand = [-0.73, 2.28, 1.65], travellerHand = [-0.57, 2.3, 1.65];
    actor('farewell', -2, 0.8, 1.6, 0.42, LIMESTONE, ({ shape, limb, arm, head, handPoint }) => {
      for (const side of [-1, 1]) shape('shoe', side * 0.24, 0, 0.14, 0.26, 0.15, 0.48, INK);
      for (let tier = 0; tier < 7; tier++) shape('robe', 0, 0.13 + tier * 0.125, -0.035, 0.96 - tier * 0.045, 0.15, 0.62 - tier * 0.018);
      for (const side of [-1, 1]) limb('robe-fold', [side * 0.16, 0.98, 0.27], [side * 0.34, 0.18, 0.29], 0.045, TRIM, 0.025);
      shape('sash', 0.14, 0.37, 0.33, 0.13, 0.62, 0.05, TRIM, { rz: -0.1 });
      arm(1, [0.65, 1.22, 0.45], handPoint(farewellHand), 0.43);
      arm(-1, [-0.5, 1.02, 0.35], [0.15, 1.08, 0.74], 0.43);
      head('crown', 0.18, true);
    });
    actor('traveller', 0.6, 0.85, 1.7, -0.25, CLAY, ({ shape, limb, arm, head, handPoint }) => {
      for (const side of [-1, 1]) {
        const stride = side === 1 ? 0.3 : -0.12;
        limb('leg', [side * 0.2, 0.75, 0], [side * 0.27, 0.1, stride], 0.24, TRIM);
        shape('boot', side * 0.27, 0, stride + 0.1, 0.3, 0.21, 0.53, INK);
        for (let tier = 0; tier < 5; tier++) shape('robe', side * (0.24 - tier * 0.014), 0.34 + tier * 0.14,
          side === 1 ? 0.11 : -0.05, 0.43 - tier * 0.015, 0.17, 0.56 - tier * 0.025);
        limb('robe-fold', [side * 0.13, 0.98, 0.26], [side * 0.32, 0.38, 0.36], 0.045, LIMESTONE, 0.025);
        shape('mantle', side * 0.33, 1.21, -0.05, 0.28, 0.3, 0.52, LIMESTONE, { rz: side * 0.12 });
      }
      for (let fold = 0; fold < 4; fold++) shape('cloak', -0.25 + fold * 0.18, 0.48 + fold * 0.08, -0.38,
        0.22, 1.02 - fold * 0.08, 0.12, LIMESTONE, { rx: 0.17 + fold * 0.05, rz: -0.12 });
      limb('scabbard', [0.48, 0.98, 0.03], [0.68, 0.25, -0.1], 0.13, INK, 0.09);
      limb('sword-grip', [0.48, 1, 0.03], [0.43, 1.25, 0.075], 0.085, TRIM);
      shape('sword-guard', 0.48, 0.99, 0.03, 0.27, 0.045, 0.16, TRIM);
      arm(-1, [-0.7, 1.2, 0.25], handPoint(travellerHand), 0.33);
      arm(1, [0.65, 1.15, 0.12], [0.45, 1.1, 0.13], 0.32);
      head('knot', -0.08);
    });
    actor('attendant', 3, -0.7, 1.5, -0.25, SAGE, ({ shape, limb, arm, head }) => {
      for (const side of [-1, 1]) {
        shape('shoe', side * 0.23, 0, 0.11, 0.25, 0.13, 0.43, INK);
        limb('robe-fold', [side * 0.14, 0.98, 0.26], [side * 0.33, 0.19, 0.3], 0.04, LIMESTONE, 0.03);
        arm(side, [side * 0.51, 1.08, 0.3], [side * 0.42, 1.18, 0.71], 0.37);
      }
      for (let tier = 0; tier < 7; tier++) shape('robe', 0, 0.13 + tier * 0.125, 0, 0.86 - tier * 0.038, 0.15, 0.6 - tier * 0.018);
      shape('tray', 0, 1.26, 0.76, 1.4, 0.065, 0.66, INK);
      for (const side of [-1, 1]) {
        shape('tray-rim', side * 0.66, 1.325, 0.76, 0.065, 0.09, 0.66, TRIM);
        shape('tray-rim', 0, 1.325, 0.76 + side * 0.3, 1.4, 0.09, 0.06, TRIM);
      }
      for (const column of [-0.43, 0.38]) {
        shape('cup', column, 1.33, 0.8, 0.2, 0.13, 0.17, LIMESTONE);
        shape('cup-opening', column, 1.465, 0.8, 0.13, 0.012, 0.1, INK);
      }
      shape('ewer', -0.02, 1.33, 0.73, 0.23, 0.25, 0.24, TRIM);
      shape('ewer-neck', -0.02, 1.58, 0.73, 0.12, 0.16, 0.13, TRIM);
      limb('ewer-spout', [0.09, 1.48, 0.73], [0.23, 1.63, 0.73], 0.065, TRIM);
      head('cap', -0.16);
    });
  });
}
