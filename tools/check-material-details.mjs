import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/materials/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = { renderer: 'SwiftShader; structural checks, not real-phone timing', visualReview: 'pending-user', budgetPolicy: 'normal-only', runs: [] };
const views = [
  { name: 'desktop', viewport: { width: 1280, height: 800 } },
  { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
].filter(view => !process.env.MATERIAL_VIEW || view.name === process.env.MATERIAL_VIEW);
assert.ok(views.length, 'MATERIAL_VIEW must be desktop or phone');
let failed = false;

async function focus(page, position, look, player) {
  await page.evaluate(({ position, look, player }) => {
    const home = __home;
    home.player.teleport(...player);
    home.rig.showcase(position, look);
    for (let frame = 0; frame < 90; frame++) home.rig.update(1 / 60, home.player);
    home.extras.qinIsland.updateDetail(); home.stage.settle(); home.stage.render();
  }, { position, look, player });
  await page.waitForTimeout(350);
}

try {
  for (const view of views) for (const ultra of [false, true]) {
    const context = await browser.newContext(view), page = await context.newPage();
    const run = { view: view.name, ultra, errors: [], knownIssues: [], stats: [], screenshots: [] };
    report.runs.push(run);
    page.on('pageerror', error => run.errors.push(error.stack));
    page.on('console', message => {
      if (message.type() !== 'error') return;
      if (/Failed to load resource:/.test(message.text())) return;
      run.errors.push(message.text());
    });
    page.on('response', response => {
      if (response.status() < 400) return;
      const issue = `${response.status()} ${response.url()}`;
      if (new URL(response.url()).pathname === '/engine/assets/homecraft-logo.png') run.knownIssues.push(issue);
      else run.errors.push(issue);
    });
    page.on('requestfailed', request => {
      const issue = `${request.failure()?.errorText} ${request.url()}`;
      if (request.url().startsWith('https://homecraft.terryhu.cn/worlds.json')) run.knownIssues.push(issue);
      else if (!request.failure()?.errorText.includes('ERR_ABORTED')) run.errors.push(issue);
    });
    try {
      const url = new URL(base); url.searchParams.set('ultra', ultra ? '1' : '0');
      await page.goto(url.href, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
      run.initial = await page.evaluate(() => ({ error: window.__homeStartupError, mode: new URLSearchParams(location.search).get('ultra'),
        standard: __home.world.materials.box.isMeshStandardMaterial === true, probe: __home.extras.materialProbe?.stats || null,
        review: !!__home.world.materialReview }));
      assert.ok(!run.initial.error, JSON.stringify(run.initial.error));
      assert.equal(run.initial.mode, ultra ? '1' : '0'); assert.equal(run.initial.standard, ultra);
      assert.equal(run.initial.review, false); assert.equal(!!run.initial.probe, ultra);
      await page.evaluate(() => { __home.weather.dispose(); __home.rig.skipIntro(); __home.setTimeMode('day'); __home.setWeatherMode('clear'); __home.weatherFx.settle(); __home.stage.settle(); });
      for (const shot of [
        { name: 'beach', position: [-7, 1.65, 26.8], look: [-9.2, 0.55, 23], player: [-9.2, 21] },
        { name: 'island', position: [-2, 38, 87], look: [0, 8, 12], player: [0.5, 18] },
        { name: 'qin', position: [122, 8, 44], look: [132, 3, 30], player: [126, 40] },
      ]) {
        await focus(page, shot.position, shot.look, shot.player);
        const stats = await page.evaluate(() => __home.stats()); run.stats.push({ shot: shot.name, ...stats });
        if (!ultra) { assert.ok(stats.calls <= 60, `${shot.name}: ${stats.calls} calls`); assert.ok(stats.triangles <= 200000, `${shot.name}: ${stats.triangles} triangles`); }
        const filename = `${view.name}-${ultra ? 'ultra' : 'normal'}-${shot.name}.png`;
        await page.screenshot({ path: fileURLToPath(new URL(filename, output)) }); run.screenshots.push(filename);
      }
      run.details = await page.evaluate(() => {
        const home = __home, world = home.world, texture = home.environmentDetails?.texture;
        let sand = 0, grass = 0, shore = 0;
        if (texture) for (let index = 0; index < texture.image.data.length; index += 4) {
          if (texture.image.data[index]) sand++;
          if (texture.image.data[index + 2]) grass++;
          if (texture.image.data[index + 3]) shore++;
        }
        return { sand, grass, shore, wood: world.grid.types.find(type => type?.name === 'g_oak').tex.all,
          timber: world.grid.types.find(type => type?.name === 'l_sdoak').tex,
          profile: world.materials.box.userData.surfaceDetails?.version,
          layers: world.tiles.texture.image.depth, dataMatches: world.tiles.data === world.tiles.texture.image.data,
          invalidLayers: (() => {
            let invalid = 0;
            home.stage.scene.traverse(object => {
              for (const name of ['iLayers', 'tileLayer']) {
                const attribute = object.geometry?.getAttribute(name);
                if (attribute) for (const value of attribute.array) if (!Number.isFinite(value) || value < 0 || value >= world.tiles.texture.image.depth) invalid++;
              }
            });
            return invalid;
          })() };
      });
      assert.equal(run.details.wood, 'surface_wood'); assert.equal(run.details.timber.top, 'surface_endgrain'); assert.equal(run.details.dataMatches, true);
      assert.equal(run.details.invalidLayers, 0);
      if (ultra) {
        assert.equal(run.details.profile, 2); assert.ok(run.details.sand > 100 && run.details.grass > 100 && run.details.shore > 10);
        await page.evaluate(() => { __home.setWeatherMode('rain'); __home.weatherFx.settle(); __home.stage.settle(); });
        await page.waitForTimeout(400);
        run.rain = await page.evaluate(() => ({ wet: __home.environmentDetails.uniforms.uDetailWet.value, probe: __home.extras.materialProbe.stats }));
        assert.ok(run.rain.wet > 0);
        await page.evaluate(() => { __home.setTimeMode('night'); __home.stage.settle(); __home.extras.materialProbe.update(3); });
        run.nightProbe = await page.evaluate(() => __home.extras.materialProbe.stats);
        assert.ok(run.nightProbe.captures > run.initial.probe.captures);
        await page.emulateMedia({ reducedMotion: 'reduce' });
        const before = await page.evaluate(() => __home.environmentDetails.uniforms.uDetailTime.value);
        await page.waitForTimeout(300);
        assert.equal(await page.evaluate(() => __home.environmentDetails.uniforms.uDetailTime.value), before);
        await page.emulateMedia({ reducedMotion: 'no-preference' });
        const reviewUrl = new URL(base); reviewUrl.searchParams.set('ultra', '1'); reviewUrl.searchParams.set('materials', '1');
        await page.goto(reviewUrl.href, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__home?.world.materialReview || window.__homeStartupError, null, { timeout: 120000 });
        await page.evaluate(() => { __home.weather.dispose(); __home.setTimeMode('day'); __home.setWeatherMode('clear'); __home.weatherFx.settle(); __home.stage.settle(); });
        run.samples = await page.evaluate(() => __home.world.materialReview.samples);
        assert.deepEqual(run.samples.map(sample => sample.id), ['wood', 'stone', 'sand', 'metal', 'cloth', 'rope']);
        for (const id of ['overview', ...run.samples.map(sample => sample.id)]) {
          await page.evaluate(({ id, portrait }) => {
            __home.world.materialReview.focus(id, __home.rig, portrait);
            for (let frame = 0; frame < 90; frame++) __home.rig.update(1 / 60, __home.player);
            __home.stage.render();
          }, { id, portrait: view.isMobile === true });
          await page.waitForTimeout(250);
          const filename = `${view.name}-sample-${id}.png`;
          await page.screenshot({ path: fileURLToPath(new URL(filename, output)) }); run.screenshots.push(filename);
        }
        for (const condition of [{ name: 'rain', time: 'day', weather: 'rain' }, { name: 'night', time: 'night', weather: 'clear' }]) {
          await page.evaluate(condition => {
            __home.setTimeMode(condition.time); __home.setWeatherMode(condition.weather);
            __home.weatherFx.settle(); __home.stage.settle(); __home.extras.materialProbe.update(3);
            __home.world.materialReview.focus('metal', __home.rig);
            for (let frame = 0; frame < 90; frame++) __home.rig.update(1 / 60, __home.player);
            __home.stage.render();
          }, condition);
          await page.waitForTimeout(350);
          const filename = `${view.name}-sample-metal-${condition.name}.png`;
          await page.screenshot({ path: fileURLToPath(new URL(filename, output)) }); run.screenshots.push(filename);
        }
      }
      assert.deepEqual(run.errors, []);
      console.log(`${view.name}/${ultra ? 'ultra (no budget cap)' : 'normal'}: ${run.stats.map(stats => `${stats.shot} ${stats.calls} calls/${stats.triangles} tris`).join('; ')}`);
    } catch (error) { run.failure = error.stack; failed = true; console.error(`${view.name}/${ultra}: ${error.message}`); }
    finally { await context.close(); writeFileSync(new URL('report.json', output), JSON.stringify(report, null, 2)); }
  }
} finally { await browser.close(); }
console.log(`Screenshots await user review: ${fileURLToPath(output)}`);
process.exitCode = failed ? 1 : 0;
