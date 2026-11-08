import { QIN_ATTRACTIONS } from './qin-island-layout.js';

const PEARL = { tex: 'paint', tint: 0xdde2d7 };
const LIMESTONE = { tex: 'paint', tint: 0xdcd7c7 };
const FACE = { tex: 'paint', tint: 0xebe8d9 };
const EDGE = { tex: 'paint', tint: 0xf0eddf };
const FOLD = { tex: 'paint', tint: 0xa4afa2 };
const HAIR = { tex: 'paint', tint: 0x8c9789 };
const INK = { tex: 'paint', tint: 0x48534c };
const BAMBOO = { tex: 'paint', tint: 0xb6b7a2 };

export function buildQinEastStatues({ architecture, batch, bakes, obstacles, solids }) {
  let role = '', bounds = null;
  function box(feature, x, y, z, width, height, depth, look, rotation = {}) {
    const matrix = batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-${role}:${feature}` });
    if (!bounds) return;
    const elements = matrix.elements;
    for (const [axis, name] of ['x', 'y', 'z'].entries()) {
      const radius = (Math.abs(elements[axis]) + Math.abs(elements[axis + 4]) + Math.abs(elements[axis + 8])) / 2;
      bounds[`${name}0`] = Math.min(bounds[`${name}0`], elements[12 + axis] - radius - 0.04);
      bounds[`${name}1`] = Math.max(bounds[`${name}1`], elements[12 + axis] + radius + 0.04);
    }
  }
  function beam(feature, start, end, width, depth, look) {
    const delta = end.map((coordinate, axis) => coordinate - start[axis]), length = Math.hypot(...delta);
    box(feature, (start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      width, length, depth, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length) });
  }
  function section(build) {
    bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    build();
    solids.push(bounds);
    if (bounds.y0 < 1.8) obstacles.push({ ...bounds, floor: 0 });
    bounds = null;
  }
  function pedestal(center, width, depth, motif) {
    for (let tier = 0; tier < 3; tier++) architecture.block(center.x, tier * 0.18, center.z,
      width - tier * 0.22, 0.18, depth - tier * 0.2, { tex: 'travertine', tint: 0xc5c5b5 }, 0);
    for (const face of [-1, 1]) for (let segment = -3; segment <= 3; segment++) {
      const column = center.x + segment * 0.52;
      box('plinth-relief', column, 0.25, center.z + face * (depth / 2 - 0.09), 0.39, 0.11, 0.06,
        motif === 'river' ? FOLD : BAMBOO, { rz: Math.sin(segment * 1.3) * 0.32 });
    }
  }
  function figure(center, scale, yaw, robe, build) {
    batch.at(center.x, 0.54, center.z, yaw, () => {
      const shape = (feature, x, y, z, width, height, depth, look = robe, rotation = {}) =>
        box(feature, x * scale, y * scale, z * scale, width * scale, height * scale, depth * scale, look, rotation);
      const limb = (feature, start, end, width, depth, look = robe) =>
        beam(feature, start.map(value => value * scale), end.map(value => value * scale), width * scale, depth * scale, look);
      function head({ x = 0, y, z = 0, pitch = 0, yaw = 0, elder = false }) {
        batch.at(x * scale, y * scale, z * scale, yaw, () => {
          const headBox = (feature, column, bottom, row, width, height, depth, look = FACE) => {
            const center = bottom + height / 2;
            shape(feature, column, center * Math.cos(pitch) - row * Math.sin(pitch) - height / 2,
              center * Math.sin(pitch) + row * Math.cos(pitch), width, height, depth, look, { rx: pitch });
          };
          headBox('jaw', 0, -0.22, 0.025, 0.29, 0.15, 0.29);
          headBox('face', 0, -0.1, 0, elder ? 0.4 : 0.36, 0.34, 0.35);
          headBox('forehead', 0, 0.22, -0.01, 0.36, 0.1, 0.34);
          headBox('hair', 0, -0.04, -0.165, 0.38, 0.38, 0.12, HAIR);
          for (const side of [-1, 1]) {
            headBox('ear', side * 0.205, 0, 0, 0.065, 0.15, 0.12);
            headBox('temple', side * 0.177, 0.06, -0.08, 0.055, 0.27, 0.2, HAIR);
            headBox('brow', side * 0.09, 0.16, 0.185, 0.14, 0.033, 0.055, HAIR);
            headBox('eye', side * 0.09, 0.12, 0.207, 0.088, 0.023, 0.025, INK);
            headBox('lower-lid', side * 0.09, 0.09, 0.2, 0.12, 0.022, 0.045, EDGE);
            headBox('cheek', side * 0.12, -0.035, 0.175, 0.095, 0.1, 0.06);
            headBox('moustache', side * 0.05, -0.092, 0.2, 0.105, 0.032, 0.045, HAIR);
          }
          headBox('nose', 0, -0.018, 0.205, 0.072, 0.15, 0.105);
          headBox('nose-tip', 0, -0.035, 0.257, 0.09, 0.06, 0.06);
          headBox('mouth', 0, -0.135, 0.185, 0.12, 0.02, 0.025, INK);
          if (elder) {
            for (let tier = 0; tier < 7; tier++) {
              headBox('long-beard', 0.025 - tier * 0.004, -0.57 + tier * 0.065, 0.16 + tier * 0.011,
                0.07 + tier * 0.036, 0.07, 0.12, EDGE);
              for (const side of [-1, 1]) headBox('beard-strand', side * (0.012 + tier * 0.012), -0.57 + tier * 0.065,
                0.225 + tier * 0.011, 0.013, 0.07, 0.015, FOLD);
            }
            headBox('topknot', 0, 0.31, -0.035, 0.19, 0.25, 0.21, EDGE);
            headBox('hair-tie', 0, 0.4, -0.035, 0.21, 0.045, 0.22, FOLD);
            headBox('hair-pin', 0, 0.46, -0.035, 0.33, 0.035, 0.035, BAMBOO);
          } else {
            for (let tier = 0; tier < 4; tier++) headBox('beard', 0, -0.33 + tier * 0.05, 0.16,
              0.055 + tier * 0.035, 0.055, 0.075, HAIR);
            headBox('cap', 0, 0.31, -0.015, 0.35, 0.12, 0.34, PEARL);
            headBox('cap-ridge', 0, 0.42, -0.05, 0.16, 0.17, 0.24, EDGE);
            headBox('cap-band', 0, 0.32, 0.164, 0.36, 0.04, 0.035, FOLD);
            for (const side of [-1, 1]) headBox('cap-ribbon', side * 0.17, -0.11, -0.2, 0.045, 0.48, 0.055, FOLD);
          }
        });
      }
      build({ shape, limb, head });
    });
  }
  function lighting(center) {
    for (const [side, front] of [[-1, 1], [1, 1], [0, -1]]) {
      const column = center.x + side * 2.65, row = center.z + front * 1.65;
      box('uplight', column, 0.02, row, 0.36, 0.16, 0.28, FOLD);
      box('uplight-lens', column, 0.18, row, 0.27, 0.035, 0.2, { tex: 'paint', tint: 0xffe5b8, emissive: 0.45 });
      bakes.push({ id: `qin-${role}-${side}-${front}`, position: [column, front === 1 ? 2.8 : 3.6, row],
        power: front === 1 ? 1.3 : 0.9, radius: 10, direction: null });
    }
  }

  role = 'quyuan';
  const poet = QIN_ATTRACTIONS.find(item => item.id === 'qin-quyuan');
  pedestal(poet, 4.8, 3.8, 'river');
  figure(poet, 2.6, -0.1, PEARL, ({ shape, limb, head }) => {
    section(() => {
      for (const side of [-1, 1]) shape('shoe', side * 0.16, 0, side === -1 ? 0.14 : -0.04, 0.23, 0.12, 0.43, FOLD, { ry: side * 0.13 });
      for (let tier = 0; tier < 10; tier++) {
        const fraction = tier / 9, center = -0.07 + fraction * 0.07, front = 0.27 - fraction * 0.075;
        shape('robe', center, 0.1 + tier * 0.106, -0.03, 0.76 - fraction * 0.22, 0.11, 0.6 - fraction * 0.15);
        for (const side of [-1, 1]) {
          shape('robe-fold', center + side * (0.26 - fraction * 0.09), 0.1 + tier * 0.106, front + 0.01, 0.055, 0.11, 0.075, EDGE);
          shape('back-fold', center + side * (0.2 - fraction * 0.07), 0.1 + tier * 0.106, -0.32 + fraction * 0.075, 0.05, 0.11, 0.06, EDGE);
        }
      }
      shape('torso', 0, 1.14, 0, 0.55, 0.43, 0.44);
      shape('shoulder', 0, 1.49, -0.015, 0.67, 0.16, 0.45);
      shape('neck', 0, 1.57, -0.015, 0.2, 0.23, 0.21, FACE);
      limb('crossed-collar', [-0.23, 1.61, 0.24], [0.19, 1.14, 0.25], 0.09, 0.055, EDGE);
      limb('crossed-collar', [0.22, 1.61, 0.24], [-0.04, 1.32, 0.27], 0.085, 0.055, EDGE);
      shape('belt', 0, 1.07, -0.015, 0.59, 0.085, 0.49, FOLD);
      shape('knot', 0.04, 1.03, 0.26, 0.15, 0.13, 0.11, EDGE);
      for (const side of [-1, 1]) limb('sash', [0.04 + side * 0.03, 1.04, 0.28], [side * 0.16, 0.63, 0.33], 0.07, 0.04, EDGE);
      limb('back-seam', [0, 1.55, -0.25], [-0.05, 1.17, -0.26], 0.045, 0.03, FOLD);
    });
    for (const side of [-1, 1]) section(() => {
      const left = side === -1;
      const shoulder = [side * 0.28, 1.52, 0], elbow = [side * (left ? 0.55 : 0.66), left ? 1.9 : 1.82, 0.08];
      const wrist = [side * (left ? 0.68 : 1.02), left ? 2.52 : 2.19, 0.13];
      limb('raised-upper-arm', shoulder, elbow, 0.28, 0.39);
      limb('raised-forearm', elbow, wrist, 0.26, 0.34);
      for (let strip = 0; strip < 9; strip++) {
        const fraction = strip / 8;
        const column = side * (0.31 + fraction * (left ? 0.36 : 0.7));
        const top = 1.56 + fraction * (left ? 0.88 : 0.55);
        const bottom = 1.04 + fraction * fraction * (left ? 1.24 : 0.94);
        shape('draped-sleeve', column, bottom, 0.04, left ? 0.065 : 0.105, top - bottom, 0.34);
        shape('sleeve-hem', column, bottom - 0.015, 0.23, left ? 0.075 : 0.11, 0.075, 0.055, EDGE);
        if (strip % 2 === 0) shape('sleeve-fold', column, bottom + 0.07, 0.225, 0.025, Math.max(0.04, top - bottom - 0.11), 0.04, FOLD);
      }
      limb('cuff', [wrist[0] - side * 0.035, wrist[1] - 0.085, wrist[2]], wrist, 0.29, 0.37, EDGE);
      shape('palm', wrist[0] + side * 0.035, wrist[1] - 0.005, wrist[2] + 0.01, 0.17, 0.2, 0.12, FACE, { rz: -side * 0.28 });
      for (let finger = 0; finger < 4; finger++) {
        const start = [wrist[0] - 0.055 + finger * 0.039 + side * 0.055, wrist[1] + 0.16, wrist[2] + 0.02];
        const end = [start[0] + side * 0.035, start[1] + 0.13 + (finger === 1 || finger === 2 ? 0.035 : 0), start[2] - 0.015];
        limb('finger', start, end, 0.029, 0.045, FACE);
      }
      limb('thumb', [wrist[0] - side * 0.03, wrist[1] + 0.025, wrist[2] + 0.07],
        [wrist[0] - side * 0.12, wrist[1] + 0.14, wrist[2] + 0.08], 0.045, 0.045, FACE);
    });
    section(() => head({ y: 1.92, z: -0.025, pitch: -0.24, yaw: 0.17 }));
  });
  lighting(poet);

  role = 'xufu';
  const traveller = QIN_ATTRACTIONS.find(item => item.id === 'qin-xufu');
  pedestal(traveller, 4.8, 4, 'sea');
  figure(traveller, 2.55, 0.08, LIMESTONE, ({ shape, limb, head }) => {
    section(() => {
      for (const side of [-1, 1]) shape('shoe', side * 0.2, 0, 0.05, 0.25, 0.14, 0.45, FOLD);
      for (let tier = 0; tier < 10; tier++) {
        const fraction = tier / 9;
        shape('robe', 0, 0.12 + tier * 0.105, -0.035, 0.95 - fraction * 0.26, 0.11, 0.65 - fraction * 0.11);
        for (const side of [-1, 1]) {
          shape('robe-fold', side * (0.31 - fraction * 0.13), 0.12 + tier * 0.105, 0.3 - fraction * 0.055, 0.065, 0.11, 0.07, EDGE);
          shape('back-fold', side * (0.26 - fraction * 0.09), 0.12 + tier * 0.105, -0.37 + fraction * 0.055, 0.06, 0.11, 0.06, EDGE);
        }
      }
      shape('torso', 0, 1.15, -0.02, 0.71, 0.4, 0.54);
      shape('shoulder', 0, 1.5, -0.035, 0.83, 0.16, 0.55);
      shape('neck', 0, 1.6, -0.03, 0.23, 0.2, 0.24, FACE);
      limb('crossed-collar', [-0.26, 1.62, 0.28], [0.24, 1.16, 0.3], 0.11, 0.06, EDGE);
      limb('crossed-collar', [0.25, 1.62, 0.28], [-0.08, 1.3, 0.31], 0.1, 0.06, EDGE);
      shape('belt', 0, 1.06, -0.015, 0.75, 0.09, 0.59, BAMBOO);
      shape('belt-knot', -0.2, 0.99, 0.31, 0.16, 0.19, 0.13, EDGE, { rz: 0.12 });
      limb('sash', [-0.2, 0.99, 0.33], [-0.32, 0.62, 0.39], 0.11, 0.06, EDGE);
      shape('front-panel', 0.12, 0.23, 0.34, 0.27, 0.81, 0.075, EDGE, { rz: -0.08 });
      for (let motif = 0; motif < 4; motif++) {
        shape('robe-pattern', 0.13 + motif * 0.015, 0.35 + motif * 0.16, 0.39, 0.07, 0.07, 0.026, FOLD, { rz: Math.PI / 4 });
      }
      limb('back-collar', [-0.28, 1.6, -0.32], [0, 1.37, -0.34], 0.085, 0.04, EDGE);
      limb('back-collar', [0.28, 1.6, -0.32], [0, 1.37, -0.34], 0.085, 0.04, EDGE);
    });
    section(() => {
      limb('hidden-arm', [-0.35, 1.5, 0], [-0.52, 1.08, 0.17], 0.36, 0.44);
      limb('hidden-sleeve', [-0.52, 1.08, 0.17], [-0.25, 1.12, 0.39], 0.33, 0.43);
      for (let strip = 0; strip < 6; strip++) {
        const fraction = strip / 5;
        shape('left-drape', -0.32 - fraction * 0.27, 0.59 + fraction * 0.13, 0.06,
          0.07, 0.69 - fraction * 0.14, 0.41);
        limb('left-fold', [-0.32 - fraction * 0.27, 0.66 + fraction * 0.13, 0.29],
          [-0.29 - fraction * 0.28, 1.17, 0.31], 0.022, 0.03, EDGE);
      }
      limb('holding-arm', [0.36, 1.5, 0], [0.58, 1.17, 0.18], 0.36, 0.44);
      limb('holding-forearm', [0.58, 1.17, 0.18], [0.45, 1.32, 0.48], 0.3, 0.35);
      for (let strip = 0; strip < 9; strip++) {
        const fraction = strip / 8, column = 0.32 + fraction * 0.4;
        const bottom = 0.38 + fraction * fraction * 0.18, top = 1.33 - fraction * 0.42;
        shape('right-drape', column, bottom, 0.2 - fraction * 0.15, 0.07, top - bottom, 0.38);
        shape('sleeve-border', column, bottom - 0.015, 0.4 - fraction * 0.15, 0.075, 0.07, 0.045, EDGE);
        if (strip % 2 === 0) shape('sleeve-fold', column, bottom + 0.09, 0.4 - fraction * 0.15, 0.025, top - bottom - 0.17, 0.035, EDGE);
      }
      shape('cuff', 0.455, 1.19, 0.49, 0.19, 0.31, 0.15, EDGE, { rz: -0.14 });
      batch.at(0.53 * 2.55, 1.08 * 2.55, 0.44 * 2.55, 0.1, () => {
        for (let slip = 0; slip < 6; slip++) shape('bamboo-slip', -0.17 + slip * 0.068, 0, 0,
          0.06, 0.68, 0.075, BAMBOO, { rz: -0.24 });
        for (const height of [0.12, 0.55]) shape('bamboo-binding', 0, height, 0.047, 0.43, 0.035, 0.025, FOLD);
        for (let slip = 0; slip < 5; slip++) for (let line = 0; line < 3; line++) shape('bamboo-mark',
          -0.1 + slip * 0.064 + line * 0.012, 0.25 + line * 0.09, 0.052, 0.022, 0.035, 0.016, FOLD);
      });
      shape('palm', 0.37, 1.23, 0.61, 0.18, 0.23, 0.13, FACE);
      for (let finger = 0; finger < 4; finger++) shape('finger', 0.43, 1.25 + finger * 0.046, 0.68,
        0.23 - finger * 0.015, 0.036, 0.065, FACE);
      shape('thumb', 0.46, 1.45, 0.59, 0.06, 0.1, 0.15, FACE, { rz: -0.2 });
    });
    section(() => head({ y: 1.92, z: -0.02, yaw: -0.16, elder: true }));
  });
  lighting(traveller);
}
