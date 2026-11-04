// The portal's look: a purple vortex drawn in block texels, two soft arms
// turning down a funnel behind its face, a flowing rim, a soft halo and
// the light it casts on the ground. It livens up as you come close.
// Rectangular shape to fit a nether-style frame. It faces +z; portal.js
// places and drives it. Two draw calls: the vortex and its glow.
import * as THREE from 'three';

const CELL = 1 / 16; // one texel of a block
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
// Rectangle: centre height and half-sizes in metres. Starts at ground level.
const RX = 0.75, RY = 1.28, OY = RY, DEPTH = 0.28, HZ = DEPTH / 2;

const COLORS = { a: '#5c2d91', b: '#a855f7', c: '#d8b4fe', white: '#f5e6ff', rim: '#e0b0ff', halo: '#b366ff', ground: '#8b5cf6' };
// How fast the arms turn at rest (radians of the pattern a second) and how
// much faster right beside it; how deep the funnel sinks behind the face in
// metres, and the most its eye leans towards you, as a share of the radius;
// half the halo card's width and height in metres.
const SPIN = 0.9, SPIN_NEAR = 0.5, SINK = 0.6, LEAN = 0.55, HALO = [RX + 0.5, RY + 0.5];
const LOOK = `
  vec3 look(float r, float a) {
    float phase = a * 2.0 + log(max(r, 0.055)) * 5.4 + uSpin;
    float flow = 0.5 + 0.5 * sin(phase);
    float arms = smoothstep(0.62, 0.98, flow);
    vec3 col = mix(uA, uB, flow * 0.8);
    col = mix(col, uC, arms * (0.4 + 0.25 * (1.0 - r)));
    // Receding ripples and a dark vanishing point give the light somewhere
    // to lead, rather than a white spot painted on a solid object.
    float ripple = pow(0.5 + 0.5 * sin(r * 35.0 + log(max(r, 0.055)) * 3.0 + uTime * 1.9), 8.0);
    col += uB * ripple * 0.1 * (1.0 - smoothstep(0.25, 1.0, r));
    col = mix(uA * 0.45, col, smoothstep(0.04, 0.25, r));
    col = mix(col, uWhite, arms * (1.0 - smoothstep(0.1, 0.4, r)) * uCharge * 0.45);
    return col;
  }`;

const HEAD = `
#define CELL ${CELL}
#define OY ${OY}
#define RX ${RX}
#define RY ${RY}
#define HZ ${HZ}
#define SINK ${SINK}
#define LEAN ${LEAN}
uniform float uTime, uSpin, uFlow, uNear, uCharge;
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
// Distance to the rectangle's edge in metres: positive inside.
float rectEdge(vec2 p) {
  vec2 d = abs(p - vec2(0.0, OY)) - vec2(RX, RY);
  return -max(d.x, d.y);
}
float edgeDist(vec2 p) { return rectEdge(p); }`;
// The portal is only translated and rotated. Bring the camera into that same
// local space, where the halo keeps outside the lens and the funnel is traced.
const CAMERA = `
vec3 cameraLocal() {
  vec3 toCamera = cameraPosition - modelMatrix[3].xyz;
  return vec3(dot(toCamera, modelMatrix[0].xyz), dot(toCamera, modelMatrix[1].xyz), dot(toCamera, modelMatrix[2].xyz));
}`;
const GLOW_VERTEX = `
#define OY ${OY}
#define BACK 0.9
attribute float aKind;
varying float vKind;
varying vec3 vLocal, vCamera;
#include <fog_pars_vertex>
${CAMERA}
void main() {
  vCamera = cameraLocal();
  vec3 local = position;
  if (aKind < 0.5) {
    // The halo is one card turned to face the camera, so its light hugs the
    // rectangle's outline the same way from every side. It stands behind the
    // portal, so the portal hides whatever glow falls on its own pixels.
    vec3 centre = vec3(0.0, OY, 0.0), toEye = vCamera - centre;
    float far = length(toEye);
    vec3 view = toEye / far, right = cross(vec3(0.0, 1.0, 0.0), view);
    right = dot(right, right) < 1e-6 ? vec3(1.0, 0.0, 0.0) : normalize(right);
    local = centre - view * BACK + (right * position.x + cross(view, right) * position.y) * (far + BACK) / max(far - BACK, 0.5);
  }
  vLocal = local;
  vKind = aKind;
  vec4 mvPosition = modelViewMatrix * vec4(local, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const VORTEX_VERTEX = `
