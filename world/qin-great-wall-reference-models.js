export const REFERENCE_SCENES = {
  laolongtou: { kind: 'coast', focus: [1.9, 1.6, 0], paths: [] },
  shanhaiguan: { kind: 'gate', focus: [0, 2.12, 0], paths: [] },
  jiaoshan: { kind: 'mountain', focus: [4.8, 2.06, -0.45], paths: [[[-14, 0.15, 0.65], [-9, 0.3, 0.5], [-5.2, 0.35, 0.8], [-3.6, 1.02, -0.1], [-1.7, 0.85, -0.35], [1.3, 0.5, 0.55], [3.2, 0.64, 0.1], [4.8, 1.35, -0.45], [8.1, 1.18, -0.65], [10, 0.62, -0.25], [14, 0.8, -0.7]]], towers: [1, 4, 7, 10] },
  dongjiakou: { kind: 'mountain', focus: [1.8, 1.97, -0.65], paths: [[[-14, 0.3, 0.35], [-10.7, 0.8, -0.15], [-7.6, 1.1, -0.6], [-4.8, 0.6, -0.1], [-1.6, 0.72, -0.3], [1.8, 1.22, -0.65], [5.4, 0.62, -0.25], [8.7, 0.92, -0.6], [11.8, 0.5, 0], [14, 0.3, 0.45]]], towers: [1, 2, 5, 7] },
  banchangyu: { kind: 'mountain', focus: [1.2, 2.03, -0.25], paths: [[[-14, 0.3, 0.5], [-10, 0.65, 0.1], [-6.8, 0.45, 0.7], [-3.3, 1.1, -0.4], [-1.4, 1.3, -0.5], [1.2, 1.3, -0.25], [3.2, 0.68, 0.25], [7, 0.9, -0.5], [10.4, 0.55, -0.2], [14, 0.8, -0.55]]], towers: [1, 5, 7, 9] },
  naziyu: { kind: 'pass', focus: [0, 1, 0], paths: [[[-14, 0.8, -0.4], [-10, 0.6, -0.15], [-6, 0.35, 0.3], [-2, 0.16, 0], [-0.65, 0.12, 0]], [[0.65, 0.12, 0], [2.6, 0.25, -0.2], [6, 0.7, -0.6], [10, 1.05, -0.4], [14, 0.72, 0.3]]], towers: [] },
  chengziyu: { kind: 'mountain', focus: [1.1, 1.81, -0.4], paths: [[[-14, 0.2, 0.5], [-10.5, 0.65, 0.7], [-6.6, 0.92, -0.25], [-3, 0.55, 0.25], [1.1, 1.05, -0.4], [4, 0.8, -0.6], [8, 0.55, 0.25], [11, 0.8, -0.2], [14, 0.6, -0.4]]], towers: [2, 4, 7], ruined: true },
  jielingkou: { kind: 'pass', focus: [-1.5, 1.28, 0], paths: [[[-14, 0.95, -0.5], [-10, 0.6, -0.65], [-6, 0.3, -0.15], [-3.1, 0.16, 0]], [[3.1, 0.16, 0], [6, 0.4, -0.3], [10, 0.7, -0.6], [14, 0.9, -0.1]]], towers: [] },
  liujiakou: { kind: 'watergate', focus: [0, 1.7, 0], paths: [[[-14, 0.75, -0.4], [-10, 1, -0.6], [-6, 0.6, 0.2], [-2, 0.18, 0]], [[2, 0.18, 0], [6, 0.4, -0.15], [10, 0.8, -0.5], [14, 0.55, 0.25]]], towers: [], ruined: true },
  jiumenkou: { kind: 'bridge', focus: [0, 1.55, 0], paths: [[[-14, 1.1, -0.5], [-11, 0.8, -0.6], [-8, 0.45, -0.25], [-5.7, 1.09, 0]], [[5.7, 1.09, 0], [8, 0.5, -0.2], [11, 0.85, -0.6], [14, 1.05, -0.2]]], towers: [] },
};

