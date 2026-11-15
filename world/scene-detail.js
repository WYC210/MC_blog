import * as THREE from 'three';
import { ULTRA } from '@engine/ultra-flag.js';
import { detailUniforms, detailNoise, detailMotion } from './detail-state.js';

const clothVertex = /* glsl */`
  attribute vec4 aCloth;
  attribute vec4 aFrame;
  varying vec2 vFabric;
  ${detailMotion}
  vec3 clothOffset() {
    float freeEdge = mix(aCloth.x, 1.0 - aCloth.y, aCloth.z);
    float gust = 0.75 + 0.25 * sin(uDetailTime * 0.67 + aCloth.w);
    float strength = (0.045 + uDetailWind * 0.38 * gust) * uDetailMotion;
    float phase = uDetailTime * (2.2 + uDetailWind * 3.0) - freeEdge * 6.5 + aCloth.w;
    float billow = sin(phase + aCloth.y * 1.8) * 0.68 + sin(phase * 1.87 - aCloth.y * 5.0) * 0.22;
    float fold = billow * strength * freeEdge * freeEdge * min(aFrame.w, 2.2);
    float flutter = sin(phase * 2.7 + aCloth.x * 11.0) * strength * 0.055 * freeEdge;
    return vec3(aFrame.y * fold + aFrame.x * flutter,
      -freeEdge * freeEdge * (1.0 - aCloth.z) * aFrame.w * 0.045 + flutter * 0.5, aFrame.x * fold - aFrame.y * flutter);
  }
`;

function clothMaterial(texture) {
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.98, metalness: 0, side: THREE.DoubleSide, flatShading: true });
  material.name = 'woven-wind-cloth';
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, detailUniforms);
    shader.vertexShader = clothVertex + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      transformed += clothOffset();
      vFabric = aCloth.xy * aFrame.zw;
    `);
    shader.fragmentShader = 'varying vec2 vFabric;\n' + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float fabricFootprint = max(length(dFdx(vFabric)), length(dFdy(vFabric))) * 95.0;
      float fabricBand = 1.0 - smoothstep(0.3, 1.0, fabricFootprint);
      float fabricWeave = sin(vFabric.x * 590.0) * sin(vFabric.y * 590.0);
      diffuseColor.rgb *= 1.0 + fabricWeave * 0.1 * fabricBand;
    `);
  };
  material.customProgramCacheKey = () => 'woven-wind-cloth-v1';
  return material;
}

