const STONE = { tex: 'travertine', tint: 0xb8b3a5 };
const PALE = { tex: 'travertine', tint: 0xe5e1d4 };
const ROOF = { tex: 'roof', tint: 0x969da4 };
const TILE = { tex: 'stone', tint: 0x858a87 };
const WOOD = { tex: 'walnut', tint: 0x703e30 };
const GOLD = { tex: 'paint', tint: 0xc4a368 };
const BRONZE = { tex: 'stone', tint: 0x454b42 };
const DARK = { tex: 'paint', tint: 0x282d32 };

export function createQinArchitecture({ batch, labels, obstacles, solids }) {
  const box = (x, y, z, width, height, depth, look = STONE, rotation = {}) =>
    batch.box(x, y, z, width, height, depth, look, rotation);
  function block(x, y, z, width, height, depth, look = STONE, floor = y) {
    box(x, y, z, width, height, depth, look);
    const bounds = { x0: x - width / 2 - 0.05, x1: x + width / 2 + 0.05, z0: z - depth / 2 - 0.05, z1: z + depth / 2 + 0.05, y0: y, y1: y + height };
    solids.push(bounds);
    obstacles.push({ ...bounds, floor });
  }
  function sign(text, x, y, z, width = 4, height = 0.8, yaw = 0) {
    batch.at(x, y, z, yaw, () => box(0, 0, -0.07, width + 0.14, height + 0.12, 0.12, WOOD));
    labels.push({ text, x, y: y + height / 2, z, width, height, yaw });
  }
  function roof(x, y, z, width, depth, rise = 2.4, palette = {}) {
    const surface = palette.surface || ROOF, ridge = palette.ridge || TILE, trim = palette.trim || WOOD;
    const layers = Math.ceil(rise / 0.22);
    for (let layer = 0; layer < layers; layer++) {
      const fraction = layer / layers;
      box(x, y + layer * 0.22, z, width - fraction * depth * 0.65, 0.24, depth * (1 - fraction * 0.92), surface);
    }
    box(x, y + rise, z, Math.max(1.5, width - depth * 0.65), 0.34, 0.38, ridge);
    for (const side of [-1, 1]) {
      box(x, y - 0.24, z + side * (depth / 2 - 0.1), width, 0.3, 0.22, trim);
      for (let tileX = -width / 2 + 0.2; tileX < width / 2; tileX += 0.7) {
        box(x + tileX, y - 0.04, z + side * (depth / 2 + 0.03), 0.24, 0.18, 0.32, ridge);
      }
      for (const end of [-1, 1]) {
        for (let tip = 0; tip < 3; tip++) box(x + end * (width / 2 - 0.5 + tip * 0.22), y + tip * 0.14, z + side * (depth / 2 - 0.25 + tip * 0.12), 0.5, 0.2, 0.42, surface);
      }
    }
  }
  function railing(x, y, z, length, yaw = 0, look = PALE) {
    batch.at(x, y, z, yaw, () => {
      box(0, 0.18, 0, length, 0.14, 0.2, look);
      box(0, 0.9, 0, length, 0.16, 0.25, look);
      for (let along = -length / 2; along <= length / 2 + 0.01; along += 1.4) {
        box(along, 0, 0, 0.22, 1.15, 0.22, look);
        box(along, 1.13, 0, 0.34, 0.18, 0.34, look);
      }
    });
  }
  function hall(x, y, z, width, depth, name, open = false) {
    box(x, y - 0.12, z, width + 1, 0.12, depth + 1, STONE);
    block(x, y, z - depth / 2, width, 4, 0.5, STONE, y);
    for (const side of [-1, 1]) block(x + side * width / 2, y, z, 0.4, 4, depth, STONE, y);
    for (let offset = -width / 2 + 0.5; offset < width / 2; offset += 3) {
      block(x + offset, y, z + depth / 2, 0.42, 4.5, 0.42, WOOD, y);
      if (!open && Math.abs(offset) > 2.5) {
        box(x + offset, y + 0.3, z + depth / 2, 2.5, 2.8, 0.14, WOOD);
        for (let bar = -1; bar <= 1; bar += 0.4) box(x + offset + bar, y + 1, z + depth / 2 + 0.09, 0.055, 1.7, 0.07, GOLD);
      }
    }
    roof(x, y + 4.6, z, width + 3, depth + 3, 2.2);
    sign(name, x, y + 3.25, z + depth / 2 + 0.3, Math.min(6, width / 2), 0.85);
  }
  function person(x, y, z, scale = 1, look = PALE, pose = 'court', yaw = 0, palette = {}) {
    const face = palette.face || look, trim = palette.trim || look;
    const part = (name, column, bottom, row, width, height, depth, material, rotation = {}) =>
      box(column, bottom, row, width, height, depth, material, palette.actor ? { ...rotation, tag: `${palette.actor}:${name}`, shadow: false } : rotation);
    batch.at(x, y, z, yaw, () => {
      for (let level = 0; level < 7; level++) {
        const fraction = level / 7;
        part(`robe-${level}`, 0, scale * level * 0.16, 0, scale * (0.78 - fraction * 0.34), scale * 0.18, scale * (0.5 - fraction * 0.17), look);
      }
      part('torso', 0, scale * 1.05, 0, scale * 0.62, scale * 0.28, scale * 0.4, look);
      part('face', 0, scale * 1.32, 0, scale * 0.32, scale * 0.42, scale * 0.31, face);
      part('helmet', 0, scale * 1.72, -scale * 0.02, scale * 0.37, scale * 0.16, scale * 0.37, trim);
      for (const side of [-1, 1]) {
        const gripping = palette.actor && pose === 'guard' && side === 1;
        part(`arm-${side}`, side * scale * 0.36, scale * 0.7, scale * 0.06, scale * 0.28, scale * 0.6, scale * 0.38, look, { rz: side * 0.12 });
        part(`hand-${side}`, scale * (gripping ? 0.53 : side * 0.18), scale * (gripping ? 1.02 : 1.07), scale * (gripping ? 0.14 : 0.28),
          scale * 0.26, scale * 0.16, scale * 0.35, face, { ry: side * 0.3 });
        if (palette.actor) {
          part(`leg-${side}`, side * scale * 0.19, 0, 0, scale * 0.2, scale * 0.7, scale * 0.24, trim);
          part('eye', side * scale * 0.078, scale * 1.57, scale * 0.164, scale * 0.054, scale * 0.026, scale * 0.022, trim);
        }
      }
      part('nose', 0, scale * 1.46, scale * 0.18, scale * 0.08, scale * 0.1, scale * 0.08, face);
      if (palette.detail) {
        for (const side of [-1, 1]) box(side * scale * 0.08, scale * 1.56, scale * 0.165, scale * 0.06, scale * 0.05, scale * 0.035, palette.detail);
        box(0, scale * 0.65, 0, scale * 0.6, scale * 0.07, scale * 0.43, trim);
      }
      if (pose === 'guard') part('spear', scale * 0.53, 0, scale * 0.14, scale * 0.05, scale * 2.3, scale * 0.05, trim);
      if (pose === 'scholar') box(0, scale * 1.1, scale * 0.5, scale * 0.52, scale * 0.08, scale * 0.3, trim);
    });
  }
  function horse(x, y, z, scale = 1, yaw = 0, look = BRONZE, trim = look) {
    batch.at(x, y, z, yaw, () => {
      box(0, scale * 0.85, 0, scale * 0.6, scale * 0.7, scale * 1.5, look);
      for (const side of [-1, 1]) for (const front of [-1, 1]) box(side * scale * 0.23, 0, front * scale * 0.53, scale * 0.15, scale * 1.05, scale * 0.18, look, { rx: front * 0.12 });
      box(0, scale * 1.25, scale * 0.62, scale * 0.4, scale * 0.8, scale * 0.4, look, { rx: -0.22 });
      box(0, scale * 1.83, scale * 0.85, scale * 0.33, scale * 0.34, scale * 0.7, look);
      for (const side of [-1, 1]) box(side * scale * 0.13, scale * 2.12, scale * 0.67, scale * 0.08, scale * 0.25, scale * 0.1, look);
      box(0, scale * 0.4, -scale * 0.85, scale * 0.12, scale * 1.05, scale * 0.18, trim, { rx: -0.25 });
      box(0, scale * 1.5, 0, scale * 0.72, scale * 0.12, scale * 0.62, trim);
    });
  }
  function wheel(x, y, z, radius, yaw = 0, look = WOOD, segments = 16) {
    batch.at(x, y, z, yaw, () => {
      for (let segment = 0; segment < segments; segment++) {
        const angle = segment / segments * Math.PI * 2;
        box(Math.cos(angle) * radius, Math.sin(angle) * radius - 0.12, 0, radius * Math.PI * 2 / segments + 0.08, 0.24, 0.25, look, { rz: angle + Math.PI / 2 });
      }
      for (let spoke = 0; spoke < 8; spoke++) box(0, -0.06, 0, radius * 1.9, 0.12, 0.18, look, { rz: spoke * Math.PI / 8 });
      box(0, -0.25, 0, 0.5, 0.5, 0.45, look);
    });
  }
  function pine(x, z, height = 6) {
    block(x, 0, z, 0.5, height * 0.8, 0.5, { tex: 'log', tint: 0x76634b });
    for (let level = 0; level < 4; level++) {
      const width = height * (0.58 - level * 0.1);
      box(x + Math.sin(level * 2) * 0.35, height * 0.38 + level * height * 0.15, z, width, height * 0.18, width * 0.8, { tex: 'leaves', tint: 0x59735a });
    }
  }
  return { box, block, sign, roof, railing, hall, person, horse, wheel, pine, looks: { STONE, PALE, ROOF, WOOD, GOLD, BRONZE, DARK } };
}
