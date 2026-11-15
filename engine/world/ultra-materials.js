import * as THREE from 'three';

export function createMaterialDetails(layer) {
  const count = Math.max(...Object.values(layer)) + 1;
  const data = new Uint8Array(count * 4);
  for (const [name, index] of Object.entries(layer)) {
    let family = 0, roughness = 0.8;
    if (/^(oak|wood_floor|wood_panel|parquet|walnut|maple|deck|log|log_top|bookshelf)$/.test(name)) family = 1;
    else if (/^(stone|deepslate|concrete|white_brick|plaster|travertine|pavers|gravel|prada|prada_marble)$/.test(name)) family = 2;
    else if (/^(velvet|linen|chair_mesh)$/.test(name)) family = 3;
    else if (/^(stainless|black_metal|steel|chrome)$/.test(name)) { family = 4; roughness = 0.32; }
    else if (/^(terracotta|pool_tile|pool_deep)$/.test(name)) { family = 5; roughness = 0.6; }
    else if (name === 'sand') family = 6;
    else if (/^(grass_top|grass_side|dirt)$/.test(name)) family = 7;
    else if (name === 'leather' || name === 'rubber') { family = 8; roughness = 0.65; }
    else if (name === 'roof') family = 9;
    data.set([family, Math.round(roughness * 255), 0, 255], index * 4);
  }
  const texture = new THREE.DataTexture(data, count, 1);
  texture.name = 'ultra-material-details';
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return { texture, count };
}

export const MATERIAL_DETAIL = /* glsl */`
  vec3 groundBump(vec3 surfaceNormal, float height) {
    vec3 horizontal = dFdx(vSurfacePosition), vertical = dFdy(vSurfacePosition);
    vec3 across = cross(vertical, surfaceNormal), along = cross(surfaceNormal, horizontal);
    float determinant = dot(horizontal, across);
    vec3 gradient = sign(determinant) * (dFdx(height) * across + dFdy(height) * along);
    return normalize(abs(determinant) * surfaceNormal - gradient + surfaceNormal * 0.00000001);
  }
  void groundMaterial(vec3 surfaceNormal, float detail, inout vec3 color) {
    vec4 properties = texture2D(uGroundMaterials, vec2((vTex.z + 0.5) / uGroundMaterialCount, 0.5));
    float family = floor(properties.r * 255.0 + 0.5);
    groundRoughness = properties.g;
    groundMetal = 0.0;
    vec2 point = vTex.xy;
    float grain = groundNoise(point * 58.0);
    float height = (grain - 0.5) * 0.0007;
    float tone = 1.0;
    if (family == 1.0) {
      float flow = groundNoise(point * vec2(1.5, 0.28)) * 3.5;
      float rings = sin(point.x * 65.0 + flow * 6.0 + sin(point.y * 1.8) * 0.8);
      float fibers = groundNoise(point * vec2(110.0, 5.0));
      float pores = smoothstep(0.68, 0.9, fibers) * 0.14;
      tone = 0.94 + rings * 0.055 + fibers * 0.12 - pores;
      height = (rings * 0.0009 + fibers * 0.0015) * detail;
      groundRoughness = 0.64 + fibers * 0.22;
    } else if (family == 2.0 || family == 5.0 || family == 9.0) {
      float pores = smoothstep(0.64, 0.85, grain);
      float aggregate = groundNoise(point * 17.0);
      tone = 0.91 + aggregate * 0.16 - pores * 0.13;
      height = (aggregate * 0.002 + grain * 0.0012) * detail;
      if (family == 5.0) { tone = 0.96 + grain * 0.07; height *= 0.35; }
      if (family == 9.0) {
        float flute = sin(point.x * 25.1327);
        tone *= 0.96 + flute * 0.07;
        height += flute * 0.004 * detail;
      }
    } else if (family == 3.0) {
      vec2 frequency = point * 520.0;
      vec2 filterWidth = fwidth(frequency);
      vec2 weave = sin(frequency) * (1.0 - smoothstep(vec2(0.6), vec2(3.0), filterWidth));
      float thread = weave.x * weave.y;
      tone = 0.96 + thread * 0.12 + grain * 0.07;
      height = thread * 0.00065 * detail;
    } else if (family == 4.0) {
      float brushed = groundNoise(point * vec2(180.0, 3.0));
      tone = 0.88 + brushed * 0.22;
      height = brushed * 0.0004 * detail;
      groundRoughness = 0.25 + brushed * 0.23;
      groundMetal = 1.0;
    } else if (family == 6.0) {
      float flecks = groundNoise(point * 125.0);
      tone = 0.83 + grain * 0.28 + flecks * 0.1;
      height = (grain * 0.0035 + flecks * 0.0012) * detail;
    } else if (family == 7.0 || family == 8.0) {
      tone = 0.92 + grain * 0.16;
      height = grain * (family == 7.0 ? 0.002 : 0.001) * detail;
    }
    color *= mix(1.0, tone, detail);
    groundMicroNormal = groundBump(surfaceNormal, height);
  }
`;