function buildCloth(flags) {
  const designs = new Map();
  for (const flag of flags) {
    flag.design = `${flag.tint}:${flag.text}`;
    if (!designs.has(flag.design)) designs.set(flag.design, { index: designs.size, flag });
  }
  const columns = Math.ceil(Math.sqrt(designs.size)), tile = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = columns * tile;
  const context = canvas.getContext('2d');
  for (const { index, flag } of designs.values()) {
    const left = index % columns * tile, top = Math.floor(index / columns) * tile;
    context.fillStyle = `#${flag.tint.toString(16).padStart(6, '0')}`;
    context.fillRect(left, top, tile, tile);
    context.strokeStyle = flag.text ? '#b99b58' : '#ffffff40';
    context.lineWidth = 2; context.strokeRect(left + 3, top + 3, tile - 6, tile - 6);
    if (flag.text) {
      context.fillStyle = '#e4c888'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.font = 'bold 38px KaiTi, MicrosoftYaHei, serif';
      context.fillText(flag.text, left + tile / 2, top + tile / 2, 42);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const positions = [], coordinates = [], cloth = [], frames = [], indices = [];
  const horizontalSegments = 12, verticalSegments = 18;
  flags.forEach((flag, index) => {
    const offset = positions.length / 3, cosine = Math.cos(flag.yaw), sine = Math.sin(flag.yaw);
    const tileIndex = designs.get(flag.design).index;
    const atlasX = tileIndex % columns, atlasY = Math.floor(tileIndex / columns);
    for (let row = 0; row <= verticalSegments; row++) for (let column = 0; column <= horizontalSegments; column++) {
      const horizontal = column / horizontalSegments, vertical = row / verticalSegments;
      const localX = (horizontal - 0.5) * flag.width;
      const hem = row === 0 && flag.top ? Math.sin(column * 2.4) * 0.012 : 0;
      positions.push(flag.x + localX * cosine, flag.y + vertical * flag.height + hem, flag.z - localX * sine);
      coordinates.push((atlasX + (1 + horizontal * 62) / tile) / columns, 1 - (atlasY + (63 - vertical * 62) / tile) / columns);
      cloth.push(horizontal, vertical, flag.top ? 1 : 0, index * 1.73 + flag.x * 0.19 + flag.z * 0.11);
      frames.push(cosine, sine, flag.width, flag.height);
      if (row < verticalSegments && column < horizontalSegments) {
        const vertex = offset + row * (horizontalSegments + 1) + column;
        indices.push(vertex, vertex + 1, vertex + horizontalSegments + 2, vertex, vertex + horizontalSegments + 2, vertex + horizontalSegments + 1);
      }
    }
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setAttribute('aCloth', new THREE.Float32BufferAttribute(cloth, 4));
  geometry.setAttribute('aFrame', new THREE.Float32BufferAttribute(frames, 4));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 2;
  const mesh = new THREE.Mesh(geometry, clothMaterial(texture));
  mesh.name = 'wind-cloth'; mesh.receiveShadow = true;
  mesh.userData.flags = flags;
  return mesh;
}

function fireGeometry(fires, plume = false) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-.5, 0, 0, .5, 0, 0, -.5, 1, 0, .5, 1, 0], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  const origins = [], seeds = [], count = plume ? 12 : 2;
  fires.forEach((fire, index) => {
    for (let particle = 0; particle < count; particle++) {
      origins.push(fire.x, fire.y, fire.z, fire.scale);
      seeds.push(particle / count, index * 1.71 + particle * 2.39, particle < 8 ? 0 : 1);
    }
  });
  geometry.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(new Float32Array(origins), 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 3));
  geometry.instanceCount = fires.length * count;
  return geometry;
}

const flameVertex = /* glsl */`
  attribute vec4 aOrigin;
  attribute vec3 aSeed;
  varying vec2 vFireUv;
  varying float vFireSeed;
  varying float vFireFade;
  ${detailMotion}
  #include <fog_pars_vertex>
  void main() {
    float angle = aSeed.x * 3.14159;
    float flicker = 0.93 + 0.07 * sin(uDetailTime * 7.3 + aSeed.y);
    vec3 local = vec3(position.x * cos(angle), position.y * 1.25 * flicker, position.x * sin(angle));
    local.xz += uDetailDirection * pow(position.y, 2.0) * uDetailWind * 0.45;
    vec3 center = aOrigin.xyz + local * aOrigin.w;
    vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vFireUv = uv; vFireSeed = aSeed.y;
    vFireFade = 1.0 - smoothstep(35.0, 65.0, length(mvPosition.xyz));
    #include <fog_vertex>
  }
`;

const flameFragment = /* glsl */`
  varying vec2 vFireUv;
  varying float vFireSeed;
  varying float vFireFade;
  uniform float uDetailRain;
  ${detailMotion}
  ${detailNoise}
  #include <fog_pars_fragment>
  void main() {
    vec2 point = vFireUv;
    float clock = uDetailTime * (0.35 + 0.65 * uDetailMotion);
    float turbulence = detailNoise(vec2(point.x * 5.5 + vFireSeed, point.y * 4.0 - clock * 2.9));
    float tongues = detailNoise(vec2(point.x * 11.0 + vFireSeed, point.y * 8.0 - clock * 5.0));
    float lean = sin(point.y * 6.0 - clock * 4.0 + vFireSeed) * point.y * 0.09;
    float width = pow(max(0.0, 1.0 - point.y), 0.85) * (0.39 + turbulence * 0.15);
    float edge = width - abs(point.x - 0.5 + lean) - (1.0 - turbulence) * point.y * 0.18;
    float alpha = smoothstep(-0.015, 0.055, edge) * (1.0 - smoothstep(0.8, 1.0, point.y));
    alpha *= smoothstep(0.0, 0.09, point.y) * vFireFade * (1.0 - uDetailRain * 0.35);
    if (alpha < 0.01) discard;
    float heat = clamp((1.0 - point.y) * 0.9 + edge * 1.6 + tongues * 0.22, 0.0, 1.0);
    vec3 color = mix(vec3(1.4, 0.1, 0.008), vec3(2.6, 1.15, 0.14), smoothstep(0.12, 0.78, heat));
    color = mix(color, vec3(3.2, 2.5, 1.0), smoothstep(0.78, 1.0, heat));
    gl_FragColor = vec4(color, alpha * 0.82);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

const plumeVertex = /* glsl */`
  attribute vec4 aOrigin;
  attribute vec3 aSeed;
  varying vec2 vPlumeUv;
  varying float vPlumeAge;
  varying float vPlumeKind;
  varying float vPlumeSeed;
  varying float vPlumeFade;
  ${detailMotion}
  #include <fog_pars_vertex>
  void main() {
    float age = fract(aSeed.x + uDetailTime * mix(0.42, 0.16, aSeed.z) * (0.3 + 0.7 * uDetailMotion));
    float height = age * mix(2.0, 4.0, aSeed.z);
    vec3 center = aOrigin.xyz;
    center.y += (height + mix(0.2, 0.85, aSeed.z)) * aOrigin.w;
    center.xz += (uDetailDirection * uDetailWind * height * height * 0.24 + vec2(sin(aSeed.y + age * 8.0), cos(aSeed.y + age * 5.0)) * age * 0.22) * aOrigin.w;
    vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
    float size = mix(0.018 + sin(age * 8.0 + aSeed.y) * 0.006, 0.35 + age * 1.05, aSeed.z) * aOrigin.w;
    mvPosition.xy += (position.xy - vec2(0.0, 0.5)) * size;
    gl_Position = projectionMatrix * mvPosition;
    vPlumeUv = uv; vPlumeAge = age; vPlumeKind = aSeed.z; vPlumeSeed = aSeed.y;
    vPlumeFade = 1.0 - smoothstep(25.0, 45.0, length(mvPosition.xyz));
    #include <fog_vertex>
  }
`;

const plumeFragment = /* glsl */`
  varying vec2 vPlumeUv;
  varying float vPlumeAge;
  varying float vPlumeKind;
  varying float vPlumeSeed;
  varying float vPlumeFade;
  uniform float uDetailDaylight;
  ${detailNoise}
  #include <fog_pars_fragment>
  void main() {
    vec2 point = vPlumeUv * 2.0 - 1.0;
    float shape = 1.0 - smoothstep(0.2, 1.0, dot(point, point));
    float life = sin(vPlumeAge * 3.14159) * vPlumeFade;
    vec3 color = vec3(2.4, 0.6, 0.055);
    float alpha = shape * life;
    if (vPlumeKind > 0.5) {
      float noise = detailNoise(vPlumeUv * 5.0 + vec2(vPlumeSeed, vPlumeAge * 2.0));
      alpha *= noise * 0.13;
      color = mix(vec3(0.08), vec3(0.34, 0.32, 0.29), uDetailDaylight);
    }
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(color, alpha);
    #include <fog_fragment>
    #include <colorspace_fragment>
  }
`;

export function createSceneDetails() {
  const flags = [], fires = [];
  return {
    flag(x, y, z, width, height, yaw, tint, top = false, text = '') {
      if (!ULTRA) return false;
      flags.push({ x, y, z, width, height, yaw, tint, top, text });
      return true;
    },
    fire(x, y, z, scale) {
      if (!ULTRA) return false;
      fires.push({ x, y, z, scale });
      return true;
    },
    build() {
      const root = new THREE.Group(); root.name = 'scene-details';
      if (flags.length) root.add(buildCloth(flags));
      if (fires.length) {
        const flame = new THREE.Mesh(fireGeometry(fires), new THREE.ShaderMaterial({
          uniforms: detailUniforms, vertexShader: flameVertex, fragmentShader: flameFragment,
          side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: true,
        }));
        flame.name = 'living-flames'; flame.frustumCulled = false;
        const plume = new THREE.Mesh(fireGeometry(fires, true), new THREE.ShaderMaterial({
          uniforms: detailUniforms, vertexShader: plumeVertex, fragmentShader: plumeFragment,
          transparent: true, depthWrite: false, toneMapped: false, fog: true,
        }));
        plume.name = 'embers-and-smoke'; plume.frustumCulled = false;
        root.add(flame, plume);
      }
      root.userData.counts = { flags: flags.length, fires: fires.length };
      return root;
    },
  };
}
