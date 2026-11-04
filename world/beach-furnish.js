// Small beach details that make the open sand read as a lived-in shoreline.
// Everything stays in the shared model batch so the decoration costs no extra
// draw call beyond the existing furniture group.
import { PORTAL, IKUN_ENTRY, BOARDWALK } from './layout.js';
import { addRestPoint } from './rest-points.js';

const OAK = { tex: 'oak' };
const WALNUT = { tex: 'walnut' };
const DECK = { tex: 'deck' };
const LEAVES = { tex: 'leaves' };
const stone = { tex: 'paint', tint: 0x8a8f8a };
const coral = { tex: 'paint', tint: 0xf07d78 };
const aqua = { tex: 'paint', tint: 0x72c8c9 };
const linen = tint => ({ tex: 'linen', tint });
const glow = tint => ({ tex: 'paint', tint, emissive: 0.95 });
// Deepslate portal frame materials.
const deepslate = { tex: 'paint', tint: 0x4a4a52 };
const obsidian = { tex: 'paint', tint: 0x1a0f29 };
const spruce = { tex: 'walnut' };
const lanternGlow = { tex: 'paint', tint: 0xffd49c, emissive: 1 };
const chain = { tex: 'chrome', tint: 0x5a5a5a };
// Path and beach decoration materials
const paver = { tex: 'pavers', tint: 0xa8a090 };
const sandstone = { tex: 'paint', tint: 0xe8dcc8 };
const shell = { tex: 'paint', tint: 0xf5ebe0 };
const driftwood = { tex: 'walnut', tint: 0x9a8a7a };
const rope = { tex: 'paint', tint: 0xc9b896 };

