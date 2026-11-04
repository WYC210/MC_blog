import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));

try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const results = await page.evaluate(async () => {
      const { drawMapImage } = await import('/engine/ui/minimap.js');
      const { VoxelGrid } = await import('/engine/world/voxels.js');
      const { ISLAND } = await import('/world/layout.js');
      const image = drawMapImage(__home.world.grid, __home.world.obstacles);
      const pixel = (canvas, x, z) => {
        const scale = canvas.width / (ISLAND.x1 - ISLAND.x0);
        return Array.from(canvas.getContext('2d').getImageData(Math.floor((x + 0.5 - ISLAND.x0) * scale), Math.floor((z + 0.5 - ISLAND.z0) * scale), 1, 1).data);
      };
      const real = [[0, 18], [-25, 2], [10, 43], [25, 7], [0, 32], [-45, 40]].map(([x, z]) => ({ x, z, color: pixel(image, x, z) }));
      const fixture = new VoxelGrid({ min: [ISLAND.x0, -20, ISLAND.z0], size: [ISLAND.x1 - ISLAND.x0, 72, ISLAND.z1 - ISLAND.z0] });
      for (const [name, color] of [['ground', '#bbaa88'], ['tower', '#c07050'], ['bridge', '#778899'], ['floor', '#7f8f9f'], ['roof', '#ff00ff']]) fixture.define(name, { map: color });
      for (const z of [17, 18]) {
        fixture.set(0, 0, z, 'ground');
        fixture.set(1, -12, z, 'ground');
        fixture.set(3, 2, z, 'floor');
        fixture.set(3, 11, z, 'roof', 'roof');
      }
      for (const z of [4, 5]) {
        fixture.set(-24, 0, z, 'ground');
        fixture.set(-24, 44, z, 'tower');
      }
      for (const z of [42, 43]) {
        fixture.set(10, -12, z, 'ground');
        fixture.set(10, 20, z, 'bridge');
      }
      fixture.set(-45, -12, 40, 'ground');
      const testImage = drawMapImage(fixture, []);
      const unit = [[0, 18], [-24, 5], [10, 43], [-45, 40], [0, 35], [1, 18], [3, 18]].map(([x, z]) => pixel(testImage, x, z));
      for (let frame = 0; frame < 240; frame++) __home.rig.update(1 / 60, __home.player);
      __home.player.teleport(0.5, 18);
      return { real, unit };
    });
    assert.deepEqual(results.unit, [
      [187, 170, 136, 255],
      [192, 112, 80, 255],
      [119, 136, 153, 255],
      [63, 169, 207, 255],
      [63, 169, 207, 255],
      [187, 170, 136, 255],
      [127, 143, 159, 255],
    ], 'Map sampling failed: custom water mask, tall tower, over-water building, deep seabed, empty water, low terrain or hidden roof');
    for (const sample of results.real.slice(0, 4)) assert.notDeepEqual(sample.color, [63, 169, 207, 255], `Land/building at ${sample.x},${sample.z} was painted as water`);
    for (const sample of results.real.slice(4)) assert.deepEqual(sample.color, [63, 169, 207, 255], 'Actual water no longer appears as water');
    await page.waitForTimeout(450);
    await page.locator('#minimap').screenshot({ path: fileURLToPath(new URL(`minimap-${view.name}.png`, output)) });
    await page.locator('#minimap .expand').click({ force: true });
    assert.equal(await page.locator('#bigmap').isVisible(), true);
    await page.screenshot({ path: fileURLToPath(new URL(`minimap-${view.name}-expanded.png`, output)) });
    await page.locator('#bigmap .close').click();
    assert.equal(await page.locator('#bigmap').isVisible(), false);
    await page.locator('#minimap canvas').click({ position: { x: 80, y: 100 } });
    await page.waitForTimeout(150);
    assert.deepEqual(errors, []);
    console.log(`${view.name}: terrain, tall buildings, stilt house, real water, roof cutaway, expanded map and map picking passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
