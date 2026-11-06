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
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.world || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);

    const checks = await page.evaluate(async () => {
      const home = __home, player = home.player;
      const { LAND, LIGHT_VOLUME, FOUNTAIN } = await import('@world/layout.js');
      const { min, extent, size } = LIGHT_VOLUME;
      const lighting = home.world.lighting;
      const sources = lighting.sources.filter(source => source.id.startsWith('night-') || source.id.startsWith('fountain-rim-'));
      const sample = (positionX, height, positionZ) => {
        const column = Math.floor((positionX - min[0]) / extent[0] * size[0]);
        const level = Math.floor((height - min[1]) / extent[1] * size[1]);
        const row = Math.floor((positionZ - min[2]) / extent[2] * size[2]);
        return lighting.texture.image.data[(column + size[0] * (level + size[1] * row)) * 4] / 255 * 4;
      };
      const border = [-17.5, -16.5, -15.5, -14.5].map(positionZ => sample(FOUNTAIN.x, 0.5, positionZ));
      const path = [-19, -15, -7, -3, 1, 5, 9, 13, 17].map(positionZ => sample(0.5, 0.5, positionZ));
      const facade = [-27, -21, -15].map(positionX => sample(positionX, 7, -2.5));
      const grove = sample(-10.5, 2, -23.5);
      home.setWeatherMode('clear');
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      const routes = [
        { from: [0.5, 18], to: [0.5, -21] },
        { from: [0.5, 5.9], to: [-12, 5.9] },
        { from: [FOUNTAIN.x - 6, FOUNTAIN.z], to: [FOUNTAIN.x + 6, FOUNTAIN.z] },
      ].map(route => {
        player.teleport(...route.from);
        const accepted = player.goTo(...route.to);
        let flew = false;
        for (let frame = 0; frame < 2400 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0);
          flew ||= player.flying;
        }
        return accepted && !flew && !player.travelling && Math.hypot(player.pos.x - route.to[0], player.pos.z - route.to[1]) < 0.25;
      });
      const ringOpen = Array.from({ length: 64 }, (_, index) => {
        const angle = index * Math.PI / 32, radius = FOUNTAIN.radius + 1.1;
        return home.nav.canStand(FOUNTAIN.x + Math.sin(angle) * radius, FOUNTAIN.z + Math.cos(angle) * radius);
      }).every(Boolean);
      player.teleport(FOUNTAIN.x, FOUNTAIN.z - 6);
      home.rig.showcase(innerWidth < 600 ? [-2, 10, -26] : [4, 23, -38], innerWidth < 600 ? [-5, 1.2, -10] : [-5, 2, -3]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, player);
      return {
        routes, ringOpen, border, path, facade, grove,
        coversLand: min[0] <= LAND.x0 - 2 && min[2] <= LAND.z0 - 2 && min[0] + extent[0] >= LAND.x1 + 2 && min[2] + extent[2] >= 54,
        sourceCount: sources.length, uniqueSources: new Set(sources.map(source => source.id)).size === sources.length,
        validSources: sources.every(source => source.position.every(Number.isFinite) && source.power > 0 && source.radius > 0),
        unblockedSources: sources.every(source => !home.world.grid.type(...source.position.map(Math.floor))),
        bakedBytes: lighting.stats.bytes, bakeMs: lighting.stats.bakeMs,
        fixtures: home.world.groups.model.children.reduce((count, mesh) => count + mesh.userData.tags.filter(tag => tag === 'night-lighting').length, 0),
      };
    });
    for (const key of ['coversLand', 'ringOpen', 'uniqueSources', 'validSources', 'unblockedSources']) assert.equal(checks[key], true, key);
    assert.ok(checks.routes.every(Boolean), 'all three walking routes must remain open');
    assert.equal(checks.sourceCount, 33);
    assert.ok(checks.fixtures > 100, 'light fittings must share the existing model batch');
    assert.ok(checks.bakedBytes < 1024 * 1024, 'the baked light volume must stay below 1 MiB');
    assert.ok(checks.border.every(value => value > 0.05), 'the old northern cutoff must receive light on both sides');
    assert.ok(checks.border.every((value, index) => !index || Math.abs(value - checks.border[index - 1]) < 0.3), 'the old cutoff must have a gradual transition');
    assert.ok(checks.path.every(value => value > 0.15), 'the central path must have continuous lighting');
    assert.ok(checks.facade.every(value => value > 0.1), 'the tower facade must receive fill light');
    assert.ok(checks.grove > 0.1, 'the north grove must receive uplighting');

    for (const mode of ['day', 'night']) {
      await page.evaluate(mode => { __home.setTimeMode(mode); __home.stage.settle(); }, mode);
      await page.waitForTimeout(900);
      const light = await page.evaluate(() => ({
        ambient: __home.stage.hemi.intensity,
        sky: __home.stage.hemi.color.getHex(),
        ground: __home.stage.hemi.groundColor.getHex(),
        exposure: __home.stage.renderer.toneMappingExposure,
        baked: __home.world.lighting.uniforms.uInteriorBoost.value,
      }));
      assert.deepEqual(light, mode === 'night'
        ? { ambient: 1.15, sky: 0xb0bac8, ground: 0x8d867d, exposure: 1.14, baked: 1 }
        : { ambient: 1.25, sky: 0xe6e3da, ground: 0xa8967a, exposure: 1.1, baked: 0.025 },
      `${view.name} ${mode}: lift night shadows without changing daylight or baked lamps`);
      await page.screenshot({ path: fileURLToPath(new URL(`night-lighting-${view.name}-${mode}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= stats.budget.calls, `${view.name} ${mode}: ${stats.calls} calls`);
      assert.ok(stats.triangles <= stats.budget.triangles, `${view.name} ${mode}: ${stats.triangles} triangles`);
      assert.equal(stats.lights, 0, 'night lighting must not add real-time lights');
      console.log(`${view.name} ${mode}: ${stats.calls} calls, ${stats.triangles} triangles, ${stats.lights} real-time lights`);
    }
    const weather = await page.evaluate(() => {
      __home.setWeatherMode('rain');
      __home.stage.settle();
      const rainyAmbient = __home.stage.hemi.intensity;
      __home.setTimeMode('day');
      __home.stage.settle();
      __home.setTimeMode('night');
      __home.setWeatherMode('clear');
      __home.stage.settle();
      return { rainyAmbient, restoredAmbient: __home.stage.hemi.intensity, restoredExposure: __home.stage.renderer.toneMappingExposure };
    });
    assert.ok(weather.rainyAmbient >= 1, `${view.name}: rainy nights must retain readable ambient light`);
    assert.equal(weather.restoredAmbient, 1.15, 'weather and time switches must restore the night preset without accumulating brightness');
    assert.equal(weather.restoredExposure, 1.14);
    console.log(`${view.name}: coverage, light continuity, facade, grove and three walking routes passed; ${Math.round(checks.bakedBytes / 1024)} KiB baked in ${Math.round(checks.bakeMs)} ms`);
    assert.deepEqual(errors, []);
    await context.close();
  }
} finally {
  await browser.close();
}
