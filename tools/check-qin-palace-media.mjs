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
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const idle = { x: 0, z: 0, run: false, up: false, down: false }, walks = [];
      player.teleport(160, -18);
      for (const target of [[160, -22], [159, -24], [149.2, -22.1], [149.2, -26.5], [149.2, -28.1], [156, -27], [160, -24],
        [178.5, -24.25], [178.5, -30.25], [178.5, -35.8], [175, -38], [173, -42], [167, -42], [159, -42], [151, -42], [143, -42],
        [143, -38], [151, -37], [159, -37], [166, -37], [173, -37], [178.5, -35.8], [178.5, -30.25], [178.5, -22.75], [160, -24]]) {
        const accepted = player.goTo(...target);
        let flew = false, collided = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
          collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
        }
        for (let frame = 0; frame < 45; frame++) player.update(1 / 60, idle, 0);
        walks.push({ target, accepted, flew, collided, height: player.y, floor: home.nav.heightAt(...target),
          distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const media = park.media, screens = [];
      for (let sample = 0; sample < 24; sample++) {
        const angle = -Math.PI / 2 + (sample + 0.5) * Math.PI / 24;
        const origin = new THREE.Vector3(150, 5.2, -26.8), target = new THREE.Vector3(150 + Math.sin(angle) * 7, 5.2, -28 - Math.cos(angle) * 4);
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.1);
        screens.push({ sample, visible: ray.intersectObject(park.root, true)[0]?.object === media.screen });
      }
      for (const column of [145, 151.5, 158, 164.5, 171]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(column, 9.1, -42), new THREE.Vector3(0, 0, -1), 0, 5);
        screens.push({ column, visible: ray.intersectObject(park.root, true)[0]?.object === media.screen });
      }
      const parts = [];
      park.root.traverse(mesh => { for (const tag of mesh.userData.tags || []) if (/^qin-(cinema|panorama):/.test(tag || '')) parts.push(tag); });
      const camera = home.stage.camera, frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
      function view(cameraPosition, look) {
        home.rig.showcase(cameraPosition, look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, player);
        camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      player.teleport(171, -38);
      view([158, 9, -37], [158, 8.7, -45]);
      const canvas = media.screen.material.map.image, painter = canvas.getContext('2d');
      const before = painter.getImageData(0, 0, 512, 256).data, beforeFrames = media.screen.userData.frames;
      const beforeX = media.vessels.position.x;
      for (let frame = 0; frame < 240; frame++) media.update(1 / 30, camera, frustum);
      const after = painter.getImageData(0, 0, 512, 256).data;
      let changed = 0;
      for (let offset = 0; offset < before.length; offset += 4) if (before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1]) changed++;
      const animation = { changed, frames: media.screen.userData.frames - beforeFrames, moved: Math.abs(media.vessels.position.x - beforeX) };
      view([158, 8, -25], [158, 8, -10]);
      const offscreenFrames = media.screen.userData.frames, offscreenX = media.vessels.position.x;
      for (let frame = 0; frame < 120; frame++) media.update(1 / 30, camera, frustum);
      const offscreenPaused = media.screen.userData.frames === offscreenFrames && media.vessels.position.x === offscreenX;
      view([20, 10, 20], [158, 8, -40]);
      const farFrames = media.screen.userData.frames;
      for (let frame = 0; frame < 120; frame++) media.update(1 / 30, camera, frustum);
      return { walks, screens, parts, animation, offscreenPaused, farPaused: media.screen.userData.frames === farFrames,
        tableBlocked: park.site.collides(159, 7, -39.5) && !home.nav.canStand(159, -39.5),
        lamps: park.bakes.filter(light => /^qin-(cinema|panorama)-/.test(light.id)).length };
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    checks.reducedMotionPaused = await page.evaluate(() => {
      const home = __home, media = home.world.qinIsland.media;
      home.player.teleport(171, -38); home.rig.showcase([158, 9, -37], [158, 8.7, -45]);
      for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      const before = media.screen.userData.frames, position = media.vessels.position.x;
      for (let frame = 0; frame < 180; frame++) home.extras.qinIsland.update(1 / 30);
      return before === media.screen.userData.frames && position === media.vessels.position.x;
    });
    checks.story = [];
    for (const language of ['zh', 'en']) {
      if (language === 'en') {
        const frozenTime = await page.evaluate(() => __home.world.qinIsland.media.story.state.time);
        await page.evaluate(() => { __home.player.teleport(160, -18); __home.go('qin-palace'); });
        const panel = page.locator('#panel[data-station="qin-palace"][open]');
        await panel.waitFor();
        if (view.hasTouch) await panel.locator('.lang-switch').tap(); else await panel.locator('.lang-switch').click();
        await page.waitForFunction(() => __home.world.qinIsland.media.story.state.language === 'en');
        assert.equal(await page.evaluate(() => __home.world.qinIsland.media.story.state.time), frozenTime, 'Changing language must not restart or advance the paused story');
        if (view.hasTouch) await panel.locator('.close').tap(); else await panel.locator('.close').click();
      }
      for (let phase = 0; phase < 4; phase++) {
        const result = await page.evaluate(async ({ phase, language }) => {
          const THREE = await import('three');
          const { QIN_QUEST_ACTS, QIN_QUEST_ACT_SECONDS } = await import('@world/qin-quest-story.js');
          const home = __home, story = home.world.qinIsland.media.story;
          const canvas = story.texture.image, painter = canvas.getContext('2d'), at = phase * QIN_QUEST_ACT_SECONDS;
          story.draw(at + 2);
          const before = painter.getImageData(0, 128, 512, 128).data;
          story.draw(at + 8);
          const after = painter.getImageData(0, 128, 512, 128).data;
          let changed = 0;
          for (let offset = 0; offset < before.length; offset += 4) if (before[offset] !== after[offset] || before[offset + 1] !== after[offset + 1]) changed++;
          const state = { ...story.state }, act = QIN_QUEST_ACTS[phase];
          const title = language === 'en' ? act.en : act.zh, caption = language === 'en' ? act.captionEn : act.captionZh;
          const titleMatches = state.title === title, captionMatches = state.caption === caption;
          home.player.teleport(159, -24); home.setTimeMode('night'); home.stage.settle();
          home.rig.showcase([150, 5.3, -22], [150, 5, -30]);
          for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
          home.extras.qinIsland.update(0);
          home.stage.camera.updateMatrixWorld();
          const vertices = home.world.qinIsland.media.screen.geometry.getAttribute('position'), captionBounds = [];
          for (const horizontal of [208 / 512, 304 / 512]) for (const vertical of [133, 254]) {
            const offset = horizontal * 24, segment = Math.floor(offset), fraction = offset - segment;
            const left = segment * 4, right = left + 1;
            const point = new THREE.Vector3(vertices.getX(left) + (vertices.getX(right) - vertices.getX(left)) * fraction,
              3.66 + ((1 - vertical / 256) - 0.004) / 0.492 * 2.89,
              vertices.getZ(left) + (vertices.getZ(right) - vertices.getZ(left)) * fraction).project(home.stage.camera);
            captionBounds.push(point.toArray());
          }
          return { state, changed, titleMatches, captionMatches, captionFits: captionBounds.every(point => Math.abs(point[0]) < 0.98 && Math.abs(point[1]) < 0.98),
            captionBounds, image: canvas.toDataURL('image/png') };
        }, { phase, language });
        writeFileSync(new URL(`qin-story-${phase}-${language}-${view.name}-atlas.png`, output), Buffer.from(result.image.split(',')[1], 'base64'));
        delete result.image;
        checks.story.push(result);
        await page.waitForTimeout(150);
        await page.screenshot({ path: fileURLToPath(new URL(`qin-story-${phase}-${language}-${view.name}.png`, output)) });
      }
    }
    checks.storyLoops = await page.evaluate(async () => {
      const { setLang } = await import('@engine/lang.js'), story = __home.world.qinIsland.media.story;
      story.draw(48.25);
      const looped = story.state.phase === 0 && story.state.act === 'procession' && story.state.progress < 0.03;
      setLang('zh');
      return looped && story.state.language === 'zh' && story.state.time === 48.25;
    });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const shots = [
      { name: 'cinema', camera: [150, 5.3, -22], portrait: [150, 5.3, -22], look: [150, 5, -30], player: [150, -27] },
      { name: 'cinema-side', camera: [156, 5.6, -23], portrait: [156, 5.6, -23], look: [147, 4.8, -29.5], player: [150, -27] },
      { name: 'gallery', camera: [175, 10, -36.5], portrait: [176.5, 10.2, -36.5], look: [156, 8.7, -44], player: [171, -38] },
      { name: 'gallery-front', camera: [158, 9.1, -37], portrait: [158, 9.1, -36], look: [158, 8.6, -45], player: [171, -38] },
      { name: 'table', camera: [164, 10, -36.5], portrait: [165, 10.5, -36], look: [159, 8, -39.5], player: [171, -38] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone }) => {
        const home = __home;
        home.player.teleport(...shot.player); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(200);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-media-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-palace-media-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2 && Math.abs(walk.height - walk.floor) < 0.04), JSON.stringify(checks.walks.filter(walk => !walk.accepted || walk.flew || walk.collided || walk.distance >= 0.2 || Math.abs(walk.height - walk.floor) >= 0.04)));
    assert.ok(checks.screens.every(sample => sample.visible), JSON.stringify(checks.screens));
    assert.ok(checks.animation.changed > 500 && checks.animation.frames >= 60 && checks.animation.frames <= 65 && checks.animation.moved > 0.1, JSON.stringify(checks.animation));
    assert.ok(checks.offscreenPaused && checks.farPaused && checks.reducedMotionPaused, JSON.stringify(checks));
    assert.equal(checks.story.length, 8);
    assert.ok(checks.story.every(sample => sample.changed > 100 && sample.titleMatches && sample.captionMatches && sample.captionFits && sample.state.phase >= 0 && sample.state.phase < 4), JSON.stringify(checks.story));
    assert.ok(checks.storyLoops);
    assert.ok(checks.tableBlocked);
    assert.equal(checks.parts.filter(tag => tag === 'qin-cinema:seat').length, 18);
    assert.equal(checks.parts.filter(tag => tag === 'qin-panorama:display-base').length, 5);
    assert.equal(checks.lamps, 9);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: 4 story acts in both languages, paused language switching and 48-second loop, ${checks.walks.length} walks including both floors, 29 visible screen sections, animated pixels and ships, offscreen/far/reduced-motion pauses; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
