import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { findShoreExit, routeShoreExit } from '../engine/world/shore.js';

const shore = {
  heightAt: () => 0,
  isBlocked: (x, z) => z >= 29,
  canStand: (x, z) => z <= 28.72,
};
const found = { edge: {}, out: {} };
assert.ok(findShoreExit(shore, 0, 29.7, 0, -1, -0.32, 1.2, found));
assert.ok(found.edge.z >= 29.3 && found.out.z < 29);
assert.equal(findShoreExit(shore, 0, 29.7, 0, 1, -0.32, 1.2, found), false);
assert.equal(findShoreExit(shore, 0, 29.7, 0, 0, -0.32, 1.2, found), false);
assert.ok(routeShoreExit(shore, 0, 38, 0, 22, -0.32));
assert.equal(routeShoreExit(shore, 0, 38, 0, 40, -0.32), null);
assert.equal(findShoreExit({ ...shore, heightAt: () => 12 }, 0, 29.7, 0, -1, -0.32, 1.2, found), false);

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));

try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const coast = await page.evaluate(async () => {
      const home = __home, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      const advance = (frames, input = idle) => {
        for (let frame = 0; frame < frames; frame++) player.update(1 / 60, input, 0);
      };
      const drop = (x, z) => {
        player.teleport(0, 28);
        player.startFlying();
        player.pos.x = x;
        player.pos.z = z;
        player.stopFlying();
        advance(300);
      };
      const cases = [-30, -24, -12, 0, 16, 24, 30].map(x => ({ x, z: 30.7, dx: 0, dz: -1, south: true }));
      cases.push({ x: -36.2, z: 0, dx: 1, dz: 0 }, { x: 38.2, z: 0, dx: -1, dz: 0 }, { x: 0, z: -26.2, dx: 0, dz: 1 });
      const results = [];
      for (const test of cases) {
        drop(test.x, test.z);
        const start = player.mode;
        let climb = null;
        const original = home.avatar.update;
        home.avatar.update = (dt, pose) => {
          if (!climb && pose.swim?.climb) climb = { x: player.pos.x, z: player.pos.z };
          original(dt, pose);
        };
        const input = { ...idle, x: test.dx, z: test.dz };
        for (let frame = 0; frame < 600 && player.mode !== 'ground'; frame++) player.update(1 / 60, input, 0);
        home.avatar.update = original;
        results.push({ ...test, start, climb, mode: player.mode, x: player.pos.x, z: player.pos.z, stand: home.nav.canStand(player.pos.x, player.pos.z) });
      }
      drop(0, 33);
      const clicked = player.leavePool(0, 26);
      for (let frame = 0; frame < 1800 && player.mode !== 'ground'; frame++) player.update(1 / 60, idle, 0);
      const clickedExit = { accepted: clicked, mode: player.mode, z: player.pos.z, stand: home.nav.canStand(player.pos.x, player.pos.z) };
      const { BOARDWALK } = await import('@world/layout.js');
      const planks = [];
      for (let x = BOARDWALK.x0; x <= BOARDWALK.x1; x += BOARDWALK.step) {
        player.teleport(x, BOARDWALK.z);
        home.extras.fishing.update(0);
        planks.push({ x, stand: home.nav.canStand(x, BOARDWALK.z), available: !document.querySelector('#fishingPrompt').hidden });
      }
      player.teleport(-10, 28.25);
      return { results, clickedExit, planks };
    });
    for (const test of coast.results) {
      assert.equal(test.start, 'swim', `Not swimming: ${JSON.stringify(test)}`);
      assert.equal(test.mode, 'ground', `Could not climb ashore: ${JSON.stringify(test)}`);
      assert.ok(test.stand && test.climb, `Invalid climb: ${JSON.stringify(test)}`);
      if (test.south) assert.ok(test.climb.z >= 29.3, `Swam inside the land before climbing: ${JSON.stringify(test)}`);
    }
    assert.ok(coast.clickedExit.accepted && coast.clickedExit.mode === 'ground' && coast.clickedExit.stand, `Click-to-exit failed: ${JSON.stringify(coast.clickedExit)}`);
    assert.ok(coast.planks.every(plank => plank.stand && plank.available), `Boardwalk not fully fishable: ${JSON.stringify(coast.planks.filter(plank => !plank.stand || !plank.available))}`);
    await page.waitForFunction(() => !document.querySelector('#fishingPrompt').hidden);
    if (view.hasTouch) await page.locator('#fishingPrompt').tap();
    else await page.keyboard.press('f');
    await page.waitForFunction(() => __home.extras.fishing.phase === 'waiting');
    assert.ok(await page.evaluate(() => __home.stage.scene.getObjectByName('beach-fishing').visible));
    await page.evaluate(() => {
      __home.rig.showcase([-15, 6.5, 38.5], [-10.3, 0.7, 30.7]);
      for (let frame = 0; frame < 60; frame++) __home.rig.update(1 / 60, __home.player);
      __home.extras.fishing.update(0);
    });
    if (view.hasTouch) {
      const layout = await page.evaluate(() => {
        const rect = id => document.getElementById(id).getBoundingClientRect();
        const intersects = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
        const prompt = rect('fishingPrompt'), status = rect('fishingStatus'), map = rect('minimap'), dock = rect('hotbar');
        return { promptMap: intersects(prompt, map), statusMap: intersects(status, map), promptDock: intersects(prompt, dock), statusPrompt: intersects(status, prompt) };
      });
      assert.ok(Object.values(layout).every(overlap => !overlap), `Fishing UI overlaps the mobile HUD: ${JSON.stringify(layout)}`);
    }
    await page.screenshot({ path: fileURLToPath(new URL(`beach-fishing-${view.name}.png`, output)) });
    await page.evaluate(() => {
      const fishing = __home.extras.fishing;
      if (fishing.phase === 'idle' || fishing.phase === 'result') fishing.interact();
      if (fishing.phase === 'casting') fishing.update(0.71);
      if (fishing.phase === 'waiting') fishing.update(8);
    });
    await page.waitForFunction(() => __home.extras.fishing.phase === 'bite');
    if (view.hasTouch) await page.locator('#fishingPrompt').tap();
    else await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.extras.fishing.caught), 1);
    assert.match(await page.locator('#fishingStatus strong').textContent(), /钓到/);
    if (view.hasTouch) await page.locator('#fishingPrompt').tap();
    else await page.keyboard.press('f');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __home.extras.fishing.phase), 'idle');
    await page.evaluate(() => {
      __home.extras.fishing.interact();
      __home.extras.fishing.interact();
    });
    assert.equal(await page.evaluate(() => __home.extras.fishing.caught), 1);
    assert.match(await page.locator('#fishingStatus strong').textContent(), /已收竿/);
    await page.evaluate(() => {
      const fishing = __home.extras.fishing;
      fishing.interact();
      fishing.update(0.71);
      fishing.update(8);
      fishing.update(1.9);
    });
    assert.match(await page.locator('#fishingStatus strong').textContent(), /溜走/);
    await page.evaluate(() => {
      __home.extras.fishing.interact();
      __home.player.teleport(-10, 26);
      __home.extras.fishing.update(0);
    });
    assert.equal(await page.evaluate(() => __home.extras.fishing.phase), 'idle');
    assert.ok(await page.locator('#fishingPrompt').isHidden());
    await page.evaluate(() => {
      __home.player.teleport(-10, 28.25);
      __home.extras.fishing.update(0);
      __home.extras.fishing.interact();
      __home.openPage('about');
      __home.extras.fishing.update(0);
    });
    assert.equal(await page.evaluate(() => __home.extras.fishing.phase), 'idle');
    assert.ok(await page.locator('#fishingPrompt').isHidden());
    await page.locator('#panel .close').click();
    await page.waitForFunction(() => !document.body.classList.contains('reading'));
    await page.evaluate(async () => (await import('@engine/lang.js')).setLang('en'));
    await page.waitForFunction(() => !document.querySelector('#fishingPrompt').hidden);
    assert.equal(await page.locator('#fishingPrompt span').textContent(), 'Fish');
    await page.evaluate(() => __home.extras.fishing.interact());
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= stats.budget.calls && stats.triangles <= stats.budget.triangles, `Over budget: ${JSON.stringify(stats)}`);
    if (view.hasTouch) {
      for (const viewport of [{ width: 320, height: 640 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        const layout = await page.evaluate(() => {
          const rect = id => document.getElementById(id).getBoundingClientRect();
          const intersects = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
          const prompt = rect('fishingPrompt'), status = rect('fishingStatus'), map = rect('minimap'), dock = rect('hotbar');
          return { promptMap: intersects(prompt, map), statusMap: intersects(status, map), promptDock: intersects(prompt, dock), statusPrompt: intersects(status, prompt), fits: status.top >= 0 && prompt.left >= 0 && prompt.right <= innerWidth };
        });
        assert.ok(layout.fits && !layout.promptMap && !layout.statusMap && !layout.promptDock && !layout.statusPrompt,
          `Fishing HUD overlaps at ${viewport.width}×${viewport.height}: ${JSON.stringify(layout)}`);
      }
    }
    assert.deepEqual(errors, []);
    console.log(`${view.name}: 10 coast exits, clicked shore, ${coast.planks.length} fishing positions, F/touch, catch, early reel, missed bite, cancel, overlays and language passed; ${stats.calls} calls, ${stats.triangles} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
