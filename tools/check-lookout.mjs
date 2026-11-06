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
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.extras?.lookout || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);

    const arrival = await page.evaluate(async () => {
      const home = __home, player = home.player, lookout = home.extras.lookout;
      const { LOOKOUT, SPAWN } = await import('@world/layout.js');
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      window.__lookoutTest = {
        point: LOOKOUT,
        advance(frames) {
          for (let frame = 0; frame < frames; frame++) {
            player.update(1 / 60, idle, home.rig.yaw);
            home.rig.update(1 / 60, player);
            home.stage.setClearance(0);
            lookout.update(1 / 60);
          }
        },
        reenter() {
          player.teleport(0.5, -18);
          this.advance(120);
          player.teleport(...LOOKOUT.at);
          this.advance(120);
        },
      };
      home.setWeatherMode('clear');
      home.setTimeMode('day');
      home.stage.settle();
      home.rig.skipIntro();
      __lookoutTest.advance(240);
      player.teleport(SPAWN.x, SPAWN.z);
      lookout.update(0);
      const accepted = home.navigate(...LOOKOUT.at);
      let flew = false, premature = false;
      for (let frame = 0; frame < 4000 && player.travelling; frame++) {
        __lookoutTest.advance(1);
        flew ||= player.flying;
        premature ||= lookout.active;
      }
      const arrived = !player.travelling && Math.hypot(player.pos.x - LOOKOUT.at[0], player.pos.z - LOOKOUT.at[1]) < 0.3;
      __lookoutTest.advance(150);
      const lamps = home.world.lighting.sources.filter(source => source.id.startsWith('lookout-'));
      return {
        accepted, flew, premature, arrived, active: lookout.active,
        deck: home.world.grid.type(0, -1, -23)?.name,
        standable: home.nav.canStand(...LOOKOUT.at),
        telescopeBlocked: !home.nav.canStand(1.75, -22.8),
        lamps: lamps.length,
        lampsUnblocked: lamps.every(source => !home.world.grid.type(...source.position.map(Math.floor))),
      };
    });
    assert.deepEqual(arrival, {
      accepted: true, flew: false, premature: false, arrived: true, active: false,
      deck: 'deck', standable: true, telescopeBlocked: true, lamps: 2, lampsUnblocked: true,
    }, `${view.name}: walk from spawn without automatically taking over the camera`);
    await page.keyboard.press('f');
    await page.waitForFunction(() => __home.extras.lookout.active);

    for (const mode of ['day', 'night']) {
      await page.evaluate(mode => {
        __home.setTimeMode(mode);
        __home.stage.settle();
        __lookoutTest.advance(120);
      }, mode);
      await page.waitForTimeout(500);
      const frame = await page.evaluate(async () => {
        const { Vector3 } = await import('three');
        const camera = __home.stage.camera, point = __lookoutTest.point;
        camera.updateMatrixWorld();
        const landmarks = [
          [-35, 0, -25], [37, 0, -25], [-35, 0, 30], [37, 0, 30],
          [25.5, 49, 7.5], [18, 25, -14], [33, 25, 29],
          [-29, 15, -2], [-13, 15, 14], [-21, 34, 6],
          [1, 28, 34], [19, 28, 52], [9, 4, 43], [-5, 0, -10],
        ].map(position => new Vector3(...position).project(camera).toArray());
        return {
          camera: camera.position.toArray(), expected: camera.aspect < 0.8 ? point.portrait : point.camera,
          framed: landmarks.every(position => Math.abs(position[0]) < 0.95 && Math.abs(position[1]) < 0.95 && position[2] < 1),
          landmarks, stats: __home.stats(),
        };
      });
      assert.ok(frame.camera.every((value, index) => Math.abs(value - frame.expected[index]) < 0.01), `${view.name}: full camera pullback`);
      assert.equal(frame.framed, true, `${view.name}: island and all landmarks fit in frame: ${JSON.stringify(frame.landmarks)}`);
      assert.ok(frame.stats.calls <= frame.stats.budget.calls, `${view.name}: ${frame.stats.calls} calls`);
      assert.ok(frame.stats.triangles <= frame.stats.budget.triangles);
      assert.equal(frame.stats.lights, 0);
      await page.screenshot({ path: fileURLToPath(new URL(`lookout-${view.name}-${mode}.png`, output)) });
      console.log(`${view.name} ${mode}: ${frame.stats.calls} calls, ${frame.stats.triangles} triangles, all landmarks in frame`);
    }

    const snapshot = () => page.evaluate(async () => {
      const { Vector3 } = await import('three');
      const camera = __home.stage.camera;
      const offset = camera.position.clone().sub(new Vector3(...__lookoutTest.point.focus));
      return {
        camera: camera.position.toArray(), radius: offset.length(), direction: offset.normalize().toArray(),
        player: __home.player.pos.toArray(), active: __home.extras.lookout.active,
        travelling: __home.player.travelling, mode: __home.player.mode,
      };
    });
    const initialView = await snapshot();
    const centerX = view.viewport.width / 2, centerY = view.viewport.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 100, centerY + 40, { steps: 10 });
    await page.mouse.up();
    await page.evaluate(() => __lookoutTest.advance(150));
    const orbited = await snapshot();
    assert.equal(orbited.active, true, 'dragging stays in free view');
    assert.ok(Math.hypot(...orbited.camera.map((value, index) => value - initialView.camera[index])) > 20, 'dragging rotates the distant camera');
    assert.deepEqual(orbited.player, initialView.player, 'orbiting does not move the player');
    assert.ok(Math.abs(orbited.radius - initialView.radius) < 0.01, 'orbiting preserves the viewing distance');

    await page.mouse.wheel(0, -200);
    await page.evaluate(() => __lookoutTest.advance(150));
    const zoomed = await snapshot();
    assert.equal(zoomed.active, true, 'scrolling stays in free view');
    assert.ok(zoomed.radius < orbited.radius - 5, 'the scroll wheel zooms the distant view');
    await page.mouse.click(centerX, centerY);
    await page.keyboard.down('w');
    await page.waitForTimeout(300);
    await page.keyboard.up('w');
    await page.keyboard.press('Space');
    await page.evaluate(() => __lookoutTest.advance(180));
    const held = await snapshot();
    assert.equal(held.active, true, 'clicks and movement keys do not exit');
    assert.equal(held.travelling, false, 'clicks do not navigate to the distant scenery');
    assert.equal(held.mode, 'ground', 'movement keys do not make the player jump or fly');
    assert.deepEqual(held.player, initialView.player, 'the character stays at the lookout');

    if (view.isMobile) {
      const session = await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 140, y: 350, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 220, y: 380, id: 1 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.evaluate(() => __lookoutTest.advance(150));
      const touched = await snapshot();
      assert.equal(touched.active, true, 'single-finger orbit stays in free view');
      assert.ok(Math.hypot(...touched.camera.map((value, index) => value - held.camera[index])) > 10, 'a single finger orbits');
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: 380, id: 1 }, { x: 260, y: 380, id: 2 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 140, y: 380, id: 1 }, { x: 240, y: 380, id: 2 }] });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.evaluate(() => __lookoutTest.advance(150));
      const pinched = await snapshot();
      assert.equal(pinched.active, true, 'pinching stays in free view');
      assert.ok(pinched.radius > touched.radius + 10, 'a two-finger pinch zooms out');
      assert.deepEqual(pinched.player, initialView.player);
      await session.detach();
    }

    await page.waitForTimeout(300);
    await page.screenshot({ path: fileURLToPath(new URL(`lookout-${view.name}-orbit.png`, output)) });
    const beforeResize = await snapshot();
    const rotated = view.name === 'phone' ? { width: 844, height: 390 } : { width: 600, height: 900 };
    await page.setViewportSize(rotated);
    await page.evaluate(() => __lookoutTest.advance(150));
    const afterResize = await snapshot();
    assert.equal(afterResize.active, true, 'resizing keeps free view open');
    assert.ok(afterResize.direction.every((value, index) => Math.abs(value - beforeResize.direction[index]) < 0.01), 'resizing preserves the chosen angle');
    assert.ok(Math.abs(afterResize.radius - beforeResize.radius) > 20, 'portrait and landscape adapt the viewing distance');
    await page.setViewportSize(view.viewport);
    await page.evaluate(() => __lookoutTest.advance(150));

    await page.keyboard.press('f');
    await page.evaluate(() => __lookoutTest.advance(300));
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false, 'F exits without restarting automatically');
    assert.equal(await page.evaluate(() => __home.stage.scene.fog.far === __home.stage.airFar), true, 'normal fog returns after leaving the panorama');
    const oldYaw = await page.evaluate(() => __home.rig.yaw);
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + 60, centerY, { steps: 5 });
    await page.mouse.up();
    await page.evaluate(() => __lookoutTest.advance(120));
    assert.ok(Math.abs(await page.evaluate(() => __home.rig.yaw) - oldYaw) > 0.1, 'normal character camera controls return after exiting');
    await page.evaluate(() => __lookoutTest.reenter());
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false, 'returning to the platform still requires explicit entry');
    await page.locator('#lookoutPrompt').click();
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), true, 'the touch button enters free view');
    await page.evaluate(() => __lookoutTest.advance(120));
    await page.keyboard.press('Escape');
    await page.evaluate(() => __lookoutTest.advance(150));
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false, 'Escape exits free view');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => __home.rig.setFirstPerson(true, __home.player.heading));
    await page.locator('#lookoutPrompt').click();
    assert.equal(await page.evaluate(() => {
      const expected = __home.stage.camera.aspect < 0.8 ? __lookoutTest.point.portrait : __lookoutTest.point.camera;
      return __home.stage.camera.position.toArray().every((value, index) => Math.abs(value - expected[index]) < 0.01);
    }), true, 'reduced motion skips the camera flight');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), false, 'free view temporarily leaves first person');
    await page.locator('#lookoutPrompt').click();
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false, 'the touch exit button is an explicit exit');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), true, 'exiting restores first person');
    await page.evaluate(() => __home.openPage('about'));
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false, 'an open card prevents accidental entry');
    await page.locator('#panel .close').click();
    await page.evaluate(() => __lookoutTest.advance(120));
    assert.equal(await page.evaluate(() => __home.extras.lookout.active), false);

    assert.deepEqual(errors, []);
    console.log(`${view.name}: walking, manual entry, orbit/zoom, input isolation, explicit exits, resize and reduced motion passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
