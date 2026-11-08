import * as THREE from 'three';

const CUTAWAY = `
  if (vQinCinematicMask > 0.5 && uQinCinematicFade > 0.001) {
    vec2 pixel = mod(floor(gl_FragCoord.xy), 4.0);
    vec2 lower = mod(pixel, 2.0);
    vec2 upper = floor(pixel / 2.0);
    float fine = 2.0 * lower.x + 3.0 * lower.y - 4.0 * lower.x * lower.y;
    float coarse = 2.0 * upper.x + 3.0 * upper.y - 4.0 * upper.x * upper.y;
    float threshold = (4.0 * fine + coarse + 0.5) / 16.0;
    if (threshold > 1.0 - uQinCinematicFade) discard;
  }
`;

export function createQinCinematicOcclusion({ root, camera }) {
  const fade = { value: 0 }, bounds = new THREE.Box3(), partBounds = new THREE.Box3();
  const matrix = new THREE.Matrix4(), ray = new THREE.Ray(), hit = new THREE.Vector3(), sample = new THREE.Vector3();
  const right = new THREE.Vector3(), up = new THREE.Vector3();
  let parts = 0, occluded = false, hold = 0;
  root.updateMatrixWorld(true);
  root.traverse(mesh => {
    if (!mesh.isInstancedMesh || !mesh.material?.isMeshLambertMaterial) return;
    const mask = new Float32Array(mesh.count), tags = mesh.userData.tags || [];
    let selected = 0;
    for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, matrix); matrix.premultiply(mesh.matrixWorld);
      partBounds.min.set(-0.5, -0.5, -0.5); partBounds.max.set(0.5, 0.5, 0.5); partBounds.applyMatrix4(matrix);
      const plinth = !tags[index] && partBounds.min.x >= 153.9 && partBounds.max.x <= 166.1
        && partBounds.min.z >= 3.9 && partBounds.max.z <= 16.1 && partBounds.min.y >= -0.01 && partBounds.max.y <= 1.5;
      if (!tags[index]?.startsWith('qin-emperor:') && !plinth) continue;
      mask[index] = 1; selected++; bounds.union(partBounds);
    }
    if (!selected) return;
    parts += selected;
    mesh.geometry.setAttribute('iQinCinematicMask', new THREE.InstancedBufferAttribute(mask, 1));
    const original = mesh.material, material = original.clone(), compile = original.onBeforeCompile, key = original.customProgramCacheKey();
    material.name = 'qin-cinematic-cutaway';
    material.onBeforeCompile = function (shader, renderer) {
      compile.call(this, shader, renderer);
      shader.uniforms.uQinCinematicFade = fade;
      shader.vertexShader = 'attribute float iQinCinematicMask;\nvarying float vQinCinematicMask;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvQinCinematicMask = iQinCinematicMask;');
      shader.fragmentShader = 'uniform float uQinCinematicFade;\nvarying float vQinCinematicMask;\n' + shader.fragmentShader
        .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${CUTAWAY}`);
    };
    material.customProgramCacheKey = () => `${key}-qin-cinematic-cutaway-v1`;
    mesh.material = material;
  });
  function intersects(target) {
    ray.origin.copy(camera.position); ray.direction.subVectors(target, camera.position);
    const distance = ray.direction.lengthSq();
    ray.direction.normalize();
    return !!ray.intersectBox(bounds, hit) && hit.distanceToSquared(camera.position) < distance;
  }
  function reset() { fade.value = 0; hold = 0; occluded = false; }
  function update(dt, focus) {
    if (!parts) return;
    const inside = bounds.containsPoint(camera.position);
    occluded = inside || intersects(focus);
    if (!occluded) {
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      for (let corner = 0; corner < 4 && !occluded; corner++) {
        sample.copy(focus).addScaledVector(right, corner % 2 ? 4.8 : -4.8).addScaledVector(up, corner < 2 ? -1.2 : 1.2);
        occluded = intersects(sample);
      }
    }
    hold = occluded ? 0.18 : Math.max(0, hold - dt);
    const target = hold > 0 ? inside ? 1 : 0.92 : 0;
    if (inside) fade.value = 1;
    else fade.value += (target - fade.value) * (1 - Math.exp(-dt * (target ? 24 : 7)));
    if (Math.abs(fade.value - target) < 0.001) fade.value = target;
  }
  return { update, reset, bounds, get strength() { return fade.value; }, get occluded() { return occluded; }, get parts() { return parts; } };
}
