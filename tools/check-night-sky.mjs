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
    await page.goto(base);
    await page.waitForFunction(() => window.__home?.world || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);

    const initial = await page.evaluate(() => {
      const home = __home;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
      home.setTimeMode('night');
      home.setWeatherMode('clear');
      home.stage.settle();
      home.rig.showcase(innerWidth < 600 ? [-30, 5, 60] : [-50, 7, 64], innerWidth < 600 ? [-12, 26, -8] : [0, 30, -4]);
      for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      const uniforms = home.stage.sky.material.uniforms;
      const before = uniforms.uSkyMotion.value.toArray();
      home.stage.update(0.5);
      return {
        size: [uniforms.uSkyNoise.value.image.width, uniforms.uSkyNoise.value.image.height],
        motion: uniforms.uSkyMotion.value.toArray().map((value, index) => value - before[index]),
        ambient: home.stage.hemi.intensity,
      };
    });
    assert.deepEqual(initial.size, [128, 128]);
    assert.ok(initial.motion.every(value => value > 0), 'clear nights animate the sky');
    assert.equal(initial.ambient, 1.15, 'the ground lighting stays unchanged');
    await page.waitForTimeout(1000);
    await page.screenshot({ path: fileURLToPath(new URL(`night-sky-${view.name}.png`, output)) });
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= stats.budget.calls, `${view.name}: draw call budget`);
    assert.ok(stats.triangles <= stats.budget.triangles, `${view.name}: triangle budget`);
    assert.equal(stats.lights, 0, 'no extra real-time lights');

    const rendered = await page.evaluate(async () => {
      const THREE = await import('three');
      const stage = __home.stage;
      const target = new THREE.WebGLRenderTarget(192, 128);
      const scene = new THREE.Scene();
      const sky = stage.sky.clone();
      sky.position.set(0, 0, 0);
      scene.add(sky);
      const camera = new THREE.PerspectiveCamera(65, 1.5, 0.1, 600);
      camera.lookAt(20, 38, -70);
      const pixels = new Uint8Array(192 * 128 * 4);
      const previous = stage.renderer.getRenderTarget();
      const uniforms = sky.material.uniforms;
      const cover = uniforms.uCover.value;
      const horizon = uniforms.uHorizonOffset.value.clone();
      uniforms.uCover.value = 0;
      uniforms.uHorizonOffset.value.set(0, 0, 0);
      const draw = () => {
        stage.renderer.setRenderTarget(target);
        stage.renderer.render(scene, camera);
        stage.renderer.readRenderTargetPixels(target, 0, 0, 192, 128, pixels);
        return new Uint8Array(pixels);
      };
      try {
        const night = draw();
        uniforms.uNight.value = 0;
        const withoutStars = draw();
        let changed = 0, energy = 0;
        for (let offset = 0; offset < night.length; offset += 4) {
          const difference = Math.abs(night[offset] - withoutStars[offset])
            + Math.abs(night[offset + 1] - withoutStars[offset + 1])
            + Math.abs(night[offset + 2] - withoutStars[offset + 2]);
          if (difference > 6) changed++;
          energy += difference;
        }
        uniforms.uNight.value = 1;
        uniforms.uCloud.value = 1;
        const cloudy = draw();
        uniforms.uNight.value = 0;
        const cloudyWithoutStars = draw();
        const weatherDifference = cloudy.reduce((sum, value, index) => sum + Math.abs(value - cloudyWithoutStars[index]), 0);
        uniforms.uNight.value = 1;
        uniforms.uCloud.value = 0;
        camera.lookAt(0, 0, -1);
        const flatHorizon = draw();
        uniforms.uHorizonOffset.value.set(0, 0, -80.32 / 200);
        const raisedHorizon = draw();
        let horizonChanged = 0, belowSeaChanged = 0;
        for (let row = 0; row < 60; row++) for (let column = 24; column < 168; column++) {
          const offset = (row * 192 + column) * 4;
          const difference = Math.abs(flatHorizon[offset] - raisedHorizon[offset])
            + Math.abs(flatHorizon[offset + 1] - raisedHorizon[offset + 1])
            + Math.abs(flatHorizon[offset + 2] - raisedHorizon[offset + 2]);
          if (row >= 38 && difference > 6) horizonChanged++;
          if (row < 12 && difference > 0) belowSeaChanged++;
        }
        return { changed, energy, weatherDifference, horizonChanged, belowSeaChanged };
      } finally {
        uniforms.uNight.value = 1;
        uniforms.uCloud.value = 0;
        uniforms.uCover.value = cover;
        uniforms.uHorizonOffset.value.copy(horizon);
        stage.renderer.setRenderTarget(previous);
        target.dispose();
      }
    });
    assert.ok(rendered.changed > 2000, 'the galaxy contributes visible detail, not just a handful of stars');
    assert.ok(rendered.energy > 100000, 'the night sky is visibly different');
    assert.equal(rendered.weatherDifference, 0, 'full cloud cover hides stars and galaxy');
    assert.ok(rendered.horizonChanged > 2000, `high-altitude sky replaces the blank band below the eye-level horizon (${rendered.horizonChanged} changed pixels)`);
    assert.equal(rendered.belowSeaChanged, 0, 'the region behind the visible sea still blends into fog, not stars');

    for (const weather of ['rain', 'fog', 'overcast', 'snow']) {
      const state = await page.evaluate(weather => {
        __home.setWeatherMode(weather);
        __home.stage.settle();
        const uniforms = __home.stage.sky.material.uniforms;
        const before = uniforms.uSkyMotion.value.toArray();
        __home.stage.update(0.5);
        return { veil: __home.stage.veil, frozen: uniforms.uSkyMotion.value.toArray().every((value, index) => value === before[index]) };
      }, weather);
      assert.equal(state.veil, 1, `${weather}: the sky is occluded`);
      assert.equal(state.frozen, true, `${weather}: invisible sky animation stops`);
      if (weather === 'overcast') {
        await page.waitForTimeout(250);
        await page.screenshot({ path: fileURLToPath(new URL(`night-sky-${view.name}-overcast.png`, output)) });
      }
    }
    const day = await page.evaluate(() => {
      __home.setWeatherMode('clear');
      __home.setTimeMode('day');
      __home.stage.settle();
      const before = __home.stage.sky.material.uniforms.uSkyMotion.value.toArray();
      __home.stage.update(0.5);
      return { night: __home.stage.night, before, after: __home.stage.sky.material.uniforms.uSkyMotion.value.toArray() };
    });
    assert.equal(day.night, 0);
    assert.deepEqual(day.after, day.before, 'daylight does not animate invisible stars');
    await page.waitForTimeout(500);
    await page.screenshot({ path: fileURLToPath(new URL(`night-sky-${view.name}-day.png`, output)) });

    const meteor = await page.evaluate(() => {
      __home.setTimeMode('night');
      __home.stage.settle();
      return __home.extras.nightNature.previewShower();
    });
    assert.equal(meteor, true, 'the original meteor shower still works');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
    const reduced = await page.evaluate(() => {
      __home.setTimeMode('night');
      __home.stage.settle();
      const motion = __home.stage.sky.material.uniforms.uSkyMotion.value;
      const before = motion.toArray();
      __home.stage.update(1);
      return { before, after: motion.toArray(), meteor: __home.extras.nightNature.previewShower() };
    });
    assert.deepEqual(reduced.after, reduced.before, 'reduced motion freezes drift and twinkle');
    assert.equal(reduced.meteor, false, 'reduced motion still disables meteors');
    await page.evaluate(() => {
      __home.stage.setWeather({ cloud: 0 });
      __home.stage.settle();
      __home.rig.showcase([0, 60, 0], [20, 94, -70]);
      for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
    });
    await page.waitForTimeout(500);
    await page.screenshot({ path: fileURLToPath(new URL(`night-sky-${view.name}-detail.png`, output)) });
    for (const height of [20, 60, 120]) {
      const horizon = await page.evaluate(height => {
        __home.setWeatherMode('clear');
        __home.stage.settle();
        __home.rig.showcase([0, height, -105], [0, height - 28, 0]);
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
        __home.stage.setClearance(0);
        __home.stage.render();
        return {
          shift: __home.stage.sky.material.uniforms.uHorizonOffset.value.length(),
          expected: (height + 0.32) / __home.stage.scene.fog.far,
          intro: __home.rig.introActive,
        };
      }, height);
      assert.equal(horizon.intro, false, 'flight checks must not use the intro camera extended draw distance');
      assert.ok(Math.abs(horizon.shift - horizon.expected) < 1e-9, 'the horizon follows camera height and fog distance');
      await page.waitForTimeout(350);
      await page.screenshot({ path: fileURLToPath(new URL(`night-sky-${view.name}-height-${height}.png`, output)) });
      const flightStats = await page.evaluate(() => __home.stats());
      assert.ok(flightStats.calls <= flightStats.budget.calls, `${view.name} ${height}m: draw call budget`);
      assert.ok(flightStats.triangles <= flightStats.budget.triangles, `${view.name} ${height}m: triangle budget`);
    }
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${stats.calls} calls, ${stats.triangles} triangles; galaxy pixels, weather, daylight, reduced motion and 20/60/120m horizons passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
