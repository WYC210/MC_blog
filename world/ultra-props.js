import * as THREE from 'three';
import { ULTRA } from '@engine/ultra-flag.js';
import { rng } from '@engine/world/textures.js';

const clothUniforms = { uClothTime: { value: 0 }, uClothWind: { value: 0 } };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const CLOTH = /* glsl */`
  uniform float uClothTime, uClothWind;
  attribute vec3 aCloth;
  attribute vec2 aClothUv;
  varying vec3 vCloth;
  vec3 flutter(vec3 point) {
    float free = clamp((aCloth.x - point.y) / max(aCloth.y, 0.01), 0.0, 1.0);
    float phase = point.x * 2.5 + floor(point.z + 0.5) * 0.7 - uClothTime * (2.5 + uClothWind);
    float wave = sin(phase + free * 5.0) * 0.65 + sin(phase * 1.9 + free * 9.0) * 0.18;
    float amount = min(aCloth.y * 0.19, 0.45) * uClothWind * free;
    point.xz += vec2(0.36, 0.93) * wave * amount;
    point.y += sin(phase * 0.8) * amount * 0.12;
    return point;
  }
`;

export function animateClothMaterial(source) {
  const material = source.clone(), compile = source.onBeforeCompile;
  material.side = THREE.DoubleSide;
  material.onBeforeCompile = shader => {
    compile.call(source, shader);
    Object.assign(shader.uniforms, clothUniforms);
    shader.vertexShader = CLOTH + shader.vertexShader.replace('#include <project_vertex>',
      'transformed = flutter(transformed); vCloth = vec3(aClothUv, aCloth.z);\n#include <project_vertex>');
    shader.fragmentShader = 'varying vec3 vCloth;\n' + shader.fragmentShader.replace('#include <color_fragment>', /* glsl */`
      #include <color_fragment>
      float edge = min(min(vCloth.x, 1.0 - vCloth.x), min(vCloth.y, 1.0 - vCloth.y));
      float trim = (1.0 - smoothstep(0.022, 0.032, edge)) * vCloth.z;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.56, 0.36, 0.13), trim);
    `);
  };
  material.customProgramCacheKey = () => `${source.customProgramCacheKey()}-ultra-cloth`;
  return material;
}

export function createUltraProps(layer) {
  const flags = [], fires = [];
  function flag(x, bottom, z, width, height, yaw, tint, border = false) {
    if (!ULTRA) return false;
    flags.push({ x, bottom, z, width, height, yaw, tint, border });
    return true;
  }
  function fire(x, y, z, size = 1) {
    if (!ULTRA) return false;
    fires.push([x, y, z, size]);
    return true;
  }
  function build(materials) {
    const group = new THREE.Group(); group.name = 'ultra-props';
    if (flags.length) {
      const positions = [], normals = [], colors = [], tiles = [], layers = [], emissions = [], anchors = [], uv = [], indices = [];
      for (const flag of flags) {
        const offset = positions.length / 3, columns = 12, rows = 18;
        const color = new THREE.Color(flag.tint), cosine = Math.cos(flag.yaw), sine = Math.sin(flag.yaw);
        for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
          const horizontal = column / columns, vertical = row / rows, local = (horizontal - 0.5) * flag.width;
          positions.push(flag.x + local * cosine, flag.bottom + vertical * flag.height, flag.z - local * sine);
          normals.push(sine, 0, cosine); colors.push(color.r, color.g, color.b);
          tiles.push(horizontal * flag.width, vertical * flag.height); layers.push(layer.linen); emissions.push(0);
          anchors.push(flag.bottom + flag.height, flag.height, flag.border ? 1 : 0); uv.push(horizontal, vertical);
          if (column < columns && row < rows) {
            const vertex = offset + row * (columns + 1) + column;
            indices.push(vertex, vertex + 1, vertex + columns + 2, vertex, vertex + columns + 2, vertex + columns + 1);
          }
        }
      }
      const geometry = new THREE.BufferGeometry();
      for (const [name, values, size] of [['position', positions, 3], ['normal', normals, 3], ['color', colors, 3], ['tileUv', tiles, 2],
        ['tileLayer', layers, 1], ['tileEmissive', emissions, 1], ['aCloth', anchors, 3], ['aClothUv', uv, 2]]) {
        geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
      }
      geometry.setIndex(indices); geometry.computeBoundingSphere(); geometry.boundingSphere.radius += 1;
      const mesh = new THREE.Mesh(geometry, animateClothMaterial(materials.voxel));
      mesh.name = 'ultra-flags'; mesh.receiveShadow = true; mesh.userData.flags = flags;
      group.add(mesh);
    }
    if (fires.length) group.add(buildFires(fires));
    return group;
  }
  return { flag, fire, build, flags, fires };
}

