import * as THREE from 'three';
import { LAND, SPAWN } from './layout.js';
import { rng } from '@engine/world/textures.js';

const POOL_COUNT = 3;
const MIN_POOL_SPACING = 12;

function overlapsObstacle(centerX, centerZ, radius, obstacles) {
  return obstacles.some(obstacle => {
    if (obstacle.level > 0) return false;
    const nearX = Math.max(obstacle.x0, Math.min(centerX, obstacle.x1));
    const nearZ = Math.max(obstacle.z0, Math.min(centerZ, obstacle.z1));
    return (centerX - nearX) ** 2 + (centerZ - nearZ) ** 2 < (radius + 0.8) ** 2;
  });
}

function hasOpenSand(centerX, centerZ, radius, grid, shelter, obstacles) {
  if (Math.hypot(centerX - SPAWN.x, centerZ - SPAWN.z) < 8) return false;
  if (centerX - radius < LAND.x0 + 2 || centerX + radius > LAND.x1 - 2
    || centerZ - radius < LAND.z0 + 2 || centerZ + radius > LAND.z1 - 8) return false;
  if (shelter.topAt(centerX, centerZ) >= 0.7 || overlapsObstacle(centerX, centerZ, radius, obstacles)) return false;
  for (let offsetX = -radius; offsetX <= radius; offsetX += 0.7) {
    for (let offsetZ = -radius; offsetZ <= radius; offsetZ += 0.7) {
      if (offsetX * offsetX + offsetZ * offsetZ > radius * radius) continue;
      if (grid.type(Math.floor(centerX + offsetX), -1, Math.floor(centerZ + offsetZ))?.name !== 'sand') return false;
      if (shelter.topAt(centerX + offsetX, centerZ + offsetZ) >= 0.7) return false;
    }
  }
  return true;
}

function edgeShape(angle, seed) {
  return 1 + 0.105 * Math.sin(angle * 3 + seed) + 0.055 * Math.sin(angle * 5 - seed * 0.8)
    + 0.025 * Math.sin(angle * 9 + seed * 1.7);
}

