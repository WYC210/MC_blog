// Convert a Litematic into a compact browser module.
// The generated module keeps the original palette (names + block properties,
// so stairs/slabs/doors can be rebuilt as real shapes), packed block indices,
// and avoids an NBT parser at runtime.
// Usage: node tools/generate-litematic-model.mjs [input.litematic] [output.js] [name]
import fs from 'node:fs';
import zlib from 'node:zlib';

const inputArg = process.argv[2];
const outputArg = process.argv[3];
const name = process.argv[4] ?? 'MODEL';
const input = inputArg ?? fs.readdirSync('.').find(n => n.endsWith('.litematic'));
if (!input) throw new Error('No .litematic file found in the project root');
const output = outputArg ?? 'world/litematic-model.js';

const bytes = zlib.gunzipSync(fs.readFileSync(input));
let offset = 0;
const u8 = () => bytes[offset++];
const u16 = () => { const value = bytes.readUInt16BE(offset); offset += 2; return value; };
const i32 = () => { const value = bytes.readInt32BE(offset); offset += 4; return value; };
const string = () => {
  const length = u16();
  const value = bytes.toString('utf8', offset, offset + length);
  offset += length;
  return value;
};

function readTag(type) {
  if (type === 0) return null;
  if (type === 1) return bytes.readInt8(offset++);
  if (type === 2) { const v = bytes.readInt16BE(offset); offset += 2; return v; }
  if (type === 3) return i32();
  if (type === 4) { const v = bytes.readBigInt64BE(offset); offset += 8; return v; }
  if (type === 5) { const v = bytes.readFloatBE(offset); offset += 4; return v; }
  if (type === 6) { const v = bytes.readDoubleBE(offset); offset += 8; return v; }
  if (type === 7) { const length = i32(); const value = bytes.subarray(offset, offset + length); offset += length; return value; }
  if (type === 8) return string();
  if (type === 9) {
    const itemType = u8(), length = i32(), value = [];
    for (let i = 0; i < length; i++) value.push(readTag(itemType));
    return value;
  }
  if (type === 10) {
    const value = {};
    while (true) {
      const itemType = u8();
      if (!itemType) break;
      value[string()] = readTag(itemType);
    }
    return value;
  }
  if (type === 11) { const length = i32(), value = []; for (let i = 0; i < length; i++) value.push(i32()); return value; }
  if (type === 12) { const length = i32(), value = []; for (let i = 0; i < length; i++) { value.push(bytes.readBigInt64BE(offset)); offset += 8; } return value; }
  throw new Error(`Unsupported NBT tag ${type}`);
}

u8();
string();
const root = readTag(10);
// A litematic can hold several regions; a single-region build maps directly.
const regions = Object.values(root.Regions);
if (regions.length !== 1) throw new Error(`Expected 1 region, found ${regions.length}`);
const region = regions[0];
// Negative size means the region extends in that direction from Position;
// the stored voxel order already runs over the absolute extents.
const [sx, sy, sz] = [Math.abs(region.Size.x), Math.abs(region.Size.y), Math.abs(region.Size.z)];
const palette = region.BlockStatePalette.map(block => [block.Name, block.Properties ?? null]);
const bits = Math.max(2, Math.ceil(Math.log2(palette.length)));
const mask = (1n << BigInt(bits)) - 1n;

function sourceIndex(index) {
  const bit = BigInt(index * bits);
  const longIndex = Number(bit / 64n);
  const bitOffset = Number(bit % 64n);
  let value = BigInt.asUintN(64, region.BlockStates[longIndex]) >> BigInt(bitOffset);
  if (bitOffset + bits > 64) value |= BigInt.asUintN(64, region.BlockStates[longIndex + 1]) << BigInt(64 - bitOffset);
  return Number(value & mask);
}

const packed = new Uint8Array(Math.ceil(sx * sy * sz * bits / 8));
let bit = 0;
for (let index = 0; index < sx * sy * sz; index++) {
  const value = sourceIndex(index);
  for (let k = 0; k < bits; k++, bit++) if (value & (1 << k)) packed[bit >> 3] |= 1 << (bit & 7);
}

const moduleSource = `// Generated from ${input} by tools/generate-litematic-model.mjs — do not edit.
// The browser decodes packed indices; the palette carries block properties so
// slabs/doors/trapdoors can be rebuilt as real shapes (mapBlock gets props).
export const ${name}_SIZE = [${sx}, ${sy}, ${sz}];
export const ${name}_SCALE = [1, 1, 1];
export const ${name}_BITS = ${bits};
export const ${name}_PALETTE = ${JSON.stringify(palette)};
export const ${name}_DATA = '${Buffer.from(packed).toString('base64')}';
const BYTES = Uint8Array.from(atob(${name}_DATA), c => c.charCodeAt(0));
export function block${name}(x, y, z) {
  const [sx, sy, sz] = ${name}_SIZE;
  if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return null;
  const index = (y * sz + z) * sx + x;
  let value = 0;
  for (let k = 0; k < ${name}_BITS; k++) {
    const bit = index * ${name}_BITS + k;
    value |= ((BYTES[bit >> 3] >> (bit & 7)) & 1) << k;
  }
  return ${name}_PALETTE[value];
}
export function buildLitematic${name}(grid, origin, mapBlock, groupFor, emitShape) {
  let bit = 0;
  const read = () => {
    let value = 0;
    for (let k = 0; k < ${name}_BITS; k++, bit++) value |= ((BYTES[bit >> 3] >> (bit & 7)) & 1) << k;
    return value;
  };
  const [SX, SY, SZ] = ${name}_SCALE;
  for (let my = 0; my < ${name}_SIZE[1]; my++) {
    for (let mz = 0; mz < ${name}_SIZE[2]; mz++) {
      for (let mx = 0; mx < ${name}_SIZE[0]; mx++) {
        const entry = ${name}_PALETTE[read()];
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
`;
fs.writeFileSync(output, moduleSource);
console.log(`${output}: ${sx}x${sy}x${sz}, palette ${palette.length}, ${Math.ceil(sx * sy * sz * bits / 8)} bytes packed`);
