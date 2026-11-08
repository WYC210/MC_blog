import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_PAVILION, QIN_TERRACE, QIN_LIGHT_VOLUME, qinFloorAt } from '../world/qin-island-layout.js';

const stairs = QIN_TERRACE.stairs;
for (let step = 0; step < stairs.count; step++) {
  assert.ok(Math.abs(qinFloorAt(QIN_TERRACE.x, stairs.z1 - (step + 0.5) * stairs.run) - (step + 1) * stairs.rise) < 0.001);
}
assert.equal(qinFloorAt(QIN_TERRACE.x, QIN_TERRACE.z), QIN_TERRACE.floor);
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
    const checks = await page.evaluate(async ({ pavilion, terrace, volume }) => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      const steps = Array.from({ length: terrace.stairs.count }, (_, step) => [terrace.x, terrace.stairs.z1 - (step + 0.5) * terrace.stairs.run]);
      player.teleport(207.5, -25);
      const route = [[207.5, -33], [207.5, -38], [207.5, -41.5], [200, -41.5], [194, -41.5], [207.5, -41.5],
        [216, -41.5], [222, -41.5], [207.5, -41.5], [204.3, -41.5], [205.3, -39.5], [207.5, -41.5],
        [211, -41.5], [209.7, -43.6], [207.5, -41.5], [207.5, -48], [207.5, -55], [207.5, -58],
        ...steps, [207.5, -63], [207.5, -65], [204.5, -65], [204.5, -66.5], [210.5, -66.5], [210.5, -64],
        [207.5, -65], [207.5, -63], ...steps.slice().reverse(), [207.5, -58], [207.5, -48], [207.5, -41.5], [207.5, -25]];
      for (const target of route) {
        const accepted = player.goTo(...target);
        let flew = false, collided = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
          collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
        }
        for (let frame = 0; frame < 45; frame++) player.update(1 / 60, idle, 0);
        walks.push({ target, accepted, flew, collided, height: player.y,
          floor: home.nav.heightAt(...target), distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const parts = [], matrix = new THREE.Matrix4();
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!/^qin-(pavilion|terrace):/.test(tag || '')) continue;
          mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
          parts.push({ tag, center: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(), size: new THREE.Vector3().setFromMatrixScale(matrix).toArray() });
        }
      });
      const titles = [], signs = park.root.getObjectByName('qin-inscriptions');
      const labels = signs.userData.labels.filter(label => ['祈寿亭', '升仙台'].includes(label.text));
      for (const label of labels) {
        const direction = label.yaw === Math.PI ? -1 : 1;
        const origin = new THREE.Vector3(label.x, 1.8, label.z + direction * 5), target = new THREE.Vector3(label.x, label.y, label.z);
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.1);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ name: label.text, yaw: label.yaw, visible: hit?.object === signs && signs.userData.labels[Math.floor(hit.faceIndex / 2)]?.text === label.text });
      }
      const illumination = [];
      for (const position of [[207.5, 1.5, -41.5], [204.5, 1, -39], [207.5, 3, -38], [207.5, 1.8, -60], [207.5, 2, -65], [203, 1.5, -59.5]]) {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      const blocked = [[204.2, 0, -38.2], [211.2, 0, -39.4], [207.5, terrace.floor, -67.75], [201.75, terrace.floor, -65],
        [213.25, terrace.floor, -65], [204.9, 0, -51], [210.1, 0, -32], [198, 0, -44.1], [218, 0, -38.9]]
        .map(position => ({ position, solid: park.site.collides(...position) }));
      const exits = [[207.5, -37], [207.5, -46], [203, -41.5], [212, -41.5]]
        .map(position => ({ position, open: home.nav.canStand(...position) && !park.site.collides(position[0], 0, position[1]) }));
      const dry = [[204.5, -44.5], [210.5, -38.5], [207.5, -41.5]].every(([column, row]) => !!home.world.grid?.type?.(Math.floor(column), -1, Math.floor(row)));
      const ground = home.world.groups['qin-ground'];
      ground.updateMatrixWorld(true);
      const floorSamples = [
        ...[206.23, 207.61, 209.17].flatMap(column => [-58.73, -57.73, -56.73, -50.73, -45.73, -41.73, -37.23, -30.73, -27.23, -26.73].map(row => [column, row])),
        ...[192.23, 192.73, 193.23, 200.23, 202.73, 207.23, 212.23, 218.23, 222.73, 223.23, 223.73].flatMap(column => [-43.73, -41.73, -39.23].map(row => [column, row])),
        [203.73, -45.23], [211.23, -45.23], [203.73, -37.73], [211.23, -37.73],
      ];
      const floors = floorSamples.map(([column, row]) => {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, 0.1, row), new THREE.Vector3(0, -1, 0), 0, 0.2);
        const hits = ray.intersectObjects([ground, park.root], true).filter(hit => Math.abs(hit.point.y) < 0.001 && hit.face.normal.y > 0.9);
        const surfaces = [...new Set(hits.map(hit => `${hit.object.uuid}:${hit.instanceId ?? 'ground'}`))];
        return { position: [column, row], surfaces: surfaces.length, ground: hits.some(hit => !hit.object.isInstancedMesh),
          material: home.world.grid.type(Math.floor(column), -1, Math.floor(row))?.name, expected: row < -58 ? 'qin-path' : 'qin-plinth' };
      });
      return { walks, parts, titles, illumination, blocked, exits, dry, floors,
        lamps: park.bakes.filter(light => /^qin-(pavilion|terrace)-/.test(light.id)).length };
    }, { pavilion: QIN_PAVILION, terrace: QIN_TERRACE, volume: QIN_LIGHT_VOLUME });
    assert.ok(checks.floors.every(sample => sample.surfaces === 1 && sample.ground && sample.material === sample.expected),
      JSON.stringify(checks.floors.filter(sample => sample.surfaces !== 1 || !sample.ground || sample.material !== sample.expected)));
    const shots = [
      { name: 'pavilion-front', camera: [218, 6, -25], portrait: [218, 9, -14], look: [207.5, 3.5, -41.5] },
      { name: 'pavilion-inside', camera: [209, 1.8, -37.4], portrait: [209, 1.8, -35.5], look: [205.3, 2, -43.4] },
      { name: 'pavilion-back', camera: [217, 5.5, -55], portrait: [222, 6, -55], look: [207.5, 3.5, -41.5] },
      { name: 'bridge-north-floor', camera: [209.2, 1.8, -52], portrait: [209.2, 1.8, -52], look: [207.5, 0, -57.5] },
      { name: 'pavilion-floor', camera: [208.7, 1.8, -37.5], portrait: [208.7, 1.8, -37.5], look: [207, 0, -42] },
      { name: 'terrace-front', camera: [216, 5.2, -53], portrait: [224, 8.5, -44], look: [207.5, 1.2, -64] },
      { name: 'terrace-top', camera: [213, 9, -59], portrait: [218, 12, -56], look: [207.5, 1, -64.8] },
      { name: 'terrace-back', camera: [217, 5, -76], portrait: [220, 6, -80], look: [207.5, 1.3, -64.5] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(207.5, -58); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(200);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-garden-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-garden-landmarks-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2 && Math.abs(walk.height - walk.floor) < 0.04), JSON.stringify(checks.walks));
    assert.ok(checks.titles.length === 3 && checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.ok(checks.blocked.every(item => item.solid), JSON.stringify(checks.blocked));
    assert.ok(checks.exits.every(item => item.open), JSON.stringify(checks.exits));
    assert.ok(checks.dry);
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    const count = tag => checks.parts.filter(part => part.tag === tag).length;
    assert.equal(count('qin-pavilion:column'), 4); assert.equal(count('qin-pavilion:bench-seat'), 4);
    assert.equal(count('qin-terrace:bench-seat'), 2); assert.equal(count('qin-terrace:step'), 6);
    assert.equal(count('qin-terrace:floor-ring'), 24); assert.equal(checks.lamps, 9);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.walks.length} walks, ${checks.floors.length} single-surface floor samples, four pavilion entries, six-step terrace round trip, solid rails, 6 benches, readable signs, 9 baked lights; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
