import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/welcome-environment/', import.meta.url);
mkdirSync(output, { recursive: true });
const hardware = process.env.WELCOME_GPU === 'hardware';
const args = hardware ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = [];
const views = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
].filter(view => !process.env.WELCOME_VIEW || process.env.WELCOME_VIEW === view.name);
assert.ok(views.length, 'WELCOME_VIEW must be desktop or phone');

try {
  for (const view of views) for (const ultra of [false, true]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      const url = new URL(base);
      url.searchParams.set('ultra', ultra ? '1' : '0');
      await page.goto(url.href);
      await page.waitForFunction(() => window.__home || window.__homeStartupError, null, { timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
      await page.evaluate(() => __home.world.hdMaterialsReady);
      const result = await page.evaluate(async () => {
        const home = __home, stage = home.stage, camera = stage.camera, renderer = stage.renderer, pipeline = stage.pipeline;
        home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.weatherFx.settle(); stage.settle();
        const frames = async (count = 8) => {
          for (let frame = 0; frame < count; frame++) await new Promise(requestAnimationFrame);
        };
        await frames();
        const counts = {}, restore = [], deltas = [], passes = [];
        function watch(object, key, name) {
          if (!object?.[key]) return;
          const original = object[key]; counts[name] = 0;
          object[key] = function(...args) {
            counts[name]++;
            if (name === 'extras') deltas.push(args[0]);
            return original.apply(this, args);
          };
          restore.push(() => { object[key] = original; });
        }
        for (const name of ['player', 'rig', 'extras', 'atmosphere', 'portal']) watch(home[name], 'update', name);
        home.pets.forEach((pet, index) => watch(pet, 'update', `pet${index}`));
        watch(home.extras, 'updateView', 'view');
        const render = renderer.render;
        renderer.render = function(scene, viewCamera) {
          const reflection = !!pipeline && this.getRenderTarget() === pipeline.targets?.reflection;
          const value = render.call(this, scene, viewCamera);
          if (reflection) passes.push(this.info.render.triangles);
          return value;
        };
        restore.push(() => { renderer.render = render; });
        function snapshot() {
          return {
            camera: camera.matrixWorld.toArray(), player: home.avatar.root.matrixWorld.toArray(),
            grass: home.world.materials.uniforms.uTime.value, worldTime: stage.scene.userData.animationTime,
            fire: home.atmosphere.fire?.material.uniforms.uTime.value,
            detail: home.environmentDetails?.uniforms.uDetailTime.value,
            clouds: stage.sky.material.uniforms.uCloudShift.value.toArray(),
            sky: stage.sky.material.uniforms.uSkyMotion.value.toArray(),
            water: home.pool.water.material.uniforms.uTime.value,
            rain: home.weatherFx.rain.material.uniforms.uTime.value,
          };
        }
        const before = snapshot();
        await frames(12);
        const after = snapshot(), waitingCounts = { ...counts }, cachedPasses = passes.length;
        const stats = home.stats();
        let cadence = null, invalidations = null;
        if (pipeline && stage.quality.ultra) {
          const setStatic = pipeline.setReflectionStatic;
          pipeline.setReflectionStatic = () => {};
          setStatic(false); passes.length = 0;
          await frames(12);
          cadence = passes.length;
          pipeline.setReflectionStatic = setStatic; setStatic(true);
          await frames();
          const check = async change => {
            passes.length = 0; change(); await frames(); return passes.length;
          };
          invalidations = {
            explicit: await check(() => pipeline.invalidateReflections()),
            camera: await check(() => { camera.position.x += 0.5; }),
            lens: await check(() => { camera.fov -= 1; camera.updateProjectionMatrix(); }),
            layers: await check(() => camera.layers.toggle(2)),
            shadow: await check(() => { renderer.shadowMap.needsUpdate = true; }),
            light: await check(() => { home.setTimeMode('dusk'); stage.settle(); }),
          };
          home.setTimeMode('day'); stage.settle();
        }
        home.setWeatherMode('rain'); home.weatherFx.settle(); stage.settle();
        await frames(); passes.length = 0;
        const rainBefore = snapshot(); await frames(); const rainAfter = snapshot();
        const rain = { before: rainBefore, after: rainAfter, visible: home.weatherFx.rain.visible, reflections: passes.length };
        home.setWeatherMode('snow'); home.weatherFx.settle(); stage.settle();
        await frames();
        const snowBefore = home.weatherFx.snow.material.uniforms.uTime.value;
        await frames();
        const snow = { before: snowBefore, after: home.weatherFx.snow.material.uniforms.uTime.value, visible: home.weatherFx.snow.visible };
        passes.length = 0;
        home.setWeatherMode('clear'); home.weatherFx.settle(); stage.settle();
        await frames();
        const clearPasses = passes.length;
        passes.length = 0; await frames();
        const clearCached = passes.length;
        home.setTimeMode('night'); stage.settle(); await frames();
        const nightBefore = snapshot(); await frames(); const nightAfter = snapshot();
        home.setTimeMode('day'); stage.settle(); await frames();
        restore.reverse().forEach(restoreMethod => restoreMethod());
        window.__welcomeProbe = { frames, snapshot, counts, deltas, watch };
        return { before, after, waitingCounts, cachedPasses, cadence, invalidations, rain, snow, clearPasses, clearCached,
          nightBefore, nightAfter, stats, planar: !!pipeline && stage.quality.ultra };
      });
      for (const key of ['camera', 'player', 'grass', 'worldTime', 'fire', 'detail', 'sky']) {
        assert.deepEqual(result.before[key], result.after[key], `${view.name}: frozen ${key}`);
      }
      assert.notDeepEqual(result.before.clouds, result.after.clouds, 'Clouds drift while waiting');
      assert.ok(result.after.water > result.before.water, 'Water animates while waiting');
      assert.ok(result.waitingCounts.view > 0, 'Camera-dependent LOD still updates');
      for (const [name, count] of Object.entries(result.waitingCounts)) {
        if (name !== 'view') assert.equal(count, 0, `${name} is paused while waiting`);
      }
      assert.equal(result.cachedPasses, 0, 'Static welcome reuses reflection');
      assert.equal(result.rain.visible, true);
      assert.ok(result.rain.after.rain > result.rain.before.rain, 'Rain animates while waiting');
      assert.ok(result.rain.after.water > result.rain.before.water);
      assert.equal(result.rain.reflections, 0);
      assert.equal(result.snow.visible, true);
      assert.ok(result.snow.after > result.snow.before, 'Snow animates while waiting');
      assert.deepEqual(result.nightBefore.sky, result.nightAfter.sky, 'Other sky animation stays frozen');
      assert.notDeepEqual(result.nightBefore.clouds, result.nightAfter.clouds);
      if (result.planar) {
        assert.ok(result.cadence >= 5 && result.cadence <= 7, 'Uncached reflection runs every other frame');
        for (const [name, count] of Object.entries(result.invalidations)) assert.equal(count, 1, `${name} refreshes the reflection once`);
        assert.ok(result.clearPasses >= 1 && result.clearPasses <= 2, 'Returning to clear refreshes reflection and the returning sun shadow');
      }
      assert.equal(result.clearCached, 0);
      if (!ultra) {
        await page.locator('[data-welcome-quality]').click();
        await page.locator('#qualityCancel').click();
      }
      assert.equal(await page.evaluate(() => __home.welcome.active && !__home.welcome.entering), true);
      await page.setViewportSize({ width: view.viewport.width + 20, height: view.viewport.height });
      await page.evaluate(() => __welcomeProbe.frames());
      assert.equal(await page.evaluate(() => __home.welcome.active), true);
      await page.screenshot({ path: fileURLToPath(new URL(`${view.name}-${ultra ? 'ultra' : 'normal'}.png`, output)) });
      const restored = await page.evaluate(async () => {
        const probe = __welcomeProbe;
        for (const name of ['player', 'rig', 'extras', 'atmosphere', 'portal']) probe.watch(__home[name], 'update', name);
        __home.pets.forEach((pet, index) => probe.watch(pet, 'update', `pet${index}`));
        const before = probe.snapshot();
        document.querySelector('[data-welcome-enter]').click();
        await probe.frames(12);
        return { before, after: probe.snapshot(), counts: probe.counts, deltas: probe.deltas, entering: __home.welcome.entering };
      });
      assert.equal(restored.entering, true);
      assert.notDeepEqual(restored.before.camera, restored.after.camera, 'Camera descent runs during welcome fade');
      assert.ok(restored.after.worldTime > restored.before.worldTime);
      for (const [name, count] of Object.entries(restored.counts)) assert.ok(count > 0, `${name} resumes on enter`);
      assert.ok(restored.deltas.every(delta => delta > 0 && delta <= 0.05), 'No catch-up simulation after waiting');
      await page.evaluate(() => {
        __home.rig.skipIntro();
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
      });
      await page.waitForFunction(() => !__home.welcome.active);
      assert.equal(await page.locator('#hud').evaluate(hud => hud.hidden), false);
      assert.deepEqual(errors, []);
      report.push({ view: view.name, ultra, ...result, restored });
      console.log(`PASS ${view.name} ${ultra ? 'ultra' : 'normal'}: environment alive, actors frozen, reflection cache valid, entry resumes; ${result.stats.calls} calls/${result.stats.triangles} tris`);
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2));
}
