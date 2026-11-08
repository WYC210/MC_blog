import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_ATTRACTIONS, QIN_STATE_FLAGS, QIN_STATIONS, QIN_COURTYARD, QIN_HANFEI, qinLandAt } from '../world/qin-island-layout.js';

assert.equal(QIN_STATE_FLAGS.length, 7);
assert.equal(new Set(QIN_STATE_FLAGS.map(flag => flag.state)).size, 7);
for (const flag of QIN_STATE_FLAGS) {
  const landmark = QIN_ATTRACTIONS.find(item => item.id === flag.attraction);
  assert.ok(landmark && qinLandAt(flag.x, flag.z));
  assert.equal(flag.x, landmark.x + flag.offset[0]);
  assert.equal(flag.z, landmark.z + flag.offset[1]);
}
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
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const geometry = await page.evaluate(async flags => {
      const THREE = await import('three');
      const home = __home, root = home.world.qinIsland.root;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, home.player);
      home.setWeatherMode('clear');
      home.player.teleport(111, flags.find(flag => flag.attraction === 'qin-tiger').z - 3.5);
      root.updateMatrixWorld(true);
      const inscriptions = root.getObjectByName('qin-inscriptions'), labels = inscriptions.userData.labels;
      const canvas = inscriptions.material.map.image, context = canvas.getContext('2d'), uv = inscriptions.geometry.attributes.uv;
      const samples = [];
      const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
      const cloth = [], oldPoles = [];
      const oldPositions = [[101, 31], [101, 6], [101, -14], [220, 25], [101, -54], [220, 3], [190, 4]];
      root.traverse(mesh => {
        if (!mesh.isInstancedMesh) return;
        for (let instance = 0; instance < mesh.count; instance++) {
          mesh.getMatrixAt(instance, matrix);
          matrix.premultiply(mesh.matrixWorld).decompose(position, rotation, scale);
          const tag = mesh.userData.tags?.[instance];
          if (tag?.startsWith('qin-flag:')) cloth.push({ tag, at: position.toArray(), size: scale.toArray() });
          if (Math.abs(scale.x - 0.14) < 0.001 && Math.abs(scale.y - 4.2) < 0.001 && oldPositions.some(([column, row]) => Math.hypot(column - position.x, row - position.z) < 0.01)) oldPoles.push(position.toArray());
        }
      });
      for (const flag of flags) {
        for (const face of [-1, 1]) {
          const center = flag.x + flag.side * 1.15;
          const ray = new THREE.Raycaster(new THREE.Vector3(center, 4.25, flag.z + face * 6), new THREE.Vector3(0, 0, -face), 0, 6);
          const hit = ray.intersectObject(root, true)[0], index = hit?.object === inscriptions ? Math.floor(hit.faceIndex / 2) : -1;
          const label = labels[index];
          if (!label || label.kind !== 'banner') { samples.push({ state: flag.state, face, missing: true }); continue; }
          const column = index % 4 * 128, row = Math.floor(index / 4) * 32;
          const pixels = context.getImageData(column, row, 32, 32).data;
          let left = 32, right = -1, top = 32, bottom = -1, ink = 0;
          for (let vertical = 0; vertical < 32; vertical++) for (let horizontal = 0; horizontal < 32; horizontal++) {
            const offset = (vertical * 32 + horizontal) * 4;
            if (pixels[offset] < 220 || pixels[offset + 1] < 175 || pixels[offset + 2] < 100) continue;
            left = Math.min(left, horizontal); right = Math.max(right, horizontal);
            top = Math.min(top, vertical); bottom = Math.max(bottom, vertical); ink++;
          }
          const vertex = index * 4;
          samples.push({ state: flag.state, face, text: label.text, yaw: label.yaw, ink, bounds: [left, top, right, bottom],
            uvRatio: Math.abs((uv.getX(vertex + 1) - uv.getX(vertex)) / (uv.getY(vertex + 2) - uv.getY(vertex + 1))),
            square: label.width === label.height,
            inCloth: label.y - label.height / 2 > 2.35 && label.y + label.height / 2 < 5.75,
          });
        }
      }
      return { samples, cloth, oldPoles, atlas: [canvas.width, canvas.height], labelMeshes: root.children.filter(mesh => mesh.name === 'qin-inscriptions').length,
        flagLabels: labels.filter(label => label.kind === 'banner').length,
        polesSolid: flags.every(flag => home.world.qinIsland.site.collides(flag.x, 1, flag.z)),
        approachesClear: flags.every(flag => home.nav.canStand(flag.x, flag.z + 1.2) && !home.world.qinIsland.site.collides(flag.x, 0, flag.z + 1.2)) };
    }, QIN_STATE_FLAGS);
    assert.equal(geometry.cloth.length, 7);
    assert.equal(geometry.flagLabels, 14);
    assert.equal(geometry.labelMeshes, 1);
    assert.deepEqual(geometry.atlas, [512, 512]);
    assert.deepEqual(geometry.oldPoles, []);
    assert.ok(geometry.polesSolid && geometry.approachesClear, 'Flag bases must not block their approaches');
    assert.ok(geometry.cloth.every(cloth => Math.abs(cloth.size[0] - 1.9) < 0.001 && Math.abs(cloth.size[1] - 3.4) < 0.001));
    for (const sample of geometry.samples) {
      assert.ok(!sample.missing && sample.text === sample.state && sample.square && sample.inCloth, JSON.stringify(sample));
      assert.ok(Math.abs(sample.uvRatio - 1) < 0.001 && sample.ink > 60, JSON.stringify(sample));
      assert.ok(sample.bounds[0] > 2 && sample.bounds[1] > 2 && sample.bounds[2] < 29 && sample.bounds[3] < 29, `Glyph is clipped: ${JSON.stringify(sample)}`);
      assert.equal(sample.yaw, sample.face === 1 ? 0 : Math.PI);
    }
    const walks = await page.evaluate(({ stations, courtyard, hall }) => {
      const player = __home.player, idle = { x: 0, z: 0, run: false, up: false, down: false };
      player.teleport(111, courtyard.z1 + 8);
      const targets = [[111, courtyard.z1 - 2], ...stations.filter(station => ['qin-zhao', 'qin-tiger', 'qin-dream'].includes(station.id)).map(station => station.at),
        [111, courtyard.z1 - 2], [111, courtyard.z1 + 8], [123, courtyard.z1 + 7], [123, hall.z + 14], [112, hall.z + 14], [112, hall.z + 6.2], [112, hall.z + 1]];
      return targets.map(([column, row]) => {
        const accepted = player.goTo(column, row);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground';
        }
        return { target: [column, row], accepted, flew, distance: Math.hypot(player.pos.x - column, player.pos.z - row) };
      });
    }, { stations: QIN_STATIONS, courtyard: QIN_COURTYARD, hall: QIN_HANFEI });
    assert.ok(walks.every(walk => walk.accepted && !walk.flew && walk.distance < 0.2), JSON.stringify(walks));
    const measurements = [];
    for (const time of ['day', 'night']) {
      const shots = QIN_STATE_FLAGS.map(flag => {
        const center = flag.x + flag.side * 1.15;
        return { name: flag.attraction, camera: [center, 4.3, flag.z + 8], look: [center, 3.5, flag.z] };
      });
      const wei = QIN_STATE_FLAGS.find(flag => flag.attraction === 'qin-tiger'), center = wei.x + wei.side * 1.15;
      shots.push({ name: 'reverse', camera: [center, 4.3, wei.z - 8], look: [center, 3.5, wei.z] });
      shots.push({ name: 'courtyard', camera: view.hasTouch ? [132, 21, QIN_COURTYARD.z1 + 23] : [126, 10, QIN_COURTYARD.z1 + 18], look: [111, 2.8, QIN_COURTYARD.z1 - 5] });
      for (const shot of shots) {
        await page.evaluate(({ shot, time, courtyard }) => {
          const home = __home;
          home.player.teleport(111, courtyard.z1 - 2); home.setTimeMode(time); home.stage.settle();
          home.rig.showcase(shot.camera, shot.look);
          for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
          home.extras.qinIsland.update(0);
        }, { shot, time, courtyard: QIN_COURTYARD });
        await page.waitForTimeout(250);
        await page.screenshot({ path: fileURLToPath(new URL(`qin-flags-${shot.name}-${time}-${view.name}.png`, output)) });
        const stats = await page.evaluate(() => __home.stats());
        assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, `${shot.name}: ${JSON.stringify(stats)}`);
        measurements.push({ shot: shot.name, time, ...stats });
      }
    }
    assert.deepEqual(errors, []);
    report.push({ view: view.name, geometry, walks, measurements });
    console.log(`${view.name}: 7 relocated flags, 14 unclipped square glyphs, correct front/back, ${walks.length} walks; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-flags-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