export function referenceHeight(scene, across, along) {
  if (scene.kind === 'coast') return across < 2.8 ? 0.1 : 0.018;
  if (scene.kind === 'gate') return 0.06;
  if ((scene.kind === 'bridge' && Math.abs(across) < 5.1) || (scene.kind === 'watergate' && Math.abs(across) < 1.125)) return 0.018;
  let height = 0.025;
  for (const path of scene.paths) for (let index = 1; index < path.length; index++) {
    const start = path[index - 1], end = path[index], deltaX = end[0] - start[0], deltaZ = end[2] - start[2];
    const fraction = Math.max(0, Math.min(1, ((across - start[0]) * deltaX + (along - start[2]) * deltaZ) / (deltaX * deltaX + deltaZ * deltaZ)));
    const distance = Math.hypot(across - start[0] - fraction * deltaX, along - start[2] - fraction * deltaZ);
    const crest = start[1] + fraction * (end[1] - start[1]);
    height = Math.max(height, crest * Math.max(0, 1 - distance / (scene.kind === 'mountain' ? 1.65 : 1.2)));
  }
  return height;
}

export function buildReferenceScene(id, box) {
  const scene = REFERENCE_SCENES[id];
  if (!scene) return false;
  function line(tag, start, end, height, thickness, look = 'stone') {
    const deltaX = end[0] - start[0], deltaZ = end[2] - start[2], length = Math.hypot(deltaX, deltaZ);
    box(tag, (start[0] + end[0]) / 2, (start[1] + end[1]) / 2, (start[2] + end[2]) / 2, length, height, thickness, look, { ry: -Math.atan2(deltaZ, deltaX) });
  }
  function parapet(tag, across, base, along, length, depth, broken = false) {
    for (const side of [-1, 1]) {
      box(`${tag}-parapet`, across, base, along + side * (depth / 2 - 0.035), length, 0.08, 0.07);
      const count = Math.max(2, Math.ceil(length / 0.28));
      for (let index = 0; index < count; index++) {
        if (broken && index % 3 === 1) continue;
        box(`${tag}-merlon`, across - length / 2 + (index + 0.5) * length / count, base + 0.08, along + side * (depth / 2 - 0.035), 0.12, broken ? 0.04 + (index % 3) * 0.025 : 0.1, 0.08);
      }
    }
  }
  function arch(tag, across, base, along, opening, spring, top, depth, look = 'stone') {
    const radius = opening / 2, count = 12, thickness = opening * 0.14;
    for (let index = 0; index < count; index++) {
      const angle = (index + 0.5) * Math.PI / count;
      const centerX = across + Math.cos(angle) * (radius + thickness / 2), centerY = base + spring + Math.sin(angle) * (radius + thickness / 2);
      box(`${tag}-voussoir`, centerX, centerY - thickness / 2, along, (radius + thickness) * Math.PI / count * 1.04, thickness, depth, look, { rz: angle - Math.PI / 2 });
    }
    const columns = 12, extent = radius + thickness, step = extent * 2 / columns;
    for (let column = 0; column < columns; column++) {
      const offset = -extent + (column + 0.5) * step;
      const inner = Math.max(0, Math.abs(offset) - step / 2);
      const bottom = base + spring + Math.sqrt(Math.max(0, extent * extent - inner * inner));
      if (top > bottom) box(`${tag}-spandrel`, across + offset, bottom, along, step + 0.006, top - bottom, depth, look);
    }
  }
  function gateway(tag, across, base, along, width, height, depth, opening, spring, look = 'stone') {
    const sideWidth = (width - opening) / 2;
    for (const side of [-1, 1]) box(`${tag}-jamb`, across + side * (opening + sideWidth) / 2, base, along, sideWidth, height, depth, look);
    arch(tag, across, base, along, opening, spring, base + height, depth, look);
  }
  function roof(tag, across, base, along, width, depth, height) {
    const tiers = 6;
    for (let tier = 0; tier < tiers; tier++) {
      const fraction = tier / tiers;
      box(tag, across, base + fraction * height, along, width * (1 - fraction * 0.22), height / tiers, depth * (1 - fraction * 0.85), 'roof');
    }
    box(`${tag}-ridge`, across, base + height, along, width * 0.8, 0.035, 0.055, 'roof');
  }
  function tower(across, base, along, broken = false, size = 0.7) {
    box('hollow-tower-base', across, base, along, size, 0.18, size);
    for (const side of [-1, 1]) {
      for (let pier = 0; pier < 4; pier++) {
        const offset = (pier / 3 - 0.5) * (size - 0.09);
        box('hollow-tower-pier', across + offset, base + 0.18, along + side * (size / 2 - 0.045), 0.09, 0.29, 0.09);
        box('hollow-tower-pier', across + side * (size / 2 - 0.045), base + 0.18, along + offset, 0.09, 0.29, 0.09);
      }
      box('hollow-tower-lintel', across, base + 0.47, along + side * (size / 2 - 0.045), size, 0.08, 0.09);
      box('hollow-tower-lintel', across + side * (size / 2 - 0.045), base + 0.47, along, 0.09, broken && side === 1 ? 0.035 : 0.08, size);
    }
    if (!broken) box('hollow-tower-deck', across, base + 0.55, along, size, 0.04, size);
    parapet(broken ? 'broken-tower' : 'hollow-tower', across, base + 0.59, along, size, size, broken);
  }
  function ridge(path, broken = false, band = false) {
    let cell = 0;
    for (let index = 1; index < path.length; index++) {
      const start = path[index - 1], end = path[index], length = Math.hypot(end[0] - start[0], end[2] - start[2]);
      const count = Math.ceil(length / 0.34), step = length / count, yaw = -Math.atan2(end[2] - start[2], end[0] - start[0]);
      for (let segment = 0; segment < count; segment++, cell++) {
        const fraction = (segment + 0.5) / count, across = start[0] + fraction * (end[0] - start[0]), along = start[2] + fraction * (end[2] - start[2]);
        const height = start[1] + fraction * (end[1] - start[1]), rise = Math.abs(end[1] - start[1]) / count;
        const top = height + 0.18, rotation = { ry: yaw };
        box(broken ? 'broken-wall' : 'ridge-wall', across, height - rise / 2 - 0.1, along, step + 0.018, 0.28 + rise / 2, 0.36, 'stone', rotation);
        box('stair-tread', across, top, along, step + 0.012, 0.026, 0.29, 'walk', rotation);
        for (const side of [-1, 1]) {
          const offsetX = Math.sin(yaw) * side * 0.16, offsetZ = Math.cos(yaw) * side * 0.16;
          const rimHeight = broken && cell % 5 === 1 ? 0.035 : 0.09;
          box('ridge-parapet', across + offsetX, top + 0.026, along + offsetZ, step + 0.01, rimHeight, 0.07, 'stone', rotation);
          if (cell % 2 === 0 && (!broken || cell % 3 !== 0)) box(broken ? 'broken-merlon' : 'ridge-merlon', across + offsetX, top + 0.116, along + offsetZ, 0.13, 0.09, 0.08, 'stone', rotation);
        }
        if (band) box('yellow-stone-band', across, top - 0.065, along, step + 0.02, 0.035, 0.365, 'sandstone', rotation);
      }
    }
  }
  function river(width) {
    box('river', 0, 0.026, 0, width, 0.025, 3.55, 'water');
    for (let wave = 0; wave < 7; wave++) box('water-ripple', 0, 0.054, -1.45 + wave * 0.46, width * 0.92, 0.006, 0.018, 'walk');
  }
  for (const path of scene.paths) ridge(path, scene.ruined, id === 'naziyu');
  for (const index of scene.towers || []) {
    const point = scene.paths[0][index]; tower(point[0], point[1] + 0.15, point[2], scene.ruined);
  }
  if (id === 'jiaoshan' || id === 'banchangyu') {
    const count = id === 'jiaoshan' ? 24 : 32;
    for (let column = 0; column < count; column++) {
      const across = id === 'jiaoshan' ? 3.8 + column * 0.11 : -2.9 + column * 0.13;
      const top = id === 'jiaoshan' ? 0.8 + Math.sin(column * 0.12) * 0.55 : 1.15 + (column % 5) * 0.035;
      box(id === 'jiaoshan' ? 'exposed-rock' : 'columnar-cliff', across, 0.09, 0.13 + (column % 3) * 0.065, 0.12, top, 0.27, 'rock', { rz: id === 'jiaoshan' ? 0.08 : 0 });
    }
  }
  if (id === 'dongjiakou') {
    for (let house = 0; house < 5; house++) {
      const across = -4.8 + house * 0.65, along = 1.1 + house % 2 * 0.22, base = referenceHeight(scene, across, along);
      box('village-context', across, base, along, 0.4, 0.18, 0.29, 'context');
      roof('village-roof', across, base + 0.18, along, 0.46, 0.34, 0.1);
    }
  }
  if (id === 'naziyu') {
    gateway('dry-gate', 0, 0.1, 0, 1.3, 0.66, 0.45, 0.42, 0.24, 'sandstone');
    box('dry-gate-coping', 0, 0.76, 0, 1.32, 0.06, 0.47, 'stone');
    tower(-10, 0.75, -0.15, true, 0.58); tower(10, 1.2, -0.4, true, 0.58);
  }
  if (id === 'shanhaiguan') {
    const scale = 0.075, base = 0.06, platform = 11.75 * scale, width = 44 * scale, depth = 30.4 * scale;
    gateway('zhendong-platform', 0, base, 0, width, platform, depth, 5.8 * scale, (7.5 - 5.8 / 2) * scale);
    parapet('zhendong-platform', 0, base + platform, 0, width, depth);
    const upper = base + platform, chamberHeight = 8.6 * scale;
    box('zhendong-upper', 0, upper, 0, 20 * scale, chamberHeight, 10.1 * scale, 'timber');
    for (let row = 0; row < 2; row++) {
      for (let window = 0; window < 7; window++)
        box('zhendong-arrow-window', -0.62 + window * 0.207, upper + 0.12 + row * 0.25, 10.1 * scale / 2 + 0.004, 0.07, 0.14, 0.012, 'opening');
      for (const side of [-1, 1]) for (let window = 0; window < 3; window++)
        box('zhendong-side-window', side * (10 * scale + 0.004), upper + 0.12 + row * 0.25, -0.24 + window * 0.24, 0.012, 0.14, 0.07, 'opening');
    }
    roof('zhendong-single-eave', 0, upper + chamberHeight, 0, 1.9, 1.05, (13.7 - 8.6) * scale - 0.035);
    box('zhendong-plaque', 0, upper + 0.29, 10.1 * scale / 2 + 0.018, 0.45, 0.16, 0.025, 'sandstone');
    for (const side of [-1, 1]) {
      const middle = side * (14 + width / 2) / 2, length = 14 - width / 2;
      box('city-wall', middle, base, 0, length, platform, 0.85);
      parapet('city-wall', middle, base + platform, 0, length, 0.85);
    }
  }
  if (id === 'laolongtou') {
    box('sea', 9.1, 0.026, 0, 12.9, 0.025, 3.55, 'water');
    for (let wave = 0; wave < 7; wave++) box('sea-wave', 9, 0.054, -1.48 + wave * 0.48, 11.6, 0.006, 0.025, 'walk');
    box('coastal-wall', -6.1, 0.1, -0.3, 15.6, 0.48, 0.6);
    parapet('coastal-wall', -6.1, 0.58, -0.3, 15.6, 0.6);
    box('ninghai-wall-fragment', -0.7, 0.1, 0.65, 0.28, 0.55, 1.3);
    box('seaward-stone-city', 3.4, 0.045, 0, 4.5, 0.55, 1.15, 'rock');
    parapet('seaward-stone-city', 3.4, 0.595, 0, 4.5, 1.15);
    box('jinglu-platform', 1.8, 0.1, 0, 1.25, 0.88, 1.25);
    tower(1.8, 0.98, 0, false, 0.85);
    box('chenghai-platform', -3.3, 0.1, -0.3, 1.7, 0.62, 1.2);
    box('chenghai-pavilion', -3.3, 0.72, -0.3, 1.3, 0.46, 0.75, 'timber');
    roof('chenghai-lower-eave', -3.3, 0.96, -0.3, 1.55, 1, 0.13);
    roof('chenghai-upper-eave', -3.3, 1.18, -0.3, 1.55, 1, 0.27);
  }
  if (id === 'jiumenkou') {
    river(10.5);
    const spacing = 1.1, pierWidth = 0.25, spring = 0.51, depth = 0.64;
    box('river-stone-apron', 0, 0.018, 0, 10.7, 0.015, 2.6, 'rock');
    for (let pier = 0; pier < 8; pier++) {
      const across = (pier - 3.5) * spacing;
      box('bridge-pier', across, 0.05, 0, pierWidth, 0.93, depth);
      for (const side of [-1, 1]) for (let tip = 0; tip < 3; tip++)
        box('spindle-cutwater', across, 0.05, side * (depth / 2 + (tip + 0.5) * 0.09), pierWidth * (1 - (tip + 1) / 4), 0.55, 0.095, 'rock');
    }
    for (const side of [-1, 1]) box('bridge-abutment', side * 4.95, 0.05, 0, pierWidth, 0.93, depth);
    for (let opening = 0; opening < 9; opening++) arch('water-arch', (opening - 4) * spacing, 0.05, 0, spacing - pierWidth, spring, 1.16, depth);
    box('bridge-deck', 0, 1.16, 0, 10.2, 0.11, depth);
    parapet('bridge', 0, 1.27, 0, 10.2, depth);
    for (const side of [-1, 1]) {
      box('bank-connection', side * 5.4, 0.16, 0, 0.7, 1, depth);
      tower(side * 9.5, 0.82, -0.43, false, 0.62);
    }
  }
  if (id === 'jielingkou') {
    river(1.1);
    for (const side of [-1, 1]) {
      const center = side * 1.8, radius = 1.15, steps = 12;
      for (let step = 0; step < steps; step++) {
        const angle = Math.PI * step / steps, next = Math.PI * (step + 1) / steps;
        line('fan-platform', [center + Math.cos(angle) * radius, 0.1, -0.18 + Math.sin(angle) * radius], [center + Math.cos(next) * radius, 0.1, -0.18 + Math.sin(next) * radius], 0.88 - step % 4 * 0.025, 0.28, 'rock');
      }
      gateway('moon-city-gate', center, 0.1, -0.18, 2.3, 0.85, 0.34, 0.54, 0.27, 'rock');
      for (const edge of [-1, 1]) box('exposed-core', center + edge * 0.52, 0.12, 0.28, 0.415, 0.68, 0.55, 'earth');
    }
  }
  if (id === 'liujiakou') {
    river(2.25);
    gateway('watergate-remnant', 0, 0.06, 0, 2.55, 0.85, 0.85, 0.8, 0.26, 'rock');
    for (const side of [-1, 1]) {
      box('watergate-broken-side', side * 0.95, 0.91, 0, 0.5, side === -1 ? 0.58 : 0.69, 0.85);
      box('watergate-broken-back', side * 0.55, 0.91, -0.37, 0.45, side === -1 ? 0.4 : 0.52, 0.1);
    }
    tower(-10, 1.15, -0.6, true, 0.65);
  }
  return true;
}
