const STONE = { tex: 'paint', tint: 0xcdd3c7 };
const FACE = { tex: 'paint', tint: 0xe4e6d9 };
const EDGE = { tex: 'paint', tint: 0xdfe2d6 };
const FOLD = { tex: 'paint', tint: 0xa1aa9e };
const HAIR = { tex: 'paint', tint: 0x879183 };
const INK = { tex: 'paint', tint: 0x455049 };
const JADE = { tex: 'paint', tint: 0xaebda9 };
const PLINTH = { tex: 'travertine', tint: 0xbab8a8 };
const SLATE = { tex: 'stone', tint: 0x858c80 };

export function buildQinEmperor({ architecture, batch, bakes, obstacles, solids }) {
  let bounds = null;
  function box(feature, x, y, z, width, height, depth, look = STONE, rotation = {}) {
    const matrix = batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `qin-emperor:${feature}` });
    if (!bounds) return;
    const elements = matrix.elements;
    for (const [axis, name] of ['x', 'y', 'z'].entries()) {
      const radius = (Math.abs(elements[axis]) + Math.abs(elements[axis + 4]) + Math.abs(elements[axis + 8])) / 2;
      bounds[`${name}0`] = Math.min(bounds[`${name}0`], elements[12 + axis] - radius - 0.04);
      bounds[`${name}1`] = Math.max(bounds[`${name}1`], elements[12 + axis] + radius + 0.04);
    }
  }
  function beam(feature, start, end, width, depth, look = STONE) {
    const delta = end.map((coordinate, axis) => coordinate - start[axis]);
    const length = Math.hypot(...delta);
    box(feature, (start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      width, length, depth, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length) });
  }
  function section(build) {
    bounds = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z0: Infinity, z1: -Infinity };
    build();
    solids.push(bounds); obstacles.push({ ...bounds, floor: 0 });
    bounds = null;
  }
  for (let step = 0; step < 3; step++) {
    architecture.block(160, step * 0.18, 10, 12 - step * 0.6, 0.18, 12 - step * 0.6, PLINTH, 0);
  }
  architecture.block(160, 0.54, 10, 9.2, 0.69, 9.2, SLATE, 0);
  architecture.block(160, 1.23, 10, 9.5, 0.22, 9.5, PLINTH, 0);
  for (const side of [-1, 1]) for (let crest = -3; crest <= 3; crest++) {
    box('plinth-wave', 160 + crest * 1.1, 0.72, 10 + side * 4.64, 0.6, 0.28, 0.055, EDGE, { rz: 0.26 });
    box('plinth-wave', 160 + crest * 1.1 + 0.34, 0.75, 10 + side * 4.64, 0.4, 0.22, 0.06, FOLD, { rz: -0.3 });
  }
  batch.at(160, 1.45, 10, 0, () => {
    section(() => {
      for (const side of [-1, 1]) {
        box('shoe', side * 0.92, 0.35, 0.55, 1.12, 0.72, 2.4, FOLD, { ry: side * 0.13 });
        box('shoe-toe', side * 1.02, 0.5, 1.58, 1.05, 0.4, 0.6, EDGE, { ry: side * 0.13 });
      }
      for (const [column, row, width, height, depth, yaw] of [
        [-2.5, 0.8, 1.5, 0.7, 2.2, 0.3], [2.6, 0.9, 1.6, 0.6, 1.9, -0.2],
        [-1.6, -1.2, 2.2, 0.85, 1.6, -0.2], [1.4, -1.1, 2.5, 0.65, 1.8, 0.2],
      ]) box('rock', column, 0, row, width, height, depth, STONE, { ry: yaw, rz: yaw * 0.5 });
      for (let tier = 0; tier < 16; tier++) {
        const fraction = tier / 15, height = 1 + tier * 0.42;
        const width = 5.6 - fraction * 1.85, depth = 3.55 - fraction * 0.9;
        box('skirt', 0, height, -0.06, width, 0.425, depth);
        for (const side of [-1, 1]) {
          const front = -0.06 + depth / 2;
          box('skirt-fold', side * (1.9 - fraction * 0.68), height, front + 0.045, 0.22, 0.425, 0.19, EDGE);
          box('skirt-groove', side * (1.63 - fraction * 0.6), height, front + 0.012, 0.11, 0.425, 0.065, FOLD);
          box('rear-fold', side * (1.65 - fraction * 0.55), height, -0.06 - depth / 2 - 0.035, 0.23, 0.425, 0.16, EDGE);
        }
      }
      for (let tier = 0; tier < 9; tier++) {
        const fraction = tier / 8;
        box('torso', 0, 7.72 + tier * 0.45, -0.05, 3.75 + fraction * 1.15, 0.455, 2.65 + fraction * 0.35);
      }
      box('shoulder', 0, 11.72, -0.08, 4.6, 0.5, 2.75, EDGE);
      box('neck', 0, 12.05, 0, 1.35, 1.05, 1.35, FACE);
      box('belt', 0, 7.56, -0.05, 3.96, 0.4, 2.88, FOLD);
      box('belt-buckle', 0, 7.54, 1.44, 0.75, 0.45, 0.19, EDGE);
      box('belt-buckle', 0, 7.64, 1.55, 0.43, 0.23, 0.06, JADE);
      for (let tier = 0; tier < 10; tier++) {
        const fraction = tier / 9;
        box('apron', 0.12, 2.8 + tier * 0.46, 1.64 - fraction * 0.17, 2 - fraction * 0.4, 0.465, 0.18, EDGE);
        for (const side of [-1, 1]) box('apron-edge', 0.12 + side * (0.89 - fraction * 0.2), 2.8 + tier * 0.46,
          1.75 - fraction * 0.17, 0.1, 0.465, 0.06, FOLD);
      }
      box('apron-hem', 0.12, 2.75, 1.76, 2.05, 0.2, 0.12, FOLD);
      beam('collar', [-1.35, 12.22, 1.39], [0.85, 9.7, 1.49], 0.43, 0.25, EDGE);
      beam('collar-seam', [-1.51, 12.13, 1.55], [0.68, 9.57, 1.65], 0.1, 0.07, FOLD);
      beam('collar', [1.32, 12.22, 1.41], [-0.18, 10.52, 1.53], 0.42, 0.25, EDGE);
      for (const side of [-1, 1]) {
        beam('back-drape', [side * 1.58, 11.9, -1.6], [side * 0.82, 8.1, -1.5], 0.35, 0.18, EDGE);
        beam('side-fold', [side * 1.88, 7.35, -0.35], [side * 2.75, 1.28, -0.52], 0.14, 0.34, FOLD);
      }
    });
    for (const side of [-1, 1]) section(() => {
      for (let tier = 0; tier < 12; tier++) {
        const fraction = tier / 11;
        box('hanging-sleeve', side * (2.05 + fraction * 0.65), 5.7 + tier * 0.52, 0.66 - fraction * 0.42,
          0.85 + fraction * 0.55, 0.525, 2.25 + fraction * 0.25, STONE);
      }
      beam('sleeve-hollow', [side * 2.04, 6.22, 1.86], [side * 2.48, 11.52, 1.71], 0.48, 0.1, FOLD);
      for (const edge of [-1, 1]) beam('sleeve-piping', [side * 2.04 + edge * 0.33, 6.18, 1.91],
        [side * 2.48 + edge * 0.43, 11.52, 1.79], 0.17, 0.16, EDGE);
      box('sleeve-turn', side * 2.04, 5.97, 1.88, 0.69, 0.24, 0.2, EDGE);
      box('sleeve-turn', side * 2.04, 5.83, 1.84, 0.4, 0.2, 0.22, EDGE);
      beam('raised-sleeve', [side * 2.52, 11.25, 0.65], [side * 1.05, 12.12, 2.13], 1.1, 1.28);
      beam('cuff', [side * 1.16, 12.04, 2.08], [side * 0.92, 12.2, 2.29], 0.9, 0.96, EDGE);
      box('palm', side * 0.73, 12.02, 2.4, 0.55, 0.63, 0.55, FACE, { ry: -side * 0.22 });
      for (let finger = 0; finger < 4; finger++) {
        box('finger', side * (0.62 + finger * 0.025), 12.06 + finger * 0.13, 2.72 - finger * 0.028,
          0.48 - finger * 0.035, 0.105, 0.16, FACE, { ry: -side * 0.2 });
      }
      box('thumb', side * 0.67, 12.56, 2.36, 0.22, 0.18, 0.46, FACE, { ry: side * 0.3 });
    });
    section(() => {
      box('vessel-foot', 0, 11.62, 2.45, 0.75, 0.16, 0.66, JADE);
      box('vessel-stem', 0, 11.78, 2.45, 0.27, 0.29, 0.27, JADE);
      for (let tier = 0; tier < 4; tier++) box('vessel-bowl', 0, 12.02 + tier * 0.17, 2.45,
        0.7 + tier * 0.18, 0.175, 0.68 + tier * 0.11, JADE);
      for (const side of [-1, 1]) {
        box('vessel-rim', 0, 12.7, 2.45 + side * 0.51, 1.36, 0.16, 0.13, EDGE);
        box('vessel-rim', side * 0.615, 12.7, 2.45, 0.13, 0.16, 0.9, EDGE);
        box('vessel-handle', side * 0.89, 12.27, 2.45, 0.12, 0.53, 0.18, JADE);
        for (const height of [12.22, 12.73]) box('vessel-handle', side * 0.74, height, 2.45, 0.4, 0.12, 0.18, JADE);
      }
      box('vessel-interior', 0, 12.7, 2.45, 1.1, 0.025, 0.83, FOLD);
    });
    section(() => batch.at(0, 13, 0.05, -0.08, () => {
      box('jaw', 0, 0, 0.12, 1.23, 0.36, 1.25, FACE);
      box('face-lower', 0, 0.3, 0.08, 1.62, 0.58, 1.48, FACE);
      box('face', 0, 0.83, 0.02, 1.88, 0.95, 1.57, FACE);
      box('forehead', 0, 1.7, -0.015, 1.83, 0.42, 1.55, FACE);
      box('hair-back', 0, 0.55, -0.72, 1.86, 1.62, 0.4, HAIR);
      for (const side of [-1, 1]) {
        box('ear', side * 1.02, 0.73, 0.02, 0.23, 0.63, 0.4, FACE);
        box('ear-fold', side * 1.075, 0.91, 0.23, 0.09, 0.28, 0.035, FOLD);
        box('temple', side * 0.94, 1.02, -0.39, 0.18, 1.12, 0.56, HAIR);
        box('cheek', side * 0.55, 0.74, 0.85, 0.5, 0.44, 0.17, FACE, { rz: side * 0.08 });
        box('brow', side * 0.47, 1.48, 0.87, 0.66, 0.15, 0.25, FOLD, { rz: side * 0.07 });
        box('upper-lid', side * 0.47, 1.33, 0.89, 0.57, 0.11, 0.19, FACE);
        box('eye', side * 0.47, 1.29, 1, 0.4, 0.065, 0.045, INK);
        box('lower-lid', side * 0.47, 1.22, 0.93, 0.47, 0.075, 0.15, EDGE);
        box('nose-wing', side * 0.19, 0.76, 1.11, 0.18, 0.18, 0.23, FACE);
        box('moustache', side * 0.23, 0.53, 0.99, 0.45, 0.14, 0.14, HAIR, { rz: -side * 0.14 });
      }
      box('nose-bridge', 0, 0.92, 0.99, 0.28, 0.57, 0.39, FACE);
      box('nose-tip', 0, 0.76, 1.23, 0.38, 0.26, 0.28, FACE);
      box('mouth', 0, 0.43, 0.94, 0.48, 0.055, 0.075, FOLD);
      for (let tier = 0; tier < 6; tier++) {
        box('beard', 0, -0.68 + tier * 0.19, 0.79 + tier * 0.025, 0.35 + tier * 0.16, 0.195, 0.4, HAIR);
        for (const side of [-1, 1]) box('beard-strand', side * (0.09 + tier * 0.055), -0.68 + tier * 0.19,
          1.005 + tier * 0.025, 0.055, 0.195, 0.035, FOLD);
      }
      box('crown-band', 0, 2.1, -0.06, 1.98, 0.22, 1.85, FOLD);
      box('crown', 0, 2.32, -0.08, 1.73, 0.91, 1.64, STONE);
      for (const face of [-1, 1]) {
        for (const column of [-0.6, -0.3, 0, 0.3, 0.6]) box('crown-carving', column, 2.43, -0.08 + face * 0.84,
          0.095, 0.68, 0.05, FOLD);
        box('crown-rim', 0, 3.17, -0.08 + face * 0.85, 1.87, 0.13, 0.13, EDGE);
      }
      box('crown-board', 0, 3.28, 0.1, 2.36, 0.19, 2.6, EDGE, { rx: -0.035 });
      for (const face of [-1, 1]) for (let strand = -3; strand <= 3; strand++) {
        box('crown-thread', strand * 0.31, 2.46, 0.1 + face * 1.3, 0.027, 0.83, 0.027, FOLD);
        for (let bead = 0; bead < 4; bead++) box('crown-bead', strand * 0.31, 2.46 + bead * 0.19,
          0.1 + face * 1.3, 0.07, 0.075, 0.07, EDGE);
      }
    }));
  });
  for (const side of [-1, 1]) for (const face of [-1, 1]) {
    box('uplight', 160 + side * 6.7, 0.04, 10 + face * 4.5, 0.48, 0.18, 0.4, FOLD);
    box('uplight-lens', 160 + side * 6.7, 0.22, 10 + face * 4.5, 0.36, 0.045, 0.28,
      { tex: 'paint', tint: 0xffe3b7, emissive: 0.45 });
    bakes.push({ id: `qin-emperor-${side}-${face}`, position: [160 + side * 6, face === 1 ? 4 : 9, 10 + face * 5],
      power: face === 1 ? 1.3 : 0.85, radius: face === 1 ? 18 : 16, direction: null });
  }
  bakes.push({ id: 'qin-emperor-face', position: [160, 15.5, 15.5], power: 0.85, radius: 11, direction: null });
}
