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
    const context = await browser.newContext(view);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async volume => {
      const THREE = await import('three');
      const home = __home, player = home.player, park = home.world.qinIsland;
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      const walks = [];
      function walk(column, row) {
        const accepted = player.goTo(column, row);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target: [column, row], accepted, flew, distance: Math.hypot(player.pos.x - column, player.pos.z - row) });
      }
      for (const column of [104.5, 112, 119.5]) {
        player.teleport(column, 48); walk(column, 39); walk(column, 48);
      }
      player.teleport(112, 39);
      for (const [column, row] of [[112, 33], [112, 28.7], [112, 25], [114.5, 25], [119.2, 25], [119.2, 28.9], [112, 28.7], [104.9, 28.9], [104.9, 25], [112, 25], [112, 33], [112, 39]]) walk(column, row);
      const walls = [];
      for (const [column, row] of [[103, 25], [121, 25], [112, 19], [106.35, 29.8], [117.65, 29.8]]) {
        for (const height of [0, 1, 2.5, 4]) walls.push({ column, row, height, solid: park.site.collides(column, height, row) });
      }
      park.root.updateMatrixWorld(true);
      const doorway = [];
      for (const column of [110.5, 112, 113.5]) for (const height of [0.6, 1.7, 2.6]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, height, 33), new THREE.Vector3(0, 0, -1), 0, 4.5);
        doorway.push({ column, height, clear: ray.intersectObject(park.root, true).length === 0 });
      }
      const tags = new Set();
      park.root.traverse(mesh => { for (const tag of mesh.userData.tags || []) if (tag) tags.add(tag); });
      const furniture = [[107.2, 23.4], [116.8, 26.6], [107.85, 24.45], [116.15, 27.65], [112, 21.1]];
      const illumination = [];
      for (const position of [[112, 2, 20.8], [106.55, 1.1, 24.45], [107.85, 1.1, 27.65], [116.15, 1.1, 24.45], [117.45, 1.1, 27.65]]) {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      const signs = park.root.getObjectByName('qin-inscriptions');
      const titles = [];
      for (const [text, origin, target] of [
        ['战国风情', [112, 3.5, 53], [112, 5.32, 44.43]],
        ['稷下学宫', [112, 3, 37], [112, 3.6, 31.38]],
        ['百家争鸣', [112, 3.1, 28], [112, 3.15, 19.5]],
      ]) {
        const start = new THREE.Vector3(...origin), end = new THREE.Vector3(...target);
        const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end) + 0.2);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ text, visible: hit?.object === signs && signs.userData.labels[Math.floor(hit.faceIndex / 2)]?.text === text });
      }
      return { walks, walls, doorway, titles, illumination,
        pupils: [...tags].filter(tag => tag.startsWith('qin-jixia:pupil-')).length,
        desks: [...tags].filter(tag => tag.startsWith('qin-jixia:desk-')).length,
        furnitureSolid: furniture.every(([column, row]) => park.site.collides(column, 0, row)),
        lamps: park.bakes.filter(light => /^qin-(jixia|seven)-/.test(light.id)).length };
    }, QIN_LIGHT_VOLUME);
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.walls.every(wall => wall.solid), JSON.stringify(checks.walls));
    assert.ok(checks.doorway.every(ray => ray.clear), JSON.stringify(checks.doorway));
    assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.equal(checks.pupils, 8); assert.equal(checks.desks, 4); assert.equal(checks.lamps, 10);
    assert.ok(checks.furnitureSolid);
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    await page.evaluate(() => __home.player.teleport(112, 25));
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '战国风情');
    if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
    const panel = page.locator('#panel[data-station="qin-seven"][open]');
    await panel.waitFor();
    assert.ok((await panel.locator('.about-text[lang="zh-CN"]').innerText()).includes('八位学生'));
    await panel.locator('.lang-switch').click();
    assert.ok((await panel.locator('.about-text[lang="en"]').innerText()).includes('eight pupils'));
    assert.equal(await panel.locator('.about-text[lang="zh-CN"]').isVisible(), false);
    await panel.locator('.close').click();
    const shots = [
      { name: 'gateway', camera: [128, 10, 59], portrait: [130, 14, 73], look: [112, 3.6, 35], player: [112, 39] },
      { name: 'facade', camera: [121, 4.5, 38], portrait: [112, 3.6, 37.5], look: [112, 2.5, 25], player: [114, 34] },
      { name: 'lecture', camera: [114.3, 2.8, 27.5], look: [112, 1.7, 20.8], player: [114, 28.5] },
      { name: 'pupils', camera: [112.5, 2.6, 22.8], look: [116.8, 0.9, 26.4], player: [112, 28.5] },
      { name: 'west', camera: [97, 5, 23], look: [105, 2.5, 25], player: [99, 28] },
      { name: 'rear', camera: [112, 5, 12], look: [112, 2.5, 21], player: [112, 14] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(...shot.player); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone && shot.portrait ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-academy-${shot.name}-${time}-${view.name}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
      measurements.push({ shot: shot.name, time, ...stats });
    }
    assert.deepEqual(errors, []);
    report.push({ view: view.name, checks, measurements });
    console.log(`${view.name}: ${checks.walks.length} walks, sealed walls, clear entrance/titles, 8 pupils/4 desks, bilingual interaction, baked lighting; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-academy-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
