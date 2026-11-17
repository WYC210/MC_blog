import * as THREE from 'three';
import { collectHdUsage, selectHdTiles, writeHdTile } from './hd-texture-data.js';

const ROOT = new URL('../assets/ruidskin/r250-v1/', import.meta.url);
const HEAD = /* glsl */`
  uniform sampler2D uHdProfiles;
  uniform highp sampler2DArray uHdColors;
  uniform highp sampler2DArray uHdDetails;
`;
const COLOR = /* glsl */`
  vec4 tileTexel = texture(uTiles, vTex);
  vec4 hdColorProfile = texture2D(uHdProfiles, vec2((vTex.z + 0.5) / uDetailProfileWidth, 0.5));
  float hdFootprint = max(length(dFdx(vTex.xy)), length(dFdy(vTex.xy)));
  float hdNear = (1.0 - smoothstep(24.0, 64.0, length(vViewPosition)))
    * (1.0 - smoothstep(0.025, 0.09, hdFootprint));
  if (hdColorProfile.b > 0.5 && hdNear > 0.001) {
    vec4 hdTexel = texture(uHdColors, vec3(vTex.xy, floor(hdColorProfile.r * 255.0 + 0.5)));
    tileTexel = mix(tileTexel, hdTexel, hdNear);
  }
`;
const NORMAL = /* glsl */`
  if (detailHdProfile.b > 0.5 && detailNear * detailStrength > 0.001) {
    vec3 hdPositionX = dFdx(-vViewPosition), hdPositionY = dFdy(-vViewPosition);
    vec2 hdUvX = dFdx(vTex.xy), hdUvY = dFdy(vTex.xy);
    vec3 hdAcross = cross(hdPositionY, normal), hdAlong = cross(normal, hdPositionX);
    vec3 hdTangent = hdAcross * hdUvX.x + hdAlong * hdUvY.x;
    vec3 hdBitangent = hdAcross * hdUvX.y + hdAlong * hdUvY.y;
    float hdScale = inversesqrt(max(max(dot(hdTangent, hdTangent), dot(hdBitangent, hdBitangent)), 0.00000001));
    vec2 hdOffset = (detailHdSample.rg * 2.0 - 1.0) * 0.55 * detailNear * detailStrength * (1.0 - detailWet * 0.45);
    float hdNormalZ = sqrt(max(0.001, 1.0 - dot(hdOffset, hdOffset)));
    normal = normalize(hdTangent * hdScale * hdOffset.x + hdBitangent * hdScale * hdOffset.y + normal * hdNormalZ);
  }
`;

async function fetchResource(filename, signal) {
  const response = await fetch(new URL(filename, ROOT), { signal });
  if (!response.ok) throw new Error(`HD material request failed (${response.status}): ${filename}`);
  return response;
}

async function loadPixels(filename, size, signal) {
  const response = await fetchResource(filename, signal);
  const bitmap = await createImageBitmap(await response.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
  try {
    if (bitmap.width !== size || bitmap.height !== size) throw new Error(`Invalid HD image size: ${filename}`);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('HD material decoding is unavailable');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, size, size).data;
  } finally { bitmap.close(); }
}

async function loadImages(filenames, size, signal) {
  const loaded = new Map();
  let cursor = 0;
  async function worker() {
    while (cursor < filenames.length) {
      const filename = filenames[cursor++];
      loaded.set(filename, await loadPixels(filename, size, signal));
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, filenames.length) }, worker));
  return loaded;
}

export async function installHdMaterials(world, renderer, scene) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let colors, details, profiles;
  try {
    const manifest = await (await fetchResource('manifest.json', controller.signal)).json();
    const texture = world.materials.uniforms.uTiles.value;
    const image = texture.image, size = manifest.size;
    const usage = collectHdUsage(scene);
    const tiles = selectHdTiles(manifest, world.tiles.layer, image.depth, usage);
    const detailNames = [...new Set(tiles.map(tile => tile.detail))];
    const context = renderer.getContext();
    const maxLayers = context.getParameter(context.MAX_ARRAY_TEXTURE_LAYERS);
    if (size > renderer.capabilities.maxTextureSize || tiles.length > maxLayers || detailNames.length > maxLayers) {
      throw new Error('HD materials exceed this GPU\'s texture limits');
    }
    const filenames = [...new Set(tiles.flatMap(tile => [tile.color, tile.detail]))];
    const loaded = await loadImages(filenames, size, controller.signal);
    const colorPixels = new Uint8Array(size * size * 4 * tiles.length);
    const detailPixels = new Uint8Array(size * size * 4 * detailNames.length);
    const profilePixels = new Uint8Array(image.depth * 4);
    detailNames.forEach((filename, index) => writeHdTile(detailPixels, loaded.get(filename), size, index));
    let layers = 0;
    for (const [colorIndex, tile] of tiles.entries()) {
      writeHdTile(colorPixels, loaded.get(tile.color), size, colorIndex);
      for (const name of tile.targets) {
        const index = world.tiles.layer[name];
        profilePixels.set([colorIndex, detailNames.indexOf(tile.detail), 255, 255], index * 4);
        layers++;
      }
    }
    colors = new THREE.DataArrayTexture(colorPixels, size, size, tiles.length);
    colors.name = 'ruidskin-color';
    colors.colorSpace = THREE.SRGBColorSpace;
    details = new THREE.DataArrayTexture(detailPixels, size, size, detailNames.length);
    details.name = 'ruidskin-normal-xy-roughness';
    for (const array of [colors, details]) {
      array.wrapS = array.wrapT = THREE.RepeatWrapping;
      array.magFilter = THREE.LinearFilter;
      array.minFilter = THREE.LinearMipmapLinearFilter;
      array.generateMipmaps = true;
      array.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      array.needsUpdate = true;
    }
    profiles = new THREE.DataTexture(profilePixels, image.depth, 1);
    profiles.name = 'ruidskin-layer-profiles';
    profiles.minFilter = profiles.magFilter = THREE.NearestFilter;
    profiles.generateMipmaps = false;
    profiles.needsUpdate = true;
    const extension = { head: HEAD, color: COLOR, normal: NORMAL, uniforms: {
      uHdColors: { value: colors }, uHdDetails: { value: details }, uHdProfiles: { value: profiles },
    } };
    const sources = new Set(['voxel', 'voxelCutout', 'box', 'boxCutout'].map(name => world.materials[name]));
    const install = material => {
      material.userData.hdMaterials = extension;
      material.defines = { ...material.defines, RUIDSKIN_HD: '' };
      material.needsUpdate = true;
    };
    for (const name of ['voxel', 'voxelCutout', 'box', 'boxCutout']) {
      install(world.materials[name]);
    }
    for (const root of [world.qinIsland?.root, world.groups['qin-ground']]) root?.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) if (sources.has(material?.userData.hdMaterialSource)) install(material);
    });
    renderer.shadowMap.needsUpdate = true;
    return { status: 'ready', pack: manifest.pack, size, layers, files: filenames.length,
      usedLayers: usage.size, minUsage: 4,
      estimatedTextureMiB: +((colorPixels.byteLength + detailPixels.byteLength) * 4 / 3 / 1048576).toFixed(1) };
  } catch (error) {
    colors?.dispose(); details?.dispose(); profiles?.dispose();
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}
