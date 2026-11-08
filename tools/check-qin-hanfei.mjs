import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_HANFEI, QIN_COURTYARD, QIN_LIGHT_VOLUME, QIN_STATE_FLAGS, QIN_WARRIORS, QIN_ISLAND, QIN_STATIONS, qinLandAt } from '../world/qin-island-layout.js';

const roofFront = QIN_HANFEI.z + (QIN_HANFEI.depth + 4) / 2;
assert.ok(QIN_COURTYARD.z0 - 0.6 - roofFront >= 10, 'Leave at least ten metres between the eaves and the courtyard wall');
for (const column of [101.5, 112, 122.5]) for (const offset of [-6.5, -5.5, 6.5]) assert.ok(qinLandAt(column, QIN_HANFEI.z + offset));
assert.ok(QIN_HANFEI.z - 7 - QIN_ISLAND.z0 >= 15, 'The hall needs breathing room before the north coast');
assert.ok(19 - QIN_WARRIORS.baseZ - 2.6 < 10, 'Close the excessive academy-to-sculpture gap');
assert.ok(QIN_WARRIORS.baseZ - 2.6 - QIN_COURTYARD.z1 < 16, 'Close the excessive sculpture-to-courtyard gap');
const flag = QIN_STATE_FLAGS.find(item => item.attraction === 'qin-hanfei');
assert.equal(flag.z, QIN_HANFEI.z + 10);
const station = QIN_STATIONS.find(item => item.id === 'qin-hanfei');
assert.ok(station);
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
    const checks = await page.evaluate(async ({ volume, shift, stations, courtyard, hall }) => {
      const THREE = await import('three'), home = __home, player = home.player, park = home.world.qinIsland;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const walls = [];
      for (const [column, row] of [[102, -64], [122, -64], [112, -69], [105.8, -60.2], [118.2, -60.2]].map(([column, row]) => [column, row + shift])) {
        for (const height of [0, 1.2, 2.7, 4.2]) walls.push({ column, row, height, solid: park.site.collides(column, height, row) });
      }
      const entrance = [];
      for (const column of [110.5, 112, 113.5]) for (const height of [0.6, 1.7, 2.8]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, height, -57 + shift), new THREE.Vector3(0, 0, -1), 0, 4.5);
        entrance.push({ column, height, clear: ray.intersectObject(park.root, true).length === 0 });
      }
      const parts = [];
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!tag?.startsWith('qin-hanfei:')) continue;
          const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
          parts.push({ tag, position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray() });
        }
      });
      const faces = parts.filter(part => part.tag.endsWith('-face'));
      const illumination = faces.map(face => {
        const cell = face.position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        return { tag: face.tag, energy: park.lighting.texture.image.data[offset] / 255 * 4 };
      });
      const signs = park.root.getObjectByName('qin-inscriptions');
      const titles = [];
      for (const [target, origin] of [[[112, 3.65, -58.55], [112, 2.8, -51]], [[112, 3.25, -68.5], [112, 2.3, -61.5]]]) {
        const start = new THREE.Vector3(origin[0], origin[1], origin[2] + shift), end = new THREE.Vector3(target[0], target[1], target[2] + shift);
        const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end) + 0.1);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ target, visible: hit?.object === signs });
      }
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      function walk(column, row) {
        const accepted = player.goTo(column, row);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target: [column, row], accepted, flew, distance: Math.hypot(player.pos.x - column, player.pos.z - row) });
      }
      player.teleport(123, -26 + shift);
      for (const [column, row] of [[123, -49], [112, -50], [112, -57.3], [112, -61], [112, -64.5], [109.4, -64.5], [103.3, -65.2], [103.3, -61], [112, -61], [120.6, -61], [120.6, -65.2], [115.3, -64.8], [112, -64.5], [112, -57.3], [112, -50], [125, -54], [125, -70], [112, -70], [99.5, -70], [99.5, -54], [99, -40]]) walk(column, row + shift);
      player.teleport(112, 33);
      for (const target of [[123, 34], [123, 17], [112, 15], [106.3, 15], [106.3, 2], [111, courtyard.z1 + 5], [111, courtyard.z1 - 2],
        ...stations.filter(item => ['qin-zhao', 'qin-tiger', 'qin-dream'].includes(item.id)).map(item => item.at),
        [111, courtyard.z1 - 2], [123, courtyard.z1 + 4], [123, courtyard.z0 - 3], [112, hall.z + 14], [112, hall.z + 6.2], [112, hall.z + 0.3],
        [112, hall.z + 6.2], [125, hall.z + 10], [125, hall.z - 6], [125, -65], [112, -65], [99.5, -65], [99.5, hall.z - 6]]) walk(...target);
      const clearForecourt = [[112, -55], [108, -55], [116, -55], [112, -52], [112, -49]].every(([column, row]) => !park.site.collides(column, 0, row + shift));
      return { walls, entrance, faces, illumination, titles, walks, clearForecourt,
        teacher: parts.filter(part => part.tag === 'qin-hanfei:teacher-face').length,
        pupils: faces.filter(part => part.tag.startsWith('qin-hanfei:pupil-')).length,
        desks: parts.filter(part => part.tag.startsWith('qin-hanfei:desk-')).length,
        archives: parts.filter(part => part.tag === 'qin-hanfei:archive').length,
        brushes: parts.filter(part => part.tag === 'qin-hanfei:writing-brush').length,
        lamps: park.bakes.filter(light => light.id.startsWith('qin-hanfei-')).length,
        furnitureSolid: [[106.4, -63.1], [117.6, -63.1], [104.7, -68.1], [119.3, -68.1], [112, -66.4], [106, -51.5], [120, -54.8]].every(([column, row]) => park.site.collides(column, 0, row + shift)) };
    }, { volume: QIN_LIGHT_VOLUME, shift: QIN_HANFEI.z + 64, stations: QIN_STATIONS, courtyard: QIN_COURTYARD, hall: QIN_HANFEI });
    const interactions = [];
    for (const time of ['day', 'night']) for (const at of [station.at, [QIN_HANFEI.x, QIN_HANFEI.z + 0.3]]) {
      const arrival = await page.evaluate(({ at, time, hall }) => {
        const home = __home, player = home.player, idle = { x: 0, z: 0, run: false, up: false, down: false };
        player.teleport(hall.x, hall.z + 13); home.setTimeMode(time); home.stage.settle();
        const accepted = player.goTo(...at);
        for (let frame = 0; frame < 12000 && player.travelling; frame++) player.update(1 / 60, idle, 0);
        home.rig.showcase([hall.x + 1.4, 2.7, hall.z + 3], [hall.x, 1.8, hall.z - 3]);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, player);
        return { accepted, distance: Math.hypot(player.pos.x - at[0], player.pos.z - at[1]) };
      }, { at, time, hall: QIN_HANFEI });
      assert.ok(arrival.accepted && arrival.distance < 0.2, JSON.stringify(arrival));
      await page.waitForFunction(name => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === name, station.name);
      if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
      const panel = page.locator('#panel[data-station="qin-hanfei"][open]');
      await panel.waitFor();
      assert.ok((await panel.locator('.about-text[lang="zh-CN"]').innerText()).includes('研读'));
      assert.equal(await panel.locator('.about-text[lang="en"]').isVisible(), false);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-hanfei-card-zh-${time}-${view.name}.png`, output)) });
      await panel.locator('.lang-switch').click();
      assert.ok((await panel.locator('.about-text[lang="en"]').innerText()).includes('bamboo slips'));
      assert.equal(await panel.locator('.about-text[lang="zh-CN"]').isVisible(), false);
      await panel.locator('.lang-switch').click(); await panel.locator('.close').click();
      interactions.push({ time, at, input: view.hasTouch ? 'touch' : 'F', ...arrival });
    }
    await page.evaluate(() => __home.player.teleport(112, -58));
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#prompt').isVisible(), false, 'No stale prompt at the old hall');
    const shots = [
      { name: 'axis', camera: [58, 40, -18], portrait: [-70, 105, 32], look: [112, 0.8, -28] },
      { name: 'spacing', camera: [131, 14, -35], portrait: [137, 21, -23], look: [112, 1, -52] },
      { name: 'facade', camera: [123, 5.8, -46.5], portrait: [134, 9, -43.5], look: [112, 2.4, -62] },
      { name: 'lecture', camera: [113.4, 2.7, -61.5], portrait: [113.1, 2.5, -60.8], look: [112, 1.9, -66.9] },
      { name: 'pupils', camera: [112, 2.7, -65.6], portrait: [111.8, 2.9, -66.7], look: [106.4, 1, -62.6] },
      { name: 'west', camera: [95, 5, -61], portrait: [91, 7, -60], look: [103, 2.6, -64] },
      { name: 'rear', camera: [112, 5, -79], portrait: [114, 7, -91], look: [112, 2.5, -67] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone, shift }) => {
        const home = __home;
        home.player.teleport(112, -56 + shift); home.setTimeMode(time); home.stage.settle();
        const camera = phone ? shot.portrait : shot.camera;
        home.rig.showcase([camera[0], camera[1], camera[2] + shift], [shot.look[0], shot.look[1], shot.look[2] + shift]);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch, shift: QIN_HANFEI.z + 64 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-hanfei-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, interactions, measurements });
    writeFileSync(new URL('qin-hanfei-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walls.every(wall => wall.solid), JSON.stringify(checks.walls));
    assert.ok(checks.entrance.every(ray => ray.clear), JSON.stringify(checks.entrance));
    assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    assert.ok(checks.clearForecourt && checks.furnitureSolid);
    assert.equal(checks.teacher, 1); assert.equal(checks.pupils, 4); assert.equal(checks.desks, 2);
    assert.equal(checks.archives, 2); assert.equal(checks.brushes, 2); assert.equal(checks.lamps, 8);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: compact axis, 10m+ eave separation, ${checks.walks.length} walks, ${interactions.length} bilingual F/touch interactions, sealed walls, clear door/titles, teacher/4 pupils/archives; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
