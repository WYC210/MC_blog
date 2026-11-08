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
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.addInitScript(() => {
      window.__mapIconDraws = { minimap: new Set(), bigmap: new Set() };
      const original = CanvasRenderingContext2D.prototype.drawImage;
      CanvasRenderingContext2D.prototype.drawImage = function (...args) {
        const id = args[0]?.dataset?.icon, host = this.canvas.closest('#minimap, #bigmap');
        if (id && host) __mapIconDraws[host.id].add(id);
        return original.apply(this, args);
      };
    });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 120000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const icons = await page.evaluate(async () => {
      const { STATIONS } = await import('/world/layout.js'), { MAP_ICON_IDS, registerMapIcons } = await import('/world/map-icons.js');
      const { icon } = await import('/engine/ui/icons.js');
      __home.rig.skipIntro(); for (let frame = 0; frame < 240; frame++) __home.rig.update(1 / 60, __home.player);
      __home.setTimeMode('day'); __home.setWeatherMode('clear'); __home.stage.settle();
      const before = MAP_ICON_IDS.map(id => icon(id).canvas); registerMapIcons();
      return STATIONS.map(station => {
        const entry = icon(station.id), pixels = entry.canvas.getContext('2d').getImageData(0, 0, entry.canvas.width, entry.canvas.height).data;
        let opaque = 0, transparent = 0;
        for (let index = 3; index < pixels.length; index += 4) { if (pixels[index]) opaque++; else transparent++; }
        return { id: station.id, configured: station.icon, width: entry.canvas.width, height: entry.canvas.height, opaque, transparent,
          fallback: entry.url === icon('map').url, url: entry.url, cached: !MAP_ICON_IDS.includes(station.id) || before[MAP_ICON_IDS.indexOf(station.id)] === entry.canvas,
          pageIcon: document.querySelector(`#pages [data-station="${station.id}"]`)?.dataset.icon || null };
      });
    });
    assert.equal(icons.length, 19);
    assert.equal(new Set(icons.map(entry => entry.url)).size, 19);
    for (const entry of icons) {
      assert.equal(entry.fallback, false, entry.id); assert.equal(entry.cached, true, entry.id);
      assert.equal(entry.configured, entry.id); assert.ok(entry.opaque > 50 && entry.transparent > 10, entry.id);
      if (entry.id !== 'portal') { assert.equal(entry.width, 32); assert.equal(entry.height, 32); }
      if (entry.pageIcon) assert.equal(entry.pageIcon, entry.id);
    }
    for (const position of [{ name: 'emperor', x: 160, z: 25 }, { name: 'stories', x: 113, z: -14 }, { name: 'east', x: 207, z: -1 }]) {
      await page.evaluate(({ x, z }) => { __home.player.teleport(x, z); __home.rig.set(0, 0.4, 8); }, position);
      await page.waitForTimeout(400);
      await page.locator('#minimap').screenshot({ path: fileURLToPath(new URL(`map-icons-${view.name}-${position.name}.png`, output)) });
    }
    const expected = icons.filter(entry => entry.id !== 'portal').map(entry => entry.id).sort();
    assert.deepEqual(await page.evaluate(() => [...__mapIconDraws.minimap].sort()), expected);
    await page.locator('#minimap .expand').click();
    await page.locator('#bigmap').waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => [...__mapIconDraws.bigmap].sort()), expected);
    await page.screenshot({ path: fileURLToPath(new URL(`map-icons-${view.name}-expanded.png`, output)) });
    await page.locator('#bigmap .close').click();
    await page.evaluate(() => { __home.player.teleport(160, 19); __home.rig.skipIntro(); for (let frame = 0; frame < 120; frame++) __home.rig.update(1 / 60, __home.player); });
    await page.waitForFunction(() => !document.querySelector('#prompt').hidden && document.querySelector('#prompt span').textContent === '秦始皇像');
    if (view.hasTouch) await page.locator('#prompt').tap(); else await page.keyboard.press('f');
    await page.locator('#panel[data-station="qin-emperor"][open]').waitFor();
    const portrait = icons.find(entry => entry.id === 'qin-emperor').url;
    for (const language of ['zh-CN', 'en']) {
      assert.equal(await page.locator('html').getAttribute('lang'), language);
      assert.ok((await page.locator('#panel header .icon').evaluate(element => element.style.backgroundImage)).includes(portrait));
      assert.equal(await page.locator('#panel .about-text:visible').count(), 1);
      await page.locator('#panel .lang-switch').click();
    }
    await page.screenshot({ path: fileURLToPath(new URL(`map-icons-${view.name}-emperor-card.png`, output)) });
    await page.locator('#panel .close').click();
    await page.locator('#minimap canvas').click({ position: { x: 80, y: 100 } });
    await page.waitForTimeout(200);
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
    if (view.name === 'desktop') {
      await page.evaluate(async () => {
        const { STATIONS } = await import('/world/layout.js'), { MAP_ICON_IDS } = await import('/world/map-icons.js'), { icon } = await import('/engine/ui/icons.js');
        const canvas = document.createElement('canvas'); canvas.id = 'mapIconSheet'; canvas.width = 960; canvas.height = 540;
        canvas.style.cssText = 'position:fixed;left:160px;top:100px;z-index:100000;width:960px;height:540px'; document.body.append(canvas);
        const paint = canvas.getContext('2d'); paint.fillStyle = '#f7f0df'; paint.fillRect(0, 0, 960, 540); paint.imageSmoothingEnabled = false;
        for (const [index, id] of MAP_ICON_IDS.entries()) {
          const column = index % 6 * 160, row = Math.floor(index / 6) * 180, station = STATIONS.find(item => item.id === id);
          paint.drawImage(icon(id).canvas, column + 48, row + 24, 64, 64); paint.fillStyle = '#263137'; paint.textAlign = 'center';
          paint.font = '16px "Microsoft YaHei", sans-serif'; paint.fillText(station.name, column + 80, row + 118, 150);
          paint.font = '11px sans-serif'; paint.fillText(station.en, column + 80, row + 141, 150);
        }
      });
      await page.locator('#mapIconSheet').screenshot({ path: fileURLToPath(new URL('map-icons-sheet.png', output)) });
      await page.locator('#mapIconSheet').evaluate(element => element.remove());
    }
    assert.deepEqual(errors, []);
    report.push({ view: view.name, icons: icons.map(({ url, ...entry }) => entry), stats });
    console.log(`${view.name}: 19 distinct station icons; 18 custom pixel glyphs; radar and expanded map; matching bilingual emperor card; F/touch; ${stats.calls} calls / ${stats.triangles} triangles`);
    await context.close();
  }
  writeFileSync(new URL('map-icons-report.json', output), JSON.stringify(report, null, 2));
} finally { await browser.close(); }
