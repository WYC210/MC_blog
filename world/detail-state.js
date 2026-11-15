import * as THREE from 'three';

const empty = new THREE.DataTexture(new Uint8Array(4), 1, 1);
empty.needsUpdate = true;

export const detailUniforms = {
  ...THREE.UniformsLib.fog,
  uDetailTime: { value: 0 },
  uDetailWind: { value: 0.2 },
  uDetailWet: { value: 0 },
  uDetailRain: { value: 0 },
  uDetailMotion: { value: 1 },
  uDetailDirection: { value: new THREE.Vector2(0.88, 0.475).normalize() },
  uDetailTerrain: { value: empty },
  uDetailBounds: { value: new THREE.Vector4(0, 0, 1, 1) },
  uDetailFocus: { value: new THREE.Vector2() },
  uDetailViewport: { value: 800 },
  uDetailDaylight: { value: 1 },
};

export const detailNoise = /* glsl */`
  float detailHash(vec2 coordinate) {
    vec3 seed = fract(vec3(coordinate.xyx) * 0.1031);
    seed += dot(seed, seed.yzx + 33.33);
    return fract((seed.x + seed.y) * seed.z);
  }
  float detailNoise(vec2 coordinate) {
    vec2 cell = floor(coordinate), blend = fract(coordinate);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return mix(mix(detailHash(cell), detailHash(cell + vec2(1.0, 0.0)), blend.x),
      mix(detailHash(cell + vec2(0.0, 1.0)), detailHash(cell + 1.0), blend.x), blend.y);
  }
`;

export const detailMotion = /* glsl */`
  uniform float uDetailTime;
  uniform float uDetailWind;
  uniform float uDetailMotion;
  uniform vec2 uDetailDirection;
`;
