// One-off edit of the generated LeHun model: drop the second storey
// (y 14..21 — checker floor, pink staircases and all) and lower the roof cap
// (y 22..23) onto the first-floor walls. Rebuilds world/lehun-model.js in
// place; the litematic stays the untouched source of truth.
import fs from 'node:fs';

const file = 'world/lehun-model.js';
const src = fs.readFileSync(file, 'utf8');
const read = (name) => JSON.parse(src.match(new RegExp(`export const ${name} = (\\[.*?\\]);`, 's'))[1]);
const size = read('LEHUN_SIZE');
const bits = Number(src.match(/export const LEHUN_BITS = (\d+);/)[1]);
const palette = read('LEHUN_PALETTE');
const data = src.match(/export const LEHUN_DATA = '([^']+)';/)[1];
const bytes = Uint8Array.from(atob(data), c => c.charCodeAt(0));
const [sx, sy, sz] = size;
const get = (x, y, z) => {
  const index = (y * sz + z) * sx + x;
  let v = 0;
  for (let k = 0; k < bits; k++) v |= ((bytes[(index * bits + k) >> 3] >> ((index * bits + k) & 7)) & 1) << k;
  return v;
};

const mapY = (y) => (y <= 13 ? y : y <= 21 ? -1 : y - 8); // keep, drop second storey, lower cap
const drop = (x, y, z, name) => {
  if (mapY(y) < 0) return true;
  // the pink staircase to the gone second floor: cherry-stairs run on the
  // south wall and the floating slab flight along the north wall
  if (name === 'minecraft:cherry_stairs' && y === 12 && z === 15) return true;
  if (name === 'minecraft:cherry_slab' && z >= 2 && z <= 3 && y >= 8) return true;
  return false;
};

const ny = sy - 8;
const out = new Uint8Array(Math.ceil(sx * ny * sz * bits / 8));
const set = (x, y, z, value) => {
  const index = (y * sz + z) * sx + x;
  for (let k = 0; k < bits; k++) if (value & (1 << k)) out[(index * bits + k) >> 3] |= 1 << ((index * bits + k) & 7);
};
for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
  const v = get(x, y, z);
  const ty = mapY(y);
  if (ty >= 0 && !drop(x, y, z, palette[v][0])) set(x, ty, z, v);
}

const body = src.slice(src.indexOf('const BYTES'));
fs.writeFileSync(file, `// Generated from 生物住宅_乐魂.litematic by tools/generate-litematic-model.mjs,
// then trimmed by tools/trim-lehun.mjs: second storey removed, roof cap lowered.
export const LEHUN_SIZE = [${sx}, ${ny}, ${sz}];
export const LEHUN_SCALE = [1, 1, 1];
export const LEHUN_BITS = ${bits};
export const LEHUN_PALETTE = ${JSON.stringify(palette)};
export const LEHUN_DATA = '${Buffer.from(out).toString('base64')}';
${body}`);
console.log(`lehun-model: ${sx}x${ny}x${sz}, second storey dropped, cap lowered 8`);
