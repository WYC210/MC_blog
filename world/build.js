import { BoxBatch } from '@engine/world/blocks.js';
import { buildIsland } from '@engine/world/terrain.js';
import { buildForest, buildTufts } from '@engine/world/landscape.js';
import { ISLAND, LAND, BAY, BOARDWALK, TREES, MODEL_ORIGIN, IKUN_CENTER, IKUN_ENTRY, LEHUN_ORIGIN, ORIGIN_GONGLU, ORIGIN_FERRIS } from './layout.js';
import { buildLitematicIKUN } from './ikun-model.js';
import { buildLitematicLEHUN } from './lehun-model.js';
import { buildLitematicGONGLU } from './gonglu-model.js';
import { buildLitematicFERRIS } from './ferris-model.js';
import { buildSeaToys } from './sea.js';
import { furnishGONGLU } from './gonglu-furnish.js';
import { furnishLeHun } from './lehun-furnish.js';
import { furnishBeach } from './beach-furnish.js';
import { createComputer } from './computer.js';
import { createFishing } from './fishing.js';
import { REST_POINTS } from './rest-points.js';
import { createFurnitureInteraction } from './furniture-interaction.js';
import { createJetSki } from './jet-ski.js';
import { furnishIKUN } from './ikun-furnish.js';
import { createResident } from './resident.js';

// Two cottages rebuilt one-to-one from litematics. The palette keeps every
// block's properties, so stairs, slabs, doors, panes and lanterns come out as
// real shapes rather than cubes. Exteriors are faithful; the interiors are
// deliberately left empty for now (loose furniture is dropped).
let toys = null;

