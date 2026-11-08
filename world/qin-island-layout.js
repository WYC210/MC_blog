export const QIN_ISLAND = { x0: 84, x1: 236, z0: -72, z1: 78, corner: 15 };
export const QIN_DOCK = { x: 86, z: 18, waterX: 80, heading: Math.PI / 2 };
export const QIN_PALACE = { x0: 138, x1: 182, z0: -51, z1: -15, floor: 3 };
export const QIN_GALLERY = { x0: 141, x1: 181, z0: -47, z1: -35, floor: 7 };
export const QIN_WALL_TABLE = { x: 160.5, z: -44, floor: 3, width: 32, depth: 4.6, at: [160.5, -40.2] };
export const QIN_WALL_ROOM = { x0: 141, x1: 181, z0: -47, z1: -19, floor: 3 };
export const QIN_POND = { x0: 193, x1: 223, z0: -57, z1: -27 };
export const QIN_CORRIDOR = { x: 227.5, z: -42, width: 6.7, depth: 44 };
export const QIN_WELL = { x: 225, z: -12 };
export const QIN_PAVILION = { x: 207.5, z: -41.5, x0: 203, x1: 212, z0: -46, z1: -37 };
export const QIN_TERRACE = { x: 207.5, z: -65, x0: 201.5, x1: 213.5, z0: -68, z1: -62, floor: 1.02,
  stairs: { x0: 205.5, x1: 209.5, z0: -62, z1: -59, count: 6, rise: 0.17, run: 0.5 } };
export const QIN_LIGHT_VOLUME = { min: [82, -1, -74], extent: [156, 30, 154], size: [78, 15, 77] };
export const QIN_WARRIORS = { x: 112, z: 9, baseZ: 8, plaqueZ: 12 };
export const QIN_COURTYARD = { x0: 102, x1: 120, z0: -28, z1: -10 };
export const QIN_HANFEI = { x: 112, z: -46, width: 20, depth: 10 };
export const QIN_RELIEF_WALLS = [
  { id: 'qin-zhao', x: (QIN_COURTYARD.x0 + QIN_COURTYARD.x1) / 2, z: QIN_COURTYARD.z0, yaw: 0, length: 18 },
  { id: 'qin-tiger', x: QIN_COURTYARD.x0, z: (QIN_COURTYARD.z0 + QIN_COURTYARD.z1) / 2, yaw: Math.PI / 2, length: 18 },
  { id: 'qin-dream', x: QIN_COURTYARD.x1, z: (QIN_COURTYARD.z0 + QIN_COURTYARD.z1) / 2, yaw: -Math.PI / 2, length: 18 },
];
export const QIN_COURTYARD_GATE = { x: QIN_RELIEF_WALLS[0].x, z: QIN_COURTYARD.z1 + 1.5 };

export function qinLandAt(x, z) {
  const island = QIN_ISLAND;
  const horizontal = Math.abs(x - (island.x0 + island.x1) / 2) - ((island.x1 - island.x0) / 2 - island.corner);
  const vertical = Math.abs(z - (island.z0 + island.z1) / 2) - ((island.z1 - island.z0) / 2 - island.corner);
  return Math.hypot(Math.max(horizontal, 0), Math.max(vertical, 0)) + Math.min(Math.max(horizontal, vertical), 0) < island.corner - 1;
}

export function qinFloorAt(x, z) {
  if (x >= 156 && x < 164 && z >= -15 && z < -6) return Math.min(3, (Math.floor((-6 - z) * 2) + 1) / 6);
  if (x >= 176 && x < 181 && z >= -35 && z < -23) return 3 + Math.min(4, (Math.floor((-23 - z) * 2) + 1) / 6);
  if (x >= QIN_GALLERY.x0 && x < QIN_GALLERY.x1 && z >= QIN_GALLERY.z0 && z < QIN_GALLERY.z1) return QIN_GALLERY.floor;
  if (x >= QIN_PALACE.x0 && x < QIN_PALACE.x1 && z >= QIN_PALACE.z0 && z < QIN_PALACE.z1) return 3;
  const terrace = QIN_TERRACE, stairs = terrace.stairs;
  if (x >= terrace.x0 && x < terrace.x1 && z >= terrace.z0 && z < terrace.z1) return terrace.floor;
  if (x >= stairs.x0 && x < stairs.x1 && z >= stairs.z0 && z < stairs.z1)
    return Math.min(stairs.count, Math.floor((stairs.z1 - z) / stairs.run) + 1) * stairs.rise;
  return 0;
}

