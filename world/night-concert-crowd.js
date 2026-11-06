import * as THREE from 'three';
import { createAvatar } from '@engine/world/avatar.js';
import { BoxBatch } from '@engine/world/blocks.js';
import { CONCERT_GUESTS } from './night-concert-layout.js';

export function buildConcertCrowd({ layer, materials }) {
  const atlas = document.createElement('canvas');
  atlas.width = 64 * CONCERT_GUESTS.length;
  atlas.height = 64;
  const context = atlas.getContext('2d');
  const parts = [];
  const accessories = [];
  const batch = new BoxBatch(layer);
  const guests = CONCERT_GUESTS.map((settings, index) => {
    const avatar = createAvatar();
    const canvas = avatar.material.map.image;
    const skinContext = canvas.getContext('2d');
    const image = skinContext.getImageData(0, 0, 64, 64);
    const shades = new Map([[0x4f7a4a, 1], [0x5e8b58, 1.13], [0x3f6339, 0.8]]);
    for (let pixel = 0; pixel < image.data.length; pixel += 4) {
      const shade = shades.get((image.data[pixel] << 16) | (image.data[pixel + 1] << 8) | image.data[pixel + 2]);
      if (!shade) continue;
      image.data[pixel] = Math.min(255, (settings.shirt >> 16) * shade);
      image.data[pixel + 1] = Math.min(255, (settings.shirt >> 8 & 255) * shade);
      image.data[pixel + 2] = Math.min(255, (settings.shirt & 255) * shade);
    }
    context.putImageData(image, index * 64, 0);
    avatar.root.traverse(source => {
      if (source.isMesh && source.material === avatar.material) parts.push({ source, guest: index });
    });
    avatar.material.map.dispose();
    avatar.material.dispose();
    avatar.blob.geometry.dispose();
    avatar.blob.material.dispose();
    avatar.root.position.set(settings.entryX, 0, settings.entryZ);
    avatar.root.scale.setScalar(0);
    const guest = { ...settings, avatar, present: false, arrived: false, delay: index * 2, fade: 0, path: [], waypoint: 0, walking: false, instrument: null, bow: null };
    if (settings.role !== 'audience') makeInstrument(guest);
    return guest;
  });

  function prop(parent, positionX, bottom, positionZ, width, height, depth, tint, tex = 'paint') {
    const local = batch.box(positionX, bottom, positionZ, width, height, depth, { tex, tint }, { shadow: false });
    accessories.push({ parent, local });
  }

  function makeInstrument(guest) {
    const instrument = new THREE.Group();
    guest.avatar.body.add(instrument);
    guest.instrument = instrument;
    if (guest.role === 'wind') {
      prop(instrument, 0, -0.68, 0, 0.09, 0.62, 0.1, 0x27343a);
      prop(instrument, 0, -0.07, 0, 0.045, 0.09, 0.055, 0x151c22);
      prop(instrument, 0, -0.72, 0, 0.115, 0.07, 0.12, 0x697a82);
      prop(instrument, 0, -0.28, 0.056, 0.047, 0.07, 0.013, 0x83c6c6);
      for (let key = 0; key < 6; key++) prop(instrument, 0, -0.14 - key * 0.08, 0.057, 0.03, 0.024, 0.013, 0xd2d9d5);
    } else {
      prop(instrument, 0.01, -0.05, 0, 0.19, 0.09, 0.24, 0xac622e, 'walnut');
      prop(instrument, 0.01, -0.045, 0.19, 0.24, 0.08, 0.21, 0xc3823e, 'walnut');
      prop(instrument, 0.01, -0.035, 0.085, 0.13, 0.06, 0.12, 0xb87639, 'walnut');
      prop(instrument, 0.01, -0.025, 0.42, 0.043, 0.045, 0.31, 0x30231e);
      prop(instrument, 0.01, -0.04, 0.6, 0.075, 0.065, 0.1, 0x8d4c29, 'walnut');
      prop(instrument, 0.01, 0.01, 0.19, 0.09, 0.05, 0.025, 0xe1c293);
      prop(instrument, -0.05, -0.005, -0.07, 0.1, 0.06, 0.1, 0x30231e);
      for (let string = 0; string < 4; string++) prop(instrument, -0.015 + string * 0.016, 0.055, 0.25, 0.004, 0.005, 0.49, 0xe0d9c4);
      for (const side of [-1, 1]) prop(instrument, side * 0.07, 0.043, 0.13, 0.012, 0.008, 0.08, 0x39251c);
      const bow = new THREE.Group();
      instrument.add(bow);
      guest.bow = bow;
      prop(bow, 0, 0.08, 0.15, 0.74, 0.016, 0.018, 0x704a30, 'walnut');
      prop(bow, 0, 0.065, 0.15, 0.68, 0.008, 0.012, 0xf0e3c9);
      prop(bow, -0.32, 0.06, 0.15, 0.06, 0.035, 0.035, 0x272b2d);
    }
  }

  const positions = new Float32Array(parts.length * 72);
  const normals = new Float32Array(positions.length);
  const uvs = new Float32Array(parts.length * 48);
  const indices = new Uint16Array(parts.length * 36);
  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex], source = part.source.geometry;
    part.offset = partIndex * 24;
    part.positions = source.attributes.position;
    part.normals = source.attributes.normal;
    for (let vertex = 0; vertex < 24; vertex++) {
      uvs[(part.offset + vertex) * 2] = (source.attributes.uv.getX(vertex) + part.guest) / guests.length;
      uvs[(part.offset + vertex) * 2 + 1] = source.attributes.uv.getY(vertex);
    }
    for (let index = 0; index < 36; index++) indices[partIndex * 36 + index] = source.index.getX(index) + part.offset;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(-5.5, 1, -19), 11);
  const texture = new THREE.CanvasTexture(atlas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  const material = new THREE.MeshLambertMaterial({ map: texture, alphaTest: 0.5, emissive: 0xffffff, emissiveMap: texture, emissiveIntensity: 0.22 });
  const people = new THREE.Mesh(geometry, material);
  people.name = 'night-concert-guests';
  people.receiveShadow = true;
  const [instruments] = batch.build(materials);
  instruments.name = 'night-concert-instruments';
  instruments.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instruments.boundingSphere = geometry.boundingSphere.clone();
  const group = new THREE.Group();
  group.name = 'night-concert';
  group.add(people, instruments);
  group.visible = false;
  const vertexPosition = new THREE.Vector3(), vertexNormal = new THREE.Vector3();
  const armAxis = new THREE.Vector3(0, -1, 0), grip = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3(), matrix = new THREE.Matrix4();
  const projection = new THREE.Matrix4(), frustum = new THREE.Frustum();
  let frameClock = 0;

  function hold(arm, instrument, positionX, positionY, positionZ) {
    grip.set(positionX, positionY, positionZ).applyMatrix4(instrument.matrix).sub(arm.position).normalize();
    arm.quaternion.setFromUnitVectors(armAxis, grip);
  }

  function draw(dt, camera, time, phase, cheering) {
    if (!group.visible || document.hidden) return;
    camera.updateMatrixWorld();
    projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(projection);
    if (!frustum.intersectsSphere(geometry.boundingSphere)) return;
    frameClock += dt;
    if (frameClock < 1 / 30) return;
    frameClock = 0;
    for (let index = 0; index < guests.length; index++) {
      const guest = guests[index], avatar = guest.avatar;
      const playing = guest.arrived && (phase === guest.role || phase === 'duet') && guest.role !== 'audience';
      const clapping = guest.arrived && (phase === 'applause' || cheering > 0) && guest.role === 'audience';
      const swing = guest.walking ? Math.sin(time * 7 + index) * 0.5 : 0;
      const sway = Math.sin(time * 2.1 + index * 1.7);
      avatar.body.position.set(0, guest.walking ? Math.abs(swing) * 0.045 : 0, 0);
      avatar.body.rotation.set(0, 0, guest.arrived ? sway * 0.025 : 0);
      avatar.head.rotation.set(playing ? 0.09 : 0, Math.sin(time * 0.7 + index) * 0.12, 0);
      avatar.legR.rotation.set(swing, 0, 0);
      avatar.legL.rotation.set(-swing, 0, 0);
      avatar.armR.rotation.set(-swing * 0.8, 0, 0.03);
      avatar.armL.rotation.set(swing * 0.8, 0, -0.03);
      if (guest.role === 'wind') {
        guest.instrument.position.set(playing ? 0 : -0.35, playing ? 1.52 : 0.8, playing ? 0.28 : 0.15);
        guest.instrument.rotation.set(playing ? -0.38 : -0.08, 0, 0);
        avatar.armR.rotation.set(playing ? -1.02 : -0.2, playing ? 0.25 : 0, playing ? -0.4 : -0.1);
        avatar.armL.rotation.set(playing ? -1.28 : swing, playing ? -0.25 : 0, playing ? 0.4 : -0.03);
        if (playing) {
          guest.instrument.updateMatrix();
          hold(avatar.armL, guest.instrument, 0, -0.25, 0.06);
          hold(avatar.armR, guest.instrument, 0, -0.47, 0.06);
        }
      } else if (guest.role === 'violin') {
        guest.instrument.position.set(playing ? 0.13 : 0.37, playing ? 1.3 : 0.75, playing ? 0.28 : 0.08);
        guest.instrument.rotation.set(playing ? -0.2 : 1.2, playing ? 0.65 : 0, playing ? -0.08 : 0.1);
        guest.bow.position.x = playing ? Math.sin(time * Math.PI * 1.6) * 0.15 : 0;
        guest.bow.rotation.y = playing ? -0.15 : 0.65;
        avatar.armL.rotation.set(playing ? -1.45 : -0.25, playing ? -0.6 : 0, playing ? 0.3 : -0.1);
        avatar.armR.rotation.set(playing ? -1.25 + Math.sin(time * Math.PI * 1.6) * 0.14 : swing, playing ? 0.5 : 0, playing ? -0.55 : 0.03);
        if (playing) {
          guest.instrument.updateMatrix();
          hold(avatar.armL, guest.instrument, 0.01, -0.02, 0.47);
          hold(avatar.armR, guest.instrument, -0.32 + guest.bow.position.x, 0.07, 0.15);
        }
      } else if (clapping) {
        const clap = Math.abs(Math.sin(time * 7 + index));
        avatar.armR.rotation.set(-1.2, -0.3, -0.35 - clap * 0.35);
        avatar.armL.rotation.set(-1.2, 0.3, 0.35 + clap * 0.35);
      } else if (guest.arrived && Math.sin(time * 0.32 + index * 2) > 0.94) {
        avatar.armR.rotation.set(-2.7, 0, -0.3 + sway * 0.15);
      }
      avatar.root.scale.setScalar(guest.present ? guest.fade : 0);
      avatar.root.updateMatrixWorld(true);
    }
    for (const part of parts) {
      normalMatrix.getNormalMatrix(part.source.matrixWorld);
      for (let vertex = 0; vertex < 24; vertex++) {
        vertexPosition.fromBufferAttribute(part.positions, vertex).applyMatrix4(part.source.matrixWorld);
        vertexNormal.fromBufferAttribute(part.normals, vertex).applyNormalMatrix(normalMatrix);
        geometry.attributes.position.setXYZ(part.offset + vertex, vertexPosition.x, vertexPosition.y, vertexPosition.z);
        geometry.attributes.normal.setXYZ(part.offset + vertex, vertexNormal.x, vertexNormal.y, vertexNormal.z);
      }
    }
    for (let index = 0; index < accessories.length; index++) {
      matrix.multiplyMatrices(accessories[index].parent.matrixWorld, accessories[index].local);
      instruments.setMatrixAt(index, matrix);
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    instruments.instanceMatrix.needsUpdate = true;
  }

  return { group, guests, draw, people, instruments };
}
