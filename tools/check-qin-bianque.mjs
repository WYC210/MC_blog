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
    const context = await browser.newContext(view), page = await context.newPage(), errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async volume => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const parts = [];
      park.root.traverse(mesh => {
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!tag?.startsWith('qin-bianque:')) continue;
          const matrix = new THREE.Matrix4(), color = new THREE.Color();
          mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld); mesh.getColorAt(index, color);
          parts.push({ role: tag.split(':')[1], feature: tag.split(':')[2], position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
            size: new THREE.Vector3().setFromMatrixScale(matrix).toArray(), tint: color.getHex(),
            luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, emissive: mesh.geometry.getAttribute('iEmissive').getX(index) });
        }
      });
      const faces = parts.filter(part => part.feature === 'face'), illumination = [], sightlines = [];
      for (const face of faces) {
        const cell = face.position.map((value, axis) => Math.floor((value - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ role: face.role, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
        for (const origin of [[129, 3.5, 28], [133, 3.6, 26]]) {
          const start = new THREE.Vector3(...origin), end = new THREE.Vector3(...face.position);
          const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end) + 0.25);
          const hit = ray.intersectObject(park.root, true)[0];
          sightlines.push({ role: face.role, origin, first: hit?.object.userData.tags?.[hit.instanceId] || hit?.object.name });
        }
      }
      const wrist = parts.find(part => part.feature === 'wrist');
      const contact = parts.filter(part => part.feature === 'pulse-finger').map(part => Math.hypot(...part.position.map((value, axis) => value - wrist.position[axis])));
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      player.teleport(129, 28);
      for (const target of [[124, 28], [124, 24], [124, 17.5], [133.5, 17.5], [133.5, 24.5], [133.5, 28], [129, 28]]) {
        const accepted = player.goTo(...target);
        let flew = false, collided = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
          collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
        }
        walks.push({ target, accepted, flew, collided, distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const solids = [[127.95, 20.8], [129.5, 22.4], [131.65, 20.7], [129.65, 19.35], [126.2, 22.82], [128.99, 21.45]]
        .map(([column, row]) => park.site.collides(column, 0, row));
      const signs = park.root.getObjectByName('qin-inscriptions').userData.labels.filter(label => label.text === '扁鹊行医');
      return { parts, illumination, sightlines, contact, walks, solids, signs, lamps: park.bakes.filter(light => light.id.startsWith('qin-bianque-')).length };
    }, QIN_LIGHT_VOLUME);
    for (const time of ['day', 'night']) {
      await page.evaluate(time => { __home.setTimeMode(time); __home.stage.settle(); }, time);
      for (const shot of [
        { name: 'front', camera: view.hasTouch ? [135, 5.5, 31.8] : [133.2, 4.3, 29.5], look: [128.8, 1.05, 22.15] },
        { name: 'pulse', camera: [130, 3.15, 24.4], look: [128.55, 1.2, 21.35] },
        { name: 'patient', camera: [132.4, 3.3, 23.7], look: [130.13, 1.14, 22.33] },
      ]) {
        await page.evaluate(shot => {
          __home.rig.showcase(shot.camera, shot.look);
          for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
        }, shot);
        await page.waitForTimeout(350);
        measurements.push(await page.evaluate(() => __home.stats()));
        await page.screenshot({ path: fileURLToPath(new URL(`qin-bianque-${view.name}-${time}-${shot.name}.png`, output)) });
      }
    }
    assert.equal(checks.parts.filter(part => part.feature === 'face').length, 3);
    assert.equal(checks.parts.filter(part => part.feature === 'eye').length, 6);
    assert.equal(checks.contact.length, 3);
    assert.ok(checks.contact.every(distance => distance < 0.13), JSON.stringify(checks.contact));
    assert.equal(checks.parts.filter(part => part.feature === 'drawer').length, 9);
    for (const feature of ['wrist-cushion', 'mortar', 'pestle', 'leaf', 'medicine-bowl', 'herb-packet']) assert.ok(checks.parts.some(part => part.feature === feature), feature);
    assert.ok(checks.parts.filter(part => part.feature === 'face').every(part => part.luminance > 0.6 && part.emissive === 0));
    assert.ok(checks.parts.filter(part => part.role === 'patient' && part.feature === 'eye').every(part => part.size[2] > part.size[0] * 3 && part.position[1] > 1.26));
    assert.ok(checks.parts.filter(part => ['doctor', 'patient', 'assistant'].includes(part.role)).every(part => part.emissive === 0));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    assert.ok(checks.sightlines.every(sight => sight.first?.startsWith(`qin-bianque:${sight.role}:`)), JSON.stringify(checks.sightlines));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.solids.every(Boolean));
    assert.equal(checks.signs.length, 1);
    assert.equal(checks.lamps, 3);
    await page.evaluate(() => __home.player.teleport(129, 28));
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '扁鹊行医');
    if (view.hasTouch) await page.locator('#prompt').tap();
    else await page.keyboard.press('f');
    const panel = page.locator('#panel[data-station="qin-bianque"][open]');
    await panel.waitFor();
    for (const language of ['zh-CN', 'en']) {
      assert.equal(await panel.locator('.about-text:visible').count(), 1);
      assert.ok(await panel.locator(`.about-text[lang="${language}"]`).isVisible());
      const text = await panel.locator(`.about-text[lang="${language}"]`).innerText();
      assert.ok(text.includes(language === 'en' ? 'three fingers' : '三指搭脉'));
      await page.screenshot({ path: fileURLToPath(new URL(`qin-bianque-${view.name}-${language}-guide.png`, output)) });
      if (view.hasTouch) await panel.locator('.lang-switch').tap();
      else await panel.locator('.lang-switch').click();
    }
    if (view.hasTouch) await panel.locator('.close').tap();
    else await panel.locator('.close').click();
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, checks, measurements });
    console.log(`${view.name}: doctor/patient/attendant; pulse contact; upward-facing eyes; herbs and nine drawers; 7 walks; F/touch bilingual guide; day/night views; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-bianque-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
