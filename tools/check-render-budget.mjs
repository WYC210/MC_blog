import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
const frames = Number(process.env.RENDER_FRAMES || 24);
assert.ok(Number.isInteger(frames) && frames >= 4, 'RENDER_FRAMES must be an integer >= 4');
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = { renderer: 'SwiftShader; structural regression only, not real-phone performance', frames, runs: [] };
const views = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, screen: { width: 1920, height: 1080 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
].filter(view => !process.env.RENDER_VIEW || view.name === process.env.RENDER_VIEW);
assert.ok(views.length, 'RENDER_VIEW must be desktop or phone');

async function measure(page) {
  return page.evaluate(async count => {
    const home = __home, stage = home.stage, extras = home.extras;
    const render = stage.render, update = extras.update, gl = stage.renderer.getContext();
    const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const pending = [], gpuMs = [], updateMs = [], submissionMs = [], intervals = [], draws = [];
    let last = 0, disjoint = false;
    function poll() {
      if (!extension) return;
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) disjoint = true;
      while (pending.length && gl.getQueryParameter(pending[0], gl.QUERY_RESULT_AVAILABLE)) {
        const query = pending.shift();
        if (!disjoint) gpuMs.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
        gl.deleteQuery(query);
      }
    }
    try {
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Render sampling timed out')), 120000);
        extras.update = function(...values) {
          const start = performance.now();
          try { return update.apply(this, values); }
          finally { updateMs.push(performance.now() - start); }
        };
        stage.render = function() {
          poll();
          const start = performance.now();
          if (last) intervals.push(start - last);
          last = start;
          const query = extension ? gl.createQuery() : null;
          if (query) gl.beginQuery(extension.TIME_ELAPSED_EXT, query);
          try { render.call(this); }
          finally {
            if (query) { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push(query); }
          }
          submissionMs.push(performance.now() - start);
          draws.push({ calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles });
          if (submissionMs.length >= count) {
            stage.render = render; extras.update = update;
            clearTimeout(timeout); resolve();
          }
        };
      });
      for (let attempt = 0; pending.length && attempt < 120; attempt++) {
        await new Promise(resolve => requestAnimationFrame(resolve)); poll();
      }
      function summary(values) {
        const sorted = [...values].sort((left, right) => left - right);
        const percentile = fraction => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : null;
        return { samples: sorted.length, median: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99) };
      }
      return {
        frameIntervalMs: summary(intervals), extrasUpdateMs: summary(updateMs), renderSubmissionMs: summary(submissionMs),
        gpuMs: summary(disjoint ? [] : gpuMs), gpuDisjoint: disjoint, gpuPending: pending.length, gpuTimerSupported: !!extension,
        over33ms: intervals.filter(value => value > 33.3).length / Math.max(1, intervals.length),
        maxCalls: Math.max(...draws.map(draw => draw.calls)), maxTriangles: Math.max(...draws.map(draw => draw.triangles)),
      };
    } finally {
      stage.render = render; extras.update = update;
      for (const query of pending) gl.deleteQuery(query);
    }
  }, frames);
}