export const QIN_ATTRACTIONS = [
  { id: 'qin-gate', name: '秦风阙门', en: 'Qin Gateway', x: 160, z: 56, width: 42, depth: 8, kind: 'gate', source: 2 },
  { id: 'qin-procession', name: '始皇碣石行', en: 'Imperial Procession', x: 160, z: 33, width: 40, depth: 5, kind: 'procession', source: 3 },
  { id: 'qin-emperor', name: '秦始皇像', en: 'First Emperor', x: 160, z: 10, width: 12, depth: 12, kind: 'statue', source: 7 },
  { id: 'qin-palace', name: '求仙殿', en: 'Immortality Palace', x: 160, z: -30, width: 44, depth: 36, kind: 'palace', source: 21 },
  { id: 'qin-cinema', name: '环幕影院', en: 'Panoramic Theatre', x: 150, z: -24, kind: 'interior', source: 22 },
  { id: 'qin-panorama', name: '动态全景馆', en: 'Panorama Gallery', x: 152, z: -40, kind: 'interior', source: 23 },
  { id: 'qin-wheels', name: '望海祈福圆梦轮', en: 'Wishing Wheels', x: 160, z: -49, kind: 'wheels', source: 24 },
  { id: 'qin-stele', name: '史记刻石', en: 'Historical Inscription', x: 128, z: 48, kind: 'stele', source: 8 },
  { id: 'qin-blessing', name: '望海祈福', en: 'Seaside Blessing', x: 204, z: 54, kind: 'stele', source: 4 },
  { id: 'qin-seven', name: '战国风情', en: 'Seven Warring States', x: 111, z: 43, kind: 'gateway', source: 9 },
  { id: 'qin-jixia', name: '稷下学宫', en: 'Jixia Academy', x: 112, z: 25, width: 18, depth: 12, kind: 'hall', source: 10 },
  { id: 'qin-bianque', name: '扁鹊行医', en: 'Bian Que Healing', x: 129, z: 22, kind: 'figures', source: 11 },
  { id: 'qin-warriors', name: '壮士行', en: 'Farewell at Yi River', x: QIN_WARRIORS.x, z: QIN_WARRIORS.z, kind: 'figures', source: 13 },
  { id: 'qin-zhao', name: '赵风综合体', en: 'Zhao Courtyard', ...QIN_RELIEF_WALLS[0], width: 18, depth: 0.5, kind: 'relief', source: 14 },
  { id: 'qin-archery', name: '胡服骑射', en: 'Mounted Archers', x: 126, z: -17, kind: 'horse', source: 15 },
  { id: 'qin-tiger', name: '窃符救赵', en: 'Tiger Tally Relief', ...QIN_RELIEF_WALLS[1], width: 0.5, depth: 18, kind: 'relief', source: 16 },
  { id: 'qin-dream', name: '黄粱梦', en: 'The Millet Dream', ...QIN_RELIEF_WALLS[2], width: 0.5, depth: 18, kind: 'relief', source: 17 },
  { id: 'qin-hanfei', name: '韩非讲学堂', en: 'Han Fei Hall', ...QIN_HANFEI, kind: 'hall', source: 18 },
  { id: 'qin-waterwheel', name: '水车', en: 'Waterwheel', x: 207, z: 19, kind: 'wheel', source: 19 },
  { id: 'qin-quyuan', name: '屈原', en: 'Qu Yuan', x: 207, z: 5, kind: 'figure', source: 20 },
  { id: 'qin-xufu', name: '徐福像', en: 'Xu Fu', x: 207, z: -16, kind: 'figure', source: 25 },
  { id: 'qin-bixi', name: '赑屃残碑', en: 'Bixi Stele', x: 191, z: -15, kind: 'stele', source: 26 },
  { id: 'qin-well', name: '秦皇井', en: 'Emperor Well', ...QIN_WELL, width: 5, depth: 4, kind: 'well' },
  { id: 'qin-pavilion', name: '祈寿亭', en: 'Longevity Pavilion', x: QIN_PAVILION.x, z: QIN_PAVILION.z, width: 9, depth: 9, kind: 'pavilion' },
  { id: 'qin-terrace', name: '升仙台', en: 'Ascension Terrace', x: QIN_TERRACE.x, z: QIN_TERRACE.z, width: 12, depth: 6, kind: 'terrace' },
  { id: 'qin-corridor', name: '望海长廊', en: 'Sea-view Corridor', ...QIN_CORRIDOR, kind: 'corridor' },
];