export function build({ grid, layer, materials, stage }) {
  REST_POINTS.length = 0;
  defineModelBlocks(grid);
  // The whole island is a sand beach; terrain keeps its original coast (LAND)
  // while the grid (ISLAND) reaches further south to hold the bay floor.
  buildIsland(grid, LAND, { surfaceAt: () => 'sand', corner: 10, wobble: 0 });
  // Dig the swimming bay: clear the shallows inside the pool rect down to the
  // bed and lay a sand floor, so the beach drops off into swimmable water.
  for (let x = BAY.x0; x < BAY.x1; x++) for (let z = BAY.z0; z < BAY.z1; z++) {
    for (let y = -2; y <= 0; y++) if (grid.type(x, y, z)) grid.set(x, y, z, null);
    grid.fill(x, -5, z, x + 1, -3, z + 1, 'sand');
  }
  // The ocean ring: a sand sea floor under the swimmable water that
  // surrounds the island on all four sides.
  for (let x = ISLAND.x0; x < ISLAND.x1; x++) for (let z = ISLAND.z0; z < ISLAND.z1; z++) {
    if (grid.type(x, -1, z)) continue;
    grid.fill(x, -5, z, x + 1, -3, z + 1, 'sand');
  }
  const B = new BoxBatch(layer);
  const walk = [], bakes = [], obstacles = [], hotspots = [];
  const surfaces = {};
  const emitShape = (name, props, wx, wy, wz, kind, lookOverride = null) => {
    const cx = wx + 0.5, cz = wz + 0.5, L = lookOverride ?? lookFor(name);
    if (kind === 'stairs') {
      // One metre a step, drawn as two half-metre treads. The walk surface is
      // registered in thirds: the engine's site walker treats any rise over
      // 0.7 m as an overhead blocker, so a full metre of rise needs intermediate
      // treads (tread:true waives the check between them). The IKUN ramp is
      // built from carpet, which carries no facing — it ascends south (+z).
      if (!props.facing) props = { facing: 'south' };
      const [fx, fz] = FACING[props.facing ?? 'north'];
      const top = props.half === 'top';
      B.box(cx, wy + (top ? 0.5 : 0), cz, 1, 0.5, 1, L);
      B.box(cx + fx * 0.25, wy + (top ? 0 : 0.5), cz + fz * 0.25, fx ? 0.5 : 1, 0.5, fz ? 0.5 : 1, L);
      for (const f of [1 / 3, 2 / 3, 1]) walk.push([wx, wz, wy + f, true]);
    } else if (kind === 'slab') {
      const low = props.type !== 'top';
      B.box(cx, wy + (low ? 0 : 0.5), cz, 1, 0.5, 1, L);
      // Both halves are standable: LeHun's interior staircase is built from
      // alternating top/bottom slabs, each half one tread of the flight.
      walk.push([wx, wz, wy + (low ? 0.5 : 1), true]);
    } else if (kind === 'carpet') {
      // Ground-level carpets (the IKUN feet marks) clamp to the lawn surface —
      // that model sits one metre low to stay inside the world grid.
      B.box(cx, Math.max(wy, 0), cz, 1, 0.07, 1, L);
    } else if (kind === 'rod') {
      const f = props.facing ?? 'up';
      if (f === 'up' || f === 'down') B.box(cx, wy + (f === 'down' ? 0.38 : 0), cz, 0.14, 0.62, 0.14, L);
      else B.box(cx + (f === 'east' ? 0.19 : f === 'west' ? -0.19 : 0), wy + 0.43, cz + (f === 'south' ? 0.19 : f === 'north' ? -0.19 : 0), f === 'east' || f === 'west' ? 0.62 : 0.14, 0.14, f === 'north' || f === 'south' ? 0.62 : 0.14, L);
      bakes.push({ id: 'rod' + bakes.length, position: [cx, wy + 0.5, cz], power: 3, radius: 7, direction: null });
    } else if (kind === 'banner') {
      const tint = L.tint;
      if (name.endsWith('_banner')) {
        // A standing banner: pole through the cell, flag on the top half.
        B.box(cx, wy, cz, 0.09, 1, 0.09, LOOKS.wood);
        B.box(cx + 0.2, wy + 0.35, cz, 0.06, 0.5, 0.72, { tex: 'paint', tint });
      } else {
        // A wall banner: flag hanging against the wall it is mounted on.
        const [dx, dz] = FACING[props.facing ?? 'north'];
        B.box(cx - dx * 0.28, wy + 0.05, cz - dz * 0.28, dx ? 0.08 : 0.72, 0.85, dz ? 0.08 : 0.72, { tex: 'paint', tint });
        B.box(cx - dx * 0.42, wy, cz - dz * 0.42, 0.09, 1, 0.09, LOOKS.wood);
      }
    } else if (kind === 'pane') {
      // Glass panes as a slim cross; the tint carries the stained colour.
      B.box(cx, wy, cz, 1, 1, 0.06, L);
      B.box(cx, wy, cz, 0.06, 1, 1, L);
    } else if (kind === 'lantern') {
      B.box(cx, wy + 0.55, cz, 0.24, 0.38, 0.24, L);
      bakes.push({ id: 'lantern' + bakes.length, position: [cx, wy + 0.7, cz], power: 3, radius: 8, direction: null });
    } else if (kind === 'torch') {
      B.box(cx, wy + 0.15, cz, 0.09, 0.55, 0.09, LOOKS.wood);
      B.box(cx, wy + 0.7, cz, 0.13, 0.13, 0.13, LOOKS.flame);
      bakes.push({ id: 'torch' + bakes.length, position: [cx, wy + 0.75, cz], power: 2, radius: 6, direction: null });
    } else if (kind === 'panel') {
      // A closed trapdoor: a thin panel against the face it is mounted on.
      const [dx, dz] = FACING[props.facing ?? 'north'];
      B.box(cx - dx * 0.42, wy + 0.5, cz - dz * 0.42, dx ? 0.07 : 0.85, 1, dz ? 0.07 : 0.85, L);
    } else if (kind === 'chain') {
      B.box(cx, wy, cz, 0.12, 1, 0.12, L);
    } else if (kind === 'fence') {
      B.box(cx, wy, cz, 0.25, 1, 0.25, L);
    } else if (kind === 'gate') {
      // A fence gate: the rail runs along its facing.
      const across = FACING[props.facing ?? 'north'][1] !== 0;
      B.box(cx, wy, cz, across ? 0.9 : 0.125, 0.85, across ? 0.125 : 0.9, L);
    } else if (kind === 'bars') {
      B.box(cx, wy, cz, 0.2, 1, 0.2, L);
      if ((props.south ?? 'false') === 'true') B.box(cx, wy + 0.4, cz + 0.5, 0.2, 0.2, 1, L);
    } else if (kind === 'plate') {
      B.box(cx, wy, cz, 0.9, 0.06, 0.9, L);
    } else if (kind === 'bamboo') {
      B.box(cx, wy, cz, 0.24, 1, 0.24, L);
    } else if (kind === 'campfire') {
      B.box(cx, wy, cz, 0.85, 0.18, 0.16, LOOKS.wood);
      B.box(cx, wy, cz, 0.16, 0.18, 0.85, LOOKS.wood);
      B.box(cx, wy + 0.12, cz, 0.3, 0.18, 0.3, LOOKS.flame);
      bakes.push({ id: 'campfire' + bakes.length, position: [cx, wy + 0.3, cz], power: 3, radius: 8, direction: null });
    } else if (kind === 'dripleaf') {
      B.box(cx, wy, cz, 0.1, 0.75, 0.1, LOOKS.dripleaf);
      B.box(cx, wy + 0.75, cz, 0.9, 0.06, 0.9, LOOKS.dripleaf);
    } else if (kind === 'stem') {
      B.box(cx, wy, cz, 0.1, 1, 0.1, LOOKS.dripleaf);
    } else if (kind === 'pot') {
      B.box(cx, wy, cz + 0.05, 0.55, 0.72, 0.55, LOOKS.terra);
      B.box(cx, wy + 0.72, cz + 0.05, 0.65, 0.1, 0.65, LOOKS.terra);
    }
  };
  const ikunWalkStart = walk.length, ikunBakeStart = bakes.length;
  const ikunGrid = {
    set(x, y, z, type) {
      grid.set(2 * IKUN_CENTER.x - x - 1, y, 2 * IKUN_CENTER.z - z - 1, type);
    },
  };
  B.at(IKUN_CENTER.x, 0, IKUN_CENTER.z, Math.PI, () => B.at(-IKUN_CENTER.x, 0, -IKUN_CENTER.z, 0, () => {
    buildLitematicIKUN(ikunGrid, MODEL_ORIGIN, mapIKUN, () => 'model',
    (name, props, wx, wy, wz) => {
      const mx = wx - MODEL_ORIGIN.x, my = wy - MODEL_ORIGIN.y, mz = wz - MODEL_ORIGIN.z;
      if (name === 'minecraft:black_wall_banner' && my === 12 && mz === 15) {
        B.box(wx + 0.5, wy, wz + 0.5, 0.14, 1, 0.14, LOOKS.rod);
        B.box(wx + 0.5, wy + 0.35, wz + 0.7, 0.72, 0.5, 0.06, LOOKS.black);
        bakes.push({ id: 'ikun-eye-stem-' + mx, position: [wx + 0.5, wy + 0.5, wz + 0.5], power: 3, radius: 7, direction: null });
        return;
      }
      // The chicken's white eye rods were stored on the side of the head
      // (x=1/6, z=8). Move each pair onto the front face and rotate to face south.
      if (name === 'minecraft:end_rod' && (mx === 1 || mx === 6) &&
          (my === 6 || my === 7) && mz === 8) {
        if (my === 6) return;
        const eyeX = mx === 1 ? 2 : 5;
        emitShape(name, { ...props, facing: 'south' }, MODEL_ORIGIN.x + eyeX, wy, MODEL_ORIGIN.z + 13, 'rod', LOOKS.rod);
        return;
      }
      // The mouth stripe (mz=6) also needs to move to the front face, rotated to face south.
      if (name === 'minecraft:end_rod' && mx >= 2 && mx <= 5 && my === 8 && mz === 6) {
        emitShape(name, { ...props, facing: 'south' }, wx, wy, MODEL_ORIGIN.z + 13, kindIKUN(name, mx, 13));
        return;
      }
      emitShape(name, props, wx, wy, wz, kindIKUN(name, mx, mz));
    });
  }));
  // IKUN sits apart from the wheel, so use a compact five-point fill rather
  // than a real-time light. The sources cover the face, side panels and feet
  // while staying inside the existing baked LIGHT_VOLUME.
  const ix = MODEL_ORIGIN.x + 4, iz = MODEL_ORIGIN.z + 8;
  bakes.push(
    { id: 'ikun-fill-front', position: [ix, 5.5, MODEL_ORIGIN.z + 16.5], power: 5.5, radius: 9.5, direction: null },
    { id: 'ikun-fill-back', position: [ix, 5.5, MODEL_ORIGIN.z - 0.5], power: 3.5, radius: 8.5, direction: null },
    { id: 'ikun-fill-west', position: [MODEL_ORIGIN.x - 1.5, 5.5, iz], power: 4.5, radius: 8.5, direction: null },
    { id: 'ikun-fill-east', position: [MODEL_ORIGIN.x + 9.5, 5.5, iz], power: 4.5, radius: 8.5, direction: null },
    { id: 'ikun-fill-top', position: [ix, 12.5, iz], power: 2.5, radius: 7.5, direction: null },
    { id: 'ikun-head-front', position: [ix, 8.5, MODEL_ORIGIN.z + 15], power: 6.5, radius: 7, direction: null },
    { id: 'ikun-head-top', position: [ix, 15.5, MODEL_ORIGIN.z + 14], power: 7, radius: 7.5, direction: null },
    { id: 'ikun-head-west', position: [MODEL_ORIGIN.x - 1, 8.5, iz], power: 3.5, radius: 7, direction: null },
    { id: 'ikun-head-east', position: [MODEL_ORIGIN.x + 9, 8.5, iz], power: 3.5, radius: 7, direction: null },
    // Extra light for the eye area (the black face needs more illumination at night)
    { id: 'ikun-eye-left', position: [MODEL_ORIGIN.x + 2.5, 7, MODEL_ORIGIN.z + 14], power: 3, radius: 4, direction: null },
    { id: 'ikun-eye-right', position: [MODEL_ORIGIN.x + 5.5, 7, MODEL_ORIGIN.z + 14], power: 3, radius: 4, direction: null },
  );
  for (let index = ikunWalkStart; index < walk.length; index++) {
    const tread = walk[index];
    tread[0] = 2 * IKUN_CENTER.x - tread[0] - 1;
    tread[1] = 2 * IKUN_CENTER.z - tread[1] - 1;
  }
  for (let index = ikunBakeStart; index < bakes.length; index++) {
    const source = bakes[index];
    source.position[0] = 2 * IKUN_CENTER.x - source.position[0];
    source.position[2] = 2 * IKUN_CENTER.z - source.position[2];
    if (source.direction) {
      source.direction[0] *= -1;
      source.direction[2] *= -1;
    }
  }
  buildLitematicLEHUN(grid, LEHUN_ORIGIN, mapLeHun, () => 'model', (name, props, wx, wy, wz) => {
    const mx = wx - 1, my = wy - 4, mz = wz - 34;
    // Match mapLeHun's upper-room cleanup for non-block shapes as well. The
    // litematic emits stairs, slabs and panels separately from grid blocks.
    if (my >= 15 && my < 23 && mx >= 2 && mx <= 15 && mz >= 2 && mz <= 15) return;
    // Keep the new east stairwell and its upper landing clear of the model's
    // wall/trim, including enough headroom for the 1.8 m character.
    if (wx >= 15 && wx < 17 && wz >= 36 && wz < 50 && wy >= 13 && wy < 22) return;
    if (wx >= 14 && wx < 17 && wz >= 40 && wz < 44 && wy >= 19 && wy < 22) return;
    // The leisure loft's floor (lehun-furnish, top y=20) cuts through the
    // model's bamboo grove at the north bed — keep the culms below it. The
    // west garden's plants would poke through the new floating stair too.
    if (wy >= 18 && wx >= 4 && wx <= 13 && wz >= 36 && wz <= 40 && /bamboo|dripleaf|stem/.test(name)) return;
    if (wy >= 13 && wx >= 2 && wx <= 4 && wz >= 40 && wz <= 47 && /bamboo|dripleaf|stem/.test(name)) return;
    // The hall band's old furniture and the dropped upper clutter leave the
    // shape emitter as well.
    if (lehunHallBlock(name, mx, my, mz)) return;
    if (my >= 12 && mx >= 2 && mx <= 15 && mz >= 2 && mz <= 15 &&
        /stained_glass|shulker|trapdoor|banner|chain|grindstone|hopper/.test(name)) return;
    if (my >= 8 && my <= 15 && mx >= 2 && mx <= 4 && mz >= 2 && mz <= 15 && !/moss/.test(name)) return;
    emitShape(name, props, wx, wy, wz, kindLeHun(name));
  });
  // The custom stair is rendered in the shared batch, so also remove the
  // model voxels in its shaft from the navigation/collision grid.
  for (let x = 15; x < 17; x++) for (let z = 36; z < 50; z++) {
    for (let y = 13; y < 22; y++) grid.set(x, y, z, null);
  }
  for (let x = 14; x < 17; x++) for (let z = 40; z < 44; z++) {
    for (let y = 19; y < 22; y++) grid.set(x, y, z, null);
  }
  // The giant crafting-table tower (its furnace companion waits in the model
  // data: after the -90° rotation it occupies model x 7..22, z < 14 / > 29 —
  // left out for now).
  buildLitematicGONGLU(grid, ORIGIN_GONGLU, mapGONGLU, () => 'model', (name, props, wx, wy, wz) => {
    const mx = wx - ORIGIN_GONGLU.x, mz = wz - ORIGIN_GONGLU.z;
    if (mx < 7 || mx > 22 || mz < 14 || mz > 30) return;
    // mapGONGLU flattens the interior floor (my 1) away and clears the hall's
    // mid-air decor (my 2..10, see mapGONGLU); emitShape runs for every model
    // cell regardless, so the dropped layer is dropped here too — only the
    // hanging lanterns and chains stay.
    const my = wy - ORIGIN_GONGLU.y;
    if (my >= 1 && my <= 10 && mx >= 8 && mx <= 21 && mz >= 15 && mz <= 28 &&
        !/lantern|chain/.test(name)) return;
    emitShape(name, props, wx, wy, wz, kindGONGLU(name));
  });
  // The Cinnamoroll ferris wheel, rotated to face the beach.
  buildLitematicFERRIS(grid, ORIGIN_FERRIS, mapFERRIS, () => 'model', (name, props, wx, wy, wz) => {
    const mx = wx - ORIGIN_FERRIS.x, my = wy - ORIGIN_FERRIS.y, mz = wz - ORIGIN_FERRIS.z;
    emitShape(name, props, wx, wy, wz, kindFERRIS(name), ferrisLookFor(name, mx, my, mz));
  });
  // The wheel sits beyond the original cottage lighting volume. These baked
  // sources keep its structure readable at night without real-time lights.
  const fx = ORIGIN_FERRIS.x + 7.5, fy = ORIGIN_FERRIS.y + 25, fz = ORIGIN_FERRIS.z + 21.5;
  bakes.push(
    { id: 'ferris-warm-center', position: [fx, fy, fz], power: 5, radius: 18, direction: null },
    { id: 'ferris-warm-top', position: [fx, fy + 13, fz], power: 3, radius: 13, direction: null },
    { id: 'ferris-warm-bottom', position: [fx, fy - 13, fz], power: 3, radius: 13, direction: null },
  );
  // Each gondola gets a small baked source as well as emissive surfaces, so
  // its window and lower edge remain readable when the wheel is in shadow.
  const gondolas = [
    [7.5, 7.5, 21.5], [7.5, 13.5, 10.5], [7.5, 13.5, 31.5],
    [7.5, 24.5, 4.5], [7.5, 24.5, 38.5], [7.5, 41.5, 21.5],
  ];
  gondolas.forEach(([x, y, z], i) => bakes.push({
    id: `ferris-gondola-${i}`, position: [ORIGIN_FERRIS.x + x, y, ORIGIN_FERRIS.z + z],
    power: 1.8, radius: 4.5, direction: null,
  }));
  // The north doorway needs entry steps like the south one (the floor drops
  // a full metre to the sand — the nav refuses steps over 0.6 m).
  for (let mx = 13; mx <= 16; mx++) {
    emitShape('minecraft:dark_oak_stairs', { half: 'bottom', facing: 'north' },
      ORIGIN_GONGLU.x + mx, ORIGIN_GONGLU.y, ORIGIN_GONGLU.z + 13, 'stairs');
  }
  // The bay off the south beach: diving tower, duck swim ring, jet ski.
  toys = buildSeaToys(layer, materials);
  stage.scene.add(toys.group);
  const forest = buildForest(grid, layer, TREES);
  // Scattered grass and flowers across the island for a livelier look.
  const tufts = [];
  const rng = (seed => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; })(42);
  const inBuilding = (x, z) =>
    (x >= -2 && x <= 12 && z >= -12 && z <= 12) ||  // IKUN area
    (x >= -40 && x <= -20 && z >= -24 && z <= 0) || // GONGLU tower
    (x >= 14 && x <= 30 && z >= -22 && z <= -6) ||  // Ferris wheel
    (z >= 32);  // LeHun over bay
  for (let i = 0; i < 100; i++) {
    const x = -32 + rng() * 64;
    const z = -22 + rng() * 48;
    if (inBuilding(x, z)) continue;
    const tiles = ['tall_grass', 'tall_grass', 'tall_grass', 'flower_red', 'flower_white', 'flower_violet'];
    tufts.push({ x, z, tile: tiles[Math.floor(rng() * tiles.length)], s: 0.5 + rng() * 0.4 });
  }
  const tuftsMesh = buildTufts(layer, materials, tufts, 'island-flora');
  // Furnish the crafting tower's hall as a little home (obstacles keep the
  // nav clear around each piece; the TV rides surfaces.tvScreen), then move
  // LeHun cottage: a cherry gym below and a leisure loft above — its floor
  // pink lounge floor and stair register site treads into `walk` before the
  // site is built.
  for (let x = Math.floor(BOARDWALK.x0 - BOARDWALK.width / 2); x < Math.ceil(BOARDWALK.x1 + BOARDWALK.width / 2); x++) {
    for (let z = Math.floor(BOARDWALK.z - BOARDWALK.depth / 2); z < BAY.z0; z++) {
      grid.set(x, -1, z, 'sand');
      grid.set(x, 0, z, null);
    }
  }
  const planes = furnishGONGLU({ B, obstacles, bakes, surfaces, hotspots });
  furnishIKUN({ B, obstacles, bakes });
  planes.push(...furnishLeHun({ B, walk, obstacles, bakes }));
  planes.push(tuftsMesh);
  furnishBeach({ B, obstacles, bakes });
  return {
    batches: { model: B },
    bakes,
    obstacles,
    hotspots,
    surfaces,
    planes,
    forest,
    sites: [toys, makeModelSite(walk, obstacles)],
  };
}

