const listeners = new Set();
const voices = new Set();
let audio = null, bus = null, timer = null, dock = null;
let song = null, notes = [], index = -1, nextIndex = 0, run = 0;
let playing = false, background = false, volume = 0.25, error = '';

const snapshot = () => ({ song, index, note: playing ? notes[index]?.note || null : null, playing, background, volume, error });
const emit = () => { const state = snapshot(); listeners.forEach(listener => listener(state)); };

function ensureAudio() {
  if (audio) return audio;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('Audio unavailable');
  audio = new AudioContext();
  bus = audio.createGain();
  bus.gain.value = volume;
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2800;
  bus.connect(filter).connect(audio.destination);
  return audio;
}

function clearPlayback() {
  run++;
  clearTimeout(timer);
  timer = null;
  for (const voice of voices) {
    voice.oscillator.onended = null;
    voice.oscillator.stop();
    voice.oscillator.disconnect();
    voice.gain.disconnect();
  }
  voices.clear();
}

function syncDock() {
  if (!dock && background) {
    dock = document.createElement('aside');
    dock.className = 'piano-music gui';
    dock.setAttribute('aria-label', '背景音乐');
    dock.innerHTML = `<span class="piano-music-icon" aria-hidden="true">♫</span>
      <div class="piano-music-info"><b></b><small>钢琴背景音乐 · 循环</small></div>
      <button type="button" class="mc-button" data-music-pause>暂停</button>
      <button type="button" class="mc-button" data-music-off aria-label="关闭背景音乐">关闭</button>`;
    dock.querySelector('[data-music-pause]').addEventListener('click', () => { if (playing) pause(); else void play(song); });
    dock.querySelector('[data-music-off]').addEventListener('click', stop);
    (document.querySelector('#hud') || document.body).append(dock);
  }
  if (!dock) return;
  dock.hidden = !background;
  if (!background) return;
  dock.querySelector('b').textContent = song?.title || '钢琴';
  dock.querySelector('[data-music-pause]').textContent = playing ? '暂停' : '继续';
}

function soundNote(note, duration) {
  if (!note) return;
  const match = /^([A-G])(#?)(\d)$/.exec(note);
  if (!match) return;
  const semitone = ({ C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 })[match[1]] + (match[2] ? 1 : 0);
  const midi = (Number(match[3]) + 1) * 12 + semitone;
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  const seconds = Math.max(0.04, duration / 1000);
  oscillator.type = 'triangle';
  oscillator.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.22, now + Math.min(0.012, seconds * 0.15));
  gain.gain.exponentialRampToValueAtTime(0.055, now + seconds * 0.65);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds * 0.96);
  oscillator.connect(gain).connect(bus);
  const voice = { oscillator, gain };
  voices.add(voice);
  oscillator.onended = () => {
    voices.delete(voice);
    oscillator.disconnect();
    gain.disconnect();
  };
  oscillator.start(now);
  oscillator.stop(now + seconds);
}

function advance(token) {
  if (!playing || token !== run) return;
  if (nextIndex >= notes.length) {
    if (!background) { stop(); return; }
    nextIndex = 0;
  }
  index = nextIndex++;
  const item = notes[index];
  const duration = 60000 / song.bpm * item.beats;
  soundNote(item.note, duration);
  emit();
  timer = setTimeout(() => advance(token), duration);
}

async function play(selected = song) {
  if (!selected?.bars?.length) return;
  if (playing && selected.id === song?.id) { syncDock(); emit(); return; }
  clearPlayback();
  if (selected.id !== song?.id) {
    song = selected;
    notes = song.bars.flatMap(bar => bar.map(([, note, beats = 1]) => ({ note, beats })));
    index = -1;
    nextIndex = 0;
  }
  const token = run;
  try {
    const context = ensureAudio();
    playing = true;
    error = '';
    syncDock();
    emit();
    if (context.state === 'suspended') await context.resume();
    if (token !== run || !playing) return;
    advance(token);
  } catch {
    if (token !== run) return;
    stop();
    error = '音频暂不可用，请检查浏览器的声音权限后重试。';
    emit();
  }
}

function pause() {
  clearPlayback();
  playing = false;
  nextIndex = Math.max(0, index);
  syncDock();
  emit();
}

function stop() {
  clearPlayback();
  playing = false;
  background = false;
  index = -1;
  nextIndex = 0;
  error = '';
  syncDock();
  emit();
}

export const pianoMusic = {
  get state() { return snapshot(); },
  play, pause, stop,
  setBackground(on, selected = song) {
    if (!on) { stop(); return; }
    background = true;
    return play(selected);
  },
  setVolume(value) {
    if (!Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(1, value));
    if (bus) bus.gain.setTargetAtTime(volume, audio.currentTime, 0.02);
    emit();
  },
  subscribe(listener) {
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
  },
};
