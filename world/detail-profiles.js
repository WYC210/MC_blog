import { SURFACE_TILES } from './material-palette.js';

export const DETAIL_KINDS = Object.freeze({ plain: 0, sand: 1, wood: 2, stone: 3, metal: 4, cloth: 5, brick: 6, soil: 7, plaster: 8, leather: 9,
  endgrain: 10, smooth: 11, tile: 12, polished: 13, rubber: 14, rope: 15, timber: 16, concrete: 17, terracotta: 18, foliage: 19 });

const profiles = [
  ['sand', ['sand'], 0.91, 0],
  ['wood', ['oak', 'wood_floor', 'wood_panel', 'parquet', 'walnut', 'maple', 'deck', 'greige_floor', SURFACE_TILES.wood], 0.73, 0],
  ['timber', ['log', SURFACE_TILES.timber], 0.84, 0],
  ['endgrain', ['log_top', SURFACE_TILES.endgrain], 0.87, 0],
  ['stone', ['stone', 'deepslate', 'travertine', 'gravel', SURFACE_TILES.stone, SURFACE_TILES.sandstone], 0.87, 0],
  ['smooth', [SURFACE_TILES.smooth, SURFACE_TILES.quartz], 0.48, 0],
  ['polished', ['prada_marble', 'prada'], 0.2, 0],
  ['tile', ['pool_tile', 'pool_deep'], 0.24, 0],
  ['concrete', ['concrete', SURFACE_TILES.concrete], 0.91, 0],
  ['metal', ['stainless'], 0.32, 1],
  ['metal', ['chrome'], 0.14, 1],
  ['metal', ['steel'], 0.48, 0.93],
  ['metal', ['black_metal'], 0.57, 0.85],
  ['cloth', ['linen', 'velvet', 'chair_mesh', SURFACE_TILES.cloth], 0.97, 0],
  ['brick', ['pavers', 'white_brick', 'roof'], 0.89, 0],
  ['terracotta', ['terracotta', SURFACE_TILES.terracotta], 0.88, 0],
  ['soil', ['dirt', 'grass_top', 'grass_side'], 0.98, 0],
  ['plaster', ['plaster', 'white', 'paint'], 0.8, 0],
  ['leather', ['leather'], 0.68, 0],
  ['rubber', ['rubber'], 0.94, 0],
  ['rope', [SURFACE_TILES.rope], 0.98, 0],
  ['foliage', ['leaves', 'leaves_olive', 'leaves_osmanthus', 'foliage', SURFACE_TILES.foliage], 0.95, 0],
];

export function detailProfile(name) {
  const entry = profiles.find(profile => profile[1].includes(name));
  return entry ? { kind: DETAIL_KINDS[entry[0]], roughness: entry[2], metalness: entry[3] } : { kind: 0, roughness: 0.9, metalness: 0 };
}

export function terrainProfile(type, exposed) {
  if (!exposed) return [0, 0, 0];
  type = typeof type === 'string' ? type : type?.name;
  if (type === 'sand') return [255, 0, 0];
  if (type === 'qin-sand') return [150, 100, 0];
  if (type === 'qin-grass') return [0, 85, 210];
  if (type === 'qin-path') return [0, 170, 28];
  return [0, 0, 0];
}

export function materialDetailStrength(emissive) {
  return 1 - Math.min(1, Math.max(0, (emissive - 0.65) / 0.35));
}
