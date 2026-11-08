import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_ATTRACTIONS, QIN_LIGHT_VOLUME } from '../world/qin-island-layout.js';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
const report = [];
const landmarks = QIN_ATTRACTIONS.filter(item => ['qin-quyuan', 'qin-xufu'].includes(item.id));
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
    const checks = await page.evaluate(async ({ landmarks, volume }) => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, player = home.player;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      park.root.updateMatrixWorld(true);
      const parts = [], matrix = new THREE.Matrix4(), color = new THREE.Color();
      park.root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (const [index, tag] of (mesh.userData.tags || []).entries()) {
          if (!landmarks.some(landmark => tag?.startsWith(`${landmark.id}:`))) continue;
          mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld); mesh.getColorAt(index, color);
          parts.push({ tag, center: new THREE.Vector3().setFromMatrixPosition(matrix).toArray(),
            size: new THREE.Vector3().setFromMatrixScale(matrix).toArray(),
            luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
            emissive: mesh.geometry.getAttribute('iEmissive').getX(index) });
        }
      });
      const walks = [], idle = { x: 0, z: 0, run: false, up: false, down: false };
      player.teleport(202, 25);
      for (const target of [[202, 14], [207, 11], [212, 11], [212, 5], [212, 0], [202, 0], [202, 5], [202, 11],
        [207, 11], [212, 11], [212, -8], [207, -10], [202, -10], [202, -16], [202, -22], [207, -22],
        [212, -22], [212, -16], [212, -10], [207, -10], [202, -10], [202, 11], [202, 25]]) {
        const accepted = player.goTo(...target);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        walks.push({ target, accepted, flew, distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]) });
      }
      const signs = park.root.getObjectByName('qin-inscriptions'), titles = [];
      for (const [text, row] of [['屈原', 8], ['徐福像', -12]]) for (const column of [205.9, 207, 208.1]) {
        const origin = new THREE.Vector3(column, 1.8, row + 3), target = new THREE.Vector3(column, 0.43, row + 0.22);
        const ray = new THREE.Raycaster(origin, target.clone().sub(origin).normalize(), 0, origin.distanceTo(target) + 0.1);
        const hit = ray.intersectObject(park.root, true)[0];
        titles.push({ text, column, visible: hit?.object === signs && signs.userData.labels[Math.floor(hit.faceIndex / 2)]?.text === text });
      }
      const illumination = [];
      for (const landmark of landmarks) for (const [height, offset] of [[0.4, 1.8], [2.3, 0.8], [5.6, 0.6], [4, -0.8]]) {
        const position = [landmark.x, height, landmark.z + offset];
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - volume.min[axis]) / volume.extent[axis] * volume.size[axis]));
        const index = (cell[0] + volume.size[0] * (cell[1] + volume.size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[index] / 255 * 4 });
      }
      const solid = landmarks.every(landmark => [0, 2, 4.8].every(height => park.site.collides(landmark.x, height, landmark.z)));
      const clear = landmarks.every(landmark => [-3.4, 3.4].every(offset => !park.site.collides(landmark.x + offset, 0, landmark.z) && home.nav.canStand(landmark.x + offset, landmark.z)));
      return { parts, walks, titles, illumination, solid, clear,
        lamps: park.bakes.filter(light => /^qin-(quyuan|xufu)-/.test(light.id)).length };
    }, { landmarks, volume: QIN_LIGHT_VOLUME });
    const shots = [
      { id: 'qin-quyuan', name: 'front', camera: [211, 4.5, 15], portrait: [213, 4.5, 15.5], look: [207, 4.2, 5] },
      { id: 'qin-quyuan', name: 'detail', camera: [209, 6.1, 10.5], portrait: [210, 6.7, 13], look: [207, 6, 5] },
      { id: 'qin-quyuan', name: 'rear', camera: [217, 4.8, -3], portrait: [218, 5, -3], look: [207, 4.2, 5] },
      { id: 'qin-xufu', name: 'front', camera: [211, 4, -7], portrait: [213, 4.1, -5.7], look: [207, 3.4, -16] },
      { id: 'qin-xufu', name: 'detail', camera: [208.5, 5.6, -10], portrait: [209, 5.9, -9], look: [207, 4.9, -15.7] },
      { id: 'qin-xufu', name: 'rear', camera: [213, 4.4, -25], portrait: [215, 4.5, -25], look: [207, 3.4, -16] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) for (const shot of shots) {
      const visibility = await page.evaluate(async ({ shot, time, phone }) => {
        const THREE = await import('three'), home = __home, root = home.world.qinIsland.root;
        home.player.teleport(202, 10); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? shot.portrait : shot.camera, shot.look);
        for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0); root.updateMatrixWorld(true);
        const result = [], camera = home.stage.camera, matrix = new THREE.Matrix4();
        root.traverse(mesh => {
          if (!mesh.isInstancedMesh) return;
          for (const [index, tag] of (mesh.userData.tags || []).entries()) {
            const required = shot.name === 'detail' ? ['eye'] : shot.name === 'front' ? ['face', 'palm', 'shoe'] : [];
            if (!required.some(feature => tag === `${shot.id}:${feature}`)) continue;
            mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
            const target = new THREE.Vector3(0, 0, 0.51).applyMatrix4(matrix), projected = target.clone().project(camera);
            const ray = new THREE.Raycaster(camera.position, target.clone().sub(camera.position).normalize(), 0, camera.position.distanceTo(target) + 0.1);
            const hit = ray.intersectObject(root, true)[0], hitTag = hit?.object.userData.tags?.[hit.instanceId];
            result.push({ tag, inFrame: Math.abs(projected.x) < 0.94 && Math.abs(projected.y) < 0.94,
              unobstructed: shot.name === 'detail' ? hit?.object === mesh && hit.instanceId === index : !!hitTag?.startsWith(`${shot.id}:`), hitTag });
          }
        });
        return result;
      }, { shot, time, phone: !!view.hasTouch });
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`${shot.id}-${shot.name}-${time}-${view.name}.png`, output)) });
      measurements.push({ id: shot.id, shot: shot.name, time, visibility, ...await page.evaluate(() => __home.stats()) });
    }
    report.push({ view: view.name, checks, measurements, errors });
    writeFileSync(new URL('qin-east-statues-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.titles.every(title => title.visible), JSON.stringify(checks.titles));
    assert.ok(checks.solid && checks.clear);
    assert.ok(checks.illumination.every(sample => sample.energy > 0.1), JSON.stringify(checks.illumination));
    const parts = (id, feature) => checks.parts.filter(part => part.tag === `${id}:${feature}`);
    for (const landmark of landmarks) {
      assert.equal(parts(landmark.id, 'face').length, 1); assert.equal(parts(landmark.id, 'eye').length, 2);
      assert.ok(parts(landmark.id, 'eye').every(eye => eye.luminance < 0.12 && eye.emissive === 0));
      assert.ok(parts(landmark.id, 'face').every(face => face.luminance > 0.65 && face.emissive === 0));
    }
    assert.equal(parts('qin-quyuan', 'finger').length, 8);
    assert.equal(parts('qin-quyuan', 'draped-sleeve').length, 18);
    const poetHead = parts('qin-quyuan', 'face')[0];
    assert.ok(parts('qin-quyuan', 'palm').every(palm => palm.center[1] > poetHead.center[1] + 0.5));
    assert.equal(parts('qin-xufu', 'bamboo-slip').length, 6);
    assert.equal(parts('qin-xufu', 'long-beard').length, 7);
    assert.equal(parts('qin-xufu', 'finger').length, 4);
    assert.equal(checks.lamps, 6);
    assert.ok(measurements.every(shot => shot.visibility.every(part => part.inFrame && part.unobstructed)), JSON.stringify(measurements));
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: distinct raised-arm poet and bearded bamboo-slip traveller; ${checks.walks.length} walks, visible eyes/plaques, solid models, 6 baked lights; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
