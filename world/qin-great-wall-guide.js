import { t, onLang, nameOf } from '@engine/lang.js';
import { WALL_STOPS, WALL_PATHS, WALL_REGIONS, WALL_SOURCES, WALL_LOCAL_COUNT, wallMatches } from './qin-great-wall-data.js';
import { WALL_MODEL_EVIDENCE, WALL_MODEL_SOURCES } from './qin-great-wall-evidence.js';

function drawMap(canvas, selected) {
  const context = canvas.getContext('2d'), width = canvas.width, height = canvas.height;
  const horizontal = stop => 36 + stop.point[0] * (width - 72);
  const vertical = stop => 24 + stop.point[1] * (height - 48);
  context.fillStyle = '#102e35'; context.fillRect(0, 0, width, height);
  context.strokeStyle = '#23464c'; context.lineWidth = 1;
  for (let column = 20; column < width; column += 32) { context.beginPath(); context.moveTo(column, 0); context.lineTo(column, height); context.stroke(); }
  for (let row = 20; row < height; row += 32) { context.beginPath(); context.moveTo(0, row); context.lineTo(width, row); context.stroke(); }
  for (let ridge = 0; ridge < 5; ridge++) {
    context.strokeStyle = `rgba(89, 151, 142, ${0.16 + ridge * 0.035})`; context.beginPath();
    for (let column = 0; column <= width; column += 8) {
      const row = 82 + ridge * 27 + Math.sin(column * 0.013 + ridge * 0.5) * 35 + Math.sin(column * 0.031) * 13;
      if (!column) context.moveTo(column, row); else context.lineTo(column, row);
    }
    context.stroke();
  }
  context.fillStyle = '#1b4e61'; context.beginPath(); context.moveTo(width * 0.62, height);
  context.lineTo(width * 0.79, height * 0.83); context.lineTo(width, height * 0.72); context.lineTo(width, height); context.fill();
  context.fillStyle = '#81b4bf'; context.font = '18px "Microsoft YaHei", sans-serif';
  context.fillText(t('渤海', 'BOHAI SEA'), width * 0.76, height - 18);
  context.fillStyle = '#78a39f'; context.font = '15px "Microsoft YaHei", sans-serif';
  context.fillText(t('山地 · 示意位置', 'MOUNTAINS · SCHEMATIC'), 28, 28);
  for (const [index, route] of WALL_PATHS.entries()) {
    context.strokeStyle = index === 2 ? '#bc9c6d' : '#82c9bc'; context.lineWidth = 2;
    context.setLineDash([5, 5]); context.beginPath();
    for (const [order, id] of route.entries()) {
      const stop = WALL_STOPS.find(item => item.id === id);
      if (!order) context.moveTo(horizontal(stop), vertical(stop)); else context.lineTo(horizontal(stop), vertical(stop));
    }
    context.stroke();
  }
  context.setLineDash([]);
  for (const [index, stop] of WALL_STOPS.entries()) {
    const active = stop.id === selected, across = horizontal(stop), along = vertical(stop);
    context.beginPath(); context.arc(across, along, active ? 15 : 11, 0, Math.PI * 2);
    context.fillStyle = active ? '#f8d38e' : stop.nearby ? '#a58053' : '#347d78'; context.fill();
    context.strokeStyle = active ? '#fff1cd' : '#96d5cb'; context.lineWidth = active ? 2 : 1; context.stroke();
    context.fillStyle = active ? '#213c3e' : '#f0f6dc'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = 'bold 13px monospace'; context.fillText(String(index + 1).padStart(2, '0'), across, along);
    if (active) {
      const label = nameOf(stop); context.font = 'bold 18px "Microsoft YaHei", sans-serif';
      const labelWidth = context.measureText(label).width + 18;
      const labelX = Math.min(width - labelWidth - 6, Math.max(6, across - labelWidth / 2));
      const labelY = along > height - 75 ? along - 47 : along + 20;
      context.fillStyle = '#102e35'; context.fillRect(labelX, labelY, labelWidth, 28);
      context.fillStyle = '#ffe2ab'; context.fillText(label, labelX + labelWidth / 2, labelY + 14);
    }
  }
  context.textAlign = 'left'; context.textBaseline = 'alphabetic';
}

