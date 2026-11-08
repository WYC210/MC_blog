import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import './check-qin-great-wall-models.mjs';
import { WALL_MODEL_EVIDENCE } from '../world/qin-great-wall-evidence.js';
import { WALL_STOPS, WALL_PATHS, WALL_SOURCES, WALL_LOCAL_COUNT, wallMatches } from '../world/qin-great-wall-data.js';
import { QIN_WALL_TABLE, QIN_GALLERY, QIN_STATIONS, qinFloorAt } from '../world/qin-island-layout.js';

assert.equal(new Set(WALL_STOPS.map(stop => stop.id)).size, WALL_STOPS.length);
assert.equal(WALL_LOCAL_COUNT, WALL_STOPS.length - 1);
assert.equal(WALL_STOPS.find(stop => stop.id === 'jiumenkou').nearby, true);
assert.equal(qinFloorAt(...QIN_WALL_TABLE.at), QIN_GALLERY.floor);
assert.ok(QIN_WALL_TABLE.width >= 30 && QIN_WALL_TABLE.z + QIN_WALL_TABLE.depth / 2 < -40);
assert.ok(QIN_WALL_TABLE.z - QIN_WALL_TABLE.depth / 2 > QIN_GALLERY.z0);
assert.ok(QIN_STATIONS.some(station => station.id === 'qin-great-wall' && station.floor === 3));
for (const stop of WALL_STOPS) {
  assert.ok(stop.name && stop.en && stop.text && stop.textEn && stop.sources.length);
  assert.ok(stop.point.every(coordinate => coordinate > 0 && coordinate < 1));
  for (const key of stop.sources) assert.ok(WALL_SOURCES[key]?.url.startsWith('https://'));
}
for (const path of WALL_PATHS) for (const id of path) assert.ok(WALL_STOPS.some(stop => stop.id === id));
assert.ok(wallMatches(WALL_STOPS.find(stop => stop.id === 'jiaoshan'), 'all', ' JIAOSHAN '));
assert.ok(wallMatches(WALL_STOPS.find(stop => stop.id === 'huachangyu'), 'all', '花厂峪'));
assert.ok(!wallMatches(WALL_STOPS.find(stop => stop.id === 'jiaoshan'), 'west', '角山'));

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
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const checks = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, park = home.world.qinIsland, wall = park.greatWall, player = home.player;
      const { QIN_WALL_TABLE: table } = await import('@world/qin-island-layout.js');
      const { WALL_STOPS: stops } = await import('@world/qin-great-wall-data.js');
      home.rig.skipIntro(); home.setTimeMode('day'); home.setWeatherMode('clear');
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      const idle = { x: 0, z: 0, run: false, up: false, down: false }, walks = [];
      assertWalkStart: {
        if (!player.teleport(160, -18)) break assertWalkStart;
        for (const [target, floor] of [[[160, -24], 3], [table.at, 3], [[145.5, -40.2], 3], [[175.5, -40.2], 3], [[160, -24], 3], [[178.5, -24.25], null], [[178.5, -35.8], 7], [[171, -38], 7], [table.at, 3], [[160, -24], 3]]) {
          const accepted = player.goTo(...target, floor == null ? null : { floor });
          let flew = false, collided = false;
          for (let frame = 0; frame < 12000 && player.travelling; frame++) {
            player.update(1 / 60, idle, 0); flew ||= player.mode !== 'ground'; collided ||= park.site.collides(player.pos.x, player.y, player.pos.z);
          }
          for (let frame = 0; frame < 30; frame++) player.update(1 / 60, idle, 0);
          walks.push({ target, floor, accepted, flew, collided, distance: Math.hypot(player.pos.x - target[0], player.pos.z - target[1]), height: player.y });
        }
      }
      const camera = new THREE.PerspectiveCamera(55, 1.5, 0.1, 300), frustum = new THREE.Frustum(), matrix = new THREE.Matrix4();
      function aim(position, target) {
        camera.position.set(...position); camera.lookAt(...target); camera.updateMatrixWorld();
        frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
      }
      aim([145, 6.3, -37], [table.x, 4.7, table.z]);
      const visit = (x, z, floor) => {
        player.teleport(x, z, { floor }); home.extras.qinIsland.update(0);
      };
      visit(160, -18, 3); wall.select('jiaoshan');
      const outsideUpdates = wall.state.updates;
      for (let frame = 0; frame < 240; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const outsidePaused = !wall.state.inRoom && !wall.state.touring && wall.state.selected === 'jiaoshan' && wall.state.updates === outsideUpdates;
      visit(160, -24, 3);
      const autoEntry = wall.state.inRoom && wall.state.touring;
      const before = wall.state.updates;
      for (let frame = 0; frame < 60; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const animated = wall.state.updates - before === 60;
      for (let frame = 0; frame < 220; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const toured = wall.state.selected === 'sandaoguan';
      wall.select('dongjiakou'); const manualPaused = !wall.state.touring;
      const ring = wall.ring.position, focus = wall.model.focus, modelPosition = wall.model.root.position;
      const selectedPosition = ring.x === focus.x + modelPosition.x && ring.z === focus.z + modelPosition.z;
      const beforePaused = wall.state.updates;
      for (let frame = 0; frame < 60; frame++) wall.update(1 / 30, camera, frustum, player, true, false);
      const reducedPaused = wall.state.updates === beforePaused;
      for (let frame = 0; frame < 60; frame++) wall.update(1 / 30, camera, frustum, player, false, true);
      const hiddenPaused = wall.state.updates === beforePaused;
      aim([160, 6, -20], [160, 6, 0]);
      for (let frame = 0; frame < 60; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const offscreenPaused = wall.state.updates === beforePaused;
      aim([0, 8, 0], [table.x, 4.3, table.z]); wall.update(1 / 30, camera, frustum, player, false, false);
      const farPaused = !wall.root.visible && wall.state.updates === beforePaused;
      const invalidRejected = wall.select('missing') === false && wall.state.selected === 'dongjiakou';
      aim([145, 6.3, -37], [table.x, 4.7, table.z]);
      for (let frame = 0; frame < 240; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const manualStayedPaused = !wall.state.touring && wall.state.selected === 'dongjiakou';
      wall.tour(true);
      for (let frame = 0; frame < 180; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      visit(160, -18, 3);
      const exitUpdates = wall.state.updates;
      for (let frame = 0; frame < 240; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const exitPaused = !wall.state.inRoom && !wall.state.touring && wall.state.selected === 'dongjiakou' && wall.state.updates === exitUpdates;
      visit(171, -38, 7);
      for (let frame = 0; frame < 240; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const upstairsPaused = !wall.state.inRoom && !wall.state.touring && wall.state.selected === 'dongjiakou' && wall.state.updates === exitUpdates;
      visit(...table.at, table.floor);
      const reentryStarted = wall.state.inRoom && wall.state.touring;
      for (let frame = 0; frame < 180; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const reentryDelay = wall.state.selected === 'dongjiakou';
      for (let frame = 0; frame < 40; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const reentryToured = wall.state.selected === 'banchangyu';
      wall.tour(true);
      for (let frame = 0; frame < 240; frame++) wall.update(1 / 30, camera, frustum, player, true, false);
      const reducedTourPaused = wall.state.touring && wall.state.selected === 'banchangyu';
      for (let frame = 0; frame < 220; frame++) wall.update(1 / 30, camera, frustum, player, false, false);
      const reducedTourResumed = wall.state.selected === 'naziyu';
      const models = [], geometryIds = [wall.model.terrain.uuid, wall.model.mesh.geometry.uuid];
      for (const stop of stops) {
        wall.select(stop.id);
        let hash = 2166136261;
        for (const array of [wall.model.terrain.attributes.position.array, wall.model.mesh.instanceMatrix.array.subarray(0, wall.model.mesh.count * 16)]) {
          const bits = new Uint32Array(array.buffer, array.byteOffset, array.length);
          for (const value of bits) hash = Math.imul(hash ^ value, 16777619);
        }
        models.push({ id: stop.id, hash, instances: wall.model.mesh.count, kind: wall.model.state.kind, reference: wall.model.state.reference,
          piers: wall.model.mesh.userData.tags.filter(tag => tag === 'qin-wall-detail:bridge-pier').length });
      }
      const buffersReused = geometryIds[0] === wall.model.terrain.uuid && geometryIds[1] === wall.model.mesh.geometry.uuid;
      const upperTeleport = player.teleport(171, -38, { floor: 7 }) && Math.abs(player.y - 7) < 0.01;
      const lowerTeleport = player.teleport(...table.at, { floor: table.floor }) && Math.abs(player.y - table.floor) < 0.01;
      const lowerPick = park.lowerFloor.pick(new THREE.Ray(new THREE.Vector3(table.at[0], 5, table.at[1]), new THREE.Vector3(0, -1, 0)));
      const upperPickIgnored = park.lowerFloor.pick(new THREE.Ray(new THREE.Vector3(table.at[0], 9, table.at[1]), new THREE.Vector3(0, -1, 0))) === null;
      const tapped = park.lowerFloor.tap(player, { island: { point: new THREE.Vector3(170, 3.005, table.at[1]) } });
      for (let frame = 0; frame < 3000 && player.travelling; frame++) player.update(1 / 60, idle, 0);
      const lowerTap = tapped && Math.abs(player.pos.x - 170) < 0.2 && Math.abs(player.y - 3) < 0.01;
      wall.select('jiaoshan'); player.teleport(...table.at, { floor: table.floor, look: [table.x, table.z] });
      return { walks, animated, toured, manualPaused, selectedPosition, reducedPaused, hiddenPaused, offscreenPaused, farPaused, invalidRejected,
        outsidePaused, autoEntry, manualStayedPaused, exitPaused, upstairsPaused, reentryStarted, reentryDelay, reentryToured, reducedTourPaused, reducedTourResumed,
        models, buffersReused, upperTeleport, lowerTeleport, lowerPick: lowerPick?.site === 'qin-palace-lower', upperPickIgnored, lowerTap,
        blocked: park.site.collides(table.x, table.floor, table.z) && !home.world.ground.canStand(table.x, table.z, table.floor),
        lamps: park.bakes.filter(light => light.id === 'qin-great-wall-table').length };
    });
    assert.equal(checks.walks.length, 10);
    assert.ok(checks.walks.every(walk => walk.accepted && !walk.flew && !walk.collided && walk.distance < 0.2), JSON.stringify(checks.walks));
    assert.ok(checks.walks.every(walk => walk.floor == null || Math.abs(walk.height - walk.floor) < 0.05), JSON.stringify(checks.walks));
    for (const key of ['animated', 'toured', 'manualPaused', 'selectedPosition', 'reducedPaused', 'hiddenPaused', 'offscreenPaused', 'farPaused', 'invalidRejected', 'blocked', 'upperTeleport', 'lowerTeleport', 'lowerPick', 'upperPickIgnored', 'lowerTap']) assert.ok(checks[key], key);
    for (const key of ['outsidePaused', 'autoEntry', 'manualStayedPaused', 'exitPaused', 'upstairsPaused', 'reentryStarted', 'reentryDelay', 'reentryToured', 'reducedTourPaused', 'reducedTourResumed']) assert.ok(checks[key], key);
    assert.equal(checks.lamps, 1);
    assert.equal(new Set(checks.models.map(model => model.hash)).size, WALL_STOPS.length, 'Each selection must change the actual terrain/wall geometry');
    assert.ok(checks.buffersReused);
    assert.equal(checks.models.find(model => model.id === 'jiumenkou').piers, 8);
    assert.deepEqual(checks.models.filter(model => model.reference).map(model => model.id).sort(), Object.keys(WALL_MODEL_EVIDENCE).sort());
    const measurements = [];
    for (const time of ['day', 'night']) {
      await page.evaluate(async ({ time, phone }) => {
        const home = __home;
        const { QIN_WALL_TABLE: table } = await import('@world/qin-island-layout.js');
        home.player.teleport(...table.at, { floor: table.floor, look: [table.x, table.z] }); home.setTimeMode(time); home.stage.settle();
        home.rig.showcase(phone ? [144, 6.3, -39] : [144, 6.3, -36], [table.x, 4.7, table.z]);
        for (let frame = 0; frame < 200; frame++) home.rig.update(1 / 60, home.player);
        home.extras.qinIsland.update(0);
      }, { time, phone: !!view.hasTouch });
      await page.waitForTimeout(500);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-wall-${time}-${view.name}.png`, output)) });
      measurements.push({ time, ...await page.evaluate(() => __home.stats()) });
    }
    await page.evaluate(() => __home.setTimeMode('day'));
    for (const id of Object.keys(WALL_MODEL_EVIDENCE)) {
      await page.evaluate(id => __home.world.qinIsland.greatWall.select(id), id);
      await page.waitForTimeout(250);
      await page.screenshot({ path: fileURLToPath(new URL(`qin-wall-model-${id}-${view.name}.png`, output)) });
      measurements.push({ model: id, ...await page.evaluate(() => __home.stats()) });
    }
    await page.evaluate(() => __home.world.qinIsland.greatWall.select('jiaoshan'));
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent.includes('长城'));
    if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
    const panel = page.locator('#panel[open][data-station="qin-great-wall"]');
    await panel.waitFor(); await panel.locator('[data-wall-stop]').first().waitFor();
    assert.equal(await panel.locator('[data-wall-stop]').count(), WALL_STOPS.length);
    const activate = async locator => view.hasTouch ? locator.tap() : locator.click();
    await activate(panel.locator('[data-wall-stop="dongjiakou"]'));
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.state.selected), 'dongjiakou');
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.model.state.selected), 'dongjiakou');
    assert.equal(await panel.locator('.wall-detail h3').textContent(), '董家口长城');
    assert.equal(await panel.locator('.wall-model-note').getAttribute('data-reference'), 'true');
    assert.match(await panel.locator('.wall-model-note').textContent(), /不虚构/);
    assert.equal(await panel.locator('.wall-model-sources a').count(), 2);
    await activate(panel.locator('[data-wall-stop="south-wing"]'));
    assert.equal(await panel.locator('.wall-model-note').getAttribute('data-reference'), 'false');
    assert.match(await panel.locator('.wall-model-note').textContent(), /待补证/);
    assert.equal(await panel.locator('.wall-model-sources a').count(), 0);
    const search = panel.locator('input');
    await search.fill('角山'); assert.equal(await panel.locator('[data-wall-stop]').count(), 1);
    await search.fill('not-a-wall'); assert.equal(await panel.locator('[data-wall-stop]').count(), 0); assert.ok(await panel.locator('.wall-empty').isVisible());
    await search.fill(''); await activate(panel.locator('[data-wall-region="nearby"]'));
    assert.equal(await panel.locator('[data-wall-stop]').count(), 1);
    await activate(panel.locator('[data-wall-stop="jiumenkou"]'));
    assert.match(await panel.locator('.wall-location').textContent(), /辽宁.*非秦皇岛/);
    await activate(panel.locator('.lang-switch'));
    assert.equal(await panel.locator('.wall-detail h3').textContent(), 'Jiumenkou');
    assert.match(await panel.locator('.wall-model-note').textContent(), /Eight spindle-shaped/);
    assert.equal(await panel.locator('[data-wall-region="nearby"]').getAttribute('aria-pressed'), 'true');
    await activate(panel.locator('[data-wall-region="all"]')); await search.fill('JIAOSHAN');
    assert.equal(await panel.locator('[data-wall-stop]').count(), 1);
    await activate(panel.locator('[data-wall-stop="jiaoshan"]')); await search.fill('');
    await activate(panel.locator('.lang-switch'));
    await activate(panel.locator('[data-wall-action="tour"]'));
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.state.touring), true);
    await activate(panel.locator('[data-wall-action="next"]'));
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.state.touring), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => document.querySelector('#panel [data-wall-action="tour"]').disabled);
    assert.ok(await panel.locator('[data-wall-action="tour"]').isDisabled());
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await activate(panel.locator('[data-wall-action="previous"]'));
    await panel.locator('.body').evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: fileURLToPath(new URL(`qin-wall-guide-${view.name}.png`, output)) });
    const dimensions = await panel.evaluate(element => {
      const body = element.querySelector('.body'), rect = element.getBoundingClientRect();
      return { width: rect.width, screen: innerWidth, bodyWidth: body.clientWidth, contentWidth: body.scrollWidth, top: rect.top, bottom: rect.bottom, height: innerHeight };
    });
    assert.ok(dimensions.width <= dimensions.screen && dimensions.contentWidth <= dimensions.bodyWidth + 1 && dimensions.top >= 0 && dimensions.bottom <= dimensions.height + 1, JSON.stringify(dimensions));
    for (const stop of WALL_STOPS) {
      await page.evaluate(id => __home.extras.qinIsland.greatWall.select(id), stop.id);
      assert.equal(await panel.locator('.wall-detail h3').textContent(), stop.name);
      assert.equal(await panel.locator('.wall-sources:not(.wall-model-sources) a').count(), stop.sources.length);
      assert.equal(await panel.locator('.wall-model-sources a').count(), WALL_MODEL_EVIDENCE[stop.id]?.sources.length || 0);
    }
    await activate(panel.locator('summary')); assert.match(await panel.locator('.wall-scope').textContent(), /不等同/);
    if (view.hasTouch) {
      await page.setViewportSize({ width: 844, height: 390 });
      assert.ok(await panel.evaluate(element => element.getBoundingClientRect().bottom <= innerHeight + 1));
      await page.screenshot({ path: fileURLToPath(new URL('qin-wall-guide-phone-landscape.png', output)) });
    }
    await activate(panel.locator('[data-wall-action="tour"]'));
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.state.touring), true);
    await activate(panel.locator('[data-wall-action="view"]'));
    assert.equal(await page.locator('#panel').evaluate(element => element.open), false);
    assert.equal(await page.evaluate(() => __home.world.qinIsland.greatWall.state.touring), true, 'Closing the card must preserve room autoplay');
    await page.evaluate(() => __home.go('qin-great-wall'));
    await panel.locator('[data-wall-stop]').first().waitFor();
    assert.equal(await panel.locator('.wall-detail h3').textContent(), '九门口长城');
    await activate(panel.locator('.close'));
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, checks, dimensions, measurements, errors });
    writeFileSync(new URL('qin-great-wall-report.json', output), JSON.stringify(report, null, 2));
    console.log(`${view.name}: ${WALL_STOPS.length} entries, keyboard/touch, search/filter, bilingual, room-entry autoplay, exit/upstairs pauses, re-entry, 10 walking routes, day/night; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
} finally {
  await browser.close();
}
