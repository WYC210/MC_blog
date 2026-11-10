import { t, onLang, nameOf } from '@engine/lang.js';
import { icon } from '@engine/ui/icons.js';
import { TRAVEL_DESTINATIONS, TRAVEL_GROUPS, HOME_DESTINATION, travelLanding } from './travel-destinations.js';

export function createTravelAgency({ player, rig, stage, nav, sound, fishing, lookout, qinIsland, coaster }) {
  const root = document.querySelector('#phone');
  const toast = document.createElement('div');
  toast.id = 'travelArrival'; toast.setAttribute('role', 'status'); toast.hidden = true;
  document.body.append(toast);
  let card, content, search, filters, list, message, homeButton, heading, subtitle, summary;
  let active = false, group = 'all', query = '', notice = '', arrival = null, toastTimer = 0;

  function appButton() {
    const accounts = [...document.querySelectorAll('#pages [data-station="contact"] li[data-app]')];
    return root.querySelector(`.app[data-i="${accounts.findIndex(account => account.dataset.app === 'travel')}"]`);
  }

  function decorate() {
    const button = appButton();
    if (!button) return;
    button.dataset.travelApp = '';
    const tile = button.querySelector('.tile');
    tile.style.setProperty('--tile', '#297d87');
    tile.replaceChildren(document.createElement('span'));
    tile.firstChild.style.backgroundImage = `url(${icon('qin-island').url})`;
  }

  function destinationButton(destination, returning = false) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'travel-stop'; button.dataset.travelTo = destination.id;
    const image = document.createElement('img');
    image.width = image.height = 32; image.alt = ''; image.src = icon(destination.icon).url;
    const text = document.createElement('span'), label = document.createElement('strong'), detail = document.createElement('small');
    label.textContent = nameOf(destination);
    detail.textContent = returning ? t('回到海滩出发点', 'Back to the beach')
      : t('点击即刻到达', 'Tap to teleport');
    text.append(label, detail);
    const arrow = document.createElement('span');
    arrow.className = 'travel-arrow'; arrow.textContent = '→'; arrow.setAttribute('aria-hidden', 'true');
    button.append(image, text, arrow);
    button.setAttribute('aria-label', t(`瞬移到${nameOf(destination)}`, `Teleport to ${nameOf(destination)}`));
    return button;
  }

  function renderList() {
    const term = query.trim().toLocaleLowerCase();
    const destinations = TRAVEL_DESTINATIONS.filter(destination => (group === 'all' || destination.group === group)
      && `${destination.name} ${destination.en}`.toLocaleLowerCase().includes(term));
    list.replaceChildren(...destinations.map(destination => destinationButton(destination)));
    if (!destinations.length) {
      const empty = document.createElement('p'); empty.className = 'travel-empty';
      empty.textContent = t('没有找到景点，试试其他名字或分区。', 'No stops found. Try another name or area.'); list.append(empty);
    }
    summary.textContent = t(`${destinations.length} 处景点 · 瞬间到达`, `${destinations.length} stops · Instant travel`);
    for (const button of filters.children) button.setAttribute('aria-pressed', String(button.dataset.travelGroup === group));
  }

  function labels() {
    heading.textContent = t('旅行社', 'Travel Agency');
    subtitle.textContent = t('求仙之旅，想去就去', 'Your next stop, a tap away');
    search.placeholder = t('搜索景点…', 'Search landmarks…');
    search.setAttribute('aria-label', t('搜索景点', 'Search landmarks'));
    filters.setAttribute('aria-label', t('景点分区', 'Landmark areas'));
    filters.replaceChildren(...TRAVEL_GROUPS.map(area => {
      const button = document.createElement('button');
      button.type = 'button'; button.dataset.travelGroup = area.id; button.textContent = nameOf(area); return button;
    }));
    homeButton.replaceWith(homeButton = destinationButton(HOME_DESTINATION, true));
    renderList(); showNotice(notice);
    if (arrival) toast.textContent = t(`已到达 · ${nameOf(arrival)}`, `Arrived · ${nameOf(arrival)}`);
  }

  function showNotice(reason) {
    notice = reason;
    message.textContent = reason === 'ride' ? t('请等过山车到站并下车后再传送。', 'Wait for the coaster to arrive and dismount before travelling.')
      : reason === 'busy' ? t('请先结束剧情、观影或观景，再出发。', 'Finish the scene, screening or lookout before travelling.')
      : reason === 'landing' ? t('落点暂时被占用，请稍后再试。', 'The landing is blocked. Please try again shortly.') : '';
    message.hidden = !reason;
  }

  function open() {
    active = true; card.classList.add('travel-open'); content.hidden = false;
    root.querySelector('.screen').style.setProperty('--ink', '#263938');
    query = ''; group = 'all'; search.value = ''; showNotice(''); renderList(); list.scrollTop = 0;
    player.cancel(); dispatchEvent(new Event('blur'));
  }

  function close() {
    if (active && (card.hidden || !root.classList.contains('up'))) root.querySelector('.screen').style.removeProperty('--ink');
    if (content.contains(document.activeElement)) document.activeElement.blur();
    active = false; card.classList.remove('travel-open'); content.hidden = true;
  }

  function travel(id) {
    const destination = id === HOME_DESTINATION.id ? HOME_DESTINATION : TRAVEL_DESTINATIONS.find(stop => stop.id === id);
    if (!destination) return false;
    if (coaster?.riding) { showNotice('ride'); return false; }
    if (qinIsland.encounter.active || qinIsland.cinema.active || lookout.active || rig.showcaseActive
      || document.querySelector('dialog[open]')) { showNotice('busy'); return false; }
    const landing = travelLanding(nav, destination);
    if (!landing) { showNotice('landing'); return false; }
    if (!player.teleport(landing.x, landing.z, destination)) { showNotice('landing'); return false; }
    fishing.cancel(); dispatchEvent(new Event('blur'));
    rig.skipIntro(); rig.recenter(player, true); rig.update(2, player); rig.recenter(player, true);
    stage.setClearance(0);
    if (root.classList.contains('up')) document.querySelector('#hotbar button:has(img[data-icon="phone"])')?.click();
    close(); arrival = destination; toast.hidden = false;
    toast.textContent = t(`已到达 · ${nameOf(destination)}`, `Arrived · ${nameOf(destination)}`);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { toast.hidden = true; arrival = null; }, 2600);
    sound.play('click'); return true;
  }

  function mount() {
    card = root.querySelector('.card');
    content = document.createElement('section'); content.className = 'travel-content'; content.hidden = true;
    content.setAttribute('aria-labelledby', 'travelAgencyTitle');
    content.innerHTML = '<header><h3 id="travelAgencyTitle"></h3><p></p></header><input type="search" autocomplete="off" spellcheck="false"><nav class="travel-filters"></nav><p class="travel-summary" aria-live="polite"></p><div class="travel-list"></div><p class="travel-message" role="status" hidden></p><footer><span></span></footer>';
    card.append(content);
    heading = content.querySelector('h3'); subtitle = content.querySelector('header p');
    search = content.querySelector('input'); filters = content.querySelector('nav'); list = content.querySelector('.travel-list');
    summary = content.querySelector('.travel-summary'); message = content.querySelector('.travel-message'); homeButton = content.querySelector('footer span');
    decorate(); labels();
    new MutationObserver(decorate).observe(root.querySelector('.apps'), { childList: true });
    const visibility = new MutationObserver(() => { if (card.hidden || !root.classList.contains('up')) close(); });
    visibility.observe(card, { attributes: true, attributeFilter: ['hidden'] });
    visibility.observe(root, { attributes: true, attributeFilter: ['class'] });
    root.addEventListener('click', event => {
      const button = event.target.closest('.app');
      if (button) { if (button === appButton()) open(); else close(); }
      if (event.target.closest('.back, .bar')) close();
      const stop = event.target.closest('[data-travel-to]');
      if (stop) travel(stop.dataset.travelTo);
      const filter = event.target.closest('[data-travel-group]');
      if (filter) { group = filter.dataset.travelGroup; renderList(); list.scrollTop = 0; }
    });
    search.addEventListener('input', () => { query = search.value; renderList(); list.scrollTop = 0; });
    addEventListener('keydown', event => {
      if (!active || !root.classList.contains('up') || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase(), typing = event.target === search;
      if (key === 'escape') {
        event.preventDefault(); event.stopImmediatePropagation(); card.querySelector('.back').click(); appButton()?.focus({ preventScroll: true }); return;
      }
      if (key === 'p' && !typing) return;
      event.stopImmediatePropagation();
      if (!typing && !['tab', 'enter', ' ', 'arrowup', 'arrowdown', 'home', 'end', 'pageup', 'pagedown'].includes(key)) event.preventDefault();
    }, true);
    onLang(() => {
      const reopen = active, previousGroup = group, previousQuery = query, scroll = list.scrollTop;
      queueMicrotask(() => {
        decorate(); labels();
        if (reopen && root.classList.contains('up')) {
          appButton()?.click(); group = previousGroup; query = previousQuery; search.value = query; renderList(); list.scrollTop = scroll;
        }
      });
    });
  }

  queueMicrotask(mount);
  return { travel, get active() { return active; } };
}
