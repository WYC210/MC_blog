// Inspect a .litematic file: region sizes, palette with usage counts, and
// top-down layer maps. Usage: node tools/inspect-litematic.mjs [file.litematic]
import fs from 'node:fs';
import zlib from 'node:zlib';

const input = process.argv[2] ?? fs.readdirSync('.').find(n => n.endsWith('.litematic'));
const bytes = zlib.gunzipSync(fs.readFileSync(input));
let offset = 0;
const u8 = () => bytes[offset++];
const u16 = () => { const v = bytes.readUInt16BE(offset); offset += 2; return v; };
const i32 = () => { const v = bytes.readInt32BE(offset); offset += 4; return v; };
const string = () => { const l = u16(); const s = bytes.toString('utf8', offset, offset + l); offset += l; return s; };

function readTag(type) {
  if (type === 0) return null;
  if (type === 1) return bytes.readInt8(offset++);
  if (type === 2) { const v = bytes.readInt16BE(offset); offset += 2; return v; }
  if (type === 3) return i32();
  if (type === 4) { const v = bytes.readBigInt64BE(offset); offset += 8; return v; }
  if (type === 5) { const v = bytes.readFloatBE(offset); offset += 4; return v; }
  if (type === 6) { const v = bytes.readDoubleBE(offset); offset += 8; return v; }
  if (type === 7) { const l = i32(); const v = bytes.subarray(offset, offset + l); offset += l; return v; }
  if (type === 8) return string();
  if (type === 9) { const t = u8(), l = i32(), v = []; for (let i = 0; i < l; i++) v.push(readTag(t)); return v; }
  if (type === 10) { const v = {}; while (true) { const t = u8(); if (!t) break; v[string()] = readTag(t); } return v; }
  if (type === 11) { const l = i32(), v = []; for (let i = 0; i < l; i++) v.push(i32()); return v; }
  if (type === 12) { const l = i32(), v = []; for (let i = 0; i < l; i++) { v.push(bytes.readBigInt64BE(offset)); offset += 8; } return v; }
  throw new Error('Unsupported NBT tag ' + type);
}

u8(); string();
const root = readTag(10);
for (const [name, region] of Object.entries(root.Regions)) {
  const sx = Math.abs(region.Size.x), sy = Math.abs(region.Size.y), sz = Math.abs(region.Size.z);
  console.log(`region "${name}": position (${region.Position.x}, ${region.Position.y}, ${region.Position.z}), size ${sx} x ${sy} x ${sz}`);
  const palette = region.BlockStatePalette.map(b => [b.Name.replace('minecraft:', ''), b.Properties ?? null]);
  const bits = Math.max(2, Math.ceil(Math.log2(palette.length)));
  const mask = (1n << BigInt(bits)) - 1n;
  const idx = i => {
    const bit = BigInt(i * bits), li = Number(bit / 64n), bo = Number(bit % 64n);
    let v = BigInt.asUintN(64, region.BlockStates[li]) >> BigInt(bo);
    if (bo + bits > 64) v |= BigInt.asUintN(64, region.BlockStates[li + 1]) << BigInt(64 - bo);
    return Number(v & mask);
  };
  const counts = new Array(palette.length).fill(0);
  for (let i = 0; i < sx * sy * sz; i++) counts[idx(i)]++;
  console.log('palette usage:');
  palette.forEach(([n, p], i) => { if (counts[i]) console.log(String(counts[i]).padStart(6), n, p ? JSON.stringify(p) : ''); });
  // layer maps: one char per block type (first letter, disambiguated)
  const letters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+*#@%&=';
  const symbol = new Map();
  for (let i = 0; i < palette.length; i++) if (counts[i]) symbol.set(i, letters[symbol.size % letters.length]);
  console.log('symbols: ' + [...symbol].map(([i, ch]) => `${ch}=${palette[i][0]}`).join(' '));
  for (let y = 0; y < sy; y++) {
    console.log(`--- y=${y} (x across, z down)`);
    for (let z = 0; z < sz; z++) {
      let row = '';
      for (let x = 0; x < sx; x++) row += symbol.get(idx((y * sz + z) * sx + x));
      console.log('  ' + row);
    }
  }
}
