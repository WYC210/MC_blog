import * as THREE from 'three';
import { ULTRA } from '@engine/ultra-flag.js';

export function createMaterialProbe(stage, materials) {
  if (!ULTRA) return null;
  const generator = new THREE.PMREMGenerator(stage.renderer);
  const scene = stage.scene;
  const targets = ['voxel', 'voxelCutout', 'box', 'boxCutout', 'puddle'].map(name => materials[name]).filter(Boolean);
  const uniforms = stage.sky.material.uniforms;
  const captured = new THREE.Color(-1, -1, -1), direction = new THREE.Vector3();
  let target = null, clock = 0, captures = 0, lastNight = -1;

  function capture() {
    const renderer = stage.renderer;
    const toneMapping = renderer.toneMapping, shadowUpdate = renderer.shadowMap.needsUpdate;
    const hidden = [];
    scene.traverse(object => {
      if (!object.isMesh) return;
      const list = Array.isArray(object.material) ? object.material : [object.material];
      if (list.some(material => targets.includes(material))) {
        hidden.push([object, object.visible]);
        object.visible = false;
      }
    });
    let next;
    try {
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.shadowMap.needsUpdate = false;
      next = generator.fromScene(scene, 0.03, 0.1, 900, { size: 128 });
    } finally {
      renderer.toneMapping = toneMapping;
      renderer.shadowMap.needsUpdate = shadowUpdate;
      for (const [object, visible] of hidden) object.visible = visible;
    }
    next.texture.name = 'surface-sky-probe';
    for (const material of targets) {
      const fresh = !material.envMap;
      material.envMap = next.texture;
      material.envMapIntensity = 1.15;
      if (fresh) material.needsUpdate = true;
    }
    target?.dispose(); target = next;
    captured.copy(uniforms.uTop.value); direction.copy(uniforms.uSunDir.value);
    lastNight = stage.night; captures++;
  }

  capture();
  return {
    capture,
    update(dt) {
      clock += dt;
      if (clock < 2) return;
      clock = 0;
      const top = uniforms.uTop.value;
      const changed = Math.abs(top.r - captured.r) + Math.abs(top.g - captured.g) + Math.abs(top.b - captured.b);
      if (changed > 0.12 || direction.distanceToSquared(uniforms.uSunDir.value) > 0.03 || Math.abs(stage.night - lastNight) > 0.12) capture();
    },
    get stats() { return { captures, size: 128, texture: target.texture.name }; },
    dispose() { target.dispose(); generator.dispose(); },
  };
}
