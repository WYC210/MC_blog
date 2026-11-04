import { canvasTexture } from '@engine/world/textures.js';

export const TRADING_ART = {
  screens: Array.from({ length: 6 }, (_, index) => ({ x: index % 3 * 344, y: Math.floor(index / 3) * 200, width: 336, height: 188 })),
  research: { x: 0, y: 416, width: 504, height: 320 },
  review: { x: 520, y: 416, width: 504, height: 320 },
  ticker: { x: 0, y: 768, width: 1024, height: 96 },
};

const COLORS = { background: '#0c1721', panel: '#142532', grid: '#273b46', ink: '#d8e8e7', muted: '#839caa', up: '#ee796d', down: '#66bba0', gold: '#dfc88a', blue: '#81b6d7', purple: '#bb9acc' };

function text(context, content, left, top, color = COLORS.ink, size = 10) {
  context.fillStyle = color;
  context.font = `${size}px Consolas, "Microsoft YaHei", monospace`;
  context.fillText(content, left, top);
}

function grid(context, left, top, width, height) {
  context.strokeStyle = COLORS.grid;
  context.lineWidth = 0.7;
  context.beginPath();
  for (let column = 0; column <= 6; column++) {
    const position = left + width * column / 6;
    context.moveTo(position, top);
    context.lineTo(position, top + height);
  }
  for (let row = 0; row <= 4; row++) {
    const position = top + height * row / 4;
    context.moveTo(left, position);
    context.lineTo(left + width, position);
  }
  context.stroke();
}

function line(context, values, left, top, width, height, color, range = 100) {
  context.strokeStyle = color;
  context.lineWidth = 1.4;
  context.beginPath();
  values.forEach((value, index) => {
    const positionX = left + width * index / (values.length - 1);
    const positionY = top + height * (1 - value / range);
    if (index) context.lineTo(positionX, positionY);
    else context.moveTo(positionX, positionY);
  });
  context.stroke();
}

function candles(context, left, top, width, height, seed = 0, count = 32) {
  const values = Array.from({ length: count }, (_, index) => 43 + index * 0.65 + Math.sin(index * 0.5 + seed) * 11 + Math.sin(index * 1.7 + seed) * 4);
  const chartHeight = height * 0.73;
  const step = width / count;
  grid(context, left, top, width, chartHeight);
  values.forEach((close, index) => {
    const open = index ? values[index - 1] : close - 3;
    const positionX = left + (index + 0.5) * step;
    const priceY = value => top + chartHeight * (1 - value / 100);
    const color = close >= open ? COLORS.up : COLORS.down;
    context.fillStyle = context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(positionX, priceY(Math.max(open, close) + 4 + Math.abs(Math.sin(index)) * 4));
    context.lineTo(positionX, priceY(Math.min(open, close) - 4));
    context.stroke();
    context.fillRect(positionX - step * 0.29, priceY(Math.max(open, close)), step * 0.58, Math.max(1.5, Math.abs(priceY(open) - priceY(close))));
    const volumeHeight = (0.25 + Math.abs(Math.sin(index * 1.1 + seed)) * 0.75) * height * 0.19;
    context.fillRect(positionX - step * 0.29, top + height - volumeHeight, step * 0.58, volumeHeight);
  });
  for (const [period, color] of [[3, COLORS.gold], [7, COLORS.blue], [13, COLORS.purple]]) {
    const average = values.map((value, index) => {
      const window = values.slice(Math.max(0, index - period + 1), index + 1);
      return window.reduce((sum, sample) => sum + sample, 0) / window.length;
    });
    line(context, average, left + step / 2, top, width - step, chartHeight, color);
  }
}