try {
  for (const view of views) {
    const pair = [];
    for (const mode of ['off', 'on']) {
      const context = await browser.newContext(view), page = await context.newPage(), errors = [];
      await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
        route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      const url = new URL(base); url.searchParams.set('qin-lod', mode); url.searchParams.set('lang', 'zh');
      const start = Date.now();
      await page.goto(url.href);
      await page.waitForFunction(() => window.__home?.extras?.coaster || window.__homeStartupError, null, { timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
      const bootMs = Date.now() - start;
      const initial = await page.evaluate(mobile => {
        const home = __home, detail = home.world.qinIsland.distanceDetail;
        home.weather.dispose(); home.rig.recenter(home.player);
        home.setTimeMode('day'); home.setWeatherMode('clear'); home.weatherFx.settle(); home.stage.settle();
        home.stage.setPixelRatio(mobile ? 1.25 : 1);
        home.stage.setPixelRatio = () => {};
        function hash(array) {
          let value = 2166136261;
          const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
          for (const byte of bytes) value = Math.imul(value ^ byte, 16777619);
          return value >>> 0;
        }
        function snapshot() {
          const staticMeshes = detail.meshes.filter(mesh => mesh.castShadow);
          const source = staticMeshes.map(mesh => ({
            capacity: mesh.instanceMatrix.count, count: mesh.count,
            matrixHash: hash(mesh.instanceMatrix.array), colorHash: hash(mesh.instanceColor.array),
            matrixVersion: mesh.instanceMatrix.version, colorVersion: mesh.instanceColor.version,
          }));
          return {
            source, proxied: detail.proxied, distant: detail.distant, errorPixels: detail.errorPixels,
            sourceInstances: staticMeshes.reduce((sum, mesh) => sum + mesh.count, 0),
            proxyInstances: detail.proxyMeshes.reduce((sum, mesh) => sum + mesh.count, 0),
            actorTags: detail.meshes.flatMap(mesh => mesh.userData.tags.map((tag, index) =>
              tag?.startsWith('qin-retinue:') || tag?.startsWith('qin-wanderer:') ? `${index}:${tag}` : null).filter(Boolean)),
            stats: home.stats(), width: home.stage.renderer.domElement.width, height: home.stage.renderer.domElement.height,
          };
        }
        function shot(position, target, player = [0, 6], floor = 0) {
          home.player.teleport(...player, { floor }); home.rig.recenter(home.player);
          home.rig.showcase(position, target); home.rig.update(3, home.player);
          home.extras.update(0); home.stage.settle(); home.stage.render(); home.stage.render();
          return snapshot();
        }
        window.__renderTest = { shot, snapshot };
        const proxyBytes = detail.proxyMeshes.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength
          + mesh.instanceColor.array.byteLength + mesh.geometry.index.array.byteLength
          + Object.values(mesh.geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0), 0);
        return { proxy: detail.proxy, proxyBytes, source: snapshot().source };
      }, !!view.isMobile);
      const run = { view: view.name, mode, bootMs, initial, shots: [] };
      const shots = [
        { name: 'far', position: [-60, 35, 20], target: [160, 7, 0] },
        { name: 'far-front', position: [160, 80, 210], target: [160, 6, -15] },
        { name: 'far-side', position: [-60, 60, -42], target: [160, 6, -32] },
        { name: 'far-back', position: [160, 70, -230], target: [160, 6, -32] },
        { name: 'overview', position: [-84, 100, 116], target: [0, 6, 4] },
        { name: 'near', position: [160, 18, 70], target: [160, 7, -20] },
        { name: 'interior', position: [160, 5, -23], target: [160, 5, -44], player: [160, -23], floor: 3 },
        { name: 'far-night', position: [-60, 35, 20], target: [160, 7, 0], night: true },
      ];
      for (const shot of shots) {
        const result = await page.evaluate(shot => {
          __home.setTimeMode(shot.night ? 'night' : 'day'); __home.stage.settle();
          return __renderTest.shot(shot.position, shot.target, shot.player, shot.floor);
        }, shot);
        const timing = shot.name === 'far' ? await measure(page) : null;
        if (timing) assert.ok(timing.maxCalls <= 60 && timing.maxTriangles <= 200000, 'Sampled frames must stay within budget');
        await page.screenshot({ path: fileURLToPath(new URL(`render-${view.name}-${mode}-${shot.name}.png`, output)) });
        assert.ok(result.stats.calls <= 60 && result.stats.triangles <= 200000, `${view.name}/${mode}/${shot.name}: ${JSON.stringify(result.stats)}`);
        assert.ok(!(result.sourceInstances && result.proxyInstances), 'Source and proxy must not draw simultaneously');
        if (['near', 'interior'].includes(shot.name)) {
          assert.equal(result.proxied, false); assert.equal(result.distant, false);
          assert.deepEqual(result.source.map(mesh => mesh.count), initial.source.map(mesh => mesh.capacity));
        }
        if (shot.name === 'far') assert.equal(result.proxied, mode === 'on');
        run.shots.push({ name: shot.name, ...result, timing });
      }
      if (mode === 'on') {
        const checks = await page.evaluate(() => {
          const home = __home, stage = home.stage, detail = home.world.qinIsland.distanceDetail;
          home.setTimeMode('day'); stage.settle();
          const far = () => __renderTest.shot([-60, 35, 20], [160, 7, 0]);
          const before = far(), transitions = [];
          for (let repeat = 0; repeat < 8; repeat++) {
            stage.camera.position.set(160, 18, 70); stage.camera.lookAt(160, 7, -20); home.extras.qinIsland.updateDetail();
            transitions.push(!detail.proxied && !detail.distant);
            stage.camera.position.set(-60, 35, 20); stage.camera.lookAt(160, 7, 0); home.extras.qinIsland.updateDetail();
            transitions.push(detail.proxied);
          }
          const originalFov = stage.camera.fov;
          stage.camera.fov = 15; stage.camera.updateProjectionMatrix(); home.extras.qinIsland.updateDetail();
          const zoomRestored = !detail.proxied;
          stage.camera.fov = originalFov; stage.camera.updateProjectionMatrix(); home.extras.qinIsland.updateDetail();
          const after = __renderTest.snapshot();
          const mesh = detail.meshes.find(mesh => mesh.castShadow), shadowCounts = [];
          const callback = mesh.onBeforeShadow;
          mesh.onBeforeShadow = function(...values) { callback.apply(this, values); shadowCounts.push(this.count); };
          try { stage.renderer.shadowMap.needsUpdate = true; stage.render(); }
          finally { mesh.onBeforeShadow = callback; }
          const shadowRestored = mesh.count === 0;
          const lookoutUpdate = home.extras.lookout.update;
          home.extras.lookout.update = () => { stage.camera.position.set(160, 5, -23); stage.camera.lookAt(160, 5, -44); };
          try { home.extras.update(0); } finally { home.extras.lookout.update = lookoutUpdate; }
          const lateCameraRestored = !detail.proxied && !detail.distant;
          far(); home.player.teleport(160, -23, { floor: 3 }); home.extras.qinIsland.updateDetail();
          const playerRestored = !detail.proxied && !detail.distant;
          far();
          return { before, after, transitions, zoomRestored, shadowCounts, shadowRestored, lateCameraRestored, playerRestored };
        });
        assert.ok(checks.transitions.every(Boolean), 'Rapid near/far transitions must update immediately');
        assert.ok(checks.zoomRestored && checks.lateCameraRestored && checks.playerRestored, 'Force and final-camera overrides');
        assert.ok(checks.shadowRestored && checks.shadowCounts.length > 0, 'Real shadow pass must restore main count');
        assert.ok(checks.shadowCounts.every(count => count === initial.source[0].capacity), 'Full original shadow geometry');
        assert.deepEqual(checks.before.source, checks.after.source, 'No static buffer changes or uploads while changing LOD');
        run.checks = checks;
        if (view.isMobile) {
          await page.setViewportSize({ width: 844, height: 390 });
          const landscape = await page.evaluate(() => {
            __home.stage.resize(); return __renderTest.shot([-60, 35, 20], [160, 7, 0]);
          });
          assert.equal(landscape.proxied, true);
          await page.screenshot({ path: fileURLToPath(new URL('render-phone-on-landscape.png', output)) });
          run.landscape = landscape;
        }
      }
      assert.deepEqual(errors, []);
      pair.push(run); report.runs.push(run);
      writeFileSync(new URL('render-budget-report.json', output), JSON.stringify(report, null, 2));
      console.log(`${view.name}/${mode}: far ${run.shots[0].sourceInstances + run.shots[0].proxyInstances} static instances, ${run.shots[0].stats.calls} calls; proxy buffers ${initial.proxyBytes} bytes`);
      await context.close();
    }
    const [baseline, optimized] = pair;
    for (const name of ['near', 'interior']) {
      const before = baseline.shots.find(shot => shot.name === name), after = optimized.shots.find(shot => shot.name === name);
      assert.deepEqual(after.source, before.source, `${view.name}/${name}: detailed buffers and counts must match`);
      assert.deepEqual(after.actorTags, before.actorTags, `${view.name}/${name}: actor indices must match`);
    }
    const before = baseline.shots[0], after = optimized.shots[0];
    assert.ok(after.proxyInstances < before.sourceInstances, 'Proxy must reduce the existing far representation');
    const saved = (before.sourceInstances - after.proxyInstances) * 12;
    console.log(`${view.name}: saves ${saved} Qin static triangles (${((1 - after.proxyInstances / before.sourceInstances) * 100).toFixed(1)}%); near geometry and actor indices identical`);
  }
} finally {
  await browser.close();
}
