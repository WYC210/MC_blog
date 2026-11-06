import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.env.HOMECRAFT_URL || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
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
    await context.addInitScript(() => {
      localStorage.setItem('terryhome-sound', 'off');
      window.__audioContexts = [];
      const NativeAudioContext = window.AudioContext;
      if (!NativeAudioContext) return;
      window.AudioContext = class extends NativeAudioContext {
        constructor(...parameters) {
          super(...parameters);
          this.oscillatorCount = 0;
          window.__audioContexts.push(this);
        }
        createOscillator() { this.oscillatorCount++; return super.createOscillator(); }
        createDynamicsCompressor() {
          const compressor = super.createDynamicsCompressor();
          const meter = super.createAnalyser();
          compressor.connect(meter);
          this.meter = meter;
          return compressor;
        }
      };
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.extras?.nightConcert || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);

    const initial = await page.evaluate(async () => {
      const home = __home, concert = home.extras.nightConcert, crowd = home.world.concertCrowd;
      home.setTimeMode('day');
      home.setWeatherMode('clear');
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
      for (let frame = 0; frame < 600; frame++) concert.update(1 / 30);
      const dayHidden = !crowd.group.visible;
      home.player.teleport(-5.5, -19.4);
      home.rig.showcase(innerWidth < 600 ? [-7.5, 6.5, -26.5] : [-10.5, 5.5, -24.5], [-5.5, 1.2, -16]);
      for (let frame = 0; frame < 120; frame++) home.rig.update(1 / 60, home.player);
      home.setTimeMode('night');
      home.stage.settle();
      const phases = new Set();
      let pathsSafe = true;
      for (let frame = 0; frame < 2700; frame++) {
        concert.update(1 / 30);
        home.extras.resident?.update(1 / 30);
        home.world.fountain.update(1 / 30, home.stage.camera);
        phases.add(concert.phase);
        for (const guest of crowd.guests) {
          if (guest.present && guest.fade > 0.1) pathsSafe &&= home.nav.canStand(guest.avatar.root.position.x, guest.avatar.root.position.z);
        }
      }
      const THREE = await import('three');
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3();
      let bounded = true;
      for (let frame = 0; frame < 120; frame++) {
        home.world.fountain.update(1 / 30, home.stage.camera);
        for (let instance = 0; instance < home.world.fountain.mesh.count; instance++) {
          home.world.fountain.mesh.getMatrixAt(instance, matrix);
          position.setFromMatrixPosition(matrix);
          bounded &&= home.world.fountain.mesh.boundingSphere.containsPoint(position) && home.world.fountain.mesh.boundingBox.containsPoint(position);
        }
      }
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 150);
      camera.position.set(-5, 5, -35);
      camera.lookAt(-5, 5, -60);
      const version = crowd.people.geometry.attributes.position.version;
      crowd.draw(0.2, camera, 1, 'duet', 0);
      const offscreenPaused = version === crowd.people.geometry.attributes.position.version;
      const oldTime = concert.time;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      concert.update(0.2);
      const hiddenPaused = concert.time === oldTime;
      delete document.hidden;
      const { FOUNTAIN } = await import('@world/layout.js');
      const ringOpen = Array.from({ length: 64 }, (_, index) => {
        const angle = index * Math.PI / 32;
        return home.nav.canStand(FOUNTAIN.x + Math.sin(angle) * (FOUNTAIN.radius + 1.1), FOUNTAIN.z + Math.cos(angle) * (FOUNTAIN.radius + 1.1));
      }).every(Boolean);
      return {
        dayHidden, pathsSafe, bounded, offscreenPaused, hiddenPaused, ringOpen,
        phases: [...phases], ready: crowd.guests.every(guest => guest.arrived),
        resident: home.extras.resident?.activity,
        muted: !concert.audio.state.initialized && !concert.audio.state.audible,
        fountainShow: home.world.fountain.performance > 0,
        batches: crowd.group.children.length,
      };
    });
    for (const key of ['dayHidden', 'pathsSafe', 'bounded', 'offscreenPaused', 'hiddenPaused', 'ringOpen', 'ready', 'muted', 'fountainShow']) assert.equal(initial[key], true, key);
    assert.deepEqual(initial.phases, ['gathering', 'wind', 'violin', 'duet']);
    assert.equal(initial.resident, 'concert');
    assert.equal(initial.batches, 2);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('#concertPrompt').isVisible(), true);
    await page.locator('#concertPrompt').click();
    assert.ok(await page.evaluate(() => __home.extras.nightConcert.cheering > 0));
    assert.equal(await page.evaluate(() => __home.extras.nightConcert.audio.state.initialized), false, 'cheering must not unmute the world');

    await page.locator('#soundButton').click();
    await page.waitForFunction(() => __home.extras.nightConcert.audio.state.audible, null, { timeout: 10000 });
    const sound = await page.evaluate(() => {
      const context = __audioContexts.find(context => context.oscillatorCount === 4);
      const samples = new Float32Array(context.meter.fftSize);
      context.meter.getFloatTimeDomainData(samples);
      return { level: __home.extras.nightConcert.audio.state.level, oscillators: context.oscillatorCount, signal: samples.some(value => Math.abs(value) > 0.00001) };
    });
    assert.equal(sound.oscillators, 4);
    await page.waitForFunction(() => {
      const context = __audioContexts.find(context => context.oscillatorCount === 4);
      const samples = new Float32Array(context.meter.fftSize);
      context.meter.getFloatTimeDomainData(samples);
      return samples.some(value => Math.abs(value) > 0.00001);
    }, null, { timeout: 10000 });

    await page.evaluate(() => __home.player.teleport(-5.5, -30));
    await page.waitForTimeout(500);
    const distant = await page.evaluate(() => __home.extras.nightConcert.audio.state.level);
    assert.ok(distant > 0 && distant < sound.level, 'music must fade with distance');
    await page.evaluate(() => __home.player.teleport(25, 15));
    await page.waitForTimeout(400);
    assert.equal(await page.evaluate(() => __home.extras.nightConcert.audio.state.audible), false);
    assert.equal(await page.locator('#concertPrompt').isVisible(), false);
    await page.evaluate(() => __home.player.teleport(-5.5, -19.4));
    await page.waitForFunction(() => __home.extras.nightConcert.audio.state.audible);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.equal(await page.evaluate(() => __home.extras.nightConcert.audio.state.audible), false);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(() => __home.extras.nightConcert.audio.state.audible);
    await page.locator('#soundButton').click();
    assert.equal(await page.evaluate(() => __home.extras.nightConcert.audio.state.audible), false);

    const lifecycle = await page.evaluate(() => {
      const home = __home, concert = home.extras.nightConcert, crowd = home.world.concertCrowd;
      for (let frame = 0; frame < 1200; frame++) concert.update(1 / 30);
      const intermission = concert.phase === 'mingling';
      const requested = concert.interact();
      concert.update(0.05);
      const encore = concert.phase === 'duet';
      for (let frame = 0; frame < 5000; frame++) home.extras.resident?.update(1 / 30);
      const residentHome = home.extras.resident?.activity === 'sleeping';
      const identity = crowd.group.uuid;
      let cleanTransitions = true;
      for (let repeat = 0; repeat < 3; repeat++) {
        home.setTimeMode('day');
        for (let frame = 0; frame < 450; frame++) { concert.update(1 / 30); home.extras.resident?.update(1 / 30); }
        cleanTransitions &&= !crowd.group.visible && crowd.guests.every(guest => !guest.present) && !concert.audio.state.audible && home.world.fountain.performance === 0;
        home.setTimeMode('night');
        for (let frame = 0; frame < 600; frame++) { concert.update(1 / 30); home.extras.resident?.update(1 / 30); }
        cleanTransitions &&= crowd.guests.every(guest => guest.present && guest.arrived) && crowd.group.uuid === identity;
      }
      home.setTimeMode('day');
      concert.update(0.05);
      home.setTimeMode('night');
      for (let frame = 0; frame < 2400; frame++) { concert.update(1 / 30); home.extras.resident?.update(1 / 30); }
      home.stage.settle();
      return {
        intermission, requested, encore, residentHome, cleanTransitions,
        singlePrompt: document.querySelectorAll('#concertPrompt').length === 1,
        singleCrowd: home.stage.scene.getObjectsByProperty('name', 'night-concert').length === 1,
        contexts: __audioContexts.length,
      };
    });
    for (const key of ['intermission', 'requested', 'encore', 'residentHome', 'cleanTransitions', 'singlePrompt', 'singleCrowd']) assert.equal(lifecycle[key], true, key);
    assert.equal(lifecycle.contexts, 2, 'night transitions must reuse the concert audio context');

    await page.evaluate(() => {
      __home.player.teleport(-5.5, -19.4);
      __home.rig.showcase(innerWidth < 600 ? [-7.5, 6.5, -26.5] : [-10.5, 5.5, -24.5], [-5.5, 1.2, -16]);
      for (let frame = 0; frame < 120; frame++) __home.rig.update(1 / 60, __home.player);
    });
    await page.waitForTimeout(600);
    const box = await page.locator('#concertPrompt').boundingBox();
    assert.ok(box && box.x >= 0 && box.x + box.width <= view.viewport.width && box.y + box.height <= view.viewport.height, 'concert controls must fit the viewport');
    if (view.isMobile) assert.ok(box.height >= 48, 'mobile control must have a 48px touch target');
    for (const mode of ['night', 'day']) {
      if (mode === 'day') await page.evaluate(() => {
        __home.setTimeMode('day');
        for (let frame = 0; frame < 450; frame++) __home.extras.nightConcert.update(1 / 30);
        __home.stage.settle();
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: fileURLToPath(new URL(`night-concert-${view.name}-${mode}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      assert.ok(stats.calls <= stats.budget.calls, `${view.name} ${mode}: ${stats.calls} calls`);
      assert.ok(stats.triangles <= stats.budget.triangles, `${view.name} ${mode}: ${stats.triangles} triangles`);
      assert.equal(stats.lights, 0);
      console.log(`${view.name} ${mode}: ${stats.calls} calls, ${stats.triangles} triangles, ${stats.lights} real-time lights`);
    }
    assert.deepEqual(errors, []);
    console.log(`${view.name}: arrivals, solos/duet, resident schedule, encore, real audio signal, mute/distance/tab visibility, culling and repeated transitions passed`);
    await context.close();
  }
} finally {
  await browser.close();
}