// The floats ride the swell.
export function setup({ stage, config, player, avatar, rig, sound, world, nav }) {
  createComputer(config.computer);
  const fishing = createFishing({ stage, player, avatar, rig, sound });
  const furniture = createFurnitureInteraction({ stage, player, rig, sound, world });
  const jetSki = createJetSki({ stage, player, rig, sound, world, toys });
  const resident = createResident({ stage, world, nav, player, jetSki, config });
  return {
    fishing, furniture, jetSki, resident,
    interact: () => jetSki.interact() || furniture.interact(),
    tap: (x, y, picked) => jetSki.tap(x, y, picked) || furniture.tap(x, y, picked),
    pad: jetSki.pad,
    update(dt) { toys?.update(dt, stage.camera); fishing.update(dt); furniture.update(dt); jetSki.update(dt); resident?.update(dt); },
  };
}

// ——— IKUN cottage (8×15×17) ———
function mapIKUN(name, props = {}, mx, my, mz) {
  if (name === 'minecraft:air') return null;
  // The entrance ramp reads its steps from the carpet cells; the trapdoor
  // risers are part of the stair shapes, not grid cells.
  if (name === 'minecraft:iron_trapdoor') return null;
  if (name === 'minecraft:yellow_carpet' && (mx === 3 || mx === 4) && mz <= 4) return null;
  if (name === 'minecraft:birch_door') return null; // the entrance stays open
  // Interior furniture stays out for now; the shulker boxes frame the eyes.
  if (/_bed$|bell|brewing_stand|flower_pot|potted_|birch_fence|loom/.test(name)) return null;
  if (/stained_glass/.test(name)) return name.includes('yellow') ? 'i_glass_y' : 'i_glass';
  if (name === 'minecraft:white_concrete') return 'i_white';
  if (name === 'minecraft:black_concrete') return my <= 9 && mz >= 5 && mz <= 12 ? 'i_head_black' : 'i_black';
  if (name === 'minecraft:light_gray_concrete') return ikunHeadTopAt(mx, my, mz) ? 'i_head_lgray' : 'i_lgray';
  if (name === 'minecraft:yellow_concrete') return 'i_yellow';
  if (name === 'minecraft:orange_concrete') return 'i_orange';
  if (name === 'minecraft:red_concrete') return 'i_red';
  if (name === 'minecraft:light_gray_terracotta') return ikunHeadTopAt(mx, my, mz) ? 'i_head_terra' : 'i_terra';
  if (name === 'minecraft:light_gray_wool') return my <= 9 && mz >= 5 && mz <= 12 || ikunHeadTopAt(mx, my, mz) ? 'i_head_gray' : 'i_wool';
  if (name === 'minecraft:light_gray_shulker_box') return 'i_lgray';
  return null; // everything else is a shape (carpets, rods, banners)
}

