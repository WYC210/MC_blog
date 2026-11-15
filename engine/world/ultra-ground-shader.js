import { MATERIAL_DETAIL } from './ultra-materials.js';

export const GROUND_HEAD = /* glsl */`
  uniform sampler2D uGroundNoise, uGroundTracks;
  uniform vec4 uGroundTrackBox, uGroundStep;
  uniform vec3 uGroundSunDir, uGroundSunColor, uGroundSky;
  uniform float uGroundTime, uGroundRain, uGroundWind, uGroundSand, uGroundSun;
  uniform sampler2D uGroundMaterials;
  uniform float uGroundMaterialCount;
  float groundPuddle, groundSnow, groundDamp;
  float groundRoughness, groundMetal;
  vec3 groundMicroNormal;
  vec2 groundSlope;
  float groundNoise(vec2 point) {
    vec2 cell = floor(point), blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return texture2D(uGroundNoise, (cell + blend + 0.5) / 128.0).r;
  }
  float groundHash(vec2 point) {
    vec3 value = fract(vec3(point.xyx) * 0.1031);
    value += dot(value, value.yzx + 33.33);
    return fract((value.x + value.y) * value.z);
  }
  vec4 groundTrack(vec2 point) {
    vec2 coord = (point - uGroundTrackBox.xy) * uGroundTrackBox.zw;
    vec2 inside = step(vec2(0.0), coord) * step(coord, vec2(1.0));
    vec4 mark = texture2D(uGroundTracks, coord);
    mark.a *= inside.x * inside.y * (1.0 - smoothstep(0.18, 0.45, abs(mark.b * 64.0 - 2.0 - vSurfacePosition.y)));
    return mark;
  }
  vec2 groundRipple(vec2 point) {
    vec2 cell = floor(point / 1.4), center = cell * 1.4;
    float seed = groundHash(cell);
    center += vec2(0.25 + seed * 0.8, 0.25 + groundHash(cell + 17.0) * 0.8);
    vec2 offset = point - center;
    float radius = length(offset), age = fract(uGroundTime * 0.85 + seed * 13.0);
    float ring = radius - age * 0.65;
    float wave = sin(ring * 65.0) * exp(-abs(ring) * 38.0) * (1.0 - age);
    vec2 slope = offset / max(radius, 0.001) * wave * uGroundRain * 0.055;
    offset = point - uGroundStep.xy;
    radius = length(offset);
    age = uGroundTime - uGroundStep.z;
    ring = radius - age * 1.3;
    wave = sin(ring * 32.0) * exp(-abs(ring) * 15.0) * max(0.0, 1.0 - age / 1.5) * step(0.0, age);
    slope += offset / max(radius, 0.001) * wave * 0.08 * (1.0 - smoothstep(0.1, 0.4, abs(uGroundStep.w - vSurfacePosition.y)));
    return slope;
  }
` + MATERIAL_DETAIL;

