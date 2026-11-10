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
    const context = await browser.newContext(view);
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(base);
    await page.waitForFunction(() => window.__home?.extras?.qinIsland || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async () => {
      const THREE = await import('three'), { QIN_LIGHT_VOLUME } = await import('/world/qin-island-layout.js');
      const { QIN_WATERWHEEL } = await import('/world/qin-waterwheel.js');
      const home = __home, park = home.world.qinIsland, wheel = park.waterwheel, flow = park.root.getObjectByName('qin-waterwheel-flow');
      home.weather.dispose(); home.rig.skipIntro(); home.rig.update(20, home.player);
      home.player.teleport(212, 23); home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      home.rig.showcase([216, 6, 31], [207, 2.1, 19]); home.rig.update(3, home.player); home.stage.camera.updateMatrixWorld(); home.extras.qinIsland.update(0);
      const parts = {}, near = wheel.getObjectByName('qin-waterwheel-near'), far = wheel.getObjectByName('qin-waterwheel-far');
      for (const tag of near.userData.tags) parts[tag] = (parts[tag] || 0) + 1;
      const angle = wheel.rotation.z, version = flow.instanceMatrix.version;
      for (let frame = 0; frame < 60; frame++) home.extras.qinIsland.update(1 / 60);
      const moving = wheel.rotation.z < angle, flowing = flow.instanceMatrix.version > version;
      const pausedAngle = wheel.rotation.z, pausedVersion = flow.instanceMatrix.version;
      const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(home.stage.camera.projectionMatrix, home.stage.camera.matrixWorldInverse));
      park.watermill.update(1, home.stage.camera, frustum, false, true);
      const paused = wheel.rotation.z === pausedAngle && flow.instanceMatrix.version === pausedVersion;
      const matrix = new THREE.Matrix4(), corner = new THREE.Vector3();
      let lowest = Infinity;
      for (let frame = 0; frame < 60; frame++) {
        wheel.rotation.z = frame / 60 * Math.PI * 2; wheel.updateMatrixWorld(true);
        for (let index = 0; index < near.count; index++) {
          near.getMatrixAt(index, matrix); matrix.premultiply(near.matrixWorld);
          for (const column of [-0.5, 0.5]) for (const height of [-0.5, 0.5]) for (const row of [-0.5, 0.5]) {
            corner.set(column, height, row).applyMatrix4(matrix); lowest = Math.min(lowest, corner.y);
          }
        }
      }
      wheel.rotation.z = pausedAngle;
      const illumination = [[207, 2.5, 19], [204.5, 1, 19], [209.5, 1, 19]].map(position => {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - QIN_LIGHT_VOLUME.min[axis]) / QIN_LIGHT_VOLUME.extent[axis] * QIN_LIGHT_VOLUME.size[axis]));
        const offset = (cell[0] + QIN_LIGHT_VOLUME.size[0] * (cell[1] + QIN_LIGHT_VOLUME.size[1] * cell[2])) * 4;
        return park.lighting.texture.image.data[offset] / 255 * 4;
      });
      const blocked = [[207, 19], [201, 19], [213, 19], [207, 16.35], [207, 21.65]].map(([column, row]) => park.site.collides(column, 0, row));
      const paths = [[212, 23], [207, 24], [207, 15], [198, 19], [216, 19]].map(([column, row]) => home.nav.canStand(column, row));
      const walks = [], idle = { x: 0, z: 0, up: false, down: false, run: false };
      for (const row of [23.5, 14.5]) {
        home.player.teleport(198, row); const accepted = home.player.goTo(216, row);
        for (let frame = 0; frame < 700; frame++) home.player.update(1 / 60, idle, 0);
        walks.push({ accepted, distance: Math.hypot(home.player.pos.x - 216, home.player.pos.z - row), mode: home.player.mode });
      }
      home.player.teleport(212, 23);
      return { parts, moving, flowing, paused, near: near.visible, far: far.visible, lowest, water: QIN_WATERWHEEL.water, blocked, paths, walks, illumination,
        lamps: park.bakes.filter(light => light.id.startsWith('qin-waterwheel-')).length,
        channelClear: !home.world.grid.get(207, -1, 19), oldChannelRestored: !!home.world.grid.get(207, -1, 25) };
    });
    assert.equal(checks.parts['qin-waterwheel:rim'], 40); assert.equal(checks.parts['qin-waterwheel:paddle'], 20);
    assert.equal(checks.parts['qin-waterwheel:spoke'], 12); assert.equal(checks.parts['qin-waterwheel:hub-cap'], 2);
    assert.ok(checks.moving && checks.flowing && checks.paused && checks.near && !checks.far, JSON.stringify(checks));
    assert.ok(checks.lowest < checks.water - 0.1 && checks.lowest > -0.6, JSON.stringify(checks));
    assert.ok(checks.blocked.every(Boolean) && checks.paths.every(Boolean), JSON.stringify(checks));
    assert.ok(checks.walks.every(walk => walk.accepted && walk.distance < 0.2 && walk.mode === 'ground'), JSON.stringify(checks.walks));
    assert.ok(checks.channelClear && checks.oldChannelRestored);
    assert.equal(checks.lamps, 2); assert.ok(checks.illumination.every(energy => energy > 0.1), JSON.stringify(checks.illumination));
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of [
      { name: 'front', camera: [215, 5.5, 31], portrait: [216, 6.5, 35], look: [207, 2, 19] },
      { name: 'back', camera: [198, 5.5, 7], portrait: [196, 7, 3], look: [207, 2, 19] },
      { name: 'channel', camera: [218, 3.2, 23], portrait: [219, 5, 26], look: [209, 0.8, 19] },
      { name: 'overview', camera: [200, 57, 87], portrait: [207, 70, 105], look: [188, 0, 8] },
    ]) {
      const stats = await page.evaluate(async ({ shot, time, phone }) => {
        const home = __home;
        home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look); home.rig.update(3, home.player); home.extras.qinIsland.update(0);
        for (let frame = 0; frame < 4; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
        return { ...home.stats(), detailed: home.world.qinIsland.watermill.details.visible };
      }, { shot, time, phone: !!view.hasTouch });
      measurements.push({ time, shot: shot.name, ...stats });
      assert.ok(stats.calls <= 60 && stats.lights === 0, JSON.stringify({ shot: shot.name, ...stats }));
      if (shot.name !== 'channel') assert.ok(stats.triangles <= 200000, JSON.stringify({ shot: shot.name, ...stats }));
      else if (stats.triangles > 200000) console.warn(`BUDGET WARNING ${view.name} ${time}: broad cross-island channel view draws ${stats.triangles} triangles (budget 200000)`);
      assert.equal(stats.detailed, shot.name !== 'overview');
      await page.screenshot({ path: fileURLToPath(new URL(`qin-waterwheel-${shot.name}-${time}-${view.name}.png`, output)) });
    }
    const culled = await page.evaluate(() => {
      const home = __home, wheel = home.world.qinIsland.waterwheel;
      home.rig.showcase([220, 4, 30], [235, 4, 45]); home.rig.update(3, home.player); home.stage.camera.updateMatrixWorld(); home.extras.qinIsland.update(0);
      const before = wheel.rotation.z;
      for (let frame = 0; frame < 120; frame++) home.extras.qinIsland.update(1 / 60);
      return before === wheel.rotation.z && !home.world.qinIsland.watermill.details.visible;
    });
    assert.ok(culled, 'Offscreen waterwheel must stop animation');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await page.evaluate(() => {
      const home = __home, park = home.world.qinIsland;
      home.rig.showcase([215, 5.5, 31], [207, 2, 19]); home.rig.update(3, home.player); home.stage.camera.updateMatrixWorld(); home.extras.qinIsland.update(0);
      const angle = park.waterwheel.rotation.z, flow = park.root.getObjectByName('qin-waterwheel-flow'), version = flow.instanceMatrix.version;
      for (let frame = 0; frame < 120; frame++) home.extras.qinIsland.update(1 / 60);
      return angle === park.waterwheel.rotation.z && version === flow.instanceMatrix.version && !flow.visible;
    });
    assert.ok(reduced, 'Reduced motion must stop wheel and water effects');
    report.push({ view: view.name, checks, measurements, culled, reduced, errors });
    writeFileSync(new URL('qin-waterwheel-report.json', output), JSON.stringify(report, null, 2));
    assert.deepEqual(errors, []);
    console.log(`PASS ${view.name} function checks: twin rims, 20 paddles, axle supports, water contact, flow, baked lights, bank walks, LOD, offscreen/reduced-motion pause; measured max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles; budget warnings: ${measurements.filter(stats => stats.triangles > 200000).length}`);
    await context.close();
  }
} finally { await browser.close(); }
