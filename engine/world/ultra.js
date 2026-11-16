// 超清模式 / Ultra: the frame drawn into an HDR target, then finished like a
// film camera would. Loaded only when ULTRA is on (main.js imports it on
// demand); normal mode never touches this file.
//
//   reflection  the scene mirrored in the sea, from a camera under the water
//               with an oblique near plane (pool.js samples it)
//   scene       half-float colour, 4× MSAA, resolved depth
//   ambient     screen-space occlusion from depth, blurred along surfaces
//   shafts      radial blur of the bright sky around the sun
//   bloom       six-level mip chain, soft threshold
//   finish      haze lit toward the sun, AgX/ACES tone curve, grade,
//               lens ghosts, light chromatic fringe, sharpening, grain
import * as THREE from 'three';
import { supportsUltra } from '../ultra-flag.js';

const FULL_VERTEX = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const COMMON = /* glsl */`
  varying vec2 vUv;
  float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
`;

const ADAPT_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tScene, tDepth, tPrevious;
  uniform vec2 uSun;
  uniform float uAspect, uDelta, uReady, uSunOn;
  void main() {
    float total = 0.0, weights = 0.0;
    for (int row = 0; row < 5; row++) for (int column = 0; column < 7; column++) {
      vec2 point = (vec2(float(column), float(row)) + 0.5) / vec2(7.0, 5.0);
      float weight = 1.0 - smoothstep(0.15, 0.7, length(point - 0.5)) * 0.65;
      total += log(max(luma(max(texture2D(tScene, point).rgb, 0.0)), 0.0001)) * weight;
      weights += weight;
    }
    float exposure = clamp(pow(0.2 / exp(total / weights), 0.65), 0.65, 1.65);
    float visibility = 0.0;
    for (int index = 0; index < 12; index++) {
      float angle = float(index) * 2.399963;
      float radius = sqrt((float(index) + 0.5) / 12.0) * 0.012;
      vec2 point = uSun + vec2(cos(angle) / uAspect, sin(angle)) * radius;
      vec2 inside = step(vec2(0.0), point) * step(point, vec2(1.0));
      visibility += step(0.999999, texture2D(tDepth, point).r) * inside.x * inside.y;
    }
    visibility = visibility / 12.0 * uSunOn;
    vec2 previous = texture2D(tPrevious, vec2(0.5)).rg;
    float blend = uReady > 0.5 ? 1.0 - exp(-uDelta * 1.4) : 1.0;
    float visibleBlend = uReady > 0.5 ? 1.0 - exp(-uDelta * 12.0) : 1.0;
    gl_FragColor = vec4(mix(previous.r, exposure, blend), mix(previous.g, visibility, visibleBlend), 0.0, 1.0);
  }
`;

const AO_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tDepth;
  uniform mat4 uProj, uInvProj;
  uniform vec2 uTexel;
  uniform float uRadius;
  uniform vec3 uKernel[SAMPLES];
  vec3 viewAt(vec2 uv) {
    float d = texture2D(tDepth, uv).r;
    vec4 p = uInvProj * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
    return p.xyz / p.w;
  }
  void main() {
    float depth = texture2D(tDepth, vUv).r;
    if (depth >= 1.0) { gl_FragColor = vec4(1.0); return; }
    vec3 P = viewAt(vUv);
    vec3 px = viewAt(vUv + vec2(uTexel.x, 0.0)) - P, nx = P - viewAt(vUv - vec2(uTexel.x, 0.0));
    vec3 py = viewAt(vUv + vec2(0.0, uTexel.y)) - P, ny = P - viewAt(vUv - vec2(0.0, uTexel.y));
    vec3 dx = abs(px.z) < abs(nx.z) ? px : nx, dy = abs(py.z) < abs(ny.z) ? py : ny;
    vec3 N = normalize(cross(dx, dy));
    if (dot(N, P) > 0.0) N = -N;
    float angle = hash12(gl_FragCoord.xy) * 6.2831853;
    vec3 spin = vec3(cos(angle), sin(angle), 0.0);
    vec3 T = normalize(spin - N * dot(spin, N)), B = cross(N, T);
    // Wider in the distance so far blocks still read, never wider than 2.5 m.
    float radius = min(2.5, uRadius * (1.0 + -P.z * 0.025));
    float occlusion = 0.0;
    for (int i = 0; i < SAMPLES; i++) {
      vec3 k = uKernel[i];
      vec3 s = P + (T * k.x + B * k.y + N * k.z) * radius;
      vec4 c = uProj * vec4(s, 1.0);
      vec2 suv = c.xy / c.w * 0.5 + 0.5;
      float sz = viewAt(suv).z;
      float range = smoothstep(0.0, 1.0, radius / max(abs(P.z - sz), 1e-3));
      occlusion += step(s.z + 0.03, sz) * range;
    }
    gl_FragColor = vec4(vec3(1.0 - occlusion / float(SAMPLES)), 1.0);
  }
`;

