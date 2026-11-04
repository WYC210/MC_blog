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
      const home = window.__home;
      const { LIGHT_VOLUME } = await import('/world/layout.js');
      const ground = home.world.ground;
      const clear = [[15.9, 36.6], [14.1, 37.5], [14.1, 40], [14.1, 44], [11.2, 43.5], [12.2, 46.6], [14.1, 47.7]];
      const blocked = [[11.65, 38.65], [11.65, 40.25], [10.03, 43.6], [12.2, 45.6], [12.2, 47.7], [14.91, 43.8]];
      const clearPoints = clear.map(([x, z]) => ({ x, z, pass: !!ground.canStand(x, z, 19) }));
      const blockedPoints = blocked.map(([x, z]) => ({ x, z, blocked: !ground.canStand(x, z, 19) }));
      const route = { x: 14.1, z: 37.5 };
      let surface = ground.canStand(route.x, route.z, 19);
      for (let step = 0; step < 108 && surface; step++) surface = ground.move(route, 0, 0.1, surface.y, surface);
      const staircase = { x: 16, z: 49.5 };
      let stairSurface = ground.canStand(staircase.x, staircase.z, 12.5);
      for (let step = 0; step < 120 && stairSurface; step++) stairSurface = ground.move(staircase, 0, -0.1, stairSurface.y, stairSurface);
      let landing = stairSurface;
      for (let step = 0; step < 19 && landing; step++) landing = ground.move(staircase, -0.1, 0, landing.y, landing);
      const displays = home.stage.scene.getObjectByName('lehun-trading-displays');
      const lamps = home.world.lighting.sources.filter(source => source.id.startsWith('trading-'));
      const volume = LIGHT_VOLUME;
      const contains = position => position.every((value, axis) => value > volume.min[axis] && value < volume.min[axis] + volume.extent[axis]);
      const data = home.world.lighting.texture.image.data;
      const energies = [[12.5, 20.5, 39.5], [13.5, 20.5, 43.5], [11.5, 20.5, 46.5]].map(position => {
        const cell = position.map((value, axis) => Math.floor((value - volume.min[axis]) * volume.size[axis] / volume.extent[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        return data[offset] / 255 * 4;
      });
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
      home.player.teleport(13.8, 42);
      return {
        clearPoints, blockedPoints, route, staircase, landing: landing?.y,
        lamps: lamps.length, lightsCovered: lamps.every(source => contains(source.position)),
        roomCovered: contains([9, 19, 36]) && contains([17, 27, 50]), energies,
        vertices: displays?.geometry.attributes.position.count, indices: displays?.geometry.index.count,
        textureSize: [displays?.material.map.image.width, displays?.material.map.image.height],
        depthTest: displays?.material.depthTest, realLights: home.world.lights.length,
      };
    });
    assert.ok(results.clearPoints.every(point => point.pass), `Aisle blocked: ${JSON.stringify(results.clearPoints)}`);
    assert.ok(results.blockedPoints.every(point => point.blocked), `Furniture collision missing: ${JSON.stringify(results.blockedPoints)}`);
    assert.ok(Math.abs(results.route.z - 48.3) < 0.05, 'The main aisle is not walkable');
    assert.ok(Math.hypot(results.staircase.x - 14.1, results.staircase.z - 37.5) < 0.05 && results.landing === 19, 'Stairs no longer reach the trading floor');
    assert.equal(results.lamps, 10);
    assert.ok(results.lightsCovered && results.roomCovered, 'The lighting volume does not cover LeHun');
    assert.ok(results.energies.every(energy => energy > 0.12), 'A trading-room lighting sample is dark');
    assert.equal(results.vertices, 36, 'The six screens, two boards and ticker must share nine quads');
    assert.equal(results.indices, 54);
    assert.deepEqual(results.textureSize, [1024, 1024]);
    assert.equal(results.depthTest, true, 'Panels must not show through walls');
    assert.ok(results.realLights <= 2);

    for (const mood of ['day', 'night']) {
      await page.evaluate(({ mood, phone }) => {
        const home = window.__home;
        home.setTimeMode(mood);
        home.rig.showcase(phone ? [13.3, 21.8, 45.2] : [14.1, 21.9, 43.3], [11.65, 20.4, 38.65]);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      }, { mood, phone: view.name === 'phone' });
      await page.waitForTimeout(450);
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= stats.budget.calls && stats.triangles <= stats.budget.triangles, `Over budget: ${JSON.stringify(stats)}`);
      await page.screenshot({ path: fileURLToPath(new URL(`lehun-trading-${view.name}-${mood}.png`, output)) });
    }
    await page.evaluate(() => {
      __home.rig.showcase([14.2, 21.5, 40.8], [9.7, 21, 44.6]);
      for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: fileURLToPath(new URL(`lehun-trading-${view.name}-boards.png`, output)) });
    assert.deepEqual(errors, []);
    console.log(`${view.name}: stairs, aisles, furniture collision, nine batched panels, lighting coverage and day/night rendering passed; irradiance ${results.energies.map(energy => energy.toFixed(2)).join(', ')}`);
    await context.close();
  }
} finally {
  await browser.close();
}
