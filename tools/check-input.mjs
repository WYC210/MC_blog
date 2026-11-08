import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const remembered = () => { try { return readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim(); } catch { return ''; } };
const base = (process.argv[2] || remembered()).replace(/\/$/, '');
if (!base) throw new Error('Start tools/serve.py or pass the local preview URL.');
const args = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ channel: 'chrome', args });
try {
  const isolated = await browser.newPage();
  await isolated.goto(`${base}/?plain`);
  const results = await isolated.evaluate(async () => {
    const { createInput } = await import('@engine/input.js');
    let blocked = false, interactions = 0, jumps = 0, flights = 0, debug = 0, slots = 0;
    const input = createInput(document.createElement('canvas'), {
      blocked: () => blocked, interact: () => interactions++, jump: () => jumps++, toggleFly: () => flights++,
      debug: () => debug++, slot: () => slots++,
    });
    const rows = [];
    const fire = (type, options, target = window) => {
      const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, ...options });
      target.dispatchEvent(event);
      return { ...input.read(), prevented: event.defaultPrevented };
    };
    const check = (name, actual, expected) => rows.push({ name, actual, expected });
    for (const key of ['d', 'D', 'Process', 'в']) {
      input.clear();
      const state = fire('keydown', { key, code: 'KeyD', isComposing: key === 'Process' });
      check(`physical D with key=${key}`, [state.x, state.prevented], [1, true]);
      check(`release D with changed key=${key}`, fire('keyup', { key: 'Unidentified', code: 'KeyD' }).x, 0);
    }
    input.clear();
    fire('keydown', { key: 'a', code: 'KeyA' });
    fire('keyup', { key: 'Process', code: 'KeyA', isComposing: true });
    check('released A does not cancel D', fire('keydown', { key: 'd', code: 'KeyD' }).x, 1);
    input.clear();
    check('a different physical key producing d does not steer', fire('keydown', { key: 'd', code: 'KeyH' }).x, 0);
    for (const code of ['', 'Unidentified']) {
      input.clear();
      check(`fallback without usable code: ${code}`, fire('keydown', { key: 'D', code }).x, 1);
      check(`fallback release: ${code}`, fire('keyup', { key: 'd', code }).x, 0);
    }
    input.clear();
    fire('keydown', { key: 'Control', code: 'ControlLeft', ctrlKey: true });
    const ctrlD = fire('keydown', { key: 'd', code: 'KeyD', ctrlKey: true });
    check('Ctrl+D moves, descends and cancels the page default', [ctrlD.x, ctrlD.down, ctrlD.prevented], [1, true, true]);
    input.clear();
    fire('keydown', { key: 'd', code: 'KeyD' });
    fire('keydown', { key: 'ArrowRight', code: 'ArrowRight' });
    check('releasing D preserves a held right arrow', fire('keyup', { key: 'd', code: 'KeyD' }).x, 1);
    window.dispatchEvent(new Event('blur'));
    check('window blur releases movement', input.read().x, 0);
    for (const [key, field] of [['Shift', 'run'], ['Control', 'down']]) {
      input.clear();
      fire('keydown', { key, code: `${key}Left` });
      fire('keydown', { key, code: `${key}Right` });
      check(`releasing left ${key} preserves right ${key}`, fire('keyup', { key, code: `${key}Left` })[field], true);
      check(`releasing both ${key} keys clears the state`, fire('keyup', { key, code: `${key}Right` })[field], false);
    }
    input.clear();
    check('Space climbs and jumps once', [fire('keydown', { key: ' ', code: 'Space' }).up, jumps], [true, 1]);
    fire('keydown', { key: ' ', code: 'Space', repeat: true });
    check('holding Space does not toggle flight', [jumps, flights], [1, 0]);
    check('Space release stops climbing', fire('keyup', { key: ' ', code: 'Space' }).up, false);
    fire('keydown', { key: ' ', code: 'Space' });
    check('a second Space press toggles flight', flights, 1);
    input.clear(); blocked = true;
    const paused = fire('keydown', { key: 'd', code: 'KeyD' });
    check('panels retain their keys', [paused.x, paused.prevented], [0, false]);
    blocked = false;
    for (const modifiers of [{ metaKey: true }, { altKey: true }]) {
      input.clear();
      const state = fire('keydown', { key: 'd', code: 'KeyD', ...modifiers });
      check(`system modifier ${Object.keys(modifiers)[0]}`, [state.x, state.prevented], [0, false]);
    }
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      input.clear();
      const target = document.body.appendChild(document.createElement(tag));
      if (tag === 'div') target.contentEditable = 'true';
      const state = fire('keydown', { key: 'Process', code: 'KeyD', isComposing: true }, target);
      check(`typing in ${tag} does not move or cancel text input`, [state.x, state.prevented], [0, false]);
      target.remove();
    }
    input.clear();
    fire('keydown', { key: 'e', code: 'KeyW' });
    check('physical movement does not trigger a localized shortcut', [input.read().z, interactions], [-1, 0]);
    input.clear();
    fire('keydown', { key: '1', code: 'KeyD' });
    check('physical movement does not trigger a Dock slot', [input.read().x, slots], [1, 0]);
    input.clear();
    fire('keydown', { key: 'f', code: 'KeyF' });
    check('interaction shortcut still works', interactions, 1);
    check('F3 remains available and cancels browser search', [fire('keydown', { key: 'F3', code: 'F3' }).prevented, debug], [true, 1]);
    fire('keydown', { key: 'F3', code: 'F3', repeat: true });
    check('holding F3 does not toggle debug repeatedly', debug, 1);
    return rows;
  });
  for (const { name, actual, expected } of results) assert.deepEqual(actual, expected, name);
  console.log(`PASS ${results.length} browser keyboard event cases (not an OS IME emulator)`);
  await isolated.close();

  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/?lang=${lang}`);
    await page.waitForFunction(() => window.__home && !__home.rig.introActive, null, { timeout: 60000 });
    for (const keys of [['w'], ['a'], ['s'], ['d'], ['ArrowRight'], ['Shift', 'd'], ['w', 'd']]) {
      const start = await page.evaluate(async () => {
        window.dispatchEvent(new Event('blur'));
        const { SPAWN } = await import('@world/layout.js'), home = __home;
        home.teleport(SPAWN.x, SPAWN.z);
        return { x: home.player.pos.x, z: home.player.pos.z, yaw: home.rig.yaw };
      });
      for (const key of keys) await page.keyboard.down(key);
      try {
        await page.waitForFunction(start => Math.hypot(__home.player.pos.x - start.x, __home.player.pos.z - start.z) > .3, start, { timeout: 8000 });
      } finally {
        for (const key of [...keys].reverse()) await page.keyboard.up(key);
      }
      const end = await page.evaluate(() => ({ x: __home.player.pos.x, z: __home.player.pos.z }));
      const right = (end.x - start.x) * Math.cos(start.yaw) - (end.z - start.z) * Math.sin(start.yaw);
      if (keys.includes('d') || keys.includes('ArrowRight')) assert(right > .15, `${lang}: ${keys.join('+')} did not move right`);
      await page.waitForTimeout(150);
      const drift = await page.evaluate(position => Math.hypot(__home.player.pos.x - position.x, __home.player.pos.z - position.z), end);
      assert(drift < .01, `${lang}: ${keys.join('+')} stayed pressed after release`);
    }
    await page.keyboard.press('F3');
    assert.equal(await page.locator('#f3debug').evaluate(element => element.hidden), false);
    await page.keyboard.press('F3');
    assert.equal(await page.locator('#f3debug').evaluate(element => element.hidden), true);
    assert.deepEqual(errors, []);
    console.log(`PASS ${lang}: WASD, arrows, Shift+D, W+D, key release and F3 in the 3D scene`);
    await page.close();

    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const touchErrors = [];
    mobile.on('pageerror', error => touchErrors.push(error.message));
    await mobile.goto(`${base}/?lang=${lang}`);
    await mobile.waitForFunction(() => window.__home && !__home.rig.introActive, null, { timeout: 60000 });
    await mobile.locator('#flyButton').tap();
    const right = mobile.locator('#flightPad [data-dir="right"]');
    await right.waitFor({ state: 'visible' });
    assert.equal(await right.getAttribute('aria-label'), lang === 'zh' ? '向右' : 'Right');
    const box = await right.boundingBox();
    const start = await mobile.evaluate(() => ({ x: __home.player.pos.x, z: __home.player.pos.z, yaw: __home.rig.yaw }));
    const session = await mobile.context().newCDPSession(mobile);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    try {
      await mobile.waitForFunction(position => Math.hypot(__home.player.pos.x - position.x, __home.player.pos.z - position.z) > .3, start, { timeout: 8000 });
    } finally { await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
    const end = await mobile.evaluate(() => ({ x: __home.player.pos.x, z: __home.player.pos.z }));
    assert((end.x - start.x) * Math.cos(start.yaw) - (end.z - start.z) * Math.sin(start.yaw) > .15, `${lang}: touch pad did not move right`);
    assert.equal(await right.evaluate(element => element.classList.contains('on')), false);
    assert.deepEqual(touchErrors, []);
    console.log(`PASS ${lang}: mobile flight pad moves right and releases`);
    await mobile.close();
  }
} finally { await browser.close(); }
