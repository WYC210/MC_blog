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
    await page.waitForFunction(() => window.__home?.extras?.furniture || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const seats = await page.evaluate(async () => {
      const home = __home, player = home.player, furniture = home.extras.furniture;
      const THREE = await import('three');
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      const advance = (frames, input = idle) => {
        for (let frame = 0; frame < frames; frame++) player.update(1 / 60, input, 0);
      };
      const origin = new THREE.Vector3(), direction = new THREE.Vector3();
      const wallFilter = (type, group) => type.kind !== 'glass' && !home.world.hidden.has(group);
      function approach(point) {
        let start = null;
        for (let radius = 0.8; radius < 2.25 && !start; radius += 0.2) {
          for (let angle = 0; angle < 32; angle++) {
            const x = point.x + Math.sin(angle * Math.PI / 16) * radius;
            const z = point.z + Math.cos(angle * Math.PI / 16) * radius;
            const support = home.world.ground.canStand(x, z, point.floor);
            if (!support || Math.abs(support.y - point.floor) > 0.1) continue;
            origin.set(x, point.floor + 1.1, z);
            direction.set(point.x - x, point.y + 0.35 - origin.y, point.z - z);
            const distance = direction.length();
            const wall = home.world.grid.raycast(origin, direction.normalize(), distance, wallFilter);
            if (wall && wall.t < distance - 0.2) continue;
            start = { x, z, floor: support.y };
            break;
          }
        }
        if (!start) return null;
        player.teleport(start.x, start.z);
        if (Math.abs(player.floorY - start.floor) > 0.1) {
          player.teleport(0, 18);
          player.startFlying();
          for (let frame = 0; frame < 600 && player.y < start.floor + 0.5; frame++) player.update(1 / 60, { ...idle, up: true }, 0);
          player.pos.x = start.x; player.pos.z = start.z;
          player.stopFlying(); advance(120);
        }
        furniture.update(0.1);
        return { x: player.pos.x, z: player.pos.z, floor: player.floorY, mode: player.mode };
      }
      window.__furnitureTest = { approach, advance, idle };
      return furniture.points.map(point => {
        const start = approach(point);
        if (!start) return { id: point.id, reachable: false };
        const available = !!furniture.target;
        const accepted = player.restAt(point);
        advance(120);
        const seated = { mode: player.mode, id: player.resting?.id, x: player.pos.x, z: player.pos.z, y: player.y, floor: player.floorY, bodyPitch: home.avatar.body.rotation.x };
        const stood = player.standUp(); advance(60);
        return { id: point.id, kind: point.kind, reachable: true, start, available, accepted, seated, stood,
          safeExit: player.mode === 'ground' && Math.hypot(player.pos.x - start.x, player.pos.z - start.z) < 0.01,
          expectedY: point.kind === 'lie' ? point.y : point.y - 0.675 };
      });
    });
    for (const seat of seats) {
      assert.ok(seat.reachable && seat.available && seat.accepted, `Cannot use furniture: ${JSON.stringify(seat)}`);
      assert.equal(seat.seated.id, seat.id);
      assert.equal(seat.seated.mode, 'rest');
      assert.ok(Math.abs(seat.seated.y - seat.expectedY) < 0.01, `Wrong seat height: ${seat.id}`);
      assert.equal(seat.seated.floor, seat.start.floor);
      assert.ok(seat.stood && seat.safeExit, `Unsafe stand-up: ${seat.id}`);
      if (seat.kind === 'lie') assert.ok(Math.abs(seat.seated.bodyPitch + Math.PI / 2) < 0.01);
    }
    assert.ok(!seats.some(seat => /computer|piano|desk|chair/.test(seat.id)), 'Functional chairs must not have rest actions');
    console.log(`${view.name}: ${seats.length} furniture points, correct poses and safe exits`);

    await page.evaluate(() => {
      __furnitureTest.approach(__home.extras.furniture.points.find(point => point.id === 'beach-lounger-13.8'));
    });
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.player.resting?.id), 'beach-lounger-13.8');
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.player.resting), null);
    await page.keyboard.press('f');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __home.player.resting), null);
    await page.keyboard.press('f');
    await page.keyboard.down('w');
    await page.waitForFunction(() => !__home.player.resting);
    await page.keyboard.up('w');
    assert.equal(await page.evaluate(() => __home.player.resting), null);

    for (const id of ['computer', 'piano']) {
      await page.evaluate(async id => {
        const { STATIONS } = await import('@world/layout.js');
        const station = STATIONS.find(station => station.id === id);
        __home.player.teleport(...station.at, station);
        __home.extras.furniture.update(0.1);
      }, id);
      assert.equal(await page.evaluate(() => __home.extras.furniture.target), null, `${id} should keep its original interaction`);
      await page.keyboard.press('f');
      assert.ok(await page.locator('#panel').evaluate(panel => panel.open), `${id} F interaction stopped working`);
      assert.equal(await page.evaluate(() => __home.player.resting), null);
      await page.keyboard.press('Escape');
    }

    for (const [id, camera, look] of [
      ['beach-lounger-13.8', [17, 3.7, 29], [13.8, 0.8, 25.5]],
      ['home-sofa--24.2', [-28, 5.8, -1], [-24.2, 2, 3.62]],
      ['home-bed', [-12.5, 6, 8], [-17.1, 1.8, 11.45]],
      ['lehun-sofa-0.62', [17, 23, 43], [12.8, 20, 47.65]],
      ['lehun-mat-7.8', [12, 16.5, 35], [7.8, 12.4, 38]],
    ]) {
      await page.evaluate(({ id, camera, look }) => {
        const home = __home, point = home.extras.furniture.points.find(point => point.id === id);
        __furnitureTest.approach(point);
        home.player.restAt(point); __furnitureTest.advance(120);
        home.extras.furniture.update(0.1);
        home.rig.showcase(camera, look);
        for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
      }, { id, camera, look });
      await page.screenshot({ path: fileURLToPath(new URL(`furniture-${id}-${view.name}.png`, output)) });
      await page.locator('#furniturePrompt').click();
      assert.equal(await page.evaluate(() => __home.player.resting), null);
    }
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= 60 && stats.triangles <= 200000, `Performance budget: ${JSON.stringify(stats)}`);
    assert.deepEqual(errors, []);
    console.log(`${view.name}: keyboard, touch prompt, computer/piano exclusions; ${stats.calls} calls, ${stats.triangles} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
