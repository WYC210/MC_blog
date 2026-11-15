import * as THREE from 'three';
import { ISLAND } from './layout.js';
import { rng } from '@engine/world/textures.js';
import { terrainProfile } from './detail-profiles.js';
import { detailUniforms, detailMotion } from './detail-state.js';
import { createRainPuddles } from './rain-puddles.js';

function terrainTexture(world, shelter) {
  const width = ISLAND.x1 - ISLAND.x0, depth = ISLAND.z1 - ISLAND.z0;
  const data = new Uint8Array(width * depth * 4);
  for (let row = 0; row < depth; row++) for (let column = 0; column < width; column++) {
    const horizontal = ISLAND.x0 + column, vertical = ISLAND.z0 + row;
    const type = world.grid.type(horizontal, -1, vertical)?.name;
    const exposed = shelter.topAt(horizontal + 0.5, vertical + 0.5) < 0.7;
    const offset = (column + row * width) * 4;
    data.set(terrainProfile(type, exposed), offset);
    if (type !== 'sand' && type !== 'qin-sand') continue;
    for (let distance = 1; distance <= 3; distance++) {
      const sea = !world.grid.get(horizontal + distance, -1, vertical) || !world.grid.get(horizontal - distance, -1, vertical)
        || !world.grid.get(horizontal, -1, vertical + distance) || !world.grid.get(horizontal, -1, vertical - distance);
      if (sea) { data[offset + 3] = Math.round((4 - distance) / 3 * 255); break; }
    }
  }
  const texture = new THREE.DataTexture(data, width, depth);
  texture.name = 'terrain-emission-and-shore'; texture.needsUpdate = true;
  return texture;
}

const vertex = /* glsl */`
  attribute vec4 aSeed;
  attribute vec2 aVariation;
  uniform sampler2D uDetailTerrain;
  uniform vec4 uDetailBounds;
  uniform vec2 uDetailFocus;
  uniform float uDetailViewport;
  uniform float uDetailWet;
  varying vec2 vGrainUv;
  varying float vGrainKind;
  varying float vGrainAlpha;
  varying float vGrainTone;
  ${detailMotion}
  #include <fog_pars_vertex>
  void main() {
    float drift = uDetailTime * (0.7 + uDetailWind * 5.5) * (0.8 + aVariation.x * 0.5);
    vec2 field = aSeed.xy * 52.0 + uDetailDirection * drift;
    field += vec2(sin(uDetailTime * 0.65 + aSeed.z * 33.0), cos(uDetailTime * 0.43 + aSeed.z * 21.0)) * 0.25 * uDetailWind;
    vec2 ground = mod(field - uDetailFocus + 26.0, 52.0) - 26.0 + uDetailFocus;
    vec4 terrain = texture2D(uDetailTerrain, (ground - uDetailBounds.xy) * uDetailBounds.zw);
    float kind = aSeed.w < 0.72 && terrain.r > 0.1 ? 0.0 : (aSeed.w > 0.9 && terrain.b > 0.1 ? 2.0 : 1.0);
    float density = kind < 0.5 ? terrain.r : (kind > 1.5 ? terrain.b : terrain.g);
    float gust = 0.78 + 0.22 * sin(uDetailTime * 0.8 + dot(ground, vec2(0.17, 0.11)));
    float amount = pow(uDetailWind, 1.15) * gust * (1.0 - uDetailWet * 0.96) * uDetailMotion;
    float accepted = step(aVariation.y, density * amount);
    float phase = fract(aSeed.z + uDetailTime * (0.65 + uDetailWind * 1.5));
    float height = kind < 0.5 ? 0.025 + sin(phase * 3.14159) * (0.05 + aVariation.x * 0.25) :
      (kind > 1.5 ? 0.12 + sin(phase * 3.14159) * 1.25 : 0.08 + sin(phase * 3.14159) * (0.25 + aVariation.x * 0.75));
    vec4 mvPosition = modelViewMatrix * vec4(ground.x, height, ground.y, 1.0);
    float size = kind < 0.5 ? 0.012 + aVariation.x * 0.019 : (kind > 1.5 ? 0.08 + aVariation.x * 0.09 : 0.05 + aVariation.x * 0.12);
    float pixel = 2.0 * max(0.1, -mvPosition.z) / (projectionMatrix[1][1] * uDetailViewport);
    float coverage = min(1.0, size / max(pixel * 0.8, 0.0001));
    size = max(size, pixel * 0.8);
    float rotation = aSeed.z * 6.283 + uDetailTime * (kind > 1.5 ? 3.0 : 0.5);
    vec2 corner = position.xy;
    if (kind > 1.5) corner *= vec2(1.0, 0.35 + abs(sin(uDetailTime * 4.0 + aSeed.z * 13.0)) * 0.4);
    corner = mat2(cos(rotation), -sin(rotation), sin(rotation), cos(rotation)) * corner;
    mvPosition.xy += corner * size;
    gl_Position = projectionMatrix * mvPosition;
    vGrainUv = uv; vGrainKind = kind; vGrainTone = aVariation.x;
    vGrainAlpha = accepted * coverage * (1.0 - smoothstep(18.0, 26.0, length(ground - uDetailFocus)))
      * (0.4 + 0.6 * sin(phase * 3.14159));
    if (vGrainAlpha < 0.001) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    #include <fog_vertex>
  }
`;

