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
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.world?.fountain || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);

    const checks = await page.evaluate(async () => {
      const home = __home, player = home.player, fountain = home.world.fountain;
      const { FOUNTAIN } = await import('@world/layout.js');
      const THREE = await import('three');
      home.setTimeMode('day');
      home.setWeatherMode('clear');
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);

      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      const routes = [
        { from: [FOUNTAIN.x, FOUNTAIN.z + 6], to: [FOUNTAIN.x, FOUNTAIN.z - 6] },
        { from: [FOUNTAIN.x - 6, FOUNTAIN.z], to: [FOUNTAIN.x + 6, FOUNTAIN.z] },
      ].map(route => {
        player.teleport(...route.from);
        const accepted = player.goTo(...route.to);
        let crossedBasin = false;
        for (let frame = 0; frame < 1600 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0);
          crossedBasin ||= home.nav.isBlocked(player.pos.x, player.pos.z);
        }
        return { accepted, crossedBasin, arrived: !player.travelling && Math.hypot(player.pos.x - route.to[0], player.pos.z - route.to[1]) < 0.25 };
      });
      const ringOpen = Array.from({ length: 64 }, (_, index) => {
        const angle = index * Math.PI / 32, radius = FOUNTAIN.radius + 1.1;
        return home.nav.canStand(FOUNTAIN.x + Math.sin(angle) * radius, FOUNTAIN.z + Math.cos(angle) * radius);
      }).every(Boolean);

      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 120);
      camera.position.set(FOUNTAIN.x, 5, FOUNTAIN.z + 10);
      camera.lookAt(FOUNTAIN.x, 1.5, FOUNTAIN.z);
      const original = fountain.mesh.instanceMatrix.array.slice();
      fountain.update(0.15, camera);
      const animated = original.some((value, index) => value !== fountain.mesh.instanceMatrix.array[index]);
      const version = fountain.mesh.instanceMatrix.version;
      camera.lookAt(FOUNTAIN.x, 5, FOUNTAIN.z + 20);
      fountain.update(0.15, camera);
      const offscreenPaused = version === fountain.mesh.instanceMatrix.version;
      camera.lookAt(FOUNTAIN.x, 1.5, FOUNTAIN.z);
      fountain.mesh.visible = false;
      fountain.update(0.15, camera);
      const hiddenPaused = version === fountain.mesh.instanceMatrix.version;
      fountain.mesh.visible = true;
      fountain.update(0.15, camera);
      const resumed = fountain.mesh.instanceMatrix.version > version;
      const transform = new THREE.Matrix4(), center = new THREE.Vector3();
      let bounded = true;
      for (let frame = 0; frame < 120; frame++) {
        fountain.update(1 / 30, camera);
        for (let instance = 0; instance < fountain.mesh.count; instance++) {
          fountain.mesh.getMatrixAt(instance, transform);
          center.setFromMatrixPosition(transform);
          bounded &&= fountain.mesh.boundingSphere.containsPoint(center);
          bounded &&= Math.abs(center.x - FOUNTAIN.x) < FOUNTAIN.radius && Math.abs(center.z - FOUNTAIN.z) < FOUNTAIN.radius;
          bounded &&= transform.elements.every(Number.isFinite);
        }
      }

      player.teleport(FOUNTAIN.x - 3.5, FOUNTAIN.z + 3.5);
      const portrait = innerWidth < 600;
      home.rig.showcase(
        portrait ? [FOUNTAIN.x - 2, 11, FOUNTAIN.z + 19] : [FOUNTAIN.x - 8, 8, FOUNTAIN.z + 10],
        [FOUNTAIN.x, 1.2, FOUNTAIN.z],
      );
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, player);
      const sightline = new THREE.Vector3(FOUNTAIN.x, 1.2, FOUNTAIN.z).sub(home.stage.camera.position);
      const viewBlocked = home.world.grid.raycast(home.stage.camera.position, sightline.clone().normalize(), sightline.length());
      return {
        routes, ringOpen, animated, offscreenPaused, hiddenPaused, resumed, bounded, clearView: !viewBlocked,
        basinBlocked: home.nav.isBlocked(FOUNTAIN.x, FOUNTAIN.z),
        instances: fountain.mesh.count, waterCastsShadow: fountain.mesh.castShadow,
      };
    });
    assert.equal(checks.basinBlocked, true, 'the basin must block walking');
    assert.equal(checks.ringOpen, true, 'the full stepping-stone ring must remain walkable');
    for (const route of checks.routes) {
      assert.equal(route.accepted && route.arrived && !route.crossedBasin, true, 'cross-island routes must walk around the fountain');
    }
    for (const key of ['animated', 'offscreenPaused', 'hiddenPaused', 'resumed', 'bounded', 'clearView']) {
      assert.equal(checks[key], true, key);
    }
    assert.equal(checks.waterCastsShadow, false);
    assert.equal(checks.instances, 200);

    for (const mode of ['day', 'night']) {
      await page.evaluate(mode => __home.setTimeMode(mode), mode);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: fileURLToPath(new URL(`fountain-${view.name}-${mode}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= stats.budget.calls, `${view.name} ${mode}: ${stats.calls} draw calls`);
      assert.ok(stats.triangles <= stats.budget.triangles, `${view.name} ${mode}: ${stats.triangles} triangles`);
      assert.ok(stats.lights <= 2);
      console.log(`${view.name} ${mode}: ${stats.calls} calls, ${stats.triangles} triangles, ${stats.lights} real-time lights`);
    }
    assert.deepEqual(errors, []);
    console.log(`${view.name}: fountain animation, visibility culling, collision and both cross-island routes passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