export function createQinGreatWallGuide(projection) {
  let root = null, panel = null, region = 'all', query = '';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  function renderList() {
    if (!root?.isConnected) return;
    const list = root.querySelector('.wall-stops'), stops = WALL_STOPS.filter(stop => wallMatches(stop, region, query));
    list.replaceChildren();
    for (const stop of stops) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'wall-stop'; button.dataset.wallStop = stop.id;
      button.setAttribute('aria-pressed', String(stop.id === projection.state.selected));
      const number = document.createElement('span'); number.className = 'wall-number'; number.textContent = String(WALL_STOPS.indexOf(stop) + 1).padStart(2, '0');
      const caption = document.createElement('span'), title = document.createElement('strong'), subtitle = document.createElement('small');
      title.textContent = nameOf(stop); subtitle.textContent = t(stop.feature, stop.featureEn) + (WALL_MODEL_EVIDENCE[stop.id] ? t(' · 参考建模', ' · Reference study') : t(' · 待补证', ' · Schematic'));
      caption.append(title, subtitle); button.append(number, caption); list.append(button);
    }
    if (!stops.length) {
      const empty = document.createElement('p'); empty.className = 'wall-empty'; empty.textContent = t('没有找到这一处长城，试试其他名称或区域。', 'No matching section. Try another name or region.'); list.append(empty);
    }
    root.querySelector('.wall-count').textContent = t(`显示 ${stops.length} / ${WALL_STOPS.length} 处`, `Showing ${stops.length} / ${WALL_STOPS.length} entries`);
    for (const button of root.querySelectorAll('[data-wall-region]')) button.setAttribute('aria-pressed', String(button.dataset.wallRegion === region));
  }
  function renderSelection() {
    if (!root?.isConnected) return;
    const stop = WALL_STOPS.find(item => item.id === projection.state.selected);
    root.querySelector('.wall-detail h3').textContent = nameOf(stop);
    root.querySelector('.wall-location').textContent = t(stop.area, stop.areaEn);
    root.querySelector('.wall-feature').textContent = t(stop.feature, stop.featureEn);
    root.querySelector('.wall-description').textContent = t(stop.text, stop.textEn);
    const evidence = WALL_MODEL_EVIDENCE[stop.id], modelNote = root.querySelector('.wall-model-note');
    modelNote.dataset.reference = String(!!evidence);
    modelNote.textContent = evidence ? t('资料参考建模 · 代表性局部：', 'Reference-based local study: ') + t(evidence.scope, evidence.scopeEn)
      : t('待补证 · 当前保留原艺术示意，并非根据对应遗存照片重建；对象范围、地形或建筑形态尚需核实。', 'Awaiting evidence · The original artistic schematic remains, not a reconstruction from site photographs. Scope, terrain or architectural form still needs verification.');
    const sources = root.querySelector('.wall-sources:not(.wall-model-sources)'); sources.replaceChildren();
    const modelSources = root.querySelector('.wall-model-sources'); modelSources.replaceChildren();
    for (const key of evidence?.sources || []) {
      const source = WALL_MODEL_SOURCES[key], link = document.createElement('a');
      link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = nameOf(source); modelSources.append(link);
    }
    root.querySelector('.wall-model-source-title').hidden = !evidence;
    for (const key of stop.sources) {
      const source = WALL_SOURCES[key], link = document.createElement('a');
      link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = nameOf(source); sources.append(link);
    }
    for (const button of root.querySelectorAll('[data-wall-stop]')) button.setAttribute('aria-pressed', String(button.dataset.wallStop === stop.id));
    const tour = root.querySelector('[data-wall-action="tour"]');
    tour.disabled = reducedMotion.matches || !projection.state.inRoom; tour.setAttribute('aria-pressed', String(projection.state.touring));
    tour.textContent = reducedMotion.matches ? t('减少动态：手动浏览', 'Reduced motion: manual tour')
      : !projection.state.inRoom ? t('入室后自动轮播', 'Auto tour on entry')
      : projection.state.touring ? t('暂停轮播', 'Pause tour') : t('自动巡展', 'Start tour');
    drawMap(root.querySelector('canvas'), stop.id);
  }
  function labels() {
    if (!root?.isConnected) return;
    root.querySelector('.wall-kicker').textContent = 'QINHUANGDAO / GREAT WALL ATLAS';
    root.querySelector('.wall-heading').textContent = t('从渤海到燕山', 'From the Bohai Sea to the mountains');
    root.querySelector('.wall-intro').textContent = t(`市域明长城 223.1 公里 · ${WALL_LOCAL_COUNT} 处市域相关点段 · 1 处周边关联`, `223.1 km of Ming wall within the city · ${WALL_LOCAL_COUNT} local entries · 1 neighbouring pass`);
    root.querySelector('.wall-map-note').textContent = t('进入一楼自动轮播，每 7 秒换一处；离开暂停，重新进入恢复。手动选段可暂停，收起卡片不停止轮播。10 处已作资料参考建模，其余待补证；各项注明参考范围。地图仍为艺术示意，全部模型均非测绘复原或徒步路线。', 'The tour starts on room entry and advances every 7 seconds; leaving pauses it, and re-entry restarts it. Manual selection pauses; closing the card does not. Ten reference-based local studies are available, with scope notes; the rest await evidence. The map is schematic, and no model is surveyed or a hiking route.');
    root.querySelector('.wall-search-label').textContent = t('查找城段 / 关隘', 'Find a wall section or pass');
    const input = root.querySelector('input'); input.placeholder = t('试试：角山、董家口、卢龙…', 'Try Jiaoshan, Dongjiakou, Lulong…'); input.setAttribute('aria-label', t('搜索长城名称或区域', 'Search wall names or areas'));
    root.querySelector('.wall-filters').setAttribute('aria-label', t('按区域筛选', 'Filter by region'));
    for (const button of root.querySelectorAll('[data-wall-region]')) button.textContent = nameOf(WALL_REGIONS.find(item => item.id === button.dataset.wallRegion));
    root.querySelector('[data-wall-action="previous"]').textContent = t('上一处', 'Previous');
    root.querySelector('[data-wall-action="next"]').textContent = t('下一处', 'Next');
    root.querySelector('[data-wall-action="view"]').textContent = t('查看桌面虚影', 'View table projection');
    root.querySelector('.wall-source-title').textContent = t('资料来源 ↗', 'Sources ↗');
    root.querySelector('.wall-model-source-title').textContent = t('建模参考 ↗', 'Model references ↗');
    root.querySelector('summary').textContent = t('展示范围与保护提示', 'Scope & heritage care');
    root.querySelector('.wall-scope').textContent = t('“明代长城”是时代与防御体系，不是与角山并列的单个景点。本展汇集已查证的主要城段、翼城和关隘，不等同全部墙体、敌台、支线或文物普查名录；点段可能属于同一防御体系。九门口属辽宁，冷口按边界关联标注。', '“Ming Great Wall” describes a historical defensive system, not a separate attraction beside Jiaoshan. This is a sourced selection of sections, wings and passes, not a complete inventory of walls, towers or branches. Entries may share a defensive system. Jiumenkou is in Liaoning; Lengkou is labelled as a border connection.');
    root.querySelector('.wall-care').textContent = t('仅作文化展示，不表示遗址对外开放。请勿攀爬未开放长城、踩踏墙体或进入修缮区域。资料核对：2026-11-08。', 'For cultural interpretation only; inclusion does not imply public access. Do not climb closed sections, damage masonry or enter conservation works. Sources checked: 2026-11-08.');
    root.querySelector('canvas').setAttribute('aria-label', t('秦皇岛长城示意图；可通过下方同编号按钮选择', 'Schematic Great Wall map; use the matching numbered buttons to select a section'));
  }
  function mount() {
    const next = panel.querySelector('[data-wall-exhibit]');
    if (!panel.open || panel.dataset.station !== 'qin-great-wall' || !next || next === root) return;
    root = next;
    root.innerHTML = '<p class="wall-kicker"></p><h3 class="wall-heading"></h3><p class="wall-intro"></p><div class="wall-gallery"><section class="wall-view"><canvas width="800" height="420" role="img"></canvas><p class="wall-map-note"></p><div class="wall-controls"><button type="button" class="mc-button" data-wall-action="previous"></button><button type="button" class="mc-button" data-wall-action="tour"></button><button type="button" class="mc-button" data-wall-action="next"></button></div><section class="wall-detail" aria-live="polite" aria-atomic="true"><p class="wall-location"></p><h3></h3><p class="wall-feature"></p><p class="wall-description"></p><h4 class="wall-source-title"></h4><div class="wall-sources"></div></section></section><section class="wall-browser"><label><span class="wall-search-label"></span><input type="search" autocomplete="off" spellcheck="false"></label><nav class="wall-filters"></nav><p class="wall-count" role="status"></p><div class="wall-stops"></div></section></div><details class="wall-notes"><summary></summary><p class="wall-scope"></p><p class="wall-care"></p></details>';
    const filters = root.querySelector('.wall-filters');
    const modelNote = document.createElement('p'), modelTitle = document.createElement('h4'), modelSources = document.createElement('div');
    modelNote.className = 'wall-model-note'; modelTitle.className = 'wall-model-source-title'; modelSources.className = 'wall-model-sources wall-sources';
    root.querySelector('.wall-description').after(modelNote, modelTitle, modelSources);
    const viewButton = document.createElement('button');
    viewButton.type = 'button'; viewButton.className = 'mc-button'; viewButton.dataset.wallAction = 'view';
    root.querySelector('.wall-controls').append(viewButton);
    for (const area of WALL_REGIONS) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'mc-button'; button.dataset.wallRegion = area.id; filters.append(button);
    }
    root.querySelector('input').value = query;
    root.addEventListener('input', event => { if (!event.target.matches('input')) return; query = event.target.value; renderList(); });
    root.addEventListener('click', event => {
      event.stopPropagation();
      const stop = event.target.closest('[data-wall-stop]'), filter = event.target.closest('[data-wall-region]'), action = event.target.closest('[data-wall-action]');
      if (stop) projection.select(stop.dataset.wallStop);
      if (filter) { region = filter.dataset.wallRegion; renderList(); }
      if (action?.dataset.wallAction === 'tour') projection.tour(!reducedMotion.matches && !projection.state.touring);
      if (action && ['next', 'previous'].includes(action.dataset.wallAction)) {
        const direction = action.dataset.wallAction === 'next' ? 1 : -1, index = WALL_STOPS.findIndex(item => item.id === projection.state.selected);
        projection.select(WALL_STOPS[(index + direction + WALL_STOPS.length) % WALL_STOPS.length].id);
      }
      if (action?.dataset.wallAction === 'view') panel.close();
      if (event.target.matches('canvas')) {
        const rect = event.target.getBoundingClientRect(), across = (event.clientX - rect.left) / rect.width * 800, along = (event.clientY - rect.top) / rect.height * 420;
        let closest = null, distance = 26;
        for (const item of WALL_STOPS) {
          const delta = Math.hypot(across - 36 - item.point[0] * 728, along - 24 - item.point[1] * 372);
          if (delta < distance) { closest = item; distance = delta; }
        }
        if (closest) projection.select(closest.id);
      }
    });
    labels(); renderList(); renderSelection();
  }
  projection.onChange(renderSelection);
  queueMicrotask(() => {
    panel = document.querySelector('#panel');
    if (!panel) return;
    new MutationObserver(mount).observe(panel, { attributes: true, attributeFilter: ['open', 'data-station'] });
    mount();
  });
  onLang(() => { projection.labels(); labels(); renderList(); renderSelection(); });
  reducedMotion.addEventListener('change', renderSelection);
  return { select: projection.select, get selected() { return projection.state.selected; } };
}
