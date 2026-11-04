// A small in-world piano for stations that opt into `data-piano`.
// It uses the browser's Web Audio API so the world does not need a second app
// bundle or a remote audio service just to let visitors play a few notes.

import { pianoMusic } from './piano-music.js';

const WHITE_NOTE_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const WHITE_KEYS = Array.from({ length: 24 }, (_, index) => ({
  note: `${WHITE_NOTE_NAMES[index % 7]}${3 + Math.floor(index / 7)}`,
  jian: String((index % 7) + 1),
}));

const BLACK_KEYS = [];
for (let octave = 3; octave <= 6; octave++) {
  const offset = (octave - 3) * 7;
  for (const [name, jian, after] of [['C#', '#1', 0], ['D#', '#2', 1], ['F#', '#4', 3], ['G#', '#5', 4], ['A#', '#6', 5]]) {
    if (offset + after < WHITE_KEYS.length - 1) BLACK_KEYS.push({ note: `${name}${octave}`, jian, after: offset + after });
  }
}

const KEYBOARD_MAP = new Map([
  ['z', 'C3'], ['1', 'C#3'], ['x', 'D3'], ['2', 'D#3'], ['c', 'E3'], ['v', 'F3'],
  ['3', 'F#3'], ['b', 'G3'], ['4', 'G#3'], ['n', 'A3'], ['5', 'A#3'], ['m', 'B3'],
  ['a', 'C4'], ['w', 'C#4'], ['s', 'D4'], ['e', 'D#4'], ['d', 'E4'], ['f', 'F4'],
  ['t', 'F#4'], ['g', 'G4'], ['y', 'G#4'], ['h', 'A4'], ['u', 'A#4'], ['j', 'B4'],
  ['k', 'C5'], ['o', 'C#5'], ['l', 'D5'], ['p', 'D#5'], [';', 'E5'], ["'", 'F5'],
  ['q', 'G5'], ['6', 'F#5'], ['r', 'A5'], ['7', 'G#5'], ['i', 'B5'], ['8', 'A#5'],
  ['[', 'C6'], ['9', 'C#6'], [']', 'D6'], ['0', 'D#6'], ['\\', 'E6'],
]);
const NOTE_KEY_LABELS = new Map([...KEYBOARD_MAP].map(([key, note]) => [note, key.toUpperCase()]));

