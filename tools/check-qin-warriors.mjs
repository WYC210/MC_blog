import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_LIGHT_VOLUME, QIN_WARRIORS } from '../world/qin-island-layout.js';

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
    const context = await browser.newContext(view);
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async ({ volume, shift }) => {
      const THREE = await import('three');
      const home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const parts = [];
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!tag?.startsWith('qin-warriors:')) continue;
          const matrix = new THREE.Matrix4(), color = new THREE.Color();
          mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld); mesh.getColorAt(index, color);
          parts.push({ role: tag.split(':')[1], feature: tag.split(':')[2], tag,
            position: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
            tint: color.getHex(), luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
            emissive: mesh.geometry.getAttribute('iEmissive').getX(index) });
        }
      });
      const faces = parts.filter(part => part.feature === 'face'), eyes = parts.filter(part => part.feature === 'eye');
      const robes = parts.filter(part => part.feature === 'robe');
      const leftHand = parts.find(part => part.role === 'farewell' && part.feature === 'hand-1');
      const rightHand = parts.find(part => part.role === 'traveller' && part.feature === 'hand--1');
      const handGap = leftHand && rightHand ? Math.hypot(...leftHand.position.map((value, axis) => value - rightHand.position[axis])) : Infinity;
      const illumination = faces.map(face => {
        const cell = face.position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const offset = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        return { role: face.role, energy: park.lighting.texture.image.data[offset] / 255 * 4 };
      });
      const sightlines = [];
      for (const origin of [[112, 3.7, 10.3], [117.7, 4.3, 11], [106.3, 4.3, 11]]) for (const face of faces) {
        const start = new THREE.Vector3(origin[0], origin[1], origin[2] + shift), end = new THREE.Vector3(...face.position);
        const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end) + 0.2);
        const hit = ray.intersectObject(park.root, true)[0];
        sightlines.push({ origin, role: face.role, first: hit?.object.userData.tags?.[hit.instanceId] || hit?.object.name });
      }
      const signs = park.root.getObjectByName('qin-inscriptions');
      const title = signs.userData.labels.find(label => label.text === park.attractions.find(item => item.id === 'qin-warriors').name);
      const start = new THREE.Vector3(112, 1.8, 9.5 + shift), target = new THREE.Vector3(title.x, title.y, title.z);
      const signRay = new THREE.Raycaster(start, target.clone().sub(start).normalize(), 0, start.distanceTo(target) + 0.1);
      const signHit = signRay.intersectObject(park.root, true)[0];
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      const route = [[112, 9], [106.3, 9], [106.3, -2], [112, -2], [117.7, -2], [117.7, 9], [112, 9]].map(([column, row]) => [column, row + shift]);
      player.teleport(...route[0]);
      for (const [column, row] of [...route.slice(1), ...route.slice(0, -1).reverse()]) {
        const accepted = player.goTo(column, row);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target: [column, row], accepted, flew, distance: Math.hypot(player.pos.x - column, player.pos.z - row) });
      }
      return { faces, eyes, robes, handGap, illumination, sightlines, walks,
        bodySolid: faces.every(face => park.site.collides(face.position[0], 2, face.position[2])),
        baseSolid: [[108, 2], [112, 4.5], [116, 2]].every(([column, row]) => park.site.collides(column, 0, row + shift)),
        sidesClear: [106.3, 117.7].every(column => [-1, 1, 3, 5, 7].every(row => !park.site.collides(column, 0, row + shift))),
        titleVisible: signHit?.object === signs && signs.userData.labels[Math.floor(signHit.faceIndex / 2)] === title,
        cups: parts.filter(part => part.feature === 'cup').length,
        features: [...new Set(parts.map(part => `${part.role}:${part.feature}`))],
        lamps: park.bakes.filter(light => light.id.startsWith('qin-warriors-')).length };
    }, { volume: QIN_LIGHT_VOLUME, shift: QIN_WARRIORS.baseZ - 2 });
    const shots = [
      { name: 'front', camera: [112, 4.2, 10.3], portrait: [125, 6, 13.5], look: [112, 2.25, 2.5] },
      { name: 'hands', camera: [114.5, 3.4, 7.8], portrait: [112.3, 3.2, 10], look: [111.5, 2.8, 3.25] },
      { name: 'tray', camera: [117.6, 3.2, 5.8], portrait: [117.1, 3.6, 7], look: [115, 2.65, 1.6] },
      { name: 'west', camera: [102.5, 4.8, 9], portrait: [102, 5, 12], look: [112, 2.2, 2] },
      { name: 'rear', camera: [114, 4.5, -8], portrait: [113, 4.8, -17], look: [112, 2.2, 2] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      await page.evaluate(({ shot, time, phone, shift }) => {
        const home = __home;
        home.player.teleport(118.5, 7 + shift); home.setTimeMode(time); home.stage.settle();
        const camera = phone ? shot.portrait : shot.camera;
        home.rig.showcase([camera[0], camera[1], camera[2] + shift], [shot.look[0], shot.look[1], shot.look[2] + shift]);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { shot, time, phone: !!view.hasTouch, shift: QIN_WARRIORS.baseZ - 2 });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-warriors-${shot.name}-${time}-${view.name}.png`, output)) });
      const stats = await page.evaluate(() => __home.stats());
      let visibleFaces = null;
      if (shot.name === 'front') visibleFaces = await page.evaluate(async faces => {
        const THREE = await import('three'), home = __home;
        const camera = home.stage.camera;
        return faces.map(face => {
          const target = new THREE.Vector3(...face.position), projected = target.clone().project(camera);
          const ray = new THREE.Raycaster(camera.position, target.clone().sub(camera.position).normalize(), 0, camera.position.distanceTo(target) + 0.2);
          const hit = ray.intersectObject(home.world.qinIsland.root, true)[0];
          return { role: face.role, inFrame: Math.abs(projected.x) < 0.9 && Math.abs(projected.y) < 0.9 && projected.z < 1,
            unobstructed: hit?.object.userData.tags?.[hit.instanceId]?.startsWith(`qin-warriors:${face.role}:`) || false };
        });
      }, checks.faces);
      measurements.push({ shot: shot.name, time, visibleFaces, ...stats });
    }
    report.push({ view: view.name, checks, measurements });
    writeFileSync(new URL('qin-warriors-report.json', output), JSON.stringify(report, null, 2));
    assert.equal(checks.faces.length, 3); assert.equal(checks.eyes.length, 6);
    assert.equal(new Set(checks.robes.map(part => part.tint)).size, 3);
    for (const face of checks.faces) {
      const eyes = checks.eyes.filter(eye => eye.role === face.role);
      assert.ok(face.luminance > 0.5 && eyes.length === 2 && eyes.every(eye => eye.luminance < face.luminance * 0.3));
      assert.ok(Math.abs(eyes[0].position[1] - eyes[1].position[1]) < 0.001);
    }
    assert.ok([...checks.faces, ...checks.eyes, ...checks.robes].every(part => part.emissive === 0));
    assert.ok(checks.handGap > 0.1 && checks.handGap < 0.25, `Hands must touch without coincident palms: ${checks.handGap}`);
    assert.equal(checks.cups, 2); assert.equal(checks.lamps, 3);
    for (const feature of ['farewell:crown', 'traveller:topknot', 'traveller:scabbard', 'traveller:cloak', 'attendant:tray', 'attendant:ewer', 'setting:river-carving']) assert.ok(checks.features.includes(feature), feature);
    assert.ok(checks.bodySolid && checks.baseSolid && checks.sidesClear);
    assert.ok(checks.titleVisible, 'The plaque must not be obscured');
    assert.ok(checks.sightlines.every(ray => ray.first?.startsWith(`qin-warriors:${ray.role}:`)), JSON.stringify(checks.sightlines));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.ok(measurements.every(shot => !shot.visibleFaces || shot.visibleFaces.every(face => face.inFrame && face.unobstructed)), JSON.stringify(measurements));
    await page.evaluate(() => { __home.player.teleport(112, 25); __home.go('qin-seven'); });
    const panel = page.locator('#panel[data-station="qin-seven"][open]');
    await panel.waitFor();
    assert.ok((await panel.locator('.about-text[lang="zh-CN"]').innerText()).includes('双手捧盘'));
    assert.equal(await panel.locator('.about-text[lang="en"]').isVisible(), false);
    await panel.locator('.lang-switch').click();
    assert.ok((await panel.locator('.about-text[lang="en"]').innerText()).includes('clasping hands'));
    assert.equal(await panel.locator('.about-text[lang="zh-CN"]').isVisible(), false);
    assert.deepEqual(errors, []);
    console.log(`${view.name}: 3 distinct figures, clasped hands, 2 cups, clear sightlines, ${checks.walks.length} walks, solid display, bilingual text; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
