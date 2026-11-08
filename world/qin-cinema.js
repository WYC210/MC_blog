import { t, onLang, langSwitch } from '@engine/lang.js';

export function createQinCinema({ media, player }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const dialog = document.createElement('dialog');
  dialog.id = 'qinCinema';
  dialog.setAttribute('aria-labelledby', 'qinCinemaTitle');
  dialog.setAttribute('aria-describedby', 'qinCinemaCaption');
  dialog.innerHTML = '<canvas aria-hidden="true"></canvas><header><h2 id="qinCinemaTitle"></h2><button type="button" class="gui cinema-exit"></button></header><section class="cinema-caption" aria-live="polite" aria-atomic="true"><h3></h3><p id="qinCinemaCaption"></p></section><footer><button type="button" class="gui cinema-pause" autofocus></button><button type="button" class="gui cinema-replay"></button><small></small></footer>';
  const language = langSwitch();
  language.classList.add('gui');
  dialog.querySelector('header').prepend(language);
  document.body.append(dialog);
  const canvas = dialog.querySelector('canvas'), context = canvas.getContext('2d', { alpha: false });
  const title = dialog.querySelector('h2'), act = dialog.querySelector('h3'), caption = dialog.querySelector('.cinema-caption p');
  const exit = dialog.querySelector('.cinema-exit'), pause = dialog.querySelector('.cinema-pause'), replay = dialog.querySelector('.cinema-replay');
  const hint = dialog.querySelector('footer small');
  let playing = !reducedMotion.matches, lastTime = -1, lastLanguage = '', heldExit = '';
  const seated = () => player.resting?.id.startsWith('qin-cinema-seat-');

  function render() {
    if (!dialog.open || document.hidden) return;
    const width = Math.max(1, Math.min(1280, Math.round(dialog.clientWidth)));
    const height = Math.max(1, Math.round(width * dialog.clientHeight / Math.max(1, dialog.clientWidth)));
    const resized = canvas.width !== width || canvas.height !== height;
    if (resized) { canvas.width = width; canvas.height = height; }
    const state = media.story.state;
    if (!resized && lastTime === state.time && lastLanguage === state.language) return;
    media.story.drawImmersive(context, width, height);
    if (act.textContent !== state.title) act.textContent = state.title;
    if (caption.textContent !== state.caption) caption.textContent = state.caption;
    lastTime = state.time; lastLanguage = state.language;
    dialog.dataset.act = state.act;
  }

  function labels() {
    title.textContent = t('始皇临海求仙', 'The Emperor’s Quest');
    exit.textContent = t('退出观影', 'Leave cinema');
    pause.textContent = playing ? t('暂停', 'Pause') : t('播放', 'Play');
    pause.setAttribute('aria-pressed', String(!playing));
    replay.textContent = t('从头观看', 'Replay');
    hint.textContent = t('F / Esc 起身离开', 'F / Esc to stand up');
    dialog.dataset.playing = String(playing);
    render();
  }

  function close() {
    if (!dialog.open) return false;
    if (seated() && !player.standUp()) return true;
    dialog.close();
    document.body.classList.remove('qin-cinema-active');
    dispatchEvent(new Event('blur'));
    return true;
  }

  function open() {
    playing = !reducedMotion.matches;
    lastTime = -1;
    media.restart();
    player.cancel();
    dispatchEvent(new Event('blur'));
    document.body.classList.add('qin-cinema-active');
    dialog.showModal();
    labels();
  }

  exit.addEventListener('click', close);
  pause.addEventListener('click', () => { playing = !playing; labels(); });
  replay.addEventListener('click', () => { media.restart(); render(); });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    if (seated()) player.standUp();
    document.body.classList.remove('qin-cinema-active');
    dispatchEvent(new Event('blur'));
  });
  addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!dialog.open && key !== heldExit) return;
    event.stopImmediatePropagation();
    if (key === heldExit || key === 'escape' || key === 'f') {
      event.preventDefault();
      if (!event.repeat) { heldExit = key; close(); }
    } else if (key !== 'tab' && key !== 'enter' && key !== ' ' && !event.metaKey && !event.ctrlKey && !event.altKey) event.preventDefault();
  }, true);
  addEventListener('keyup', event => { if (event.key.toLowerCase() === heldExit) heldExit = ''; }, true);
  addEventListener('resize', render);
  document.addEventListener('visibilitychange', render);
  reducedMotion.addEventListener('change', () => { if (reducedMotion.matches) { playing = false; labels(); } });
  onLang(labels);
  return {
    get active() { return dialog.open; },
    get playing() { return playing; },
    close, render,
    update() {
      if (seated() && !dialog.open) open();
      else if (!seated() && dialog.open) close();
      render();
    },
  };
}