const SONGS = [
  {
    id: 'star', title: '小星星', en: 'Twinkle Twinkle Little Star', bpm: 96,
    bars: [
      [['1', 'C4'], ['1', 'C4'], ['5', 'G4'], ['5', 'G4']],
      [['6', 'A4'], ['6', 'A4'], ['5', 'G4', 2]],
      [['4', 'F4'], ['4', 'F4'], ['3', 'E4'], ['3', 'E4']],
      [['2', 'D4'], ['2', 'D4'], ['1', 'C4', 2]],
      [['4', 'F4'], ['4', 'F4'], ['3', 'E4'], ['3', 'E4']],
      [['2', 'D4'], ['2', 'D4'], ['1', 'C4', 2]],
      [['5', 'G4'], ['5', 'G4'], ['4', 'F4'], ['4', 'F4']],
      [['3', 'E4'], ['3', 'E4'], ['2', 'D4', 2]],
      [['5', 'G4'], ['5', 'G4'], ['4', 'F4'], ['4', 'F4']],
      [['3', 'E4'], ['3', 'E4'], ['2', 'D4', 2]],
      [['1', 'C4'], ['1', 'C4'], ['5', 'G4'], ['5', 'G4']],
      [['6', 'A4'], ['6', 'A4'], ['5', 'G4', 2]],
    ],
  },
  {
    id: 'ode', title: '欢乐颂', en: 'Ode to Joy', bpm: 104,
    bars: [
      [['3', 'E4'], ['3', 'E4'], ['4', 'F4'], ['5', 'G4']],
      [['5', 'G4'], ['4', 'F4'], ['3', 'E4'], ['2', 'D4']],
      [['1', 'C4'], ['1', 'C4'], ['2', 'D4'], ['3', 'E4']],
      [['3', 'E4', 2], ['2', 'D4', 2]],
      [['3', 'E4'], ['3', 'E4'], ['4', 'F4'], ['5', 'G4']],
      [['5', 'G4'], ['4', 'F4'], ['3', 'E4'], ['2', 'D4']],
      [['1', 'C4'], ['1', 'C4'], ['2', 'D4'], ['3', 'E4']],
      [['3', 'E4', 2], ['2', 'D4', 2]],
      [['2', 'D4'], ['2', 'D4'], ['3', 'E4'], ['4', 'F4']],
      [['4', 'F4', 2], ['3', 'E4', 2]],
      [['3', 'E4'], ['3', 'E4'], ['2', 'D4'], ['1', 'C4']],
      [['1', 'C4', 4]],
    ],
  },
  {
    id: 'scale', title: '上行音阶', en: 'C Major Scale', bpm: 112,
    bars: [
      [['1', 'C4'], ['2', 'D4'], ['3', 'E4'], ['4', 'F4']],
      [['5', 'G4'], ['6', 'A4'], ['7', 'B4'], ['1', 'C5', 2]],
      [['1', 'C5'], ['7', 'B4'], ['6', 'A4'], ['5', 'G4']],
      [['4', 'F4'], ['3', 'E4'], ['2', 'D4'], ['1', 'C4', 2]],
      [['1', 'C4'], ['2', 'D4'], ['3', 'E4'], ['4', 'F4']],
      [['5', 'G4'], ['6', 'A4'], ['7', 'B4'], ['1', 'C5', 2]],
      [['1', 'C5'], ['7', 'B4'], ['6', 'A4'], ['5', 'G4']],
      [['4', 'F4'], ['3', 'E4'], ['2', 'D4'], ['1', 'C4', 2]],
      [['1', 'C4'], ['2', 'D4'], ['3', 'E4'], ['4', 'F4']],
      [['5', 'G4'], ['6', 'A4'], ['7', 'B4'], ['1', 'C5', 2]],
      [['1', 'C5'], ['7', 'B4'], ['6', 'A4'], ['5', 'G4']],
      [['4', 'F4'], ['3', 'E4'], ['2', 'D4'], ['1', 'C4', 2]],
    ],
  },
];

const BUNDLED_SONG_SOURCES = [
  { url: new URL('../../assets/piano/小霞-向云端.json', import.meta.url), artist: '小霞' },
  { url: new URL('../../assets/piano/韩小欠-苹果香.json', import.meta.url), artist: '韩小欠' },
  { url: new URL('../../assets/piano/齐旦布-游牧时光.json', import.meta.url), artist: '齐旦布' },
];

const KEY_PITCHES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const SCALE_OFFSETS = [0, 2, 4, 5, 7, 9, 11];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function bundledNote(tone, octave, key, accidentalMode) {
  if (!tone) return null;
  const tonic = KEY_PITCHES[key] ?? 0;
  let midi = 60 + tonic + SCALE_OFFSETS[Math.max(1, Math.min(7, tone)) - 1] + (octave || 0) * 12;
  if (accidentalMode === 1) midi += 1;
  if (accidentalMode === 2) midi -= 1;
  if (accidentalMode === 3) midi = 60 + tone - 1 + (octave || 0) * 12;
  const pitch = ((midi % 12) + 12) % 12;
  return `${NOTE_NAMES[pitch]}${Math.floor(midi / 12) - 1}`;
}

function bundledLabel(note) {
  if (!note.tone) return '0';
  const accidental = note.accidentalMode === 1 ? '#' : note.accidentalMode === 2 ? 'b' : '';
  return `${accidental}${note.tone}`;
}

