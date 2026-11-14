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
    { name: 'desktop', viewport: { width: 1280, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    await context.route(/https:\/\/(api\.open-meteo\.com|homecraft\.terryhu\.cn|terryhu7\.github\.io)\//,
      route => route.fulfill({ json: { worlds: [] }, headers: { 'access-control-allow-origin': '*' } }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    const press = selector => view.hasTouch ? page.locator(selector).tap() : page.locator(selector).click();
    const shoot = async suffix => {
      await page.waitForTimeout(350);
      return page.screenshot({ path: fileURLToPath(new URL(`travel-${view.name}-${suffix}.png`, output)), animations: 'disabled' });
    };
    const phoneButton = '#hotbar button:has(img[data-icon="phone"])';
    const open = async () => {
      if (!await page.locator('#phone').evaluate(element => element.classList.contains('up'))) await press(phoneButton);
      await press('[data-travel-app]');
    };
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { polling: 250, timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.evaluate(() => {
      __home.rig.skipIntro(); for (let frame = 0; frame < 240; frame++) __home.rig.update(1 / 60, __home.player);
      __home.setTimeMode('day'); __home.setWeatherMode('clear'); __home.stage.settle();
    });
    const homeStops = await page.evaluate(async () => {
      const { STATIONS } = await import('/world/layout.js');
      const { QIN_STATIONS } = await import('/world/qin-island-layout.js');
      return STATIONS.filter(station => !QIN_STATIONS.some(entry => entry.id === station.id));
    });
    await press(phoneButton);
    assert.deepEqual(await page.locator('#phone .app > span').allTextContents(), ['GitHub', '余烬行囊', 'echoes', '旅行社']);
    await shoot('home');
    await press('[data-travel-app]');
    assert.equal(await page.locator('.travel-list button').count(), 28 + homeStops.length);
    await shoot('list');
    assert.ok(await page.locator('.travel-list').evaluate(element => element.scrollHeight > element.clientHeight));
    assert.ok(await page.locator('.travel-stop').first().evaluate(element => element.getBoundingClientRect().height >= 44));
    const positionBefore = await page.evaluate(() => [__home.player.pos.x, __home.player.pos.z]);
    await page.keyboard.down('w'); await page.waitForTimeout(120); await page.keyboard.up('w');
    assert.deepEqual(await page.evaluate(() => [__home.player.pos.x, __home.player.pos.z]), positionBefore);
    await press('[data-travel-group="home"]');
    assert.deepEqual(await page.locator('.travel-list button').evaluateAll(buttons => buttons.map(button => button.dataset.travelTo)), homeStops.map(station => station.id));
    assert.deepEqual(await page.locator('.travel-list strong').allTextContents(), homeStops.map(station => station.name));
    await shoot('home-island');
    await page.locator('.travel-content input').fill('LeHun');
    assert.equal(await page.locator('.travel-list button').count(), 1);
    assert.equal(await page.locator('.travel-list strong').innerText(), '乐魂小屋');
    assert.ok(homeStops.some(station => station.id === 'lehun' && station.floor === 12));
    assert.ok(await page.evaluate(async () => {
      const { icon } = await import('/engine/ui/icons.js');
      return icon('lehun').url !== icon('map').url && document.querySelector('[data-travel-to="lehun"] img').src === icon('lehun').url;
    }));
    await shoot('lehun');
    await press('[data-travel-to="lehun"]');
    await page.waitForFunction(() => !document.body.classList.contains('phone-on'));
    const lehun = await page.evaluate(() => {
      const home = __home, idle = { x: 0, z: 0, up: false, down: false, run: false };
      for (let frame = 0; frame < 180; frame++) home.player.update(1 / 60, idle, home.rig.yaw);
      return { x: home.player.pos.x, z: home.player.pos.z, y: home.player.y, ground: home.player.mode === 'ground', swimming: home.player.swimming,
        cameraDistance: Math.hypot(home.stage.camera.position.x - home.player.pos.x, home.stage.camera.position.z - home.player.pos.z) };
    });
    assert.ok(lehun.ground && !lehun.swimming && Math.abs(lehun.y - 12) < 0.02, JSON.stringify(lehun));
    assert.ok(Math.hypot(lehun.x - 9.8, lehun.z - 46.5) < 0.01 && lehun.cameraDistance > 2, JSON.stringify(lehun));
    await shoot('lehun-arrival');
    await open();
    await press('[data-travel-to="home-island"]');
    await open();
    await press('[data-travel-group="home"]');
    await page.locator('.travel-content input').fill('北岸');
    assert.equal(await page.locator('.travel-list button').count(), 1);
    assert.equal(await page.locator('.travel-list button').getAttribute('data-travel-to'), 'lookout');
    await page.locator('.travel-content input').fill('Computer');
    assert.equal(await page.locator('.travel-list button').count(), 1);
    assert.equal(await page.locator('.travel-list strong').innerText(), '电脑');
    await page.evaluate(async () => (await import('/engine/lang.js')).setLang('en'));
    await page.waitForFunction(() => document.querySelector('#travelAgencyTitle').textContent === 'Travel Agency' && !document.querySelector('.travel-content').hidden);
    assert.equal(await page.locator('[data-travel-group="home"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('.travel-content input').inputValue(), 'Computer');
    assert.equal(await page.locator('.travel-list strong').innerText(), 'Computer');
    assert.doesNotMatch(await page.locator('.travel-content').innerText(), /[\u3400-\u9fff]/);
    await press('[data-travel-to="computer"]');
    await page.waitForFunction(() => !document.body.classList.contains('phone-on'));
    const computer = await page.evaluate(() => ({ x: __home.player.pos.x, z: __home.player.pos.z, y: __home.player.y,
      ground: __home.player.mode === 'ground', valid: __home.nav.canStand(__home.player.pos.x, __home.player.pos.z) }));
    const computerStop = homeStops.find(station => station.id === 'computer');
    assert.ok(computer.ground && computer.valid && Math.abs(computer.y - computerStop.floor) < 0.02, JSON.stringify(computer));
    assert.ok(Math.hypot(computer.x - computerStop.at[0], computer.z - computerStop.at[1]) <= 2.5, JSON.stringify(computer));
    await page.evaluate(async () => (await import('/engine/lang.js')).setLang('zh'));
    await open();
    await press('[data-travel-to="home-island"]');
    await open();
    await press('[data-travel-group="west"]');
    assert.equal(await page.locator('.travel-list button').count(), 9);
    await page.locator('.travel-content input').fill('Han Fei');
    assert.equal(await page.locator('.travel-list button').count(), 1);
    assert.match(await page.locator('.travel-list').innerText(), /韩非/);
    await page.evaluate(async () => (await import('/engine/lang.js')).setLang('en'));
    await page.waitForFunction(() => document.querySelector('#travelAgencyTitle').textContent === 'Travel Agency' && !document.querySelector('.travel-content').hidden);
    assert.equal(await page.locator('.travel-list button').count(), 1);
    assert.match(await page.locator('.travel-list').innerText(), /Han Fei/);
    assert.doesNotMatch(await page.locator('.travel-content').innerText(), /[\u3400-\u9fff]/);
    await shoot('english');
    await page.locator('.travel-content input').fill('no-such-stop');
    assert.equal(await page.locator('.travel-list button').count(), 0);
    assert.match(await page.locator('.travel-empty').innerText(), /No stops/);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#phone .home').isVisible(), true);
    assert.equal(await page.locator('#phone .screen').evaluate(element => element.style.getPropertyValue('--ink')), '');
    await page.evaluate(() => { __home.setTimeMode('night'); __home.stage.settle(); });
    await shoot('night-home');
    await page.evaluate(() => { __home.setTimeMode('day'); __home.stage.settle(); });
    await press('#phone .app[data-i="0"]');
    assert.equal(await page.locator('#phone .card > h3').innerText(), 'GitHub');
    assert.equal(await page.locator('.travel-content').isVisible(), false);
    await press('#phone .back');
    await page.evaluate(async () => (await import('/engine/lang.js')).setLang('zh'));
    await press('[data-travel-app]');
    await page.locator('.travel-content input').fill('秦始皇');
    await press('[data-travel-to="qin-emperor"]');
    await page.waitForFunction(() => !document.body.classList.contains('phone-on'));
    assert.equal(await page.evaluate(() => document.activeElement instanceof HTMLInputElement), false);
    const emperor = await page.evaluate(() => ({ x: __home.player.pos.x, z: __home.player.pos.z, mode: __home.player.mode,
      travelling: __home.player.travelling, heading: __home.player.heading, phone: document.querySelector('#hotbar button[aria-pressed]').getAttribute('aria-pressed') }));
    assert.deepEqual(emperor, { x: 160, z: 19, mode: 'ground', travelling: false, heading: Math.PI, phone: 'false' });
    await shoot('arrival');
    await open();
    await press('[data-travel-to="home-island"]');
    assert.equal(await page.evaluate(() => __home.player.pos.x), 0.5);

    const landings = await page.evaluate(async () => {
      const { TRAVEL_DESTINATIONS, HOME_DESTINATION, travelLanding } = await import('/world/travel-destinations.js');
      const { QIN_ATTRACTIONS, QIN_STATIONS } = await import('/world/qin-island-layout.js');
      const { STATIONS } = await import('/world/layout.js');
      const mainStations = STATIONS.filter(station => !QIN_STATIONS.some(entry => entry.id === station.id));
      const idle = { x: 0, z: 0, up: false, down: false, run: false }, home = __home;
      const results = [...TRAVEL_DESTINATIONS, HOME_DESTINATION].map(destination => {
        const expected = travelLanding(home.nav, destination), ok = home.extras.travelAgency.travel(destination.id);
        for (let frame = 0; frame < 10; frame++) home.player.update(1 / 60, idle, home.rig.yaw);
        return { id: destination.id, ok, expected, x: home.player.pos.x, z: home.player.pos.z, y: home.player.y, floor: destination.floor,
          ground: home.player.mode === 'ground', valid: home.nav.canStand(home.player.pos.x, home.player.pos.z), travelling: home.player.travelling,
          collided: home.world.qinIsland.site.collides(home.player.pos.x, home.player.y, home.player.pos.z),
          cameraDistance: Math.hypot(home.stage.camera.position.x - home.player.pos.x, home.stage.camera.position.z - home.player.pos.z) };
      });
      return { results, complete: [...QIN_ATTRACTIONS, ...mainStations].every(attraction => TRAVEL_DESTINATIONS.some(destination => destination.id === attraction.id)),
        stationsSynced: mainStations.every(station => {
          const destination = TRAVEL_DESTINATIONS.find(stop => stop.id === station.id);
          return destination?.at === station.at && destination.look === station.look && destination.name === station.name
            && destination.en === station.en && destination.icon === station.icon && destination.floor === (station.floor ?? 0);
        }),
        unique: new Set(TRAVEL_DESTINATIONS.map(destination => destination.id)).size === TRAVEL_DESTINATIONS.length,
        waterRejected: travelLanding(home.nav, { at: [-45, 0], floor: 0 }) === null,
        elevatedWaterRejected: travelLanding({ nearestStand: () => ({ x: -45, z: 0 }), canStand: () => true, heightAt: () => 12 }, { at: [-45, 0], floor: 12 }) === null,
        lehunFloorRejected: travelLanding(home.nav, { at: [9.8, 46.5], floor: 0 }) === null,
        floorRejected: travelLanding(home.nav, { at: [160, -18], floor: 7 }) === null };
    });
    for (const check of ['complete', 'stationsSynced', 'unique', 'waterRejected', 'elevatedWaterRejected', 'lehunFloorRejected', 'floorRejected']) assert.ok(landings[check], `${view.name}: ${check}`);
    assert.equal(landings.results.length, 29 + homeStops.length);
    for (const result of landings.results) {
      assert.ok(result.ok && result.ground && result.valid && !result.travelling && !result.collided, JSON.stringify(result));
      assert.ok(Math.hypot(result.x - result.expected.x, result.z - result.expected.z) < 0.01, JSON.stringify(result));
      assert.ok(Math.abs(result.y - result.floor) < 0.02 && result.cameraDistance < 35, JSON.stringify(result));
    }

    const states = await page.evaluate(async () => {
      const home = __home, player = home.player, travel = home.extras.travelAgency, jet = home.extras.jetSki;
      const idle = { x: 0, z: 0, up: false, down: false, run: false };
      player.startFlying(); const flew = player.flying;
      const flight = travel.travel('qin-gate') && player.mode === 'ground';
      player.startFlying(); player.pos.x = -45; player.pos.z = 0; player.stopFlying();
      for (let frame = 0; frame < 300; frame++) player.update(1 / 60, idle, home.rig.yaw);
      const swam = player.swimming;
      const swim = travel.travel('qin-palace') && player.mode === 'ground';
      jet.ski.position.set(-45, -0.42, 0); jet.ski.rotation.set(0, 0, 0); jet.update(0.1);
      player.startFlying(); player.pos.x = -47; player.pos.z = 0; player.stopFlying();
      for (let frame = 0; frame < 300; frame++) player.update(1 / 60, idle, home.rig.yaw);
      jet.update(0.1); const mounted = jet.interact() && player.mode === 'vehicle';
      const boat = travel.travel('qin-well') && !player.vehicle && player.mode === 'ground';
      jet.update(0.1);
      const parked = Math.hypot(jet.ski.position.x + 45, jet.ski.position.z) < 0.01 && jet.speed === 0;
      const { REST_POINTS } = await import('/world/rest-points.js');
      const seat = REST_POINTS.find(point => point.id.startsWith('qin-cinema-seat') && point.x === 147.2);
      travel.travel('qin-cinema'); const sat = player.restAt(seat);
      home.extras.qinIsland.cinema.update(); const screening = home.extras.qinIsland.cinema.active;
      const cinemaBlocked = !travel.travel('home-island') && !!player.resting;
      home.extras.qinIsland.cinema.close();
      const returned = travel.travel('home-island');
      const savedNearest = home.nav.nearestStand, before = [player.pos.x, player.pos.z];
      home.nav.nearestStand = () => null;
      const failure = !travel.travel('qin-emperor') && player.pos.x === before[0] && player.pos.z === before[1];
      home.nav.nearestStand = savedNearest;
      const unknown = !travel.travel('missing-stop');
      return { flew, flight, swam, swim, mounted, boat, parked, sat, screening, cinemaBlocked, returned, failure, unknown };
    });
    for (const [name, passed] of Object.entries(states)) assert.ok(passed, `${view.name}: ${name} ${JSON.stringify(states)}`);

    const army = await page.evaluate(() => {
      const home = __home, player = home.player, encounter = home.extras.qinIsland.encounter, travel = home.extras.travelAgency;
      const idle = { x: 0, z: 0, up: false, down: false, run: false };
      const advance = seconds => {
        for (let frame = 0; frame < seconds * 30; frame++) { player.update(1 / 30, idle, home.rig.yaw); home.rig.update(1 / 30, player); encounter.update(1 / 30); }
      };
      player.teleport(encounter.emperor.x + 1.6, encounter.emperor.z); encounter.update(0.1);
      const started = encounter.interact();
      const blocked = !travel.travel('home-island') && encounter.active;
      encounter.skip(); advance(2);
      player.teleport(175, 24); advance(0.2); player.teleport(168.5, 24); advance(0.2);
      const takeover = encounter.interact(); encounter.skip(); advance(2);
      const original = home.avatar.material.map;
      const courtyard = travel.travel('qin-seven'); advance(1.2);
      const following = encounter.army.status === 'following';
      const interior = travel.travel('qin-panorama'); advance(1.2);
      const door = encounter.army.status === 'door-guard' && encounter.army.room === 'palace';
      const leave = travel.travel('home-island'); advance(1.2);
      const waiting = encounter.army.status === 'waiting';
      const resume = travel.travel('qin-gate'); advance(1.2);
      const followedAgain = encounter.army.status === 'following';
      travel.travel('home-island'); advance(26);
      const returning = ['returning', 'returned'].includes(encounter.army.status) || ['refreezing', 'dormant'].includes(encounter.phase);
      const kept = encounter.hasSeal && encounter.commandUnlocked && original === home.avatar.material.map;
      encounter.reset(true); home.rig.skipIntro(); home.rig.update(2, player);
      return { started, blocked, takeover, courtyard, following, interior, door, leave, waiting, resume, followedAgain, returning, kept };
    });
    for (const [name, passed] of Object.entries(army)) assert.ok(passed, `${view.name}: ${name} ${JSON.stringify(army)}`);
    await open();
    await press('[data-travel-group="east"]');
    await page.locator('.travel-list').evaluate(element => { element.scrollTop = element.scrollHeight; });
    await shoot('coast');
    if (view.hasTouch) {
      await page.setViewportSize({ width: 844, height: 390 });
      const bounds = await page.locator('#phone').boundingBox();
      assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 390, JSON.stringify(bounds));
      assert.ok(await page.locator('.travel-stop').first().evaluate(element => element.getBoundingClientRect().height >= 44));
      await shoot('landscape');
      await press('[data-travel-to="home-island"]');
      await page.setViewportSize(view.viewport);
    } else await press('[data-travel-to="home-island"]');
    const stats = await page.evaluate(() => __home.stats());
    assert.deepEqual(errors, []);
    report.push({ view: view.name, destinations: landings.results.length, states, army, stats });
    console.log(`${view.name}: phone app, home island, languages, ${landings.results.length} landings, state transitions and army compatibility passed`);
    await context.close();
  }
  writeFileSync(new URL('travel-agency-report.json', output), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
