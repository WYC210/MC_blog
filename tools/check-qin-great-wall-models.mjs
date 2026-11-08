import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { REFERENCE_SCENES, buildReferenceScene, referenceHeight } from '../world/qin-great-wall-reference-models.js';
import { WALL_MODEL_EVIDENCE, WALL_MODEL_SOURCES } from '../world/qin-great-wall-evidence.js';
import { QIN_WALL_TABLE, QIN_GALLERY } from '../world/qin-island-layout.js';

const research = JSON.parse(readFileSync(new URL('../docs/qin-great-wall-references.json', import.meta.url), 'utf8'));
const expected = research.sites.filter(site => site.grade === 'A').map(site => site.id).sort();
assert.deepEqual(Object.keys(REFERENCE_SCENES).sort(), expected);
assert.deepEqual(Object.keys(WALL_MODEL_EVIDENCE).sort(), expected);
const models = new Map();
for (const id of expected) {
  const parts = [], evidence = WALL_MODEL_EVIDENCE[id], scene = REFERENCE_SCENES[id];
  assert.ok(buildReferenceScene(id, (tag, across, height, along, width, rise, depth, look = 'stone', rotation = {}) =>
    parts.push({ tag, across, height, along, width, rise, depth, look, rotation })));
  assert.ok(parts.length > 100 && parts.length <= 1024, `${id}: instance budget ${parts.length}`);
  for (const part of parts) {
    assert.ok([part.across, part.height, part.along, part.width, part.rise, part.depth].every(Number.isFinite), `${id}: finite geometry`);
    assert.ok(part.width > 0 && part.rise > 0 && part.depth > 0, `${id}: positive dimensions`);
    const yaw = part.rotation.ry || 0, roll = part.rotation.rz || 0;
    const radiusX = Math.abs(Math.cos(roll)) * part.width / 2 + Math.abs(Math.sin(roll)) * part.rise / 2;
    const radiusY = Math.abs(Math.sin(roll)) * part.width / 2 + Math.abs(Math.cos(roll)) * part.rise / 2;
    const extentX = Math.abs(Math.cos(yaw)) * radiusX + Math.abs(Math.sin(yaw)) * part.depth / 2;
    const extentZ = Math.abs(Math.sin(yaw)) * radiusX + Math.abs(Math.cos(yaw)) * part.depth / 2;
    assert.ok(Math.abs(part.across) + extentX <= (QIN_WALL_TABLE.width - 0.8) / 2, `${id}: table width`);
    assert.ok(Math.abs(part.along) + extentZ <= (QIN_WALL_TABLE.depth - 1) / 2, `${id}: table depth`);
    assert.ok(QIN_WALL_TABLE.floor + 0.96 + part.height + part.rise / 2 + radiusY < QIN_GALLERY.floor - 0.25, `${id}: below mezzanine`);
  }
  for (let across = -15.6; across <= 15.6; across += 0.4) for (let along = -1.8; along <= 1.8; along += 0.2)
    assert.ok(Number.isFinite(referenceHeight(scene, across, along)), `${id}: finite terrain`);
  assert.ok(evidence.scope && evidence.scopeEn && evidence.sources.length);
  for (const key of evidence.sources) {
    const documented = research.sources.find(source => source.id === key);
    assert.equal(WALL_MODEL_SOURCES[key]?.url, documented?.url, `${id}: source matches research`);
    assert.ok(documented);
  }
  models.set(id, parts);
}
const tagged = (id, tag) => models.get(id).filter(part => part.tag === tag);
const contains = (part, across, height, along) => {
  const yaw = part.rotation.ry || 0, roll = part.rotation.rz || 0;
  const deltaX = across - part.across, deltaY = height - part.height - part.rise / 2, deltaZ = along - part.along;
  const yawX = Math.cos(yaw) * deltaX - Math.sin(yaw) * deltaZ, yawZ = Math.sin(yaw) * deltaX + Math.cos(yaw) * deltaZ;
  const localX = Math.cos(roll) * yawX + Math.sin(roll) * deltaY, localY = -Math.sin(roll) * yawX + Math.cos(roll) * deltaY;
  return Math.abs(localX) < part.width / 2 && Math.abs(localY) < part.rise / 2 && Math.abs(yawZ) < part.depth / 2;
};
assert.equal(tagged('jiumenkou', 'bridge-pier').length, 8);
assert.equal(tagged('jiumenkou', 'bridge-abutment').length, 2);
assert.equal(tagged('jiumenkou', 'water-arch-voussoir').length, 9 * 12);
assert.equal(tagged('jiumenkou', 'spindle-cutwater').length, 8 * 2 * 3);
for (let opening = 0; opening < 9; opening++) {
  const across = (opening - 4) * 1.1;
  assert.ok(!models.get('jiumenkou').some(part => contains(part, across, 0.35, 0)), 'Water openings must be real holes');
  assert.ok(referenceHeight(REFERENCE_SCENES.jiumenkou, across, 0) < 0.026, 'River terrain must not obstruct arches');
  assert.ok(models.get('jiumenkou').some(part => contains(part, across, 1.2, 0)), 'Bridge deck must join above each opening');
}
for (const [id, height] of [['shanhaiguan', 0.25], ['naziyu', 0.3], ['liujiakou', 0.3]])
  assert.ok(!models.get(id).some(part => contains(part, 0, height, 0)), `${id}: open gate passage`);
const platform = tagged('shanhaiguan', 'zhendong-platform-jamb'), upper = tagged('shanhaiguan', 'zhendong-upper')[0];
assert.equal(platform.length, 2);
assert.ok(Math.abs(platform[0].depth / platform[0].rise - 30.4 / 11.75) < 1e-9);
assert.ok(Math.abs(upper.width / upper.depth - 20 / 10.1) < 1e-9);
assert.ok(tagged('shanhaiguan', 'zhendong-side-window').some(part => part.across < 0));
assert.ok(tagged('shanhaiguan', 'zhendong-side-window').some(part => part.across > 0));
assert.ok(tagged('jiaoshan', 'exposed-rock').length && tagged('jiaoshan', 'stair-tread').length);
assert.ok(tagged('banchangyu', 'columnar-cliff').length);
assert.ok(tagged('naziyu', 'yellow-stone-band').every(part => part.look === 'sandstone'));
assert.ok(!models.get('naziyu').some(part => part.tag.includes('roof') || part.tag.includes('gold')));
assert.ok(tagged('jielingkou', 'fan-platform').length === 24);
assert.ok(tagged('chengziyu', 'broken-tower-merlon').length && !tagged('chengziyu', 'hollow-tower-deck').length);
assert.ok(tagged('liujiakou', 'watergate-broken-side').length && !models.get('liujiakou').some(part => part.tag.includes('roof')));
assert.equal(buildReferenceScene('south-wing', () => assert.fail('Do not rebuild unsupported sites')), false);
console.log(`Reference model checks passed: ${expected.length} sites, real arch openings, evidence links and geometry budgets.`);