const AO_BLUR_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tAO, tDepth;
  uniform vec2 uTexel;
  uniform vec2 uClip;
  float viewZ(vec2 uv) { float d = texture2D(tDepth, uv).r; return uClip.x * uClip.y / ((uClip.y - uClip.x) * d - uClip.y); }
  void main() {
    float z0 = viewZ(vUv), sum = 0.0, weight = 0.0;
    for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) {
      vec2 uv = vUv + vec2(float(i), float(j)) * uTexel;
      float w = exp(-abs(viewZ(uv) - z0) / (0.05 + abs(z0) * 0.015));
      sum += texture2D(tAO, uv).r * w; weight += w;
    }
    gl_FragColor = vec4(vec3(sum / max(weight, 1e-4)), 1.0);
  }
`;

const SHAFT_MASK_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tScene, tDepth;
  uniform vec2 uSun;
  uniform float uAspect;
  void main() {
    float sky = step(0.999999, texture2D(tDepth, vUv).r);
    vec3 c = min(texture2D(tScene, vUv).rgb, vec3(12.0));
    vec2 d = (vUv - uSun) * vec2(uAspect, 1.0);
    float fall = max(0.0, 1.0 - length(d) / 0.85);
    // Plain sky adds a little; the sun, its aureole and lit cloud edges most.
    float bright = 0.12 + smoothstep(0.8, 4.0, luma(c));
    gl_FragColor = vec4(c * sky * bright * fall * fall, 1.0);
  }
`;

const SHAFT_BLUR_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tMask;
  uniform vec2 uSun;
  uniform float uLength, uDecay;
  void main() {
    vec2 delta = (vUv - uSun) * uLength / float(TAPS);
    vec2 uv = vUv - delta * hash12(gl_FragCoord.xy);
    vec3 sum = vec3(0.0);
    float w = 1.0, total = 0.0;
    for (int i = 0; i < TAPS; i++) {
      sum += texture2D(tMask, uv).rgb * w; total += w;
      uv -= delta; w *= uDecay;
    }
    gl_FragColor = vec4(sum / total, 1.0);
  }
`;

// Bloom: a 4-tap box down (with a soft threshold and Karis weights on the
// first step, so single hot pixels do not flicker) and a 9-tap tent up.
const DOWN_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tSource;
  uniform vec2 uTexel;
  uniform float uThreshold, uFirst;
  vec3 tap(vec2 uv) {
    vec3 c = texture2D(tSource, uv).rgb;
    if (uFirst > 0.5) {
      c = min(c, vec3(64.0));
      float l = luma(c), knee = uThreshold * 0.5;
      float soft = clamp(l - uThreshold + knee, 0.0, 2.0 * knee);
      soft = soft * soft / (4.0 * knee + 1e-4);
      c *= max(soft, l - uThreshold) / max(l, 1e-4);
      c /= 1.0 + luma(c);
    }
    return c;
  }
  void main() {
    vec2 o = uTexel * 0.5;
    vec3 c = tap(vUv + vec2(-o.x, -o.y)) + tap(vUv + vec2(o.x, -o.y)) + tap(vUv + vec2(-o.x, o.y)) + tap(vUv + vec2(o.x, o.y));
    c *= 0.25;
    if (uFirst > 0.5) c /= max(1.0 - luma(c), 0.02);
    gl_FragColor = vec4(c, 1.0);
  }
`;