function screen(context, index) {
  context.fillStyle = COLORS.background;
  context.fillRect(0, 0, 336, 188);
  context.fillStyle = COLORS.panel;
  context.fillRect(0, 0, 336, 22);
  context.fillStyle = COLORS.down;
  context.fillRect(8, 8, 5, 5);
  const titles = ['01 / DAILY K', '02 / INTRADAY', '03 / WATCHLIST', '04 / 30 MIN + MACD', '05 / ORDER BOOK', '06 / SECTOR MAP'];
  text(context, titles[index], 20, 15, COLORS.ink, 10);
  text(context, 'SIM', 305, 15, COLORS.gold, 9);
  if (index === 0 || index === 3) {
    text(context, 'LEHUN 50', 10, 39, COLORS.ink, 11);
    text(context, index ? '30m  +0.86%' : '128.60  +1.28%', 150, 39, COLORS.up, 11);
    text(context, 'MA5  /  MA20  /  MA60', 10, 53, COLORS.gold, 8);
    candles(context, 10, 61, 310, index ? 82 : 105, index * 2);
    if (index) {
      grid(context, 10, 149, 310, 25);
      for (let bar = 0; bar < 32; bar++) {
        const value = Math.sin(bar * 0.4) * 9;
        context.fillStyle = value > 0 ? COLORS.up : COLORS.down;
        context.fillRect(13 + bar * 9.6, 161 - Math.max(0, value), 5, Math.abs(value) + 1);
      }
      line(context, Array.from({ length: 32 }, (_, sample) => 50 + Math.sin(sample * 0.25) * 26), 10, 149, 310, 25, COLORS.gold);
    }
  } else if (index === 1) {
    text(context, 'SESSION  09:30 - 15:00', 10, 40, COLORS.muted, 9);
    grid(context, 10, 50, 310, 92);
    const values = Array.from({ length: 70 }, (_, sample) => 35 + sample * 0.45 + Math.sin(sample * 0.23) * 8 + Math.sin(sample * 1.3) * 3);
    line(context, values, 10, 50, 310, 92, COLORS.blue);
    line(context, values.map((value, sample) => 38 + sample * 0.35), 10, 50, 310, 92, COLORS.gold);
    for (let bar = 0; bar < 52; bar++) {
      context.fillStyle = bar % 3 ? COLORS.up : COLORS.down;
      context.fillRect(10 + bar * 6, 173 - (8 + Math.abs(Math.sin(bar * 0.8)) * 17), 3, 8 + Math.abs(Math.sin(bar * 0.8)) * 17);
    }
  } else if (index === 2) {
    text(context, 'SYMBOL         LAST      CHANGE', 10, 40, COLORS.muted, 9);
    const symbols = ['LEHUN50', 'BLUE300', 'TECH-X', 'GREEN-E', 'CORE100', 'DIVIDEND', 'INDUSTRY'];
    symbols.forEach((symbol, row) => {
      const top = 58 + row * 17;
      const positive = row % 3 !== 1;
      text(context, symbol, 10, top, COLORS.ink, 10);
      text(context, (86.3 + row * 21.75).toFixed(2), 149, top, positive ? COLORS.up : COLORS.down, 10);
      text(context, `${positive ? '+' : '-'}${(0.42 + row * 0.31).toFixed(2)}%`, 241, top, positive ? COLORS.up : COLORS.down, 10);
      line(context, Array.from({ length: 14 }, (_, sample) => 40 + Math.sin(sample * 0.5 + row) * 20 + sample), 280, top - 10, 44, 12, positive ? COLORS.up : COLORS.down);
    });
  } else if (index === 4) {
    text(context, 'PRICE      SIZE         TIME & SALES', 10, 40, COLORS.muted, 9);
    for (let row = 0; row < 8; row++) {
      const top = 57 + row * 15;
      const color = row < 4 ? COLORS.down : COLORS.up;
      context.fillStyle = row < 4 ? '#16372f' : '#3a292c';
      context.fillRect(8, top - 10, 125 - row % 4 * 21, 12);
      text(context, (128.64 - row * 0.01).toFixed(2), 12, top, color, 10);
      text(context, `${240 + row * 117}`, 89, top, color, 10);
      text(context, `14:${51 + row}  128.60`, 173, top, row % 2 ? COLORS.up : COLORS.down, 10);
      text(context, `${100 + row * 50}`, 294, top, COLORS.muted, 9);
    }
  } else {
    const tiles = [[9, 35, 120, 70, 'TECH +2.4%', '#994f47'], [134, 35, 95, 70, 'ENERGY +1.2', '#82463f'], [234, 35, 93, 70, 'BANK -0.6', '#285f4f'], [9, 110, 90, 62, 'CHIPS +3.1', '#b35d50'], [104, 110, 123, 62, 'HEALTH -1.1%', '#327260'], [232, 110, 95, 62, 'CORE +0.8', '#7c453f']];
    for (const [left, top, width, height, label, color] of tiles) {
      context.fillStyle = color;
      context.fillRect(left, top, width, height);
      text(context, label, left + 6, top + height / 2, '#f2e9db', 10);
    }
  }
  text(context, 'LEHUN RESEARCH / DEMO DATA / NOT LIVE', 10, 184, COLORS.muted, 7);
}

