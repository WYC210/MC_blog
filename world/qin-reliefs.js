const STONE = { tex: 'paint', tint: 0xd7c3a5 };
const FACE = { tex: 'paint', tint: 0xefd7b4 };
const INK = { tex: 'paint', tint: 0x66554a };
const BRONZE = { tex: 'paint', tint: 0xbda06b };
const ARMOR = { tex: 'paint', tint: 0x91a19a };
const ROBE = { tex: 'paint', tint: 0xbe9981 };
const WOOD = { tex: 'paint', tint: 0x987556 };
const CLOUD = { tex: 'paint', tint: 0xd2dacf };

export function buildQinRelief(batch, wall) {
  let feature = 'background';
  const box = (x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, { ...rotation, tag: `${wall.id}:${feature}` });
  function part(name, build) {
    feature = name;
    build();
  }
  function beam(start, end, width, look = STONE, depth = width) {
    const delta = end.map((coordinate, axis) => coordinate - start[axis]);
    const length = Math.hypot(...delta);
    box((start[0] + end[0]) / 2, (start[1] + end[1] - length) / 2, (start[2] + end[2]) / 2,
      width, length, depth, look, { rx: Math.atan2(delta[2], delta[1]), rz: -Math.asin(delta[0] / length) });
  }
  function actor(x, y, z, scale, { robe = STONE, pose = 'stand', yaw = 0, arms = null, hat = 'cap', beard = false, armor = false } = {}) {
    batch.at(x, y, z, yaw, () => {
      const seated = pose === 'ride' || pose === 'sit';
      const bodyY = seated ? 0.5 : 1;
      const shape = (column, height, row, width, tall, depth, look = robe, rotation = {}) =>
        box(column * scale, height * scale, row * scale, width * scale, tall * scale, depth * scale, look, rotation);
      const limb = (from, to, width, look = robe) => beam(from.map(value => value * scale), to.map(value => value * scale), width * scale, look);
      if (seated) {
        shape(0, 0.35, 0, 0.64, 0.32, 0.48);
        for (const side of [-1, 1]) {
          const knee = [side * (pose === 'ride' ? 0.45 : 0.25), 0.27, 0.4];
          limb([side * 0.23, 0.5, 0], knee, 0.23);
          limb(knee, [knee[0], -0.15, 0.43], 0.19);
          shape(knee[0], -0.2, 0.52, 0.23, 0.14, 0.34, INK);
        }
      } else {
        for (let tier = 0; tier < 6; tier++) shape(0, 0.12 + tier * 0.15, 0, 0.78 - tier * 0.045, 0.17, 0.55 - tier * 0.025);
        for (const side of [-1, 1]) shape(side * 0.2, 0, 0.15, 0.22, 0.15, 0.38, INK);
      }
      shape(0, bodyY, 0, 0.65, 0.43, 0.4);
      shape(0, bodyY + 0.02, 0.02, 0.7, 0.09, 0.46, BRONZE);
      if (armor) for (let row = 0; row < 3; row++) for (const column of [-0.21, 0, 0.21])
        shape(column, bodyY + 0.14 + row * 0.08, 0.23, 0.18, 0.065, 0.06, ARMOR);
      shape(0, bodyY + 0.46, 0, 0.35, 0.4, 0.34, FACE);
      shape(0, bodyY + 0.6, 0.2, 0.09, 0.09, 0.09, FACE);
      for (const side of [-1, 1]) shape(side * 0.08, bodyY + 0.71, 0.177, 0.055, 0.045, 0.025, INK);
      if (hat === 'bun') {
        shape(0, bodyY + 0.84, -0.04, 0.39, 0.12, 0.4, INK);
        shape(0, bodyY + 0.95, -0.03, 0.22, 0.2, 0.22, INK);
        shape(0, bodyY + 1, -0.03, 0.44, 0.035, 0.035, BRONZE);
      } else {
        shape(0, bodyY + 0.84, -0.02, 0.43, 0.19, 0.42, hat === 'helmet' ? ARMOR : INK);
        if (hat === 'helmet') shape(0, bodyY + 1, 0, 0.12, 0.23, 0.26, BRONZE);
        if (hat === 'crown') shape(0, bodyY + 1.02, 0.03, 0.68, 0.09, 0.5, BRONZE);
      }
      if (beard) {
        shape(0, bodyY + 0.35, 0.2, 0.25, 0.2, 0.13, CLOUD);
        shape(0, bodyY + 0.19, 0.23, 0.12, 0.19, 0.12, CLOUD);
      }
      const handPositions = arms || (seated ? [[-0.25, bodyY + 0.1, 0.65], [0.25, bodyY + 0.1, 0.65]] : [[-0.4, 0.95, 0.25], [0.4, 0.95, 0.25]]);
      for (const [index, side] of [[0, -1], [1, 1]]) {
        const hand = handPositions[index], shoulder = [side * 0.38, bodyY + 0.33, 0];
        const elbow = [(shoulder[0] + hand[0]) / 2, (shoulder[1] + hand[1]) / 2 - 0.12, Math.max(0.12, hand[2] / 2)];
        limb(shoulder, elbow, 0.25); limb(elbow, hand, 0.22);
        shape(hand[0], hand[1] - 0.08, hand[2], 0.18, 0.16, 0.2, FACE);
      }
    });
  }
  function mount(x, y, z, scale, yaw) {
    batch.at(x, y, z, yaw, () => {
      const shape = (column, height, row, width, tall, depth, look = STONE, rotation = {}) =>
        box(column * scale, height * scale, row * scale, width * scale, tall * scale, depth * scale, look, rotation);
      shape(0, 0.85, 0, 0.7, 0.7, 1.5);
      for (const side of [-1, 1]) for (const front of [-1, 1]) {
        const raised = side === 1 && front === 1;
        shape(side * 0.25, raised ? 0.25 : 0, front * 0.53, 0.18, raised ? 0.8 : 1.05, 0.22, STONE, { rx: raised ? -0.5 : front * 0.09 });
        shape(side * 0.25, raised ? 0.25 : 0, front * 0.62, 0.23, 0.17, 0.29, INK);
      }
      shape(0, 1.28, 0.58, 0.43, 0.72, 0.4, STONE, { rx: -0.2 });
      shape(0, 1.86, 0.85, 0.38, 0.32, 0.76);
      for (const side of [-1, 1]) {
        shape(side * 0.14, 2.12, 0.65, 0.09, 0.23, 0.14);
        shape(side * 0.197, 2.03, 0.86, 0.035, 0.055, 0.08, INK);
        beam([side * 0.22 * scale, 1.95 * scale, 1.12 * scale], [side * 0.3 * scale, 1.65 * scale, 0.15 * scale], 0.04 * scale, BRONZE);
      }
      shape(0, 0.35, -0.87, 0.18, 1, 0.21, INK, { rx: -0.25 });
      shape(0, 1.5, 0, 0.86, 0.16, 0.72, BRONZE);
    });
  }
  function banner(x, z, look) {
    box(x, 0.25, z, 0.12, 3.9, 0.12, BRONZE);
    box(x + 0.6, 2.7, z, 1.15, 1.15, 0.07, look);
    box(x + 0.6, 3.83, z, 1.35, 0.09, 0.12, BRONZE);
    for (const offset of [-0.24, 0, 0.24]) box(x + 0.6 + offset, 2.93, z + 0.05, 0.06, 0.65, 0.03, BRONZE);
  }
  function tigerHalf(x, z) {
    box(x, 1.13, z, 1.13, 0.28, 0.19, BRONZE);
    box(x + 0.62, 1.25, z, 0.35, 0.35, 0.27, BRONZE);
    box(x + 0.81, 1.26, z + 0.02, 0.2, 0.16, 0.23, BRONZE);
    box(x + 0.54, 1.58, z, 0.11, 0.14, 0.16, BRONZE);
    box(x + 0.66, 1.46, z + 0.145, 0.07, 0.06, 0.025, INK);
    for (const foot of [-0.39, 0.39]) box(x + foot, 0.91, z, 0.16, 0.27, 0.23, BRONZE);
    beam([x - 0.52, 1.27, z], [x - 0.82, 1.57, z], 0.1, BRONZE);
    for (const stripe of [-0.3, 0, 0.3]) box(x + stripe, 1.2, z + 0.105, 0.07, 0.16, 0.025, INK);
  }
  function dreamPalace(x, y, width) {
    box(x, y, 0.7, width, 0.18, 0.45, BRONZE);
    for (const side of [-1, 1]) box(x + side * width * 0.35, y + 0.18, 0.65, 0.14, 0.9, 0.24, STONE);
    box(x, y + 0.2, 0.57, width * 0.5, 0.8, 0.1, WOOD);
    for (let tier = 0; tier < 4; tier++) box(x, y + 1.05 + tier * 0.12, 0.7, width + 0.35 - tier * 0.3, 0.14, 0.45, ARMOR);
  }
  batch.at(wall.x, 0, wall.z, wall.yaw, () => {
    const background = { tex: 'paint', tint: wall.id === 'qin-dream' ? 0x657d87 : 0x687c79 };
    part('background', () => box(0, 0.15, 0.29, 16.7, 4.4, 0.08, background));
    part('plinth', () => box(0, 0, 1.3, 15.5, 0.24, 2.1, { tex: 'travertine', tint: 0xc3bbaa }));
    if (wall.id === 'qin-zhao') {
      part('standards', () => { banner(-7.2, 0.65, ROBE); banner(5.9, 0.65, ROBE); });
      for (const [index, column, scale, yaw] of [[0, -3.5, 1.15, -0.35], [1, 0, 1.35, 0], [2, 3.5, 1.15, 0.35]]) {
        part(`mount-${index}`, () => mount(column, 0.25, 1.25, scale, yaw));
        part(`rider-${index}`, () => actor(column, 0.25 + 1.6 * scale, 1.25, 1.05, { robe: ARMOR, pose: 'ride', yaw, hat: 'helmet', armor: true }));
      }
      for (const side of [-1, 1]) part(`guard-${side}`, () => {
        actor(side * 6.15, 0.25, 1.1, 1.35, { armor: true, hat: 'helmet', robe: ROBE });
        box(side * 6.15 + 0.8, 0.25, 1.5, 0.07, 3.5, 0.07, BRONZE);
        box(side * 6.15 + 0.8, 3.6, 1.5, 0.16, 0.36, 0.07, STONE);
      });
    } else if (wall.id === 'qin-tiger') {
      part('handoff', () => {
        actor(-1.75, 0.25, 1.15, 1.6, { robe: ROBE, hat: 'bun', arms: [[-0.4, 1, 0.4], [0.96, 1.25, 0.55]] });
        actor(1.7, 0.25, 1.15, 1.7, { robe: ARMOR, hat: 'crown', arms: [[-0.94, 1.2, 0.5], [0.4, 1, 0.25]] });
        box(-0.02, 2.16, 1.99, 0.72, 0.17, 0.22, BRONZE);
        box(0.3, 2.26, 1.99, 0.18, 0.15, 0.24, BRONZE);
      });
      part('general', () => {
        actor(5.3, 0.25, 1.05, 1.55, { robe: STONE, hat: 'helmet', armor: true, arms: [[-0.9, 1.25, 0.35], [0.4, 1, 0.3]] });
        box(6.2, 0.25, 1.5, 0.08, 3.5, 0.08, BRONZE);
        box(6.2, 3.6, 1.5, 0.45, 0.15, 0.1, STONE);
      });
      part('city-gate', () => {
        for (const column of [-6.8, -4.1]) box(column, 0.25, 0.62, 0.7, 2.8, 0.5, STONE);
        box(-5.45, 2.7, 0.62, 3.6, 0.45, 0.5, STONE);
        for (const column of [-6.8, -5.45, -4.1]) box(column, 3.15, 0.62, 0.65, 0.4, 0.5, STONE);
        actor(-5.4, 0.25, 1.05, 0.95, { robe: ARMOR, hat: 'helmet', armor: true });
      });
      part('tiger-tally', () => {
        box(0, 0.24, 1.75, 3.2, 0.62, 1, WOOD);
        box(0, 0.86, 1.75, 3.4, 0.07, 1.1, STONE);
        tigerHalf(-0.2, 1.48); tigerHalf(0.15, 2.05);
      });
    } else if (wall.id === 'qin-dream') {
      part('sage', () => {
        box(-4.6, 0.24, 1.2, 1.4, 0.6, 1.1, WOOD);
        actor(-4.6, 0.85, 1.25, 1.5, { pose: 'sit', robe: STONE, beard: true, hat: 'bun', arms: [[-0.4, 0.7, 0.55], [0.8, 0.7, 0.5]] });
        box(-5.6, 0.24, 1.6, 0.1, 2.75, 0.1, BRONZE);
      });
      part('sleeper', () => {
        box(-0.4, 0.24, 1.3, 4.7, 0.45, 1.4, WOOD);
        box(-0.4, 0.69, 1.3, 4.4, 0.15, 1.25, STONE);
        box(1.25, 0.84, 1.3, 0.8, 0.23, 1.05, ARMOR);
        box(-0.9, 0.84, 1.3, 2.5, 0.43, 0.95, ROBE);
        box(0.5, 0.88, 1.3, 0.66, 0.32, 0.85, ROBE);
        box(1.25, 1.04, 1.3, 0.53, 0.36, 0.57, FACE);
        box(1.5, 1.14, 1.3, 0.13, 0.3, 0.6, INK);
        for (const height of [1.13, 1.28]) box(1.25, height, 1.6, 0.12, 0.035, 0.025, INK);
        box(0.8, 0.87, 1.81, 0.8, 0.17, 0.2, FACE);
      });
      part('millet-pot', () => {
        box(4.9, 0.24, 1.2, 1.6, 0.5, 1.3, WOOD);
        box(4.9, 0.74, 1.2, 1.05, 0.7, 1.05, BRONZE);
        for (const side of [-1, 1]) box(4.9 + side * 0.63, 1.12, 1.2, 0.25, 0.18, 0.3, BRONZE);
        box(4.9, 1.44, 1.2, 1.18, 0.1, 1.18, INK);
        box(4.9, 1.47, 1.2, 0.86, 0.09, 0.86, STONE);
        for (const [column, row] of [[-0.24, -0.2], [0.12, -0.17], [-0.08, 0.12], [0.26, 0.26]]) box(4.9 + column, 1.56, 1.2 + row, 0.12, 0.07, 0.1, BRONZE);
        for (let puff = 0; puff < 3; puff++) box(4.9 + Math.sin(puff * 2) * 0.2, 1.85 + puff * 0.35, 0.9, 0.4 - puff * 0.07, 0.2, 0.14, CLOUD);
      });
      part('dream-cloud', () => {
        for (let puff = 0; puff < 13; puff++) {
          const column = -3.2 + puff * 0.55;
          box(column, 2.62 + Math.sin(puff * 1.7) * 0.08, 0.58, 0.65, 0.22, 0.26, CLOUD);
        }
        for (const [column, height] of [[1, 1.72], [0.65, 2.03], [0.1, 2.34]]) box(column, height, 0.8, 0.35, 0.15, 0.15, CLOUD);
      });
      part('dream-palace', () => {
        dreamPalace(-1.75, 2.9, 1.9); dreamPalace(2.1, 2.9, 1.9);
        actor(0.25, 2.88, 0.7, 0.65, { pose: 'sit', robe: BRONZE, hat: 'crown' });
      });
    }
  });
}
