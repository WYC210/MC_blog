import assert from 'node:assert/strict';
import test from 'node:test';
import { bakeOceanMap, SHORE_RANGE, DEPTH_RANGE } from '../engine/world/ocean.js';

const bounds = { x0: -4, x1: 5, z0: -4, z1: 5 };
const water = -0.32;
const grid = solid => ({ min: [-4, -20, -4], get: solid });
const sample = (map, column, row) => {
  const offset = ((column - map.x0) + (row - map.z0) * map.width) * 4;
  return { distance: map.data[offset] / 255 * SHORE_RANGE, depth: map.data[offset + 1] / 255 * DEPTH_RANGE, connected: map.data[offset + 2] === 255 };
};

test('an empty sea produces a bounded, deterministic map without false shores', () => {
  const first = bakeOceanMap(grid(() => 0), bounds, water);
  const second = bakeOceanMap(grid(() => 0), bounds, water);
  assert.equal(first.width, 61);
  assert.equal(first.height, 61);
  assert.equal(first.data.length, first.width * first.height * 4);
  assert.deepEqual(first, second);
  assert.ok(sample(first, 0, 0).distance > 23);
  assert.equal(sample(first, 0, 0).depth, DEPTH_RANGE);
  assert.equal(sample(first, 0, 0).connected, true);
});

test('coastal distances increase away from land in every direction', () => {
  const map = bakeOceanMap(grid((column, level, row) => column === 0 && row === 0 && level === -1), bounds, water);
  assert.deepEqual(sample(map, 0, 0), { distance: 0, depth: 0, connected: false });
  for (const [column, row] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    assert.ok(Math.abs(sample(map, column, row).distance - 0.5) < SHORE_RANGE / 255);
    assert.ok(sample(map, column * 3, row * 3).distance > sample(map, column, row).distance);
    assert.equal(sample(map, column, row).connected, true);
  }
});

test('the seabed contributes depth instead of being treated as dry land', () => {
  const map = bakeOceanMap(grid((column, level, row) => level === -4), bounds, water);
  const point = sample(map, 0, 0);
  assert.ok(Math.abs(point.depth - 2.68) < DEPTH_RANGE / 255);
  assert.ok(point.distance > 23);
  assert.equal(point.connected, true);
});

test('bridges above the sea do not become foam-generating shorelines', () => {
  const map = bakeOceanMap(grid((column, level, row) => level === -4 || level === 2), bounds, water);
  assert.equal(sample(map, 0, 0).connected, true);
  assert.ok(sample(map, 0, 0).distance > 23);
});

test('enclosed ponds do not receive ocean waves', () => {
  const map = bakeOceanMap(grid((column, level, row) => level === -4 || level === -1 && Math.max(Math.abs(column), Math.abs(row)) === 2), bounds, water);
  assert.equal(sample(map, 0, 0).connected, false);
  assert.equal(sample(map, 3, 0).connected, true);
});

test('an opening connects a lagoon to the ocean', () => {
  const map = bakeOceanMap(grid((column, level, row) => level === -4 || level === -1 && Math.max(Math.abs(column), Math.abs(row)) === 2 && !(column === 2 && row === 0)), bounds, water);
  assert.equal(sample(map, 0, 0).connected, true);
});