function research(context) {
  context.fillStyle = '#192c27';
  context.fillRect(0, 0, 504, 320);
  for (let dust = 0; dust < 300; dust++) {
    context.fillStyle = 'rgba(213,225,197,0.055)';
    context.fillRect(dust * 73 % 504, dust * 47 % 320, 2, 1);
  }
  text(context, 'K线复盘 / PRICE ACTION', 20, 34, '#eee6c9', 22);
  text(context, '趋势 · 成交量 · 形态 · 复盘', 22, 56, '#b8c8b2', 12);
  candles(context, 22, 77, 291, 140, 1.5, 30);
  context.setLineDash([4, 4]);
  context.strokeStyle = '#d7c58a';
  context.beginPath();
  context.moveTo(22, 115);
  context.lineTo(314, 115);
  context.moveTo(22, 166);
  context.lineTo(314, 166);
  context.stroke();
  context.setLineDash([]);
  text(context, 'RESISTANCE', 238, 110, COLORS.gold, 9);
  text(context, 'SUPPORT', 246, 180, COLORS.blue, 9);
  for (const [top, title, body] of [[82, '01  TREND', 'Higher highs / lows'], [132, '02  VOLUME', 'Price + participation'], [182, '03  REVIEW', 'Plan / journal / learn']]) {
    text(context, title, 337, top, '#e2d394', 13);
    text(context, body, 337, top + 19, '#c0cdbb', 9);
  }
  context.strokeStyle = '#778c76';
  context.strokeRect(20, 238, 212, 54);
  context.strokeRect(250, 238, 233, 54);
  text(context, 'MA5  /  MA20  /  MA60', 31, 259, '#d6c38b', 12);
  text(context, '观察 > 记录 > 复盘', 267, 262, '#dbe2c7', 15);
  text(context, '仅作场景装饰 · 非实时行情', 267, 282, '#9fb5a2', 10);
  text(context, 'LEHUN / TRADING NOTEBOOK', 21, 310, '#8ca895', 9);
}

function review(context) {
  context.fillStyle = '#1c272c';
  context.fillRect(0, 0, 504, 320);
  text(context, 'MARKET JOURNAL', 22, 35, '#eee4ca', 22);
  const cards = [[20, 57, 222, 143], [260, 57, 224, 143], [20, 218, 310, 82]];
  for (const [left, top, width, height] of cards) {
    context.fillStyle = '#e4dfcb';
    context.fillRect(left, top, width, height);
    context.fillStyle = '#b89e67';
    context.fillRect(left + width / 2 - 20, top - 4, 40, 9);
  }
  text(context, '01 / PRICE + VOLUME', 32, 80, '#384e46', 12);
  candles(context, 33, 93, 194, 89, 3, 22);
  text(context, '02 / MOMENTUM', 273, 80, '#384e46', 12);
  grid(context, 274, 96, 195, 85);
  for (const [color, phase] of [[COLORS.up, 0], [COLORS.down, 1.3], ['#6b91b0', 2.6]]) line(context, Array.from({ length: 30 }, (_, index) => 45 + Math.sin(index * 0.23 + phase) * 28), 274, 96, 195, 85, color);
  text(context, 'REVIEW / 今日复盘', 34, 242, '#384e46', 14);
  text(context, 'SETUP  /  EXECUTION  /  JOURNAL', 34, 265, '#52675b', 11);
  text(context, '观察趋势，记录想法。', 34, 287, '#52675b', 11);
  context.fillStyle = '#c8ba78';
  context.fillRect(350, 220, 133, 80);
  text(context, 'STUDY ONLY', 365, 246, '#3a4637', 14);
  text(context, '示意行情', 369, 268, '#4e5943', 13);
  text(context, 'NO LIVE FEED', 365, 286, '#4e5943', 10);
}

export function createTradingArt() {
  return canvasTexture(1024, 1024, context => {
    context.fillStyle = COLORS.background;
    context.fillRect(0, 0, 1024, 1024);
    const paint = (region, callback) => {
      context.save();
      context.beginPath();
      context.rect(region.x, region.y, region.width, region.height);
      context.clip();
      context.translate(region.x, region.y);
      callback(context);
      context.restore();
    };
    TRADING_ART.screens.forEach((region, index) => paint(region, target => screen(target, index)));
    paint(TRADING_ART.research, research);
    paint(TRADING_ART.review, review);
    paint(TRADING_ART.ticker, target => {
      target.fillStyle = '#162a2b';
      target.fillRect(0, 0, 1024, 96);
      text(target, '乐魂 · 交易研究室', 24, 39, '#eee4cb', 28);
      text(target, 'LEHUN / MARKET STUDIO', 25, 70, '#a1b3a3', 18);
      text(target, 'LEHUN50  +1.28%   TECH-X  +2.46%', 420, 36, COLORS.up, 22);
      text(target, 'BLUE300  -0.65%   DEMO / 示例行情', 420, 69, COLORS.down, 21);
    });
  }, { pixelated: false });
}
