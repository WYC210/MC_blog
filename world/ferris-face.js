import { blockFERRIS, FERRIS_SIZE, FERRIS_SCALE } from './ferris-model.js';

const FRONT = 2;
const BACK = FERRIS_SIZE[0] - 2;
const COLORS = new Set(['minecraft:white_concrete', 'minecraft:light_blue_concrete', 'minecraft:pink_concrete']);

export function buildFerrisBackFace(grid, origin, mapBlock) {
  for (let height = 0; height < FERRIS_SIZE[1]; height++) {
    for (let row = 0; row < FERRIS_SIZE[2]; row++) {
      const entry = blockFERRIS(FRONT, height, row);
      if (!entry || !COLORS.has(entry[0])) continue;
      const rearRow = FERRIS_SIZE[2] - 1 - row;
      const mapped = mapBlock(entry[0], entry[1] ?? {}, FRONT, height, row);
      if (!mapped) continue;
      const worldX = origin.x + BACK * FERRIS_SCALE[0];
      const worldY = origin.y + height * FERRIS_SCALE[1];
      const worldZ = origin.z + rearRow * FERRIS_SCALE[2];
      grid.fill(worldX, worldY, worldZ, worldX + FERRIS_SCALE[0], worldY + FERRIS_SCALE[1], worldZ + FERRIS_SCALE[2], mapped);
    }
  }
}
