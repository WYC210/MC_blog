// Rotate the generated LeHun model 90° so its entrance faces the beach
// (north). Runs on the current world/lehun-model.js; rotating twice = 180°.
// New "block + rotated properties" combos grow the palette, so the data is
// always repacked with a bit width that fits the FULL palette.
//   node tools/generate-litematic-model.mjs 生物住宅_乐魂.litematic world/lehun-model.js LEHUN
//   node tools/scale-lehun.mjs 3 4
//   node tools/rotate-lehun.mjs [dir] [file] [NAME]
import fs from 'node:fs';

const file = process.argv[3] ?? 'world/lehun-model.js';
const NAME = process.argv[4] ?? 'LEHUN';
const src = fs.readFileSync(file, 'utf8');
const read = name => JSON.parse(src.match(new RegExp(`export const ${name} = (\\[.*?\\]);`, 's'))[1]);
const size = read(NAME + '_SIZE');
const bits = Number(src.match(new RegExp(`export const ${NAME}_BITS = (\\d+);`))[1]);
const palette = read(NAME + '_PALETTE');
const bytes = Uint8Array.from(atob(src.match(new RegExp(`export const ${NAME}_DATA = '([^']+)'`))[1]), c => c.charCodeAt(0));
const [sx, sy, sz] = size;
const get = (x, y, z) => {
  const index = (y * sz + z) * sx + x;
  let v = 0;
  for (let k = 0; k < bits; k++) { const b = index * bits + k; v |= ((bytes[b >> 3] >> (b & 7)) & 1) << k; }
  return v;
};

// dir 1: (x, z) -> (sz-1-z, x) — the west face (the entrance) turns to face
// north. dir -1 rotates the other way.
const dir = Number(process.argv[2] ?? 1);
const FACING = dir > 0
  ? { north: 'east', east: 'south', south: 'west', west: 'north' }
  : { north: 'west', west: 'south', south: 'east', east: 'north' };
const rotateProps = props => {
  if (!props) return props;
  const out = { ...props };
  if (out.facing in FACING) out.facing = FACING[out.facing];
  if (out.axis === 'x') out.axis = 'z';
  else if (out.axis === 'z') out.axis = 'x';
  return out;
};

// Pass 1: collect rotated cells, growing the palette as needed.
const newPalette = palette.map(e => [...e]);
const indexByEntry = new Map();
const keyOf = e => e[0] + '\u0000' + JSON.stringify(e[1]);
newPalette.forEach((e, i) => indexByEntry.set(keyOf(e), i));
const cells = [];
for (let y = 0; y < sy; y++) for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
  const v = get(x, y, z);
  if (palette[v][0] === 'minecraft:air') continue;
  const entry = [palette[v][0], rotateProps(palette[v][1])];
  const key = keyOf(entry);
  if (!indexByEntry.has(key)) { newPalette.push(entry); indexByEntry.set(key, newPalette.length - 1); }
  cells.push(dir > 0 ? [sz - 1 - z, y, x, indexByEntry.get(key)]
                     : [z, y, sx - 1 - x, indexByEntry.get(key)]);
}

// Pass 2: repack with a bit width that covers the whole grown palette.
const newBits = Math.max(1, Math.ceil(Math.log2(newPalette.length)));
// a 90° rotation swaps the x and z extents
const [nx, nz] = [sz, sx];
const out = new Uint8Array(Math.ceil(nx * sy * nz * newBits / 8));
const set = (x, y, z, value) => {
  const index = (y * nz + z) * nx + x;
  for (let k = 0; k < newBits; k++) if (value & (1 << k)) out[(index * newBits + k) >> 3] |= 1 << ((index * newBits + k) & 7);
};
for (const [x, y, z, v] of cells) set(x, y, z, v);

const body = src.slice(src.indexOf('const BYTES'));
fs.writeFileSync(file, `// Generated from 生物住宅_乐魂.litematic by tools/generate-litematic-model.mjs,
// resampled to 3/4 (tools/scale-lehun.mjs) and rotated 90° per run so the
// entrance faces the beach (tools/rotate-lehun.mjs).
export const ${NAME}_SIZE = [${nx}, ${sy}, ${nz}];
export const ${NAME}_SCALE = [1, 1, 1];
export const LEHUN_SCALE = [1, 1, 1];
export const ${NAME}_BITS = ${newBits};
export const ${NAME}_PALETTE = ${JSON.stringify(newPalette)};
export const ${NAME}_DATA = '${Buffer.from(out).toString('base64')}';
${body}`);
console.log(`lehum-model rotated 90°, palette ${palette.length} -> ${newPalette.length}, bits ${bits} -> ${newBits}`);