function ikunHeadTopAt(mx, my, mz) {
  return my >= 9 && my <= 14 && mz >= 11;
}

function kindIKUN(name, mx, mz) {
  if (name === 'minecraft:yellow_carpet') return (mx === 3 || mx === 4) && mz <= 4 ? 'stairs' : 'carpet';
  if (/carpet/.test(name)) return 'carpet';
  if (/_slab/.test(name)) return 'slab';
  if (/end_rod/.test(name)) return 'rod';
  if (/banner/.test(name)) return 'banner';
  if (/iron_bars/.test(name)) return 'bars';
  if (/^minecraft:chain/.test(name)) return 'chain';
  return null;
}

  // ——— LeHun cottage (18×24×18) ———
  const lehunHallBlock = (name, mx, my, mz) =>
    // The ground-hall band: the model's own furniture — cherry log pillars,
    // shulker stools, leaf piles, campfires, pots — makes way for the gym.
    // The pillars and leaf piles stand up to four blocks tall (the row's end
    // posts are capped higher).
    my >= 7 && my <= 12 && mx >= 1 && mx <= 15 && mz >= 2 && mz <= 15 &&
    /stripped_cherry_log|shulker|cherry_leaves|campfire|decorated_pot|_stairs/.test(name);

  function mapLeHun(name, props = {}, mx, my, mz) {
    if (name === 'minecraft:air') return null;
    // The upper room is rebuilt by lehun-furnish.js. Keep the shell, but remove
    // every old interior block so furniture and stair fragments cannot leak in.
    if (my >= 15 && my < 23 && mx >= 2 && mx <= 15 && mz >= 2 && mz <= 15) return null;
    if (lehunHallBlock(name, mx, my, mz)) return null;
    // The west slab staircase is rebuilt as floating half-slabs in
    // lehun-furnish.js — the model's solid stair core (inboard of the west
    // wall at mx 1) comes out; the moss garden bed stays. Interior stained
    // glass and leftover loft furniture read as scattered clutter overhead;
    // out as well.
    if (my >= 8 && my <= 15 && mx >= 2 && mx <= 4 && mz >= 2 && mz <= 15 && !/moss/.test(name)) return null;
    if (my >= 12 && mx >= 2 && mx <= 15 && mz >= 2 && mz <= 15 &&
        /stained_glass|shulker|trapdoor|banner|chain|grindstone|hopper/.test(name)) return null;
  // Loose furniture and small flora stay out until the interior gets furnished.
  if (/chest|barrel|crafting_table|furnace|brewing_stand|stonecutter|grindstone|hopper|bookshelf|_bed$|flower_pot|potted_|short_grass|tall_grass|lily_of_the_valley|rose_bush|oxeye_daisy|white_tulip|cornflower|lilac|azalea|peony|spore_blossom|wall_sign|bamboo_sapling|carpet$/.test(name)) return null;
  if (name === 'minecraft:cherry_door') return null; // the entrance stays open
  if (/stained_glass/.test(name)) {
    // Panes render as thin shapes only — as grid blocks they double up.
    if (/_pane$/.test(name)) return null;
    if (/pink/.test(name)) return 'l_glass_p';
    if (/light_blue/.test(name)) return 'l_glass_lb';
    if (/cyan/.test(name)) return 'l_glass_cy';
    return 'i_glass';
  }
  if (name === 'minecraft:white_concrete') return 'i_white';
  if (name === 'minecraft:gray_concrete') return 'l_ggray';
  if (name === 'minecraft:yellow_concrete') return 'i_yellow';
  if (name === 'minecraft:blue_wool') return 'l_bwool';
  if (name === 'minecraft:yellow_wool') return 'l_ywool';
  if (name === 'minecraft:light_gray_wool') return 'i_wool';
  if (name === 'minecraft:stripped_dark_oak_log') return 'l_sdoak';
  if (name === 'minecraft:dark_oak_planks') return 'l_doak';
  if (name === 'minecraft:andesite') return 'l_andesite';
  if (name === 'minecraft:moss_block') return 'l_moss';
  if (name === 'minecraft:glowstone') return 'l_glow';
  if (name === 'minecraft:cherry_planks') return 'l_cplank';
  if (name === 'minecraft:stripped_cherry_log') return 'l_scherry';
  if (name === 'minecraft:cherry_leaves') return 'l_cherry';
  if (name === 'minecraft:pink_shulker_box') return 'l_spink';
  if (name === 'minecraft:white_shulker_box') return 'l_swhite';
  return null; // everything else is a shape
}

