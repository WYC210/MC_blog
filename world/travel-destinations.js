import { SPAWN, inPool } from './layout.js';
import { QIN_ATTRACTIONS, QIN_STATIONS } from './qin-island-layout.js';

const EXTRA_STOPS = {
  'qin-cinema': { at: [149.2, -23.1], look: [150, -30], floor: 3, icon: 'camera' },
  'qin-panorama': { at: [168, -38], look: [159, -39.5], floor: 7, icon: 'works' },
  'qin-wheels': { at: [160, -50.25], look: [160, -49], floor: 3, icon: 'seal' },
  'qin-stele': { at: [128, 52], look: [128, 48], icon: 'scroll' },
  'qin-blessing': { at: [204, 59], look: [204, 54], icon: 'heart' },
  'qin-jixia': { at: [112, 33.5], look: [112, 25], icon: 'cap' },
  'qin-warriors': { at: [112, 14], look: [112, 8], icon: 'qin-procession' },
  'qin-archery': { at: [130, -13], look: [126, -17], icon: 'qin-zhao' },
  'qin-waterwheel': { at: [212, 23], look: [207, 19], icon: 'pool' },
  'qin-bixi': { at: [191, -10], look: [191, -15], icon: 'scroll' },
  'qin-well': { at: [225, -7.5], look: [225, -12], icon: 'pool' },
  'qin-pavilion': { at: [207.5, -34.5], look: [207.5, -41.5], icon: 'qin-garden' },
  'qin-terrace': { at: [207.5, -64.5], look: [207.5, -70], floor: 1.02, icon: 'mountain' },
  'qin-corridor': { at: [227.5, -24], look: [227.5, -42], icon: 'qin-garden' },
};

const WEST = new Set(['qin-seven', 'qin-jixia', 'qin-bianque', 'qin-warriors', 'qin-zhao', 'qin-archery', 'qin-tiger', 'qin-dream', 'qin-hanfei']);
const EAST = new Set(['qin-blessing', 'qin-waterwheel', 'qin-quyuan', 'qin-xufu', 'qin-bixi', 'qin-well', 'qin-pavilion', 'qin-terrace', 'qin-corridor', 'qin-garden']);

export const TRAVEL_GROUPS = [
  { id: 'all', name: '全部', en: 'All' },
  { id: 'axis', name: '秦皇游线', en: 'Imperial' },
  { id: 'west', name: '战国风情', en: 'Seven States' },
  { id: 'east', name: '海滨园林', en: 'Coast & Garden' },
];

export const TRAVEL_DESTINATIONS = [
  QIN_STATIONS.find(station => station.id === 'qin-island'),
  ...QIN_ATTRACTIONS.map(attraction => {
    const station = QIN_STATIONS.find(entry => entry.id === attraction.id);
    return station || { id: attraction.id, name: attraction.name, en: attraction.en, ...EXTRA_STOPS[attraction.id] };
  }),
  QIN_STATIONS.find(station => station.id === 'qin-garden'),
].map(station => ({ ...station, floor: station.floor || 0, group: WEST.has(station.id) ? 'west' : EAST.has(station.id) ? 'east' : 'axis' }));

export const HOME_DESTINATION = { id: 'home-island', name: '返回主岛', en: 'Return Home',
  at: [SPAWN.x, SPAWN.z], look: [SPAWN.x + Math.sin(SPAWN.heading), SPAWN.z + Math.cos(SPAWN.heading)], floor: 0, icon: 'logo' };

export function travelLanding(nav, destination) {
  const stand = nav.nearestStand(...destination.at);
  if (!stand || !nav.canStand(stand.x, stand.z) || inPool(stand.x, stand.z)
    || Math.hypot(stand.x - destination.at[0], stand.z - destination.at[1]) > 2.5
    || Math.abs(nav.heightAt(stand.x, stand.z) - destination.floor) > 0.2) return null;
  return stand;
}
