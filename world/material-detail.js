import * as THREE from 'three';
import { ULTRA } from '@engine/ultra-flag.js';
import { detailProfile } from './detail-profiles.js';
import { detailUniforms, detailNoise } from './detail-state.js';
import { SURFACE_DETAIL } from './surface-shader.js';

const head = /* glsl */`
  uniform sampler2D uDetailProfiles;
  uniform float uDetailProfileWidth;
  uniform sampler2D uDetailTerrain;
  uniform vec4 uDetailBounds;
  uniform float uDetailWet;
  ${detailNoise}
  float detailSeam(float coordinate, float frequency, float width) {
    float edge = min(fract(coordinate * frequency), 1.0 - fract(coordinate * frequency));
    float antialias = max(fwidth(coordinate * frequency), 0.0001);
    return (1.0 - smoothstep(width, width + antialias, edge)) * (1.0 - smoothstep(0.25, 0.6, antialias));
  }
  float detailBand(vec2 coordinate, float frequency) {
    float footprint = max(length(dFdx(coordinate)), length(dFdy(coordinate))) * frequency;
    return 1.0 - smoothstep(0.3, 1.1, footprint);
  }
`;

const normal = /* glsl */`
  #include <normal_fragment_maps>
  vec3 detailDx = dFdx(-vViewPosition), detailDy = dFdy(-vViewPosition);
  vec3 detailCrossX = cross(detailDy, normal), detailCrossY = cross(normal, detailDx);
  float detailDet = dot(detailDx, detailCrossX);
  vec3 detailGradient = sign(detailDet) * (dFdx(detailHeight) * detailCrossX + dFdy(detailHeight) * detailCrossY);
  normal = normalize(max(abs(detailDet), 0.00000001) * normal - detailGradient);
`;

export function installMaterialDetails(materials, layer) {
  if (!ULTRA) return;
  const width = Math.max(...Object.values(layer)) + 1;
  const data = new Uint8Array(width * 4);
  for (const [name, index] of Object.entries(layer)) {
    const profile = detailProfile(name);
    data.set([profile.kind, Math.round(profile.roughness * 255), Math.round(profile.metalness * 255), 255], index * 4);
  }
  const profiles = new THREE.DataTexture(data, width, 1);
  profiles.name = 'surface-detail-profiles';
  profiles.minFilter = profiles.magFilter = THREE.NearestFilter;
  profiles.generateMipmaps = false; profiles.needsUpdate = true;
  const uniforms = { ...detailUniforms, uDetailProfiles: { value: profiles }, uDetailProfileWidth: { value: width } };
  for (const name of ['voxel', 'voxelCutout', 'box', 'boxCutout']) {
    const original = materials[name];
    const material = new THREE.MeshStandardMaterial({
      vertexColors: original.vertexColors, side: original.side, roughness: 0.9, metalness: 0,
      transparent: original.transparent, opacity: original.opacity, depthWrite: original.depthWrite,
    });
    material.name = `detailed-${name}`;
    material.defines = { ...original.defines };
    material.onBeforeCompile = (shader, renderer) => {
      original.onBeforeCompile(shader, renderer);
      Object.assign(shader.uniforms, uniforms);
      const hd = material.userData.hdMaterials;
      if (hd) Object.assign(shader.uniforms, hd.uniforms);
      shader.fragmentShader = head + shader.fragmentShader
        .replace('#include <color_fragment>', SURFACE_DETAIL)
        .replace('#include <normal_fragment_maps>', normal + (hd?.normal || ''))
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = clamp(detailRoughness, 0.045, 1.0);')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = detailMetalness;');
      if (hd) shader.fragmentShader = hd.head + shader.fragmentShader
        .replace('vec4 tileTexel = texture(uTiles, vTex);', hd.color);
    };
    material.customProgramCacheKey = () => `${original.customProgramCacheKey()}-surface-detail-v2-${!!material.userData.hdMaterials}`;
    material.userData.surfaceDetails = { profiles, uniforms, version: 2 };
    materials[name] = material;
  }
  materials.boxMetal = materials.box;
}