const fragment = /* glsl */`
  varying vec2 vGrainUv;
  varying float vGrainKind;
  varying float vGrainAlpha;
  varying float vGrainTone;
  uniform float uDetailDaylight;
  #include <fog_pars_fragment>
  void main() {
    vec2 point = vGrainUv * 2.0 - 1.0;
    float edge = max(abs(point.y), abs(point.x) * 0.85 + abs(point.y) * 0.45);
    float alpha = (1.0 - smoothstep(0.6, 1.0, edge)) * vGrainAlpha;
    vec3 color = mix(vec3(0.43, 0.29, 0.12), vec3(0.85, 0.73, 0.49), vGrainTone);
    if (vGrainKind > 0.5 && vGrainKind < 1.5) {
      alpha *= (1.0 - smoothstep(0.0, 1.0, dot(point, point))) * 0.2;
      color = mix(vec3(0.39, 0.32, 0.21), vec3(0.63, 0.54, 0.35), vGrainTone);
    } else if (vGrainKind > 1.5) {
      float leaf = abs(point.x) + point.y * point.y;
      alpha *= 1.0 - smoothstep(0.65, 0.95, leaf);
      color = mix(vec3(0.23, 0.25, 0.09), vec3(0.42, 0.28, 0.12), vGrainTone);
    }
    if (alpha < 0.003) discard;
    color *= mix(0.16, 1.0, uDetailDaylight);
    gl_FragColor = vec4(color, alpha * 0.8);
    #include <fog_fragment>
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createEnvironment({ stage, world, weatherFx, player }) {
  const texture = terrainTexture(world, weatherFx.shelter);
  detailUniforms.uDetailTerrain.value = texture;
  detailUniforms.uDetailBounds.value.set(ISLAND.x0, ISLAND.z0, 1 / texture.image.width, 1 / texture.image.height);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const puddles = createRainPuddles({ stage, world, shelter: weatherFx.shelter });
  const count = stage.quality.mobile ? 420 : 1400, random = rng(40615);
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, -.5, 0, .5, -.5, 0, -.5, .5, 0, .5, .5, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(Float32Array.from({ length: count * 4 }, random), 4));
  geometry.setAttribute('aVariation', new THREE.InstancedBufferAttribute(Float32Array.from({ length: count * 2 }, random), 2));
  geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({ uniforms: detailUniforms, vertexShader: vertex, fragmentShader: fragment,
    transparent: true, depthWrite: false, fog: true });
  const particles = new THREE.Mesh(geometry, material);
  particles.name = 'terrain-wind-grains'; particles.frustumCulled = false;
  stage.scene.add(particles);
  return {
    particles, texture, uniforms: detailUniforms, puddles,
    update(dt, weather) {
      const motion = reduced.matches ? 0 : 1;
      detailUniforms.uDetailTime.value += Math.min(dt, 0.1) * motion;
      detailUniforms.uDetailMotion.value = motion;
      detailUniforms.uDetailWind.value = Math.max(0, Math.min(1, weather.wind || 0));
      detailUniforms.uDetailWet.value = Math.max(weather.wet || 0, weather.rain || 0);
      detailUniforms.uDetailRain.value = weather.rain || 0;
      puddles.update(dt, weather);
      detailUniforms.uDetailFocus.value.set(player.pos.x * 0.7 + stage.camera.position.x * 0.3, player.pos.z * 0.7 + stage.camera.position.z * 0.3);
      detailUniforms.uDetailViewport.value = stage.renderer.domElement.height;
      detailUniforms.uDetailDaylight.value = 1 - stage.night * 0.9;
      particles.visible = motion > 0 && weather.wind > 0.05 && detailUniforms.uDetailWet.value < 0.96 && player.y < 9 && !stage.submerged;
    },
  };
}