function normalizeBundledSong(data, artist) {
  const track = data.tracks?.find(item => item.trackType === 'jp') || data.tracks?.[0];
  const bars = [];
  let bar = [];
  for (const voice of track?.voices || []) {
    if (voice.type === 'barLine') {
      if (bar.length) bars.push(bar);
      bar = [];
      continue;
    }
    if (voice.type !== 'beat' || !voice.notes?.length) continue;
    const duration = Math.max(1, Number(voice.duration) || 4);
    const dots = Math.max(0, Math.min(2, Number(voice.dot) || 0));
    const count = Math.max(1, Number(voice.beatCount) || 1);
    const beats = Math.max(0.125, 4 / duration) * count * (2 - Math.pow(2, -dots));
    const note = voice.notes[0];
    bar.push([
      bundledLabel(note),
      bundledNote(note.tone, note.octave, data.key, note.accidentalMode),
      beats,
      { octave: note.octave || 0, duration, dots, lyrics: voice.lyrics?.join('') || '', tie: !!voice.tieStart },
    ]);
  }
  if (bar.length) bars.push(bar);
  return {
    id: `bundled-${artist}`,
    title: data.title || artist,
    en: artist,
    bpm: Math.max(40, Math.round(Number(data.tempo) || 80)),
    key: data.key || 'C',
    meter: data.timeSignature?.map(time => `${time.numerator}/${time.denominator}`).join(' · ') || '4/4',
    subtitle: data.subTitle || artist,
    bars,
  };
}

