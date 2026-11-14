import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { RESIDENT_EVENTS } from '../world/resident-events.js';

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
    const context = await browser.newContext(view), page = await context.newPage(), errors = [], measurements = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    await context.addInitScript(() => {
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
      await page.evaluate(() => {
        const home = __home;
        home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle(); home.rig.skipIntro();
        window.__eventAdvance = seconds => { for (let frame = 0; frame < seconds * 30; frame++) __residentUpdate(1 / 30); };
        window.__eventSnapshot = () => {
          const resident = home.extras.resident;
          return { event: resident.event, state: resident.state, activity: resident.activity,
            position: { x: resident.pos.x, y: resident.y, z: resident.pos.z }, heading: resident.root.rotation.y,
            text: document.querySelector('.resident-greeting span').textContent, hidden: document.querySelector('.resident-greeting').hidden };
        };
      });
    }
    async function move(x, z, floor) {
      await page.evaluate(({ x, z, floor }) => { __home.player.teleport(x, z, { floor }); __residentUpdate(0.2); }, { x, z, floor });
    }
    async function camera(position, look) {
      await page.evaluate(({ position, look }) => {
        __home.rig.showcase(position, look);
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
        __residentUpdate(0.2);
      }, { position, look });
      await page.waitForTimeout(350);
    }
    async function screenshot(name) {
      await page.evaluate(() => __residentUpdate(0.2));
      const bubble = page.locator('.resident-greeting'), bounds = await bubble.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= view.viewport.width && bounds.y + bounds.height <= view.viewport.height, `${name}: ${JSON.stringify(bounds)}`);
      await page.screenshot({ path: fileURLToPath(new URL(`resident-events-${view.name}-${name}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
      measurements.push({ name, stats });
    }
    await page.goto(`${base}?lang=zh&debug`); await ready();
    await move(9.8, 46.5, 12);
    let snapshot = await page.evaluate(() => __eventSnapshot());
    assert.equal(snapshot.event, 'lehun'); assert.equal(snapshot.state, 'researching');
    assert.deepEqual(snapshot.position, RESIDENT_EVENTS.lehun.position);
    assert.equal(snapshot.hidden, true, 'Speech must not leak through the floor');
    const saved = await page.evaluate(() => {
      const resident = __home.extras.resident;
      resident.save(); return JSON.parse(localStorage.getItem(resident.storageKey));
    });
    assert.notEqual(saved.state, 'researching');
    await page.evaluate(() => { __home.setTimeMode('night'); __eventAdvance(30); });
    assert.equal(await page.evaluate(() => __home.extras.resident.state), 'researching', 'Event must override the night schedule');
    await move(13.8, 41.5, 19);
    await camera([14.3, 22.1, 43.1], [11.65, 20.2, 39.4]);
    snapshot = await page.evaluate(() => __eventSnapshot());
    assert.equal(snapshot.text, RESIDENT_EVENTS.lehun.lines[0][0]);
    const pose = await page.evaluate(() => {
      const avatar = __home.extras.resident.avatar, before = avatar.armR.rotation.x;
      __eventAdvance(0.4);
      return { before, after: avatar.armR.rotation.x, leg: avatar.legR.rotation.x };
    });
    assert.notEqual(pose.before, pose.after); assert.ok(pose.leg < -1.4);
    await screenshot('lehun-night');
    await page.evaluate(() => { __home.setTimeMode('day'); __home.stage.settle(); });
    await screenshot('lehun-day');
    await move(89, 18, 0);
    snapshot = await page.evaluate(() => __eventSnapshot());
    assert.equal(snapshot.event, 'qin'); assert.deepEqual(snapshot.position, RESIDENT_EVENTS.qin.position);
    assert.equal(snapshot.hidden, true, 'Hints must not appear across the island');
    assert.equal(await page.evaluate(() => __home.nav.canStand(156.5, 18)), true, 'Statue anchor must be clear');
    await move(156.5, 21, 0);
    await camera([151.4, 4.1, 23.5], [156.5, 1.5, 18]);
    assert.equal(await page.locator('.resident-greeting span').innerText(), RESIDENT_EVENTS.qin.lines[0][0]);
    await screenshot('qin-hint');
    await page.evaluate(() => __eventAdvance(7));
    assert.equal(await page.locator('.resident-greeting').isVisible(), false, 'Speech needs a quiet interval');
    await page.evaluate(() => __eventAdvance(8));
    assert.equal(await page.locator('.resident-greeting span').innerText(), RESIDENT_EVENTS.qin.lines[1][0]);
    await page.evaluate(async () => { (await import('/engine/lang.js')).setLang('en'); __residentUpdate(0.2); });
    assert.equal(await page.locator('.resident-greeting span').innerText(), RESIDENT_EVENTS.qin.lines[1][1]);
    await screenshot('qin-english');
    const modal = await page.evaluate(() => {
      const dialog = document.createElement('dialog');
      document.body.append(dialog); dialog.showModal(); __residentUpdate(0.2);
      const hidden = document.querySelector('.resident-greeting').hidden;
      dialog.close(); dialog.remove();
      return hidden;
    });
    assert.equal(modal, true, 'Dialogs must suppress event chatter');
    await page.evaluate(() => {
      __home.rig.showcase([151, 4, 23], [145, 3, 30]);
      for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
      __residentUpdate(0.2);
    });
    assert.equal(await page.locator('.resident-greeting').isVisible(), false, 'Offscreen NPCs must not leave floating captions');
    const encounter = await page.evaluate(() => {
      const encounter = __home.extras.qinIsland.encounter;
      return { phase: encounter.phase, alive: encounter.guards.some(guard => guard.life > 0) };
    });
    assert.equal(encounter.alive, false, 'Hints must not awaken the army');
    const cinematic = await page.evaluate(() => {
      const encounter = __home.extras.qinIsland.encounter;
      const descriptor = Object.getOwnPropertyDescriptor(encounter, 'active');
      try {
        Object.defineProperty(encounter, 'active', { get: () => true, configurable: true });
        __residentUpdate(0.2);
        return document.querySelector('.resident-greeting').hidden;
      } finally { Object.defineProperty(encounter, 'active', descriptor); }
    });
    assert.equal(cinematic, true, 'Story cinematics must suppress event chatter');
    await move(0.5, 18, 0); await page.evaluate(() => __eventAdvance(2));
    assert.equal(await page.evaluate(() => __home.extras.resident.event), null);
    assert.ok(!['researching', 'investigating'].includes(await page.evaluate(() => __home.extras.resident.state)));
    await move(156.5, 21, 0); assert.equal(await page.evaluate(() => __home.extras.resident.event), 'qin');
    await page.evaluate(() => { __home.extras.resident.save(); dispatchEvent(new PageTransitionEvent('pagehide')); });
    await page.reload(); await ready();
    assert.equal(await page.evaluate(() => __home.extras.resident.restored), true);
    assert.equal(await page.evaluate(() => __home.extras.resident.event), null);
    assert.ok(!['researching', 'investigating'].includes(await page.evaluate(() => __home.extras.resident.state)));
    const boat = await page.evaluate(() => {
      const home = __home, resident = home.extras.resident, jet = home.extras.jetSki, random = Math.random;
      home.player.teleport(0.5, 18); jet.ski.position.set(-45, -0.42, 0); jet.ski.rotation.set(0, Math.PI / 2, 0);
      let frames = 0;
      try {
        Math.random = () => 0.6;
        while (resident.state !== 'boating' && frames++ < 12000) __residentUpdate(1 / 30);
      } finally { Math.random = random; }
      const boarded = resident.state === 'boating';
      home.player.teleport(9.8, 46.5, { floor: 12 }); __residentUpdate(0.2);
      const released = !jet.occupied && !jet.reservedBy && !resident.vehicle;
      resident.save();
      const stored = JSON.parse(localStorage.getItem(resident.storageKey));
      home.player.teleport(0.5, 18); __eventAdvance(2.2);
      return { boarded, released, stored: stored.state, resumed: resident.state, owned: jet.reservedBy === resident };
    });
    assert.ok(boat.boarded && boat.released && boat.stored === 'boating' && boat.resumed === 'boating' && boat.owned, JSON.stringify(boat));
    const borrowed = await page.evaluate(() => {
      const home = __home, resident = home.extras.resident, jet = home.extras.jetSki;
      home.player.teleport(9.8, 46.5, { floor: 12 }); __residentUpdate(0.2);
      const visitor = {};
      const reserved = jet.reserve(visitor);
      home.player.teleport(0.5, 18); __eventAdvance(2.2);
      const safe = jet.reservedBy === visitor && !resident.vehicle && resident.event === null;
      jet.release(visitor);
      return { reserved, safe };
    });
    assert.ok(borrowed.reserved && borrowed.safe, 'Resuming an event must not steal a borrowed boat');
    assert.deepEqual(errors, []);
    report.push({ view: view.name, saved: saved.state, pose, encounter, modal, cinematic, boat, borrowed, measurements, errors });
    writeFileSync(new URL('resident-events-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: region entry, night priority, research pose, timed bilingual hints, offscreen suppression, re-entry, reload and boat recovery passed`);
    await context.close();
  }
} finally { await browser.close(); }