function kindLeHun(name) {
  if (/_stairs/.test(name)) return 'stairs';
  if (/_slab/.test(name)) return 'slab';
  if (/_pane$/.test(name)) return 'pane';
  if (/^minecraft:lantern/.test(name)) return 'lantern';
  if (/wall_torch/.test(name)) return 'torch';
  if (/_trapdoor/.test(name)) return 'panel';
  if (/^minecraft:chain/.test(name)) return 'chain';
  if (/^minecraft:bamboo/.test(name)) return 'bamboo';
  if (/campfire/.test(name)) return 'campfire';
  if (/big_dripleaf$/.test(name)) return 'dripleaf';
  if (/big_dripleaf_stem/.test(name)) return 'stem';
  if (/decorated_pot/.test(name)) return 'pot';
  if (/banner/.test(name)) return 'banner';
  return null;
}

// ——— Giant crafting-table tower (38×47×46 litematic, rotated -90°) ———
// Only the crafting-table half is built for now: model x 7..22, z 14..29
// (the companion furnace tower occupies the rest of the model volume).
function mapGONGLU(name, props = {}, mx, my, mz) {
  if (name === 'minecraft:air' || mx < 7 || mx > 22 || mz < 14 || mz > 30) return null;
  if (/chest|barrel|hopper|_bed$|^minecraft:water|jukebox|ender_chest|crafting_table|furnace|smoker|stonecutter|smithing_table|enchanting_table|grindstone|lectern|brewing_stand|^minecraft:anvil|wall_sign|potted_|flower_pot|sapling|coral|amethyst|dripstone|skull|tripwire|candle|campfire|tulip|poppy|orchid|daisy|lily|fern|torchflower/.test(name)) return null;
  if (name === 'minecraft:dark_oak_door') return null; // the entrance stays open
  if (my >= 2 && my <= 10 && mx >= 8 && mx <= 21 && mz >= 15 && mz <= 28 &&
      !/^minecraft:lantern|^minecraft:chain/.test(name)) return null;
  // The interior floor: one flat tan layer (the raised bookshelf/green/moss
  // patches come out, the foundation goes tan).
  if (my === 0 && mx >= 7 && mx <= 22 && mz >= 14 && mz <= 29) return 'g_sjungle';
  if (my === 1 && mx >= 8 && mx <= 21 && mz >= 15 && mz <= 28) return null;
  if (/^minecraft:oak_planks$/.test(name)) return 'g_oak';
  if (/^minecraft:spruce_planks$/.test(name)) return 'g_splank';
  if (name === 'minecraft:oak_log') return 'g_olog';
  if (name === 'minecraft:spruce_log') return 'g_slog';
  if (name === 'minecraft:stripped_oak_log') return 'g_soak';
  if (name === 'minecraft:stripped_spruce_log') return 'g_sspruce';
  if (name === 'minecraft:stripped_jungle_wood') return 'g_sjungle';
  if (name === 'minecraft:stripped_dark_oak_log') return 'l_sdoak';
  if (name === 'minecraft:cobblestone') return 'g_cobble';
  if (name === 'minecraft:stone') return 'g_stone';
  if (name === 'minecraft:tuff') return 'g_tuff';
  if (name === 'minecraft:andesite') return 'g_andesite';
  if (name === 'minecraft:diorite' || name === 'minecraft:polished_diorite') return 'g_diorite';
  if (name === 'minecraft:smooth_stone') return 'g_sstone';
  if (name === 'minecraft:smooth_sandstone') return 'g_ssand';
  if (name === 'minecraft:gray_concrete') return 'l_ggray';
  if (name === 'minecraft:gray_concrete_powder') return 'g_gpow';
  if (name === 'minecraft:light_gray_concrete_powder') return 'g_lgpow';
  if (name === 'minecraft:yellow_concrete_powder') return 'g_ypow';
  if (name === 'minecraft:orange_concrete_powder') return 'g_opow';
  if (name === 'minecraft:black_concrete_powder') return 'g_bpow';
  if (name === 'minecraft:light_blue_concrete_powder') return 'g_lbpow';
  if (name === 'minecraft:brown_concrete_powder') return 'g_brpow';
  if (name === 'minecraft:brown_concrete') return 'g_brown';
  if (name === 'minecraft:cyan_concrete') return 'g_cyan';
  if (name === 'minecraft:light_blue_concrete') return 'g_lblue';
  if (name === 'minecraft:green_concrete') return 'g_green';
  if (name === 'minecraft:white_concrete') return 'i_white';
  if (name === 'minecraft:black_concrete') return 'i_black';
  if (name === 'minecraft:yellow_concrete') return 'i_yellow';
  if (name === 'minecraft:terracotta') return 'g_terra';
  if (name === 'minecraft:cyan_terracotta') return 'g_cterra';
  if (name === 'minecraft:black_terracotta') return 'g_bterra';
  if (name === 'minecraft:gray_terracotta') return 'g_gterra';
  if (name === 'minecraft:brown_terracotta') return 'g_brterra';
  if (name === 'minecraft:orange_terracotta') return 'g_oterra';
  if (name === 'minecraft:lime_terracotta') return 'g_lterra';
  if (name === 'minecraft:brown_wool') return 'g_bwool';
  if (name === 'minecraft:light_gray_wool') return 'i_wool';
  if (name === 'minecraft:light_blue_wool') return 'g_lbwool';
  if (name === 'minecraft:green_wool') return 'g_gwool';
  if (name === 'minecraft:black_wool') return 'g_kwool';
  if (name === 'minecraft:dirt') return 'g_dirt';
  if (name === 'minecraft:coarse_dirt') return 'g_cdirt';
  if (name === 'minecraft:rooted_dirt') return 'g_rdirt';
  if (name === 'minecraft:brown_mushroom_block') return 'g_mush';
  if (name === 'minecraft:oak_leaves' || name === 'minecraft:birch_leaves') return 'g_leaf';
  if (/bookshelf/.test(name)) return 'g_book';
  return null; // everything else is a shape (stairs, slabs, gates, trapdoors…)
}

function kindGONGLU(name) {
  if (/_stairs/.test(name)) return 'stairs';
  if (/_slab/.test(name)) return 'slab';
  if (/_fence_gate/.test(name)) return 'gate';
  if (/_fence$/.test(name)) return 'fence';
  if (/_trapdoor/.test(name)) return 'panel';
  if (/^minecraft:chain/.test(name)) return 'chain';
  if (/^minecraft:lantern/.test(name)) return 'lantern';
  if (/carpet/.test(name)) return 'carpet';
  if (/iron_bars/.test(name)) return 'bars';
  return null;
}

