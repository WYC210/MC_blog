import * as THREE from 'three';
import { qinFloorAt } from './qin-island-layout.js';

export function createQinPalaceStructure({ slab, stairs, roofs }) {
  const surfaces = [], bounds = new THREE.Box3();
  function register(matrix, site, tread = false) {
    bounds.min.set(-0.5, -0.5, -0.5); bounds.max.set(0.5, 0.5, 0.5); bounds.applyMatrix4(matrix);
    surfaces.push({ x0: bounds.min.x, x1: bounds.max.x, z0: bounds.min.z, z1: bounds.max.z,
      bottom: bounds.min.y, y: bounds.max.y, site, tread });
  }
  register(slab, 'qin-palace-gallery');
  for (const matrix of stairs) register(matrix, 'qin-palace-stairs', true);
  for (const item of roofs) register(item.matrix, 'qin-palace-roof');
  function within(surface, x, z, margin = 0) {
    return x >= surface.x0 - margin && x < surface.x1 + margin && z >= surface.z0 - margin && z < surface.z1 + margin;
  }
  return {
    surfaces,
    levels(x, z, out) { for (const surface of surfaces) if (within(surface, x, z)) out.push(surface); },
    collides(x, feet, z) {
      for (const surface of surfaces) {
        if (surface.tread && feet >= qinFloorAt(x, z) - 0.7) continue;
        if (feet >= surface.y - (surface.site === 'qin-palace-gallery' ? 0.23 : 0.01) || feet + 1.8 <= surface.bottom + 0.01) continue;
        if (within(surface, x, z, 0.28)) return true;
      }
      return false;
    },
    roofVisible(player, camera) {
      const playerInside = player.pos.x > 141 && player.pos.x < 181 && player.pos.z > -47 && player.pos.z < -21 && player.y > 2.5 && player.y < 10.5;
      const cameraInside = camera.position.x > 140 && camera.position.x < 182 && camera.position.z > -48 && camera.position.z < -20 && camera.position.y < 10.56;
      return !playerInside || cameraInside;
    },
  };
}
