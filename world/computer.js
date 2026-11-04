import { icon } from '@engine/ui/icons.js';
import { applyLang } from '@engine/lang.js';

function appURL(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function label(element, zh, en) {
  element.textContent = en;
  element.dataset.zh = zh;
  element.dataset.en = en;
}

export function createComputer(settings = {}) {
  const source = document.querySelector('#pages [data-computer-desktop]');
  const panel = document.querySelector('#panel');
  if (!source || !panel) return;
  const grid = source.querySelector('[data-computer-apps]');
  const contact = document.querySelector('#contact [data-app="github"] a[href]');
  const apps = Array.isArray(settings.apps) ? settings.apps : [];
  grid.replaceChildren();
  for (const app of apps) {
    if (!app || typeof app.name !== 'string') continue;
    const url = appURL(app.url || (app.id === 'github' ? contact?.getAttribute('href') : ''));
    const category = app.category === 'dev' ? 'dev' : 'games';
    if (category === 'games' && !url) continue;
    const tile = document.createElement(url ? 'a' : 'button');
    tile.className = 'computer-app';
    tile.dataset.computerApp = app.id || '';
    tile.dataset.category = category;
    if (url) {
      tile.href = url;
      tile.target = '_blank';
      tile.rel = 'noopener noreferrer';
    } else {
      tile.type = 'button';
      tile.dataset.computerMissing = '';
    }
    const mark = document.createElement('span');
    mark.className = `computer-app-icon${app.icon === 'github' ? ' is-github' : ''}`;
    const image = document.createElement('img');
    image.src = app.icon === 'github'
      ? new URL('../engine/assets/apps/github.webp', import.meta.url).href
      : icon(app.icon || 'works').url;
    image.alt = '';
    image.width = 40;
    image.height = 40;
    mark.append(image);
    const name = document.createElement('strong');
    label(name, app.name, app.en || app.name);
    const hint = document.createElement('small');
    label(hint, url ? '打开 ↗' : '待设置链接', url ? 'Open ↗' : 'Link not set');
    tile.append(mark, name, hint);
    grid.append(tile);
  }
  source.querySelector('.computer-start img').src = icon('works').url;
  applyLang();

  panel.addEventListener('pointerdown', event => {
    if (event.target.closest('[data-computer-desktop]')) event.stopPropagation();
  }, true);
  panel.addEventListener('click', event => {
    const desktop = event.target.closest('[data-computer-desktop]');
    if (!desktop) return;
    event.stopPropagation();
    const filter = event.target.closest('[data-computer-filter]');
    if (filter) {
      for (const button of desktop.querySelectorAll('[data-computer-filter]')) {
        button.setAttribute('aria-pressed', String(button === filter));
      }
      for (const tile of desktop.querySelectorAll('[data-computer-app]')) {
        tile.hidden = filter.dataset.computerFilter !== 'all' && tile.dataset.category !== filter.dataset.computerFilter;
      }
    }
    if (event.target.closest('[data-computer-missing]')) {
      label(desktop.querySelector('[data-computer-status]'),
        '这个应用还没有链接，请在 home.config.js 的 computer.apps 中填写名称和 url。',
        'This app needs a link. Set its name and url in computer.apps in home.config.js.');
      applyLang();
    }
  }, true);

  const clock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  let timer = null;
  const tick = () => {
    const time = panel.querySelector('[data-computer-clock]');
    if (!time) return;
    const now = new Date();
    time.textContent = clock.format(now);
    time.dateTime = now.toISOString();
  };
  const observer = new MutationObserver(() => {
    clearInterval(timer);
    timer = null;
    if (panel.open && panel.dataset.station === 'computer') {
      tick();
      timer = setInterval(tick, 30000);
    }
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['open', 'data-station'] });
}
