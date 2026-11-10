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
    { name: 'desktop', viewport: { width: 1280, height: 850 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.extras?.coaster || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland;
      home.weather.dispose(); home.rig.recenter(home.player); home.player.teleport(115, 13.8);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle(); home.extras.update(0);
      park.distanceDetail.update(home.stage.camera, home.stage.renderer.domElement.height, true);
      home.stage.scene.updateMatrixWorld(true);
      const inscriptions = park.root.getObjectByName('qin-inscriptions'), results = [];
      const matrix = new THREE.Matrix4(), local = new THREE.Matrix4(), scale = new THREE.Vector3();
      for (const [labelIndex, label] of inscriptions.userData.labels.entries()) {
        if (label.kind === 'banner') continue;
        const normal = new THREE.Vector3(Math.sin(label.yaw), 0, Math.cos(label.yaw));
        const right = new THREE.Vector3(Math.cos(label.yaw), 0, -Math.sin(label.yaw));
        const transform = new THREE.Matrix4().makeRotationY(label.yaw).setPosition(label.x, label.y, label.z).invert();
        const boards = [];
        park.root.traverse(mesh => {
          if (!mesh.isInstancedMesh) return;
          for (let index = 0; index < mesh.count; index++) {
            mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
            local.multiplyMatrices(transform, matrix); scale.setFromMatrixScale(local);
            const elements = local.elements;
            if (Math.abs(elements[12]) > 0.001 || Math.abs(elements[13] - 0.06) > 0.001 || Math.abs(elements[14]) > 0.15
              || Math.abs(scale.x - label.width - 0.14) > 0.001 || Math.abs(scale.y - label.height - 0.12) > 0.001
              || Math.abs(scale.z - 0.12) > 0.001) continue;
            boards.push({ mesh, index, gap: -elements[14] - scale.z / 2 });
          }
        });
        const samples = [];
        for (const horizontal of [-0.45, 0, 0.45]) for (const vertical of [-0.4, 0, 0.4]) {
          samples.push({ horizontal: horizontal * label.width, vertical: vertical * label.height, text: true });
        }
        for (const side of [-1, 1]) for (const vertical of [-0.35, 0, 0.35]) {
          samples.push({ horizontal: side * (label.width / 2 + 0.035), vertical: vertical * label.height, text: false });
        }
        for (const horizontal of [-0.4, 0, 0.4]) {
          samples.push({ horizontal: horizontal * label.width, vertical: label.height / 2 + 0.04, text: false });
        }
        let overlaps = 0, hidden = 0;
        for (const sample of samples) {
          const target = new THREE.Vector3(label.x, label.y + sample.vertical, label.z).addScaledVector(right, sample.horizontal);
          const ray = new THREE.Raycaster(target.clone().addScaledVector(normal, 0.3), normal.clone().negate(), 0, 0.45);
          const unique = new Map();
          for (const hit of ray.intersectObject(home.stage.scene, true)) {
            const key = `${hit.object.uuid}:${hit.instanceId ?? ''}`;
            if (!unique.has(key)) unique.set(key, hit);
          }
          const hits = [...unique.values()], front = hits[0];
          if (sample.text ? front?.object !== inscriptions || Math.floor(front.faceIndex / 2) !== labelIndex
            : !boards.some(board => front?.object === board.mesh && front.instanceId === board.index)) hidden++;
          const nearby = hits.filter(hit => hit.distance > 0.285 && hit.distance < 0.43);
          for (let index = 1; index < nearby.length; index++) {
            if (Math.abs(nearby[index].distance - nearby[index - 1].distance) < 0.001) { overlaps++; break; }
          }
        }
        results.push({ text: label.text, position: [label.x, label.y, label.z], yaw: label.yaw,
          boards: boards.length, gaps: boards.map(board => board.gap), samples: samples.length, overlaps, hidden });
      }
      return results;
    });
    report.push({ view: view.name, checks, measurements: [], errors });
    writeFileSync(new URL('qin-signs-report.json', output), JSON.stringify(report, null, 2));
    const overlapFailures = checks.filter(check => check.overlaps);
    assert.deepEqual(overlapFailures.map(check => [check.text, check.overlaps]), [], 'Sign frames must not be coplanar with their stone mounting surfaces');
    assert.ok(checks.every(check => check.boards === 1 && check.gaps.every(gap => gap >= 0.005 && gap <= 0.03)), 'Text and backing must have a separate front surface');
    assert.deepEqual(checks.filter(check => check.position[1] < 1 && check.hidden).map(check => [check.text, check.hidden]), [], 'Ground plaque text and frame edges must remain visible');
    for (const time of ['day', 'night']) for (const shot of [
      { name: 'warriors-front', camera: [112, 2.3, 16], portrait: [112, 2.9, 18], look: [112, 0.7, 12] },
      { name: 'warriors-angle', camera: [118, 5.6, 16.5], portrait: [117, 5.3, 18.5], look: [112, 1.4, 10.7] },
      { name: 'bianque', camera: [133, 3, 30], portrait: [133, 4, 33], look: [129, 0.6, 26] },
      { name: 'tiger', text: '窃符救赵' },
      { name: 'dream', text: '黄粱梦' },
    ]) {
      await page.evaluate(({ shot, time, mobile }) => {
        const home = __home, labels = home.world.qinIsland.root.getObjectByName('qin-inscriptions').userData.labels;
        let camera = mobile ? shot.portrait : shot.camera, look = shot.look;
        if (shot.text) {
          const label = labels.find(label => label.text === shot.text), distance = mobile ? 7 : 5;
          camera = [label.x + Math.sin(label.yaw) * distance + Math.cos(label.yaw) * 2,
            label.y + 2.8, label.z + Math.cos(label.yaw) * distance - Math.sin(label.yaw) * 2];
          look = [label.x, label.y, label.z];
        }
        home.player.teleport(115, 13.8); home.rig.recenter(home.player);
        home.rig.showcase(camera, look); home.rig.update(3, home.player);
        home.setTimeMode(time); home.stage.settle(); home.weatherFx.settle();
        home.extras.update(0); home.stage.render(); home.stage.render();
      }, { shot, time, mobile: !!view.isMobile });
      await page.waitForTimeout(200);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-signs-${shot.name}-${time}-${view.name}.png`, output)) });
      report.at(-1).measurements.push({ shot: shot.name, time, ...await page.evaluate(() => __home.stats()) });
    }
    writeFileSync(new URL('qin-signs-report.json', output), JSON.stringify(report, null, 2));
    assert.ok(report.at(-1).measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2));
    assert.deepEqual(errors, []);
    console.log(`${view.name}: ${checks.length} signs / ${checks.reduce((sum, check) => sum + check.samples, 0)} samples, no coplanar faces, ground plaques unobstructed; day/night screenshots within budget`);
    await context.close();
  }
} finally {
  await browser.close();
}
