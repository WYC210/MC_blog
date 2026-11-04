import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const output = new URL('./.check/', import.meta.url);
mkdirSync(output, { recursive: true });
const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const browser = await chromium.launch({ channel: 'chrome', args }).catch(() => chromium.launch({ args }));

try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1280, height: 800 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext(view);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 60000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const station = await page.evaluate(async () => {
      const { STATIONS } = await import('@world/layout.js');
      const computer = STATIONS.find(station => station.id === 'computer');
      __home.rig.skipIntro();
      __home.player.teleport(...computer.at);
      return computer;
    });
    assert.equal(station.floor, 1);
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '电脑');
    if (view.hasTouch) await page.locator('#prompt').tap();
    else await page.keyboard.press('f');
    const panel = page.locator('#panel[data-station="computer"][open]');
    await panel.waitFor();
    assert.equal(await panel.locator('[data-computer-app]').count(), 1);
    assert.equal(await panel.locator('[data-category="games"]').count(), 0);
    assert.equal(await panel.locator('[data-computer-app][href]').count(), 0);
    await page.waitForFunction(() => /\d\d:\d\d/.test(document.querySelector('#panel [data-computer-clock]').textContent));
    await panel.locator('.computer-welcome h3').click();
    assert.ok(await panel.isVisible(), 'Clicking the desktop closed it');
    await panel.locator('[data-computer-filter="games"]').click();
    assert.equal(await panel.locator('[data-computer-app]:visible').count(), 0);
    await panel.locator('[data-computer-filter="dev"]').click();
    assert.equal(await panel.locator('[data-computer-app]:visible').count(), 1);
    await panel.locator('[data-computer-app="github"]').click();
    assert.match(await panel.locator('[data-computer-status]').textContent(), /computer.apps/);
    await page.evaluate(async () => (await import('@engine/lang.js')).setLang('en'));
    assert.equal(await panel.locator('.computer-welcome h3').textContent(), 'Welcome to your desktop');
    assert.match(await panel.locator('[data-computer-status]').textContent(), /This app needs a link/);
    await page.evaluate(async () => (await import('@engine/lang.js')).setLang('zh'));
    await panel.locator('[data-computer-filter="all"]').click();
    const bounds = await panel.evaluate(panel => {
      const desktop = panel.querySelector('[data-computer-desktop]');
      const workspace = panel.querySelector('.computer-workspace');
      const rect = panel.getBoundingClientRect();
      return { fits: rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight,
        noOverflow: desktop.scrollWidth <= desktop.clientWidth && workspace.scrollWidth <= workspace.clientWidth };
    });
    assert.ok(bounds.fits && bounds.noOverflow, `Desktop overflows: ${JSON.stringify(bounds)}`);
    await page.screenshot({ path: fileURLToPath(new URL(`computer-ui-${view.name}.png`, output)) });
    if (view.hasTouch) await panel.locator('.close').tap();
    else await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#panel').open && !document.body.classList.contains('reading'));
    assert.equal(await page.evaluate(() => document.body.classList.contains('reading')), false);
    await page.keyboard.press('f');
    await panel.waitFor();
    assert.equal(await panel.locator('[data-computer-app]:visible').count(), 1);
    const stats = await page.evaluate(() => __home.stats());
    console.log(`${view.name}: proximity, F/touch, filters, missing links, language, clock, close/reopen passed; ${stats.calls} calls, ${stats.triangles} triangles`);
    assert.deepEqual(errors, []);
    await context.close();
  }

  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const article = html.match(/<article class="page" data-station="computer"[\s\S]*?<\/article>/)[0];
  const fixture = `<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="/engine/style.css">
    <link rel="stylesheet" href="/world/computer.css">
    <script type="importmap">{"imports":{"@engine/":"/engine/","@config":"/home.config.js","three":"/vendor/three/three.module.min.js"}}</script>
    <section id="pages">${article}</section><section id="contact"><li data-app="github"><a href="https://github.com/computer-check">GitHub</a></li></section>
    <dialog id="panel" data-station="computer"><header></header><div class="body page"></div></dialog>
    <script type="module">
      import { createComputer } from '/world/computer.js';
      createComputer({ apps: [
        { id: 'github', name: 'GitHub', icon: 'github', category: 'dev', url: '' },
        { id: 'game', name: '<img src=x onerror=alert(1)>', url: '/__computer-game' },
        { id: 'unsafe', name: 'Unsafe', url: 'javascript:alert(1)' },
        { id: 'data', name: 'Data', url: 'data:text/html,test' },
        { id: 'empty', name: 'Empty', category: 'games', url: '' },
        { id: 'whitespace', name: 'Whitespace', category: 'games', url: '  ' },
      ] });
      const panel = document.querySelector('#panel');
      panel.querySelector('.body').innerHTML = document.querySelector('#pages article').innerHTML;
      panel.showModal();
    </script>`;
  const context = await browser.newContext();
  await context.route('**/__computer-fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await context.route('**/__computer-game', route => route.fulfill({ contentType: 'text/html', body: '<title>Game check</title>' }));
  await context.route('https://github.com/computer-check', route => route.fulfill({ contentType: 'text/html', body: '<title>GitHub check</title>' }));
  const page = await context.newPage();
  await page.goto(new URL('/__computer-fixture', base).href);
  await page.locator('#panel[open]').waitFor();
  assert.equal(await page.locator('#panel [data-computer-app="github"]').getAttribute('href'), 'https://github.com/computer-check');
  assert.equal(await page.locator('#panel [data-computer-app="game"] strong').textContent(), '<img src=x onerror=alert(1)>');
  for (const id of ['unsafe', 'data', 'empty', 'whitespace']) {
    assert.equal(await page.locator(`#panel [data-computer-app="${id}"]`).count(), 0);
  }
  assert.equal(await page.locator('#panel [data-category="games"]').count(), 1);
  for (const id of ['github', 'game']) {
    const popupReady = context.waitForEvent('page');
    await page.locator(`#panel [data-computer-app="${id}"]`).click();
    const popup = await popupReady;
    await popup.waitForLoadState();
    assert.match(popup.url(), id === 'github' ? /github.com\/computer-check/ : /__computer-game/);
    assert.equal(await popup.evaluate(() => window.opener), null);
    assert.ok(await page.locator('#panel[open]').isVisible());
    await popup.close();
  }
  await context.close();
  console.log('Configured GitHub/game links, contact fallback, safe new tabs, unsafe URLs and HTML text safety passed');
} finally {
  await browser.close();
}
