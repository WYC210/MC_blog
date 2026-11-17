export const SURFACE_DETAIL = /* glsl */`
  vec3 detailWorldNormal = inverseTransformDirection(normalize(vNormal), viewMatrix);
  vec3 detailAxis = abs(detailWorldNormal);
  vec2 detailUV = vTex.xy;
  vec2 detailWorldUV = detailAxis.y > 0.5 ? vSurfacePosition.xz :
    detailAxis.x > 0.5 ? vSurfacePosition.zy : vSurfacePosition.xy;
  vec4 detailProfile = texture2D(uDetailProfiles, vec2((vTex.z + 0.5) / uDetailProfileWidth, 0.5));
  float detailKind = floor(detailProfile.r * 255.0 + 0.5);
  float detailHeight = 0.0;
  float detailRoughness = detailProfile.g;
  float detailMetalness = detailProfile.b;
  float detailProcedural = 1.0;
  float detailFootprint = max(length(dFdx(detailUV)), length(dFdy(detailUV)));
  float detailNear = (1.0 - smoothstep(16.0, 64.0, length(vViewPosition)))
    * (1.0 - smoothstep(0.025, 0.09, detailFootprint));
  #ifdef RUIDSKIN_HD
    vec4 detailHdProfile = texture2D(uHdProfiles, vec2((vTex.z + 0.5) / uDetailProfileWidth, 0.5));
    vec4 detailHdSample = vec4(0.5, 0.5, detailRoughness, 1.0);
    if (detailHdProfile.b > 0.5 && detailNear > 0.001) {
      detailHdSample = texture(uHdDetails, vec3(vTex.xy, floor(detailHdProfile.g * 255.0 + 0.5)));
      detailRoughness = clamp(detailHdSample.b, 0.45, 1.0);
      detailProcedural = 0.0;
    }
  #endif
  float detailStrength = 1.0 - clamp((vEmissive - 0.65) / 0.35, 0.0, 1.0);
  float detailWet = 0.0;
  if (detailKind > 0.5 && detailStrength > 0.001) {
    vec3 detailSkyProbe = vSurfacePosition + detailWorldNormal * 0.35;
    float detailShelter = texture2D(uShelter, (detailSkyProbe.xz - uShelterBox.xy) * uShelterBox.zw).r * 63.75 - 2.0;
    float detailOpen = step(detailShelter - 0.6, detailSkyProbe.y);
    detailWet = uDetailWet * detailOpen * smoothstep(-0.1, 0.8, detailWorldNormal.y) * (1.0 - uSnow);
    if (detailNear * detailProcedural > 0.001) {
      float detailTone = 1.0;
      float detailGrain = detailNoise(detailUV * 89.0);
      float detailGrainBand = detailBand(detailUV, 89.0);
      float detailMacro = detailNoise(detailWorldUV * 0.65);
      if (detailKind == 1.0) {
        vec2 sandUV = detailAxis.y > 0.5 ? vSurfacePosition.xz : detailUV;
        float ripple = sin(dot(sandUV, vec2(0.92, 0.39)) * 26.0 + detailNoise(sandUV * 0.8) * 3.5);
        float grains = detailNoise(sandUV * 235.0), grainsBand = detailBand(sandUV, 235.0);
        float grit = detailNoise(sandUV * 57.0), gritBand = detailBand(sandUV, 57.0);
        vec4 terrain = texture2D(uDetailTerrain, (vSurfacePosition.xz - uDetailBounds.xy) * uDetailBounds.zw);
        float shore = terrain.a * (1.0 - smoothstep(0.05, 0.4, abs(vSurfacePosition.y)));
        detailWet = max(detailWet, shore * 0.8);
        detailTone = 0.96 + (detailMacro - 0.5) * 0.1 + ripple * 0.018 * detailBand(sandUV, 4.2);
        detailTone += (grit - 0.5) * 0.075 * gritBand + (grains - 0.5) * 0.18 * grainsBand;
        detailHeight = ripple * 0.003 * detailBand(sandUV, 4.2) + grit * 0.0014 * gritBand + grains * 0.0007 * grainsBand;
      } else if (detailKind == 2.0 || detailKind == 16.0) {
        vec2 woodUV = detailKind == 16.0 ? detailUV.yx : detailUV;
        float bend = detailNoise(woodUV * vec2(0.7, 4.0));
        float knot = length((fract(woodUV * vec2(0.33, 2.0) + vec2(0.23, 0.37)) - 0.5) * vec2(1.0, 3.0));
        float knotMask = (1.0 - smoothstep(0.04, 0.23, knot)) * smoothstep(0.42, 0.68, detailMacro);
        float rings = sin(woodUV.y * 98.0 + bend * 7.0 + knotMask * 8.0);
        float fibers = detailNoise(woodUV * vec2(6.0, 220.0));
        float fiberBand = detailBand(woodUV, 220.0);
        float seam = detailKind == 2.0 ? detailSeam(woodUV.y, 4.0, 0.008) : 0.0;
        detailTone = 1.0 + rings * 0.075 * detailBand(woodUV, 16.0) + (fibers - 0.5) * 0.16 * fiberBand;
        detailTone -= seam * 0.2 + knotMask * 0.13;
        detailHeight = rings * 0.0012 * detailBand(woodUV, 16.0) + (fibers - 0.5) * 0.0018 * fiberBand - seam * 0.0028 - knotMask * 0.0008;
        detailRoughness += (fibers - 0.5) * 0.2 * fiberBand + seam * 0.16 + knotMask * 0.08;
      } else if (detailKind == 10.0) {
        vec2 endUV = fract(detailUV) - vec2(0.38, 0.46);
        float radius = length(endUV * vec2(1.0, 1.12));
        float rings = sin(radius * 145.0 + detailNoise(detailUV * 8.0) * 1.8);
        float split = (1.0 - smoothstep(0.003, 0.012, abs(endUV.x + endUV.y * 0.3))) * smoothstep(0.12, 0.48, radius);
        detailTone = 1.0 + rings * 0.075 * detailBand(detailUV, 24.0) - split * 0.2;
        detailHeight = rings * 0.0009 * detailBand(detailUV, 24.0) - split * 0.002;
      } else if (detailKind == 3.0 || detailKind == 17.0 || detailKind == 18.0) {
        float aggregate = detailNoise(detailUV * 19.0), aggregateBand = detailBand(detailUV, 19.0);
        float pores = smoothstep(0.67, 0.88, detailGrain) * detailGrainBand;
        float crackField = detailNoise(detailUV * 2.8 + vec2(8.0));
        float crack = (1.0 - smoothstep(0.003, 0.012, abs(crackField - 0.5))) * smoothstep(0.65, 0.8, detailMacro);
        float clay = detailKind == 18.0 ? 0.45 : 1.0;
        detailTone = 1.0 + (detailMacro - 0.5) * 0.1 + (aggregate - 0.5) * 0.2 * aggregateBand;
        detailTone -= pores * 0.16 + crack * 0.18 * clay;
        detailHeight = (aggregate * 0.003 * aggregateBand - pores * 0.0032 - crack * 0.003) * clay;
        detailRoughness += pores * 0.12 + (aggregate - 0.5) * 0.16 + crack * 0.06;
      } else if (detailKind == 4.0) {
        float brush = detailNoise(detailUV * vec2(3.0, 310.0)), brushBand = detailBand(detailUV, 310.0);
        float smudge = detailNoise(detailWorldUV * 4.0);
        float scratch = (1.0 - smoothstep(0.003, 0.01, abs(detailNoise(detailUV * vec2(0.5, 45.0)) - 0.52))) * brushBand;
        detailTone = 1.0 + (brush - 0.5) * 0.14 * brushBand + (smudge - 0.5) * 0.06 - scratch * 0.12;
        detailHeight = (brush - 0.5) * 0.0012 * brushBand - scratch * 0.0007;
        detailRoughness += (brush - 0.5) * 0.18 * brushBand + smudge * 0.12 + scratch * 0.16;
      } else if (detailKind == 5.0) {
        vec2 weave = sin(detailUV * 2261.9467);
        float weaveBand = detailBand(detailUV, 360.0);
        float thread = weave.x * weave.y;
        float fibers = detailNoise(detailUV * 620.0), fiberBand = detailBand(detailUV, 620.0);
        detailTone = 1.0 + thread * 0.12 * weaveBand + (detailMacro - 0.5) * 0.035;
        detailHeight = thread * 0.00045 * weaveBand + fibers * 0.00012 * fiberBand;
      } else if (detailKind == 6.0 || detailKind == 12.0) {
        vec2 tileUV = detailUV;
        if (detailKind == 6.0) tileUV.x += mod(floor(tileUV.y * 4.0), 2.0) * 0.25;
        float grout = max(detailSeam(tileUV.x, detailKind == 12.0 ? 4.0 : 2.0, 0.012), detailSeam(tileUV.y, 4.0, 0.012));
        detailTone = 1.0 + (detailMacro - 0.5) * 0.055 - grout * 0.14;
        detailHeight = -grout * (detailKind == 12.0 ? 0.0015 : 0.004) + detailGrain * 0.0003 * detailGrainBand;
        detailRoughness = mix(detailRoughness, 0.94, grout);
      } else if (detailKind == 11.0 || detailKind == 13.0) {
        float mineral = detailNoise(detailWorldUV * 7.0);
        detailTone = 1.0 + (mineral - 0.5) * (detailKind == 13.0 ? 0.02 : 0.05);
        detailHeight = detailGrain * (detailKind == 13.0 ? 0.00004 : 0.0002) * detailGrainBand;
        detailRoughness += (mineral - 0.5) * 0.04;
      } else if (detailKind == 15.0) {
        float twist = sin((detailUV.x * 24.0 - detailUV.y * 38.0) * 6.2831853);
        float strands = sin((detailUV.x * 175.0 + detailUV.y * 110.0) * 6.2831853);
        float twistBand = detailBand(detailUV, 45.0), strandsBand = detailBand(detailUV, 205.0);
        detailTone = 1.0 + twist * 0.1 * twistBand + strands * 0.045 * strandsBand;
        detailHeight = twist * 0.0012 * twistBand + strands * 0.00025 * strandsBand;
      } else {
        detailTone = 1.0 + (detailGrain - 0.5) * 0.08 * detailGrainBand;
        detailHeight = detailGrain * (detailKind == 14.0 ? 0.00035 : 0.0007) * detailGrainBand;
      }
      diffuseColor.rgb *= mix(1.0, detailTone, detailNear * detailStrength);
    }
    float detailAbsorb = detailKind == 5.0 || detailKind == 15.0 ? 0.12 : 0.07;
    diffuseColor.rgb *= 1.0 - detailWet * detailAbsorb * detailStrength;
    float detailWetRough = detailKind == 5.0 || detailKind == 15.0 ? 0.85 : max(0.08, detailRoughness * 0.42);
    detailRoughness = mix(detailRoughness, detailWetRough, detailWet * detailStrength);
  }
  detailMetalness *= detailStrength;
  detailHeight *= detailNear * detailStrength * (1.0 - detailWet * 0.45);
  #include <color_fragment>
`;
