import * as THREE from 'three';
import { LAND, FOUNTAIN } from './layout.js';

const HABITATS = [
  [-28, -21, 9, 5], [-14, -20, 8, 5], [-4, -20, 8, 4], [8, -21, 9, 4], [27, -19, 8, 6],
  [-32, -7, 4, 12], [-18, -9, 8, 5], [FOUNTAIN.x, FOUNTAIN.z, 13, 12], [2, 2, 6, 17],
  [15, -5, 7, 14], [31, 3, 5, 16], [-30, 17, 7, 10], [-10, 15, 10, 10],
  [11, 16, 12, 9], [28, 21, 8, 8], [-18, 24, 12, 5], [2, 24, 14, 5],
];

const FIREFLY_VERTEX = `
  attribute float size;
  attribute float phase;
  uniform float scale;
  uniform float clock;
  uniform float opacity;
  uniform float still;
  varying float brightness;
  void main() {
    vec4 eye = modelViewMatrix * vec4(position, 1.0);
    float pulse = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(clock * (1.1 + fract(phase) * 0.8) + phase), 2.0);
    brightness = opacity * mix(pulse, 0.7, still) * (1.0 - smoothstep(38.0, 70.0, -eye.z));
    gl_PointSize = clamp(size * scale / max(1.0, -eye.z), 3.0, 28.0);
    gl_Position = projectionMatrix * eye;
  }
`;

const FIREFLY_FRAGMENT = `
  varying float brightness;
  void main() {
    vec2 pixel = (floor(gl_PointCoord * 16.0) + 0.5) / 16.0 - 0.5;
    float radius = length(pixel) * 2.0;
    if (radius > 1.0) discard;
    float halo = pow(max(0.0, 1.0 - radius), 2.0);
    float core = 1.0 - smoothstep(0.1, 0.32, radius);
    vec3 color = mix(vec3(0.72, 0.82, 0.15), vec3(1.0, 0.96, 0.6), core);
    gl_FragColor = vec4(color, (halo * 0.55 + core * 0.85) * brightness);
    #include <colorspace_fragment>
  }
`;

const METEOR_VERTEX = `
  attribute float energy;
  varying vec2 trailUV;
  varying float brightness;
  uniform float opacity;
  void main() {
    trailUV = uv;
    brightness = energy * opacity;
    vec4 projected = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = projected.xyww;
    gl_Position.z *= 0.99999;
  }
`;

const METEOR_FRAGMENT = `
  varying vec2 trailUV;
  varying float brightness;
  void main() {
    float edge = 1.0 - abs(trailUV.y * 2.0 - 1.0);
    float tail = pow(trailUV.x, 1.4);
    vec3 color = mix(vec3(0.32, 0.58, 1.0), vec3(1.0, 0.96, 0.8), trailUV.x);
    gl_FragColor = vec4(color, pow(edge, 0.6) * tail * brightness);
    #include <colorspace_fragment>
  }
`;

export function createMeteorClock(random = Math.random) {
  let enabled = false, remaining = 0, wait = 20 + random() * 15, showers = 0;
  function start() {
    remaining = 14 + random() * 6;
    showers++;
  }
  return {
    update(dt, active, clear) {
      if (!active) {
        if (enabled) { remaining = 0; wait = 20 + random() * 15; }
        enabled = false;
        return;
      }
      enabled = true;
      if (!clear) { remaining = 0; wait = Math.max(wait, 15); return; }
      if (remaining > 0) {
        remaining = Math.max(0, remaining - dt);
        if (!remaining) wait = 75 + random() * 60;
        return;
      }
      wait -= dt;
      if (wait <= 0) {
        if (random() < 0.35) start();
        else wait = 35 + random() * 25;
      }
    },
    preview(active, clear) {
      if (!active || !clear) return false;
      enabled = true;
      start();
      return true;
    },
    get remaining() { return remaining; },
    get wait() { return wait; },
    get showers() { return showers; },
  };
}

