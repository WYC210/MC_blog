import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const base = process.argv[2] || readFileSync(new URL('./.serve-url', import.meta.url), 'utf8').trim();
const out = new URL('./.check/', import.meta.url);
mkdirSync(out, { recursive: true });
const sources = readdirSync(new URL('../assets/piano/', import.meta.url)).map(file => JSON.parse(readFileSync(new URL(`../assets/piano/${file}`, import.meta.url), 'utf8')));
const fixture = `<!doctype html><html lang="zh-CN"><meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="/engine/style.css">
  <body style="background:#30352d">
    <dialog id="panel" data-station="piano" open>
      <header><h2>钢琴</h2></header>
      <div class="body"><div class="piano-app" data-piano-app></div></div>
    </dialog>
    <script type="module">
      import { createPiano } from '/engine/ui/piano.js';
      window.disposePiano = createPiano(document.querySelector('.body'));
    </script>`;
const browser = await chromium.launch({ channel: 'chrome' }).catch(() => chromium.launch());

const assertCursorClear = async page => {
  const clear = await page.locator('.piano-note.active').evaluate(note => {
    const cursor = note.querySelector('.piano-cursor').getBoundingClientRect();
    const tone = note.querySelector('.piano-tone').getBoundingClientRect();
    const numeral = note.querySelector('.piano-numeral').getBoundingClientRect();
    return cursor.bottom <= tone.top && cursor.bottom < numeral.top;
  });
  assert.ok(clear, 'The playback marker overlaps the numeral or octave dots');
};

