import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_ATTRACTIONS, QIN_STATIONS, QIN_LIGHT_VOLUME, qinFloorAt, qinLandAt } from '../world/qin-island-layout.js';

assert.equal(QIN_ATTRACTIONS.length, 26);
assert.equal(new Set(QIN_ATTRACTIONS.map(item => item.id)).size, 26);
assert.ok(!qinLandAt(60, 18) && qinLandAt(86, 18));
for (let depth = -5; depth > -16; depth -= 0.25) assert.ok(Math.abs(qinFloorAt(160, depth) - qinFloorAt(160, depth - 0.25)) <= 1 / 6 + 0.001);
for (let depth = -22; depth > -36; depth -= 0.25) assert.ok(Math.abs(qinFloorAt(178, depth) - qinFloorAt(178, depth - 0.25)) <= 1 / 6 + 0.001);

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
    const travel = await page.evaluate(async () => {
      const THREE = await import('three');
      const home = __home, player = home.player, jet = home.extras.jetSki;
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      const east = { ...idle, x: 1, run: true }, west = { ...idle, x: -1, run: true };
      const forward = { ...idle, z: -1 };
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      const position = () => ({ x: player.pos.x, z: player.pos.z, y: player.y, mode: player.mode });
      function advance(frames, input = idle, until = null) {
        for (let frame = 0; frame < frames; frame++) {
          player.update(1 / 60, input, 0); jet.update(1 / 60);
          if (until?.()) break;
        }
      }
      const channel = [];
      for (let column = 40; column <= 82; column += 2) channel.push(jet.canFloat(column, 18, Math.PI / 2));
      player.teleport(34, 18);
      advance(2200, east, () => player.mode === 'ground' && player.pos.x > 85);
      const swimOut = position();
      advance(2200, west, () => player.mode === 'ground' && player.pos.x < 37);
      const swimBack = position();
      jet.ski.position.set(43, -0.42, 18); jet.ski.rotation.set(0, Math.PI / 2, 0); jet.update(0.1);
      player.teleport(34, 18); advance(160, east); advance(400);
      const board = jet.interact();
      advance(650, forward);
      const boatOut = { x: jet.ski.position.x, z: jet.ski.position.z, speed: jet.speed, safe: jet.canFloat(jet.ski.position.x, jet.ski.position.z, jet.ski.rotation.y) };
      const dismount = jet.interact();
      advance(500, east, () => player.mode === 'ground' && player.pos.x > 85);
      const boatLanding = position();
      advance(100, west, () => player.swimming);
      advance(400);
      player.swimTo(jet.ski.position.x - 1, jet.ski.position.z);
      advance(500, idle, () => !player.travelling);
      advance(120);
      const reboard = jet.interact();
      advance(120, { ...idle, z: 1 }); advance(60, { ...idle, up: true });
      advance(350, { ...idle, x: 1 }, () => Math.abs(jet.ski.rotation.y + Math.PI / 2) < 0.01);
      advance(650, forward);
      const boatBack = { x: jet.ski.position.x, safe: jet.canFloat(jet.ski.position.x, jet.ski.position.z, jet.ski.rotation.y) };
      const returnDismount = jet.interact();
      advance(500, west, () => player.mode === 'ground' && player.pos.x < 37);
      const returnLanding = position();

      const walks = [];
      function walk(x, z, height = 0) {
        player.goTo(x, z);
        let flew = false;
        for (let frame = 0; frame < 12000 && player.travelling; frame++) {
          player.update(1 / 60, idle, 0);
          flew ||= player.mode !== 'ground';
        }
        home.extras.qinIsland.update(0);
        walks.push({ target: [x, height, z], at: position(), flew, arrived: !player.travelling && Math.hypot(player.pos.x - x, player.pos.z - z) < 0.2 && Math.abs(player.y - height) < 0.05 });
      }
      player.teleport(89, 18);
      for (const [column, depth, height] of [[99, 64], [160, 64], [160, 44], [184, 28], [180, 4], [160, -4], [160, -19, 3], [172, -22, 3], [178, -24, 3.333333], [178, -36, 7], [171, -40, 7]]) walk(column, depth, height);
      for (const [column, depth] of [[178, -36], [178, -40], [179.75, -44], [179.75, -45.8], [174, -44], [174, -37], [178, -36]]) walk(column, depth, 7);
      const galleryFloor = [], downward = new THREE.Vector3(0, -1, 0), floorRay = new THREE.Raycaster();
      home.world.qinIsland.root.updateMatrixWorld(true);
      for (const column of [141.5, 176.25, 178, 180.5]) for (const depth of [-38.25, -40, -43, -46]) {
        floorRay.set(new THREE.Vector3(column, 7.5, depth), downward);
        const hit = floorRay.intersectObject(home.world.qinIsland.root, true)[0];
        galleryFloor.push({ x: column, z: depth, height: home.nav.heightAt(column, depth), meshHeight: hit?.point.y ?? null });
      }
      const roofHidden = !home.world.qinIsland.palaceRoof.visible;
      for (const [column, depth, height] of [[178, -36, 7], [178, -22, 3], [160, -19, 3], [160, -4], [188, -21], [207.5, -21], [207.5, -41.5], [227.5, -41.5], [227.5, -64], [207, -64, 0.68]]) walk(column, depth, height);
      const roofRestored = home.world.qinIsland.palaceRoof.visible;
      for (const column of [146, 174]) { player.teleport(column, 61); walk(column, 51); }
      player.teleport(160, -19);
      for (const [column, depth] of [[142, -25.5], [139, -25.5], [139, -49.9], [160, -50], [139, -49.9], [139, -25.5], [142, -25.5], [160, -19]]) walk(column, depth, 3);
      const enclosure = [];
      for (const [side, column, depth] of [['west', 140.5, -40], ['east', 181.5, -40], ['rear', 160, -47.5]]) {
        for (const height of [3, 4, 6, 7, 9, 10]) enclosure.push({ side, height, solid: !!home.world.grid.type(Math.floor(column), height, Math.floor(depth)), collides: home.world.ground.collides(column, height, depth) });
      }
      const sideDoor = home.nav.canStand(140.5, -25.5, 3) && !home.world.ground.collides(140.5, 3, -25.5);
      const frontFacade = [];
      const facadeRay = new THREE.Raycaster();
      const facadeRoots = [home.world.qinIsland.root, home.world.groups['qin-ground']];
      home.world.groups['qin-ground'].updateMatrixWorld(true);
      for (const [column, height] of [[144, 4], [151, 8], [169, 4], [176, 8]]) {
        facadeRay.set(new THREE.Vector3(column, height + 0.5, -19), new THREE.Vector3(0, 0, -1));
        const hit = facadeRay.intersectObjects(facadeRoots, true)[0];
        frontFacade.push({ column, height, solid: !!home.world.grid.type(Math.floor(column), height, -21), rendered: !!hit && hit.point.z < -19.5 && hit.point.z > -21.1 });
      }
      const frontDoor = home.nav.canStand(160, -20.5, 3) && !home.world.ground.collides(160, 3, -20.5);
      const upperFront = [];
      for (const column of [158.1, 161.9]) {
        facadeRay.set(new THREE.Vector3(column, 8.4, -19), new THREE.Vector3(0, 0, -1));
        const hit = facadeRay.intersectObjects(facadeRoots, true)[0];
        upperFront.push({ column, solid: !!hit && Math.abs(hit.point.z + 20) < 0.05 });
      }
      const entranceRays = [];
      facadeRay.far = 6.5;
      for (const column of [157, 160, 163]) for (const height of [3.35, 4.1, 5.8, 6.6]) {
        facadeRay.set(new THREE.Vector3(column, height, -17), new THREE.Vector3(0, 0, -1));
        entranceRays.push({ column, height, clear: facadeRay.intersectObjects(facadeRoots, true).length === 0 });
      }
      player.teleport(160, -19);
      for (const [column, depth] of [[148, -19], [176, -19], [160, -19], [160, -25], [168, -25], [160, -25], [160, -19]]) walk(column, depth, 3);
      player.teleport(150, -19);
      advance(100, { ...idle, z: -1 });
      const frontWallStop = position();
      player.teleport(160, -19);
      home.extras.qinIsland.update(0);
      const porchRoofVisible = home.world.qinIsland.palaceRoof.visible;
      player.teleport(179.5, -22);
      advance(120, { ...idle, x: 1 });
      const eastWallStop = position();
      player.teleport(174, -44);
      advance(120, { ...idle, z: -1 });
      const rearWallStop = position();
      player.teleport(112, 39);
      for (const [column, depth] of [[114.5, 25], [118, 3], [118, -11], [118, -27], [118, -40], [114.5, -58]]) walk(column, depth);
      for (const [column, depth] of [[128, -11], [128, -18], [131, -25]]) walk(column, depth);
      const park = home.world.qinIsland;
      return { channel, swimOut, swimBack, board, boatOut, dismount, boatLanding, reboard, boatBack, returnDismount, returnLanding, walks, galleryFloor, enclosure, frontFacade, upperFront, frontDoor, entranceRays, frontWallStop, porchRoofVisible, sideDoor, eastWallStop, rearWallStop, roofHidden, roofRestored, models: park.stats, lights: park.lighting.stats,
        separateLighting: park.lighting.texture !== home.world.lighting.texture,
        coastBlocked: !jet.canFloat(86, 18, Math.PI / 2), mainLightBytes: home.world.lighting.stats.bytes };
    });
    assert.ok(travel.channel.every(Boolean) && travel.coastBlocked, 'Channel must remain navigable, but boats must stop at the beach');
    for (const field of ['swimOut', 'boatLanding']) assert.ok(travel[field].mode === 'ground' && travel[field].x > 85, `${field}: ${JSON.stringify(travel[field])}`);
    for (const field of ['swimBack', 'returnLanding']) assert.ok(travel[field].mode === 'ground' && travel[field].x < 37, `${field}: ${JSON.stringify(travel[field])}`);
    for (const field of ['board', 'dismount', 'reboard', 'returnDismount', 'roofHidden', 'roofRestored', 'separateLighting']) assert.ok(travel[field], field);
    assert.ok(travel.boatOut.x > 80 && travel.boatOut.safe && Math.abs(travel.boatOut.speed) < 0.01);
    assert.ok(travel.boatBack.x < 42 && travel.boatBack.safe);
    assert.ok(travel.walks.every(walk => walk.arrived && !walk.flew), `Walking failed: ${JSON.stringify(travel.walks.filter(walk => !walk.arrived || walk.flew))}`);
    assert.ok(travel.galleryFloor.every(sample => Math.abs(sample.height - 7) < 0.001 && sample.meshHeight !== null && Math.abs(sample.meshHeight - 7) < 0.001), `Gallery slab missing or inconsistent with navigation: ${JSON.stringify(travel.galleryFloor)}`);
    assert.ok(travel.frontFacade.every(sample => sample.solid && sample.rendered), `Front facade missing: ${JSON.stringify(travel.frontFacade)}`);
    assert.ok(travel.upperFront.every(sample => sample.solid), `Upper front facade missing: ${JSON.stringify(travel.upperFront)}`);
    assert.ok(travel.frontDoor, 'Central entrance must remain reachable');
    assert.ok(travel.entranceRays.every(sample => sample.clear), `A visible mesh blocks the open doorway: ${JSON.stringify(travel.entranceRays)}`);
    assert.ok(travel.frontWallStop.z > -20 && travel.frontWallStop.z < -19 && travel.frontWallStop.mode === 'ground', `Front wall must stop walking: ${JSON.stringify(travel.frontWallStop)}`);
    assert.ok(travel.porchRoofVisible, 'Standing in the portico must not remove the roof');
    assert.ok(travel.enclosure.every(sample => sample.solid && sample.collides), `Palace enclosure missing: ${JSON.stringify(travel.enclosure)}`);
    assert.ok(travel.sideDoor, 'West doorway must remain open to the prayer-wheel terrace');
    assert.ok(travel.eastWallStop.x < 181 && travel.eastWallStop.x > 180 && Math.abs(travel.eastWallStop.y - 3) < 0.05, `East wall must stop walking: ${JSON.stringify(travel.eastWallStop)}`);
    assert.ok(travel.rearWallStop.z > -47 && travel.rearWallStop.z < -46 && Math.abs(travel.rearWallStop.y - 7) < 0.05, `Rear wall must stop walking: ${JSON.stringify(travel.rearWallStop)}`);
    assert.equal(travel.models.people, 32); assert.equal(travel.models.horses, 20);
    assert.equal(travel.models.chariots, 2); assert.equal(travel.models.prayerWheels, 24);
    assert.equal(travel.mainLightBytes, 86 * 30 * 90 * 4);

    const procession = await page.evaluate(async volume => {
      const THREE = await import('three');
      const park = __home.world.qinIsland, root = park.root;
      root.updateMatrixWorld(true);
      const samples = [
        { part: 'robe', origin: [141, 2.55, 37], direction: [0, 0, -1] },
        { part: 'face', origin: [141, 3.1, 37], direction: [0, 0, -1] },
        { part: 'horse', origin: [142, 2.75, 37], direction: [0, 0, -1] },
        { part: 'canopy', origin: [169, 7, 34], direction: [0, -1, 0] },
        { part: 'ridge', origin: [169, 7, 33], direction: [0, -1, 0] },
      ].map(sample => {
        const ray = new THREE.Raycaster(new THREE.Vector3(...sample.origin), new THREE.Vector3(...sample.direction), 0, 10);
        const hit = ray.intersectObject(root, true)[0];
        if (!hit?.object.isInstancedMesh) return { part: sample.part, missing: true };
        const color = new THREE.Color();
        hit.object.getColorAt(hit.instanceId, color);
        return { part: sample.part, tint: color.getHexString(), luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
          emissive: hit.object.geometry.attributes.iEmissive.getX(hit.instanceId) };
      });
      const { min, extent, size } = volume, illumination = [];
      for (const column of [143, 151, 160, 169, 177]) for (const row of [31.2, 34.9]) {
        const cell = [column, 2.5, row].map((coordinate, axis) => Math.floor((coordinate - min[axis]) / extent[axis] * size[axis]));
        const offset = (cell[0] + size[0] * (cell[1] + size[1] * cell[2])) * 4;
        illumination.push({ column, row, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      return { samples, illumination, lamps: park.bakes.filter(source => source.id.startsWith('qin-procession-')) };
    }, QIN_LIGHT_VOLUME);
    assert.ok(procession.samples.every(sample => !sample.missing && sample.luminance > 0.25 && sample.emissive === 0), `Sculptures must use readable, non-emissive tints: ${JSON.stringify(procession.samples)}`);
    assert.equal(new Set(procession.samples.map(sample => sample.tint)).size, 5, 'Robes, faces, horses and chariots need distinct tones');
    assert.equal(procession.lamps.length, 10);
    assert.equal(new Set(procession.lamps.map(lamp => lamp.id)).size, 10);
    assert.ok(procession.illumination.every(sample => sample.energy > 0.1), `Both rows of the procession need continuous baked fill: ${JSON.stringify(procession.illumination)}`);

    const exhibits = await page.evaluate(async volume => {
      const THREE = await import('three');
      const park = __home.world.qinIsland, root = park.root;
      root.updateMatrixWorld(true);
      function surfaceAt(origin) {
        const ray = new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(0, 0, -1), 0, 4);
        const hit = ray.intersectObject(root, true)[0];
        if (!hit?.object.isInstancedMesh) return null;
        const color = new THREE.Color();
        hit.object.getColorAt(hit.instanceId, color);
        return { tint: color.getHexString(), luminance: color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722,
          emissive: hit.object.geometry.attributes.iEmissive.getX(hit.instanceId), depth: hit.point.z };
      }
      const reliefs = [], illumination = [], sightlines = [];
      const lightSamples = [[109, 2.8, 3], [112, 2.8, 3], [115, 2.8, 3], [126, 3.8, -17]];
      for (const row of [-15, -31, -44]) for (const column of [105, 108, 111, 114, 117]) {
        reliefs.push({ column, row, figure: surfaceAt([column, 1.7, row - 0.7]), background: surfaceAt([column + 1, 1.7, row - 0.7]) });
        lightSamples.push([column, 1.7, row - 1.3]);
      }
      const { min, extent, size } = volume;
      for (const position of lightSamples) {
        const cell = position.map((coordinate, axis) => Math.floor((coordinate - min[axis]) / extent[axis] * size[axis]));
        const offset = (cell[0] + size[0] * (cell[1] + size[1] * cell[2])) * 4;
        illumination.push({ position, energy: park.lighting.texture.image.data[offset] / 255 * 4 });
      }
      for (const origin of [[123, 3.4, -10], [127, 3.4, -9], [131, 3.4, -10]]) {
        for (const target of [[126, 3.3, -15.77], [126, 3.8, -16.87], [127.2, 3.95, -16.4]]) {
          const start = new THREE.Vector3(...origin), end = new THREE.Vector3(...target);
          const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end) + 0.5);
          const hit = ray.intersectObject(root, true)[0];
          sightlines.push({ origin, target, gap: hit ? hit.point.distanceTo(end) : null });
        }
      }
      return { reliefs, illumination, sightlines,
        robe: surfaceAt([112, 1.1, 5]), face: surfaceAt([112, 2.7, 5]), eyes: surfaceAt([111.864, 2.89, 5]),
        lamps: park.bakes.filter(source => /^qin-(relief|warriors|archery)-/.test(source.id)).length,
        oldTreeClear: !park.site.collides(128, 0, -15), relocatedTreeSolid: park.site.collides(133, 0, -27) };
    }, QIN_LIGHT_VOLUME);
    assert.ok(exhibits.robe?.luminance > 0.3 && exhibits.face?.luminance > exhibits.robe.luminance && exhibits.eyes?.luminance < exhibits.face.luminance * 0.3, `Warrior face and clothing must remain distinct: ${JSON.stringify(exhibits)}`);
    assert.ok([exhibits.robe, exhibits.face, exhibits.eyes].every(sample => sample.emissive === 0));
    assert.ok(exhibits.reliefs.every(sample => sample.figure?.luminance > sample.background?.luminance * 2 && sample.figure.depth > sample.background.depth + 0.3 && sample.figure.emissive === 0), `Reliefs need both color and depth separation: ${JSON.stringify(exhibits.reliefs)}`);
    assert.ok(exhibits.sightlines.every(sample => sample.gap !== null && sample.gap < 0.8), `Trees must not hide the rider, horse or bow: ${JSON.stringify(exhibits.sightlines)}`);
    assert.ok(exhibits.oldTreeClear && exhibits.relocatedTreeSolid, 'Relocate the tree and its collision, rather than only hiding its leaves');
    assert.equal(exhibits.lamps, 11);
    assert.ok(exhibits.illumination.every(sample => sample.energy > 0.1), `Exhibit faces need baked fill: ${JSON.stringify(exhibits.illumination)}`);

    for (const station of QIN_STATIONS) {
      await page.evaluate(id => __home.go(id), station.id);
      await page.waitForFunction(() => document.querySelector('#panel')?.open);
      assert.ok(await page.locator('#panel').innerText());
      if (station.id === 'qin-island') await page.screenshot({ path: fileURLToPath(new URL(`qin-guide-${view.name}.png`, output)) });
      await page.locator('#panel .close').click();
    }
    await page.evaluate(() => { __home.player.teleport(160, 63); __home.rig.recenter(__home.player, true); });
    await page.waitForTimeout(300);
    if (view.hasTouch) await page.locator('#prompt').click();
    else await page.keyboard.press('f');
    await page.waitForFunction(() => document.querySelector('#panel')?.open);
    assert.match(await page.locator('#panel').innerText(), /秦风阙门/);
    await page.locator('#panel .close').click();
    const shots = [
      { name: 'overview', camera: [242, 118, 170], look: [156, 0, 2], player: [160, 64] },
      { name: 'gateway', camera: [181, 13, 91], look: [160, 7, 52], player: [160, 64] },
      { name: 'procession', camera: [176, 7, 48], look: [160, 2.7, 33], player: [160, 40] },
      { name: 'procession-detail', camera: [173, 5.5, 39.5], portrait: [174, 6, 43], look: [169, 3, 33], player: [172, 40] },
      { name: 'procession-rear', camera: [151, 7, 19], look: [160, 2.7, 33], player: [151, 26] },
      { name: 'warriors', camera: [112, 3.5, 12], portrait: [124, 6, 14], look: [112, 1.7, 3], player: [112, 8] },
      { name: 'zhao', camera: [111, 3.5, -5], portrait: [111, 4.5, 1], look: [111, 1.5, -16], player: [110, -9] },
      { name: 'archery', camera: [131, 4.8, -7], look: [126, 2.4, -17], player: [130, -11] },
      { name: 'emperor', camera: [177, 18, 42], look: [160, 11, 9], player: [173, 19] },
      { name: 'palace', camera: [185, 17, 10], look: [160, 8, -30], player: [173, -3] },
      { name: 'palace-front', camera: [180, 22, 13], portrait: [211, 35, 52], look: [160, 10, -30], player: [160, -5] },
      { name: 'palace-entry', camera: [162, 7, -14], look: [160, 5, -26], player: [160, -19] },
      { name: 'palace-interior', camera: [170, 10, -23], look: [158, 5, -35], player: [160, -25] },
      { name: 'palace-rear', camera: [161, 10, -76], look: [161, 7, -46], player: [160, -64] },
      { name: 'palace-east', camera: [204, 10, -38], look: [179, 7, -34], player: [188, -25] },
      { name: 'palace-west', camera: [121, 10, -35], look: [141, 7, -33], player: [131, -25] },
      { name: 'gallery', camera: [175, 14, -25], look: [158, 7, -41], player: [171, -40] },
      { name: 'gallery-landing', camera: [178, 12, -29], look: [178, 7, -42], player: [178, -36] },
      { name: 'garden', camera: [243, 30, -3], look: [207, 1, -41], player: [188, -25] },
      { name: 'channel', camera: [61, 30, 80], look: [64, 0, 12], player: [89, 18] },
    ];
    const measurements = [];
    for (const time of ['day', 'night']) {
      for (const shot of shots) {
        if (view.name === 'phone' && !['gateway', 'procession', 'procession-detail', 'procession-rear', 'warriors', 'zhao', 'archery', 'emperor', 'garden', 'palace-front', 'palace-entry', 'palace-interior', 'palace-rear', 'palace-east', 'palace-west', 'gallery-landing'].includes(shot.name)) continue;
        await page.evaluate(({ shot, time }) => {
          const home = __home;
          home.player.teleport(...shot.player); home.setTimeMode(time); home.stage.settle();
          home.rig.showcase(innerWidth < 600 && shot.portrait ? shot.portrait : shot.camera, shot.look);
          for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
          home.extras.qinIsland.update(0);
        }, { shot, time });
        await page.waitForTimeout(300);
        if (['warriors', 'zhao', 'archery'].includes(shot.name)) {
          const visible = await page.evaluate(async shot => {
            const THREE = await import('three');
            const start = new THREE.Vector3(...(innerWidth < 600 && shot.portrait ? shot.portrait : shot.camera));
            const end = new THREE.Vector3(...shot.look);
            const ray = new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0.1, start.distanceTo(end) + 1);
            const hit = ray.intersectObject(__home.world.qinIsland.root, true)[0];
            return !!hit && hit.point.distanceTo(end) < 2;
          }, shot);
          assert.ok(visible, `${view.name} ${shot.name}: the screenshot must not be taken through a tree or roof`);
        }
        await page.screenshot({ path: fileURLToPath(new URL(`qin-${shot.name}-${time}-${view.name}.png`, output)) });
        const stats = await page.evaluate(() => __home.stats());
        measurements.push({ shot: shot.name, time, ...stats });
        assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, `${view.name} ${shot.name}: ${JSON.stringify(stats)}`);
      }
    }
    const animation = await page.evaluate(() => {
      const home = __home, wheel = home.world.qinIsland.waterwheel;
      home.rig.showcase([209, 7, 31], [207, 3, 19]);
      for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, home.player);
      const before = wheel.rotation.z;
      home.extras.qinIsland.update(1);
      return before !== wheel.rotation.z;
    });
    assert.ok(animation, 'Visible waterwheel should rotate');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.ok(await page.evaluate(() => {
      const home = __home, wheel = home.world.qinIsland.waterwheel, before = wheel.rotation.z;
      home.extras.qinIsland.update(1); return before === wheel.rotation.z;
    }), 'Reduced motion must stop the waterwheel');
    assert.deepEqual(errors, []);
    report.push({ view: view.name, travel, procession, exhibits, measurements });
    console.log(`${view.name}: swimming and boat round trips, ${travel.walks.length} walks, 6 cards, day/night screenshots; max ${Math.max(...measurements.map(item => item.calls))} calls / ${Math.max(...measurements.map(item => item.triangles))} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
