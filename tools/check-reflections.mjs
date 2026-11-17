import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/reflections/', import.meta.url);
mkdirSync(output, { recursive: true });
const hardware = process.env.REFLECTION_GPU === 'hardware';
const args = hardware ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = { renderer: `${hardware ? 'Browser default GPU' : 'SwiftShader'}; pass counts only, not real-device timing`, runs: [] };
const views = [
  { name: 'desktop', viewport: { width: 1280, height: 800 }, screen: { width: 1920, height: 1080 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
].filter(view => !process.env.REFLECTION_VIEW || view.name === process.env.REFLECTION_VIEW);
assert.ok(views.length, 'REFLECTION_VIEW must be desktop or phone');

try {
  for (const view of views) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource:')) errors.push(message.text());
    });
    try {
      const url = new URL(base); url.searchParams.set('ultra', '1');
      await page.goto(url.href, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
      await page.evaluate(() => __home.world.hdMaterialsReady);
      await page.evaluate(() => {
        document.querySelector('[data-welcome-enter]')?.click();
        __home.rig.skipIntro();
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
      });
      await page.waitForFunction(() => !__home.welcome?.active);
      const result = await page.evaluate(async () => {
        const { DataUtils, HalfFloatType } = await import('three');
        const home = __home, stage = home.stage, renderer = stage.renderer, camera = stage.camera, pipeline = stage.pipeline;
        const water = stage.scene.getObjectByName('pool-water'), uniforms = water.material.uniforms;
        const detail = home.world.qinIsland.distanceDetail;
        const counts = () => [...detail.meshes, ...detail.proxyMeshes].map(mesh => mesh.count);
        home.weather.dispose(); home.rig.skipIntro(); home.player.teleport(0.5, 18);
        home.setTimeMode('day'); home.setWeatherMode('clear'); home.weatherFx.settle(); stage.settle();
        const original = renderer.render;
        let passes = [], failReflection = false;
        renderer.render = function(scene, viewCamera) {
          const beforeCalls = this.info.render.calls, beforeTriangles = this.info.render.triangles;
          const label = scene === stage.scene ? viewCamera === camera ? 'main' : 'reflection'
            : viewCamera.isOrthographicCamera ? 'post' : 'water-depth';
          if (label === 'reflection' && failReflection) throw new Error('reflection-restore-test');
          const qinCounts = label === 'main' || label === 'reflection' ? counts() : null;
          const value = original.call(this, scene, viewCamera);
          passes.push({ label, calls: this.info.render.calls - beforeCalls, triangles: this.info.render.triangles - beforeTriangles, qinCounts });
          return value;
        };
        function frame() {
          passes = []; renderer.shadowMap.needsUpdate = false; stage.render();
          return { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
            reflectionOn: uniforms.uReflectOn?.value || 0, passes: passes.map(pass => ({ ...pass })) };
        }
        function aim(position, target) {
          camera.position.set(...position); camera.lookAt(...target); camera.updateMatrixWorld(); home.extras.qinIsland.updateDetail();
        }
        function compareCoastalOcclusion() {
          if (!stage.quality.ultra) return null;
          const coastal = home.extras.reflectionDetail, begin = coastal.beginReflection, end = coastal.endReflection;
          const clock = performance.now, fixedTime = performance.now();
          const sources = new Set([...detail.meshes, ...detail.proxyMeshes]), callbacks = [];
          let submitted = 0;
          stage.scene.traverse(mesh => {
            if (!mesh.isInstancedMesh || !sources.has(mesh.userData.reflectionSource || mesh)) return;
            const before = mesh.onBeforeRender;
            callbacks.push([mesh, before]);
            mesh.onBeforeRender = function(renderer, scene, viewCamera, ...args) {
              if (viewCamera !== camera) submitted += this.count;
              return before.call(this, renderer, scene, viewCamera, ...args);
            };
          });
          function capture() {
            submitted = 0;
            const frames = [frame(), frame()], target = pipeline.targets.scene;
            if (target.texture.type !== HalfFloatType) throw new Error('Expected a half-float scene target');
            const pixels = new Uint16Array(target.width * target.height * 4);
            renderer.readRenderTargetPixels(target, 0, 0, target.width, target.height, pixels);
            return { frames, instances: submitted, pixels };
          }
          try {
            performance.now = () => fixedTime;
            aim([34, 12, 18], [160, 7, 10]); frame(); frame();
            const filtered = capture();
            const repeated = capture();
            coastal.beginReflection = () => {}; coastal.endReflection = () => {};
            const unfiltered = capture();
            let differingPixels = 0, foregroundWaterDifferingPixels = 0, maxDifference = 0, controlDifferingPixels = 0, controlMaxDifference = 0;
            const changed = new Uint8Array(filtered.pixels.length / 4);
            for (let offset = 0; offset < filtered.pixels.length; offset += 4) {
              let difference = 0, controlDifference = 0;
              for (let channel = 0; channel < 3; channel++) {
                difference = Math.max(difference, Math.abs(DataUtils.fromHalfFloat(filtered.pixels[offset + channel]) - DataUtils.fromHalfFloat(unfiltered.pixels[offset + channel])));
                controlDifference = Math.max(controlDifference, Math.abs(DataUtils.fromHalfFloat(filtered.pixels[offset + channel]) - DataUtils.fromHalfFloat(repeated.pixels[offset + channel])));
              }
              if (difference > 1 / 255) {
                differingPixels++; changed[offset / 4] = 1;
                if (offset < filtered.pixels.length / 4) foregroundWaterDifferingPixels++;
              }
              maxDifference = Math.max(maxDifference, difference);
              if (controlDifference > 1 / 255) controlDifferingPixels++;
              controlMaxDifference = Math.max(controlMaxDifference, controlDifference);
            }
            const images = {};
            if (differingPixels) for (const [name, pixels] of [['filtered', filtered.pixels], ['unfiltered', unfiltered.pixels], ['difference', filtered.pixels]]) {
              const canvas = document.createElement('canvas'); canvas.width = pipeline.targets.scene.width; canvas.height = pipeline.targets.scene.height;
              const context = canvas.getContext('2d'), image = context.createImageData(canvas.width, canvas.height);
              for (let pixel = 0; pixel < pixels.length / 4; pixel++) {
                const output = ((canvas.height - 1 - Math.floor(pixel / canvas.width)) * canvas.width + pixel % canvas.width) * 4;
                for (let channel = 0; channel < 3; channel++) image.data[output + channel] = name === 'difference'
                  ? changed[pixel] && channel === 0 ? 255 : 0
                  : Math.min(255, Math.pow(Math.max(0, DataUtils.fromHalfFloat(pixels[pixel * 4 + channel])), 1 / 2.2) * 255);
                image.data[output + 3] = 255;
              }
              context.putImageData(image, 0, 0); images[name] = canvas.toDataURL('image/png');
            }
            return { filtered: { frames: filtered.frames, instances: filtered.instances },
              unfiltered: { frames: unfiltered.frames, instances: unfiltered.instances }, differingPixels, foregroundWaterDifferingPixels,
              pixels: filtered.pixels.length / 4, maxDifference, controlDifferingPixels, controlMaxDifference, images };
          } finally {
            performance.now = clock;
            coastal.beginReflection = begin; coastal.endReflection = end;
            for (const [mesh, before] of callbacks) mesh.onBeforeRender = before;
          }
        }
        try {
          pipeline.setWeather({ rain: 0, snow: 0, fog: 0, haze: 0, cloud: 0 });
          aim([0, 12, 35], [160, 7, 0]);
          frame(); frame();
          const qin = Array.from({ length: 4 }, frame);
          const mainCounts = counts(), begin = detail.beginReflection, end = detail.endReflection;
          const coastal = home.extras.reflectionDetail, coastalBegin = coastal?.beginReflection, coastalEnd = coastal?.endReflection;
          let baseline;
          try {
            detail.beginReflection = () => {}; detail.endReflection = () => {};
            if (coastal) { coastal.beginReflection = () => {}; coastal.endReflection = () => {}; }
            baseline = Array.from({ length: 2 }, frame);
          } finally {
            detail.beginReflection = begin; detail.endReflection = end;
            if (coastal) { coastal.beginReflection = coastalBegin; coastal.endReflection = coastalEnd; }
          }
          const restoredCounts = counts();
          const coastalOcclusion = compareCoastalOcclusion();
          aim([122, 8, 44], [132, 3, 30]);
          const shore = Array.from({ length: 2 }, frame), shoreCounts = counts();
          aim([270, 12, 20], [170, 7, 0]);
          const east = Array.from({ length: 2 }, frame);
          aim([0, 12, 35], [160, 7, 0]);
          let failureRestored = true;
          if (stage.quality.ultra) {
            const visible = [];
            stage.scene.traverse(object => visible.push([object, object.visible]));
            pipeline.setWeather({ rain: 1 }); frame(); pipeline.setWeather({ rain: 0 });
            failReflection = true;
            try { frame(); failureRestored = false; }
            catch (error) { if (error.message !== 'reflection-restore-test') throw error; }
            finally { failReflection = false; }
            failureRestored &&= counts().every((count, index) => count === mainCounts[index])
              && visible.every(([object, value]) => object.visible === value);
            frame();
          }
          aim([0, 12, 35], [0, 100, 35]);
          const sky = Array.from({ length: 4 }, frame);
          aim([0, 12, 35], [160, 7, 0]);
          const returnToWater = frame();
          water.visible = false; const hidden = frame(); water.visible = true;
          const returnFromHidden = frame();
          const layers = water.layers.mask; water.layers.mask = 0; const excludedLayer = frame(); water.layers.mask = layers;
          const returnFromLayer = frame();
          pipeline.setWeather({ rain: 1 }); const rain = frame();
          pipeline.setWeather({ rain: 0 }); const returnFromRain = frame();
          aim([0, -1, 35], [160, 7, 0]); const underwater = frame();
          aim([0, 12, 35], [160, 7, 0]); frame();
          const originalRatio = renderer.getPixelRatio();
          stage.setPixelRatio(originalRatio > 1 ? 1 : 1.25);
          const resize = frame(); stage.setPixelRatio(originalRatio);
          return { quality: { mobile: stage.quality.mobile, planar: !!stage.quality.ultra }, hd: home.world.hdMaterials,
            baseline, mainCounts, restoredCounts, coastalOcclusion, shore, shoreCounts, east, failureRestored,
            qin, sky, returnToWater, hidden, returnFromHidden, excludedLayer, returnFromLayer,
            rain, returnFromRain, underwater, resize };
        } finally { renderer.render = original; }
      });
      const reflection = frame => frame.passes.filter(pass => pass.label === 'reflection');
      if (result.coastalOcclusion) {
        for (const [name, data] of Object.entries(result.coastalOcclusion.images)) writeFileSync(new URL(`${view.name}-coastal-${name}.png`, output), Buffer.from(data.split(',')[1], 'base64'));
        delete result.coastalOcclusion.images;
      }
      report.runs.push({ view: view.name, ...result });
      writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2));
      const hasNoReflection = frame => reflection(frame).length === 0 && frame.reflectionOn === 0;
      assert.ok(result.sky.every(hasNoReflection), 'Offscreen water must never render a reflection');
      assert.ok(result.sky.every(frame => !frame.passes.some(pass => pass.label === 'water-depth' && pass.calls > 0)), 'Offscreen water must skip the depth draw');
      for (const key of ['hidden', 'excludedLayer', 'rain', 'underwater']) assert.ok(hasNoReflection(result[key]), key);
      if (result.quality.planar) {
        const optimized = result.qin.flatMap(reflection)[0], baseline = result.baseline.flatMap(reflection)[0];
        assert.ok(optimized.triangles < baseline.triangles * 0.75, 'Distant Qin reflection must reduce submitted geometry by at least 25%');
        assert.deepEqual(result.restoredCounts, result.mainCounts, 'Reflection must restore main counts');
        assert.ok(result.failureRestored, 'Reflection failure must restore mesh visibility and counts');
        const coastal = result.coastalOcclusion;
        assert.ok(coastal.filtered.instances < coastal.unfiltered.instances * 0.5, 'Oblique reflection rays must cull hidden inland Qin instances');
        assert.equal(coastal.foregroundWaterDifferingPixels, 0, 'Land culling must preserve foreground sea reflections');
        assert.ok(coastal.differingPixels <= coastal.pixels * 0.0001 && coastal.maxDifference < 0.12, 'Culling may only change isolated subpixel land seams, not reflection silhouettes');
        assert.ok(coastal.controlDifferingPixels <= coastal.pixels * 0.0001, 'The frozen reference frames must remain stable');
        const filteredCoast = coastal.filtered.frames.flatMap(reflection)[0], unfilteredCoast = coastal.unfiltered.frames.flatMap(reflection)[0];
        assert.ok(filteredCoast.calls <= unfilteredCoast.calls, 'Land culling must not add reflection draw calls');
        assert.ok(filteredCoast.triangles < unfilteredCoast.triangles, 'Land culling must reduce submitted reflection triangles');
        for (const frame of result.qin) {
          assert.deepEqual(frame.passes.find(pass => pass.label === 'main').qinCounts, result.mainCounts);
          assert.ok(frame.calls <= Math.max(...result.baseline.map(value => value.calls)), 'Reflection must not add draw calls');
          assert.ok(frame.triangles <= Math.max(...result.baseline.map(value => value.triangles)), 'Reflection must not increase triangles');
        }
        for (const pass of result.shore.flatMap(reflection)) assert.deepEqual(pass.qinCounts, result.shoreCounts, 'Near-shore reflection must keep full detail');
        assert.ok(result.east.some(frame => reflection(frame).length === 1), 'East-coast reflections must remain visible');
        assert.ok(result.qin.some(frame => reflection(frame).length === 1), 'Desktop Qin must retain reflections');
        assert.ok(result.qin.some(frame => reflection(frame).length === 0), 'Reflections must keep the existing half-rate cadence');
        for (const key of ['returnToWater', 'returnFromHidden', 'returnFromLayer', 'returnFromRain', 'resize']) {
          assert.equal(reflection(result[key]).length, 1, `${key}: refresh before reusing a stale reflection`);
          assert.equal(result[key].reflectionOn, 1, key);
        }
      } else {
        assert.ok(result.qin.every(hasNoReflection), 'Phone must not enable desktop planar reflections');
      }
      assert.deepEqual(errors, []);
      console.log(`${view.name}: Qin ${result.qin.map(frame => `${frame.calls} calls/${frame.triangles} tris`).join(', ')}; offscreen reflection calls 0`);
      await page.evaluate(() => {
        const home = __home;
        home.rig.showcase([0, 12, 35], [160, 7, 0]);
        for (let frame = 0; frame < 90; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.updateDetail(); home.stage.render();
        home.stage.render = () => {};
      });
      await page.screenshot({ path: fileURLToPath(new URL(`${view.name}-qin.png`, output)), timeout: 90000 });
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2));
}