// ——— Cinnamoroll ferris wheel (15×49×43 litematic, rotated to face south) ———
// Everything is exterior; birch doors open into the gondolas and stay open.
function mapFERRIS(name, props = {}, mx, my, mz) {
  if (name === 'minecraft:air') return null;
  if (name === 'minecraft:birch_door') return null;
  if (name === 'minecraft:smooth_stone_slab' && props.type === 'double') return 'g_sstone';
  if (/stained_glass/.test(name)) {
    if (ferrisGondolaAt(mx, my, mz)) return 'f_cabin_glass';
    return name.includes('light_blue') ? 'l_glass_lb' : 'i_glass';
  }
  if (name === 'minecraft:light_blue_concrete') return ferrisGondolaAt(mx, my, mz) ? 'f_cabin' : 'f_lblue';
  if (name === 'minecraft:white_concrete') return ferrisFaceAt(mx, my, mz) ? 'f_face' : 'f_white';
  if (name === 'minecraft:pink_concrete') return 'f_pink';
  if (name === 'minecraft:quartz_block') return ferrisGondolaAt(mx, my, mz) ? 'f_cabin_frame' : 'f_quartz';
  if (name === 'minecraft:sea_lantern') return 'g_slantern';
  if (name === 'minecraft:redstone_lamp') return 'g_rslamp';
  if (name === 'minecraft:redstone_block') return 'f_red';
  if (name === 'minecraft:birch_planks') return 'f_birch';
  return null; // stairs, slabs, rods, panes and plates are shapes
}

function ferrisLookFor(name, mx, my, mz) {
  if (ferrisGondolaAt(mx, my, mz)) {
    if (/stained_glass_pane/.test(name)) return FERRIS_LOOKS.cabinGlass;
    if (/^minecraft:birch_/.test(name)) return FERRIS_LOOKS.cabinWood;
    if (/^minecraft:quartz_/.test(name)) return FERRIS_LOOKS.cabinFrame;
    if (/end_rod|pressure_plate/.test(name)) return FERRIS_LOOKS.cabinGlow;
  }
  if (/^minecraft:birch_/.test(name)) return FERRIS_LOOKS.birch;
  if (/^minecraft:quartz_/.test(name)) return FERRIS_LOOKS.quartz;
  return null;
}

function ferrisFaceAt(mx, my, mz) {
  return (mx === 2 || mx === 10) && my >= 18 && my <= 36 && mz >= 7 && mz <= 35;
}

function ferrisGondolaAt(mx, my, mz) {
  return (my >= 6 && my <= 9 && mz >= 19 && mz <= 23) ||
    (my >= 12 && my <= 15 && (mz >= 8 && mz <= 12 || mz >= 30 && mz <= 34)) ||
    (my >= 23 && my <= 26 && (mz >= 2 && mz <= 6 || mz >= 36 && mz <= 40)) ||
    (my >= 40 && my <= 43 && mz >= 19 && mz <= 23);
}

function kindFERRIS(name) {
  if (/_stairs/.test(name)) return 'stairs';
  if (/_slab/.test(name)) return 'slab';
  if (/_pane$/.test(name)) return 'pane';
  if (/end_rod/.test(name)) return 'rod';
  if (/_pressure_plate/.test(name)) return 'plate';
  return null;
}

