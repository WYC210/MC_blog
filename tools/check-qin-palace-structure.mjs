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
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(() => {
      const home = __home, park = home.world.qinIsland, player = home.player;
      const idle = { x: 0, z: 0, up: false, down: false, run: false };
      const simulate = (frames, input = idle, yaw = 0) => {
        for (let frame = 0; frame < frames; frame++) player.update(1 / 60, input, yaw);
        return { y: player.y, x: player.pos.x, z: player.pos.z, mode: player.mode, site: player.island };
      };
      home.rig.skipIntro(); home.setTimeMode('day'); home.setWeatherMode('rain');
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.weatherFx.settle(); home.stage.settle();
      player.teleport(160, -38, { floor: 3 }); player.startFlying();
      const underside = simulate(240, { ...idle, up: true });
      const lowerCancel = player.stopFlying(), lowerLanded = simulate(180);
      player.teleport(171, -38, { floor: 7 }); player.startFlying();
      const ceiling = simulate(240, { ...idle, up: true });
      const upperCancel = player.stopFlying(), upperLanded = simulate(180);
      player.startFlying(); simulate(25, { ...idle, up: true });
      const upperDescend = simulate(180, { ...idle, down: true });
      player.teleport(160, -33.5, { floor: 3 }); player.startFlying();
      simulate(36, { ...idle, up: true }); simulate(60);
      const sideStart = { y: player.y, z: player.pos.z };
      const slabSide = simulate(90, { ...idle, z: -1, run: true });
      player.teleport(160, -33, { floor: 3 }); player.startFlying();
      simulate(50, { ...idle, up: true }); simulate(60);
      const overSlab = simulate(31, { ...idle, z: -1 }); simulate(60);
      const fromAtriumCancel = player.stopFlying(), fromAtriumLanded = simulate(180);
      const shelter = home.weatherFx.shelter, samples = [];
      for (const x of [142.5, 150.5, 160.5, 170.5, 179.5]) for (const z of [-45.5, -40.5, -34.5, -28.5, -22.5]) {
        const top = shelter.topAt(x, z), box = shelter.box, texture = shelter.texture.image;
        const column = Math.floor(x - box.x), row = Math.floor(z - box.y);
        const gpuTop = texture.data[column + row * texture.width] / 4 - 2;
        samples.push({ x, z, top, gpuTop });
      }
      player.teleport(171, -38, { floor: 7 });
      home.stage.camera.position.set(169, 9.2, -33); home.extras.qinIsland.update(0);
      const insideRoofVisible = park.palaceRoof.visible;
      home.stage.camera.position.set(171, 9, -38); home.extras.qinIsland.update(0);
      const projectionOccluded = !park.greatWall.root.visible;
      home.stage.camera.position.set(171, 5.5, -38); home.extras.qinIsland.update(0);
      const projectionBelowVisible = park.greatWall.root.visible;
      home.stage.camera.position.set(160, 25, -10); home.extras.qinIsland.update(0);
      const outsideCutaway = !park.palaceRoof.visible, cutawayShelter = shelter.topAt(160.5, -40.5);
      const walks = [];
      player.teleport(160, -18);
      for (const [target, floor] of [[[178.5, -22], 3], [[178.5, -36.5], 7], [[171, -38], 7], [[160.5, -40.2], 3], [[160, -24], 3]]) {
        const accepted = player.goTo(...target, { floor }); let collided = false;
        for (let frame = 0; frame < 6000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
        }
        walks.push({ target, floor, accepted, collided, y: player.y, distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      return { underside, lowerCancel, lowerLanded, ceiling, upperCancel, upperLanded, upperDescend, sideStart, slabSide,
        overSlab, fromAtriumCancel, fromAtriumLanded, samples, insideRoofVisible, outsideCutaway, cutawayShelter, walks, projectionOccluded, projectionBelowVisible,
        upperSupport: home.world.ground.topAt(171, -38, 8)?.y,
        lowerSupport: home.world.ground.topAt(160, -38, 4)?.y,
        slabCollision: park.site.collides(160, 6.5, -38),
        roofCollision: park.site.collides(160, 10.7, -30),
        outsideShelter: shelter.topAt(190.5, -10.5) };
    });
    writeFileSync(new URL(`qin-palace-structure-${view.name}.json`, output), JSON.stringify(checks, null, 2));
    assert.ok(checks.underside.y < 5.01 && checks.underside.y > 4.7, JSON.stringify(checks.underside));
    assert.ok(checks.lowerCancel && checks.lowerLanded.mode === 'ground' && Math.abs(checks.lowerLanded.y - 3) < 0.01);
    assert.ok(checks.ceiling.y < 9.05 && checks.ceiling.y > 8.7, JSON.stringify(checks.ceiling));
    for (const landing of [checks.upperLanded, checks.upperDescend, checks.fromAtriumLanded])
      assert.ok(landing.mode === 'ground' && Math.abs(landing.y - 7) < 0.01, JSON.stringify(landing));
    assert.ok(checks.upperCancel && checks.fromAtriumCancel);
    assert.ok(checks.sideStart.y > 5 && checks.sideStart.y < 6.75 && checks.slabSide.z > -34.73, JSON.stringify(checks.slabSide));
    assert.equal(checks.upperSupport, 7); assert.equal(checks.lowerSupport, 3);
    assert.ok(checks.slabCollision && checks.roofCollision && checks.insideRoofVisible && checks.outsideCutaway);
    assert.ok(checks.projectionOccluded && checks.projectionBelowVisible);
    assert.ok(checks.samples.every(sample => sample.top >= 10.8 && sample.gpuTop >= 10.75));
    assert.ok(checks.cutawayShelter > 10.8 && checks.outsideShelter < 7);
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.collided && walk.distance < 0.2 && Math.abs(walk.y - walk.floor) < 0.05), JSON.stringify(checks.walks));
    const measurements = [];
    for (const floor of [3, 7]) {
      await page.evaluate(floor => {
        const home = __home;
        home.player.teleport(171, -38, { floor });
        home.rig.showcase(floor === 7 ? [162, 9.4, -34] : [156, 5.8, -34], floor === 7 ? [161, 8.7, -43] : [161, 4.7, -44]);
        for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0); home.weatherFx.settle(); home.stage.settle();
      }, floor);
      await page.waitForTimeout(600);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-palace-rain-floor${floor}-${view.name}.png`, output)) });
      measurements.push(await page.evaluate(() => __home.stats()));
    }
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-palace-structure-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: roof shelter, floor/ceiling flight collision, upper-floor landing, 5 walking routes; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
