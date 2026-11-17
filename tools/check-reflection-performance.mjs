import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const baseline = process.env.REFLECTION_BASELINE && readFileSync(resolve(process.env.REFLECTION_BASELINE), 'utf8');
const rounds = Number(process.env.REFLECTION_ROUNDS || 3);
const frames = Number(process.env.REFLECTION_FRAMES || 120);
assert.ok(Number.isInteger(rounds) && rounds > 0 && Number.isInteger(frames) && frames >= 30);
const output = new URL('./.check/reflection-performance/', import.meta.url);
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report = { created: new Date().toISOString(), frames, rounds, baseline: process.env.REFLECTION_BASELINE || null,
  notes: 'Hardware GPU queries; CPU rendering excludes simulation updates. Moving cases advance world extras then move the camera. Not an RTX 3050 or gameplay FPS benchmark.', runs: [] };
const save = () => writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2));
const shots = [
  { name: 'home-overview', position: [0, 28, 65], target: [0, 6, 0] },
  { name: 'home-to-qin', position: [0, 12, 35], target: [160, 7, 0] },
  { name: 'qin-shore', position: [122, 8, 44], target: [132, 3, 30] },
  { name: 'qin-east', position: [270, 12, 20], target: [170, 7, 0] },
];
try {
  for (let round = 0; round < rounds; round++) for (const variant of baseline ? ['before', 'after', 'before-repeat'] : ['after']) {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, screen: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    try {
      const page = await context.newPage(), errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error' && !message.text().includes('Failed to load resource')) errors.push(message.text()); });
      if (variant !== 'after') await page.route('**/world/reflection-detail.js', route => route.fulfill({ contentType: 'application/javascript', body: baseline }));
      await page.addInitScript(() => {
        window.__reflectionRAF = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = callback => window.__reflectionPaused ? 0 : window.__reflectionRAF(callback);
      });
      await page.goto(new URL('?ultra=1', base).href, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
      await page.evaluate(() => __home.world.hdMaterialsReady);
      await page.evaluate(() => { document.querySelector('[data-welcome-enter]')?.click(); __home.rig.skipIntro(); });
      await page.waitForTimeout(3000);
      await page.evaluate(() => { window.__reflectionPaused = true; });
      await page.waitForTimeout(100);
      const info = await page.evaluate(() => {
        const home = __home, stage = home.stage, renderer = stage.renderer, gl = renderer.getContext();
        const debug = gl.getExtension('WEBGL_debug_renderer_info'), timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        const device = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unknown';
        if (!timer || /SwiftShader|llvmpipe|software/i.test(device)) throw new Error('Hardware GPU timer required; software timings are not accepted');
        home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.weatherFx.settle(); stage.settle(); stage.setPixelRatio(1.5);
        const detail = home.extras.reflectionDetail, original = detail.beginReflection;
        let culling = 0, refreshed = false;
        detail.beginReflection = function(...values) {
          const start = performance.now(); refreshed = true;
          try { return original.apply(this, values); } finally { culling = performance.now() - start; }
        };
        const summarize = values => {
          if (!values.length) return null;
          const sorted = [...values].sort((left, right) => left - right);
          return { count: values.length, mean: values.reduce((sum, value) => sum + value, 0) / values.length,
            median: sorted[Math.floor(sorted.length * 0.5)], p95: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] };
        };
        const waitFrame = () => new Promise(done => window.__reflectionRAF(done));
        window.__reflectionMeasure = async (shot, moving, count) => {
          const rows = [], pending = [], cpu = [], intervals = [], filters = [], calls = [], triangles = [], refreshCpu = [], ordinaryCpu = [];
          let previous = 0;
          const aim = frame => {
            if (moving) home.extras.update(1 / 60);
            stage.camera.position.set(shot.position[0] + (moving ? Math.sin(frame * 0.04) * 6 : 0), shot.position[1], shot.position[2] + (moving ? Math.cos(frame * 0.04) * 2 : 0));
            stage.camera.lookAt(...shot.target); stage.camera.updateMatrixWorld(); home.extras.qinIsland.updateDetail();
          };
          for (let warm = 0; warm < 24; warm++) { aim(warm); stage.render(); await waitFrame(); }
          const collect = () => {
            if (gl.getParameter(timer.GPU_DISJOINT_EXT)) throw new Error('Disjoint GPU timer; retry the run');
            for (let index = pending.length - 1; index >= 0; index--) {
              const entry = pending[index];
              if (!gl.getQueryParameter(entry.query, gl.QUERY_RESULT_AVAILABLE)) continue;
              entry.row.gpu = gl.getQueryParameter(entry.query, gl.QUERY_RESULT) / 1000000;
              gl.deleteQuery(entry.query); pending.splice(index, 1);
            }
          };
          for (let frame = 0; frame < count; frame++) {
            const timestamp = await waitFrame();
            if (previous) intervals.push(timestamp - previous); previous = timestamp;
            aim(frame); culling = 0; refreshed = false;
            const query = gl.createQuery(); gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
            const start = performance.now(); stage.render(); const elapsed = performance.now() - start;
            gl.endQuery(timer.TIME_ELAPSED_EXT);
            const row = { refreshed, gpu: null }; rows.push(row); pending.push({ query, row });
            cpu.push(elapsed); (refreshed ? refreshCpu : ordinaryCpu).push(elapsed);
            if (refreshed) filters.push(culling);
            calls.push(renderer.info.render.calls); triangles.push(renderer.info.render.triangles); collect();
          }
          const deadline = performance.now() + 10000;
          while (pending.length && performance.now() < deadline) { await waitFrame(); collect(); }
          if (pending.length) throw new Error('GPU query timeout');
          return { shot: shot.name, moving, cpu: summarize(cpu), refreshCpu: summarize(refreshCpu), ordinaryCpu: summarize(ordinaryCpu),
            culling: summarize(filters), gpu: summarize(rows.map(row => row.gpu)), refreshGpu: summarize(rows.filter(row => row.refreshed).map(row => row.gpu)),
            intervals: summarize(intervals), calls: summarize(calls), triangles: summarize(triangles), buffer: [renderer.domElement.width, renderer.domElement.height],
            samples: stage.pipeline.targets.scene.samples, cacheBufferBytes: detail.cacheBufferBytes ?? null };
        };
        return { device, hd: home.world.hdMaterials };
      });
      const run = { round, variant, info, shots: [] }; report.runs.push(run);
      for (const shot of shots) for (const moving of [false, true]) {
        const result = await page.evaluate(({ shot, moving, frames }) => __reflectionMeasure(shot, moving, frames), { shot, moving, frames });
        run.shots.push(result); save();
        console.log(`${round}/${variant}/${shot.name}/${moving ? 'moving' : 'static'}: CPU ${result.cpu.mean.toFixed(2)} ms, filter ${result.culling?.mean.toFixed(2)} ms, GPU ${result.gpu.mean.toFixed(2)} ms`);
      }
      assert.deepEqual(errors, []); run.errors = errors; save();
    } finally { await context.close(); }
  }
} finally { await browser.close(); }