function defineModelBlocks(grid) {
  // Measured average colours of the original blocks (map-art datasets cross-
  // checked with texture averages); wool gets the linen weave, tinted so the
  // product lands on the measured average.
  grid.define('i_white', { tex: { all: 'paint' }, tint: 0xcfd5d6, merge: true, map: '#cfd5d6' });
  grid.define('i_black', { tex: { all: 'paint' }, tint: 0x1d1d21, merge: true, map: '#1d1d21' });
  grid.define('i_head_black', { tex: { all: 'paint' }, tint: 0x243039, emissive: 0.24, merge: true, map: '#243039' });
  grid.define('i_lgray', { tex: { all: 'paint' }, tint: 0x9ba1a6, merge: true, map: '#9ba1a6' });
  grid.define('i_head_lgray', { tex: { all: 'paint' }, tint: 0xb7c2c7, emissive: 0.34, merge: true, map: '#b7c2c7' });
  grid.define('i_head_terra', { tex: { all: 'paint' }, tint: 0xa47b6d, emissive: 0.3, merge: true, map: '#a47b6d' });
  grid.define('i_head_gray', { tex: { all: 'paint' }, tint: 0xaebbc4, emissive: 0.28, merge: true, map: '#aebbc4' });
  grid.define('i_terra', { tex: { all: 'paint' }, tint: 0x876b62, merge: true, map: '#876b62' });
  grid.define('i_yellow', { tex: { all: 'paint' }, tint: 0xf8c527, merge: true, map: '#f8c527' });
  grid.define('i_orange', { tex: { all: 'paint' }, tint: 0xe06101, merge: true, map: '#e06101' });
  grid.define('i_red', { tex: { all: 'paint' }, tint: 0xa93121, merge: true, map: '#a93121' });
  grid.define('i_wool', { tex: { all: 'linen' }, tint: 0xb0bcc8, merge: true, map: '#9aa1a1' });
  grid.define('i_glass', { tex: { all: 'glass' }, glass: true, tint: 0xf0f4f4, map: '#dbe6e8' });
  grid.define('i_glass_y', { tex: { all: 'glass' }, glass: true, tint: 0xf5d75a, map: '#e8d75a' });
  grid.define('l_bwool', { tex: { all: 'linen' }, tint: 0x3441af, merge: true, map: '#2e388d' });
  grid.define('l_ywool', { tex: { all: 'linen' }, tint: 0xc9c230, merge: true, map: '#b1a627' });
  grid.define('l_ggray', { tex: { all: 'paint' }, tint: 0x363a3d, merge: true, map: '#363a3d' });
  grid.define('l_sdoak', { tex: { all: 'paint' }, tint: 0x4a3420, merge: true, map: '#4a3420' });
  grid.define('l_doak', { tex: { all: 'paint' }, tint: 0x43301c, merge: true, map: '#43301c' });
  grid.define('l_andesite', { tex: { all: 'paint' }, tint: 0x8c8d8e, merge: true, map: '#8c8d8e' });
  grid.define('l_moss', { tex: { all: 'paint' }, tint: 0x7c8f49, merge: true, map: '#7c8f49' });
  grid.define('l_glow', { tex: { all: 'glow' }, emissive: 1, map: '#f9d49c' });
  grid.define('l_cplank', { tex: { all: 'paint' }, tint: 0xe3b0a4, merge: true, map: '#e3b0a4' });
  grid.define('l_scherry', { tex: { all: 'paint' }, tint: 0xefc9bc, merge: true, map: '#efc9bc' });
  grid.define('l_cherry', { tex: { all: 'paint' }, tint: 0xf2afc0, merge: true, map: '#f2afc0' });
  grid.define('l_spink', { tex: { all: 'paint' }, tint: 0xd8a0ac, merge: true, map: '#d8a0ac' });
  grid.define('l_swhite', { tex: { all: 'paint' }, tint: 0xe4e4e4, merge: true, map: '#e4e4e4' });
  grid.define('l_glass_p', { tex: { all: 'glass' }, glass: true, tint: 0xf3b8c8, map: '#f3b8c8' });
  grid.define('l_glass_lb', { tex: { all: 'glass' }, glass: true, tint: 0xa7cbe8, map: '#a7cbe8' });
  grid.define('l_glass_cy', { tex: { all: 'glass' }, glass: true, tint: 0x54b0c4, map: '#54b0c4' });
  // The giant crafting-table tower.
  grid.define('g_oak', { tex: { all: 'paint' }, tint: 0xb4905a, merge: true, map: '#b4905a' });
  grid.define('g_splank', { tex: { all: 'paint' }, tint: 0x725430, merge: true, map: '#725430' });
  grid.define('g_olog', { tex: { all: 'paint' }, tint: 0x6d5531, merge: true, map: '#6d5531' });
  grid.define('g_slog', { tex: { all: 'paint' }, tint: 0x4a331c, merge: true, map: '#4a331c' });
  grid.define('g_soak', { tex: { all: 'paint' }, tint: 0xb18e57, merge: true, map: '#b18e57' });
  grid.define('g_sspruce', { tex: { all: 'paint' }, tint: 0xa8824e, merge: true, map: '#a8824e' });
  grid.define('g_sjungle', { tex: { all: 'paint' }, tint: 0xaf8e62, merge: true, map: '#af8e62' });
  grid.define('g_cobble', { tex: { all: 'pavers' }, tint: 0x9a9a9a, merge: true, map: '#7f7f7f' });
  grid.define('g_stone', { tex: { all: 'paint' }, tint: 0x7d7d7d, merge: true, map: '#7d7d7d' });
  grid.define('g_tuff', { tex: { all: 'paint' }, tint: 0x6c6d6a, merge: true, map: '#6c6d6a' });
  grid.define('g_andesite', { tex: { all: 'paint' }, tint: 0x8c8d8e, merge: true, map: '#8c8d8e' });
  grid.define('g_diorite', { tex: { all: 'paint' }, tint: 0xcbd0d2, merge: true, map: '#cbd0d2' });
  grid.define('g_sstone', { tex: { all: 'paint' }, tint: 0xa0a0a0, merge: true, map: '#a0a0a0' });
  grid.define('g_ssand', { tex: { all: 'paint' }, tint: 0xe1d6a8, merge: true, map: '#e1d6a8' });
  grid.define('g_gpow', { tex: { all: 'paint' }, tint: 0x5a5b5a, merge: true, map: '#5a5b5a' });
  grid.define('g_lgpow', { tex: { all: 'paint' }, tint: 0x9fa0a0, merge: true, map: '#9fa0a0' });
  grid.define('g_ypow', { tex: { all: 'paint' }, tint: 0xc9b944, merge: true, map: '#c9b944' });
  grid.define('g_opow', { tex: { all: 'paint' }, tint: 0xd3823c, merge: true, map: '#d3823c' });
  grid.define('g_bpow', { tex: { all: 'paint' }, tint: 0x232326, merge: true, map: '#232326' });
  grid.define('g_lbpow', { tex: { all: 'paint' }, tint: 0x8fa6c0, merge: true, map: '#8fa6c0' });
  grid.define('g_brpow', { tex: { all: 'paint' }, tint: 0x6a4c33, merge: true, map: '#6a4c33' });
  grid.define('g_brown', { tex: { all: 'paint' }, tint: 0x674c33, merge: true, map: '#674c33' });
  grid.define('g_cyan', { tex: { all: 'paint' }, tint: 0x31708e, merge: true, map: '#31708e' });
  grid.define('g_lblue', { tex: { all: 'paint' }, tint: 0x9cb0ce, merge: true, map: '#9cb0ce' });
  grid.define('g_green', { tex: { all: 'paint' }, tint: 0x4c6218, merge: true, map: '#4c6218' });
  grid.define('g_terra', { tex: { all: 'paint' }, tint: 0x985e43, merge: true, map: '#985e43' });
  grid.define('g_cterra', { tex: { all: 'paint' }, tint: 0x575b5b, merge: true, map: '#575b5b' });
  grid.define('g_bterra', { tex: { all: 'paint' }, tint: 0x2b252c, merge: true, map: '#2b252c' });
  grid.define('g_gterra', { tex: { all: 'paint' }, tint: 0x564f4c, merge: true, map: '#564f4c' });
  grid.define('g_brterra', { tex: { all: 'paint' }, tint: 0x77492b, merge: true, map: '#77492b' });
  grid.define('g_oterra', { tex: { all: 'paint' }, tint: 0xa15326, merge: true, map: '#a15326' });
  grid.define('g_lterra', { tex: { all: 'paint' }, tint: 0x6d9f3c, merge: true, map: '#6d9f3c' });
  grid.define('g_bwool', { tex: { all: 'linen' }, tint: 0x7a5b38, merge: true, map: '#6b4e2d' });
  grid.define('g_lbwool', { tex: { all: 'linen' }, tint: 0x7aa1fa, merge: true, map: '#6b8ac9' });
  grid.define('g_gwool', { tex: { all: 'linen' }, tint: 0x5a752a, merge: true, map: '#4f6422' });
  grid.define('g_kwool', { tex: { all: 'paint' }, tint: 0x24242a, merge: true, map: '#24242a' });
  grid.define('g_dirt', { tex: { all: 'paint' }, tint: 0x79553a, merge: true, map: '#79553a' });
  grid.define('g_cdirt', { tex: { all: 'paint' }, tint: 0x7b5f38, merge: true, map: '#7b5f38' });
  grid.define('g_rdirt', { tex: { all: 'paint' }, tint: 0x8a6244, merge: true, map: '#8a6244' });
  grid.define('g_mush', { tex: { all: 'paint' }, tint: 0x96601c, merge: true, map: '#96601c' });
  grid.define('g_leaf', { kind: 'cutout', tex: { all: 'leaves' }, merge: true, map: '#4e8a36' });
  grid.define('g_book', { tex: { all: 'bookshelf' }, merge: true, map: '#a97d4f' });
  grid.define('g_birch', { tex: { all: 'paint' }, tint: 0xd7c185, merge: true, map: '#d7c185' });
  // Deepslate portal frame blocks.
  grid.define('d_tile', { tex: { all: 'paint' }, tint: 0x4a4a52, merge: true, map: '#4a4a52' });
  grid.define('d_obsidian', { tex: { all: 'paint' }, tint: 0x1a0f29, merge: true, map: '#1a0f29' });
  grid.define('g_quartz', { tex: { all: 'paint' }, tint: 0xece9e2, merge: true, map: '#ece9e2' });
  grid.define('g_pinkc', { tex: { all: 'paint' }, tint: 0xe9a3b0, merge: true, map: '#e9a3b0' });
  grid.define('g_slantern', { tex: { all: 'paint' }, tint: 0xbcd6cc, emissive: 1, map: '#bcd6cc' });
  grid.define('g_rslamp', { tex: { all: 'paint' }, tint: 0xb0653a, emissive: 1, map: '#b0653a' });
  // Ferris wheel finishes retain their daytime colours while giving the night
  // scene a readable silhouette; the face and gondolas carry the strongest glow.
  grid.define('f_lblue', { tex: { all: 'paint' }, tint: 0x9cb0ce, emissive: 0.42, merge: true, map: '#6f8ea9' });
  grid.define('f_white', { tex: { all: 'paint' }, tint: 0xcfd5d6, emissive: 0.3, merge: true, map: '#cfd5d6' });
  grid.define('f_pink', { tex: { all: 'paint' }, tint: 0xe9a3b0, emissive: 0.48, merge: true, map: '#e9a3b0' });
  grid.define('f_quartz', { tex: { all: 'paint' }, tint: 0xece9e2, emissive: 0.24, merge: true, map: '#ece9e2' });
  grid.define('f_red', { tex: { all: 'paint' }, tint: 0xa93121, emissive: 0.42, merge: true, map: '#a93121' });
  grid.define('f_birch', { tex: { all: 'paint' }, tint: 0xd7c185, emissive: 0.18, merge: true, map: '#d7c185' });
  grid.define('f_face', { tex: { all: 'paint' }, tint: 0xfff1d6, emissive: 0.95, merge: true, map: '#fff1d6' });
  grid.define('f_cabin', { tex: { all: 'paint' }, tint: 0xaed7eb, emissive: 0.72, merge: true, map: '#aed7eb' });
  grid.define('f_cabin_frame', { tex: { all: 'paint' }, tint: 0xffe7b0, emissive: 0.52, merge: true, map: '#ffe7b0' });
  grid.define('f_cabin_glass', { kind: 'glass', tex: { all: 'glass' }, glass: true, tint: 0xd9f5ff, emissive: 0.86, merge: true, map: '#d9f5ff' });
}

