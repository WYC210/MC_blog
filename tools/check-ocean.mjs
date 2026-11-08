import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = [];
try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, screen: { width: 1920, height: 1080 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view);
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//, route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const initial = await page.evaluate(async () => {
      const home = __home, layout = await import('@world/layout.js');
      home.weather.dispose(); home.rig.update(20, home.player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle(); home.weatherFx.settle();
      home.player.teleport(0, 18);
      const uniforms = home.pool.water.material.uniforms, map = uniforms.uOceanShore.value.image, bounds = uniforms.uOceanMap.value;
      const sample = (column, row) => {
        const offset = ((column - bounds.x) + (row - bounds.y) * map.width) * 4;
        return { depth: map.data[offset + 1] / 255 * 8, connected: map.data[offset + 2] > 0 };
      };
      return { programs: home.stats().programs, mobile: home.stage.quality.mobile, waves: home.pool.water.material.defines.OCEAN_WAVES,
        land: sample(0, 18), water: sample(-45, 0), waterLevel: layout.POOL.water,
        bytes: map.data.byteLength, mipmaps: uniforms.uOceanShore.value.generateMipmaps };
    });
    assert.equal(initial.mobile, view.name === 'phone');
    assert.equal(initial.waves, view.name === 'phone' ? 2 : 3);
    assert.equal(initial.land.connected, false);
    assert.equal(initial.water.connected, true);
    assert.ok(Math.abs(initial.water.depth - 2.68) < 0.04);
    assert.equal(initial.waterLevel, -0.32);
    assert.ok(initial.bytes < 512 * 1024);
    assert.equal(initial.mipmaps, false);

    for (const shot of [
      { name: 'shore', camera: [-35, 5, 35], look: [0, -0.32, 28] },
      { name: 'open', camera: [-45, 2, 6], look: [-65, -0.32, 32] },
      { name: 'overview', camera: [85, 65, 100], look: [80, 0, 0] },
    ]) {
      await page.evaluate(shot => { __home.rig.showcase(shot.camera, shot.look); __home.rig.update(3, __home.player); }, shot);
      for (const weather of ['clear', 'rain', 'snow', 'thunder']) {
        const state = await page.evaluate(async weather => {
          const home = __home;
          home.setWeatherMode(weather); home.stage.settle(); home.weatherFx.settle();
          for (let frame = 0; frame < 3; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
          return { ...home.stats(), geometry: home.pool.water.geometry.index.count / 3,
            mean: home.pool.water.position.y, attributeVersion: home.pool.water.geometry.attributes.position.version };
        }, weather);
        assert.equal(state.geometry, shot.name === 'overview' ? 2 : view.name === 'phone' ? 800 : 1568);
        assert.equal(state.mean, -0.32);
        assert.equal(state.attributeVersion, 0);
        assert.equal(state.programs, initial.programs, 'Weather or geometry changes must not compile shaders');
        assert.ok(state.calls <= state.budget.calls, `${view.name} ${shot.name} ${weather}: draw call budget (${state.calls})`);
        assert.ok(state.triangles <= state.budget.triangles, `${view.name} ${shot.name} ${weather}: triangle budget (${state.triangles})`);
        assert.equal(state.lights, 0);
        report.push({ view: view.name, shot: shot.name, weather, ...state });
        if (weather === 'clear') await page.screenshot({ path: fileURLToPath(new URL(`ocean-${view.name}-${shot.name}.png`, output)) });
      }
    }

    await page.evaluate(() => {
      const home = __home; home.setWeatherMode('clear'); home.setTimeMode('day'); home.stage.settle(); home.weatherFx.settle();
      home.rig.showcase([-35, 5, 35], [0, -0.32, 28]); home.rig.update(3, home.player);
    });
    await page.waitForTimeout(300);
    const rendered = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, renderer = home.stage.renderer;
      const uniforms = home.pool.water.material.uniforms, height = uniforms.uOceanHeight.value, foam = uniforms.uOceanFoam.value;
      const target = new THREE.WebGLRenderTarget(160, 100), previous = renderer.getRenderTarget();
      const original = new Uint8Array(160 * 100 * 4), flat = new Uint8Array(original.length), plain = new Uint8Array(original.length);
      const draw = pixels => { renderer.setRenderTarget(target); renderer.render(home.stage.scene, home.stage.camera); renderer.readRenderTargetPixels(target, 0, 0, 160, 100, pixels); };
      try {
        draw(original);
        uniforms.uOceanHeight.value = 0; draw(flat); uniforms.uOceanHeight.value = height;
        uniforms.uOceanFoam.value = 0; draw(plain);
        let waves = 0, shoreline = 0;
        for (let offset = 0; offset < original.length; offset += 4) {
          if (original[offset] !== flat[offset] || original[offset + 1] !== flat[offset + 1] || original[offset + 2] !== flat[offset + 2]) waves++;
          if (original[offset] !== plain[offset] || original[offset + 1] !== plain[offset + 1] || original[offset + 2] !== plain[offset + 2]) shoreline++;
        }
        return { waves, shoreline };
      } finally {
        uniforms.uOceanHeight.value = height; uniforms.uOceanFoam.value = foam;
        renderer.setRenderTarget(previous); target.dispose();
      }
    });
    assert.ok(rendered.waves > 0, 'Ocean displacement must affect rendered pixels');
    assert.ok(rendered.shoreline > 0, 'Shore foam must affect rendered pixels');
    const programsAfterPixelTest = await page.evaluate(() => __home.stats().programs);

    await page.evaluate(() => { __home.rig.showcase([-45, -1.2, 0], [-35, -0.1, 8]); __home.rig.update(3, __home.player); });
    await page.waitForFunction(() => __home.pool.submerged);
    await page.screenshot({ path: fileURLToPath(new URL(`ocean-${view.name}-underwater.png`, output)) });
    await page.evaluate(() => {
      const home = __home; home.setTimeMode('night'); home.stage.settle();
      home.rig.showcase([-35, 5, 35], [0, -0.32, 28]); home.rig.update(3, home.player);
    });
    await page.waitForFunction(() => !__home.pool.submerged);
    const night = await page.evaluate(async () => {
      for (let frame = 0; frame < 3; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
      return __home.stats();
    });
    assert.ok(night.calls <= night.budget.calls, `${view.name} night: draw call budget (${night.calls})`);
    assert.ok(night.triangles <= night.budget.triangles, `${view.name} night: triangle budget (${night.triangles})`);
    assert.equal(night.programs, programsAfterPixelTest, 'Underwater and night changes must not compile shaders');
    assert.equal(night.lights, 0);
    report.push({ view: view.name, shot: 'shore', weather: 'clear', time: 'night', ...night });
    await page.screenshot({ path: fileURLToPath(new URL(`ocean-${view.name}-night.png`, output)) });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => __home.pool.water.geometry.index.count === 6);
    assert.equal(await page.evaluate(() => __home.pool.water.material.uniforms.uOceanHeight.value), 0);
    assert.deepEqual(errors, []);
    console.log(`PASS ${view.name}: waves, foam, depth map, weather, geometry LOD, underwater, night, reduced motion; ${JSON.stringify(rendered)}`);
    await context.close();
  }

  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(new URL('examples/terry-home/', base).href);
  await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
  assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
  assert.equal(await page.evaluate(() => __home.pool.water.geometry.index.count), 6);
  assert.equal(await page.evaluate(() => 'OCEAN_WAVES' in __home.pool.water.material.defines), false);
  assert.equal(await page.evaluate(() => 'uOceanShore' in __home.pool.water.material.uniforms), false);
  assert.deepEqual(errors, []);
  console.log('PASS showcase: original pool geometry and shader path remain unchanged');
  await page.close();
  writeFileSync(new URL('ocean-report.json', output), JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
