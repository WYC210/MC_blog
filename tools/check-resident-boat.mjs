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
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.extras?.resident || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const boarding = await page.evaluate(async () => {
      const THREE = await import('three');
      const home = __home, resident = home.extras.resident, jet = home.extras.jetSki;
      home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle(); home.rig.recenter(home.player);
      jet.ski.position.set(-45, -0.42, 0); jet.ski.rotation.set(0, Math.PI / 2, 0);
      const random = Math.random;
      let frames = 0;
      try {
        Math.random = () => 0.6;
        while (resident.mode !== 'vehicle' && frames++ < 10000) resident.update(1 / 30);
        for (let frame = 0; frame < 90 && resident.mode === 'vehicle'; frame++) resident.update(1 / 30);
      } finally { Math.random = random; }
      window.__residentUpdate = resident.update; resident.update = () => {};
      home.rig.showcase([jet.ski.position.x - 9, 7, jet.ski.position.z + 8], [jet.ski.position.x, 0, jet.ski.position.z]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
      home.stage.render(); home.stage.render();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const projected = new THREE.Vector3(jet.ski.position.x, 0.5, jet.ski.position.z).project(home.stage.camera);
      return { frames, mounted: resident.mode === 'vehicle', owned: jet.reservedBy === resident,
        inFrame: Math.abs(projected.x) < 0.8 && Math.abs(projected.y) < 0.8 && projected.z > -1 && projected.z < 1,
        stats: home.stats() };
    });
    assert.ok(boarding.mounted && boarding.owned);
    assert.ok(boarding.inFrame, 'The seated NPC and boat must be in the screenshot');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: fileURLToPath(new URL(`resident-boat-${view.name}.png`, output)) });
    const checks = await page.evaluate(async () => {
      const { createResidentBoatPilot } = await import('/world/resident-boat-pilot.js');
      const { createResidentNavigation } = await import('/world/resident-navigation.js');
      const home = __home, resident = home.extras.resident, jet = home.extras.jetSki;
      let frames = 0;
      while (resident.mode === 'vehicle' && frames++ < 6000) __residentUpdate(1 / 30);
      const returned = { mode: resident.mode, distance: Math.hypot(jet.ski.position.x + 14, jet.ski.position.z + 28.5),
        seconds: frames / 30 + 3, released: !jet.occupied && !jet.reservedBy, speed: jet.speed };
      const navigation = createResidentNavigation({ nav: home.nav, world: home.world, jetSki: jet }), trips = [];
      function passenger(column, row) {
        const actor = { pos: { x: column, z: row }, y: 0, mode: 'swim', vehicle: null,
          mountVehicle(controller) { this.vehicle = controller; return true; } };
        if (!jet.reserve(actor) || !jet.boardNPC(actor, actor)) throw new Error('Test passenger could not board');
        return actor;
      }
      for (const [name, column, row, yaw] of [
        ['west', -45, 0, Math.PI / 2], ['south', 0, 60, 0], ['north', -14, -50, Math.PI],
        ['stuck-corner', -57.9608493156, 86.9642721567, -0.1727036732],
        ['qin-channel', 78, 18, Math.PI / 2], ['north-boundary', -10, -79, Math.PI], ['east-boundary', 243, 83, Math.PI / 2],
      ]) {
        jet.ski.position.set(column, -0.42, row); jet.ski.rotation.set(0, yaw, 0);
        const actor = passenger(column, row), safeStart = jet.canFloat(column, row, yaw);
        let planningMs = 0, planCount = 0;
        const pilot = createResidentBoatPilot({ ski: jet.ski, canFloat: jet.canFloat,
          findPath(...values) {
            const start = performance.now(), route = navigation.waterPath(...values);
            planningMs += performance.now() - start; planCount++; return route;
          } });
        pilot.start({ x: -14, z: -28.5 });
        let frames = 0, unsafe = 0, still = 0, maxStill = 0, peak = 0, jumps = 0;
        while (!['failed', 'arrived'].includes(pilot.state) && frames++ < 9000) {
          const beforeX = jet.ski.position.x, beforeZ = jet.ski.position.z, beforeYaw = jet.ski.rotation.y;
          pilot.update(1 / 30, actor.vehicle);
          if (!jet.canFloat(jet.ski.position.x, jet.ski.position.z, jet.ski.rotation.y)) unsafe++;
          const movement = Math.hypot(jet.ski.position.x - beforeX, jet.ski.position.z - beforeZ);
          const turn = Math.abs(Math.atan2(Math.sin(jet.ski.rotation.y - beforeYaw), Math.cos(jet.ski.rotation.y - beforeYaw)));
          if (movement > 0.201) jumps++;
          still = movement < 0.001 && turn < 0.001 ? still + 1 / 30 : 0;
          maxStill = Math.max(maxStill, still); peak = Math.max(peak, Math.abs(jet.speed));
        }
        trips.push({ name, safeStart, state: pilot.state, recoveries: pilot.recoveries, seconds: frames / 30,
          unsafe, maxStill, peak, jumps, planningMs, planCount, distance: Math.hypot(jet.ski.position.x + 14, jet.ski.position.z + 28.5) });
        actor.vehicle.stop(); actor.vehicle = null;
      }
      jet.ski.position.set(-45, -0.42, 0); jet.ski.rotation.set(0, 0, 0);
      const owner = passenger(-45, 0), random = Math.random;
      let stole = false;
      try {
        Math.random = () => 0.6;
        for (let frame = 0; frame < 1800; frame++) { __residentUpdate(1 / 30); stole ||= resident.mode === 'vehicle'; }
      } finally { Math.random = random; }
      const ownership = !stole && jet.reservedBy === owner && jet.occupied;
      owner.vehicle.stop(); owner.vehicle = null;
      jet.ski.position.set(-45, -0.42, 0); jet.ski.rotation.set(0, 0, 0);
      try {
        Math.random = () => 0.6;
        for (let frame = 0; frame < 10000 && resident.mode !== 'vehicle'; frame++) __residentUpdate(1 / 30);
      } finally { Math.random = random; }
      const nightBoarded = resident.mode === 'vehicle';
      home.setTimeMode('night'); home.stage.settle(); __residentUpdate(1 / 30);
      const nightReleased = resident.mode !== 'vehicle' && !jet.reservedBy && !jet.occupied && jet.speed === 0;
      resident.update = __residentUpdate;
      return { returned, trips, ownership, nightBoarded, nightReleased };
    });
    report.push({ view: view.name, boarding, checks, errors });
    writeFileSync(new URL('resident-boat-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.returned.mode !== 'vehicle' && checks.returned.distance < 0.45 && checks.returned.released && checks.returned.speed === 0, JSON.stringify(checks.returned));
    for (const trip of checks.trips) {
      assert.ok(trip.safeStart && trip.state === 'arrived' && trip.distance < 0.45, JSON.stringify(trip));
      assert.ok(!trip.unsafe && !trip.jumps && trip.maxStill < 2 && trip.peak <= 6.001, JSON.stringify(trip));
    }
    assert.ok(checks.trips.find(trip => trip.name === 'stuck-corner').recoveries > 0);
    assert.ok(checks.ownership && checks.nightBoarded && checks.nightReleased, 'Reservation and night cancellation must release ownership without stealing the boat');
    assert.ok(boarding.stats.calls <= 60 && boarding.stats.triangles <= 200000);
    assert.deepEqual(errors, []);
    console.log(`${view.name}: NPC returns in ${checks.returned.seconds.toFixed(1)}s; 7 coastal/boundary trips, reverse recovery, no unsafe hulls or teleports; ownership/night cleanup passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
