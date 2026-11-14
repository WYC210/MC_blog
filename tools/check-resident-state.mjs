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
    if (process.argv[3] && process.argv[3] !== view.name) continue;
    const context = await browser.newContext(view), page = await context.newPage(), errors = [], checks = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    await context.addInitScript(() => {
      const fixture = sessionStorage.getItem('resident-test-fixture');
      if (fixture) {
        const { key, text } = JSON.parse(fixture);
        localStorage.setItem(key, text); sessionStorage.removeItem('resident-test-fixture');
      }
      const schedule = requestAnimationFrame.bind(window);
      window.requestAnimationFrame = callback => schedule(time => {
        const resident = window.__home?.extras?.resident;
        if (resident && !window.__residentUpdate) { window.__residentUpdate = resident.update; resident.update = () => {}; }
        callback(time);
      });
    });
    page.on('pageerror', error => errors.push(error.message));
    async function ready() {
      await page.waitForFunction(() => window.__residentUpdate || window.__homeStartupError, null, { timeout: 120000 });
      assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
      await page.evaluate(() => { __home.weather.dispose(); __home.setTimeMode('day'); });
    }
    async function advance(kind, roll) {
      const result = await page.evaluate(({ kind, roll }) => {
        const resident = __home.extras.resident, random = Math.random;
        const matches = () => {
          if (kind === 'stairs') return resident.state === 'walking' && resident.y > 0.1 && resident.y < 0.9 && resident.pos.x < -19;
          if (kind === 'land') return resident.state === 'walking' && resident.y < 0.1 && resident.pos.z > 14;
          if (kind === 'resting') return resident.state === 'resting' && resident.activity === 'resting';
          if (kind === 'wandering') return resident.state === 'resting' && resident.activity === 'wandering';
          return resident.state === kind;
        };
        let frames = 0;
        try {
          Math.random = () => roll;
          while (!matches() && frames++ < 12000) __residentUpdate(1 / 30);
          if (kind === 'boating') for (let frame = 0; frame < 90; frame++) __residentUpdate(1 / 30);
        } finally { Math.random = random; }
        resident.save();
        return { matched: matches(), frames, snapshot: JSON.parse(localStorage.getItem(resident.storageKey)) };
      }, { kind, roll });
      assert.ok(result.matched, `${kind}: ${JSON.stringify(result)}`);
      return result.snapshot;
    }
    async function roundTrip(name, saved) {
      await page.reload(); await ready();
      const loaded = await page.evaluate(() => {
        const resident = __home.extras.resident, jet = __home.extras.jetSki;
        return { restored: resident.restored, state: resident.state, activity: resident.activity, position: { ...resident.pos, y: resident.y },
          heading: resident.root.rotation.y, owned: jet.reservedBy === resident && jet.occupied,
          boat: { x: jet.ski.position.x, z: jet.ski.position.z, yaw: jet.ski.rotation.y }, speed: jet.speed };
      });
      assert.ok(loaded.restored, `${name} did not restore: ${JSON.stringify(saved)}`);
      assert.equal(loaded.state, saved.state, name);
      assert.equal(loaded.activity, saved.activity, name);
      const error = Math.hypot(loaded.position.x - saved.position.x, loaded.position.y - saved.position.y, loaded.position.z - saved.position.z);
      assert.ok(error < 0.1, `${name} jumped ${error}m`);
      assert.ok(Math.abs(loaded.heading - saved.heading) < 0.001, name);
      if (saved.boat) {
        assert.ok(loaded.owned && loaded.speed === 0);
        assert.ok(Math.hypot(loaded.boat.x - saved.boat.x, loaded.boat.z - saved.boat.z) < 0.01);
      }
      checks.push({ name, error, restored: loaded.restored });
    }
    await page.goto(`${base}?lang=zh&debug`); await ready();
    assert.equal(await page.evaluate(() => __home.extras.resident.restored), false);
    const identity = await page.evaluate(async () => {
      const { config } = await import('/engine/config.js');
      const { RESIDENT_HOME, IKUN_BED } = await import('/world/layout.js');
      const { REST_POINTS } = await import('/world/rest-points.js');
      const { createResidentNavigation } = await import('/world/resident-navigation.js');
      const home = __home, resident = home.extras.resident;
      const navigation = createResidentNavigation({ nav: home.nav, world: home.world, jetSki: home.extras.jetSki });
      const path = navigation.homeRoute(true), blocked = [];
      for (let index = 1; index < path.length; index++) {
        const start = path[index - 1], end = path[index], steps = Math.ceil(Math.hypot(end.x - start.x, end.z - start.z) / 0.1);
        for (let step = 0; step <= steps; step++) {
          const fraction = step / steps, x = start.x + (end.x - start.x) * fraction, z = start.z + (end.z - start.z) * fraction;
          if (!home.nav.canStand(x, z)) blocked.push({ x, z });
        }
      }
      return { name: document.querySelector('.resident-greeting b').textContent, expectedName: config.name,
        sameSkin: resident.avatar.material.map.image.toDataURL() === home.avatar.material.map.image.toDataURL(),
        bed: REST_POINTS.find(point => point.id === RESIDENT_HOME.bed.id), expectedBed: RESIDENT_HOME.bed,
        oldBed: REST_POINTS.find(point => point.id === IKUN_BED.id), path, exit: navigation.homeRoute(false), blocked };
    });
    assert.equal(identity.name, identity.expectedName);
    assert.equal(identity.sameSkin, true, 'The resident should wear the site owner skin, not the showcase skin');
    assert.deepEqual(identity.bed, identity.expectedBed);
    assert.equal(identity.bed.floor, 1);
    assert.equal(identity.oldBed.floor, 4, 'Relocating the resident must not move the IKUN furniture');
    assert.deepEqual(identity.exit, [...identity.path].reverse());
    assert.deepEqual(identity.blocked, [], 'The workbench home route must avoid walls and furniture');
    await roundTrip('leaving-home-stairs', await advance('stairs', 0.4));
    await roundTrip('walking-to-fish', await advance('land', 0.4));
    await roundTrip('fishing', await advance('fishing', 0.4));
    await roundTrip('beach-seat', await advance('resting', 0.1));
    await roundTrip('wandering', await advance('wandering', 0.9));
    await page.evaluate(() => {
      const home = __home, resident = home.extras.resident;
      home.player.teleport(resident.pos.x + 1.5, resident.pos.z);
      home.rig.skipIntro(); home.rig.showcase([resident.pos.x + 5, resident.y + 4, resident.pos.z + 6], [resident.pos.x, resident.y + 1, resident.pos.z]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
      __residentUpdate(0.2);
    });
    for (const [language, expected] of [['zh', '你好，欢迎来到我的世界，随意参观吧'], ['en', 'Hello, welcome to my world. Feel free to explore!']]) {
      await page.evaluate(async language => { (await import('/engine/lang.js')).setLang(language); __residentUpdate(0.2); }, language);
      const bubble = page.locator('.resident-greeting');
      assert.equal(await bubble.isVisible(), true);
      assert.equal(await bubble.locator('span').innerText(), expected);
      const bounds = await bubble.boundingBox();
      assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= view.viewport.width && bounds.y + bounds.height <= view.viewport.height, JSON.stringify(bounds));
      await page.screenshot({ path: fileURLToPath(new URL(`resident-owner-${view.name}-${language}.png`, output)) });
    }
    await page.evaluate(async () => { (await import('/engine/lang.js')).setLang('zh'); __home.rig.skipIntro(); });
    await page.evaluate(() => { const ski = __home.extras.jetSki.ski; ski.position.set(-45, -0.42, 0); ski.rotation.set(0, Math.PI / 2, 0); });
    const boating = await advance('boating', 0.6);
    await roundTrip('driving', boating);
    const returned = await page.evaluate(() => {
      const resident = __home.extras.resident, jet = __home.extras.jetSki;
      let frames = 0;
      while (resident.mode === 'vehicle' && frames++ < 6000) __residentUpdate(1 / 30);
      return resident.mode !== 'vehicle' && !jet.occupied && !jet.reservedBy && Math.hypot(jet.ski.position.x + 14, jet.ski.position.z + 28.5) < 0.45;
    });
    assert.ok(returned, 'Reloaded NPC must finish the boat trip and release ownership');
    await page.evaluate(() => { __home.setTimeMode('night'); __residentUpdate(1 / 30); });
    const homeward = await advance('stairs', 0.4);
    assert.equal(homeward.route.kind, 'home-enter');
    await roundTrip('returning-home-stairs', homeward);
    await page.evaluate(() => { __home.setTimeMode('night'); });
    const sleeping = await advance('sleeping', 0.4);
    assert.deepEqual(sleeping.position, { x: identity.bed.x, y: identity.bed.y, z: identity.bed.z });
    assert.ok(Math.abs(Math.abs(sleeping.heading) - Math.PI) < 0.001);
    await page.evaluate(() => {
      const home = __home, resident = home.extras.resident;
      home.rig.showcase([-20, 3.5, 7.8], [resident.pos.x, resident.y + 0.3, resident.pos.z]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
    });
    await page.screenshot({ path: fileURLToPath(new URL(`resident-owner-${view.name}-bed.png`, output)) });
    await roundTrip('sleeping', sleeping);
    const daylight = await page.evaluate(() => { __residentUpdate(1 / 30); return __home.extras.resident.state === 'walking'; });
    assert.ok(daylight, 'An old night save must follow the current daytime schedule');
    const lifecycle = await page.evaluate(() => {
      const resident = __home.extras.resident;
      localStorage.removeItem(resident.storageKey);
      for (let frame = 0; frame < 100; frame++) __residentUpdate(1 / 30);
      const periodic = !!localStorage.getItem(resident.storageKey);
      __residentUpdate(1 / 30); dispatchEvent(new PageTransitionEvent('pagehide'));
      const hidden = JSON.parse(localStorage.getItem(resident.storageKey));
      return { periodic, error: Math.hypot(hidden.position.x - resident.pos.x, hidden.position.z - resident.pos.z) };
    });
    assert.ok(lifecycle.periodic && lifecycle.error < 0.001);
    await page.evaluate(() => { __home.setTimeMode('night'); __home.extras.nightConcert.update(1 / 30); __residentUpdate(1 / 30); });
    await roundTrip('concert', await advance('concert', 0.4));
    const blockedBoat = { ...boating, position: { x: 0, y: 0, z: 18 }, boat: { x: 0, y: -0.42, z: 18, yaw: 0 } };
    for (const malformed of ['broken', JSON.stringify({ version: 0 }), JSON.stringify({ ...sleeping, version: 1 }), JSON.stringify({ ...homeward, position: { x: 50000, y: 0, z: 0 } }), JSON.stringify(blockedBoat)]) {
      await page.evaluate(text => sessionStorage.setItem('resident-test-fixture', JSON.stringify({ key: __home.extras.resident.storageKey, text })), malformed);
      await page.reload(); await ready();
      assert.equal(await page.evaluate(() => __home.extras.resident.restored), false, 'Invalid saves must use the normal starting state');
      assert.equal(await page.evaluate(() => __home.extras.jetSki.occupied || !!__home.extras.jetSki.reservedBy), false);
    }
    assert.deepEqual(errors, []);
    report.push({ view: view.name, identity, checks, returned, daylight, lifecycle, errors });
    writeFileSync(new URL('resident-state-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: owner identity, bilingual greeting, workbench home, ${checks.length} real refresh restores; boat return, current day/night, periodic/pagehide saves and old-save fallback passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
