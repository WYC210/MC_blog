export const SURFACE_TILES = Object.freeze({
  wood: 'surface_wood', timber: 'surface_timber', endgrain: 'surface_endgrain',
  stone: 'surface_stone', smooth: 'surface_smooth', sandstone: 'surface_sandstone',
  cloth: 'surface_cloth', rope: 'surface_rope', concrete: 'surface_concrete',
  terracotta: 'surface_terracotta', foliage: 'surface_foliage', quartz: 'surface_quartz',
});

const planks = { all: SURFACE_TILES.wood };
const timber = { top: SURFACE_TILES.endgrain, bottom: SURFACE_TILES.endgrain, side: SURFACE_TILES.timber };
const stone = { all: SURFACE_TILES.stone };
const smooth = { all: SURFACE_TILES.smooth };
const concrete = { all: SURFACE_TILES.concrete };
const cloth = { all: SURFACE_TILES.cloth };

export const MODEL_SURFACES = Object.freeze({
  i_white: concrete, i_black: concrete, i_lgray: concrete, i_yellow: concrete, i_orange: concrete, i_red: concrete,
  i_head_black: concrete, i_head_lgray: concrete,
  i_terra: { all: SURFACE_TILES.terracotta }, i_head_terra: { all: SURFACE_TILES.terracotta },
  i_wool: cloth, i_head_gray: cloth, l_bwool: cloth, l_ywool: cloth, l_ggray: concrete,
  l_sdoak: timber, l_doak: planks, l_andesite: stone,
  l_moss: { all: SURFACE_TILES.foliage }, l_cplank: planks, l_scherry: timber, l_cherry: timber,
  g_oak: planks, g_splank: planks, g_olog: timber, g_slog: timber, g_soak: timber,
  g_sspruce: timber, g_sjungle: timber, g_stone: stone, g_tuff: stone, g_andesite: stone, g_diorite: stone,
  g_sstone: smooth, g_ssand: { all: SURFACE_TILES.sandstone },
});

export function restoreModelMaterials(grid) {
  for (const type of grid.types) {
    if (type && MODEL_SURFACES[type.name]) type.tex = { ...MODEL_SURFACES[type.name] };
  }
}

export function materialForBlock(name, look) {
  if (!look || look.glass || /moss|dripleaf/.test(name)) return look;
  if (/wool|carpet|banner|_bed$/.test(name)) return { ...look, tex: SURFACE_TILES.cloth };
  if (/log$/.test(name)) return { ...look, tex: SURFACE_TILES.timber, top: SURFACE_TILES.endgrain, bottom: SURFACE_TILES.endgrain };
  if (/(oak|birch|spruce|jungle|cherry|bamboo).*(planks|stairs|slab|fence|trapdoor)/.test(name)) return { ...look, tex: SURFACE_TILES.wood };
  if (/sandstone/.test(name)) return { ...look, tex: SURFACE_TILES.sandstone };
  if (/smooth_stone/.test(name)) return { ...look, tex: SURFACE_TILES.smooth };
  if (/andesite|diorite|tuff/.test(name)) return { ...look, tex: SURFACE_TILES.stone };
  if (/quartz/.test(name)) return { ...look, tex: SURFACE_TILES.quartz };
  if (/terracotta/.test(name)) return { ...look, tex: SURFACE_TILES.terracotta };
  return look;
}

function noise(column, row, seed = 0) {
  const value = Math.sin(column * 12.9898 + row * 78.233 + seed * 17.13) * 43758.5453;
  return value - Math.floor(value);
}

export function surfaceTile(name, size = 16) {
  const pixels = new Uint8Array(size * size * 4);
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) {
    const horizontal = column / size, vertical = row / size, grain = noise(column, row);
    let tone = 0.96 + (grain - 0.5) * 0.04;
    if (name === SURFACE_TILES.wood) {
      const board = Math.floor(vertical * 4);
      tone -= Math.sin(horizontal * 12 + board * 3) * 0.016 + noise(board, 0) * 0.025;
      if (row % 4 === 3) tone -= 0.075;
    } else if (name === SURFACE_TILES.timber) {
      tone -= (Math.sin(horizontal * 34 + Math.sin(vertical * 5)) * 0.5 + 0.5) * 0.075;
    } else if (name === SURFACE_TILES.endgrain) {
      const radius = Math.hypot(horizontal - 0.38, vertical - 0.46);
      tone -= (Math.sin(radius * 85) * 0.5 + 0.5) * 0.11;
    } else if (name === SURFACE_TILES.stone || name === SURFACE_TILES.sandstone) {
      tone -= noise(Math.floor(column / 3), Math.floor(row / 3)) * 0.08 + (grain > 0.94 ? 0.1 : 0);
    } else if (name === SURFACE_TILES.cloth) {
      tone -= (column + row) % 2 ? 0.045 : 0;
    } else if (name === SURFACE_TILES.rope) {
      tone -= ((column + row * 2) % 6) / 6 * 0.16;
    } else if (name === SURFACE_TILES.foliage) {
      tone -= grain * 0.16;
    } else if (name === SURFACE_TILES.terracotta || name === SURFACE_TILES.concrete) {
      tone -= grain > 0.92 ? 0.08 : 0;
    }
    const value = Math.round(Math.min(1, Math.max(0, tone)) * 255);
    pixels.set([value, value, value, 255], (column + (size - 1 - row) * size) * 4);
  }
  return pixels;
}

export function installSurfaceTiles(materials, layer) {
  const texture = materials.uniforms.uTiles.value;
  const names = Object.values(SURFACE_TILES).filter(name => layer[name] === undefined);
  if (!names.length) return;
  const image = texture.image, stride = image.width * image.height * 4;
  const pixels = new Uint8Array((image.depth + names.length) * stride);
  pixels.set(image.data);
  names.forEach((name, index) => {
    layer[name] = image.depth + index;
    pixels.set(surfaceTile(name, image.width), layer[name] * stride);
  });
  image.data = pixels; image.depth += names.length;
  texture.needsUpdate = true;
}
