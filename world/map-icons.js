import { icon } from '@engine/ui/icons.js';

const COLORS = {
  ink: '#263137', gold: '#edc16c', darkGold: '#9c7038', skin: '#e8bc91', beard: '#624631',
  white: '#f7ecd4', stone: '#c9c8b8', grey: '#7d8b87', red: '#b94e42', navy: '#375d6d',
  blue: '#70c1df', water: '#3487a6', jade: '#76a474', green: '#365d42', wood: '#98613f', pink: '#d7a7a0',
};

function portrait(paint, emperor) {
  paint(3, 4, 10, 10, 'ink'); paint(4, 5, 8, 7, 'skin');
  paint(2, 12, 12, 3, emperor ? 'ink' : 'navy');
  paint(5, 8, 2, 1, 'ink'); paint(9, 8, 2, 1, 'ink');
  paint(7, 9, 2, 1, 'darkGold');
  paint(5, 11, 6, 2, emperor ? 'beard' : 'white'); paint(6, 13, 4, 2, emperor ? 'beard' : 'white');
  if (emperor) {
    paint(1, 1, 14, 3, 'ink'); paint(2, 2, 12, 1, 'gold'); paint(4, 4, 8, 2, 'ink');
    paint(3, 4, 1, 5, 'gold'); paint(12, 4, 1, 5, 'gold'); paint(7, 4, 2, 1, 'gold');
    paint(2, 13, 2, 1, 'gold'); paint(12, 13, 2, 1, 'gold');
  } else {
    paint(5, 1, 6, 2, 'ink'); paint(3, 3, 10, 2, 'navy'); paint(4, 4, 8, 1, 'white');
    paint(1, 6, 1, 9, 'wood'); paint(0, 5, 3, 2, 'gold');
  }
}