export const GROUND_SURFACE = /* glsl */`
  groundPuddle = 0.0; groundSnow = 0.0; groundDamp = 0.0; groundSlope = vec2(0.0);
  float weatherSheen = 0.0;
  groundRoughness = 0.9; groundMetal = 0.0;
  groundMicroNormal = inverseTransformDirection(normal, viewMatrix);
  if (vEmissive <= 0.0) {
    vec3 skyNormal = inverseTransformDirection(normal, viewMatrix);
    float up = smoothstep(0.7, 0.96, skyNormal.y);
    vec3 probe = vSurfacePosition + skyNormal * 0.08;
    float top = texture2D(uShelter, (probe.xz - uShelterBox.xy) * uShelterBox.zw).r * 63.75 - 2.0;
    float open = step(top - 0.22, probe.y);
    float aboveWater = smoothstep(-0.35, -0.15, vSurfacePosition.y);
    float exposed = open * up * aboveWater;
    float sand = 1.0 - step(0.1, abs(vTex.z - uGroundSand));
    vec2 point = vSurfacePosition.xz;
    float nearDetail = 1.0 - smoothstep(18.0, 65.0, length(cameraPosition - vSurfacePosition));
    groundMaterial(skyNormal, nearDetail, diffuseColor.rgb);
    float broad = groundNoise(point * 0.24) * 0.65 + groundNoise(point * 0.73 + 27.0) * 0.35;
    vec4 mark = groundTrack(point);
    float snowTrack = mark.r * mark.a, sandTrack = mark.g * mark.a;
    if (sand * up > 0.01) {
      float drift = groundNoise(point * 0.4) * 1.4;
      float phase = dot(point, vec2(2.3, 4.8)) + drift;
      float ripple = sin(phase * 6.2831853);
      float grain = groundNoise(point * 34.0);
      diffuseColor.rgb *= 0.92 + broad * 0.14 + ripple * 0.045 * nearDetail + (grain - 0.5) * 0.13 * nearDetail;
      diffuseColor.rgb *= 1.0 - sandTrack * 0.25 * (1.0 - uSnow * open);
      groundSlope = vec2(0.045, 0.085) * cos(phase * 6.2831853) * nearDetail * sand;
      float blown = groundNoise(point * 1.7 - vec2(0.82, 0.57) * uGroundTime * 0.7);
      diffuseColor.rgb += vec3(0.045, 0.038, 0.022) * smoothstep(0.58, 0.78, blown) * uGroundWind * exposed * (1.0 - uWet) * (1.0 - uSnow) * nearDetail;
    }
    float snowEdge = broad * 0.48 + groundNoise(point * 5.0) * 0.12;
    float snowCover = smoothstep(snowEdge, snowEdge + 0.18, uSnow) * exposed;
    groundSnow = snowCover * (1.0 - snowTrack * 0.88);
    vec3 snowColor = mix(vec3(0.86, 0.91, 0.96), vec3(0.97, 0.98, 1.0), broad);
    diffuseColor.rgb = mix(diffuseColor.rgb, snowColor, groundSnow);
    diffuseColor.rgb *= 1.0 - snowTrack * snowCover * 0.18;
    if (mark.a > 0.01 && snowCover > 0.01) {
      vec4 east = groundTrack(point + vec2(0.065, 0.0));
      vec4 south = groundTrack(point + vec2(0.0, 0.065));
      groundSlope += vec2(east.r * east.a - snowTrack, south.r * south.a - snowTrack) * 0.32 * snowCover;
    }
    float wetness = uWet * open * aboveWater * (1.0 - snowCover);
    groundDamp = wetness * up;
    float low = 1.0 - smoothstep(0.27 + uWet * 0.3, 0.34 + uWet * 0.3, broad);
    groundPuddle = low * smoothstep(0.3, 0.9, uWet) * exposed * (1.0 - snowCover) * mix(1.0, 0.24, sand);
    diffuseColor.rgb *= 1.0 - wetness * mix(0.18, mix(0.34, 0.46, sand), up);
    diffuseColor.rgb *= 1.0 - groundPuddle * 0.12;
    groundSlope *= 1.0 - groundPuddle;
    if (groundPuddle > 0.01 && nearDetail > 0.0) groundSlope += groundRipple(point) * nearDetail;
    weatherSheen = groundDamp;
  }
  #include <emissivemap_fragment>
  totalEmissiveRadiance += diffuseColor.rgb * vEmissive * uEmissiveBoost;
`;

export const GROUND_LIGHT = /* glsl */`
  if (vEmissive <= 0.0) {
    vec3 worldNormal = inverseTransformDirection(normal, viewMatrix);
    vec3 detailNormal = normalize(mix(groundMicroNormal, worldNormal, max(groundPuddle, groundSnow)) + vec3(groundSlope.x, 0.0, groundSlope.y));
    vec3 view = normalize(cameraPosition - vSurfacePosition);
    float facing = max(dot(detailNormal, view), 0.0);
    float fresnel = 0.025 + 0.975 * pow(1.0 - facing, 5.0);
    vec3 reflected = reflect(-view, detailNormal);
    vec3 sky = mix(uSkyTint * 0.75, uGroundSky, smoothstep(0.0, 0.7, reflected.y));
    float cloud = groundNoise(reflected.xz / (max(reflected.y, 0.0) + 0.18) * 4.0 + uGroundTime * vec2(0.006, 0.002));
    sky = mix(sky, uSkyTint * 0.9, smoothstep(0.48, 0.72, cloud) * 0.55);
    float reflection = groundPuddle * (0.16 + fresnel * 0.75) + groundDamp * (0.02 + fresnel * 0.12);
    outgoingLight = mix(outgoingLight, sky, clamp(reflection, 0.0, 0.92));
    vec3 halfway = normalize(view + uGroundSunDir);
    float gloss = mix(28.0, 700.0, groundPuddle);
    float highlight = pow(max(dot(detailNormal, halfway), 0.0), gloss);
    float sparkle = pow(groundNoise(vSurfacePosition.xz * 65.0), 16.0) * groundSnow;
    outgoingLight += uGroundSunColor * uGroundSun * (highlight * (groundDamp * 0.12 + groundPuddle * 1.8) + sparkle * 0.2);
    float materialGloss = mix(12.0, 220.0, 1.0 - groundRoughness);
    float materialHighlight = pow(max(dot(detailNormal, halfway), 0.0), materialGloss);
    outgoingLight += uGroundSunColor * uGroundSun * materialHighlight * (0.025 + groundMetal * 0.28) * (1.0 - groundSnow);
    outgoingLight = mix(outgoingLight, outgoingLight * 0.76 + sky * diffuseColor.rgb * 0.32, groundMetal * (0.2 + fresnel * 0.6));
    float relief = dot(detailNormal, uGroundSunDir) - dot(worldNormal, uGroundSunDir);
    outgoingLight *= 1.0 + relief * 0.45;
  }
  #include <opaque_fragment>
`;