try {
  for (const view of [
    { name: 'desktop', viewport: { width: 1280, height: 960 } },
    { name: 'phone', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    { name: 'small-phone', viewport: { width: 320, height: 740 }, isMobile: true, hasTouch: true },
  ]) {
    const context = await browser.newContext({ ...view, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/__piano-check', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    await page.goto(new URL('/__piano-check', base).href);
    await page.waitForFunction(() => document.querySelector('[data-piano-song] option')?.value.startsWith('bundled-'));

    const options = await page.locator('[data-piano-song] option').evaluateAll(items => items.map(option => ({ value: option.value, title: option.textContent.split(' / ')[0] })));
    for (const option of options) {
      await page.selectOption('[data-piano-song]', option.value);
      const data = sources.find(source => source.title === option.title);
      const beats = data.tracks.find(track => track.trackType === 'jp').voices.filter(voice => voice.type === 'beat' && voice.notes?.length);
      const rendered = await page.locator('.piano-note').evaluateAll(notes => notes.map(note => ({
        label: note.getAttribute('aria-label'),
        beams: note.querySelectorAll('.piano-rhythm i').length,
        dashes: note.querySelectorAll('.piano-sustain').length,
        low: note.querySelector('.piano-octave.low').textContent,
        high: note.querySelector('.piano-octave.high').textContent,
        dots: note.querySelector('.piano-augmentation')?.textContent.length || 0,
        lyrics: note.querySelector('.piano-lyrics').textContent,
      })));
      assert.equal(rendered.length, beats.length, 'Sustained notes must not become repeated notes');
      beats.forEach((voice, index) => {
        const duration = Number(voice.duration) || 4;
        const dots = Number(voice.dot) || 0;
        const length = Math.max(0.125, 4 / duration) * (voice.beatCount || 1) * (2 - Math.pow(2, -dots));
        assert.equal(rendered[index].beams, Math.max(0, Math.min(3, Math.round(Math.log2(duration / 4)))));
        assert.equal(rendered[index].dashes, Math.max(0, Math.floor(length) - 1));
        assert.equal(rendered[index].dots, dots);
        assert.equal(rendered[index].lyrics, voice.lyrics?.join('') || '');
        const octave = voice.notes[0].octave || 0;
        assert.equal(rendered[index].low.length, octave < 0 && voice.notes[0].tone ? -octave : 0);
        assert.equal(rendered[index].high.length, octave > 0 && voice.notes[0].tone ? octave : 0);
      });
      assert.equal(await page.locator('.piano-note.active').count(), 0, 'Idle scores should not show a playback marker');
      const overflow = await page.locator('.piano-score').evaluate(score => score.scrollWidth > score.clientWidth);
      assert.equal(overflow, false, 'The score overflows horizontally');
      const cramped = await page.locator('.piano-measure').evaluateAll(measures => measures.some(measure => {
        const numbers = [...measure.querySelectorAll('.piano-number')];
        return numbers.slice(1).some((number, index) => number.getBoundingClientRect().left < numbers[index].getBoundingClientRect().right + 2);
      }));
      assert.equal(cramped, false, 'Adjacent notes or accidentals collide');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }

    await page.selectOption('[data-piano-song]', options[0].value);
    await page.screenshot({ path: fileURLToPath(new URL(`piano-sheet-${view.name}.png`, out)) });
    await page.locator('[data-piano-play]').click();
    await page.waitForFunction(() => Number(document.querySelector('.piano-note.active')?.dataset.index) >= 1);
    await assertCursorClear(page);
    await page.locator('[data-piano-stop]').click();
    assert.equal(await page.locator('.piano-note.active').count(), 0);
    await page.locator('[data-piano-practice]').click();
    await assertCursorClear(page);
    const before = await page.locator('.piano-note.active').getAttribute('data-index');
    const wrong = await page.locator('.piano-note.active').evaluate(note => [...document.querySelectorAll('.piano-key')].find(key => key.dataset.note !== note.dataset.note).dataset.note);
    const wrongKey = page.locator(`.piano-key[data-note="${wrong}"]`);
    const wrongBounds = await wrongKey.boundingBox();
    await wrongKey.click({ position: { x: wrongBounds.width / 2, y: wrongBounds.height * 0.85 } });
    assert.equal(await page.locator('.piano-note.active').getAttribute('data-index'), before, 'A wrong practice note advanced the score');
    const panelScrollBefore = await page.locator('#panel .body').evaluate(panel => panel.scrollTop);
    await page.evaluate(() => {
      for (let step = 0; step < 45; step++) {
        const target = document.querySelector('.piano-note.active');
        const key = [...document.querySelectorAll('.piano-key')].find(key => key.dataset.note === target.dataset.note);
        const shortcut = key.querySelector('.piano-key-shortcut').textContent.toLowerCase();
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: shortcut, bubbles: true }));
        document.body.dispatchEvent(new KeyboardEvent('keyup', { key: shortcut, bubbles: true }));
      }
    });
    await assertCursorClear(page);
    const scroll = await page.evaluate(() => ({ sheet: document.querySelector('.piano-score').scrollTop, panel: document.querySelector('#panel .body').scrollTop, window: scrollY }));
    assert.ok(scroll.sheet > 0, 'Following the music did not scroll the score');
    assert.equal(scroll.panel, panelScrollBefore, 'Following the music moved the outer panel');
    assert.equal(scroll.window, 0, 'Following the music moved the page');
    await page.screenshot({ path: fileURLToPath(new URL(`piano-sheet-practice-${view.name}.png`, out)) });
    const current = await page.locator('.piano-note.active').getAttribute('data-index');
    await page.setViewportSize({ width: view.viewport.width - 20, height: view.viewport.height });
    await page.waitForTimeout(150);
    assert.equal(await page.locator('.piano-note.active').getAttribute('data-index'), current, 'Resize lost the current note');
    await assertCursorClear(page);
    await page.evaluate(() => window.disposePiano());
    assert.deepEqual(errors, []);
    console.log(`${view.name}: notation, playback, practice, cursor clearance, contained scrolling and resize passed`);
    await context.close();
  }
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.route('**/__piano-check', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  const notation = {
    title: 'Notation', key: 'C', tempo: 120, timeSignature: [{ numerator: 4, denominator: 4 }],
    tracks: [{ trackType: 'jp', voices: [
      { type: 'beat', duration: 4, notes: [{ tone: 1, octave: 1 }] },
      { type: 'beat', duration: 4, notes: [{ tone: 2, octave: -1 }] },
      { type: 'beat', duration: 8, dot: 1, notes: [{ tone: 3, accidentalMode: 1 }] },
      { type: 'beat', duration: 4, beatCount: 4, notes: [{ tone: 4 }] },
      { type: 'barLine' },
    ] }],
  };
  await page.route('**/assets/piano/*.json', route => route.fulfill({ json: notation }));
  await page.goto(new URL('/__piano-check', base).href);
  await page.waitForFunction(() => document.querySelector('[data-piano-title]')?.textContent === 'Notation');
  assert.equal(await page.locator('.piano-octave.high').first().textContent(), '•');
  assert.equal(await page.locator('.piano-octave.low').nth(1).textContent(), '•');
  assert.equal(await page.locator('.piano-note').nth(2).locator('.piano-accidental').textContent(), '♯');
  assert.equal(await page.locator('.piano-note').nth(3).locator('.piano-sustain').count(), 3);
  await page.locator('[data-piano-practice]').click();
  await assertCursorClear(page);
  await page.evaluate(() => window.disposePiano());
  await page.unroute('**/assets/piano/*.json');
  await page.route('**/assets/piano/*.json', route => route.fulfill({ status: 404, body: '' }));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('[data-piano-song]')?.value === 'star');
  await page.selectOption('[data-piano-song]', 'scale');
  assert.ok((await page.locator('.piano-octave.high').allTextContents()).some(text => text === '•'));
  await page.locator('[data-piano-practice]').click();
  await assertCursorClear(page);
  await page.evaluate(() => window.disposePiano());
  await context.close();
  console.log('Upper/lower octaves, accidentals, sustained notes and unavailable-asset fallback passed');
  const musicContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await musicContext.addInitScript(() => {
    window.pianoAudioCount = 0;
    window.pianoOscillatorCount = 0;
    const NativeAudioContext = window.AudioContext;
    window.AudioContext = new Proxy(NativeAudioContext, {
      construct(target, args) {
        window.pianoAudioCount++;
        const audio = Reflect.construct(target, args);
        const createOscillator = audio.createOscillator.bind(audio);
        audio.createOscillator = () => { window.pianoOscillatorCount++; return createOscillator(); };
        return audio;
      },
    });
  });
  const musicPage = await musicContext.newPage();
  const musicErrors = [];
  musicPage.on('pageerror', error => musicErrors.push(error.message));
  await musicPage.route('**/__piano-check', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await musicPage.goto(new URL('/__piano-check', base).href);
  await musicPage.waitForFunction(() => document.querySelector('[data-piano-song] option')?.value.startsWith('bundled-'));
  const musicState = () => musicPage.evaluate(async () => (await import('/engine/ui/piano-music.js')).pianoMusic.state);
  const remount = () => musicPage.evaluate(async () => {
    const { createPiano } = await import('/engine/ui/piano.js');
    document.querySelector('#panel').open = true;
    window.disposePiano = createPiano(document.querySelector('#panel .body'));
    return { selected: document.querySelector('[data-piano-song]').value, background: document.querySelector('[data-piano-background]').checked };
  });
  const dispose = () => musicPage.evaluate(() => {
    window.disposePiano();
    document.querySelector('#panel').open = false;
  });
  assert.equal((await musicState()).background, false);
  assert.equal((await musicState()).playing, false);
  assert.equal(await musicPage.evaluate(() => window.pianoAudioCount), 0, 'Opening a piano must not create audio or autoplay');
  await musicPage.locator('[data-piano-play]').click();
  await musicPage.waitForFunction(async () => (await import('/engine/ui/piano-music.js')).pianoMusic.state.playing);
  await dispose();
  assert.equal((await musicState()).playing, false, 'Ordinary playback survived closing the piano');
  const oscillatorsBefore = await musicPage.evaluate(() => window.pianoOscillatorCount);
  await musicPage.keyboard.press('a');
  assert.equal(await musicPage.evaluate(() => window.pianoOscillatorCount), oscillatorsBefore, 'Disposed keyboard handlers still played notes');
  await remount();
  await musicPage.waitForFunction(() => document.querySelector('[data-piano-song] option')?.value.startsWith('bundled-'));
  await musicPage.locator('[data-piano-background]').check();
  const backgroundSongId = (await musicState()).song.id;
  await musicPage.locator('[data-piano-volume]').evaluate(input => {
    input.value = '35';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  assert.equal((await musicState()).volume, 0.35);
  await dispose();
  await musicPage.waitForFunction(async () => (await import('/engine/ui/piano-music.js')).pianoMusic.state.index > 0);
  assert.equal((await musicState()).background, true);
  assert.equal((await musicState()).playing, true, 'Background music stopped when the piano closed');
  assert.equal(await musicPage.locator('.piano-music').count(), 1);
  await musicPage.locator('[data-music-pause]').click();
  assert.equal((await musicState()).playing, false);
  assert.equal((await musicState()).background, true);
  await musicPage.locator('[data-music-pause]').click();
  assert.equal((await musicState()).playing, true);
  assert.deepEqual(await remount(), { selected: backgroundSongId, background: true }, 'Reopening the piano lost the current background song');
  await musicPage.waitForTimeout(250);
  assert.equal(await musicPage.locator('[data-piano-song]').inputValue(), backgroundSongId);
  assert.equal(await musicPage.locator('[data-piano-volume]').inputValue(), '35');
  assert.equal(await musicPage.evaluate(() => window.pianoAudioCount), 1, 'Reopening created a duplicate player');
  const otherSongId = await musicPage.locator('[data-piano-song] option').evaluateAll(options => options.find(option => option.value !== document.querySelector('[data-piano-song]').value).value);
  await musicPage.selectOption('[data-piano-song]', otherSongId);
  assert.equal((await musicState()).song.id, otherSongId);
  assert.equal((await musicState()).background, true);
  await musicPage.locator('[data-piano-practice]').click();
  assert.equal((await musicState()).background, false, 'Practice did not stop background music');
  assert.equal((await musicState()).playing, false);
  await dispose();
  await musicPage.evaluate(async () => {
    const { pianoMusic } = await import('/engine/ui/piano-music.js');
    window.pianoLoopStarts = 0;
    window.unsubscribeLoop = pianoMusic.subscribe(state => {
      if (state.playing && state.index === 0) window.pianoLoopStarts++;
    });
    await pianoMusic.setBackground(true, { id: 'loop-check', title: 'Loop', en: 'Loop', bpm: 600, bars: [[['1', 'C4', 0.25], ['2', 'D4', 0.25]]] });
  });
  await musicPage.waitForFunction(() => window.pianoLoopStarts >= 3);
  assert.equal((await musicState()).playing, true);
  await musicPage.locator('[data-music-off]').click();
  assert.equal((await musicState()).background, false);
  assert.equal((await musicState()).playing, false);
  await musicPage.evaluate(() => window.unsubscribeLoop());
  await musicPage.route('**/assets/piano/*.json', async route => {
    await new Promise(resolve => setTimeout(resolve, 900));
    await route.fulfill({ json: notation });
  });
  await musicPage.reload();
  await musicPage.waitForFunction(() => document.querySelector('[data-piano-song]')?.value === 'star');
  assert.equal((await musicState()).background, false, 'Refreshing re-enabled background music');
  assert.equal(await musicPage.evaluate(() => window.pianoAudioCount), 0);
  await musicPage.locator('[data-piano-background]').check();
  await musicPage.waitForFunction(() => document.querySelector('[data-piano-song] option[value^="bundled-"]'));
  assert.equal(await musicPage.locator('[data-piano-song]').inputValue(), 'star', 'Loading bundled songs replaced an active fallback song');
  assert.equal((await musicState()).song.id, 'star');
  await dispose();
  assert.deepEqual(await remount(), { selected: 'star', background: true });
  await musicPage.locator('[data-piano-stop]').click();
  assert.equal((await musicState()).background, false);
  await dispose();
  assert.deepEqual(musicErrors, []);
  await musicContext.close();
  console.log('Background music: default off, disposal, keyboard cleanup, persistence, reopen, volume, song changes, practice, loop, global controls, refresh and delayed assets passed');
} finally {
  await browser.close();
}