const UP_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tSource;
  uniform vec2 uTexel;
  uniform float uWeight;
  void main() {
    vec2 o = uTexel;
    vec3 c = texture2D(tSource, vUv).rgb * 4.0;
    c += (texture2D(tSource, vUv + vec2(-o.x, 0.0)).rgb + texture2D(tSource, vUv + vec2(o.x, 0.0)).rgb
      + texture2D(tSource, vUv + vec2(0.0, -o.y)).rgb + texture2D(tSource, vUv + vec2(0.0, o.y)).rgb) * 2.0;
    c += texture2D(tSource, vUv - o).rgb + texture2D(tSource, vUv + o).rgb
      + texture2D(tSource, vUv + vec2(o.x, -o.y)).rgb + texture2D(tSource, vUv + vec2(-o.x, o.y)).rgb;
    gl_FragColor = vec4(c / 16.0 * uWeight, 1.0);
  }
`;

const FINISH_FRAGMENT = /* glsl */`
  ${COMMON}
  uniform sampler2D tScene, tDepth, tAO, tShafts, tBloom, tGhost, tAdapt;
  uniform mat4 uInvProj, uCamWorld;
  uniform vec3 uSunDir, uSunColor, uFogColor;
  uniform vec2 uTexel, uSun;
  uniform float uAspect, uExposure, uTime, uSunSeen, uHaze, uAO, uShafts, uBloom, uGhosts, uNight, uUnder;

  // AgX (Blender's default view), three.js's fit, blended toward ACES for
  // a little more bite in the highlights, as the reference scene does.
  vec3 agxCurve(vec3 x) {
    vec3 x2 = x * x, x4 = x2 * x2;
    return 15.5 * x4 * x2 - 40.14 * x4 * x + 31.96 * x4 - 6.868 * x2 * x + 0.4298 * x2 + 0.1191 * x - 0.00232;
  }
  vec3 agx(vec3 color) {
    const mat3 toRec2020 = mat3(0.6274, 0.0691, 0.0164, 0.3293, 0.9195, 0.0880, 0.0433, 0.0113, 0.8956);
    const mat3 fromRec2020 = mat3(1.6605, -0.1246, -0.0182, -0.5876, 1.1329, -0.1006, -0.0728, -0.0083, 1.1187);
    const mat3 inset = mat3(0.856627153315983, 0.137318972929847, 0.11189821299995, 0.0951212405381588, 0.761241990602591,
      0.0767994186031903, 0.0482516061458583, 0.101439036467562, 0.811302368396859);
    const mat3 outset = mat3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826, -0.11060664309660323, 1.157823702216272,
      -0.11060664309660294, -0.016493938717834573, -0.016493938717834257, 1.2519364065950405);
    color = inset * (toRec2020 * color);
    color = clamp((log2(max(color, 1e-10)) + 12.47393) / 16.5, 0.0, 1.0);
    color = outset * agxCurve(color);
    color = pow(max(color, 0.0), vec3(2.2));
    return clamp(fromRec2020 * color, 0.0, 1.0);
  }
  vec3 aces(vec3 color) {
    const mat3 inMat = mat3(0.59719, 0.07600, 0.02840, 0.35458, 0.90834, 0.13383, 0.04823, 0.01566, 0.83777);
    const mat3 outMat = mat3(1.60475, -0.10208, -0.00327, -0.53108, 1.10813, -0.07276, -0.07367, -0.00605, 1.07602);
    color = inMat * (color / 0.6);
    color = (color * (color + 0.0245786) - 0.000090537) / (color * (0.983729 * color + 0.4329510) + 0.238081);
    return clamp(outMat * color, 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c)); }

  void main() {
    vec2 uv = vUv, centred = uv - 0.5;
    // A faint colour fringe toward the corners, as from a real lens.
    vec2 fringe = centred * dot(centred, centred) * 0.006;
    vec3 c = vec3(texture2D(tScene, uv + fringe).r, texture2D(tScene, uv).g, texture2D(tScene, uv - fringe).b);
    // Gentle sharpening restores the pixel art the supersampling softens.
    vec3 around = texture2D(tScene, uv + vec2(uTexel.x, 0.0)).rgb + texture2D(tScene, uv - vec2(uTexel.x, 0.0)).rgb
      + texture2D(tScene, uv + vec2(0.0, uTexel.y)).rgb + texture2D(tScene, uv - vec2(0.0, uTexel.y)).rgb;
    c = max(c + (c * 4.0 - around) * 0.12, 0.0);

    float depth = texture2D(tDepth, uv).r, solid = step(depth, 0.999999);
    c *= mix(1.0, texture2D(tAO, uv).r, uAO * solid);

    // Air between the eye and the land: blue-grey away from the sun,
    // warm and bright toward it (forward scattering).
    vec4 view = uInvProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
    view.xyz /= view.w;
    vec3 ray = normalize((uCamWorld * vec4(view.xyz, 0.0)).xyz);
    float toward = max(dot(ray, uSunDir), 0.0);
    float haze = (1.0 - exp(-length(view.xyz) * uHaze)) * solid * (1.0 - uUnder);
    vec3 air = uFogColor + uSunColor * (pow(toward, 6.0) * 0.2 + pow(toward, 40.0) * 0.55) * uSunSeen;
    c = mix(c, air, haze);

    c += texture2D(tShafts, uv).rgb * uShafts;
    c = mix(c, texture2D(tBloom, uv).rgb, uBloom);

    // Lens ghosts: the bright parts of the frame, mirrored through the centre.
    vec2 flipped = 1.0 - uv, step = (0.5 - flipped) * 0.42;
    vec3 ghosts = vec3(0.0);
    for (int i = 1; i <= 4; i++) {
      vec2 at = flipped + step * float(i);
      float w = pow(max(0.0, 1.0 - length(0.5 - at) / 0.7071), 6.0);
      ghosts += texture2D(tGhost, at).rgb * w * (i == 2 ? vec3(0.5, 0.75, 1.0) : i == 3 ? vec3(1.0, 0.7, 0.45) : vec3(0.8, 1.0, 0.8));
    }
    vec2 haloAt = flipped + normalize(0.5 - flipped + 1e-5) * 0.46;
    ghosts += texture2D(tGhost, haloAt).rgb * pow(max(0.0, 1.0 - length(0.5 - haloAt) / 0.7071), 5.0) * 0.6;
    vec2 adaptation = texture2D(tAdapt, vec2(0.5)).rg;
    c += ghosts * uGhosts * adaptation.g;

    c *= uExposure * adaptation.r;
    c = mix(agx(c), aces(c), 0.35);
    // Grade: a touch more colour than AgX keeps, warm highlights, cool shadows.
    float l = luma(c);
    c = max(mix(vec3(l), c, mix(1.28, 1.12, uNight)), 0.0);
    c *= mix(vec3(0.96, 0.99, 1.05), vec3(1.04, 1.0, 0.95), smoothstep(0.1, 0.7, l));
    // Vignette.
    c *= mix(1.0, 1.0 - smoothstep(0.35, 1.15, length(centred * vec2(uAspect, 1.0)) * 1.05), 0.35);
    c = toSRGB(clamp(c, 0.0, 1.0));
    // A gentle S-curve in display space, then film grain.
    c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
    c += (hash12(gl_FragCoord.xy + fract(uTime) * 517.0) - 0.5) * 0.018;
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function installUltra(stage) {
  const { renderer, camera, sun, sky } = stage;
  const gl = renderer.getContext();
  if (!supportsUltra(renderer)) throw new Error('Ultra needs WebGL 2 and floating-point render targets');
  const supportedSamples = gl.getInternalformatParameter(gl.RENDERBUFFER, gl.RGBA16F, gl.SAMPLES);
  const samples = supportedSamples.find(value => value <= (stage.quality.mobile ? 2 : 4)) || 0;
  renderer.info.autoReset = false;

  const quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const triangle = new THREE.BufferGeometry();
  triangle.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const quad = new THREE.Mesh(triangle);
  quad.frustumCulled = false;
  const quadScene = new THREE.Scene();
  quadScene.add(quad);

  const pass = (fragmentShader, uniforms, defines = {}, extra = {}) => new THREE.ShaderMaterial({
    vertexShader: FULL_VERTEX, fragmentShader, uniforms, defines, depthTest: false, depthWrite: false, toneMapped: false, ...extra,
  });

  // A hemisphere of sample points, denser near the centre.
  const SAMPLES = 16;
  let seed = 9001;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const kernel = Array.from({ length: SAMPLES }, (_, i) => {
    const v = new THREE.Vector3(random() * 2 - 1, random() * 2 - 1, random() * 0.85 + 0.15).normalize();
    const t = i / SAMPLES;
    return v.multiplyScalar((0.1 + 0.9 * t * t) * (0.5 + random() * 0.5));
  });

  const aoMaterial = pass(AO_FRAGMENT, {
    tDepth: { value: null }, uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
    uTexel: { value: new THREE.Vector2() }, uRadius: { value: 0.75 }, uKernel: { value: kernel },
  }, { SAMPLES });
  const aoBlurMaterial = pass(AO_BLUR_FRAGMENT, { tAO: { value: null }, tDepth: { value: null }, uTexel: { value: new THREE.Vector2() }, uClip: { value: new THREE.Vector2() } });
  const maskMaterial = pass(SHAFT_MASK_FRAGMENT, { tScene: { value: null }, tDepth: { value: null }, uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 } });
  const shaftMaterial = pass(SHAFT_BLUR_FRAGMENT, { tMask: { value: null }, uSun: { value: new THREE.Vector2() }, uLength: { value: 1 }, uDecay: { value: 0.97 } }, { TAPS: 48 });
  const downMaterial = pass(DOWN_FRAGMENT, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.6 }, uFirst: { value: 0 } });
  const upMaterial = pass(UP_FRAGMENT, { tSource: { value: null }, uTexel: { value: new THREE.Vector2() }, uWeight: { value: 1 } }, {},
    { blending: THREE.AdditiveBlending, transparent: true });
  const finishMaterial = pass(FINISH_FRAGMENT, {
    tScene: { value: null }, tDepth: { value: null }, tAO: { value: null }, tShafts: { value: null }, tBloom: { value: null }, tGhost: { value: null }, tAdapt: { value: null },
    uInvProj: { value: new THREE.Matrix4() }, uCamWorld: { value: new THREE.Matrix4() },
    uSunDir: { value: new THREE.Vector3() }, uSunColor: { value: new THREE.Color() }, uFogColor: { value: new THREE.Color() },
    uTexel: { value: new THREE.Vector2() }, uSun: { value: new THREE.Vector2() },
    uAspect: { value: 1 }, uExposure: { value: 1 }, uTime: { value: 0 }, uSunSeen: { value: 0 }, uHaze: { value: 0 },
    uAO: { value: 0.65 }, uShafts: { value: 0.3 }, uBloom: { value: 0.065 }, uGhosts: { value: 0.07 }, uNight: { value: 0 }, uUnder: { value: 0 },
  });
  const adaptMaterial = pass(ADAPT_FRAGMENT, {
    tScene: { value: null }, tDepth: { value: null }, tPrevious: { value: null },
    uSun: { value: new THREE.Vector2() }, uAspect: { value: 1 }, uDelta: { value: 0 },
    uReady: { value: 0 }, uSunOn: { value: 0 },
  });

  // ---------- Targets, rebuilt whenever the drawing buffer changes size ----------
  const LEVELS = 5;
  const size = new THREE.Vector2();
  let width = 0, height = 0, targets = null, adaptationIndex = 0, adaptationReady = false;
  const colour = (w, h, extra = {}) => new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...extra,
  });
  function build(w, h) {
    if (targets) for (const t of Object.values(targets).flat()) t.dispose();
    width = w; height = h;
    const half = [Math.ceil(w / 2), Math.ceil(h / 2)], quarter = [Math.ceil(w / 4), Math.ceil(h / 4)];
    const depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    targets = {
      scene: colour(w, h, { samples, depthBuffer: true, depthTexture }),
      reflection: colour(half[0], half[1], { depthBuffer: true }),
      adapt: [colour(1, 1), colour(1, 1)],
      ao: colour(...half, { type: THREE.UnsignedByteType }),
      aoBlur: colour(...half, { type: THREE.UnsignedByteType }),
      mask: colour(...quarter), shaftA: colour(...quarter), shaftB: colour(...quarter),
      bloom: Array.from({ length: LEVELS }, (_, i) => colour(Math.ceil(w / 2 ** (i + 1)), Math.ceil(h / 2 ** (i + 1)))),
    };
    adaptationReady = false;
    for (const m of mirrors) m.uniforms.uReflection.value = targets.reflection.texture;
  }

  function draw(material, target) {
    quad.material = material;
    renderer.setRenderTarget(target);
    renderer.render(quadScene, quadCamera);
  }

  // ---------- Planar reflection (three.js's Reflector, for a level plane) ----------
  const mirrors = [];
  const waterScene = new THREE.Scene();
  const reflectedMeshes = [], hiddenMeshes = [];
  const clearColor = new THREE.Color();
  let reflectionScene = null;
  function collectReflection(object) {
    if (object.isMesh || object.isLine || object.isPoints) reflectedMeshes.push(object);
  }
  const mirrorCamera = new THREE.PerspectiveCamera();
  const up = new THREE.Vector3(0, 1, 0), point = new THREE.Vector3(), eye = new THREE.Vector3(), mirrored = new THREE.Vector3();
  const look = new THREE.Vector3(), aim = new THREE.Vector3(), rotation = new THREE.Matrix4(), plane = new THREE.Plane();
  const clip = new THREE.Vector4(), q = new THREE.Vector4();
  const BIAS = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  function reflect(scene, mirror) {
    eye.setFromMatrixPosition(camera.matrixWorld);
    point.set(eye.x, mirror.level, eye.z);
    if (eye.y < mirror.level + 0.02) return false;
    mirrored.subVectors(point, eye).reflect(up).negate().add(point);
    rotation.extractRotation(camera.matrixWorld);
    look.set(0, 0, -1).applyMatrix4(rotation).add(eye);
    aim.subVectors(point, look).reflect(up).negate().add(point);
    mirrorCamera.position.copy(mirrored);
    mirrorCamera.up.set(0, 1, 0).applyMatrix4(rotation).reflect(up);
    mirrorCamera.lookAt(aim);
    mirrorCamera.near = camera.near; mirrorCamera.far = camera.far;
    mirrorCamera.layers.mask = camera.layers.mask;
    mirrorCamera.updateMatrixWorld();
    mirrorCamera.projectionMatrix.copy(camera.projectionMatrix);
    mirror.uniforms.uReflMatrix.value.copy(BIAS).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
    // Bend the near plane onto the water so nothing under it is drawn.
    plane.setFromNormalAndCoplanarPoint(up, point).applyMatrix4(mirrorCamera.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const e = mirrorCamera.projectionMatrix.elements;
    q.set((Math.sign(clip.x) + e[8]) / e[0], (Math.sign(clip.y) + e[9]) / e[5], -1, (1 + e[10]) / e[14]);
    clip.multiplyScalar(2 / clip.dot(q));
    e[2] = clip.x; e[6] = clip.y; e[10] = clip.z + 1 - 0.003; e[14] = clip.w;
    mirrorCamera.projectionMatrixInverse.copy(mirrorCamera.projectionMatrix).invert();
    if (scene !== reflectionScene) {
      reflectedMeshes.length = 0;
      scene.traverse(collectReflection);
      reflectionScene = scene;
    }
    hiddenMeshes.length = 0;
    for (const object of reflectedMeshes) {
      if (!object.visible) continue;
      if (object === sky || object === mirror.mesh || !object.isMesh) {
        object.visible = false;
        hiddenMeshes.push(object);
      }
    }
    const alpha = renderer.getClearAlpha();
    renderer.getClearColor(clearColor);
    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(targets.reflection);
    try { renderer.render(scene, mirrorCamera); }
    finally {
      renderer.setClearColor(clearColor, alpha);
      for (const object of hiddenMeshes) object.visible = true;
    }
    return true;
  }

  function nearReflectionBounds(camera, mirror) {
    if (!mirror.bounds?.length) return true;
    const maxDistance = mirror.maxDistance ?? Infinity;
    let distanceSquared = Infinity;
    for (const bounds of mirror.bounds) {
      const dx = Math.max(bounds.x0 - camera.position.x, 0, camera.position.x - bounds.x1);
      const dz = Math.max(bounds.z0 - camera.position.z, 0, camera.position.z - bounds.z1);
      distanceSquared = Math.min(distanceSquared, dx * dx + dz * dz);
    }
    return distanceSquared <= maxDistance * maxDistance;
  }

  // ---------- Per-frame ----------
  const sunPoint = new THREE.Vector3(), forward = new THREE.Vector3();
  const started = performance.now();
  let lastTime = started;
  let night = 0;
  let reflectionFrame = 0, reflectionReady = false;
  const reflectionWeather = { cloud: 0, rain: 0, snow: 0, fog: 0, haze: 0 };
  function clearWeather() {
    return reflectionWeather.rain < 0.02 && reflectionWeather.snow < 0.02
      && reflectionWeather.fog < 0.02 && reflectionWeather.haze < 0.02
      && reflectionWeather.cloud < 0.78 && stage.veil < 0.78;
  }
  function render(scene, camera) {
    camera.updateMatrixWorld();
    renderer.getDrawingBufferSize(size);
    if (size.x !== width || size.y !== height) build(size.x, size.y);
    renderer.info.reset();
    const autoClear = renderer.autoClear;
    renderer.autoClear = true;

    const clear = clearWeather();
    if (!clear) {
      for (const mirror of mirrors) mirror.uniforms.uReflectOn.value = 0;
      reflectionReady = false;
    } else {
      const refresh = !reflectionReady || reflectionFrame % 2 === 0;
      if (refresh) {
        let reflected = false;
        for (const mirror of mirrors) {
          mirror.uniforms.uReflectOn.value = mirror.mesh.visible && nearReflectionBounds(camera, mirror) && reflect(scene, mirror) ? 1 : 0;
          reflected ||= mirror.uniforms.uReflectOn.value > 0;
        }
        reflectionReady = reflected;
      }
      reflectionFrame++;
    }
    renderer.setRenderTarget(targets.scene);
    renderer.render(scene, camera);

    renderer.autoClear = false;
    if (mirrors.length) {
      for (const mirror of mirrors) {
        mirror.depthMesh.visible = mirror.mesh.visible;
        mirror.depthMesh.geometry = mirror.mesh.geometry;
        mirror.depthMesh.matrix.copy(mirror.mesh.matrixWorld);
      }
      renderer.render(waterScene, camera);
    }
    const depth = targets.scene.depthTexture, colourTex = targets.scene.texture;

    // Ambient occlusion.
    aoMaterial.uniforms.tDepth.value = depth;
    aoMaterial.uniforms.uProj.value.copy(camera.projectionMatrix);
    aoMaterial.uniforms.uInvProj.value.copy(camera.projectionMatrixInverse);
    aoMaterial.uniforms.uTexel.value.set(1 / width, 1 / height);
    draw(aoMaterial, targets.ao);
    aoBlurMaterial.uniforms.tAO.value = targets.ao.texture;
    aoBlurMaterial.uniforms.tDepth.value = depth;
    aoBlurMaterial.uniforms.uTexel.value.set(1 / targets.ao.width, 1 / targets.ao.height);
    aoBlurMaterial.uniforms.uClip.value.set(camera.near, camera.far);
    draw(aoBlurMaterial, targets.aoBlur);

    // Where the sun stands on screen, and how much of it is seen.
    const sunDir = sky.material.uniforms.uSunDir.value;
    camera.getWorldDirection(forward);
    sunPoint.copy(camera.position).addScaledVector(sunDir, 100).project(camera);
    const sx = sunPoint.x * 0.5 + 0.5, sy = sunPoint.y * 0.5 + 0.5;
    const facing = THREE.MathUtils.smoothstep(forward.dot(sunDir), 0.05, 0.35);
    const onScreen = 1 - THREE.MathUtils.smoothstep(Math.max(Math.abs(sx - 0.5), Math.abs(sy - 0.5)), 0.6, 1.1);
    night = stage.night;
    const under = stage.submerged ? 1 : 0;
    const seen = (sun.visible ? 1 : 0) * (1 - stage.veil) * (1 - under);
    const shafts = facing * onScreen * seen * (1 - 0.75 * night) * (clear ? 1 : 0);
    const timestamp = performance.now();
    const adapt = adaptMaterial.uniforms;
    adapt.tScene.value = colourTex; adapt.tDepth.value = depth;
    adapt.tPrevious.value = targets.adapt[adaptationIndex].texture;
    adapt.uSun.value.set(sx, sy); adapt.uAspect.value = width / height;
    adapt.uDelta.value = Math.min(0.1, (timestamp - lastTime) / 1000);
    adapt.uReady.value = adaptationReady ? 1 : 0;
    adapt.uSunOn.value = seen * facing;
    lastTime = timestamp;
    adaptationIndex = 1 - adaptationIndex;
    draw(adaptMaterial, targets.adapt[adaptationIndex]);
    adaptationReady = true;

    if (shafts > 0.002) {
      maskMaterial.uniforms.tScene.value = colourTex;
      maskMaterial.uniforms.tDepth.value = depth;
      maskMaterial.uniforms.uSun.value.set(sx, sy);
      maskMaterial.uniforms.uAspect.value = width / height;
      draw(maskMaterial, targets.mask);
      shaftMaterial.uniforms.uSun.value.set(sx, sy);
      shaftMaterial.uniforms.tMask.value = targets.mask.texture;
      shaftMaterial.uniforms.uLength.value = 0.9; shaftMaterial.uniforms.uDecay.value = 0.975;
      draw(shaftMaterial, targets.shaftA);
      shaftMaterial.uniforms.tMask.value = targets.shaftA.texture;
      shaftMaterial.uniforms.uLength.value = 0.25; shaftMaterial.uniforms.uDecay.value = 0.99;
      draw(shaftMaterial, targets.shaftB);
    }

    // Bloom.
    const levels = targets.bloom;
    downMaterial.uniforms.uFirst.value = 1;
    downMaterial.uniforms.tSource.value = colourTex;
    downMaterial.uniforms.uTexel.value.set(1 / width, 1 / height);
    draw(downMaterial, levels[0]);
    downMaterial.uniforms.uFirst.value = 0;
    for (let i = 1; i < LEVELS; i++) {
      downMaterial.uniforms.tSource.value = levels[i - 1].texture;
      downMaterial.uniforms.uTexel.value.set(1 / levels[i - 1].width, 1 / levels[i - 1].height);
      draw(downMaterial, levels[i]);
    }
    for (let i = LEVELS - 2; i >= 0; i--) {
      upMaterial.uniforms.tSource.value = levels[i + 1].texture;
      upMaterial.uniforms.uTexel.value.set(1 / levels[i + 1].width, 1 / levels[i + 1].height);
      draw(upMaterial, levels[i]);
    }

    // Finish, onto the canvas.
    const u = finishMaterial.uniforms;
    u.tScene.value = colourTex; u.tDepth.value = depth; u.tAO.value = targets.aoBlur.texture;
    u.tShafts.value = targets.shaftB.texture; u.tBloom.value = levels[0].texture; u.tGhost.value = levels[2].texture;
    u.tAdapt.value = targets.adapt[adaptationIndex].texture;
    u.uInvProj.value.copy(camera.projectionMatrixInverse); u.uCamWorld.value.copy(camera.matrixWorld);
    u.uSunDir.value.copy(sunDir); u.uSunColor.value.copy(sun.color); u.uFogColor.value.copy(scene.fog.color);
    u.uTexel.value.set(1 / width, 1 / height); u.uSun.value.set(sx, sy);
    u.uAspect.value = width / height;
    u.uExposure.value = renderer.toneMappingExposure * EXPOSURE;
    u.uTime.value = (performance.now() - started) / 1000;
    u.uSunSeen.value = seen * (1 - night);
    u.uHaze.value = 0.12 / Math.max(40, scene.fog.far);
    u.uShafts.value = 0.25 * shafts;
    u.uNight.value = night;
    u.uUnder.value = under;
    draw(finishMaterial, null);
    renderer.autoClear = autoClear;
  }

  const EXPOSURE = 1.2;
  const pipeline = {
    render,
    setWeather(weather) { Object.assign(reflectionWeather, weather); },
    // pool.js registers the sea and its nearby-land reflection bounds.
    addMirror(mirror) {
      const depthMaterial = new THREE.ShaderMaterial({
        vertexShader: mirror.mesh.material.vertexShader,
        fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
        uniforms: mirror.uniforms, defines: { ...mirror.mesh.material.defines },
        colorWrite: false, depthWrite: true, side: THREE.DoubleSide,
      });
      mirror.depthMesh = new THREE.Mesh(mirror.mesh.geometry, depthMaterial);
      mirror.depthMesh.matrixAutoUpdate = false;
      mirror.depthMesh.frustumCulled = false;
      waterScene.add(mirror.depthMesh);
      mirrors.push(mirror);
      if (targets) mirror.uniforms.uReflection.value = targets.reflection.texture;
    },
    get targets() { return targets; },
    materials: { aoMaterial, finishMaterial, downMaterial, shaftMaterial, adaptMaterial },
  };
  // A stronger sun against a softer sky fill: deeper shadows for the occlusion and shafts to work in.
  stage.setPipeline(pipeline, { sun: 1.18, hemi: 0.78 });
  return pipeline;
}