// MC stair "facing" is the ascent direction (the full-height side).
const FACING = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

// Flat painted finishes for the shape pieces, tinted to the original blocks.
const LOOKS = {
  white: { tex: 'paint', tint: 0xcfd5d6 }, black: { tex: 'paint', tint: 0x1d1d21 },
  yellow: { tex: 'paint', tint: 0xf8c527 }, quartz: { tex: 'paint', tint: 0xece9e2 },
  ramp: { tex: 'paint', tint: 0xf8c527 }, wool: { tex: 'paint', tint: 0x9aa1a1 },
  whiteWool: { tex: 'paint', tint: 0xdddddd }, iron: { tex: 'chrome', tint: 0x9a9a9a },
  wood: { tex: 'walnut' }, terra: { tex: 'paint', tint: 0x876b62 },
  cherry: { tex: 'paint', tint: 0xe3b0a4 }, scherry: { tex: 'paint', tint: 0xefc9bc },
  andesite: { tex: 'paint', tint: 0x8c8d8e }, diorite: { tex: 'paint', tint: 0xcbd0d2 },
  doak: { tex: 'paint', tint: 0x43301c }, sdoak: { tex: 'paint', tint: 0x4a3420 },
  moss: { tex: 'paint', tint: 0x7c8f49 }, dripleaf: { tex: 'paint', tint: 0x6fa044 },
  bamboo: { tex: 'paint', tint: 0x8ba83e }, blue: { tex: 'paint', tint: 0x2e388d },
  pink: { tex: 'paint', tint: 0xf1a7bb }, birch: { tex: 'paint', tint: 0xd7c185 },
  cobble: { tex: 'pavers', tint: 0x9a9a9a }, oak: { tex: 'paint', tint: 0xb4905a },
  spruce: { tex: 'paint', tint: 0x725430 }, sstone: { tex: 'paint', tint: 0xa0a0a0 },
  ssand: { tex: 'paint', tint: 0xe1d6a8 }, brown: { tex: 'paint', tint: 0x6b4e2d },
  pane: { tex: 'glass', glass: true, tint: 0xf3b8c8 },
  glow: { tex: 'paint', tint: 0xffd9a0, emissive: 1 },
  flame: { tex: 'paint', tint: 0xffb66e, emissive: 1 },
  rod: { tex: 'paint', tint: 0xf6f2e2, emissive: 1 },
};

const FERRIS_LOOKS = {
  birch: { tex: 'paint', tint: 0xd7c185, emissive: 0.18 },
  quartz: { tex: 'paint', tint: 0xece9e2, emissive: 0.24 },
  cabinWood: { tex: 'paint', tint: 0xf5c77e, emissive: 0.48 },
  cabinFrame: { tex: 'paint', tint: 0xffe7b0, emissive: 0.52 },
  cabinGlow: { tex: 'paint', tint: 0xfff0b8, emissive: 0.9 },
  cabinGlass: { tex: 'glass', glass: true, tint: 0xd9f5ff, emissive: 0.86 },
};

function lookFor(name) {
  if (/yellow_carpet/.test(name)) return LOOKS.ramp;
  if (/cherry_trapdoor|cherry_stairs|cherry_slab/.test(name)) return LOOKS.cherry;
  if (/cobblestone/.test(name)) return LOOKS.cobble;
  if (/quartz/.test(name)) return LOOKS.quartz;
  if (/birch/.test(name)) return LOOKS.birch;
  if (/^minecraft:oak_stairs|^minecraft:oak_slab/.test(name)) return LOOKS.oak;
  if (/spruce_stairs|spruce_slab|spruce_fence|spruce_trapdoor/.test(name)) return LOOKS.spruce;
  if (/dark_oak_stairs|dark_oak_slab|dark_oak_trapdoor/.test(name)) return LOOKS.doak;
  if (/smooth_stone/.test(name)) return LOOKS.sstone;
  if (/smooth_sandstone/.test(name)) return LOOKS.ssand;
  if (/andesite/.test(name)) return LOOKS.andesite;
  if (/diorite/.test(name)) return LOOKS.diorite;
  if (/stained_glass_pane/.test(name)) return { tex: 'glass', glass: true, tint: /pink/.test(name) ? 0xf3b8c8 : /yellow/.test(name) ? 0xf5d75a : 0xf0f4f4 };
  if (/pink_carpet/.test(name)) return { tex: 'paint', tint: 0xf1a7bb };
  if (/brown_carpet/.test(name)) return LOOKS.brown;
  if (/green_carpet/.test(name)) return { tex: 'paint', tint: 0x4f6422 };
  if (/white_carpet/.test(name)) return LOOKS.whiteWool;
  if (/moss_carpet/.test(name)) return LOOKS.moss;
  if (/^minecraft:lantern/.test(name)) return LOOKS.glow;
  if (/^minecraft:chain/.test(name)) return LOOKS.iron;
  if (/^minecraft:bamboo/.test(name)) return LOOKS.bamboo;
  if (/pink_wall_banner|pink_bed/.test(name)) return LOOKS.pink;
  if (/blue_wall_banner/.test(name)) return LOOKS.blue;
  if (/black_banner/.test(name)) return LOOKS.black;
  if (/iron_trapdoor/.test(name)) return LOOKS.iron;
  if (/carpet/.test(name)) return LOOKS.wool;
  return LOOKS.white;
}

// Stair treads, slab tops and bamboo stumps the player can stand on, keyed "x,z".
function makeModelSite(walk, obstacles) {
  const furniture = obstacles.filter(obstacle => Number.isFinite(obstacle.floor));
  const tops = new Map();
  for (const [x, z, y, tread] of walk) {
    const key = x + ',' + z;
    if (!tops.has(key)) tops.set(key, []);
    if (!tops.get(key).some(l => l.y === y)) tops.get(key).push({ y, tread: !!tread });
  }
  return {
    foot: IKUN_ENTRY,
    obstructed(x, z, feet) {
      for (const obstacle of furniture) {
        if (Math.abs(feet - obstacle.floor) < 0.3 && x >= obstacle.x0 && x <= obstacle.x1 && z >= obstacle.z0 && z <= obstacle.z1) return true;
      }
      return false;
    },
    levels(x, z, out) {
      const list = tops.get(Math.floor(x) + ',' + Math.floor(z));
      if (list) for (const { y, tread } of list) out.push({ site: 'model', x0: Math.floor(x), x1: Math.floor(x) + 1, z0: Math.floor(z), z1: Math.floor(z) + 1, y, tread });
    },
    spots: () => [IKUN_ENTRY],
  };
}
