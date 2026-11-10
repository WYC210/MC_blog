import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));
try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1440, height: 900 }, screen: { width: 1920, height: 1080 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ].filter(view => !process.env.COASTER_VIEW || view.name === process.env.COASTER_VIEW)) {
    const context = await browser.newContext(view);
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    const page = await context.newPage(), errors = [], budget = { calls: 0, triangles: 0 }, budgetWarnings = [], samples = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.extras?.coaster || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const initial = await page.evaluate(() => {
      const home = __home, coaster = home.extras.coaster, player = home.player;
      home.weather.dispose(); home.rig.skipIntro(); home.rig.update(20, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      const idle = { x: 0, z: 0, up: false, down: false, run: false };
      function advance(frames, input = idle) {
        for (let frame = 0; frame < frames; frame++) {
          player.update(1 / 60, input, 0); home.rig.update(1 / 60, player); coaster.update(1 / 60);
        }
      }
      function finish() {
        let frames = 0, peakSpeed = 0;
        const scenes = {};
        while (coaster.state !== 'idle' && frames++ < 18000) {
          advance(1); peakSpeed = Math.max(peakSpeed, coaster.speed);
          if (coaster.section) scenes[coaster.section.id] = Math.max(scenes[coaster.section.id] || 0, coaster.speed);
        }
        return { frames, peakSpeed, scenes, state: coaster.state, station: coaster.station };
      }
      function approach() {
        player.teleport(15, -18);
        for (let frame = 0; frame < 400 && player.pos.z > -31; frame++) advance(1, { ...idle, z: -1 });
        coaster.update(0);
      }
      window.__coasterTest = { advance, finish, approach };
      const distant = coaster.interact(); approach();
      const collisions = [], position = {}, tangent = {};
      for (const line of coaster.lines) for (let distance = 0; distance < line.route.length; distance += 0.4) {
        line.route.sample(distance, position, tangent);
        for (const lateral of [-0.7, 0, 0.7]) {
          const horizontal = Math.hypot(tangent.x, tangent.z);
          const column = position.x + tangent.z / horizontal * lateral, row = position.z - tangent.x / horizontal * lateral;
          for (const height of [0.3, 1, 1.9]) {
            if (home.world.grid.get(Math.floor(column), Math.floor(position.y + height), Math.floor(row))) collisions.push([column, position.y + height, row]);
          }
          if (home.world.ground.collides(column, position.y + 0.25, row)) collisions.push([column, row]);
        }
      }
      return { distant, collisions, floor: player.floorY, programs: home.stats().programs,
        trains: home.world.coaster.group.children.filter(item => item.name === 'coaster-train').length,
        cars: coaster.cars.length, visible: coaster.lines.filter(line => line.track.mesh.visible).map(line => line.id),
        chooseBeforeBoarding: coaster.choose('loop') };
    });
    assert.equal(initial.distant, false); assert.deepEqual(initial.collisions, []);
    assert.ok(Math.abs(initial.floor - 2.25) < 1e-8); assert.equal(initial.trains, 1); assert.equal(initial.cars, 3);
    assert.deepEqual(initial.visible, ['qin']); assert.equal(initial.chooseBeforeBoarding, false);
    const performance = await page.evaluate(async () => {
      const THREE = await import('three'), home = __home, camera = new THREE.PerspectiveCamera();
      const tangent = new THREE.Vector3(), tracks = [];
      for (const { route, track } of home.extras.coaster.lines) {
        const detail = track.mesh.children[1], geometry = detail.geometry, ranges = new Set();
        let stable = true, bounded = true, covered = true;
        for (let distance = 0; distance <= route.trackLength; distance += 4) {
          route.sample(distance, camera.position, tangent); track.update(camera, true);
          stable &&= detail.geometry === geometry;
          bounded &&= geometry.drawRange.count > 0 && geometry.drawRange.count < geometry.index.count;
          ranges.add(geometry.drawRange.start);
          const position = geometry.attributes.position, point = new THREE.Vector3();
          for (let index = geometry.drawRange.start; index < geometry.drawRange.start + geometry.drawRange.count; index++) {
            point.fromBufferAttribute(position, geometry.index.array[index]);
            covered &&= point.distanceTo(geometry.boundingSphere.center) <= geometry.boundingSphere.radius + 0.001;
          }
        }
        tracks.push({ id: route.id, stable, bounded, covered, windows: ranges.size });
        track.update(home.stage.camera, false);
      }
      const detail = home.world.qinIsland.distanceDetail;
      camera.position.set(90, 10, 19); detail.update(camera);
      const full = detail.meshes.map(mesh => mesh.count), versions = detail.meshes.map(mesh => mesh.instanceMatrix.version);
      camera.position.set(-50, 35, 0); detail.update(camera);
      const far = detail.meshes.map(mesh => mesh.count);
      const { emperor, guards } = home.world.qinIsland.encounterActors;
      const actorsPreserved = [emperor, ...guards].every(actor => actor.parts.every(part => part.index < part.mesh.count));
      camera.position.x = -8; detail.update(camera);
      const heldFar = detail.distant;
      camera.position.x = 90; detail.update(camera);
      const restored = detail.meshes.map(mesh => mesh.count);
      camera.position.x = -8; detail.update(camera);
      const heldNear = !detail.distant;
      const unchanged = detail.meshes.every((mesh, index) => mesh.instanceMatrix.version === versions[index]);
      detail.update(home.stage.camera);
      return { tracks, full, far, restored, heldFar, heldNear, unchanged, actorsPreserved };
    });
    for (const track of performance.tracks) {
      assert.ok(track.stable && track.bounded && track.covered && track.windows > 10, `Track buffer reuse: ${JSON.stringify(track)}`);
    }
    assert.ok(performance.far.reduce((sum, count) => sum + count, 0) < performance.full.reduce((sum, count) => sum + count, 0) * 0.75);
    assert.deepEqual(performance.restored, performance.full);
    assert.ok(performance.heldFar && performance.heldNear && performance.unchanged && performance.actorsPreserved);
    async function click(selector) {
      if (view.hasTouch) await page.locator(selector).tap(); else await page.locator(selector).click();
    }
    async function shot(name) {
      const stats = await page.evaluate(async () => {
        for (let frame = 0; frame < 4; frame++) await new Promise(resolve => requestAnimationFrame(resolve));
        return __home.stats();
      });
      assert.ok(stats.calls <= stats.budget.calls, `${view.name} ${name}: calls ${stats.calls}`);
      if (stats.triangles > stats.budget.triangles) budgetWarnings.push(`${name}: ${stats.triangles} triangles > ${stats.budget.triangles}`);
      assert.equal(stats.lights, 0);
      budget.calls = Math.max(budget.calls, stats.calls); budget.triangles = Math.max(budget.triangles, stats.triangles);
      samples.push({ name, ...stats });
      await page.screenshot({ path: fileURLToPath(new URL(`coaster-${view.name}-${name}.png`, output)) });
    }
    await click('#coasterPrompt');
    assert.equal(await page.evaluate(() => __home.extras.coaster.state), 'boarding');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), false);
    await shot('boarding');
    const switched = await page.evaluate(() => {
      const coaster = __home.extras.coaster, cars = coaster.cars.map(car => car.position.toArray());
      const hidden = coaster.lines.find(line => line.id === 'qin').track;
      const update = hidden.update; hidden.update = () => { window.__hiddenTrackUpdates = (window.__hiddenTrackUpdates || 0) + 1; };
      const selected = coaster.choose('loop');
      const after = coaster.cars.map(car => car.position.toArray());
      const distance = coaster.distance; coaster.interact();
      const switching = coaster.state;
      __coasterTest.advance(30);
      const held = coaster.distance === distance;
      __coasterTest.advance(240);
      hidden.update = update;
      return { selected, cars, after, switching, held, hiddenUpdates: window.__hiddenTrackUpdates || 0,
        visible: coaster.lines.filter(line => line.track.mesh.visible).map(line => line.id), turnout: coaster.turnout.selected, moving: coaster.turnout.moving };
    });
    assert.equal(switched.selected, true); assert.deepEqual(switched.cars, switched.after);
    assert.equal(switched.switching, 'switching'); assert.equal(switched.held, true); assert.equal(switched.moving, false);
    assert.equal(switched.hiddenUpdates, 0); assert.deepEqual(switched.visible, ['loop']); assert.equal(switched.turnout, 'loop');
    assert.equal(await page.evaluate(() => __home.extras.coaster.choose('qin')), false);
    await page.evaluate(() => __coasterTest.advance(300));
    await shot('third-person');
    const third = await page.evaluate(() => ({ first: __home.rig.firstPerson,
      distance: __home.stage.camera.position.distanceTo(__home.extras.coaster.car.position), avatar: __home.avatar?.root.visible }));
    assert.equal(third.first, false); assert.ok(third.distance > 6);
    await click('#viewButton'); await page.evaluate(() => __coasterTest.advance(90));
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), true);
    const touch = view.hasTouch ? await context.newCDPSession(page) : null;
    async function drag(start, end) {
      if (touch) {
        await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start[0], y: start[1] }] });
        for (let step = 1; step <= 6; step++) await touch.send('Input.dispatchTouchEvent', {
          type: 'touchMove', touchPoints: [{ x: start[0] + (end[0] - start[0]) * step / 6, y: start[1] + (end[1] - start[1]) * step / 6 }],
        });
        await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } else {
        await page.mouse.move(...start); await page.mouse.down(); await page.mouse.move(...end, { steps: 6 }); await page.mouse.up();
      }
      await page.evaluate(() => __coasterTest.advance(90));
    }
    await drag([90, 350], [270, 350]);
    const yaw = await page.evaluate(() => __home.extras.coaster.lookYaw);
    assert.ok(yaw < -0.7 && yaw > -1.1, `Horizontal drag: ${yaw}`);
    await drag([200, 350], [200, 470]);
    assert.ok(Math.abs(await page.evaluate(() => __home.extras.coaster.lookYaw) - yaw) < 0.001);
    await page.keyboard.down('ArrowLeft'); await page.evaluate(() => __coasterTest.advance(30)); await page.keyboard.up('ArrowLeft');
    await click('#coasterCenter'); await page.evaluate(() => __coasterTest.advance(120));
    assert.ok(await page.evaluate(() => Math.abs(__home.extras.coaster.lookYaw) < 0.001));
    await page.keyboard.press('v'); await page.evaluate(() => __coasterTest.advance(90));
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), false);
    const safety = await page.evaluate(() => {
      const home = __home, coaster = home.extras.coaster;
      const exit = home.player.dismountVehicle(), flight = home.player.toggleFly(), travel = home.extras.travelAgency.travel('home-island');
      const distance = coaster.distance, yaw = coaster.lookYaw;
      document.querySelector('#weatherMenu').hidden = false; __coasterTest.advance(120);
      const paused = coaster.distance === distance && coaster.lookYaw === yaw;
      document.querySelector('#weatherMenu').hidden = true;
      return { exit, flight, travel, paused };
    });
    assert.deepEqual(safety, { exit: false, flight: false, travel: false, paused: true });
    const loop = await page.evaluate(() => {
      const trip = __coasterTest.finish(); __home.extras.coaster.interact(); return trip;
    });
    assert.equal(loop.state, 'idle'); assert.equal(loop.station, 0);
    assert.equal(await page.evaluate(() => __home.player.mode), 'ground');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), false);
    await click('#coasterPrompt');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __home.player.mode), 'ground');
    await click('#coasterPrompt');
    await click('#coasterRoutes [data-action=depart]');
    const fullLoop = await page.evaluate(() => __coasterTest.finish());
    assert.deepEqual(Object.keys(fullLoop.scenes).sort(), ['east', 'north', 'south', 'west']);
    assert.ok(fullLoop.peakSpeed > 26); assert.equal(fullLoop.station, 0);
    for (const speed of Object.values(fullLoop.scenes)) assert.ok(speed <= 7.25, JSON.stringify(fullLoop));
    await click('#coasterPrompt');
    await click('#coasterPrompt');
    await click('#coasterRoutes [data-route=qin]');
    await click('#coasterRoutes [data-action=cancel]');
    assert.equal(await page.evaluate(() => __home.player.mode), 'ground');
    await click('#coasterPrompt');
    await page.keyboard.press('f');
    const qin = await page.evaluate(() => __coasterTest.finish());
    assert.equal(qin.state, 'idle'); assert.equal(qin.station, 1); assert.ok(qin.peakSpeed > 26);
    await click('#coasterPrompt');
    assert.equal(await page.evaluate(() => __home.nav.canStand(__home.player.pos.x, __home.player.pos.z)), true);
    await page.evaluate(() => __home.rig.setFirstPerson(true, __home.player.heading));
    await click('#coasterPrompt');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), true);
    assert.equal(await page.evaluate(() => document.querySelector('#coasterRoutes').hidden), true);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const returned = await page.evaluate(() => __coasterTest.finish());
    assert.equal(returned.station, 0); assert.ok(returned.peakSpeed <= 6.001);
    await click('#coasterPrompt');
    assert.equal(await page.evaluate(() => __home.rig.firstPerson), true);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const called = await page.evaluate(() => {
      const home = __home, coaster = home.extras.coaster;
      home.rig.setFirstPerson(false); home.player.teleport(90, 19); coaster.update(0);
      const accepted = coaster.interact(), mode = home.player.mode, trip = __coasterTest.finish();
      coaster.interact(); __coasterTest.finish(); coaster.interact();
      __coasterTest.advance(300, { x: 0, z: 1, up: false, down: false, run: false });
      return { accepted, mode, trip, floor: home.player.floorY, ground: home.player.mode };
    });
    assert.equal(called.accepted, true); assert.equal(called.mode, 'ground'); assert.equal(called.trip.station, 1);
    assert.equal(called.ground, 'ground'); assert.ok(called.floor < 0.05);
    await page.evaluate(() => { __coasterTest.approach(); __home.extras.coaster.interact(); __home.extras.coaster.choose('loop'); __home.extras.coaster.interact(); });
    for (const id of ['north', 'west', 'south', 'east']) {
      await page.evaluate(async id => {
        const THREE = await import('three'), home = __home, service = home.extras.coaster.service;
        const section = service.route.sections.find(section => section.id === id), middle = (section.start + section.end) / 2;
        let frames = 0;
        while (service.distance < middle && frames++ < 18000) __coasterTest.advance(1);
        const forward = home.stage.camera.getWorldDirection(new THREE.Vector3());
        const desired = Math.atan2(-service.car.position.x, 5 - service.car.position.z), heading = Math.atan2(forward.x, forward.z);
        service.view.turn(Math.atan2(Math.sin(desired - heading), Math.cos(desired - heading)));
        for (let frame = 0; frame < 120; frame++) service.view.update(service.eyeDistance, service.direction, service.speed, 1 / 60);
      }, id);
      await shot(`scenic-${id}`);
    }
    await page.evaluate(() => { __coasterTest.finish(); __home.extras.coaster.interact(); });
    for (const shotView of [
      { name: 'station', camera: [15, 11, -13], look: [15, 3, -31] },
      { name: 'overview', camera: [-84, 100, 116], look: [0, 6, 4] },
    ]) {
      await page.evaluate(shot => { __home.rig.showcase(shot.camera, shot.look); __home.rig.update(3, __home.player); }, shotView);
      for (const time of ['day', 'night']) {
        await page.evaluate(time => { __home.setTimeMode(time); __home.stage.settle(); }, time);
        await shot(`${shotView.name}-${time}`);
      }
    }
    await page.evaluate(async () => {
      __coasterTest.approach(); (await import('@engine/lang.js')).setLang('en'); __home.extras.coaster.update(0); __home.extras.coaster.interact();
    });
    for (const viewport of view.hasTouch ? [{ width: 320, height: 640 }, { width: 844, height: 390 }] : [view.viewport]) {
      await page.setViewportSize(viewport);
      const fits = await page.evaluate(() => {
        const picker = document.querySelector('#coasterRoutes').getBoundingClientRect();
        return picker.left >= 0 && picker.right <= innerWidth && picker.top >= 50 && picker.bottom <= innerHeight - 40
          && [...document.querySelectorAll('#coasterRoutes button')].every(button => button.getBoundingClientRect().height >= 44);
      });
      assert.equal(fits, true, `Boarding UI ${viewport.width}x${viewport.height}`);
      await page.screenshot({ path: fileURLToPath(new URL(`coaster-${view.name}-picker-${viewport.width}.png`, output)) });
    }
    assert.deepEqual(errors, []);
    writeFileSync(new URL(`coaster-${view.name}-report.json`, output), JSON.stringify({ performance, samples, budget, errors, budgetWarnings }, null, 2));
    console.log(`PASS ${view.name}: one three-car train, boarding selection/cancel, switch interlock, inactive track hidden/not updated, first/third person, horizontal drag, Qin return/summon, scenic/thrill loop, mobile UI; max ${budget.calls} calls / ${budget.triangles} triangles`);
    for (const warning of budgetWarnings) console.warn(`BUDGET ${view.name}: ${warning}`);
    if (budgetWarnings.length) process.exitCode = 1;
    await context.close();
  }
} finally { await browser.close(); }
