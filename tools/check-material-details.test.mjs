import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { SURFACE_TILES, MODEL_SURFACES, restoreModelMaterials, materialForBlock, surfaceTile, installSurfaceTiles } from '../world/material-palette.js';
import { DETAIL_KINDS, detailProfile, terrainProfile, materialDetailStrength } from '../world/detail-profiles.js';
import { SURFACE_DETAIL } from '../world/surface-shader.js';

test('terrain profiles accept block objects and names, and ignore covered or missing blocks', () => {
  for (const name of ['sand', 'qin-sand', 'qin-grass', 'qin-path']) {
    assert.deepEqual(terrainProfile({ name }, true), terrainProfile(name, true));
    assert.ok(terrainProfile(name, true).some(value => value > 0));
    assert.deepEqual(terrainProfile({ name }, false), [0, 0, 0]);
  }
  assert.deepEqual(terrainProfile(null, true), [0, 0, 0]);
  assert.deepEqual(terrainProfile('unknown', true), [0, 0, 0]);
});

test('model restoration retains colour, emission, merge and collision properties', () => {
  const types = Object.keys(MODEL_SURFACES).map(name => ({ name, tex: { all: 'paint' }, tint: 0xabc123, emissive: 0.2, merge: true, kind: 'opaque' }));
  const unknown = { name: 'custom', tex: { all: 'glass' } };
  const grid = { types: [null, ...types, unknown] };
  restoreModelMaterials(grid);
  for (const type of types) {
    assert.deepEqual(type.tex, MODEL_SURFACES[type.name]);
    assert.equal(type.tint, 0xabc123); assert.equal(type.emissive, 0.2);
    assert.equal(type.merge, true); assert.equal(type.kind, 'opaque');
  }
  assert.deepEqual(unknown.tex, { all: 'glass' });
  assert.equal(grid.types.find(type => type?.name === 'g_oak').tex.all, SURFACE_TILES.wood);
  assert.equal(grid.types.find(type => type?.name === 'l_sdoak').tex.top, SURFACE_TILES.endgrain);
});

test('shape materials retain authored tint and distinguish wood, cloth, stone and glass', () => {
  const look = { tex: 'paint', tint: 0xd7c185, emissive: 0.18 };
  for (const [name, texture] of [
    ['minecraft:cherry_stairs', SURFACE_TILES.wood], ['minecraft:birch_trapdoor', SURFACE_TILES.wood],
    ['minecraft:white_carpet', SURFACE_TILES.cloth], ['minecraft:blue_wall_banner', SURFACE_TILES.cloth],
    ['minecraft:andesite_slab', SURFACE_TILES.stone], ['minecraft:smooth_stone_slab', SURFACE_TILES.smooth],
    ['minecraft:smooth_sandstone_slab', SURFACE_TILES.sandstone], ['minecraft:quartz_slab', SURFACE_TILES.quartz],
  ]) {
    const material = materialForBlock(name, look);
    assert.equal(material.tex, texture); assert.equal(material.tint, look.tint); assert.equal(material.emissive, look.emissive);
  }
  const glass = { tex: 'glass', glass: true };
  assert.equal(materialForBlock('minecraft:glass', glass), glass);
  assert.equal(materialForBlock('minecraft:moss_carpet', look), look);
  assert.equal(look.tex, 'paint');
});

test('surface tiles extend the shared array once and leave existing layer data intact', () => {
  const source = new Uint8Array(16 * 16 * 4).fill(173);
  const texture = { image: { width: 16, height: 16, depth: 1, data: source } };
  const materials = { uniforms: { uTiles: { value: texture } } }, layer = { paint: 0 };
  installSurfaceTiles(materials, layer);
  assert.equal(texture.image.depth, 1 + Object.keys(SURFACE_TILES).length);
  assert.deepEqual(texture.image.data.subarray(0, source.length), source);
  const pixels = texture.image.data;
  installSurfaceTiles(materials, layer);
  assert.equal(texture.image.data, pixels);
  for (const name of Object.values(SURFACE_TILES)) {
    assert.ok(Number.isInteger(layer[name]));
    const tile = surfaceTile(name);
    assert.deepEqual(tile, surfaceTile(name));
    for (let index = 0; index < tile.length; index += 4) {
      assert.equal(tile[index], tile[index + 1]); assert.equal(tile[index], tile[index + 2]);
      assert.equal(tile[index + 3], 255); assert.ok(tile[index] >= 170);
    }
  }
});

test('material profiles separate finishes and preserve detail on non-luminous objects', () => {
  assert.equal(detailProfile(SURFACE_TILES.wood).kind, DETAIL_KINDS.wood);
  assert.equal(detailProfile(SURFACE_TILES.endgrain).kind, DETAIL_KINDS.endgrain);
  assert.equal(detailProfile(SURFACE_TILES.rope).kind, DETAIL_KINDS.rope);
  assert.ok(detailProfile('prada_marble').roughness < detailProfile('stone').roughness);
  assert.ok(detailProfile('chrome').roughness < detailProfile('stainless').roughness);
  assert.ok(detailProfile('rubber').roughness > detailProfile('leather').roughness);
  for (const emissive of [0, 0.18, 0.34, 0.52]) assert.equal(materialDetailStrength(emissive), 1);
  assert.equal(materialDetailStrength(1), 0); assert.equal(materialDetailStrength(2), 0);
  assert.ok(materialDetailStrength(0.8) > 0 && materialDetailStrength(0.8) < 1);
  assert.ok(SURFACE_DETAIL.includes('(vEmissive - 0.65) / 0.35'));
  assert.ok(!SURFACE_DETAIL.includes('puddleDistance'));
  const puddles = readFileSync(new URL('../world/rain-puddles.js', import.meta.url), 'utf8');
  assert.ok(puddles.includes('POOL_COUNT = 3'));
  assert.ok(puddles.includes('stage.quality.planar = Math.max(stage.quality.planar || 0, 0.4)'));
  assert.ok(puddles.includes('stage.pipeline?.addMirror?.({ mesh, level: 0.025, uniforms })'));
  const terrain = readFileSync(new URL('../world/terrain-detail.js', import.meta.url), 'utf8');
  assert.ok(terrain.includes('world.grid.type(horizontal, -1, vertical)?.name'));
});

test('rain pools use sparse planar reflections with softened wet edges', () => {
  const puddles = readFileSync(new URL('../world/rain-puddles.js', import.meta.url), 'utf8');
  assert.ok(puddles.includes('POOL_COUNT = 3'));
  assert.ok(puddles.includes('MIN_POOL_SPACING = 12'));
  assert.ok(puddles.includes('grid.type(Math.floor(centerX + offsetX), -1, Math.floor(centerZ + offsetZ))?.name !== \'sand\''));
  assert.ok(puddles.includes('makeWetEdgeGeometry(pools)'));
  assert.ok(puddles.includes('uReflection'));
  const terrain = readFileSync(new URL('../world/terrain-detail.js', import.meta.url), 'utf8');
  assert.ok(!terrain.includes('createRainPuddles'));
  const ultra = readFileSync(new URL('../engine/world/ultra.js', import.meta.url), 'utf8');
  assert.ok(ultra.includes('reflectionFrame % 2 === 0'));
  assert.ok(ultra.includes('reflectionWeather.haze < 0.02'));
  assert.ok(puddles.includes('smoothstep(0.88, 1.0, vRadius)'));
  assert.ok(!SURFACE_DETAIL.includes('puddleDistance'));
});