export function createNightNature({ stage, world, nav, quality, random = Math.random }) {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = quality.mobile;
  const insects = [];
  const desiredCount = mobile ? 102 : 170;

  function openArea(positionX, positionZ, radius) {
    if (positionX - radius < LAND.x0 + 2 || positionX + radius > LAND.x1 - 2 || positionZ - radius < LAND.z0 + 2 || positionZ + radius > 28) return false;
    for (let offsetX = -1; offsetX <= 1; offsetX++) for (let offsetZ = -1; offsetZ <= 1; offsetZ++) {
      const sampleX = positionX + offsetX * radius, sampleZ = positionZ + offsetZ * radius;
      if (!nav.canStand(sampleX, sampleZ) || nav.heightAt(sampleX, sampleZ) !== 0) return false;
    }
    for (let column = Math.floor(positionX - radius); column <= Math.floor(positionX + radius); column++) {
      for (let row = Math.floor(positionZ - radius); row <= Math.floor(positionZ + radius); row++) {
        for (let height = 0; height < 8; height++) if (world.grid.type(column, height, row)) return false;
      }
    }
    return true;
  }

  for (let index = 0; index < desiredCount; index++) {
    const habitat = HABITATS[index % HABITATS.length];
    for (let attempt = 0; attempt < 65; attempt++) {
      const positionX = habitat[0] + (random() - 0.5) * habitat[2];
      const positionZ = habitat[1] + (random() - 0.5) * habitat[3];
      const radius = 0.45 + random() * 0.7;
      if (!openArea(positionX, positionZ, radius + 0.15)) continue;
      insects.push({ x: positionX, z: positionZ, y: 0.85 + random() * 1.6, radius, speed: 0.25 + random() * 0.4, phase: random() * Math.PI * 2 });
      break;
    }
  }

  const fireflyGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(insects.length * 3);
  const sizes = new Float32Array(insects.length), phases = new Float32Array(insects.length);
  for (let index = 0; index < insects.length; index++) {
    const insect = insects[index];
    positions.set([insect.x, insect.y, insect.z], index * 3);
    sizes[index] = 0.3 + random() * 0.18;
    phases[index] = insect.phase;
  }
  fireflyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  fireflyGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  fireflyGeometry.setAttribute('phase', new THREE.BufferAttribute(phases, 1));
  fireflyGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2, 2), 49);
  const fireflyMaterial = new THREE.ShaderMaterial({
    vertexShader: FIREFLY_VERTEX, fragmentShader: FIREFLY_FRAGMENT,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { scale: { value: 1 }, clock: { value: 0 }, opacity: { value: 0 }, still: { value: 0 } },
  });
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMaterial);
  fireflies.name = 'night-fireflies';
  fireflies.renderOrder = 3;

  const meteorCount = mobile ? 5 : 8;
  const meteors = Array.from({ length: meteorCount }, () => ({
    age: 0, life: 0, width: 0, start: new THREE.Vector3(), velocity: new THREE.Vector3(),
  }));
  const trailGeometry = new THREE.BufferGeometry();
  const trails = new Float32Array(meteorCount * 12), energies = new Float32Array(meteorCount * 4);
  const trailUV = new Float32Array(meteorCount * 8), indices = new Uint16Array(meteorCount * 6);
  for (let index = 0; index < meteorCount; index++) {
    const offset = index * 4;
    trailUV.set([1, 0, 1, 1, 0, 0, 0, 1], index * 8);
    indices.set([offset, offset + 1, offset + 2, offset + 2, offset + 1, offset + 3], index * 6);
  }
  trailGeometry.setAttribute('position', new THREE.BufferAttribute(trails, 3).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('energy', new THREE.BufferAttribute(energies, 1).setUsage(THREE.DynamicDrawUsage));
  trailGeometry.setAttribute('uv', new THREE.BufferAttribute(trailUV, 2));
  trailGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  const trailMaterial = new THREE.ShaderMaterial({
    vertexShader: METEOR_VERTEX, fragmentShader: METEOR_FRAGMENT,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { opacity: { value: 0 } },
  });
  const meteorMesh = new THREE.Mesh(trailGeometry, trailMaterial);
  meteorMesh.name = 'night-meteor-shower';
  meteorMesh.frustumCulled = false;
  meteorMesh.visible = false;
  meteorMesh.renderOrder = 101;
  const group = new THREE.Group();
  group.name = 'night-nature';
  group.visible = false;
  group.add(fireflies, meteorMesh);
  stage.scene.add(group);

  const meteorClock = createMeteorClock(random);
  const projection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  const bounds = new THREE.Sphere(new THREE.Vector3(), 1.7);
  const heading = new THREE.Vector3(), head = new THREE.Vector3(), tail = new THREE.Vector3(), side = new THREE.Vector3();
  let elapsed = 0, frameClock = 0, spawnWait = 0, azimuth = 0, showerId = 0, activeMeteors = 0;

  function clearSky() {
    return stage.veil < 0.45 && stage.sky.material.uniforms.uCover.value < 0.6 && stage.airFar > 100;
  }

  function spawnMeteor() {
    for (const meteor of meteors) {
      if (meteor.age < meteor.life) continue;
      const angle = azimuth + (random() - 0.5) * 1.6;
      const distance = 95 + random() * 35;
      meteor.start.set(Math.sin(angle) * distance, 65 + random() * 35, Math.cos(angle) * distance);
      meteor.velocity.set(Math.cos(angle) * 42, -24 - random() * 8, -Math.sin(angle) * 42);
      meteor.width = 0.14 + random() * 0.12;
      meteor.age = 0;
      meteor.life = 1.3 + random() * 0.7;
      return;
    }
  }

  function updateMeteors(dt, clear) {
    if (meteorClock.showers !== showerId) {
      showerId = meteorClock.showers;
      stage.camera.getWorldDirection(heading);
      azimuth = Math.atan2(heading.x, heading.z) + (random() - 0.5) * 0.8;
      spawnWait = 0;
    }
    if (meteorClock.remaining > 0 && clear) {
      spawnWait -= dt;
      if (spawnWait <= 0) { spawnMeteor(); spawnWait = 0.45 + random() * 0.8; }
    }
    activeMeteors = 0;
    for (let index = 0; index < meteors.length; index++) {
      const meteor = meteors[index];
      meteor.age += dt;
      const active = clear && meteor.age < meteor.life;
      const strength = active ? Math.min(1, meteor.age / 0.12, (meteor.life - meteor.age) / 0.4) : 0;
      energies.fill(strength, index * 4, index * 4 + 4);
      if (!active) continue;
      activeMeteors++;
      head.copy(meteor.start).addScaledVector(meteor.velocity, meteor.age);
      tail.copy(head).addScaledVector(meteor.velocity, -Math.min(meteor.age, 0.43));
      side.crossVectors(head, meteor.velocity).normalize().multiplyScalar(meteor.width);
      for (let vertex = 0; vertex < 4; vertex++) {
        const point = vertex < 2 ? head : tail;
        const sign = vertex % 2 ? 1 : -1;
        const offset = index * 12 + vertex * 3;
        trails[offset] = point.x + side.x * sign;
        trails[offset + 1] = point.y + side.y * sign;
        trails[offset + 2] = point.z + side.z * sign;
      }
    }
    meteorMesh.visible = activeMeteors > 0;
    if (!meteorMesh.visible) return;
    meteorMesh.position.copy(stage.camera.position);
    trailMaterial.uniforms.opacity.value = stage.night * (1 - stage.veil);
    trailGeometry.attributes.position.needsUpdate = true;
    trailGeometry.attributes.energy.needsUpdate = true;
  }

  function update(dt) {
    if (document.hidden) return;
    const night = world.isNight();
    const clear = clearSky() && !reducedMotion.matches;
    meteorClock.update(dt, night, clear);
    group.visible = night;
    if (!night) {
      meteorMesh.visible = false;
      activeMeteors = 0;
      for (const meteor of meteors) meteor.life = 0;
      return;
    }
    elapsed += dt * (reducedMotion.matches ? 0.2 : 1);
    stage.camera.updateMatrixWorld();
    projection.multiplyMatrices(stage.camera.projectionMatrix, stage.camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    fireflies.visible = frustum.intersectsSphere(fireflyGeometry.boundingSphere);
    frameClock += dt;
    if (fireflies.visible && frameClock >= 1 / 30) {
      frameClock = 0;
      for (let index = 0; index < insects.length; index++) {
        const insect = insects[index];
        bounds.center.set(insect.x, insect.y, insect.z);
        if (!frustum.intersectsSphere(bounds)) continue;
        const clock = elapsed * insect.speed + insect.phase;
        positions[index * 3] = insect.x + Math.sin(clock) * insect.radius * 0.8;
        positions[index * 3 + 1] = insect.y + Math.sin(clock * 1.7 + insect.phase) * 0.34;
        positions[index * 3 + 2] = insect.z + Math.sin(clock * 0.83 + 1.3) * insect.radius * 0.8;
      }
      fireflyGeometry.attributes.position.needsUpdate = true;
      fireflyMaterial.uniforms.clock.value = elapsed;
      fireflyMaterial.uniforms.opacity.value = Math.min(1, elapsed / 2) * stage.night * (1 - stage.veil * 0.65);
      fireflyMaterial.uniforms.still.value = reducedMotion.matches ? 1 : 0;
      fireflyMaterial.uniforms.scale.value = stage.renderer.domElement.height * stage.camera.projectionMatrix.elements[5] * 0.5;
    }
    updateMeteors(dt, clear);
  }

  return {
    group, fireflies, meteorMesh, update,
    previewShower: () => meteorClock.preview(world.isNight(), clearSky() && !reducedMotion.matches),
    get state() { return { fireflies: insects.length, activeMeteors, showerRemaining: meteorClock.remaining, nextChance: meteorClock.wait, showers: meteorClock.showers, elapsed }; },
    dispose() {
      stage.scene.remove(group);
      fireflyGeometry.dispose();
      fireflyMaterial.dispose();
      trailGeometry.dispose();
      trailMaterial.dispose();
    },
  };
}
