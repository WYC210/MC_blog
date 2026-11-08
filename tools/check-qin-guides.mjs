import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { QIN_STATIONS, QIN_COURTYARD, QIN_HANFEI } from '../world/qin-island-layout.js';

const stories = {
  'qin-zhao': { camera: [111, 4, QIN_COURTYARD.z1 - 3], look: [111, 2.2, QIN_COURTYARD.z0 + 1.3], zh: '胡服骑射', en: 'King Wuling' },
  'qin-tiger': { camera: [117, 4, QIN_COURTYARD.z0 + 9], look: [103.2, 2, QIN_COURTYARD.z0 + 9], zh: '信陵君', en: 'Lord Xinling' },
  'qin-dream': { camera: [105, 4, QIN_COURTYARD.z0 + 9], look: [118.7, 2, QIN_COURTYARD.z0 + 9], zh: '黄粱未熟', en: 'Lu Sheng' },
  'qin-hanfei': { camera: [113.4, 2.7, QIN_HANFEI.z + 2.5], look: [112, 1.9, QIN_HANFEI.z - 2.9], zh: '研读', en: 'reading' },
  'qin-procession': { camera: [160, 5.5, 43], look: [160, 2.2, 33], zh: '卢生', en: 'Lu Sheng' },
  'qin-quyuan': { camera: [207, 3.5, 14], look: [207, 2, 5], zh: '不是秦始皇', en: 'did not accompany' },
  'qin-xufu': { camera: [207, 3.5, -6], look: [207, 2, -16], zh: '后世传说', en: 'later traditions' },
  'qin-bianque': { camera: [134, 4.7, 29], look: [129, 1.25, 21.6], zh: '三指搭脉', en: 'three fingers' },
};
assert.equal(QIN_STATIONS.length, 14);
assert.equal(new Set(QIN_STATIONS.map(station => station.id)).size, 14);
for (const id of Object.keys(stories)) assert.ok(QIN_STATIONS.some(station => station.id === id));

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
    const page = await context.newPage(), errors = [], checks = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(`${base}?lang=zh&debug`);
    await page.waitForFunction(() => window.__home?.player || window.__homeStartupError, null, { timeout: 90000 });
    assert.equal(await page.evaluate(() => window.__homeStartupError || null), null);
    await page.evaluate(() => {
      __home.rig.skipIntro();
      for (let frame = 0; frame < 240; frame++) __home.rig.update(1 / 60, __home.player);
      __home.setWeatherMode('clear');
    });
    const activate = async locator => view.hasTouch ? locator.tap() : locator.click();
    for (const time of ['day', 'night']) {
      await page.evaluate(time => { __home.setTimeMode(time); __home.stage.settle(); }, time);
      for (const station of QIN_STATIONS) {
        const story = stories[station.id];
        if (story) {
          const walk = await page.evaluate(({ station, story, courtyard }) => {
            const home = __home, player = home.player;
            const idle = { x: 0, z: 0, run: false, up: false, down: false };
            player.teleport(111, courtyard.z1 - 2);
            const standable = home.nav.canStand(...station.at) && !home.world.qinIsland.site.collides(station.at[0], 0, station.at[1]);
            const accepted = player.goTo(...station.at);
            let flew = false;
            for (let frame = 0; frame < 12000 && player.travelling; frame++) {
              player.update(1 / 60, idle, 0);
              flew ||= player.mode !== 'ground';
            }
            home.rig.showcase(story.camera, story.look);
            for (let frame = 0; frame < 180; frame++) home.rig.update(1 / 60, player);
            home.extras.qinIsland.update(0);
            return { accepted, standable, flew, distance: Math.hypot(player.pos.x - station.at[0], player.pos.z - station.at[1]) };
          }, { station, story, courtyard: QIN_COURTYARD });
          assert.ok(walk.accepted && walk.standable && !walk.flew && walk.distance < 0.2, `${station.id}: ${JSON.stringify(walk)}`);
          await page.waitForFunction(name => {
            const prompt = document.querySelector('#prompt');
            return !prompt.hidden && prompt.querySelector('span').textContent === name;
          }, station.name);
          if (view.hasTouch) await page.locator('#prompt').tap();
          else await page.keyboard.press('f');
        } else {
          await page.evaluate(id => __home.go(id), station.id);
        }
        const panel = page.locator(`#panel[data-station="${station.id}"][open]`);
        await panel.waitFor();
        for (const language of ['zh-CN', 'en']) {
          const other = language === 'en' ? 'zh-CN' : 'en';
          const block = panel.locator(`.qin-guide .about-text[lang="${language}"]`);
          assert.equal(await page.locator('html').getAttribute('lang'), language);
          assert.ok(await block.isVisible(), `${station.id}: ${language} is missing`);
          assert.equal(await panel.locator(`.qin-guide .about-text[lang="${other}"]`).isVisible(), false);
          assert.equal(await panel.locator('.qin-guide .about-text:visible').count(), 1);
          assert.equal(await panel.locator('#panelTitle').textContent(), await page.locator(`#pages [data-station="${station.id}"] h2`).textContent());
          if (story) assert.ok((await block.innerText()).includes(language === 'en' ? story.en : story.zh));
          await activate(block.locator('p').first());
          assert.ok(await panel.isVisible(), 'Reading or selecting text must not dismiss the card');
          await block.locator('p').last().scrollIntoViewIfNeeded();
          const layout = await panel.evaluate(panel => {
            const body = panel.querySelector('.body'), guide = panel.querySelector('.qin-guide');
            const bounds = panel.getBoundingClientRect(), style = getComputedStyle(guide);
            const active = [...guide.querySelectorAll('.about-text')].find(block => getComputedStyle(block).display !== 'none');
            const last = active.lastElementChild.getBoundingClientRect(), viewport = body.getBoundingClientRect();
            const luminance = color => {
              const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => Number(value) / 255)
                .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
              return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
            };
            const ink = luminance(getComputedStyle(active.querySelector('p')).color), fill = luminance(style.backgroundColor);
            return {
              fits: bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.top >= 0 && bounds.bottom <= innerHeight + 1,
              noOverflow: guide.scrollWidth <= guide.clientWidth + 1 && body.scrollWidth <= body.clientWidth + 1,
              background: style.backgroundColor, frame: style.borderImageSource !== 'none',
              contrast: (Math.max(ink, fill) + 0.05) / (Math.min(ink, fill) + 0.05),
              endReachable: last.bottom <= viewport.bottom + 1 && last.bottom > viewport.top,
              scrollable: body.scrollHeight > body.clientHeight,
            };
          });
          assert.ok(layout.fits && layout.noOverflow && layout.endReachable, `${station.id}: ${JSON.stringify(layout)}`);
          assert.ok(layout.frame && layout.background !== 'rgba(0, 0, 0, 0)' && layout.contrast >= 4.5, `${station.id}: unreadable panel ${JSON.stringify(layout)}`);
          await panel.locator('.body').evaluate(body => { body.scrollTop = 0; });
          if (story) await page.screenshot({ path: fileURLToPath(new URL(`qin-guide-${station.id}-${language}-${time}-${view.name}.png`, output)) });
          checks.push({ id: station.id, time, language, ...layout });
          await activate(panel.locator('.lang-switch'));
        }
        await activate(panel.locator('.close'));
        await page.waitForFunction(() => !document.querySelector('#panel').open && !document.body.classList.contains('reading'));
      }
    }
    await page.evaluate(() => __home.player.teleport(111, -30));
    await page.waitForFunction(() => document.querySelector('#prompt').hidden);
    const stats = await page.evaluate(() => __home.stats());
    assert.ok(stats.calls <= 60 && stats.triangles <= 200000 && stats.lights <= 2, JSON.stringify(stats));
    assert.deepEqual(errors, []);
    report.push({ view: view.name, checks, stats });
    console.log(`${view.name}: ${QIN_STATIONS.length} cards in both languages, day/night; ${Object.keys(stories).length} walking/F-or-touch targets; opaque frames, contrast, text clicks, scrolling and close passed; ${stats.calls} calls, ${stats.triangles} triangles`);
    await context.close();
  }
  writeFileSync(new URL('qin-guides-report.json', output), JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