export const QIN_STATE_FLAGS = [
  { state: '齐', attraction: 'qin-jixia', offset: [-10.5, 9], side: -1 },
  { state: '燕', attraction: 'qin-warriors', offset: [-9.5, 5], side: -1 },
  { state: '赵', attraction: 'qin-zhao', offset: [8.5, 19.5], side: 1 },
  { state: '魏', attraction: 'qin-tiger', offset: [0, 10.5], side: -1 },
  { state: '韩', attraction: 'qin-hanfei', offset: [-11.5, 10], side: -1 },
  { state: '楚', attraction: 'qin-quyuan', offset: [10, 3], side: 1 },
  { state: '秦', attraction: 'qin-gate', offset: [-25, 4], side: -1 },
].map(flag => {
  const landmark = QIN_ATTRACTIONS.find(item => item.id === flag.attraction);
  return { ...flag, x: landmark.x + flag.offset[0], z: landmark.z + flag.offset[1] };
});

export const QIN_STATIONS = [
  { id: 'qin-island', name: '求仙岛', en: 'Qin Sanctuary', icon: 'qin-island', at: [89, 18], look: [95, 18] },
  { id: 'qin-gate', name: '秦风阙门', en: 'Qin Gateway', icon: 'qin-gate', at: [160, 63], look: [160, 56] },
  { id: 'qin-procession', name: '始皇碣石行', en: 'Journey to Jieshi', icon: 'qin-procession', at: [160, 39], look: [160, 37] },
  { id: 'qin-emperor', name: '秦始皇像', en: 'First Emperor', icon: 'qin-emperor', at: [160, 19], look: [160, 10] },
  { id: 'qin-palace', name: '求仙殿', en: 'Immortality Palace', icon: 'qin-palace', at: [160, -18], look: [160, -29], floor: 3 },
  { id: 'qin-great-wall', name: '长城投影桌', en: 'Great Wall Projection', icon: 'qin-palace', at: QIN_WALL_TABLE.at, look: [QIN_WALL_TABLE.x, QIN_WALL_TABLE.z], floor: QIN_WALL_TABLE.floor },
  { id: 'qin-seven', name: '战国风情', en: 'Seven States', icon: 'qin-seven', at: [112, 39], look: [112, 25] },
  { id: 'qin-bianque', name: '扁鹊行医', en: 'Bian Que Healing', icon: 'qin-bianque', at: [129, 28], look: [129, 26] },
  ...QIN_RELIEF_WALLS.map(wall => {
    const landmark = QIN_ATTRACTIONS.find(item => item.id === wall.id);
    return { id: wall.id, name: landmark.name, en: landmark.en, icon: wall.id,
      at: [wall.x + Math.sin(wall.yaw) * 5.1, wall.z + Math.cos(wall.yaw) * 5.1],
      look: [wall.x + Math.sin(wall.yaw) * 3.3, wall.z + Math.cos(wall.yaw) * 3.3] };
  }),
  { id: 'qin-hanfei', name: '韩非讲学堂', en: 'Han Fei Hall', icon: 'qin-hanfei', at: [QIN_HANFEI.x, QIN_HANFEI.z + 6.2], look: [QIN_HANFEI.x, QIN_HANFEI.z - 2.25] },
  { id: 'qin-quyuan', name: '屈原', en: 'Qu Yuan', icon: 'qin-quyuan', at: [207, 10], look: [207, 8] },
  { id: 'qin-xufu', name: '徐福像', en: 'Xu Fu', icon: 'qin-xufu', at: [207, -10], look: [207, -12] },
  { id: 'qin-garden', name: '求仙苑', en: 'Immortals Garden', icon: 'qin-garden', at: [188, -25], look: [207, -42] },
];