export function updateUltraProps(stage, world) {
  const ground = world.materials.box.userData.ultraGround?.uniforms;
  if (!ground) return;
  clothUniforms.uClothTime.value = ground.uGroundTime.value;
  clothUniforms.uClothWind.value = reduced.matches ? 0 : Math.min(1.6, ground.uGroundWind.value * 0.65);
  const fire = world.ultraProps?.getObjectByName('ultra-fires');
  if (!fire) return;
  fire.material.uniforms.uFireTime.value = ground.uGroundTime.value;
  fire.material.uniforms.uFireWind.value = clothUniforms.uClothWind.value;
  fire.material.uniforms.uFireSky.value.copy(stage.hemi.color).multiplyScalar(stage.hemi.intensity * 0.4 + 0.1);
  fire.visible = !stage.submerged && !document.hidden;
}

function buildFires(fires) {
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const emitters = [], seeds = [], random = rng(7021);
  for (const fire of fires) for (let index = 0; index < 16; index++) {
    emitters.push(...fire);
    seeds.push(index / 16, random(), index < 9 ? 0 : index < 13 ? 1 : 2);
  }
  geometry.setAttribute('aFire', new THREE.InstancedBufferAttribute(new Float32Array(emitters), 4));
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(seeds), 3));
  geometry.instanceCount = seeds.length / 3;
  const material = new THREE.ShaderMaterial({
    name: 'ultra-fire-smoke-embers', transparent: true, depthWrite: false, fog: true,
    uniforms: { uFireTime: { value: 0 }, uFireWind: { value: 0 }, uFireSky: { value: new THREE.Color() }, ...THREE.UniformsLib.fog },
    vertexShader: /* glsl */`
      uniform float uFireTime, uFireWind;
      attribute vec4 aFire;
      attribute vec3 aSeed;
      varying vec2 vUv;
      varying float vLife, vKind, vSeed, vFade;
      #include <fog_pars_vertex>
      void main() {
        vKind = aSeed.z; vSeed = aSeed.y;
        float size = aFire.w;
        float life = fract(uFireTime * (vKind < 0.5 ? 1.2 : 0.35) + aSeed.x * 7.7);
        vLife = life;
        float rise = vKind < 0.5 ? life * 0.75 : vKind < 1.5 ? life * 2.8 : life * 3.2 + 0.5;
        vec3 center = aFire.xyz + vec3(sin(aSeed.y * 61.0) * 0.17, rise, cos(aSeed.y * 47.0) * 0.17) * size;
        center.xz += vec2(0.82, 0.57) * uFireWind * rise * rise * size * 0.24;
        center.x += sin(uFireTime * 7.0 + aSeed.y * 31.0) * 0.035 * size;
        float width = vKind < 0.5 ? (0.19 + aSeed.y * 0.12) * (1.0 - life * 0.75) : vKind < 1.5 ? 0.012 : 0.2 + life * 0.5;
        float height = vKind < 0.5 ? width * 1.8 : vKind < 1.5 ? 0.025 : width;
        vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
        mvPosition.xy += position.xy * vec2(width, height) * size;
        vFade = (1.0 - smoothstep(32.0, 55.0, distance(cameraPosition, aFire.xyz))) * smoothstep(-0.3, 0.0, cameraPosition.y);
        gl_Position = projectionMatrix * mvPosition;
        vUv = position.xy;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      uniform vec3 uFireSky;
      varying vec2 vUv;
      varying float vLife, vKind, vSeed, vFade;
      #include <fog_pars_fragment>
      void main() {
        float shape = max(0.0, 1.0 - dot(vUv, vUv));
        float fade = smoothstep(0.0, 0.12, vLife) * (1.0 - vLife) * vFade;
        vec3 color; float alpha;
        if (vKind < 0.5) {
          float core = pow(shape, 3.0) * (1.0 - vLife);
          color = mix(vec3(1.3, 0.17, 0.015), vec3(3.5, 1.9, 0.38), core);
          alpha = smoothstep(0.05, 0.5, shape) * fade * 0.85;
        } else if (vKind < 1.5) {
          color = vec3(3.5, 0.9, 0.08); alpha = shape * fade;
        } else {
          color = uFireSky * (0.18 + vSeed * 0.13);
          alpha = shape * shape * fade * 0.16;
        }
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ultra-fires'; mesh.frustumCulled = false;
  mesh.userData.emitters = fires;
  return mesh;
}