const frequency = note => {
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) return 440;
  const semitone = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[match[1]] + (match[2] ? 1 : 0);
  const midi = (Number(match[3]) + 1) * 12 + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export function createPiano(body) {
  const root = body.querySelector('[data-piano-app]');
  if (!root) return () => {};

  root.innerHTML = `
    <div class="piano-toolbar">
      <label class="piano-select-label">曲谱
        <select data-piano-song aria-label="选择曲谱"></select>
      </label>
      <button class="piano-button practice" type="button" data-piano-practice aria-pressed="false">练习模式</button>
      <button class="piano-button" type="button" data-piano-play>播放</button>
      <button class="piano-button secondary" type="button" data-piano-stop>停止</button>
    </div>
    <div class="piano-background-controls">
      <label class="piano-background-toggle"><input type="checkbox" data-piano-background>背景音乐 · 自动循环</label>
      <label class="piano-volume-label">音量 <input type="range" min="0" max="100" step="5" data-piano-volume aria-label="背景音乐音量"></label>
      <small>默认关闭；开启后，关闭面板或离开钢琴仍会继续播放。</small>
    </div>
    <div class="piano-meta"><span>数字简谱</span><span data-piano-position></span></div>
    <div class="piano-score" data-piano-score tabindex="0" role="region" aria-label="简谱，可滚动查看">
      <div class="piano-sheet-header">
        <h3 data-piano-title></h3>
        <p data-piano-subtitle></p>
        <div class="piano-sheet-meta"><span data-piano-signature></span><span data-piano-tempo></span></div>
      </div>
      <div class="piano-staves" data-piano-staves></div>
      <p class="piano-score-end" aria-hidden="true">— 终 —</p>
    </div>
    <div class="piano-keyboard" data-piano-keyboard aria-label="钢琴键盘"></div>
    <p class="piano-practice-status" data-piano-practice-status aria-live="polite"></p>
    <p class="piano-help">点击琴键演奏，电脑端可按琴键上方提示的按键。</p>
  `;

  const select = root.querySelector('[data-piano-song]');
  const playButton = root.querySelector('[data-piano-play]');
  const practiceButton = root.querySelector('[data-piano-practice]');
  const stopButton = root.querySelector('[data-piano-stop]');
  const backgroundInput = root.querySelector('[data-piano-background]');
  const volumeInput = root.querySelector('[data-piano-volume]');
  const titleEl = root.querySelector('[data-piano-title]');
  const subtitleEl = root.querySelector('[data-piano-subtitle]');
  const signatureEl = root.querySelector('[data-piano-signature]');
  const positionEl = root.querySelector('[data-piano-position]');
  const stavesEl = root.querySelector('[data-piano-staves]');
  const tempoEl = root.querySelector('[data-piano-tempo]');
  const scoreEl = root.querySelector('[data-piano-score]');
  const keyboardEl = root.querySelector('[data-piano-keyboard]');
  const practiceStatusEl = root.querySelector('[data-piano-practice-status]');
  const keyEls = new Map();
  const activeCounts = new Map();
  const voices = new Set();
  const timers = new Set();
  const pressed = new Set();
  let audio = null;
  const currentSong = pianoMusic.state.song;
  let songs = currentSong && !SONGS.some(song => song.id === currentSong.id) ? [currentSong, ...SONGS] : SONGS;
  let selected = currentSong || songs[0];
  let playing = false;
  let playIndex = -1;
  let disposed = false;
  let playbackNote = null;
  let practiceMode = false;
  let practiceIndex = 0;
  let scoreNotes = [];
  let highlightedNote = null;

  const renderSongOptions = () => {
    select.replaceChildren();
    for (const song of songs) {
      const option = document.createElement('option');
      option.value = song.id;
      option.textContent = `${song.title} / ${song.en}`;
      select.append(option);
    }
    select.value = selected.id;
  };

  const keyElement = (item, kind) => {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = `piano-key ${kind}`;
    key.dataset.note = item.note;
    key.setAttribute('aria-label', `${item.note} ${item.jian}`);
    key.title = `${item.note} · ${item.jian}`;
    const label = document.createElement('span');
    label.textContent = item.jian;
    key.append(label);
    const shortcut = NOTE_KEY_LABELS.get(item.note);
    if (shortcut) {
      const shortcutLabel = document.createElement('small');
      shortcutLabel.className = 'piano-key-shortcut';
      shortcutLabel.textContent = shortcut;
      shortcutLabel.setAttribute('aria-hidden', 'true');
      key.append(shortcutLabel);
    }
    keyboardEl.append(key);
    keyEls.set(item.note, key);
    return key;
  };
  WHITE_KEYS.forEach(item => keyElement(item, 'white'));
  BLACK_KEYS.forEach(item => {
    const key = keyElement(item, 'black');
    key.style.left = `${((item.after + 1) / WHITE_KEYS.length) * 100}%`;
  });

  const setActive = (note, active) => {
    const count = Math.max(0, (activeCounts.get(note) || 0) + (active ? 1 : -1));
    activeCounts.set(note, count);
    keyEls.get(note)?.classList.toggle('active', count > 0);
  };

  const getAudio = async () => {
    if (!audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      audio = new AudioContext();
    }
    if (audio.state === 'suspended') await audio.resume();
    return audio;
  };

  const startVoice = async note => {
    if (!note) return null;
    const context = await getAudio();
    if (!context || disposed) return null;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = frequency(note);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    const voice = { oscillator, gain, released: false, note };
    voices.add(voice);
    setActive(note, true);
    return voice;
  };

  const stopVoice = voice => {
    if (!voice || voice.released) return;
    voice.released = true;
    const now = audio?.currentTime || 0;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.045);
    voice.oscillator.stop(now + 0.18);
    voices.delete(voice);
    setActive(voice.note, false);
  };

  const playNote = note => {
    const voicePromise = startVoice(note);
    voicePromise?.then(voice => {
      if (!voice) return;
      const timer = setTimeout(() => { timers.delete(timer); stopVoice(voice); }, 520);
      timers.add(timer);
    });
  };

  const notationFor = ([jian, note, beats = 1, notation = {}]) => ({
    octave: notation.octave ?? (note ? Number(note.at(-1)) - 4 : 0),
    beams: Math.max(0, Math.min(3, Math.round(Math.log2((notation.duration || 4 / Math.min(1, beats)) / 4)))),
    dashes: Math.max(0, Math.floor(beats) - 1),
    dots: notation.dots || 0,
    lyrics: notation.lyrics || '',
    tie: notation.tie || false,
    accidental: jian.startsWith('#') ? '♯' : jian.startsWith('b') ? '♭' : '',
    numeral: jian.replace(/^[#b]/, ''),
  });

  const scoreLines = () => {
    const mobile = window.matchMedia('(max-width: 600px)').matches;
    const available = stavesEl.clientWidth || Math.max(200, window.innerWidth - (mobile ? 64 : 120));
    const slot = mobile ? 24 : 32;
    const lines = [];
    let line = [];
    let lineWidth = 0;
    selected.bars.forEach((bar, measure) => {
      const units = bar.reduce((sum, item) => sum + 1 + notationFor(item).dashes, 0);
      const width = units * slot + (mobile ? 16 : 24);
      if (line.length && (lineWidth + width > available || line.length === 4)) {
        lines.push(line);
        line = [];
        lineWidth = 0;
      }
      line.push({ bar, measure, units });
      lineWidth += width;
    });
    if (line.length) lines.push(line);
    return lines;
  };

  const scoreNote = (data, index) => {
    const [jian, note, beats = 1] = data;
    const notation = notationFor(data);
    const item = document.createElement('span');
    item.className = 'piano-note';
    item.dataset.index = index;
    item.dataset.note = note || '';
    item.style.flexGrow = String(1 + notation.dashes);
    item.setAttribute('aria-label', `${jian}，${beats}拍${notation.lyrics ? `，${notation.lyrics}` : ''}`);
    const event = document.createElement('span');
    event.className = 'piano-event';
    const tone = document.createElement('span');
    tone.className = 'piano-tone';
    const high = document.createElement('span');
    high.className = 'piano-octave high';
    high.textContent = note && notation.octave > 0 ? '•'.repeat(notation.octave) : '';
    const number = document.createElement('span');
    number.className = 'piano-number';
    if (notation.accidental) {
      const accidental = document.createElement('small');
      accidental.className = 'piano-accidental';
      accidental.textContent = notation.accidental;
      number.append(accidental);
    }
    const glyph = document.createElement('span');
    glyph.className = 'piano-numeral';
    glyph.textContent = notation.numeral;
    number.append(glyph);
    if (notation.dots) {
      const dots = document.createElement('small');
      dots.className = 'piano-augmentation';
      dots.textContent = '·'.repeat(notation.dots);
      number.append(dots);
    }
    const rhythm = document.createElement('span');
    rhythm.className = 'piano-rhythm';
    for (let beam = 0; beam < notation.beams; beam++) rhythm.append(document.createElement('i'));
    const low = document.createElement('span');
    low.className = 'piano-octave low';
    low.textContent = note && notation.octave < 0 ? '•'.repeat(-notation.octave) : '';
    tone.append(high, number, rhythm, low);
    event.append(tone);
    for (let dash = 0; dash < notation.dashes; dash++) {
      const sustain = document.createElement('span');
      sustain.className = 'piano-sustain';
      sustain.textContent = '−';
      event.append(sustain);
    }
    const lyrics = document.createElement('span');
    lyrics.className = 'piano-lyrics';
    lyrics.textContent = notation.lyrics;
    const cursor = document.createElement('i');
    cursor.className = 'piano-cursor';
    cursor.setAttribute('aria-hidden', 'true');
    tone.append(cursor);
    item.append(event, lyrics);
    if (notation.tie) {
      const tie = document.createElement('i');
      tie.className = 'piano-tie';
      tie.setAttribute('aria-hidden', 'true');
      item.append(tie);
    }
    return item;
  };

  const renderScore = () => {
    titleEl.textContent = selected.title;
    subtitleEl.textContent = selected.subtitle || selected.en;
    signatureEl.textContent = `1 = ${(selected.key || 'C').replace('b', '♭').replace('#', '♯')}    ${selected.meter || '4/4'}`;
    tempoEl.textContent = `♩ = ${selected.bpm}`;
    stavesEl.replaceChildren();
    scoreNotes = [];
    let index = 0;
    for (const bars of scoreLines()) {
      const line = document.createElement('div');
      line.className = 'piano-score-line';
      for (const { bar, measure: measureIndex, units } of bars) {
        const measure = document.createElement('div');
        measure.className = 'piano-measure';
        measure.dataset.measure = measureIndex + 1;
        measure.style.flexGrow = String(units);
        if (bar.some(item => notationFor(item).lyrics)) line.classList.add('has-lyrics');
        const count = document.createElement('span');
        count.className = 'piano-measure-number';
        count.textContent = String(measureIndex + 1).padStart(2, '0');
        count.setAttribute('aria-hidden', 'true');
        measure.append(count);
        for (const data of bar) {
          const item = scoreNote(data, index++);
          scoreNotes.push(item);
          measure.append(item);
        }
        line.append(measure);
      }
      stavesEl.append(line);
    }
    scoreEl.scrollTop = 0;
    highlightScore(practiceMode ? practiceIndex : playing ? playIndex : -1);
  };

  const flatten = () => selected.bars.flatMap(bar => bar.map(([jian, note, beats = 1]) => ({ jian, note, beats })));
  const highlightScore = index => {
    if (highlightedNote) {
      highlightedNote.classList.remove('active', 'cursor');
      highlightedNote.removeAttribute('aria-current');
    }
    highlightedNote = scoreNotes[index] || null;
    positionEl.textContent = `共 ${selected.bars.length} 小节`;
    if (!highlightedNote) return;
    highlightedNote.classList.add('active', 'cursor');
    highlightedNote.setAttribute('aria-current', 'true');
    const line = highlightedNote.closest('.piano-score-line');
    const bounds = scoreEl.getBoundingClientRect();
    const row = line.getBoundingClientRect();
    if (row.top < bounds.top + 12) scoreEl.scrollTop += row.top - bounds.top - 12;
    else if (row.bottom > bounds.bottom - 12) scoreEl.scrollTop += row.bottom - bounds.bottom + 12;
    positionEl.textContent = `第 ${highlightedNote.closest('.piano-measure').dataset.measure} 小节 / 共 ${selected.bars.length} 小节`;
  };

  const syncPracticeTarget = () => {
    const notes = flatten();
    while (practiceIndex < notes.length && !notes[practiceIndex].note) practiceIndex++;
    keyEls.forEach(key => key.classList.remove('practice-target'));
    if (practiceIndex >= notes.length) {
      highlightScore(-1);
      practiceStatusEl.textContent = '练习完成';
      return;
    }
    const target = notes[practiceIndex];
    keyEls.get(target.note)?.classList.add('practice-target');
    highlightScore(practiceIndex);
    practiceStatusEl.textContent = `请按 ${target.jian}，当前音符 ${target.note}`;
  };

  const checkPracticeNote = note => {
    if (!practiceMode) return;
    const notes = flatten();
    while (practiceIndex < notes.length && !notes[practiceIndex].note) practiceIndex++;
    if (practiceIndex >= notes.length) return;
    if (notes[practiceIndex].note !== note) {
      practiceStatusEl.textContent = `再试一次：请按 ${notes[practiceIndex].jian}`;
      return;
    }
    practiceIndex++;
    syncPracticeTarget();
  };

  const stopSong = () => {
    pianoMusic.stop();
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    voices.forEach(stopVoice);
    highlightScore(practiceMode ? practiceIndex : -1);
  };

  const syncPlayback = state => {
    if (playbackNote) setActive(playbackNote, false);
    playbackNote = state.song?.id === selected.id ? state.note : null;
    if (playbackNote) setActive(playbackNote, true);
    playing = state.playing && state.song?.id === selected.id;
    playIndex = state.index;
    backgroundInput.checked = state.background;
    volumeInput.value = String(Math.round(state.volume * 100));
    playButton.textContent = playing ? '暂停' : '播放';
    if (!practiceMode) {
      highlightScore(playing ? playIndex : -1);
      practiceStatusEl.textContent = state.error;
    }
  };

  const onSelect = () => {
    const background = pianoMusic.state.background;
    stopSong();
    selected = songs.find(song => song.id === select.value) || songs[0];
    practiceIndex = 0;
    renderScore();
    if (practiceMode) syncPracticeTarget();
    else if (background) void pianoMusic.setBackground(true, selected);
  };
  const onPlay = () => { if (playing) pianoMusic.pause(); else void pianoMusic.play(selected); };
  const onStop = () => stopSong();
  const onBackground = () => {
    const enabled = backgroundInput.checked;
    if (practiceMode) onPractice();
    void pianoMusic.setBackground(enabled, selected);
  };
  const onVolume = () => pianoMusic.setVolume(Number(volumeInput.value) / 100);
  const onPractice = () => {
    if (practiceMode) {
      practiceMode = false;
      practiceIndex = 0;
      practiceButton.setAttribute('aria-pressed', 'false');
      practiceButton.textContent = '练习模式';
      playButton.disabled = false;
      practiceStatusEl.textContent = '';
      keyEls.forEach(key => key.classList.remove('practice-target'));
      stopSong();
      return;
    }
    stopSong();
    practiceMode = true;
    practiceIndex = 0;
    practiceButton.setAttribute('aria-pressed', 'true');
    practiceButton.textContent = '退出练习';
    playButton.disabled = true;
    syncPracticeTarget();
  };
  const onKeyDown = event => {
    if (event.target.closest('input, select, textarea')) return;
    const note = KEYBOARD_MAP.get(event.key.toLowerCase());
    if (!note || event.repeat || pressed.has(note)) return;
    pressed.add(note);
    event.preventDefault();
    playNote(note);
    checkPracticeNote(note);
  };
  const onKeyUp = event => {
    const note = KEYBOARD_MAP.get(event.key.toLowerCase());
    if (note) pressed.delete(note);
  };

  for (const key of keyboardEl.querySelectorAll('.piano-key')) {
    const note = key.dataset.note;
    let voice = null;
    let held = false;
    key.addEventListener('pointerdown', event => {
      event.preventDefault();
      held = true;
      key.setPointerCapture?.(event.pointerId);
      checkPracticeNote(note);
      startVoice(note).then(value => {
        voice = value;
        if (!held) { stopVoice(voice); voice = null; }
      });
    });
    const release = () => { held = false; stopVoice(voice); voice = null; };
    key.addEventListener('pointerup', release);
    key.addEventListener('pointercancel', release);
    key.addEventListener('pointerleave', release);
  }
  select.addEventListener('change', onSelect);
  playButton.addEventListener('click', onPlay);
  practiceButton.addEventListener('click', onPractice);
  stopButton.addEventListener('click', onStop);
  backgroundInput.addEventListener('change', onBackground);
  volumeInput.addEventListener('input', onVolume);
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  let lastScoreWidth = 0;
  const onResize = () => {
    if (!scoreEl.isConnected || !scoreEl.clientWidth || scoreEl.clientWidth === lastScoreWidth) return;
    lastScoreWidth = scoreEl.clientWidth;
    renderScore();
  };
  window.addEventListener('resize', onResize);
  renderSongOptions();
  renderScore();
  const unsubscribe = pianoMusic.subscribe(syncPlayback);
  requestAnimationFrame(onResize);

  void Promise.all(BUNDLED_SONG_SOURCES.map(async source => {
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Unable to load ${source.url}`);
    return normalizeBundledSong(await response.json(), source.artist);
  })).then(loaded => {
    if (disposed || !loaded.length || !loaded.some(song => song.bars.length)) return;
    const backgroundSong = pianoMusic.state.background && pianoMusic.state.song;
    if (!backgroundSong) stopSong();
    songs = backgroundSong && !loaded.some(song => song.id === backgroundSong.id) ? [backgroundSong, ...loaded] : loaded;
    selected = songs.find(song => song.id === backgroundSong?.id) || songs[0];
    practiceIndex = 0;
    renderSongOptions();
    renderScore();
    if (practiceMode) syncPracticeTarget();
    else syncPlayback(pianoMusic.state);
  }).catch(() => {
    // The small fallback songs keep the piano usable if a static asset is missing.
  });

  return () => {
    disposed = true;
    unsubscribe();
    if (!pianoMusic.state.background) pianoMusic.stop();
    timers.forEach(timer => clearTimeout(timer));
    timers.clear();
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    window.removeEventListener('resize', onResize);
    practiceButton.removeEventListener('click', onPractice);
    select.removeEventListener('change', onSelect);
    playButton.removeEventListener('click', onPlay);
    stopButton.removeEventListener('click', onStop);
    backgroundInput.removeEventListener('change', onBackground);
    volumeInput.removeEventListener('input', onVolume);
    voices.forEach(stopVoice);
    if (audio) { void audio.close(); audio = null; }
  };
}