const MARKS = {
  'qin-emperor': paint => portrait(paint, true),
  'qin-xufu': paint => portrait(paint, false),
  'qin-island': paint => {
    paint(1, 11, 14, 3, 'ink'); paint(2, 11, 12, 2, 'jade'); paint(3, 10, 10, 1, 'green');
    paint(0, 14, 6, 1, 'blue'); paint(8, 14, 8, 1, 'water');
    paint(7, 1, 2, 10, 'ink'); paint(8, 2, 1, 8, 'gold');
    paint(4, 3, 3, 6, 'white'); paint(5, 2, 2, 2, 'white'); paint(9, 4, 3, 5, 'white'); paint(9, 3, 2, 1, 'white');
  },
  'qin-gate': paint => {
    paint(1, 2, 5, 13, 'ink'); paint(10, 2, 5, 13, 'ink');
    paint(2, 5, 3, 9, 'stone'); paint(11, 5, 3, 9, 'stone');
    paint(0, 3, 7, 2, 'ink'); paint(9, 3, 7, 2, 'ink'); paint(1, 3, 5, 1, 'red'); paint(10, 3, 5, 1, 'red');
    paint(6, 6, 4, 3, 'ink'); paint(6, 6, 4, 1, 'gold'); paint(3, 8, 1, 5, 'grey'); paint(12, 8, 1, 5, 'grey');
  },
  'qin-procession': paint => {
    paint(3, 3, 8, 7, 'ink'); paint(4, 5, 6, 4, 'skin'); paint(2, 4, 10, 2, 'navy');
    paint(4, 2, 6, 2, 'navy'); paint(5, 1, 4, 1, 'ink'); paint(3, 5, 8, 1, 'gold');
    paint(5, 7, 1, 1, 'ink'); paint(8, 7, 1, 1, 'ink');
    paint(2, 10, 10, 5, 'ink'); paint(3, 11, 8, 3, 'navy'); paint(6, 11, 2, 3, 'grey');
    paint(13, 3, 1, 12, 'wood'); paint(12, 2, 3, 2, 'ink'); paint(13, 0, 1, 3, 'white'); paint(11, 11, 3, 2, 'skin');
  },
  'qin-palace': paint => {
    paint(2, 6, 12, 9, 'ink'); paint(3, 8, 10, 6, 'red'); paint(1, 14, 14, 1, 'gold');
    paint(0, 6, 16, 2, 'ink'); paint(2, 5, 12, 1, 'navy'); paint(4, 4, 8, 1, 'navy');
    paint(3, 2, 10, 2, 'ink'); paint(5, 1, 6, 1, 'gold'); paint(7, 0, 2, 1, 'gold');
    paint(4, 9, 1, 5, 'gold'); paint(11, 9, 1, 5, 'gold'); paint(6, 10, 4, 4, 'ink'); paint(7, 9, 2, 1, 'white');
  },
  'qin-seven': paint => {
    for (const [column, top, color] of [[2, 3, 'red'], [7, 1, 'gold'], [12, 4, 'jade']]) {
      paint(column, top, 1, 14 - top, 'ink'); paint(column + 1, top + 1, 4, 6, 'ink');
      paint(column + 1, top + 1, 3, 4, color); paint(column + 2, top + 2, 1, 2, 'white');
    }
    paint(1, 14, 14, 1, 'wood');
  },
  'qin-bianque': paint => {
    paint(4, 2, 2, 6, 'ink'); paint(3, 2, 2, 2, 'jade'); paint(1, 3, 3, 2, 'green');
    paint(5, 1, 3, 2, 'green'); paint(6, 3, 3, 2, 'jade');
    for (let step = 0; step < 6; step++) paint(9 + Math.floor(step / 2), 7 - step, 2, 2, 'wood');
    paint(1, 7, 14, 3, 'ink'); paint(2, 8, 12, 1, 'white');
    paint(2, 10, 12, 2, 'ink'); paint(3, 10, 10, 2, 'stone'); paint(3, 12, 10, 1, 'ink');
    paint(5, 13, 6, 2, 'ink'); paint(6, 13, 4, 1, 'grey');
  },
  'qin-zhao': paint => {
    paint(2, 1, 1, 8, 'ink'); paint(3, 1, 5, 4, 'red'); paint(4, 2, 2, 2, 'gold');
    paint(3, 7, 9, 5, 'ink'); paint(4, 8, 7, 3, 'wood'); paint(10, 4, 3, 6, 'ink');
    paint(11, 5, 4, 3, 'wood'); paint(13, 5, 1, 1, 'ink'); paint(10, 3, 1, 2, 'ink');
    paint(4, 12, 2, 3, 'ink'); paint(10, 12, 2, 3, 'ink'); paint(1, 8, 2, 4, 'beard');
    paint(6, 7, 3, 2, 'gold');
  },
  'qin-tiger': paint => {
    paint(4, 6, 9, 6, 'ink'); paint(5, 7, 7, 4, 'gold'); paint(10, 3, 5, 6, 'ink');
    paint(11, 4, 3, 4, 'gold'); paint(10, 2, 2, 2, 'ink'); paint(13, 2, 2, 2, 'ink'); paint(13, 5, 1, 1, 'ink');
    paint(2, 8, 3, 2, 'darkGold'); paint(1, 5, 2, 4, 'ink'); paint(2, 5, 1, 3, 'gold');
    paint(5, 12, 2, 3, 'ink'); paint(10, 12, 2, 3, 'ink'); paint(6, 12, 1, 2, 'gold'); paint(11, 12, 1, 2, 'gold');
    paint(7, 7, 1, 3, 'beard'); paint(9, 8, 1, 3, 'beard');
  },
  'qin-dream': paint => {
    paint(1, 6, 2, 9, 'ink'); paint(3, 9, 11, 4, 'ink'); paint(13, 9, 2, 6, 'ink');
    paint(3, 8, 4, 3, 'white'); paint(4, 8, 2, 2, 'skin'); paint(7, 9, 6, 3, 'pink'); paint(3, 12, 10, 1, 'wood');
    paint(8, 2, 6, 1, 'navy'); paint(12, 3, 1, 1, 'navy'); paint(11, 4, 1, 1, 'navy'); paint(10, 5, 1, 1, 'navy'); paint(8, 6, 6, 1, 'navy');
    paint(4, 1, 2, 1, 'gold'); paint(3, 2, 2, 3, 'gold'); paint(4, 5, 2, 1, 'gold');
  },
  'qin-hanfei': paint => {
    paint(1, 3, 11, 11, 'ink'); paint(2, 4, 9, 9, 'gold');
    for (const column of [3, 5, 7, 9]) paint(column, 4, 1, 9, 'darkGold');
    paint(2, 6, 9, 1, 'beard'); paint(2, 11, 9, 1, 'beard');
    paint(1, 2, 2, 13, 'wood'); paint(10, 2, 2, 13, 'wood');
    paint(13, 1, 2, 10, 'ink'); paint(13, 2, 1, 7, 'jade'); paint(12, 11, 2, 3, 'white'); paint(12, 14, 1, 1, 'ink');
  },
  'qin-quyuan': paint => {
    paint(2, 3, 11, 12, 'ink'); paint(3, 4, 9, 10, 'white');
    paint(1, 2, 3, 3, 'gold'); paint(11, 12, 3, 3, 'gold');
    paint(5, 6, 5, 1, 'grey'); paint(5, 8, 5, 1, 'grey'); paint(5, 10, 3, 1, 'grey');
    paint(11, 2, 2, 8, 'green'); paint(10, 1, 4, 3, 'pink'); paint(11, 0, 2, 5, 'pink'); paint(11, 2, 2, 1, 'gold');
    paint(9, 6, 3, 1, 'jade'); paint(12, 8, 3, 1, 'jade');
  },
  'qin-garden': paint => {
    paint(4, 7, 8, 7, 'ink'); paint(5, 8, 6, 5, 'white'); paint(6, 9, 4, 4, 'green');
    paint(1, 6, 14, 2, 'ink'); paint(3, 5, 10, 1, 'jade'); paint(5, 4, 6, 1, 'jade'); paint(7, 2, 2, 2, 'gold');
    paint(4, 8, 1, 5, 'red'); paint(11, 8, 1, 5, 'red'); paint(2, 14, 12, 1, 'water');
    paint(0, 9, 3, 3, 'green'); paint(1, 8, 1, 5, 'jade'); paint(13, 10, 3, 3, 'green');
  },
  computer: paint => {
    paint(1, 2, 14, 10, 'ink'); paint(2, 3, 12, 7, 'blue'); paint(3, 4, 4, 1, 'white'); paint(3, 5, 2, 1, 'white');
    paint(6, 11, 4, 3, 'grey'); paint(4, 13, 8, 1, 'ink'); paint(1, 14, 14, 1, 'stone');
  },
  piano: paint => {
    paint(1, 2, 14, 13, 'ink'); paint(2, 3, 12, 3, 'wood'); paint(2, 7, 12, 7, 'white');
    for (const column of [4, 6, 9, 11]) paint(column, 7, 1, 4, 'ink');
    for (const column of [4, 7, 10, 13]) paint(column, 11, 1, 3, 'grey');
    paint(4, 4, 8, 1, 'gold');
  },
  lookout: paint => {
    paint(2, 3, 10, 5, 'ink'); paint(3, 4, 8, 3, 'navy'); paint(1, 4, 2, 3, 'gold');
    paint(11, 2, 3, 7, 'ink'); paint(12, 3, 2, 5, 'blue'); paint(12, 3, 1, 2, 'white');
    paint(7, 8, 2, 3, 'ink'); paint(6, 11, 1, 2, 'wood'); paint(9, 11, 1, 2, 'wood');
    paint(4, 13, 2, 2, 'ink'); paint(10, 13, 2, 2, 'ink');
  },
  mailbox: paint => {
    paint(1, 4, 14, 10, 'ink'); paint(2, 5, 12, 8, 'white');
    for (let step = 0; step < 5; step++) { paint(2 + step, 5 + step, 1, 1, 'red'); paint(13 - step, 5 + step, 1, 1, 'red'); }
    paint(6, 9, 4, 2, 'red'); paint(11, 1, 2, 3, 'ink'); paint(12, 1, 3, 2, 'red');
  },
};

export const MAP_ICON_IDS = Object.keys(MARKS);
let installed = false;

export function registerMapIcons() {
  if (installed) return;
  installed = true;
  for (const [id, draw] of Object.entries(MARKS)) {
    const entry = icon(id), canvas = entry.canvas;
    canvas.width = canvas.height = 32; canvas.dataset.icon = id;
    const context = canvas.getContext('2d');
    context.setTransform(2, 0, 0, 2, 0, 0); context.imageSmoothingEnabled = false;
    draw((x, y, width, height, color) => { context.fillStyle = COLORS[color]; context.fillRect(x, y, width, height); });
    entry.url = canvas.toDataURL('image/png');
  }
}
