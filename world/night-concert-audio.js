import { pianoMusic } from '@engine/ui/piano-music.js';

const MELODY = [72, 76, 79, 76, 74, 77, 81, 79, 76, 79, 84, 83, 81, 79, 76, 0, 74, 77, 79, 77, 72, 76, 79, 76, 69, 72, 77, 76, 74, 71, 72, 0];
const ANSWER = [67, 72, 76, 79, 69, 74, 77, 81, 72, 76, 79, 76, 69, 72, 76, 0, 67, 71, 74, 77, 64, 67, 72, 76, 65, 69, 72, 74, 67, 71, 72, 0];
const HARMONY = [60, 60, 65, 65, 64, 64, 57, 57, 62, 62, 60, 60, 53, 53, 55, 60];

export function createConcertAudio(sound) {
  let context = null, master = null, wind = null, violin = null;
  let enabled = false, distance = Infinity, phase = 'gathering', clock = 0;
  let pianoPlaying = false, lastNote = -1, lastPhase = '', level = 0, audioError = false, resuming = false;
  const unsubscribe = pianoMusic.subscribe(state => { pianoPlaying = state.playing; if (pianoPlaying) silence(); });

  function voice(kind) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const harmonics = kind === 'wind' ? [0, 1, 0.2, 0.15, 0.04, 0.03] : [0, 1, 0.45, 0.24, 0.17, 0.1, 0.075, 0.04];
    oscillator.setPeriodicWave(context.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics)));
    filter.type = 'lowpass';
    filter.frequency.value = kind === 'wind' ? 2400 : 3300;
    gain.gain.value = 0;
    oscillator.connect(filter).connect(gain).connect(master);
    const vibrato = context.createOscillator();
    const depth = context.createGain();
    vibrato.frequency.value = kind === 'wind' ? 4.6 : 5.3;
    depth.gain.value = kind === 'wind' ? 7 : 13;
    vibrato.connect(depth).connect(oscillator.detune);
    oscillator.start();
    vibrato.start();
    return { oscillator, gain, filter, vibrato, depth };
  }

  function permitted() {
    return enabled && sound.on && !document.hidden && !pianoPlaying && distance < 25;
  }

  function resume() {
    if (!context || context.state !== 'suspended' || resuming) return;
    resuming = true;
    context.resume().catch(() => { audioError = true; }).finally(() => { resuming = false; });
  }

  function unlock() {
    if (!sound.on || document.hidden) { silence(); return; }
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) { audioError = true; return; }
      try {
        context = new AudioContext();
        master = context.createGain();
        master.gain.value = 0;
        const limiter = context.createDynamicsCompressor();
        limiter.threshold.value = -20;
        limiter.ratio.value = 4;
        master.connect(limiter).connect(context.destination);
        wind = voice('wind');
        violin = voice('violin');
      } catch {
        audioError = true;
        context?.close().catch(() => {});
        context = null;
        return;
      }
    }
    audioError = false;
    resume();
  }

  function silence() {
    level = 0;
    if (master) {
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setValueAtTime(0, context.currentTime);
    }
  }

  function visibility() {
    silence();
    if (document.hidden) context?.suspend().catch(() => {});
    else if (permitted()) resume();
  }

  function soundToggle(event) {
    if (event.target.closest?.('#soundButton')) unlock();
  }

  function note(voice, midi, strength) {
    const now = context.currentTime;
    if (midi) voice.oscillator.frequency.setTargetAtTime(440 * Math.pow(2, (midi - 69) / 12), now, 0.035);
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(midi ? strength : 0, now, 0.055);
    voice.gain.gain.setTargetAtTime(0, now + 0.49, 0.055);
  }

  function update(active, nextPhase, time, away, blocked) {
    enabled = active && !blocked;
    distance = away;
    phase = nextPhase;
    clock = time;
    if (!context || !master || !wind || !violin) return;
    const performing = phase === 'wind' || phase === 'violin' || phase === 'duet';
    if (!permitted() || !performing) {
      if (level) silence();
      lastNote = -1;
      if (context.state === 'running') context.suspend().catch(() => {});
      return;
    }
    resume();
    if (context.state !== 'running') return;
    const volume = 0.2 * Math.pow(Math.max(0, 1 - Math.max(0, distance - 3) / 22), 2);
    if (Math.abs(volume - level) > 0.002) {
      level = volume;
      master.gain.setTargetAtTime(level, context.currentTime, 0.15);
    }
    const beat = Math.floor(clock / 0.625);
    if (beat === lastNote && phase === lastPhase) return;
    lastNote = beat;
    lastPhase = phase;
    const offset = beat % MELODY.length;
    note(wind, phase === 'violin' ? 0 : MELODY[offset], 0.24);
    note(violin, phase === 'wind' ? 0 : phase === 'duet' ? HARMONY[Math.floor(offset / 2)] + 12 : ANSWER[offset], 0.19);
  }

  addEventListener('pointerdown', unlock);
  addEventListener('keydown', unlock);
  document.addEventListener('click', soundToggle);
  document.addEventListener('visibilitychange', visibility);

  return {
    update, unlock,
    get state() { return { initialized: !!context, context: context?.state || 'idle', audible: level > 0 && context?.state === 'running', level, error: audioError, pianoPlaying }; },
    dispose() {
      silence();
      unsubscribe();
      removeEventListener('pointerdown', unlock);
      removeEventListener('keydown', unlock);
      document.removeEventListener('click', soundToggle);
      document.removeEventListener('visibilitychange', visibility);
      context?.close().catch(() => {});
    },
  };
}
