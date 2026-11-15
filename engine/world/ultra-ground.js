import * as THREE from 'three';
import { rng } from './textures.js';
import { GROUND_HEAD, GROUND_SURFACE, GROUND_LIGHT } from './ultra-ground-shader.js';
import { createMaterialDetails } from './ultra-materials.js';

const TRACK_COUNT = 160, TRACK_SIZE = 512, TRACK_SPAN = 32, TRACK_STRIDE = 6;

function createTracks() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = TRACK_SIZE;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'ultra-ground-tracks';
  texture.flipY = false;
  texture.generateMipmaps = false;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  const box = new THREE.Vector4(-TRACK_SPAN / 2, -TRACK_SPAN / 2, 1 / TRACK_SPAN, 1 / TRACK_SPAN);
  const marks = new Float32Array(TRACK_COUNT * TRACK_STRIDE);
  let cursor = 0, count = 0, active = 0, revision = 0, dirty = false;

  function add(x, y, z, heading, snow) {
    const offset = cursor * TRACK_STRIDE;
    marks[offset] = x; marks[offset + 1] = z; marks[offset + 2] = y;
    marks[offset + 3] = heading; marks[offset + 4] = snow ? 1 : 0; marks[offset + 5] = 1;
    cursor = (cursor + 1) % TRACK_COUNT;
    count = Math.min(TRACK_COUNT, count + 1);
    dirty = true;
  }

  function redraw(x, z, dt, weather) {
    const nextX = Math.floor(x / 8) * 8 - TRACK_SPAN / 2, nextZ = Math.floor(z / 8) * 8 - TRACK_SPAN / 2;
    const moved = nextX !== box.x || nextZ !== box.y;
    if (!active && !dirty && !moved) return;
    box.x = nextX; box.y = nextZ;
    context.clearRect(0, 0, TRACK_SIZE, TRACK_SIZE);
    const scale = TRACK_SIZE / TRACK_SPAN;
    active = 0;
    for (let index = 0; index < count; index++) {
      const offset = index * TRACK_STRIDE, snow = marks[offset + 4] > 0;
      let strength = marks[offset + 5];
      if (strength <= 0) continue;
      const life = snow ? 85 / (1 + weather.snow * 3 + weather.rain * 5) : 110 / (1 + weather.wind * 3 + weather.rain * 4);
      strength = marks[offset + 5] = Math.max(0, strength - dt / life);
      if (snow && weather.cover < 0.01) marks[offset + 5] = strength = 0;
      if (strength <= 0) continue;
      active++;
      const pixelX = (marks[offset] - box.x) * scale, pixelZ = (marks[offset + 1] - box.y) * scale;
      if (pixelX < -8 || pixelZ < -8 || pixelX > TRACK_SIZE + 8 || pixelZ > TRACK_SIZE + 8) continue;
      const height = Math.round(THREE.MathUtils.clamp((marks[offset + 2] + 2) / 64, 0, 1) * 255);
      context.save();
      context.translate(pixelX, pixelZ);
      context.rotate(marks[offset + 3]);
      context.fillStyle = snow ? `rgb(255,0,${height})` : `rgb(0,255,${height})`;
      context.globalAlpha = strength * 0.45;
      context.fillRect(-0.13 * scale, -0.24 * scale, 0.26 * scale, 0.48 * scale);
      context.globalAlpha = strength;
      context.fillRect(-0.09 * scale, -0.19 * scale, 0.18 * scale, 0.26 * scale);
      context.fillRect(-0.085 * scale, 0.1 * scale, 0.17 * scale, 0.1 * scale);
      context.restore();
    }
    texture.needsUpdate = true;
    dirty = false;
    revision++;
  }

  return { texture, box, add, redraw, get count() { return active; }, get revision() { return revision; } };
}