function makeWaterGeometry(pools) {
  const positions = [], colors = [], radii = [], indices = [];
  const angularSegments = 56, radialSegments = 10;
  const color = new THREE.Color();
  for (const pool of pools) {
    const start = positions.length / 3;
    positions.push(pool.x, pool.baseY + 0.025, pool.z);
    color.setRGB(0.035, 0.075, 0.095); colors.push(color.r, color.g, color.b); radii.push(0);
    for (let ring = 1; ring <= radialSegments; ring++) {
      const radius = ring / radialSegments;
      for (let segment = 0; segment < angularSegments; segment++) {
        const angle = segment / angularSegments * Math.PI * 2;
        const shapedRadius = radius * edgeShape(angle, pool.seed);
        const depth = 1 - THREE.MathUtils.smoothstep(radius, 0.12, 0.94);
        positions.push(pool.x + Math.cos(angle) * pool.radiusX * shapedRadius, pool.baseY + 0.025,
          pool.z + Math.sin(angle) * pool.radiusZ * shapedRadius);
        color.setRGB(0.035 + depth * 0.025, 0.075 + depth * 0.045, 0.095 + depth * 0.055);
        colors.push(color.r, color.g, color.b); radii.push(radius);
      }
    }
    for (let segment = 0; segment < angularSegments; segment++) {
      const next = (segment + 1) % angularSegments;
      indices.push(start, start + 1 + segment, start + 1 + next);
    }
    for (let ring = 0; ring < radialSegments - 1; ring++) {
      const inner = start + 1 + ring * angularSegments, outer = inner + angularSegments;
      for (let segment = 0; segment < angularSegments; segment++) {
        const next = (segment + 1) % angularSegments;
        indices.push(inner + segment, outer + segment, inner + next, inner + next, outer + segment, outer + next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aRadius', new THREE.Float32BufferAttribute(radii, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

function makeWetEdgeGeometry(pools) {
  const positions = [], alphas = [], indices = [];
  const angularSegments = 56, radialSegments = 3;
  for (const pool of pools) {
    const start = positions.length / 3;
    for (let ring = 0; ring <= radialSegments; ring++) {
      const radius = 0.98 + ring / radialSegments * 0.2;
      const alpha = (1 - ring / radialSegments) * 0.2;
      for (let segment = 0; segment < angularSegments; segment++) {
        const angle = segment / angularSegments * Math.PI * 2;
        const shapedRadius = radius * edgeShape(angle, pool.seed);
        positions.push(pool.x + Math.cos(angle) * pool.radiusX * shapedRadius, pool.baseY + 0.008,
          pool.z + Math.sin(angle) * pool.radiusZ * shapedRadius);
        alphas.push(alpha);
      }
    }
    for (let ring = 0; ring < radialSegments; ring++) {
      const inner = start + ring * angularSegments, outer = inner + angularSegments;
      for (let segment = 0; segment < angularSegments; segment++) {
        const next = (segment + 1) % angularSegments;
        indices.push(inner + segment, outer + segment, inner + next, inner + next, outer + segment, outer + next);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  return geometry;
}

const waterVertex = /* glsl */
  'varying vec3 vWorld; varying vec3 vColor; varying float vRadius; attribute vec3 color; attribute float aRadius; void main() { vec4 world = modelMatrix * vec4(position, 1.0); vWorld = world.xyz; vColor = color; vRadius = aRadius; gl_Position = projectionMatrix * viewMatrix * world; }';
const waterFragment = /* glsl */
  'uniform sampler2D uReflection; uniform mat4 uReflMatrix; uniform vec3 uSky; uniform float uReflectOn; uniform float uRain; uniform float uTime; varying vec3 vWorld; varying vec3 vColor; varying float vRadius; void main() { vec3 view = normalize(cameraPosition - vWorld); float phase = dot(vWorld.xz, vec2(1.7, 2.3)) + uTime * 1.4; vec2 ripple = vec2(cos(phase), sin(phase * 0.83)) * uRain * 0.003; vec4 projected = uReflMatrix * vec4(vWorld.x, 0.025, vWorld.z, 1.0); vec2 uv = projected.xy / max(projected.w, 0.0001) + ripple; float inside = step(0.0, uv.x) * step(0.0, uv.y) * step(uv.x, 1.0) * step(uv.y, 1.0); vec4 reflected = texture2D(uReflection, clamp(uv, 0.001, 0.999)); vec3 sky = mix(vec3(0.07, 0.11, 0.14), uSky, 0.45); vec3 reflection = mix(sky, reflected.rgb, reflected.a * inside * uReflectOn); float fresnel = 0.2 + 0.8 * pow(1.0 - max(dot(view, vec3(0.0, 1.0, 0.0)), 0.0), 3.0); vec3 water = mix(vColor, reflection, fresnel * (0.45 + 0.45 * uReflectOn)); float alpha = 0.92 * (1.0 - smoothstep(0.88, 1.0, vRadius)); gl_FragColor = vec4(water, alpha); }';
const edgeVertex = /* glsl */
  'attribute float aAlpha; varying float vAlpha; void main() { vAlpha = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';
const edgeFragment = /* glsl */
  'varying float vAlpha; void main() { gl_FragColor = vec4(0.18, 0.13, 0.08, vAlpha); }';

export function createRainPuddles({ stage, world, shelter }) {
  const random = rng(74031), obstacles = world.obstacles || [], pools = [];
  const candidates = [];
  for (let row = 0; row < 14; row++) for (let column = 0; column < 18; column++) {
    candidates.push({ x: LAND.x0 + 4 + column * 4 + random() * 1.5, z: LAND.z0 + 4 + row * 3.5 + random() * 1.5, order: random() });
  }
  candidates.sort((left, right) => right.order - left.order);
  for (const candidate of candidates) {
    if (pools.length >= POOL_COUNT) break;
    const centerX = candidate.x, centerZ = candidate.z;
    const radiusX = 1.8 + random() * 0.9, radiusZ = radiusX * (0.72 + random() * 0.28);
    const radius = Math.max(radiusX, radiusZ);
    if (!hasOpenSand(centerX, centerZ, radius, world.grid, shelter, obstacles)) continue;
    if (pools.some(pool => Math.hypot(pool.x - centerX, pool.z - centerZ) < MIN_POOL_SPACING)) continue;
    pools.push({ x: centerX, z: centerZ, radiusX, radiusZ, baseY: 0, seed: random() * 20 });
  }
  if (!pools.length) return { mesh: null, halo: null, pools, update() {} };
  const uniforms = {
    uReflection: { value: null }, uReflMatrix: { value: new THREE.Matrix4() }, uReflectOn: { value: 0 },
    uSky: stage.sky.material.uniforms.uTop, uRain: { value: 0 }, uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: waterVertex, fragmentShader: waterFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide });
  material.name = 'rain-puddle-planar-water';
  const mesh = new THREE.Mesh(makeWaterGeometry(pools), material);
  mesh.name = 'rain-puddle-basins'; mesh.visible = false; mesh.frustumCulled = false; mesh.renderOrder = 2;
  const haloMaterial = new THREE.ShaderMaterial({ vertexShader: edgeVertex, fragmentShader: edgeFragment,
    transparent: true, depthWrite: false, side: THREE.DoubleSide });
  haloMaterial.name = 'rain-puddle-wet-sand-edge';
  const halo = new THREE.Mesh(makeWetEdgeGeometry(pools), haloMaterial);
  halo.name = 'rain-puddle-wet-edges'; halo.visible = false; halo.frustumCulled = false; halo.renderOrder = 1;
  stage.scene.add(halo, mesh);
  world.materials.puddle = material;
  if (stage.quality.ultra) stage.quality.planar = Math.max(stage.quality.planar || 0, 0.4);
  stage.pipeline?.addMirror?.({ mesh, level: 0.025, uniforms });
  return {
    mesh, halo, material, pools, uniforms,
    update(dt, weather) {
      uniforms.uTime.value += Math.min(dt, 0.1);
      uniforms.uRain.value = Math.max(0, Math.min(1, weather.rain || 0));
      const visible = Math.max(weather.wet || 0, weather.rain || 0) > 0.05 && (weather.snow || 0) < 0.5;
      mesh.visible = visible; halo.visible = visible;
    },
  };
}
