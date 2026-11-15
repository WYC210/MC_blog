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
    { name: 'normal', viewport: { width: 1280, height: 800 }, ultra: false },
    { name: 'ultra-desktop', viewport: { width: 1280, height: 800 }, ultra: true },
    { name: 'ultra-phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3, ultra: true },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error' && /THREE|shader|GLSL|WebGL|SyntaxError|TypeError/.test(message.text())) errors.push(message.text());
    });
    const url = new URL(base); url.searchParams.set('ultra', view.ultra ? '1' : '0'); url.searchParams.set('debug', '');
    await page.goto(url.href);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.evaluate(() => {
      __home.rig.skipIntro(); __home.setTimeMode('day'); __home.setWeatherMode('clear');
      __home.stage.settle(); __home.weatherFx.settle();
    });
    const details = await page.evaluate(() => {
      const home = __home, ground = home.ultraGround;
      const flags = home.world.qinIsland.root.getObjectByName('ultra-flags');
      const labels = home.world.qinIsland.root.getObjectByName('qin-inscriptions');
      const fire = home.world.ultraProps.getObjectByName('ultra-fires');
      if (!ground) return { normal: !flags && !fire && !home.world.materials.box.userData.ultraGround };
      const image = ground.drift.material.uniforms.uSandMap.value.image;
      let sand = 0, grass = 0, path = 0;
      for (let index = 0; index < image.data.length; index += 4) {
        sand += image.data[index] > 0; grass += image.data[index + 1] > 0; path += image.data[index + 2] > 0;
      }
      return { sand, grass, path, flags: flags.userData.flags.length, flagVertices: flags.geometry.attributes.position.count,
        textVertices: labels.geometry.attributes.aCloth.count, emitters: fire.userData.emitters.length,
        fireParticles: fire.geometry.instanceCount, windParticles: ground.drift.geometry.instanceCount,
        materialFamilies: [...new Set(ground.uniforms.uGroundMaterials.value.image.data.filter((value, index) => index % 4 === 0))] };
    });
    if (view.ultra) {
      assert.ok(details.sand > 100 && details.grass > 100 && details.path > 100);
      assert.equal(details.flags, 7); assert.ok(details.flagVertices > 1000 && details.textVertices > 1000);
      assert.ok(details.emitters >= 2 && details.materialFamilies.length >= 9);
    } else assert.equal(details.normal, true);
    const measurements = [];
    for (const shot of [
      { name: 'beach', player: [-9.2, 21], camera: [-7, 1.65, 26.8], look: [-9.2, 0.55, 23] },
      { name: 'qin-flags', player: [112, 30], camera: [106, 3.4, 34], look: [110, 3.5, 26] },
      { name: 'qin-grass', player: [126, 45], camera: [126, 1.8, 45], look: [132, 0.5, 36] },
    ]) {
      await page.evaluate(shot => {
        __home.player.teleport(...shot.player); __home.rig.showcase(shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
        __home.extras.qinIsland.updateDetail();
      }, shot);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: fileURLToPath(new URL(`${view.name}-${shot.name}.png`, output)) });
      measurements.push({ shot: shot.name, ...await page.evaluate(() => __home.stats()) });
    }
    if (view.ultra) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
      const before = await page.evaluate(() => __home.ultraGround.uniforms.uGroundTime.value);
      await page.waitForTimeout(600);
      const still = await page.evaluate(() => ({ time: __home.ultraGround.uniforms.uGroundTime.value,
        wind: __home.ultraGround.uniforms.uGroundWind.value, drift: __home.ultraGround.drift.visible }));
      assert.equal(still.time, before); assert.equal(still.wind, 0); assert.equal(still.drift, false);
    }
    assert.deepEqual(errors, []);
    report.push({ view: view.name, details, measurements });
    console.log(`${view.name}: ${JSON.stringify(details)}; ${measurements.map(stats => `${stats.shot} ${stats.calls} calls/${stats.triangles} triangles`).join(', ')}`);
    await context.close();
  }
  writeFileSync(new URL('ultra-details-report.json', output), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
