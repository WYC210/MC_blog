// One-off: pull per-block average colours out of the mapartcraft bundle's
// embedded coloursJSON (map-art dataset: dark/normal/light tone per colour set).
import fs from 'node:fs';

const s = fs.readFileSync('C:/Users/YanBin/AppData/Local/Temp/mac-main.js', 'utf8');
const start = s.indexOf("JSON.parse('{\"0\":{\"tonesRGB\"");
if (start < 0) throw new Error('coloursJSON not found');
const strStart = s.indexOf("'", start) + 1;
const end = s.indexOf("')", strStart);
const raw = s.slice(strStart, end).replaceAll("\\'", "'").replaceAll('\\\\', '\\');
const data = JSON.parse(raw);

const want = process.argv.slice(2);
const hits = [];
for (const [setId, set] of Object.entries(data)) {
  for (const block of Object.values(set.blocks ?? {})) {
    if (want.some(w => block.displayName.toLowerCase().includes(w.toLowerCase()))) {
      const normal = set.tonesRGB.normal;
      const hex = '#' + normal.map(c => c.toString(16).padStart(2, '0')).join('');
      const versions = Object.values(block.validVersions);
      const v = versions[versions.length - 1];
      const name = typeof v === 'string' ? v : (v.NBTName ?? '?');
      hits.push(`${block.displayName.padEnd(30)} set ${setId.padEnd(2)} normal ${hex}  dark#${set.tonesRGB.dark.map(c => c.toString(16).padStart(2, '0')).join('')}  light#${set.tonesRGB.light.map(c => c.toString(16).padStart(2, '0')).join('')}  (${name})`);
    }
  }
}
console.log(hits.join('\n'));
