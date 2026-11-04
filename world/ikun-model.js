// Generated from 生物住宅_IKUN.litematic by tools/generate-litematic-model.mjs — do not edit.
// The browser decodes packed indices; the palette carries block properties so
// slabs/doors/trapdoors can be rebuilt as real shapes (mapBlock gets props).
export const IKUN_SIZE = [8, 15, 17];
export const IKUN_SCALE = [1, 1, 1];
export const IKUN_BITS = 6;
export const IKUN_PALETTE = [["minecraft:air",null],["minecraft:yellow_carpet",null],["minecraft:iron_trapdoor",{"half":"top","waterlogged":"false","powered":"false","facing":"west","open":"false"}],["minecraft:iron_trapdoor",{"half":"top","waterlogged":"false","powered":"false","facing":"north","open":"false"}],["minecraft:yellow_concrete",null],["minecraft:light_gray_wool",null],["minecraft:white_stained_glass",null],["minecraft:yellow_stained_glass",null],["minecraft:white_concrete",null],["minecraft:black_concrete",null],["minecraft:end_rod",{"facing":"down"}],["minecraft:birch_door",{"hinge":"left","half":"lower","powered":"false","facing":"north","open":"false"}],["minecraft:birch_door",{"hinge":"right","half":"lower","powered":"false","facing":"north","open":"false"}],["minecraft:light_gray_shulker_box",{"facing":"east"}],["minecraft:light_gray_shulker_box",{"facing":"west"}],["minecraft:white_carpet",null],["minecraft:light_gray_carpet",null],["minecraft:yellow_wall_banner",{"facing":"north"}],["minecraft:light_gray_shulker_box",{"facing":"up"}],["minecraft:light_gray_bed",{"part":"foot","facing":"east","occupied":"false"}],["minecraft:light_gray_bed",{"part":"head","facing":"east","occupied":"false"}],["minecraft:light_gray_shulker_box",{"facing":"north"}],["minecraft:chain",{"waterlogged":"false","axis":"y"}],["minecraft:birch_door",{"hinge":"left","half":"upper","powered":"false","facing":"north","open":"false"}],["minecraft:birch_door",{"hinge":"right","half":"upper","powered":"false","facing":"north","open":"false"}],["minecraft:birch_fence",{"east":"false","waterlogged":"false","south":"false","north":"false","west":"false"}],["minecraft:bell",{"attachment":"single_wall","powered":"false","facing":"west"}],["minecraft:brewing_stand",{"has_bottle_0":"false","has_bottle_1":"false","has_bottle_2":"false"}],["minecraft:end_rod",{"facing":"up"}],["minecraft:potted_dandelion",null],["minecraft:loom",{"facing":"west"}],["minecraft:white_wall_banner",{"facing":"north"}],["minecraft:iron_bars",{"east":"false","waterlogged":"false","south":"true","north":"false","west":"false"}],["minecraft:quartz_slab",{"waterlogged":"false","type":"bottom"}],["minecraft:end_rod",{"facing":"east"}],["minecraft:end_rod",{"facing":"west"}],["minecraft:black_wall_banner",{"facing":"north"}],["minecraft:red_concrete",null],["minecraft:orange_concrete",null],["minecraft:light_gray_terracotta",null],["minecraft:light_gray_concrete",null],["minecraft:black_wall_banner",{"facing":"south"}]];
export const IKUN_DATA = 'AAAEAQAAAAAIAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAEAABAAQAAAABAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQAAAAAIAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQAAAAAIAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQAAAAAMAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAQAAQFEURVEAQFEURVEAQFEURVEAQFEYR1EAQIEcBlIAQIIgCJIAQIIgCJIAQIIkCZIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKAAgAIAQFEsTFEAQNEAgFMAQPFAD1QAQAIBwJMAQPIAAJQAQBJBT5QAQCJNVJUAQIIkCZIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGABgAUAQFFcWFEACJIBQIYgiAYAALAhCAcAAMAhSAcAANAhCAAAAOAhCPIBwIcgQIIkCZIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAgAQJIYRpIACdIAgIMkBgAAAAAYhgIAAKAYBgAAAAAYBgAAAAAYCfIBwIckQGIYhpEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABCGYQgAQJIkSZIACSKO4ogkBgIAAIAYBgIAAIAYBgIAAIAYBgIAAIAYCUICAIkkQIIgCJIAAIAgCAIAAIAgCAIAAACUJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQJIgSJIASYIkCZIkSYIkCZIkSYIkCZIkSYIkCZIkSYIkCZIkSYIkCZIkQIIgCJIAAIAAAAIAAIAgCAIAAACUJQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAgCAIAAIAAAAIAAIAgCAIAAGCapgkAAGCapgkAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHACAAoAAIogCFIAAIAAAAIAwIkgCIICAEAQBAEAAEAQBAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHCe6AkAwIkgCHICAIoAAHICwIkgCHICQJECQFoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAWZwEAwIkgCHICAIogCIICwIkgCFIAAFAAAAoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAFCcxQkAAHAWJwoAAICi5wkAAACcBQAAAAAAAAAA';
const BYTES = Uint8Array.from(atob(IKUN_DATA), c => c.charCodeAt(0));
export function blockIKUN(x, y, z) {
  const [sx, sy, sz] = IKUN_SIZE;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return null;
  const index = (y * sz + z) * sx + x;
  let value = 0;
  for (let k = 0; k < IKUN_BITS; k++) {
    const bit = index * IKUN_BITS + k;
    value |= ((BYTES[bit >> 3] >> (bit & 7)) & 1) << k;
  }
  return IKUN_PALETTE[value];
}
export function buildLitematicIKUN(grid, origin, mapBlock, groupFor, emitShape) {
  let bit = 0;
  const read = () => {
    let value = 0;
    for (let k = 0; k < IKUN_BITS; k++, bit++) value |= ((BYTES[bit >> 3] >> (bit & 7)) & 1) << k;
    return value;
  };
  const [SX, SY, SZ] = IKUN_SCALE;
  for (let my = 0; my < IKUN_SIZE[1]; my++) {
    for (let mz = 0; mz < IKUN_SIZE[2]; mz++) {
      for (let mx = 0; mx < IKUN_SIZE[0]; mx++) {
        const entry = IKUN_PALETTE[read()];
        if (!entry || entry[0] === 'minecraft:air') continue;
        const wx = origin.x + mx * SX, wy = origin.y + my * SY, wz = origin.z + mz * SZ;
        const mapped = mapBlock(entry[0], entry[1] ?? {}, mx, my, mz);
        if (mapped) for (let dz = 0; dz < SZ; dz++) for (let dy = 0; dy < SY; dy++) for (let dx = 0; dx < SX; dx++) {
          grid.set(wx + dx, wy + dy, wz + dz, mapped);
        }
        const group = groupFor(wx, wy, wz);
        if (group) emitShape(entry[0], entry[1] ?? {}, wx, wy, wz, group, SX, SY, SZ);
      }
    }
  }
}