function createDrift(stage, world, shelter, uniforms) {
  const image = shelter.texture.image, surface = new Uint8Array(image.width * image.height * 4);
  for (let row = 0; row < image.height; row++) for (let column = 0; column < image.width; column++) {
    const x = shelter.box.x + column, z = shelter.box.y + row;
    const top = shelter.topAt(x + 0.5, z + 0.5);
    const type = world.grid.type(x, Math.floor(top - 0.01), z)?.name || '';
    const offset = (column + row * image.width) * 4;
    if (top >= -0.15 && /sand$/.test(type)) surface[offset] = 255;
    if (top >= -0.15 && type === 'qin-grass') surface[offset + 1] = 255;
    if (top >= -0.15 && /qin-path|qin-rock|qin-plinth/.test(type)) surface[offset + 2] = 255;
    surface[offset + 3] = 255;
  }
  const map = new THREE.DataTexture(surface, image.width, image.height);
  map.name = 'ultra-wind-surfaces';
  map.minFilter = map.magFilter = THREE.NearestFilter;
  map.unpackAlignment = 1; map.needsUpdate = true;
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  const count = stage.quality.mobile ? 240 : 480, seeds = new Float32Array(count * 3), random = rng(1847);
  for (let index = 0; index < seeds.length; index++) seeds[index] = random();
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 3));
  geometry.instanceCount = count;
  const material = new THREE.ShaderMaterial({
    name: 'ultra-island-wind', transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: true,
    uniforms: { ...uniforms, uCenter: { value: new THREE.Vector2() }, uSandMap: { value: map },
      uShelter: { value: shelter.texture }, uShelterBox: { value: shelter.box }, ...THREE.UniformsLib.fog },
    vertexShader: /* glsl */`
      uniform float uGroundTime, uGroundWind;
      uniform vec2 uCenter;
      uniform sampler2D uSandMap, uShelter;
      uniform vec4 uShelterBox;
      attribute vec3 aSeed;
      varying vec2 vUv;
      varying float vAlpha, vKind, vSeed;
      #include <fog_pars_vertex>
      void main() {
        vec2 travel = vec2(0.82, 0.57) * uGroundTime * (0.6 + uGroundWind * 1.8);
        vec2 point = uCenter - 12.0 + mod(aSeed.xy * 24.0 + travel - uCenter + 12.0, 24.0);
        vec2 coord = (point - uShelterBox.xy) * uShelterBox.zw;
        float top = texture2D(uShelter, coord).r * 63.75 - 2.0;
        vec3 surface = texture2D(uSandMap, coord).rgb;
        vec2 inside = step(vec2(0.0), coord) * step(coord, vec2(1.0));
        float vegetation = max(surface.g, surface.b * 0.35);
        vKind = vegetation > 0.01 ? 2.0 : (aSeed.z < 0.18 ? 0.0 : 1.0);
        vAlpha = max(surface.r, vegetation) * inside.x * inside.y * (1.0 - smoothstep(8.0, 12.0, length(point - uCenter)));
        float gust = 0.65 + 0.35 * sin(uGroundTime * 1.6 + dot(point, vec2(0.24, 0.17)));
        float lift = vKind > 1.5 ? 0.2 + aSeed.z * 1.7 + sin(uGroundTime * 2.0 + aSeed.x * 31.0) * 0.13 : 0.035 + aSeed.z * 0.28 * gust;
        vec3 center = vec3(point.x, top + lift, point.y);
        vec4 mvPosition = modelViewMatrix * vec4(center, 1.0);
        vec2 size = vKind < 0.5 ? vec2(0.32 + aSeed.z, 0.025) : vKind < 1.5 ? vec2(0.009 + aSeed.z * 0.012, 0.007) : vec2(0.035, 0.014);
        float turn = uGroundTime * (1.0 + aSeed.z * 2.0) + aSeed.x * 25.0;
        vec2 corner = position.xy * size;
        if (vKind > 1.5) corner = mat2(cos(turn), sin(turn), -sin(turn), cos(turn)) * corner;
        mvPosition.xy += corner;
        vUv = position.xy;
        vSeed = aSeed.z;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uGroundDust;
      uniform vec3 uGroundDustColor;
      varying vec2 vUv;
      varying float vAlpha, vKind, vSeed;
      #include <fog_pars_fragment>
      void main() {
        float edge = max(0.0, 1.0 - dot(vUv, vUv));
        float opacity = vKind < 0.5 ? 0.22 : 0.85;
        vec3 pigment = vKind > 1.5 ? mix(vec3(0.26, 0.32, 0.12), vec3(0.63, 0.48, 0.23), vSeed) : vec3(0.83, 0.69, 0.43);
        if (vKind > 1.5) edge *= smoothstep(0.0, 0.18, 1.0 - abs(vUv.x) - abs(vUv.y) * 0.55);
        gl_FragColor = vec4(pigment * uGroundDustColor, edge * edge * vAlpha * min(1.0, uGroundDust * 2.5) * opacity);
        if (gl_FragColor.a < 0.003) discard;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'ultra-sand-drift'; mesh.frustumCulled = false; mesh.visible = false;
  stage.scene.add(mesh);
  return mesh;
}

export function createUltraGround({ stage, world, weatherFx, player }) {
  const tracks = createTracks(), sky = stage.sky.material.uniforms, shelter = weatherFx.shelter;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const details = createMaterialDetails(world.tiles.layer);
  const uniforms = {
    uGroundNoise: sky.uSkyNoise, uGroundTracks: { value: tracks.texture }, uGroundTrackBox: { value: tracks.box },
    uGroundStep: { value: new THREE.Vector4(0, 0, -10, 0) }, uGroundTime: { value: 0 },
    uGroundSunDir: sky.uSunDir, uGroundSunColor: sky.uSunColor, uGroundSky: sky.uTop,
    uGroundRain: { value: 0 }, uGroundWind: { value: 0 }, uGroundSand: { value: world.tiles.layer.sand },
    uGroundSun: { value: 0 }, uGroundDust: { value: 0 }, uGroundDustColor: { value: new THREE.Color() },
    uGroundMaterials: { value: details.texture }, uGroundMaterialCount: { value: details.count },
  };
  const extension = { uniforms, head: GROUND_HEAD, surface: GROUND_SURFACE, light: GROUND_LIGHT };
  for (const name of ['voxel', 'voxelCutout', 'box', 'boxCutout', 'cross']) {
    world.materials[name].userData.ultraGround = extension;
    world.materials[name].needsUpdate = true;
  }
  const drift = createDrift(stage, world, shelter, uniforms);
  let time = 0, clock = 0, lastX = player.pos.x, lastZ = player.pos.z, distance = 0, foot = 1;
  let steps = 0;

  function update(dt, weather) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    if (!reduced.matches && !document.hidden) time += dt;
    clock += dt;
    uniforms.uGroundTime.value = time;
    uniforms.uGroundRain.value = reduced.matches ? 0 : weather.rain;
    uniforms.uGroundWind.value = reduced.matches ? 0 : 0.3 + weather.wind * 2.7;
    uniforms.uGroundSun.value = stage.sun.visible ? Math.min(1.5, stage.sun.intensity) : 0;
    uniforms.uGroundDust.value = reduced.matches ? 0 : weather.wind * (1 - weather.wet) * (1 - weather.cover);
    uniforms.uGroundDustColor.value.copy(stage.hemi.color).multiplyScalar(0.55 + stage.hemi.intensity * 0.35);
    drift.visible = uniforms.uGroundDust.value > 0.03 && !stage.submerged;
    if (drift.visible) drift.material.uniforms.uCenter.value.set(stage.camera.position.x, stage.camera.position.z);

    const x = player.pos.x, z = player.pos.z, dx = x - lastX, dz = z - lastZ, moved = Math.hypot(dx, dz);
    lastX = x; lastZ = z;
    if (player.mode !== 'ground' || player.vehicle || player.resting || moved > 2) distance = 0;
    else if (moved > 0.001) {
      distance += moved;
      if (distance >= 0.6) {
        distance %= 0.6;
        const heading = Math.atan2(dx, dz), footX = x + Math.cos(heading) * 0.13 * foot, footZ = z - Math.sin(heading) * 0.13 * foot;
        foot = -foot;
        const top = shelter.topAt(footX, footZ), y = player.y;
        if (y > -0.15 && Math.abs(top - y) < 0.2) {
          const sand = /sand$/.test(world.grid.type(Math.floor(footX), Math.floor(y - 0.01), Math.floor(footZ))?.name || '');
          if (weather.cover > 0.12 || sand) {
            tracks.add(footX, y, footZ, -heading, weather.cover > 0.12);
            steps++;
          }
          uniforms.uGroundStep.value.set(footX, footZ, time, y);
        }
      }
    }
    if (clock >= 0.12) {
      tracks.redraw(x, z, clock, weather);
      clock = 0;
    }
  }

  return { update, drift, uniforms, get stats() { return { steps, activeTracks: tracks.count, trackRevision: tracks.revision, capacity: TRACK_COUNT }; } };
}
