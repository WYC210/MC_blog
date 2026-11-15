export const ULTRA_ENVIRONMENT = /* glsl */`
  float environmentNoise(vec2 point) {
    vec2 cell = floor(point), blend = fract(point);
    blend = blend * blend * (3.0 - 2.0 * blend);
    return texture2D(uSkyNoise, (cell + blend + 0.5) / 128.0).r;
  }
  float environmentCloud(vec2 point) {
    float value = environmentNoise(point) * 0.54;
    point = mat2(1.6, 1.2, -1.2, 1.6) * point + 17.0;
    value += environmentNoise(point) * 0.27;
    point = mat2(1.6, 1.2, -1.2, 1.6) * point + 17.0;
    return value + environmentNoise(point) * 0.19;
  }
  vec3 environmentSky(vec3 direction, vec3 eye, float sunDisc) {
    float height = max(direction.y, 0.0);
    float solar = max(dot(direction, uSunDir), 0.0);
    float azimuth = max(dot(normalize(direction.xz + vec2(0.0001)), normalize(uSunDir.xz + vec2(0.0001))), 0.0);
    float evening = (1.0 - smoothstep(0.15, 0.65, uSunDir.y)) * (1.0 - uNight);
    float forwardGlow = pow(azimuth, 5.0);
    vec3 horizon = mix(uHorizon * 0.62 + uTop * 0.12, uHorizon * (1.15 + evening * 0.9), forwardGlow);
    horizon += uSunColor * pow(azimuth, 28.0) * evening * 0.6;
    vec3 zenith = uTop * mix(0.82, 0.55, evening);
    vec3 color = mix(horizon, zenith, smoothstep(0.0, 0.55, height));
    float day = 1.0 - uNight;
    color += uSunColor * (pow(solar, 12.0) * 0.12 + pow(solar, 100.0) * 0.5 + pow(solar, 1200.0) * 2.0) * day * (1.0 - uCloud);
    float coverage = 0.0;
    if (uCover > 0.005 && direction.y > 0.005) {
      vec2 point = direction.xz / (height + 0.12) * 3.0 + (eye.xz + uCloudShift) * 0.0015;
      point += (environmentNoise(point * 0.35) - 0.5) * 1.3;
      float density = environmentCloud(point);
      float threshold = mix(0.84, 0.24, uCover);
      coverage = smoothstep(threshold - 0.09, threshold + 0.09, density);
      float edge = mix(0.015, 0.16, evening * forwardGlow);
      coverage *= smoothstep(edge, edge + 0.1, height);
      float towardSun = environmentCloud(point + normalize(uSunDir.xz + vec2(0.0001)) * 0.24);
      float relief = clamp(0.5 + (density - towardSun) * 4.0, 0.0, 1.0);
      vec3 cloud = mix(uHorizon * 0.24 + uTop * 0.13, uHorizon * 0.7 + vec3(0.09) * day, relief);
      float rim = coverage * (1.0 - coverage) * 4.0;
      cloud += uSunColor * (pow(solar, 7.0) * relief * relief * 0.65 + rim * forwardGlow * evening * 1.6) * day;
      color = mix(color, cloud, coverage * 0.96);
    }
    float disc = smoothstep(0.99991, 0.99996, solar);
    color += uSunColor * disc * mix(48.0, 1.4, uNight) * sunDisc * (1.0 - coverage * 0.96) * (1.0 - uCloud);
    if (direction.y < 0.0) color = mix(horizon, uHorizon * 0.28, smoothstep(0.0, 0.4, -direction.y));
    return max(color, vec3(0.0));
  }
`;

export const ULTRA_WATER = /* glsl */`
  vec2 oceanDetail(vec2 point, float detail, out float gust, out float roughness) {
    vec2 drift = uCloudShift * 0.008;
    float broad = environmentNoise(point * 0.035 + drift);
    gust = smoothstep(0.3, 0.73, broad * 0.65 + environmentNoise(point * 0.11 - drift) * 0.35);
    float nearDetail = detail * (1.0 - smoothstep(30.0, 150.0, distance(cameraPosition, vWorld)));
    vec2 first = texture2D(uSkyNoise, point * 0.019 + vec2(uTime * 0.006, -uTime * 0.004)).rg - 0.5;
    vec2 second = texture2D(uSkyNoise, point.yx * 0.047 + vec2(-uTime * 0.01, uTime * 0.007)).rg - 0.5;
    vec2 slope = (first * 0.15 + second * 0.09 * nearDetail) * mix(0.45, 1.5, gust);
    roughness = mix(0.13, 0.28, gust) + (1.0 - nearDetail) * 0.07;
    return slope * (0.45 + uWind * 0.8);
  }
  vec3 oceanSunlight(vec3 normal, vec3 view, float roughness, float gust) {
    vec3 halfway = normalize(view + uSunDir);
    float normalView = max(dot(normal, view), 0.001);
    float normalLight = max(dot(normal, uSunDir), 0.0);
    float normalHalf = max(dot(normal, halfway), 0.0);
    float viewHalf = max(dot(view, halfway), 0.0);
    float width = max(roughness * roughness, 0.012);
    float widthSquared = width * width;
    float denominator = normalHalf * normalHalf * (widthSquared - 1.0) + 1.0;
    float distribution = widthSquared / max(3.14159265 * denominator * denominator, 0.000001);
    float maskingWidth = (roughness + 1.0) * (roughness + 1.0) * 0.125;
    float masking = normalView / (normalView * (1.0 - maskingWidth) + maskingWidth);
    masking *= normalLight / max(normalLight * (1.0 - maskingWidth) + maskingWidth, 0.001);
    float fresnel = 0.0204 + 0.9796 * pow(1.0 - viewHalf, 5.0);
    float specular = distribution * masking * fresnel / max(4.0 * normalView, 0.004);
    return uSunColor * uSun * min(specular, 24.0) * mix(1.0, 0.65, gust) * 5.0;
  }
`;
