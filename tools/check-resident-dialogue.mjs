import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { RESIDENT_TOPICS, RESIDENT_WELCOME } from '../world/resident-dialogue-data.js';

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
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
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
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__residentUpdate || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.evaluate(() => {
      const home = __home;
      home.weather.dispose(); home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle(); home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
      home.player.teleport(13.8, 41.5, { floor: 19 });
      home.rig.showcase([14.3, 22.1, 43.1], [11.65, 20.2, 39.4]);
      for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      __residentUpdate(0.2); __residentUpdate(0.2);
    });
    const dialog = page.locator('#residentDialogue'), prompt = page.locator('#residentPrompt');
    assert.equal(await prompt.isVisible(), true);
    if (view.isMobile) await prompt.tap();
    else await page.keyboard.press('f');
    assert.equal(await dialog.isVisible(), true);
    assert.equal(await dialog.locator('.resident-answer p').innerText(), RESIDENT_WELCOME[0]);
    assert.equal(await dialog.locator('[data-topic]').count(), RESIDENT_TOPICS.length);
    const paused = await page.evaluate(() => {
      const resident = __home.extras.resident, before = [resident.pos.x, resident.y, resident.pos.z, resident.state, resident.event];
      for (let frame = 0; frame < 120; frame++) __residentUpdate(1 / 30);
      resident.save();
      return { before, after: [resident.pos.x, resident.y, resident.pos.z, resident.state, resident.event],
        saved: JSON.parse(localStorage.getItem(resident.storageKey)).state };
    });
    assert.deepEqual(paused.before, paused.after); assert.notEqual(paused.saved, 'researching');
    for (const language of [0, 1]) {
      if (language) await dialog.locator('.lang-switch').click();
      for (const topic of RESIDENT_TOPICS) {
        const button = dialog.locator(`[data-topic="${topic.id}"]`);
        if (view.isMobile) await button.tap(); else await button.click();
        assert.equal(await dialog.locator('.resident-answer p').innerText(), topic.answer[language]);
        assert.equal(await button.getAttribute('aria-pressed'), 'true');
        assert.equal(await dialog.locator('[aria-pressed="true"]').count(), 1);
      }
    }
    await dialog.locator('[data-topic="qin-legend"]').focus();
    await page.keyboard.press('Enter');
    assert.equal(await dialog.locator('.resident-answer p').innerText(), RESIDENT_TOPICS[0].answer[1]);
    await page.keyboard.press('Tab'); await page.keyboard.press('Space');
    assert.equal(await dialog.locator('.resident-answer p').innerText(), RESIDENT_TOPICS[1].answer[1]);
    const position = await page.evaluate(() => ({ x: __home.player.pos.x, y: __home.player.y, z: __home.player.pos.z, mode: __home.player.mode }));
    for (const key of ['w', 'm', 'p', '1', 'v']) await page.keyboard.press(key);
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => ({ x: __home.player.pos.x, y: __home.player.y, z: __home.player.pos.z, mode: __home.player.mode })), position);
    assert.equal(await page.evaluate(() => document.querySelector('#bigmap').hidden && !document.querySelector('#phone').classList.contains('up')), true);
    await dialog.locator('.lang-switch').click();
    await dialog.locator('[data-topic="qin-legend"]').click();
    await page.evaluate(() => { document.querySelector('.resident-dialogue-body').scrollTop = 0; });
    await page.screenshot({ path: fileURLToPath(new URL(`resident-dialogue-${view.name}.png`, output)) });
    const bounds = await dialog.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= view.viewport.width && bounds.y + bounds.height <= view.viewport.height, JSON.stringify(bounds));
    if (view.isMobile) {
      for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        const measured = await dialog.boundingBox();
        assert.ok(measured.x >= 0 && measured.y >= 0 && measured.x + measured.width <= viewport.width && measured.y + measured.height <= viewport.height, JSON.stringify(measured));
        await dialog.locator('[data-topic="about-host"]').tap();
        assert.equal(await dialog.locator('.resident-answer p').innerText(), RESIDENT_TOPICS[5].answer[0]);
        assert.equal(await dialog.locator('.resident-dialogue-body').evaluate(element => element.scrollTop), 0, 'Selecting a topic reveals the answer on small screens');
        await page.screenshot({ path: fileURLToPath(new URL(`resident-dialogue-${viewport.width}.png`, output)) });
      }
      await page.setViewportSize(view.viewport);
    }
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), false);
    assert.equal(await page.evaluate(() => document.body.classList.contains('resident-talking')), false);
    await page.evaluate(() => __residentUpdate(0.2));
    assert.equal(await page.evaluate(() => __home.extras.resident.state), 'researching');
    await prompt.click(); await page.keyboard.down('f'); await page.keyboard.down('f'); await page.keyboard.up('f');
    assert.equal(await dialog.isVisible(), false, 'Holding F must not reopen the dialogue');
    await page.evaluate(() => {
      __home.player.teleport(9.8, 46.5, { floor: 12 }); __residentUpdate(0.2);
    });
    assert.equal(await prompt.isVisible(), false);
    assert.equal(await page.evaluate(() => __home.extras.resident.interact()), false, 'No conversations through the floor');
    await page.evaluate(() => {
      const home = __home;
      home.player.teleport(156.5, 21, { floor: 0 });
      home.rig.showcase([151.4, 4.1, 23.5], [156.5, 1.5, 18]);
      for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      __residentUpdate(0.2); __residentUpdate(0.2);
    });
    await prompt.click();
    await dialog.locator('[data-topic="qin-legend"]').click();
    const legend = await page.evaluate(() => {
      const encounter = __home.extras.qinIsland.encounter;
      return { seal: encounter.hasSeal, alive: encounter.guards.some(guard => guard.life > 0) };
    });
    assert.deepEqual(legend, { seal: false, alive: false });
    await dialog.locator('[data-close]').click();
    const tapPoint = await page.evaluate(async () => {
      const { Vector3 } = await import('three');
      const home = __home, resident = home.extras.resident;
      const projected = new Vector3(resident.pos.x, resident.y + 1.5, resident.pos.z).project(home.stage.camera);
      return { x: (projected.x + 1) * innerWidth / 2, y: (1 - projected.y) * innerHeight / 2 };
    });
    if (view.isMobile) await page.touchscreen.tap(tapPoint.x, tapPoint.y);
    else await page.mouse.click(tapPoint.x, tapPoint.y);
    assert.equal(await dialog.isVisible(), true, 'Tapping the NPC opens dialogue through the real canvas input');
    await page.evaluate(() => { __home.player.teleport(0.5, 18); __residentUpdate(0.2); });
    assert.equal(await dialog.isVisible(), false, 'Teleporting away closes the conversation');
    const priority = await page.evaluate(() => {
      const resident = __home.extras.resident, encounter = __home.extras.qinIsland.encounter;
      __home.player.teleport(156.5, 21, { floor: 0 }); __residentUpdate(0.2);
      const descriptor = Object.getOwnPropertyDescriptor(encounter, 'ready');
      try {
        Object.defineProperty(encounter, 'ready', { get: () => true, configurable: true });
        __residentUpdate(0.2); return resident.interact();
      } finally { Object.defineProperty(encounter, 'ready', descriptor); }
    });
    assert.equal(priority, false, 'Emperor interaction retains priority');
    await page.evaluate(() => {
      __home.player.teleport(0.5, 18);
      for (let frame = 0; frame < 90; frame++) __residentUpdate(1 / 30);
    });
    assert.equal(await page.evaluate(() => __home.extras.resident.event), null);
    const walking = await page.evaluate(() => {
      const home = __home, resident = home.extras.resident, random = Math.random;
      let frames = 0;
      try {
        Math.random = () => 0.9;
        while ((resident.state !== 'walking' || resident.y > 0.1 || resident.pos.z < 15) && frames++ < 2000) __residentUpdate(1 / 30);
      } finally { Math.random = random; }
      home.player.teleport(resident.pos.x, resident.pos.z + 1, { floor: 0 });
      const opened = resident.interact(), before = { ...resident.pos };
      for (let frame = 0; frame < 90; frame++) __residentUpdate(1 / 30);
      resident.save();
      const stayed = Math.hypot(resident.pos.x - before.x, resident.pos.z - before.z) < 0.001;
      const stored = JSON.parse(localStorage.getItem(resident.storageKey));
      resident.dialogue.close();
      for (let frame = 0; frame < 30; frame++) __residentUpdate(1 / 30);
      const moved = Math.hypot(resident.pos.x - before.x, resident.pos.z - before.z) > 0.2;
      return { opened, stayed, moved, saved: stored.state };
    });
    assert.ok(walking.opened && walking.stayed && walking.moved && walking.saved === 'walking', JSON.stringify(walking));
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, topics: RESIDENT_TOPICS.length, languages: 2, paused, legend, tapPoint, walking, priority, stats, errors });
    writeFileSync(new URL('resident-dialogue-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: six bilingual choices, keyboard/touch, modal input isolation, layout, NPC pause, safe lore hints and event recovery passed`);
    await context.close();
  }
} finally { await browser.close(); }
