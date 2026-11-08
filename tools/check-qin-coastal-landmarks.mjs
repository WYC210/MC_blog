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
      const ground = home.world.groups['qin-ground'];
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true); ground.updateMatrixWorld(true);
      const idle = { x: 0, z: 0, run: false, up: false, down: false }, walks = [];
      player.teleport(228.5, -7);
      for (const target of [[228.5, -12], [228.5, -17], [225, -17], [222.1, -15], [222.1, -12], [221, -9], [221, -7], [225.8, -7],
        [228.5, -7], [228.5, -17], [227.5, -20], [227.5, -24], [227.5, -32], [227.5, -41.5], [222.8, -41.5], [216, -41.5],
        [227.5, -41.5], [227.5, -52], [227.5, -62], [227.5, -66], [227.5, -56], [229.9, -56], [229.9, -59.5], [227.5, -56],
        [227.5, -42], [227.5, -32], [227.5, -20], [228.5, -7]]) {
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
      const parts = [];
      park.root.traverse(mesh => {
        for (const tag of mesh.userData.tags || []) if (/^qin-(corridor|well):/.test(tag || '')) parts.push(tag);
      });
      const tagOf = hit => hit?.object.userData.tags?.[hit.instanceId];
      const floorSamples = [
        ...[226.23, 227.61, 228.17].flatMap(column => [-64.37, -59.37, -54.37, -49.37, -44.37, -39.37, -34.37, -29.37, -24.37, -19.37].map(row => [column, row])),
        [224.23, -41.61], [225.23, -41.61], [222.43, -15.61], [227.73, -15.61], [227.73, -9.61], [225.73, -8.21],
      ];
      const floors = floorSamples.map(([column, row]) => {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, 0.1, row), new THREE.Vector3(0, -1, 0), 0, 0.2);
        const hits = ray.intersectObjects([ground, park.root], true).filter(hit => Math.abs(hit.point.y) < 0.001 && hit.face.normal.y > 0.9);
        return { position: [column, row], surfaces: new Set(hits.map(hit => `${hit.object.uuid}:${hit.instanceId ?? 'ground'}`)).size,
          material: home.world.grid.type(Math.floor(column), -1, Math.floor(row))?.name };
      });
      const ceilings = [];
      for (let row = -63.7; row < -20; row += 1.57) {
        const ray = new THREE.Raycaster(new THREE.Vector3(226.8, 2.2, row), new THREE.Vector3(0, 1, 0), 0, 1.6);
        const hit = ray.intersectObject(park.root, true)[0];
        ceilings.push({ row, tag: tagOf(hit), height: hit?.point.y });
      }
      const pitRay = new THREE.Raycaster(new THREE.Vector3(225.6, 1.25, -12.4), new THREE.Vector3(0, -1, 0), 0, 4.5);
      const pitHit = pitRay.intersectObjects([ground, park.root], true)[0];
      const pit = { tag: tagOf(pitHit), height: pitHit?.point.y,
        empty: [-1, -2, -3].every(height => !home.world.grid.type(225, height, -13)),
        protected: park.site.collides(225, 0, -12) && !home.nav.canStand(225, -12) };
      const blocked = [[225, 0, -22], [230.6, 0, -41], [229.1, 0, -39.5], [223.1, 0, -12], [223.4, 0, -8.9]]
        .map(position => ({ position, solid: park.site.collides(...position) }));
      const signs = park.root.getObjectByName('qin-inscriptions'), titles = [];
      for (const [index, label] of signs.userData.labels.entries()) {
        if (!['望海长廊', '秦皇井'].includes(label.text)) continue;
        const transform = new THREE.Matrix4().makeRotationY(label.yaw).setPosition(label.x, label.y, label.z);
        const origin = new THREE.Vector3(label.x, 1.8, label.z + Math.cos(label.yaw) * 5);
        for (const fraction of [-0.46, -0.23, 0, 0.23, 0.46]) for (const height of [-0.35, 0, 0.35]) {
          const target = new THREE.Vector3(fraction * label.width, height * label.height, 0).applyMatrix4(transform);
          const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.05);
          const hit = ray.intersectObject(park.root, true)[0];
          titles.push({ title: label.text, yaw: label.yaw, visible: hit?.object === signs && Math.floor(hit.faceIndex / 2) === index });
        }
      }
      const illumination = [[227.5, 1.5, -22], [227.5, 1.5, -37], [227.5, 1.5, -47], [227.5, 1.5, -62], [225, 1.4, -10], [223.4, 1, -8.3]].map(position => {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        return { position, energy: park.lighting.texture.image.data[offset] / 255 * 4 };
      });
      return { walks, parts, floors, ceilings, pit, blocked, titles, illumination,
        lamps: park.bakes.filter(light => /^qin-(corridor|well)-/.test(light.id)).length };
    }, QIN_LIGHT_VOLUME);
    const shots = [
      { name: 'approach', camera: [235, 6, 0], portrait: [238, 7, 6], look: [226.5, 1.8, -16] },
      { name: 'corridor-inside', camera: [228, 1.8, -18], portrait: [228, 1.8, -18], look: [227.5, 2.1, -40] },
      { name: 'corridor-sea', camera: [241, 8, -49], portrait: [248, 11, -50], look: [227.5, 2, -42] },
      { name: 'well-front', camera: [230, 4.5, -5], portrait: [232, 5.3, -2], look: [225, 1.5, -12] },
      { name: 'well-shaft', camera: [225.7, 2.1, -9.4], portrait: [225.7, 2.1, -9.4], look: [225, -0.8, -12] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(221, -4); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(200);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-coastal-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-coastal-landmarks-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2 && Math.abs(walk.height) < 0.04), JSON.stringify(checks.walks.filter(walk => !walk.accepted || walk.flew || walk.collided || walk.distance >= 0.2)));
    assert.ok(checks.floors.every(sample => sample.surfaces === 1 && sample.material === 'qin-plinth'), JSON.stringify(checks.floors));
    assert.ok(checks.ceilings.every(sample => /^qin-corridor:(ceiling|crossbeam|beam-inlay)$/.test(sample.tag) && sample.height >= 3.3), JSON.stringify(checks.ceilings));
    assert.ok(checks.pit.empty && checks.pit.protected && checks.pit.tag === 'qin-well:water' && Math.abs(checks.pit.height + 1.59) < 0.001, JSON.stringify(checks.pit));
    assert.ok(checks.blocked.every(item => item.solid), JSON.stringify(checks.blocked));
    assert.equal(checks.titles.length, 45); assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles.filter(title => !title.visible)));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    for (const [tag, count] of [['qin-corridor:column', 17], ['qin-corridor:bench-seat', 4], ['qin-corridor:ceiling', 1], ['qin-well:shaft-wall', 4], ['qin-well:bucket-wall', 4], ['qin-well:rope', 1]]) assert.equal(checks.parts.filter(part => part === tag).length, count, tag);
    assert.equal(checks.lamps, 7);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.walks.length} walks, ${checks.floors.length} single-surface floors, continuous ceiling, protected well shaft, 45 clear sign samples, 7 baked lights; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
