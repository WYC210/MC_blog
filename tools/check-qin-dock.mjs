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
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      player.teleport(90, 23.5); home.extras.update(0); home.stage.scene.updateMatrixWorld(true);
      const floors = [];
      for (let column = 85; column <= 95; column++) for (let row = 15; row <= 25; row++) {
        const ray = new THREE.Raycaster(new THREE.Vector3(column + 0.37, 0.1, row + 0.61), new THREE.Vector3(0, -1, 0), 0, 0.2);
        const hits = ray.intersectObject(home.stage.scene, true).filter(hit => Math.abs(hit.point.y) < 0.001 && hit.face.normal.y > 0.9);
        const surfaces = new Set(hits.map(hit => `${hit.object.uuid}:${hit.instanceId ?? 'ground'}`));
        floors.push({ position: [column + 0.37, row + 0.61], surfaces: surfaces.size,
          ground: hits.some(hit => !hit.object.isInstancedMesh), material: home.world.grid.type(column, -1, row)?.name,
          expected: row < 22 ? column < 95 ? 'qin-dock-deck' : 'qin-path'
            : row < 25 && column < 91 ? 'qin-dock-deck' : column < 89 ? 'qin-sand' : 'qin-grass' });
      }
      const signs = park.root.getObjectByName('qin-inscriptions');
      const labelIndex = signs.userData.labels.findIndex(label => label.text === '求仙岛 · 游客码头');
      const label = signs.userData.labels[labelIndex], visibility = [];
      const transform = new THREE.Matrix4().makeRotationY(label.yaw).setPosition(label.x, label.y, label.z);
      for (const position of [[82, 1.8, 18.5], [85, 1.8, 14], [85, 1.8, 23]]) {
        const origin = new THREE.Vector3(...position);
        for (let column = 0; column <= 28; column++) for (const height of [-0.35, 0, 0.35]) {
          const target = new THREE.Vector3((column / 28 - 0.5) * label.width * 0.94, height * label.height, 0).applyMatrix4(transform);
          const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.05);
          const hit = ray.intersectObject(park.root, true)[0];
          visibility.push({ origin: position, target: target.toArray(), visible: hit?.object === signs && Math.floor(hit.faceIndex / 2) === labelIndex });
        }
      }
      const idle = { x: 0, z: 0, run: false, up: false, down: false }, walks = [];
      player.teleport(86, 18.5);
      for (const target of [[90, 18.5], [96, 18.5], [100, 18.5], [96, 16.7], [90, 16.7], [86, 18.5], [96, 20.3], [100, 20.3],
        [90, 23.5], [86, 24.3], [88.9, 25.5], [90, 18.5], [86, 18.5]]) {
        const accepted = player.goTo(...target);
        let flew = false, collided = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0);
          flew ||= player.mode !== 'ground';
          collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
        }
        for (let frame = 0; frame < 45; frame++) player.update(1 / 60, idle, 0);
        walks.push({ target, accepted, flew, collided, height: player.y,
          distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const swim = [];
      player.teleport(86, 18);
      for (const direction of [-1, 1]) {
        let swam = false;
        for (let frame = 0; frame < 1200; frame++) {
          player.update(1 / 60, { ...idle, x: direction }, 0);
          swam ||= player.swimming;
          if (direction === 1 ? player.mode === 'ground' && player.pos.x >= 86 : player.swimming && player.pos.x <= 82) break;
        }
        swim.push({ direction, swam, x: player.pos.x, mode: player.mode, swimming: player.swimming });
      }
      const channel = [76, 78, 80, 82].map(column => home.extras.jetSki.canFloat(column, 18, Math.PI / 2));
      return { floors, visibility, clearance: label.y - label.height / 2, walks, swim, channel };
    });
    const shots = [
      { name: 'front', camera: [78, 4.5, 18.5], portrait: [73, 5, 18.5], look: [92, 1.3, 18.5] },
      { name: 'sign', camera: [85.5, 2.4, 18.5], portrait: [78, 2.8, 18.5], look: [94.7, 2.8, 18.5] },
      { name: 'floor', camera: [88, 3.4, 23.7], portrait: [85.5, 3, 18.5], look: [92, 0, 18.5] },
      { name: 'track-end', camera: [80, 8, 30], portrait: [79, 8, 32], look: [88, 0, 22.2] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(100, 18.5); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(200);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-dock-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-dock-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: ${checks.floors.filter(sample => sample.surfaces !== 1).length} overlapping floors, ${checks.visibility.filter(sample => !sample.visible).length} blocked sign samples`);
    assert.ok(checks.floors.every(sample => sample.surfaces === 1 && sample.ground && sample.material === sample.expected), 'Dock flooring must have one wooden surface and meet the stone path without overlap');
    assert.ok(checks.visibility.every(sample => sample.visible), 'Dock sign must be readable across its full width from the shore and both sides');
    assert.ok(checks.clearance >= 2.2, `Sign clearance: ${checks.clearance}`);
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2 && Math.abs(walk.height) < 0.04), JSON.stringify(checks.walks));
    assert.ok(checks.swim[0].swimming && checks.swim[0].x <= 82, JSON.stringify(checks.swim));
    assert.ok(checks.swim[1].swam && checks.swim[1].mode === 'ground' && checks.swim[1].x >= 86, JSON.stringify(checks.swim));
    assert.ok(checks.channel.every(Boolean), JSON.stringify(checks.channel));
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.floors.length} single-surface floor samples, ${checks.visibility.length} clear sign samples, ${checks.walks.length} walks, swimming round trip, open boat approach; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
