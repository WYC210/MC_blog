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
    { name: 'desktop', viewport: { width: 1440, height: 900 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 3 },
  ]) {
    const context = await browser.newContext(view), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    const seats = await page.evaluate(() => {
      const home = __home, player = home.player, cinema = home.extras.qinIsland.cinema;
      home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) home.rig.update(1 / 60, player);
      home.setTimeMode('day'); home.setWeatherMode('clear'); home.stage.settle();
      return home.extras.furniture.points.filter(point => point.id.startsWith('qin-cinema-seat-')).map(point => {
        const moved = player.teleport(point.x, point.z + 0.75);
        const start = { x: player.pos.x, z: player.pos.z, y: player.y };
        const sat = player.restAt(point);
        cinema.update();
        const active = cinema.active;
        cinema.close();
        return { id: point.id, moved, sat, active, returned: player.mode === 'ground' && Math.abs(player.pos.x - start.x) < 0.01 && Math.abs(player.pos.z - start.z) < 0.01,
          floor: player.floorY, collided: home.world.qinIsland.site.collides(player.pos.x, player.y, player.pos.z) };
      });
    });
    assert.equal(seats.length, 18);
    for (const seat of seats) assert.ok(seat.moved && seat.sat && seat.active && seat.returned && seat.floor === 3 && !seat.collided, JSON.stringify(seat));
    const activate = async locator => view.hasTouch ? locator.tap() : locator.click();
    const sit = async () => {
      await page.evaluate(() => {
        __home.player.teleport(147.2, -22.35);
        __home.rig.showcase([150, 5, -23], [150, 5, -31]);
        for (let frame = 0; frame < 180; frame++) __home.rig.update(1 / 60, __home.player);
        __home.extras.furniture.update(1);
      });
      await page.locator('#furniturePrompt[data-furniture^="qin-cinema-seat-"]:visible').waitFor();
      if (view.hasTouch) await activate(page.locator('#furniturePrompt'));
      else await page.keyboard.press('f');
      await page.locator('#qinCinema[open]').waitFor().catch(async error => {
        console.error(await page.evaluate(() => ({ mode: __home.player.mode, resting: __home.player.resting, target: __home.extras.furniture.target,
          prompt: document.querySelector('#furniturePrompt').outerHTML, panel: document.querySelector('#panel').open,
          active: document.activeElement?.outerHTML, errors: window.__homeStartupError })));
        throw error;
      });
    };
    await sit();
    await page.waitForFunction(() => __home.world.qinIsland.media.story.state.time > 0.5);
    for (const key of ['w', 'a', 's', 'd', 'ArrowUp', 'Control', 'm', '1', 'p', 'v', 'Tab']) await page.keyboard.press(key);
    assert.ok(await page.evaluate(() => __home.player.mode === 'rest' && __home.extras.qinIsland.cinema.active && !document.querySelector('#panel').open && document.querySelector('#bigmap').hidden));
    await activate(page.locator('#qinCinema .cinema-pause'));
    const paused = await page.evaluate(() => __home.world.qinIsland.media.story.state.time);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => __home.world.qinIsland.media.story.state.time), paused);
    const frames = [];
    for (const language of ['zh', 'en']) {
      for (let phase = 0; phase < 4; phase++) {
        const frame = await page.evaluate(({ phase, language }) => {
          const home = __home, cinema = home.extras.qinIsland.cinema, state = home.world.qinIsland.media.story.state;
          home.world.qinIsland.media.story.draw(phase * 12 + 6); cinema.render();
          const dialog = document.querySelector('#qinCinema'), canvas = dialog.querySelector('canvas');
          const bounds = dialog.getBoundingClientRect(), image = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          const colors = new Set();
          for (let offset = 0; offset < image.length; offset += 64) colors.add(`${image[offset]},${image[offset + 1]},${image[offset + 2]}`);
          return { phase: state.phase, language: state.language, caption: dialog.querySelector('.cinema-caption p').textContent,
            colors: colors.size, hiddenHUD: getComputedStyle(document.querySelector('#hud')).visibility === 'hidden',
            covers: bounds.left === 0 && bounds.top === 0 && bounds.width === innerWidth && bounds.height === innerHeight,
            fits: [...dialog.querySelectorAll('h2, h3, .cinema-caption p, button')].filter(element => !element.hidden).every(element => {
              const rect = element.getBoundingClientRect();
              return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
            }) };
        }, { phase, language });
        assert.ok(frame.phase === phase && frame.language === language && frame.colors > 30 && frame.hiddenHUD && frame.covers && frame.fits, JSON.stringify(frame));
        assert.equal(/[\u3400-\u9fff]/.test(frame.caption), language === 'zh');
        frames.push(frame);
        await page.screenshot({ path: fileURLToPath(new URL(`qin-cinema-${view.name}-${language}-${phase}.png`, output)) });
      }
      const beforeLanguage = await page.evaluate(() => __home.world.qinIsland.media.story.state.time);
      await activate(page.locator('#qinCinema .lang-switch'));
      assert.equal(await page.evaluate(() => __home.world.qinIsland.media.story.state.time), beforeLanguage);
    }
    if (view.hasTouch) {
      await page.setViewportSize({ width: 844, height: 390 });
      await page.waitForTimeout(300);
      const layout = await page.evaluate(() => {
        const dialog = document.querySelector('#qinCinema'), caption = dialog.querySelector('.cinema-caption p').getBoundingClientRect();
        const replay = dialog.querySelector('.cinema-replay').getBoundingClientRect();
        return { width: dialog.clientWidth, height: dialog.clientHeight, captionEnd: caption.right, controlsStart: replay.left, captionBottom: caption.bottom };
      });
      assert.ok(layout.width === 844 && layout.height === 390 && layout.captionEnd < layout.controlsStart && layout.captionBottom <= 390, JSON.stringify(layout));
      await page.screenshot({ path: fileURLToPath(new URL('qin-cinema-phone-landscape.png', output)) });
      await page.setViewportSize(view.viewport);
    }
    await activate(page.locator('#qinCinema .cinema-replay'));
    assert.equal(await page.evaluate(() => __home.world.qinIsland.media.story.state.time), 0);
    await activate(page.locator('#qinCinema .cinema-pause'));
    await page.waitForFunction(() => __home.world.qinIsland.media.story.state.time > 0.3);
    const hidden = await page.evaluate(() => {
      const home = __home, state = home.world.qinIsland.media.story.state, before = state.time;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      for (let frame = 0; frame < 20; frame++) home.extras.qinIsland.update(0.05);
      delete document.hidden;
      return state.time === before;
    });
    assert.ok(hidden);
    if (view.hasTouch) await activate(page.locator('#qinCinema .cinema-exit'));
    else await page.keyboard.press('Escape');
    await page.waitForFunction(() => !__home.extras.qinIsland.cinema.active && !document.body.classList.contains('qin-cinema-active') && __home.player.mode === 'ground');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#hud')).visibility), 'visible');
    await sit();
    await page.keyboard.press('f');
    assert.equal(await page.evaluate(() => __home.extras.qinIsland.cinema.active), false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await sit();
    assert.equal(await page.locator('#qinCinema').getAttribute('data-playing'), 'false');
    const reducedTime = await page.evaluate(() => __home.world.qinIsland.media.story.state.time);
    await page.waitForTimeout(500);
    assert.equal(await page.evaluate(() => __home.world.qinIsland.media.story.state.time), reducedTime);
    await activate(page.locator('#qinCinema .cinema-pause'));
    await page.waitForFunction(() => __home.world.qinIsland.media.story.state.time > 0.3);
    await activate(page.locator('#qinCinema .cinema-exit'));
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, seats, frames, stats });
    console.log(`${view.name}: 18 seats; F/touch entry; full-window film; four acts in both languages; blocked game shortcuts; pause/replay; safe exit; hidden/reduced-motion checks passed; ${stats.calls} calls, ${stats.triangles} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-cinema-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