attribute float aSide;
varying vec3 vLocal, vCamera;
varying float vSide;
#include <fog_pars_vertex>
${CAMERA}
void main() {
  vLocal = position;
  vCamera = cameraLocal();
  vSide = aSide;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

// Build a rectangular portal with slight depth curvature toward center.
function rectLens() {
  const position = [], side = [];
  const quad = (corners, s) => {
    const [a, b, c, d] = corners;
    for (const p of [a, b, c, a, c, d]) { position.push(...p); side.push(s); }
  };
  const on = (ix, iy) => {
    const x = (ix + 0.5) * CELL, y = (iy + 0.5) * CELL;
    return x >= -RX && x <= RX && y >= 0 && y <= OY + RY;
  };
  const point = (x, y, face) => {
    // Slight curvature: deeper in center, shallower at edges
    const nx = x / RX, ny = (y - OY) / RY;
    const curve = Math.max(0, 1 - nx * nx) * Math.max(0, 1 - ny * ny);
    return [x, y, face * HZ * (0.3 + 0.7 * curve)];
  };
  const x0 = Math.floor(-RX / CELL), x1 = Math.ceil(RX / CELL);
  const y0 = 0, y1 = Math.ceil((OY + RY) / CELL);
  for (let iy = y0; iy < y1; iy++) for (let ix = x0; ix < x1; ix++) {
    if (!on(ix, iy)) continue;
    const x = ix * CELL, y = iy * CELL, x2 = x + CELL, y2 = y + CELL;
    // Front and back faces
    quad([point(x, y, 1), point(x2, y, 1), point(x2, y2, 1), point(x, y2, 1)], 0);
    quad([point(x2, y, -1), point(x, y, -1), point(x, y2, -1), point(x2, y2, -1)], 0);
    // Edge faces
    if (!on(ix - 1, iy)) quad([point(x, y, -1), point(x, y, 1), point(x, y2, 1), point(x, y2, -1)], 1);
    if (!on(ix + 1, iy)) quad([point(x2, y, 1), point(x2, y, -1), point(x2, y2, -1), point(x2, y2, 1)], 1);
    if (!on(ix, iy - 1)) quad([point(x, y, 1), point(x2, y, 1), point(x2, y, -1), point(x, y, -1)], 1);
    if (!on(ix, iy + 1)) quad([point(x, y2, -1), point(x2, y2, -1), point(x2, y2, 1), point(x, y2, 1)], 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  return geometry;
}

export function createGate() {
  const color = hex => new THREE.Color(hex);
  const uniforms = {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    uTime: { value: 0 }, uSpin: { value: 0 }, uFlow: { value: 0 }, uNear: { value: 0 }, uCharge: { value: 0 }, uShow: { value: 0 },
    uPreview: { value: null }, uFit: { value: new THREE.Vector4(1, 1, 0, 0) },
    uA: { value: color(COLORS.a) }, uB: { value: color(COLORS.b) }, uC: { value: color(COLORS.c) },
    uWhite: { value: color(COLORS.white) }, uRim: { value: color(COLORS.rim) },
    uHalo: { value: color(COLORS.halo) }, uGround: { value: color(COLORS.ground) },
  };
  const group = new THREE.Group();
  const top = OY + RY;

  // The vortex, one texel per 1/16 m, with a clean light rim; where it leads
  // shows through the middle in the same pixels.
  const vortex = new THREE.Mesh(rectLens(), new THREE.ShaderMaterial({
    uniforms, fog: true, side: THREE.DoubleSide, vertexShader: VORTEX_VERTEX,
    fragmentShader: `${HEAD}
      uniform vec3 uA, uB, uC, uWhite, uRim;
      uniform float uShow;
      uniform sampler2D uPreview;
      uniform vec4 uFit;
      varying vec3 vLocal, vCamera;
      varying float vSide;
      #include <fog_pars_fragment>
      ${LOOK}
      void main() {
        vec3 col;
        if (vSide > 0.5) {
          float flow = 0.5 + 0.5 * sin(vLocal.y * 7.0 + vLocal.z * 12.0 - uFlow);
          col = mix(uB, uRim, 0.35 + 0.45 * flow);
        } else {
          vec2 p = (floor(vLocal.xy / CELL) + 0.5) * CELL;
          float inside = edgeDist(p) / CELL;
          if (inside < 0.0 || p.y < 0.0) discard;
          // Normalized coords for the swirl pattern
          vec2 q = (p - vec2(0.0, OY)) / vec2(RX, RY);
          float face = vCamera.z < 0.0 ? -1.0 : 1.0;
          // Slight depth for the funnel effect
          float curve = max(0.0, 1.0 - q.x * q.x) * max(0.0, 1.0 - q.y * q.y);
          vec3 ray = vec3(p, face * HZ * (0.3 + 0.7 * curve)) - vCamera;
          vec2 lean = ray.xy / max(-face * ray.z, 1e-3) * SINK / vec2(RX, RY);
          lean *= LEAN / sqrt(LEAN * LEAN + dot(lean, lean));
          vec2 sunk = q + lean * (1.0 - min(length(q), 1.0));
          col = look(length(sunk), atan(sunk.y, sunk.x));
          if (uShow > 0.001) {
            vec2 uv = vec2(p.x / (2.0 * RX) + 0.5, p.y / (2.0 * RY));
            col = mix(col, texture2D(uPreview, uv * uFit.xy + uFit.zw).rgb, uShow * smoothstep(2.0, 6.0, inside));
          }
          float rim = (1.0 - smoothstep(0.0, 1.6, inside))
            * (0.55 + 0.2 * sin(atan(q.y, q.x) * 5.0 - uTime * 1.5));
          col = mix(col, uRim, rim);
        }
        col *= 1.0 + 0.1 * uNear + 0.25 * uCharge;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  vortex.name = 'portal-vortex';
  group.add(vortex);

  // One halo card, turned to the camera by its shader so the energy shows
  // even from directly beside it. It shares a mesh with the light cast on
  // the ground.
  const position = [], kind = [];
  const quad = (corners, k) => {
    const [a, b, c, d] = corners;
    for (const p of [a, b, c, a, c, d]) { position.push(...p); kind.push(k); }
  };
  const [hx, hy] = HALO;
  quad([[-hx, -hy, 0], [hx, -hy, 0], [hx, hy, 0], [-hx, hy, 0]], 0);
  quad([[-1.4, 0.03, 1.8], [1.4, 0.03, 1.8], [1.4, 0.03, -1.0], [-1.4, 0.03, -1.0]], 1);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  glowGeometry.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  glowGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, OY, 0), 5);
  const glow = new THREE.Mesh(glowGeometry, new THREE.ShaderMaterial({
    uniforms, fog: true, side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLOW_VERTEX,
    fragmentShader: `${HEAD}
      uniform vec3 uHalo, uGround;
      varying vec3 vLocal, vCamera; varying float vKind;
      #include <fog_pars_fragment>
      void main() {
        vec3 col;
        if (vKind < 0.5) {
          // Distance from rectangular portal for halo glow
          vec2 p = vLocal.xy - vec2(0.0, OY);
          vec2 d = abs(p) - vec2(RX, RY);
          float dist = length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
          if (dist < 0.0) discard;
          float glow = 0.6 * exp(-dist * 10.0) + 0.4 * exp(-dist * (4.0 - uNear));
          col = uHalo * glow * (1.0 - smoothstep(0.2, 0.6 + 0.1 * uNear, dist)) * smoothstep(0.0, 0.3, vLocal.y)
            * (0.15 * (1.0 + 0.6 * uNear) + 0.5 * uCharge);
        } else {
          // Light spilling onto the ground
          vec2 cell = floor(vLocal.xz / CELL), g = (cell + 0.5) * CELL;
          float across = max(abs(g.x) - RX * 0.4, 0.0) / 0.5;
          float out_ = g.y / (g.y > 0.0 ? 0.8 : 0.5);
          float spill = exp(-across * across - out_ * out_);
          col = uGround * spill * mix(0.7, 1.15, hash(cell)) * (0.42 * (1.0 + 0.4 * uNear) + 0.6 * uCharge);
        }
        #ifdef USE_FOG
          #ifdef FOG_EXP2
            col *= exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
          #else
            col *= 1.0 - smoothstep(fogNear, fogFar, vFogDepth);
          #endif
        #endif
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  glow.name = 'portal-glow'; glow.renderOrder = 2;
  group.add(glow);

  let time = 0, spin = 0, flow = 0;
  return {
    group,
    // How wide a walk into it counts, half the width and the depth nobody
    // walks through, and the rectangle's shape for fitting a picture.
    width: RX * 2 * 0.7, solid: RX + 0.05, depth: HZ, aspect: RX / RY,
    // What a click on the portal hits, in its own space.
    box: new THREE.Box3(new THREE.Vector3(-RX, 0, -HZ), new THREE.Vector3(RX, top, HZ)),
    // The destination's picture, fitted as [repeat x, y, offset x, y]; null clears it.
    setPreview(texture, fit = [1, 1, 0, 0]) {
      uniforms.uPreview.value = texture; uniforms.uFit.value.set(...fit);
      if (!texture) uniforms.uShow.value = 0;
    },
    // near: how close the player is (0–1); charge: opening for a journey (0–1);
    // show: how far the destination's picture has faded in (0–1).
    update(dt, near, charge, show) {
      const step = dt * (reduced ? 0.2 : 1);
      time += step;
      const lively = 1 + SPIN_NEAR * near;
      spin = (spin + step * (SPIN * lively + 3.5 * charge)) % (Math.PI * 2);
      flow = (flow + step * (1.6 * lively + 2.6 * charge)) % (Math.PI * 2);
      uniforms.uTime.value = time % 1000;
      uniforms.uSpin.value = spin; uniforms.uFlow.value = flow;
      uniforms.uNear.value = near; uniforms.uCharge.value = charge;
      uniforms.uShow.value = uniforms.uPreview.value ? show : 0;
    },
  };
}
