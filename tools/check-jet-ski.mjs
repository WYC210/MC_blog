import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

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
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.extras?.jetSki || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const result = await page.evaluate(() => {
      const home = __home, player = home.player, jet = home.extras.jetSki;
      const idle = { x: 0, z: 0, up: false, down: false, run: false };
      const forward = { ...idle, z: -1 }, reverse = { ...idle, z: 1 };
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      function advance(frames, input = idle) {
        for (let frame = 0; frame < frames; frame++) { player.update(1 / 60, input, 0); jet.update(1 / 60); }
      }
      function approach(x = -45, z = 0, yaw = 0) {
        player.teleport(0, 18);
        jet.ski.position.set(x, -0.42, z); jet.ski.rotation.set(0, yaw, 0); jet.update(0.1);
        player.startFlying(); player.pos.x = -12; player.pos.z = -33; player.stopFlying(); advance(300);
        player.pos.x = x - Math.cos(yaw) * 2; player.pos.z = z + Math.sin(yaw) * 2;
        jet.update(0.1);
        return jet.canBoard();
      }
      window.__jetSkiTest = { advance, approach, idle, forward, reverse };
      const corners = [[-35, -24], [-35, -22], [-34, -24]].map(([x, z]) => ({ x, z, clear: jet.canFloat(x, z, 0), floor: !!home.world.grid.type(x, -4, z) }));
      const landBlocked = !jet.canFloat(-20, 0, 0);
      const towerBlocked = !jet.canFloat(15, -30, 0);
      const duckBlocked = !jet.canFloat(0.5, -33.5, 0);
      const distant = jet.interact();
      const approached = approach();
      const mounted = jet.interact();
      const initialX = jet.ski.position.x, initialZ = jet.ski.position.z;
      advance(120, { ...idle, x: 1 });
      const stationaryTurn = Math.abs(jet.ski.rotation.y) > 0.7 && Math.hypot(jet.ski.position.x - initialX, jet.ski.position.z - initialZ) < 0.01;
      approach(); jet.interact(); advance(120, forward);
      const accelerated = jet.speed > 10;
      advance(120, { ...idle, up: true });
      const braked = Math.abs(jet.speed) < 0.01 && player.mode === 'vehicle';
      const beforeReverse = jet.ski.position.z;
      advance(120, reverse);
      const reversed = jet.speed < -3 && jet.ski.position.z < beforeReverse - 3;
      approach(-45, -20); jet.interact(); advance(180, { ...forward, run: true });
      const boosted = jet.speed > 16;
      const coasts = [];
      for (const [name, x, z, yaw] of [
        ['north', -14, -33, 0], ['south', -12, 36, Math.PI],
        ['west', -42, 0, Math.PI / 2], ['east', 44, 0, -Math.PI / 2],
        ['rounded-corner', -35, -24, 0], ['world-edge', -45, -43, Math.PI],
      ]) {
        const reachable = approach(x, z, yaw), boarded = jet.interact();
        advance(360, forward);
        const stopped = Math.abs(jet.speed) < 0.01;
        const safe = jet.canFloat(jet.ski.position.x, jet.ski.position.z, jet.ski.rotation.y);
        const travelled = Math.hypot(jet.ski.position.x - x, jet.ski.position.z - z);
        const stopX = jet.ski.position.x, stopZ = jet.ski.position.z;
        advance(120, reverse);
        const escaped = Math.hypot(jet.ski.position.x - stopX, jet.ski.position.z - stopZ) > 2;
        const off = jet.interact();
        const swimming = player.swimming;
        const reboard = jet.interact();
        coasts.push({ name, reachable, boarded, stopped, safe, travelled, escaped, off, swimming, reboard });
      }
      return { corners, landBlocked, towerBlocked, duckBlocked, distant, approached, mounted, stationaryTurn, accelerated, braked, reversed, boosted, coasts };
    });
    assert.ok(result.corners.every(point => point.clear && point.floor), `Invisible coast boundary or missing seabed: ${JSON.stringify(result.corners)}`);
    assert.ok(result.landBlocked && result.towerBlocked && result.duckBlocked);
    assert.equal(result.distant, false);
    for (const key of ['approached', 'mounted', 'stationaryTurn', 'accelerated', 'braked', 'reversed', 'boosted']) assert.ok(result[key], `Driving failed: ${key}`);
    for (const coast of result.coasts) {
      assert.ok(coast.reachable && coast.boarded && coast.stopped && coast.safe && coast.escaped && coast.off && coast.swimming && coast.reboard, `Coast regression: ${JSON.stringify(coast)}`);
      if (coast.name === 'rounded-corner') assert.ok(coast.travelled > 2, 'The old rectangular water mask still blocks the rounded coast');
    }
    console.log(`${view.name}: rounded-coast regression, six boundaries, reverse escape, stationary steering, throttle/brake/boost and remount passed`);

    await page.evaluate(() => { __jetSkiTest.approach(-45, 0); });
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.player.mode), 'vehicle');
    await page.keyboard.down('w');
    await page.waitForFunction(() => __home.extras.jetSki.speed > 1);
    await page.keyboard.up('w');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    assert.equal(await page.evaluate(() => __home.player.mode), 'vehicle', 'Repeated braking must not trigger flight');
    await page.keyboard.press('m');
    await page.waitForFunction(() => !__home.extras.jetSki.speed);
    await page.locator('#jetSkiPrompt').waitFor({ state: 'hidden' });
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    await page.waitForFunction(() => !__home.extras.jetSki.speed);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __home.player.swimming), true);

    const tapPoint = await page.evaluate(async () => {
      const home = __home, jet = home.extras.jetSki;
      __jetSkiTest.approach(-35, -24);
      home.rig.showcase([-40, 4, -28], [-35, 0.4, -24]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
      const THREE = await import('three');
      const point = new THREE.Vector3(jet.ski.position.x, 0.3, jet.ski.position.z).project(home.stage.camera);
      return { x: (point.x + 1) * innerWidth / 2, y: (1 - point.y) * innerHeight / 2 };
    });
    await page.mouse.click(tapPoint.x, tapPoint.y);
    await page.waitForFunction(() => __home.player.mode === 'vehicle');
    await page.screenshot({ path: fileURLToPath(new URL(`jet-ski-rounded-coast-${view.name}.png`, output)) });

    if (view.hasTouch) {
      const wheel = page.locator('#jetSkiPad .wheel');
      const touch = await context.newCDPSession(page);
      const target = await wheel.boundingBox();
      const center = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
      assert.equal(await page.evaluate(() => __home.extras.jetSki.controls.z), 0);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x, y: center.y - 24 }] });
      const throttle = await page.evaluate(() => __home.extras.jetSki.controls.z);
      assert.ok(throttle < -0.2 && throttle > -0.95, 'Joystick must support analog throttle');
      await page.waitForFunction(() => __home.extras.jetSki.speed > 0.3);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      assert.equal(await page.evaluate(() => __home.extras.jetSki.controls.z), 0);
      await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [center] });
      await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: center.x + 100, y: center.y - 100 }] });
      const vector = await page.evaluate(() => ({ x: __home.extras.jetSki.controls.x, z: __home.extras.jetSki.controls.z }));
      assert.ok(vector.x > 0 && vector.z < 0 && Math.hypot(vector.x, vector.z) <= 1.001, 'Dragging outside the wheel must clamp steering');
      await touch.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
      assert.equal(await page.evaluate(() => __home.extras.jetSki.controls.z), 0);
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 640 }, { width: 844, height: 390 }]) {
        await page.setViewportSize(viewport);
        const overlaps = await page.evaluate(() => {
          const map = document.querySelector('#minimap').getBoundingClientRect();
          const dock = document.querySelector('#hotbar').getBoundingClientRect();
          const selectors = ['#jetSkiPrompt', '#jetSkiStatus', '#jetSkiPad .steer', '#jetSkiPad .power'];
          const intersects = (first, second) => first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
          const boxes = selectors.map(selector => document.querySelector(selector).getBoundingClientRect());
          return boxes.map((box, index) => ({ selector: selectors[index], map: intersects(box, map), dock: intersects(box, dock),
            other: boxes.some((other, otherIndex) => index !== otherIndex && intersects(box, other)),
            outside: box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight }));
        });
        assert.ok(overlaps.every(box => !box.map && !box.dock && !box.other && !box.outside), `Mobile HUD overlap ${JSON.stringify(viewport)}: ${JSON.stringify(overlaps)}`);
      }
      await page.setViewportSize(view.viewport);
    }
    await page.locator('#jetSkiPrompt').click();
    assert.equal(await page.evaluate(() => __home.player.swimming), true);
    await page.locator('#jetSkiPrompt').click();
    assert.equal(await page.evaluate(() => __home.player.mode), 'vehicle');
    const cleanup = await page.evaluate(() => {
      const home = __home;
      home.player.teleport(0, 18); home.extras.jetSki.update(0.1);
      return { driving: home.extras.jetSki.driving, speed: home.extras.jetSki.speed, hidden: document.querySelector('#jetSkiPad').hidden, stats: home.stats() };
    });
    assert.ok(!cleanup.driving && !cleanup.speed && cleanup.hidden);
    assert.ok(cleanup.stats.calls <= 60 && cleanup.stats.triangles <= 200000);
    assert.deepEqual(errors, []);
    console.log(`${view.name}: F/Esc, model tap, modal pause, touch release, safe dismount and teleport cleanup; ${cleanup.stats.calls} calls, ${cleanup.stats.triangles} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
