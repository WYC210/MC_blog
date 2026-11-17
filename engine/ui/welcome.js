import { t, onLang } from '../lang.js';
import { readSiteInfo, siteText } from '../door-metadata.js';

export function createWelcome({ world, enter, quality, blocked }) {
  const root = document.getElementById('welcome');
  const enterButton = root.querySelector('[data-welcome-enter]');
  const qualityButton = root.querySelector('[data-welcome-quality]');
  const status = root.querySelector('.welcome-material');
  const swallowed = new Set();
  let state = 'hidden', metadata = null;

  function refresh() {
    if (metadata) {
      root.querySelector('h1').textContent = siteText(metadata.name);
      root.querySelector('.welcome-tagline').textContent = siteText(metadata.intro);
      if (metadata.logo) root.querySelector('.welcome-logo').src = metadata.logo;
    }
    const pack = world.hdMaterials?.status;
    status.textContent = pack === 'pending' || pack === 'loading'
      ? t('高清材质加载中 · 无需等待，可直接进入', 'Loading HD materials · You can enter now')
      : pack === 'ready'
        ? t('高清材质已就绪', 'HD materials ready')
        : pack === 'fallback'
          ? t('高清材质暂不可用 · 已保留普通材质，可正常进入', 'HD materials unavailable · Normal materials are ready')
          : t('普通材质已就绪 · 手机推荐使用', 'Normal materials ready · Recommended on mobile');
    qualityButton.hidden = !!pack;
  }

  function begin() {
    if (state !== 'waiting') return;
    state = 'entering';
    root.classList.add('leaving');
    root.inert = true;
    if (root.contains(document.activeElement)) document.activeElement.blur();
    enter();
  }

  function gate(event) {
    const key = event.code || event.key;
    if (event.type === 'keyup') {
      swallowed.delete(key);
      if (state === 'hidden' && !swallowed.size) {
        removeEventListener('keydown', gate, true);
        removeEventListener('keyup', gate, true);
      }
      return;
    }
    if (state === 'hidden') {
      if (event.type === 'keydown' && swallowed.has(key)) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
      return;
    }
    if (blocked()) return;
    const button = event.target instanceof Element && event.target.closest('button');
    if (state === 'waiting' && button && root.contains(button) && (event.type !== 'keydown' || ['Enter', ' ', 'Tab'].includes(event.key))) {
      if (event.type === 'keydown') event.stopImmediatePropagation();
      return;
    }
    event.stopImmediatePropagation();
    if (event.type === 'pointerdown' || event.type === 'pointerup') return;
    if (event.type === 'keydown') {
      if (event.key === 'Tab' || event.key === 'Shift' || event.key === 'Control' || event.key === 'Alt' || event.key === 'Meta' || event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      swallowed.add(key);
      if (!event.repeat) begin();
    } else if (event.type === 'click') {
      event.preventDefault();
      begin();
    } else event.preventDefault();
  }

  const events = ['keydown', 'keyup', 'pointerdown', 'pointerup', 'click', 'wheel'];
  enterButton.addEventListener('click', begin);
  qualityButton.addEventListener('click', quality);
  onLang(refresh);
  void readSiteInfo(location.href).then(info => { metadata = info; refresh(); });

  return {
    get active() { return state !== 'hidden'; },
    get entering() { return state === 'entering'; },
    show() {
      state = 'waiting';
      root.inert = false;
      root.classList.remove('leaving');
      root.hidden = false;
      for (const type of events) addEventListener(type, gate, { capture: true, passive: false });
      refresh();
    },
    refresh,
    finish() {
      state = 'hidden';
      root.hidden = true;
      for (const type of events) {
        if (swallowed.size && (type === 'keydown' || type === 'keyup')) continue;
        removeEventListener(type, gate, true);
      }
    },
  };
}
