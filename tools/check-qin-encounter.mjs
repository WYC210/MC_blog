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
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    if (process.argv[3] && process.argv[3] !== view.name) continue;
    const context = await browser.newContext(view), page = await context.newPage(), errors = [], measurements = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.evaluate(async () => {
      const home = __home, encounter = home.extras.qinIsland.encounter, player = home.player;
      const { qinArmyRoomAt } = await import('/world/qin-army-follow.js');
      const THREE = await import('three');
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      const idle = { x: 0, z: 0, run: false, up: false, down: false };
      window.__qinTest = {
        encounter, originalSkin: home.avatar.material.map, obstacles: home.world.obstacles.length, violations: [], originalUpdate: encounter.update,
        advance(seconds, until) {
          for (let frame = 0; frame < seconds * 30; frame++) {
            if (until && encounter.phase === until) break;
            player.update(1 / 30, idle, home.rig.yaw); home.rig.update(1 / 30, player); encounter.update(1 / 30);
            if (encounter.phase === 'command') for (const guard of encounter.guards) {
              if (qinArmyRoomAt(guard.x, guard.z) && !this.violations.includes(guard.id)) this.violations.push(guard.id);
            }
          }
        },
        snapshot() {
          return { phase: encounter.phase, status: encounter.army.status, room: encounter.army.room, plans: encounter.army.plans,
            guards: encounter.guards.map(guard => ({ id: guard.id, x: guard.x, y: guard.y, z: guard.z, yaw: guard.yaw, life: guard.life,
              pathCount: guard.commandCount, pathIndex: guard.commandIndex, origin: [guard.originX, guard.originY, guard.originZ],
              next: [...guard.commandPath.slice(guard.commandIndex * 3, guard.commandIndex * 3 + 3)] })) };
        },
      };
      const actors = home.world.qinIsland.encounterActors, handMatrix = new THREE.Matrix4(), weaponMatrix = new THREE.Matrix4();
      const relative = new THREE.Matrix4(), grip = new THREE.Vector3();
      const weapons = { count: 0, samples: 0, maxGripOffset: 0, maxTransformError: 0 };
      for (const guard of actors.guards) {
        const spear = guard.parts.find(part => part.feature === 'spear');
        if (!spear) continue;
        if (spear.attachment?.feature !== 'hand-1') throw new Error(`Guard ${guard.id}: missing weapon attachment`);
        weapons.count++;
        for (const life of [0, 0.5, 1]) for (const stride of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) for (const wave of [0, 0.7]) {
          guard.life = life; guard.speed = life; guard.stride = stride; guard.wave = wave; guard.yaw = stride - 0.6;
          actors.pose(guard);
          spear.mesh.getMatrixAt(spear.index, weaponMatrix); spear.attachment.mesh.getMatrixAt(spear.attachment.index, handMatrix);
          grip.setFromMatrixPosition(handMatrix).applyMatrix4(relative.copy(weaponMatrix).invert());
          weapons.maxGripOffset = Math.max(weapons.maxGripOffset, Math.hypot(grip.x, grip.z));
          if (Math.abs(grip.y) > 0.5) throw new Error(`Guard ${guard.id}: grip is outside the spear`);
          relative.copy(handMatrix).invert().multiply(weaponMatrix);
          for (let component = 0; component < 16; component++) weapons.maxTransformError = Math.max(weapons.maxTransformError, Math.abs(relative.elements[component] - spear.mount.elements[component]));
          weapons.samples++;
        }
      }
      actors.restore(); __qinTest.weapons = weapons;
      player.teleport(encounter.emperor.x + 2, encounter.emperor.z);
    });
    const weapons = await page.evaluate(() => __qinTest.weapons);
    assert.equal(weapons.count, 24); assert.equal(weapons.samples, 576);
    assert.ok(weapons.maxGripOffset < 0.001, JSON.stringify(weapons));
    assert.ok(weapons.maxTransformError < 0.001, JSON.stringify(weapons));
    const activate = async selector => view.hasTouch ? page.locator(selector).tap() : page.keyboard.press('f');
    const shoot = async name => page.screenshot({ path: fileURLToPath(new URL(`qin-encounter-${view.name}-${name}.png`, output)) });
    await page.waitForFunction(() => !document.querySelector('#qinEmperorPrompt').hidden);
    assert.match(await page.locator('#qinEmperorPrompt').innerText(), /夺取玉玺/);
    await activate('#qinEmperorPrompt');
    await page.locator('#qinEncounterScene[open]').waitFor();
    assert.equal(await page.locator('#qinEncounterTitle').innerText(), '玉玺风波');
    assert.match(await page.locator('#qinEncounterScene section p').innerText(), /玉玺/);
    await page.evaluate(() => __qinTest.advance(60, 'guarded'));
    assert.equal(await page.evaluate(() => __qinTest.encounter.phase), 'guarded');
    assert.equal(await page.evaluate(() => __qinTest.encounter.occlusion.strength), 0);
    assert.equal(await page.evaluate(() => __home.nav.canStand(160, 24)), false);
    assert.equal(await page.evaluate(() => __qinTest.encounter.hasSeal && __qinTest.encounter.emperor.seal === 0), true);
    await page.evaluate(() => {
      __qinTest.advance(2);
      __home.player.teleport(175, 24); __qinTest.advance(0.2);
      __home.player.teleport(168.5, 24); __qinTest.advance(0.2);
    });
    await page.waitForFunction(() => !document.querySelector('#qinEmperorPrompt').hidden);
    assert.match(await page.locator('#qinEmperorPrompt').innerText(), /取代/);
    await activate('#qinEmperorPrompt');
    const targets = await page.evaluate(() => __qinTest.encounter.guards.map(guard => guard.route.at(-1)));
    assert.equal(new Set(targets.map(target => target.x.toFixed(2))).size, 8);
    assert.equal(new Set(targets.map(target => target.z.toFixed(2))).size, 4);
    await page.evaluate(() => {
      __qinTest.advance(60, 'salute');
      __qinTest.encounter.update = () => __qinTest.originalUpdate(0);
    });
    const square = await page.evaluate(() => __qinTest.snapshot());
    assert.equal(square.phase, 'salute', JSON.stringify(square));
    for (let index = 0; index < 32; index++) {
      assert.ok(Math.hypot(square.guards[index].x - targets[index].x, square.guards[index].z - targets[index].z) < 0.001);
      assert.equal(square.guards[index].yaw, 0);
    }
    assert.equal(await page.evaluate(() => __home.avatar.material.map.name), 'qin-emperor-player-skin');
    assert.deepEqual(await page.evaluate(() => [__home.avatar.material.map.image.width, __home.avatar.material.map.image.height]), [64, 64]);
    assert.equal(await page.evaluate(() => __home.nav.canStand(160, 24)), true);
    for (const mode of ['day', 'night']) {
      await page.evaluate(mode => { __home.setTimeMode(mode); __home.stage.settle(); }, mode);
      await page.waitForTimeout(350); await shoot(`square-${mode}`);
      measurements.push(await page.evaluate(() => __home.stats()));
    }
    await page.locator('#qinEncounterScene .lang-switch').click();
    assert.equal(await page.locator('#qinEncounterTitle').innerText(), 'The Crown and the Command');
    assert.match(await page.locator('#qinEncounterScene section p').innerText(), /Hail Your Majesty/);
    await page.locator('#qinEncounterScene .lang-switch').click();
    await page.evaluate(() => { __qinTest.encounter.update = __qinTest.originalUpdate; __qinTest.advance(4); __home.setTimeMode('day'); __home.stage.settle(); });
    await page.evaluate(() => __qinTest.advance(35));
    const following = await page.evaluate(() => __qinTest.snapshot());
    assert.equal(following.status, 'following');
    await page.evaluate(() => {
      __home.player.teleport(170, 43); __qinTest.advance(2);
      __qinTest.encounter.update = () => __qinTest.originalUpdate(0);
      __home.rig.showcase([183, 7, 46], [166, 1.2, 36]);
      __home.rig.update(1 / 30, __home.player);
    });
    await shoot('moving-weapons');
    await page.evaluate(() => { __qinTest.encounter.update = __qinTest.originalUpdate; __home.rig.skipIntro(); });
    const doors = [];
    for (const room of [{ id: 'palace', x: 160, z: -22 }, { id: 'jixia', x: 112, z: 25 }, { id: 'hanfei', x: 112, z: -46 }]) {
      await page.evaluate(room => { __home.player.teleport(room.x, room.z); __qinTest.advance(90); }, room);
      const snapshot = await page.evaluate(() => __qinTest.snapshot()); doors.push(snapshot);
      assert.equal(snapshot.status, 'door-guard'); assert.equal(snapshot.room, room.id);
      assert.ok(snapshot.guards.every(guard => guard.pathCount > 0 && guard.pathIndex === guard.pathCount), JSON.stringify(snapshot));
    }
    await page.evaluate(() => { __home.player.teleport(170, 43); __qinTest.advance(90); __home.player.startFlying(); __qinTest.advance(7); });
    const flying = await page.evaluate(() => __qinTest.snapshot());
    assert.equal(flying.status, 'waiting');
    await page.evaluate(() => __qinTest.advance(5));
    assert.deepEqual((await page.evaluate(() => __qinTest.snapshot())).guards, flying.guards);
    await page.evaluate(() => { __home.player.teleport(170, 43); __qinTest.advance(3); });
    assert.equal(await page.evaluate(() => __qinTest.encounter.army.status), 'following');
    await page.evaluate(() => { __home.player.teleport(0, 0); __qinTest.advance(10); });
    assert.equal(await page.evaluate(() => __qinTest.encounter.army.status), 'waiting');
    await page.evaluate(() => __qinTest.advance(16));
    assert.equal(await page.evaluate(() => __qinTest.encounter.army.status), 'returning');
    await page.evaluate(() => __qinTest.advance(150, 'dormant'));
    const returned = await page.evaluate(() => __qinTest.snapshot());
    assert.equal(returned.phase, 'dormant', JSON.stringify(returned));
    for (const guard of returned.guards) {
      assert.equal(guard.life, 0); assert.deepEqual([guard.x, guard.y, guard.z], guard.origin);
    }
    assert.deepEqual(await page.evaluate(() => __qinTest.violations), []);
    await page.evaluate(() => { __home.player.teleport(160, 39); __qinTest.advance(2); });
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden);
    await activate('#prompt');
    await page.locator('#panel[data-station="qin-procession"][open]').waitFor();
    assert.equal(await page.locator('#panel .about-text:visible').count(), 1);
    assert.equal(await page.locator('#panel [data-qin-awaken]').isEnabled(), true);
    await page.locator('#panel .lang-switch').click();
    assert.equal(await page.locator('#panel [data-qin-awaken]').innerText(), 'Awaken the army');
    await shoot('recall-card');
    if (view.hasTouch) await page.locator('#panel [data-qin-awaken]').tap();
    else await page.locator('#panel [data-qin-awaken]').click();
    await page.locator('#qinEncounterScene[open]').waitFor();
    await page.evaluate(() => {
      __qinTest.advance(3, 'awakening'); __qinTest.advance(1.6);
      __qinTest.encounter.update = () => __qinTest.originalUpdate(0);
    });
    const cutaway = await page.evaluate(() => {
      const effect = __qinTest.encounter.occlusion, selections = [];
      __home.world.qinIsland.root.traverse(mesh => {
        const mask = mesh.geometry?.getAttribute('iQinCinematicMask');
        if (!mask) return;
        selections.push({ selected: Array.from(mask.array).filter(Boolean).length, transparent: mesh.material.transparent,
          soldiers: mesh.userData.tags.filter((tag, index) => mask.getX(index) && (tag?.startsWith('qin-retinue:') || tag?.startsWith('qin-wanderer:'))).length });
      });
      return { strength: effect.strength, occluded: effect.occluded, parts: effect.parts, selections, camera: __home.stage.camera.position.toArray() };
    });
    assert.ok(cutaway.parts > 100);
    assert.ok(cutaway.selections.every(selection => !selection.transparent && selection.soldiers === 0));
    if (view.hasTouch) { assert.ok(cutaway.strength > 0.9, JSON.stringify(cutaway)); assert.equal(cutaway.occluded, true); }
    await shoot('recall-cutaway');
    measurements.push(await page.evaluate(() => __home.stats()));
    await page.evaluate(() => { __qinTest.encounter.update = __qinTest.originalUpdate; });
    await page.evaluate(() => { __qinTest.advance(65, 'salute'); __qinTest.encounter.update = () => __qinTest.originalUpdate(0); });
    const recalled = await page.evaluate(() => __qinTest.snapshot());
    assert.equal(recalled.phase, 'salute');
    assert.equal(new Set(recalled.guards.map(guard => guard.x.toFixed(2))).size, 8);
    assert.equal(new Set(recalled.guards.map(guard => guard.z.toFixed(2))).size, 4);
    await shoot('recalled-square');
    await page.evaluate(() => { __qinTest.encounter.update = __qinTest.originalUpdate; });
    if (view.hasTouch) await page.locator('#qinEncounterScene .encounter-skip').tap();
    else await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => __qinTest.encounter.phase), 'command');
    assert.equal(await page.evaluate(() => __qinTest.encounter.occlusion.strength), 0);
    assert.equal(await page.locator('#qinEncounterScene').evaluate(element => element.open), false);
    assert.equal(await page.evaluate(() => __home.world.obstacles.length === __qinTest.obstacles), true);
    await page.evaluate(() => __qinTest.encounter.reset(true));
    assert.equal(await page.evaluate(() => __home.avatar.material.map === __qinTest.originalSkin), true);
    assert.equal(await page.evaluate(() => __qinTest.encounter.emperor.visible && __qinTest.encounter.emperor.seal === 1), true);
    assert.ok(measurements.every(stats => stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2), JSON.stringify(measurements));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, measurements, square, following, doors, returned, recalled, cutaway, weapons });
    console.log(`${view.name}: 24 attached weapons / 576 grip poses; imperial seal; 8x4 square and recall; 64x64 skin; 3 door formations; flight wait/resume; island timeout and statue return; cinematic cutaway/restoration; F/touch and languages; max ${Math.max(...measurements.map(stats => stats.calls))} calls / ${Math.max(...measurements.map(stats => stats.triangles))} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-encounter-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
