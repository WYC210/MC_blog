// Resample the generated LeHun model to a fraction of its size (default 3/4),
// majority-vote per output cell so walls stay connected and windows survive.
// Run on a FRESHLY generated world/lehun-model.js (not idempotent):
//   node tools/generate-litematic-model.mjs 生物住宅_乐魂.litematic world/lehun-model.js LEHUN
//   node tools/scale-lehun.mjs [num] [den]
import fs from 'node:fs';

const num = Number(process.argv[2] ?? 3), den = Number(process.argv[3] ?? 4);
const file = 'world/lehun-model.js';
const src = fs.readFileSync(file, 'utf8');
const read = name => JSON.parse(src.match(new RegExp(`export const ${name} = (\\[.*?\\]);`, 's'))[1]);
const size = read('LEHUN_SIZE');
const bits = Number(src.match(/export const LEHUN_BITS = (\d+);/)[1]);
const palette = read('LEHUN_PALETTE');
const bytes = Uint8Array.from(atob(src.match(/export const LEHUN_DATA = '([^']+)';/)[1]), c => c.charCodeAt(0));
const [sx, sy, sz] = size;
const get = (x, y, z) => {
  const index = (y * sz + z) * sx + x;
  let v = 0;
  for (let k = 0; k < bits; k++) { const b = index * bits + k; v |= ((bytes[b >> 3] >> (b & 7)) & 1) << k; }
  return v;
};
const axis = (n, i) => {
  // output cell i covers source span [i*den/num, (i+1)*den/num)
  const a = Math.min(n - 1, Math.floor(i * den / num));
  const b = Math.min(n - 1, Math.ceil((i + 1) * den / num) - 1);
  const list = [];
  for (let s = a; s <= b; s++) list.push(s);
  return list;
};

const nx = Math.ceil(sx * num / den), nyy = Math.ceil(sy * num / den), nz = Math.ceil(sz * num / den);
const out = new Uint8Array(Math.ceil(nx * nyy * nz * bits / 8));
const set = (x, y, z, value) => {
  const index = (y * nz + z) * nx + x;
  for (let k = 0; k < bits; k++) if (value & (1 << k)) out[(index * bits + k) >> 3] |= 1 << ((index * bits + k) & 7);
};
for (let y = 0; y < nyy; y++) for (let z = 0; z < nz; z++) for (let x = 0; x < nx; x++) {
  // majority vote over the 8 source corners of this output cell
  const counts = new Map();
  let solid = 0, total = 0;
  for (const sy2 of axis(sy, y)) for (const sz2 of axis(sz, z)) for (const sx2 of axis(sx, x)) {
    const v = get(sx2, sy2, sz2);
    total++;
    if (palette[v][0] !== 'minecraft:air') { solid++; counts.set(v, (counts.get(v) ?? 0) + 1); }
  }
  if (solid * 2 >= total) {
    let best = 0, bestN = -1;
    for (const [v, n] of counts) if (n > bestN) { best = v; bestN = n; }
    set(x, y, z, best);
  }
}

const body = src.slice(src.indexOf('const BYTES'));
fs.writeFileSync(file, `// Generated from 生物住宅_乐魂.litematic by tools/generate-litematic-model.mjs,
// then resampled to ${num}/${den} by tools/scale-lehun.mjs (majority vote).
export const LEHUN_SIZE = [${nx}, ${nyy}, ${nz}];
export const LEHUN_SCALE = [1, 1, 1];
export const LEHUN_BITS = ${bits};
export const LEHUN_PALETTE = ${JSON.stringify(palette)};
export const LEHUN_DATA = '${Buffer.from(out).toString('base64')}';
${body}`);
console.log(`lehum-model: ${sx}x${sy}x${sz} -> ${nx}x${nyy}x${nz} (${num}/${den})`);
