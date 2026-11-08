import * as THREE from 'three';
import { boxRegions } from '@engine/world/skin.js';

export function createImperialSkin(avatar) {
  const original = avatar.material.map;
  let texture = null;
  function create() {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const paint = canvas.getContext('2d');
    const fill = (x, y, width, height, color) => { paint.fillStyle = color; paint.fillRect(x, y, width, height); };
    const ink = '#35464c', shade = '#26353c', gold = '#e2bc70', skin = '#e3b68b', beard = '#594331', red = '#a65a42';
    for (const [column, row, width, height, depth] of [[0, 0, 8, 8, 8], [16, 16, 8, 12, 4], [40, 16, 4, 12, 4], [32, 48, 4, 12, 4], [0, 16, 4, 12, 4], [16, 48, 4, 12, 4]]) {
      const regions = boxRegions(column, row, width, height, depth);
      for (const [index, region] of regions.entries()) fill(...region, index % 2 ? shade : ink);
      if (row === 0) continue;
      for (const [index, region] of regions.entries()) {
        if (index === 2 || index === 3) continue;
        const [left, top, across, tall] = region;
        fill(left, top + 7, across, 1, gold);
        if (column === 16 && row === 16) {
          fill(left + Math.max(1, Math.floor(across / 2) - 1), top + 2, 2, tall - 2, red);
          fill(left, top + 7, across, 1, gold);
          fill(left + 1, top + 1, 1, 5, gold); fill(left + across - 2, top + 1, 1, 5, gold);
        } else if (column === 40 || column === 32) fill(left, top + 9, across, 3, skin);
        else { fill(left + 1, top, 1, 9, gold); fill(left, top + 10, across, 2, beard); }
      }
    }
    for (const left of [0, 8, 16]) fill(left, 8, 8, 8, skin);
    fill(8, 8, 8, 2, ink); fill(8, 9, 8, 1, gold);
    fill(9, 11, 2, 1, beard); fill(13, 11, 2, 1, beard);
    fill(10, 12, 1, 1, '#241f1b'); fill(13, 12, 1, 1, '#241f1b');
    fill(11, 13, 2, 1, '#c9976d'); fill(10, 14, 4, 1, beard); fill(11, 15, 2, 1, beard);
    fill(0, 8, 8, 3, ink); fill(16, 8, 8, 3, ink); fill(24, 8, 8, 8, beard);
    fill(40, 0, 8, 8, ink); fill(32, 8, 32, 2, ink); fill(32, 9, 32, 1, gold);
    for (const column of [40, 42, 45, 47, 56, 58, 61, 63]) fill(column, 10, 1, 3, gold);
    const result = new THREE.CanvasTexture(canvas);
    result.name = 'qin-emperor-player-skin'; result.colorSpace = THREE.SRGBColorSpace;
    result.magFilter = result.minFilter = THREE.NearestFilter; result.generateMipmaps = false;
    result.userData.png = canvas.toDataURL('image/png');
    return result;
  }
  return {
    wear() { texture ||= create(); avatar.material.map = texture; },
    restore() { avatar.material.map = original; },
    get worn() { return !!texture && avatar.material.map === texture; },
  };
}