export function furnishBeach({ B, obstacles, bakes }) {
  const foot = (x, z, w, d) => obstacles.push({
    x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, level: 0,
  });
  const bake = (id, x, y, z, power, radius) => bakes.push({
    id, position: [x, y, z], power, radius, direction: null,
  });

  function palm(x, z, scale = 1) {
    const height = 2.8 * scale;
    B.box(x, 0, z, 0.24 * scale, height, 0.24 * scale, WALNUT, { rz: -0.06 });
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + 0.25;
      const dx = Math.cos(a), dz = Math.sin(a);
      B.box(x + dx * 0.48 * scale, height - 0.18 * scale, z + dz * 0.48 * scale,
        1.35 * scale, 0.1 * scale, 0.22 * scale, LEAVES, { ry: -a, rz: dz * 0.22 });
    }
    foot(x, z, 0.38 * scale, 0.38 * scale);
  }

  function umbrella(x, z, tint) {
    B.box(x, 0, z, 0.14, 2.35, 0.14, WALNUT);
    B.box(x, 2.15, z, 2.8, 0.12, 2.8, linen(tint));
    B.box(x, 2.27, z, 2.05, 0.1, 2.05, linen(tint === 0xf3b6b1 ? 0xffe2a9 : 0xf3b6b1));
    B.box(x, 2.37, z, 1.15, 0.1, 1.15, linen(tint));
    foot(x, z, 0.38, 0.38);
  }

  function lounger(x, z, ry, tint) {
    B.at(x, 0, z, ry, () => {
      B.box(0, 0.2, 0, 0.78, 0.12, 1.5, OAK);
      B.box(0, 0.29, 0, 0.66, 0.08, 1.32, linen(tint));
      B.box(0, 0.72, -0.49, 0.76, 0.7, 0.12, linen(tint), { rx: -0.22 });
      B.box(-0.3, 0.02, 0, 0.07, 0.22, 1.15, WALNUT);
      B.box(0.3, 0.02, 0, 0.07, 0.22, 1.15, WALNUT);
    });
    foot(x, z, 0.95, 1.6);
    addRestPoint({ id: `beach-lounger-${x}`, name: '沙滩躺椅', en: 'Beach lounger', x, y: 0.37, z, yaw: ry, kind: 'recline' });
  }

  function picnicTable(x, z) {
    B.box(x, 1.05, z, 2.5, 0.14, 0.95, OAK);
    B.box(x, 0.58, z - 0.82, 2.25, 0.16, 0.34, DECK);
    B.box(x, 0.58, z + 0.82, 2.25, 0.16, 0.34, DECK);
    for (const dx of [-0.82, 0.82]) for (const dz of [-0.32, 0.32]) {
      B.box(x + dx, 0.02, z + dz, 0.12, 0.62, 0.12, WALNUT, { rz: dx > 0 ? -0.12 : 0.12 });
    }
    foot(x, z, 2.7, 2.2);
    for (const side of [-1, 1]) for (const offset of [-0.65, 0.65]) {
      addRestPoint({ id: `beach-picnic-${side}-${offset}`, name: '野餐长凳', en: 'Picnic bench', x: x + offset, y: 0.74, z: z + side * 0.82, yaw: side < 0 ? 0 : Math.PI });
    }
  }

  function firePit(x, z) {
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      B.box(x + Math.cos(a) * 0.72, 0.04, z + Math.sin(a) * 0.72, 0.32, 0.18, 0.25, stone, { ry: a });
    }
    B.box(x, 0.22, z, 1.25, 0.12, 0.12, WALNUT, { ry: 0.7 });
    B.box(x, 0.3, z, 1.25, 0.12, 0.12, WALNUT, { ry: -0.7 });
    B.box(x, 0.34, z, 0.3, 0.4, 0.3, glow(0xffa24f));
    B.box(x, 0.54, z, 0.18, 0.34, 0.18, glow(0xffe5a2));
    bake('beach-fire-' + x + '-' + z, x, 1.2, z, 4.0, 10);  // enhanced power and radius
  }

  // Minecraft-style torch: wood post with flame top
  function torch(x, z) {
    B.box(x, 0, z, 0.1, 1.6, 0.1, WALNUT);
    B.box(x, 1.5, z, 0.16, 0.25, 0.16, glow(0xffb04a));   // orange flame
    B.box(x, 1.68, z, 0.1, 0.15, 0.1, glow(0xffe580));    // yellow core
    bake('torch-' + x + '-' + z, x, 1.65, z, 2.2, 6.5);
  }

  // Lantern post with hanging lantern
  function lanternPost(x, z) {
    B.box(x, 0, z, 0.14, 2.2, 0.14, WALNUT);
    B.box(x, 2.0, z + 0.18, 0.04, 0.3, 0.04, chain);
    B.box(x, 1.65, z + 0.18, 0.2, 0.28, 0.2, lanternGlow);
    bake('lantern-' + x + '-' + z, x, 1.75, z + 0.18, 2.8, 7.5);
  }

  function beachFlag(x, z) {
    B.box(x, 0, z, 0.08, 2.2, 0.08, WALNUT);
    B.box(x + 0.34, 1.72, z, 0.68, 0.42, 0.06, coral);
    B.box(x + 0.34, 1.3, z, 0.68, 0.42, 0.06, aqua);
    foot(x, z, 0.22, 0.22);
  }

  function pavilion(x, z) {
    B.box(x, 0.02, z, 4.8, 0.1, 3.3, DECK);
    for (const dx of [-2.15, 2.15]) for (const dz of [-1.35, 1.35]) {
      B.box(x + dx, 0, z + dz, 0.18, 2.55, 0.18, WALNUT);
    }
    B.box(x, 2.48, z, 5.0, 0.18, 3.5, OAK);
    for (const dx of [-1.65, -0.55, 0.55, 1.65]) {
      B.box(x + dx, 2.59, z, 0.76, 0.08, 3.25, linen(0xf2c9bb));
    }
    B.box(x, 0.62, z + 0.95, 3.4, 0.16, 0.34, DECK);
    B.box(x, 0.62, z - 0.95, 3.4, 0.16, 0.34, DECK);
    for (const dz of [-1.35, 1.35]) {
      B.box(x - 1.2, 0.02, z + dz, 0.08, 0.65, 0.08, WALNUT);
      B.box(x + 1.2, 0.02, z + dz, 0.08, 0.65, 0.08, WALNUT);
    }
    for (const dx of [-2.15, 2.15]) {
      B.box(x + dx, 2.68, z, 0.18, 0.18, 0.18, glow(0xffd69b));
      bake('beach-pavilion-' + x + '-' + dx, x + dx, 2.8, z, 2.2, 6);
    }
    foot(x, z, 4.9, 3.4);
    for (const side of [-1, 1]) for (const offset of [-1, 0, 1]) {
      addRestPoint({ id: `beach-pavilion-${side}-${offset}`, name: '凉亭长凳', en: 'Pavilion bench', x: x + offset, y: 0.78, z: z + side * 0.95, yaw: side < 0 ? 0 : Math.PI });
    }
  }

  function volleyball(x, z) {
    B.box(x - 2.15, 0, z, 0.1, 2.2, 0.1, WALNUT);
    B.box(x + 2.15, 0, z, 0.1, 2.2, 0.1, WALNUT);
    B.box(x, 1.35, z, 4.25, 0.7, 0.05, linen(0xf2eee3));
    B.box(x, 1.7, z, 4.25, 0.06, 0.08, aqua);
    B.box(x, 1.02, z, 0.42, 0.42, 0.42, linen(0xf4dfb6));
    foot(x - 2.15, z, 0.24, 0.24);
    foot(x + 2.15, z, 0.24, 0.24);
  }

  // Deepslate nether portal frame around the rectangular portal vortex.
  // The portal faces north (yaw: π), frame builds behind (+z) and around it.
  // New vortex: RX=0.75m, RY=1.28m, starts at ground, total 1.5m × 2.56m
  const px = PORTAL.x, pz = PORTAL.z;
  const frameZ = pz + 0.12; // outer frame sits just behind vortex
  // Base platform with steps (approach from north)
  B.box(px, 0.08, frameZ + 0.32, 2.8, 0.16, 0.9, deepslate);
  B.box(px, 0.22, frameZ + 0.14, 2.4, 0.14, 0.55, deepslate);
  // Side pillars
  for (const side of [-1, 1]) {
    const sx = px + side * 1.05;
    // Main pillar body
    B.box(sx, 0, frameZ, 0.48, 2.9, 0.48, deepslate);
    // Pillar wall detail (narrower decorative strips)
    B.box(sx, 0.15, frameZ - 0.22, 0.28, 2.5, 0.12, deepslate);
    B.box(sx, 0.15, frameZ + 0.22, 0.28, 2.5, 0.12, deepslate);
    // Spruce trapdoor decorations on pillar outer sides
    B.box(sx + side * 0.28, 1.0, frameZ, 0.07, 0.5, 0.34, spruce);
    B.box(sx + side * 0.28, 2.0, frameZ, 0.07, 0.5, 0.34, spruce);
    // Lantern: chain + glowing box (in front of pillars)
    B.box(sx, 2.5, pz - 0.32, 0.05, 0.38, 0.05, chain);
    B.box(sx, 2.08, pz - 0.32, 0.20, 0.32, 0.20, lanternGlow);
    bake('portal-lantern-' + side, sx, 2.2, pz - 0.32, 2.8, 7);
  }
  // Obsidian inner frame hugging the rectangular vortex (1.5m × 2.56m)
  const obsZ = pz + 0.04; // snug against vortex back
  B.box(px - 0.82, 0, obsZ, 0.18, 2.62, 0.22, obsidian);
  B.box(px + 0.82, 0, obsZ, 0.18, 2.62, 0.22, obsidian);
  B.box(px, 2.53, obsZ, 1.82, 0.18, 0.22, obsidian);
  // Top arch with stairs pattern
  B.box(px, 2.82, frameZ, 2.4, 0.28, 0.52, deepslate);
  B.box(px - 0.88, 3.0, frameZ, 0.55, 0.20, 0.44, deepslate);
  B.box(px + 0.88, 3.0, frameZ, 0.55, 0.20, 0.44, deepslate);
  B.box(px, 3.12, frameZ, 1.1, 0.25, 0.44, deepslate);
  foot(px, frameZ + 0.12, 3.0, 1.1);

  // A short plank walk ties the spawn point to the mailbox and portal.
  for (let z = 19; z < 25; z += 0.85) B.box(0.5, 0.025, z, 1.25, 0.06, 0.46, DECK);
  for (let z = 24.7; z < 28; z += 0.85) B.box(4.1, 0.025, z, 5.8, 0.06, 0.46, DECK);
  // The shore boardwalk gives the beach a readable edge without enclosing it.
  for (let x = BOARDWALK.x0; x <= BOARDWALK.x1; x += BOARDWALK.step) {
    B.box(x, 0.06, BOARDWALK.z, BOARDWALK.width, 0.1, BOARDWALK.depth, DECK);
    if (x % 6 === 5 || x % 6 === -1) {
      B.box(x, 0.06, 27.22, 0.12, 1.05, 0.12, WALNUT);
      B.box(x, 1.12, 27.22, 0.18, 0.2, 0.18, glow(0xffd69b));
      bake('beach-boardwalk-' + x, x, 1.25, 27.22, 1.8, 5.5);
    }
  }

  // West lounge: the open sand between the crafting tower and the portal.
  palm(-27.5, 22.5, 1.08);
  palm(-12.8, 18.5, 0.9);
  pavilion(-25.0, 20.5);
  umbrella(-18.8, 21.1, 0xf3b6b1);
  lounger(-20.0, 22.5, 0.12, 0xf5d7cf);
  lounger(-17.6, 22.5, -0.12, 0x9fd5dc);
  picnicTable(-24.2, 26.0);

  // A small fire circle gives the centre of the beach a warm focal point.
  firePit(-9.2, 24.0);
  beachFlag(-5.8, 20.7);
  volleyball(-1.3, 21.2);

  // East side: a second, cooler rest spot balances the ferris wheel.
  palm(13.8, 20.0, 0.98);
  umbrella(15.0, 24.2, 0x9fd5dc);
  lounger(13.8, 25.5, 0.1, 0xffe1aa);
  lounger(16.2, 25.5, -0.1, 0xf3b6b1);
  firePit(27.4, 24.8);
  palm(35.2, 22.8, 0.82);

  // ===== Additional palm trees for tropical feel =====
  // West side
  palm(-32, 20, 1.05);
  palm(-30, 8, 0.92);
  palm(-28, -5, 0.88);
  palm(-25, 15, 0.95);
  // East side
  palm(32, 18, 1.0);
  palm(30, 5, 0.9);
  palm(28, -8, 0.85);
  palm(25, 12, 0.95);
  // Central area accent
  palm(-8, -8, 0.78);
  palm(10, 2, 0.85);
  palm(18, 8, 0.9);
  // Beach area fill
  palm(-22, 24, 0.88);
  palm(22, 22, 0.92);
  palm(5, 15, 0.75);

  // ===== Torches for night lighting =====
  // North area (between buildings)
  torch(-20, -10);
  torch(-5, -15);
  torch(12, -8);
  // Central path
  torch(-12, 5);
  torch(0, 5);
  torch(12, 5);
  // Beach approach
  torch(-8, 18);
  torch(12, 18);
  // Building entrances
  torch(-22, -14);
  torch(-22, -18);
  torch(0, -2);
  torch(10, 0);
  torch(28, -10);
  torch(28, -18);

  // ===== Lantern posts along boardwalk =====
  lanternPost(-24, 27);
  lanternPost(-12, 27);
  lanternPost(0, 27);
  lanternPost(12, 27);
  lanternPost(24, 27);

  // ===== Stone paths connecting areas =====
  // Path stones: irregular stepping stones
  function pathStone(x, z, size = 0.6) {
    const s = size * (0.8 + Math.random() * 0.4);
    B.box(x, 0.02, z, s, 0.06, s * (0.85 + Math.random() * 0.3), paver, { ry: Math.random() * 0.5 });
  }
  // Main path from spawn to north (connecting buildings)
  for (let z = 15; z >= -18; z -= 1.8) {
    pathStone(0.5 + (Math.random() - 0.5) * 0.4, z);
  }
  // Branch to IKUN (east)
  for (let step = 0; step <= 4; step++) {
    pathStone(2 + (IKUN_ENTRY.x - 2) * step / 4, IKUN_ENTRY.z + (Math.random() - 0.5) * 0.3);
  }
  // Branch to crafting tower (west)
  for (let x = -2; x >= -20; x -= 1.8) {
    pathStone(x, -12 + (Math.random() - 0.5) * 0.4);
  }
  // Branch to ferris wheel (east)
  for (let x = 3; x <= 18; x += 1.7) {
    pathStone(x, -10 + (Math.random() - 0.5) * 0.3);
  }

  // ===== Beach decorations =====
  // Shells scattered on sand
  function shell_decor(x, z) {
    const s = 0.12 + Math.random() * 0.1;
    B.box(x, 0.01, z, s, 0.04, s * 0.8, shell, { ry: Math.random() * Math.PI });
  }
  for (let i = 0; i < 25; i++) {
    shell_decor(-28 + Math.random() * 56, 20 + Math.random() * 6);
  }

  // Rocks/boulders cluster
  function rock(x, z, size = 0.5) {
    const h = size * (0.6 + Math.random() * 0.5);
    B.box(x, h / 2, z, size, h, size * 0.9, stone, { ry: Math.random() * Math.PI, rx: Math.random() * 0.15 });
  }
  // West rock cluster
  rock(-30, 26, 0.7);
  rock(-29.3, 25.5, 0.45);
  rock(-30.5, 25.2, 0.35);
  // East rock cluster
  rock(29, 26.5, 0.65);
  rock(28.2, 26, 0.4);
  rock(29.5, 25.8, 0.5);

  // Small rowboat on beach
  B.at(-14, 0, 26, 0.3, () => {
    // Hull
    B.box(0, 0.18, 0, 0.9, 0.35, 2.2, driftwood);
    B.box(0, 0.32, 0, 0.7, 0.18, 1.9, driftwood);
    // Seats
    B.box(0, 0.38, -0.5, 0.6, 0.06, 0.25, OAK);
    B.box(0, 0.38, 0.5, 0.6, 0.06, 0.25, OAK);
    // Oars
    B.box(0.55, 0.42, 0, 0.08, 0.08, 1.5, WALNUT, { rz: 0.15 });
    B.box(-0.55, 0.42, 0, 0.08, 0.08, 1.5, WALNUT, { rz: -0.15 });
  });
  foot(-14, 26, 1.2, 2.5);
  for (const offset of [-0.5, 0.5]) addRestPoint({ id: `beach-boat-${offset}`, name: '小船座位', en: 'Rowboat seat', x: -14 + Math.sin(0.3) * offset, y: 0.44, z: 26 + Math.cos(0.3) * offset, yaw: 0.3 });

  // Sand castle
  B.at(20, 0, 20, 0, () => {
    // Base mound
    B.box(0, 0.15, 0, 1.2, 0.3, 1.2, sandstone);
    // Towers
    B.box(-0.35, 0.45, -0.35, 0.35, 0.4, 0.35, sandstone);
    B.box(0.35, 0.5, -0.35, 0.3, 0.5, 0.3, sandstone);
    B.box(-0.35, 0.4, 0.35, 0.3, 0.35, 0.3, sandstone);
    B.box(0.35, 0.42, 0.35, 0.28, 0.38, 0.28, sandstone);
    // Center tower
    B.box(0, 0.55, 0, 0.4, 0.55, 0.4, sandstone);
    // Flag
    B.box(0, 0.85, 0, 0.04, 0.4, 0.04, WALNUT);
    B.box(0.12, 1.1, 0, 0.2, 0.15, 0.02, coral);
  });
  foot(20, 20, 1.4, 1.4);

  // Driftwood logs
  B.box(-5, 0.12, 26.5, 0.18, 0.18, 1.8, driftwood, { ry: 0.25 });
  B.box(25, 0.1, 20, 0.15, 0.15, 1.4, driftwood, { ry: -0.4 });

  // Fishing net draped on post
  B.box(30, 0, 24, 0.12, 1.5, 0.12, WALNUT);
  B.box(30.3, 0.8, 24, 0.6, 0.8, 0.04, rope);
  B.box(30.5, 0.5, 24, 0.4, 0.5, 0.04, rope);
}
