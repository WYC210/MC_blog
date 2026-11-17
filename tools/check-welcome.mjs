import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const args = process.env.WELCOME_GPU === 'hardware' ? [] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/engine/main.js', route => route.fulfill({ contentType: 'application/javascript', body: '' }));
  await page.goto(new URL('?lang=zh', base).href);
  const results = await page.evaluate(async () => {
    const { createWelcome } = await import('@engine/ui/welcome.js');
    const { createInput } = await import('@engine/input.js');
    const { setLang } = await import('@engine/lang.js');
    const { createRig } = await import('@engine/world/rig.js');
    const THREE = await import('three');
    document.getElementById('loading').remove();
    const root = document.getElementById('welcome');
    const canvas = document.createElement('canvas');
    document.getElementById('world').append(canvas);
    let entries = 0, actions = 0, quality = 0, modal = false;
    const world = {};
    const input = createInput(canvas, {
      interact: () => actions++, jump: () => actions++, toggleFly: () => actions++,
      view: () => actions++, map: () => actions++, photo: () => actions++,
      slot: () => actions++, escape: () => actions++, debug: () => actions++,
    });
    const welcome = createWelcome({ world, enter: () => { entries++; input.clear(); }, quality: () => quality++, blocked: () => modal });
    const fire = (type, key, code = key) => window.dispatchEvent(new KeyboardEvent(type, { key, code, bubbles: true, cancelable: true }));
    const rows = [];
    for (const [key, code] of [['w', 'KeyW'], [' ', 'Space'], ['f', 'KeyF'], ['p', 'KeyP'], ['m', 'KeyM'], ['v', 'KeyV'], ['1', 'Digit1'], ['Escape', 'Escape'], ['F3', 'F3']]) {
      welcome.show();
      const before = entries;
      fire('keydown', key, code);
      rows.push({ name: `first ${code}`, ok: entries === before + 1 && actions === 0 && input.read().x === 0 && input.read().z === 0 });
      welcome.finish();
      window.dispatchEvent(new KeyboardEvent('keydown', { key, code, repeat: true, bubbles: true, cancelable: true }));
      rows.push({ name: `held ${code}`, ok: actions === 0 && input.read().z === 0 });
      fire('keyup', key, code);
    }
    welcome.show();
    fire('keydown', 'Tab', 'Tab');
    rows.push({ name: 'Tab keeps welcome open', ok: !welcome.entering });
    root.querySelector('[data-welcome-quality]').click();
    rows.push({ name: 'quality button does not enter', ok: quality === 1 && !welcome.entering });
    modal = true;
    fire('keydown', 'Enter', 'Enter');
    rows.push({ name: 'modal keeps welcome open', ok: !welcome.entering });
    modal = false;
    actions = 0;
    for (const pack of ['loading', 'ready', 'fallback']) {
      world.hdMaterials = { status: pack };
      welcome.refresh();
      const text = root.querySelector('[role="status"]').textContent;
      rows.push({ name: `HD ${pack}`, ok: text.includes({ loading: '加载中', ready: '已就绪', fallback: '普通材质' }[pack]) });
    }
    setLang('en');
    rows.push({ name: 'English status', ok: root.querySelector('[role="status"]').textContent.includes('unavailable') });
    root.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    rows.push({ name: 'background click enters', ok: welcome.entering });
    welcome.finish();
    fire('keydown', 'f', 'KeyF');
    fire('keyup', 'f', 'KeyF');
    rows.push({ name: 'world shortcuts restored', ok: actions === 1 });

    const camera = new THREE.PerspectiveCamera(50, 1.6, .1, 1000);
    const rig = createRig(camera, { hidden: new Set(), grid: { raycast: () => null }, setHidden() {} });
    const player = { pos: new THREE.Vector3(.5, 0, 18), y: 0, heading: 0 };
    rig.startIntro(player, [70, 60, 90], [0, 0, 0], { hold: true });
    for (let frame = 0; frame < 400; frame++) rig.update(1 / 60, player);
    rows.push({ name: 'aerial held indefinitely', ok: camera.position.equals(new THREE.Vector3(70, 60, 90)) && rig.introActive });
    rig.skipIntro();
    rig.update(1 / 60, player);
    rows.push({ name: 'legacy skip cannot release welcome', ok: camera.position.y === 60 });
    rig.releaseIntro();
    rig.update(1 / 60, player);
    rows.push({ name: 'descent starts at full altitude', ok: camera.position.y > 59.9 });
    for (let frame = 0; frame < 160; frame++) rig.update(1 / 60, player);
    rows.push({ name: 'descent completes', ok: !rig.introActive && camera.position.y < 10 });
    rig.startIntro(player);
    for (let frame = 0; frame < 240; frame++) rig.update(1 / 60, player);
    rows.push({ name: 'legacy automatic intro completes', ok: !rig.introActive });
    return rows;
  });
  for (const result of results) assert.ok(result.ok, result.name);
  assert.deepEqual(errors, []);
  console.log(`PASS ${results.length} welcome/input/camera checks`);
  await page.close();

  const reduced = await browser.newPage({ reducedMotion: 'reduce' });
  const network = [];
  reduced.on('response', response => { if (response.status() >= 400) network.push(`${response.status()} ${response.url()}`); });
  reduced.on('requestfailed', request => network.push(`${request.failure()?.errorText} ${request.url()}`));
  await reduced.goto(new URL('?lang=en', base).href);
  await reduced.waitForFunction(() => window.__home || window.__homeStartupError, null, { timeout: 90000 });
  assert.equal(await reduced.evaluate(() => window.__homeStartupError || null), null);
  assert.equal(await reduced.evaluate(() => __home.welcome.active && __home.rig.introActive), true);
  const motion = await reduced.evaluate(async () => {
    const home = __home;
    home.weather.dispose(); home.setWeatherMode('rain'); home.weatherFx.settle(); home.stage.settle();
    const snapshot = () => ({ clouds: home.stage.sky.material.uniforms.uCloudShift.value.toArray(),
      water: home.pool.water.material.uniforms.uTime.value, rain: home.weatherFx.rain.visible,
      worldTime: home.stage.scene.userData.animationTime });
    const before = snapshot();
    for (let frame = 0; frame < 8; frame++) await new Promise(requestAnimationFrame);
    return { before, after: snapshot() };
  });
  assert.deepEqual(motion.before, motion.after, 'Reduced motion suppresses the welcome environment animation');
  assert.equal(motion.after.rain, false);
  await reduced.locator('[data-welcome-quality]').click();
  assert.equal(await reduced.locator('#qualityDialog').evaluate(dialog => dialog.open), true);
  await reduced.locator('#qualityCancel').click();
  assert.equal(await reduced.evaluate(() => __home.welcome.active && !__home.welcome.entering), true);
  await reduced.keyboard.press('Space');
  await reduced.waitForFunction(() => !__home.welcome.active && !__home.rig.introActive);
  assert.equal(await reduced.locator('#hud').evaluate(hud => hud.hidden), false);
  assert.equal(await reduced.evaluate(() => __home.player.flying), false);
  console.log('PASS reduced-motion welcome, quality confirmation/cancel and Space without jumping');
  if (network.length) console.log(`Existing network failures: ${network.join('; ')}`);
  await reduced.close();
} finally {
  await browser.close();
}
