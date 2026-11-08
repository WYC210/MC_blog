import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_LIGHT_VOLUME } from '../world/qin-island-layout.js';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = [];
try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async volume => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      function walk(column, row) {
        const accepted = player.goTo(column, row);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target: [column, row], accepted, flew, distance: Math.hypot(player.pos.x - column, player.pos.z - row) });
      }
      for (const column of [146, 160, 174]) {
        player.teleport(column, 71);
        for (const row of [62, 56, 49, 56, 62, 71]) walk(column, row);
      }
      player.teleport(136, 69);
      for (const target of [[160, 69], [184, 69], [184, 62], [184, 49], [174, 49], [160, 49], [146, 49], [136, 49], [136, 62]]) walk(...target);
      const passages = [];
      for (const column of [145, 146, 147, 157, 160, 163, 173, 174, 175]) for (const height of [0.55, 1.7, 2.8]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, height, 61), new THREE.Vector3(0, 0, -1), 0, 10);
        passages.push({ column, height, clear: ray.intersectObject(park.root, true).length === 0 });
      }
      const signs = park.root.getObjectByName('qin-inscriptions');
      const titles = [];
      for (const face of [-1, 1]) for (const column of [156.3, 160, 163.7]) for (const height of [8.6, 9.7]) {
        const origin = new THREE.Vector3(column, 1.8, 56 + face * 14), target = new THREE.Vector3(column, height, 56 + face * 3.06);
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.2);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ face, column, height, visible: hit?.object === signs && signs.userData.labels[Math.floor(hit.faceIndex / 2)]?.text === '秦皇求仙入海处' });
      }
      const parts = [];
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!tag?.startsWith('qin-gate:')) continue;
          const color = new THREE.Color(); mesh.getColorAt(index, color);
          parts.push({ tag, luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, emissive: mesh.geometry.getAttribute('iEmissive').getX(index) });
        }
      });
      const illumination = [];
      for (const position of [[152, 5, 59.2], [168, 5, 59.2], [152, 12.5, 58.5], [168, 12.5, 58.5], [141, 2.6, 66.5], [179, 2.6, 66.5], [160, 2, 56]]) {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      const towersSolid = [141, 152, 168, 179].every(column => [0, 2, 4].every(height => park.site.collides(column, height, 56)));
      return { walks, passages, titles, illumination, towersSolid,
        guardiansSolid: [141, 179].every(column => park.site.collides(column, 0, 65.2) && park.site.collides(column, 2, 65.2)),
        heads: parts.filter(part => part.tag.endsWith(':head')).length,
        eyes: parts.filter(part => part.tag.endsWith(':eye')),
        wings: parts.filter(part => part.tag.endsWith(':wing')).length,
        corbels: parts.filter(part => part.tag === 'qin-gate:corbel').length,
        capitals: parts.filter(part => part.tag === 'qin-gate:capital').length,
        lamps: park.bakes.filter(light => light.id.startsWith('qin-gate-')).length };
    }, QIN_LIGHT_VOLUME);
    const shots = [
      { name: 'front', camera: [160, 9, 112], portrait: [160, 10, 143], look: [160, 6.5, 56] },
      { name: 'approach', camera: [160, 1.8, 70], portrait: [160, 3.6, 95], look: [160, 7.5, 56] },
      { name: 'detail', camera: [174, 10, 72], portrait: [180, 11, 80], look: [163, 9.6, 56] },
      { name: 'guardian', camera: [144, 3.4, 70], portrait: [145, 3.7, 72], look: [141, 1.9, 65.2] },
      { name: 'passage', camera: [160, 2.1, 60], portrait: [160, 2.1, 62], look: [160, 2.4, 51] },
      { name: 'rear', camera: [160, 6, 40.5], portrait: [160, 11, 25], look: [160, 7.5, 56] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(163, 69); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-gateway-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements });
    writeFileSync(new URL('qin-gateway-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.passages.every(ray => ray.clear), JSON.stringify(checks.passages));
    assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    assert.ok(checks.towersSolid && checks.guardiansSolid);
    assert.equal(checks.heads, 2); assert.equal(checks.eyes.length, 4); assert.equal(checks.wings, 20);
    assert.ok(checks.eyes.every(eye => eye.luminance < 0.2 && eye.emissive === 0));
    assert.equal(checks.capitals, 16); assert.ok(checks.corbels > 100); assert.equal(checks.lamps, 16);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    await page.evaluate(() => __home.player.teleport(160, 63));
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '秦风阙门');
    if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
    const panel = page.locator('#panel[data-station="qin-gate"][open]');
    await panel.waitFor();
    assert.equal(await panel.locator('.about-text[lang="en"]').isVisible(), false);
    await panel.locator('.lang-switch').click();
    assert.equal(await panel.locator('.about-text[lang="zh-CN"]').isVisible(), false);
    assert.ok((await panel.locator('.about-text[lang="en"]').innerText()).includes('three walk-through gates'));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.walks.length} walks, 3 clear gates, front/back signs, 2 detailed guardians, ${checks.corbels} corbels, baked lights, bilingual F/touch; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
