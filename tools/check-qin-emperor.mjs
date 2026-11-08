import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_LIGHT_VOLUME } from '../world/qin-island-layout.js';

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
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async volume => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const parts = [], matrix = new THREE.Matrix4(), color = new THREE.Color();
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!tag?.startsWith('qin-emperor:')) continue;
          mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld); mesh.getColorAt(index, color);
          const center = new THREE.Vector3().setFromMatrixPosition(matrix), scale = new THREE.Vector3().setFromMatrixScale(matrix);
          parts.push({ tag, center: center.toArray(), scale: scale.toArray(), luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
            emissive: mesh.geometry.getAttribute('iEmissive').getX(index) });
        }
      });
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      player.teleport(160, 26);
      for (const target of [[160, 19], [153, 19], [151, 17], [151, 10], [151, 2], [160, 2], [169, 2], [169, 10],
        [169, 19], [160, 19], [169, 19], [169, 2], [160, 2], [151, 2], [151, 19], [160, 19], [160, 26]]) {
        const accepted = player.goTo(...target);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target, accepted, flew, distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const signs = park.root.getObjectByName('qin-inscriptions'), titles = [];
      for (const column of [158.9, 160, 161.1]) {
        const origin = new THREE.Vector3(column, 1.8, 21), target = new THREE.Vector3(column, 0.43, 17.22);
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.1);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ column, visible: hit?.object === signs && signs.userData.labels[Math.floor(hit.faceIndex / 2)]?.text === '千古一帝 · 面海求仙' });
      }
      const illumination = [];
      for (const position of [[160, 16, 11], [160, 13.8, 12.8], [157.8, 8, 12], [162.2, 8, 12], [160, 5, 11.8], [160, 11, 8.4], [160, 0.5, 15]]) {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      const colliders = [[160, 0, 10], [160, 3, 10], [160, 10, 10], [160, 15, 10], [157.4, 8, 11], [162.6, 8, 11]]
        .map(position => ({ position, solid: park.site.collides(...position) }));
      const clear = [[160, 19], [151, 10], [169, 10], [160, 2]].every(([column, row]) => !park.site.collides(column, 0, row) && home.nav.canStand(column, row));
      return { parts, walks, titles, illumination, colliders, clear, lamps: park.bakes.filter(light => light.id.startsWith('qin-emperor-')).length };
    }, QIN_LIGHT_VOLUME);
    const shots = [
      { name: 'front', camera: [169, 9.5, 40], portrait: [168, 10, 37], look: [160, 9.2, 10] },
      { name: 'ground', camera: [165, 1.8, 24.5], portrait: [166, 2, 28], look: [160, 11.5, 10] },
      { name: 'face', camera: [161.5, 15.9, 21], portrait: [163, 15.3, 22.5], look: [160, 15.8, 10.8] },
      { name: 'hands', camera: [164, 13.9, 20], portrait: [164, 14.5, 22], look: [160, 13.8, 12.4] },
      { name: 'side', camera: [183, 10, 14], portrait: [189, 11, 16], look: [160, 9.5, 10] },
      { name: 'rear', camera: [166, 10, -14], portrait: [174, 10, -10], look: [160, 9.5, 10] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      const visibility = await page.evaluate(async ({ shot, time, phone }) => {
        const THREE = await import('three'), home = __home, root = home.world.qinIsland.root;
        home.player.teleport(166, 20); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0); root.updateMatrixWorld(true);
        const silhouette = [];
        if (shot.name === 'front' || shot.name === 'rear') for (const height of [3, 8, 12, 17]) {
          const target = new THREE.Vector3(160, height, 10), camera = home.stage.camera;
          const projected = target.clone().project(camera);
          const ray = new THREE.Raycaster(camera.position, target.clone().sub(camera.position).normalize(), 0, camera.position.distanceTo(target) + 0.1);
          const hit = ray.intersectObject(root, true)[0], tag = hit?.object.userData.tags?.[hit.instanceId];
          silhouette.push({ height, inFrame: Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92,
            unobstructed: !!tag?.startsWith('qin-emperor:'), tag });
        }
        if (shot.name !== 'face') return { silhouette, eyes: null };
        const result = [], camera = home.stage.camera, matrix = new THREE.Matrix4();
        root.traverse(mesh => {
          if (!mesh.isInstancedMesh) return;
          for (const [index, tag] of (mesh.userData.tags || []).entries()) {
            if (tag !== 'qin-emperor:eye') continue;
            mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
            const target = new THREE.Vector3(0, 0, 0.51).applyMatrix4(matrix), projected = target.clone().project(camera);
            const ray = new THREE.Raycaster(camera.position, target.clone().sub(camera.position).normalize(), 0, camera.position.distanceTo(target) + 0.1);
            const hit = ray.intersectObject(root, true)[0];
            result.push({ inFrame: Math.abs(projected.x) < 0.92 && Math.abs(projected.y) < 0.92,
              unobstructed: hit?.object === mesh && hit.instanceId === index, hit: hit?.object.userData.tags?.[hit.instanceId] });
          }
        });
        return { silhouette, eyes: result };
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-emperor-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ shot: shot.name, time, visibleEyes: visibility.eyes, silhouette: visibility.silhouette, ...await page.evaluate(() => __home.stats()) });
    }
    const interactions = [];
    for (const time of ['day', 'night']) {
      await page.evaluate(time => { __home.setTimeMode(time); __home.stage.settle(); __home.player.teleport(160, 19); }, time);
      await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '秦始皇像');
      if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
      const panel = page.locator('#panel[data-station="qin-emperor"][open]');
      await panel.waitFor();
      assert.equal(await panel.locator('.about-text[lang="en"]').isVisible(), false);
      assert.ok((await panel.locator('.about-text[lang="zh-CN"]').innerText()).includes('双手'));
      await panel.locator('.lang-switch').click();
      assert.equal(await panel.locator('.about-text[lang="zh-CN"]').isVisible(), false);
      assert.ok((await panel.locator('.about-text[lang="en"]').innerText()).includes('both hands'));
      await panel.locator('.lang-switch').click(); await panel.locator('.close').click();
      interactions.push(time);
    }
    report.push({ view: view.name, checks, measurements, interactions, errors });
    writeFileSync(new URL('qin-emperor-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.ok(checks.colliders.every(collider => collider.solid) && checks.clear, JSON.stringify(checks.colliders));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    const count = feature => checks.parts.filter(part => part.tag === `qin-emperor:${feature}`).length;
    assert.equal(count('face'), 1); assert.equal(count('palm'), 2); assert.equal(count('finger'), 8);
    assert.equal(count('eye'), 2); assert.equal(count('crown-thread'), 14); assert.equal(count('crown-bead'), 56);
    assert.equal(count('hanging-sleeve'), 24); assert.equal(checks.lamps, 5);
    const eyes = checks.parts.filter(part => part.tag === 'qin-emperor:eye');
    assert.ok(Math.abs(eyes[0].center[0] - eyes[1].center[0]) > 0.8 && Math.abs(eyes[0].center[1] - eyes[1].center[1]) < 0.01);
    assert.ok(eyes.every(eye => eye.scale[0] > 0.35 && eye.scale[1] < 0.08 && eye.luminance < 0.12 && eye.emissive === 0));
    assert.ok(measurements.every(shot => !shot.visibleEyes || shot.visibleEyes.length === 2 && shot.visibleEyes.every(eye => eye.inFrame && eye.unobstructed)), JSON.stringify(measurements));
    assert.ok(measurements.every(shot => shot.silhouette.every(part => part.inFrame && part.unobstructed)), JSON.stringify(measurements));
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.walks.length} walks, visible eyes/plaque, 2 sculpted hands, 14 crown strands, 5 baked lights, bilingual F/touch; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
