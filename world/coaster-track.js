import * as THREE from 'three';

const STEEL = { tex: 'steel', tint: 0xd0d9d6, emissive: 0.16 };
const RED = { tex: 'paint', tint: 0xa94035, emissive: 0.18 };
const SUPPORT = { tex: 'paint', tint: 0x819a93, emissive: 0.08 };

function buildGeometry(route, layer, detailed, distant = false, start = 0, end = route.trackLength) {
  const length = end - start;
  const vertices = [], normals = [], colors = [], layers = [], emissive = [], uvs = [], indices = [];
  const color = new THREE.Color(), normal = new THREE.Vector3(), edge = new THREE.Vector3();
  const position = new THREE.Vector3(), tangent = new THREE.Vector3(), side = new THREE.Vector3(), up = new THREE.Vector3();
  const from = new THREE.Vector3(), to = new THREE.Vector3(), axis = new THREE.Vector3(), middle = new THREE.Vector3();
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const corners = Array.from({ length: 8 }, () => new THREE.Vector3());
  const faces = [[0, 1, 2, 3], [1, 5, 6, 2], [5, 4, 7, 6], [4, 0, 3, 7], [3, 2, 6, 7], [4, 5, 1, 0]];

  function quad(first, second, third, fourth, look) {
    const offset = vertices.length / 3;
    normal.subVectors(second, first).cross(edge.subVectors(third, first)).normalize();
    color.set(look.tint ?? 0xffffff);
    const width = first.distanceTo(second), height = second.distanceTo(third);
    for (const point of [first, second, third, fourth]) {
      vertices.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z);
      colors.push(color.r, color.g, color.b); layers.push(layer[look.tex]); emissive.push(look.emissive || 0);
    }
    uvs.push(0, 0, width, 0, width, height, 0, height);
    indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }

  function beam(start, end, width, height, look, capped = false) {
    axis.subVectors(end, start);
    const length = axis.length();
    rotation.set(-Math.atan2(axis.y, Math.hypot(axis.x, axis.z)), Math.atan2(axis.x, axis.z), 0);
    middle.addVectors(start, end).multiplyScalar(0.5);
    for (let index = 0; index < 8; index++) {
      corners[index].set((index === 1 || index === 2 || index === 5 || index === 6 ? 1 : -1) * width / 2,
        (index === 2 || index === 3 || index === 6 || index === 7 ? 1 : -1) * height / 2,
        (index < 4 ? 1 : -1) * length / 2).applyEuler(rotation).add(middle);
    }
    for (let index = capped ? 0 : 1; index < (capped ? 6 : 6); index++) {
      if (!capped && index === 2) continue;
      const face = faces[index]; quad(corners[face[0]], corners[face[1]], corners[face[2]], corners[face[3]], look);
    }
  }

  function frame(distance) {
    route.sample(distance, position, tangent);
    side.set(tangent.z, 0, -tangent.x).normalize(); up.crossVectors(tangent, side).normalize();
  }

  const segments = Math.max(1, Math.ceil(length / (detailed ? 1.8 : distant ? 8 : 3)));
  const previous = Array.from({ length: 4 }, () => new THREE.Vector3());
  const ring = Array.from({ length: 4 }, () => new THREE.Vector3());
  for (const offset of detailed ? [-0.49, 0.49] : [0]) {
    const spine = offset === 0, width = spine ? 0.34 : 0.17, height = spine ? 0.38 : 0.18;
    const railLook = spine ? route.id === 'loop' ? SUPPORT : RED : STEEL;
    for (let index = 0; index <= segments; index++) {
      frame(start + length * index / segments);
      for (let corner = 0; corner < 4; corner++) ring[corner].copy(position)
        .addScaledVector(side, offset + (corner === 0 || corner === 3 ? -1 : 1) * width / 2)
        .addScaledVector(up, (spine ? -0.45 : 0) + (corner < 2 ? 1 : -1) * height / 2);
      if (index) for (let face = 0; face < 4; face++) {
        const next = (face + 1) % 4;
        quad(previous[face], ring[face], ring[next], previous[next], railLook);
      }
      else quad(ring[3], ring[2], ring[1], ring[0], railLook);
      if (index === segments) quad(ring[0], ring[1], ring[2], ring[3], railLook);
      for (let corner = 0; corner < 4; corner++) previous[corner].copy(ring[corner]);
    }
  }
  for (let distance = Math.ceil(start / 2.4) * 2.4; detailed && distance < end; distance += 2.4) {
    frame(distance);
    from.copy(position).addScaledVector(side, -0.76).addScaledVector(up, -0.19);
    to.copy(position).addScaledVector(side, 0.76).addScaledVector(up, -0.19);
    beam(from, to, 0.2, 0.18, route.id === 'loop' ? SUPPORT : RED);
  }
  for (let distance = 16; !detailed && distance < length - 12; distance += 36) {
    frame(distance);
    const bottom = position.x >= 85 ? -0.4 : -3, top = position.y - 0.7, spread = 1.1 + (top - bottom) * 0.018;
    for (const sign of [-1, 1]) {
      from.copy(position).addScaledVector(side, sign * spread); from.y = bottom;
      to.copy(position).addScaledVector(side, sign * 0.86); to.y = top;
      beam(from, to, 0.38, 0.38, SUPPORT);
    }
    from.copy(position).addScaledVector(side, -1.05); from.y = top;
    to.copy(position).addScaledVector(side, 1.05); to.y = top;
    beam(from, to, 0.36, 0.28, SUPPORT, detailed);
    const levels = detailed ? Math.ceil((top - bottom) / 6) : 1;
    for (let index = 0; index < levels; index++) {
      const first = index / levels, last = (index + 1) / levels;
      from.copy(position).addScaledVector(side, -(spread + (0.86 - spread) * first)); from.y = bottom + (top - bottom) * first;
      to.copy(position).addScaledVector(side, spread + (0.86 - spread) * last); to.y = bottom + (top - bottom) * last;
      beam(from, to, 0.14, 0.14, SUPPORT);
      if (detailed) {
        from.addScaledVector(side, 2 * (spread + (0.86 - spread) * first));
        to.addScaledVector(side, -2 * (spread + (0.86 - spread) * last));
        beam(from, to, 0.14, 0.14, SUPPORT);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  for (const [name, values, size] of [['position', vertices, 3], ['normal', normals, 3], ['color', colors, 3],
    ['tileUv', uvs, 2], ['tileLayer', layers, 1], ['tileEmissive', emissive, 1]]) {
    geometry.setAttribute(name, new THREE.Float32BufferAttribute(values, size));
  }
  geometry.setIndex(indices); geometry.computeBoundingSphere();
  return geometry;
}

function buildDetail(route, layer) {
  const chunks = [], spacing = 8, offsets = [0];
  let vertexCount = 0, indexCount = 0;
  for (let start = 0; start < route.trackLength; start += spacing) {
    const chunk = buildGeometry(route, layer, true, false, start, Math.min(route.trackLength, start + spacing));
    chunks.push(chunk); vertexCount += chunk.attributes.position.count; indexCount += chunk.index.count;
    offsets.push(indexCount);
  }
  const geometry = new THREE.BufferGeometry();
  for (const name of Object.keys(chunks[0].attributes)) {
    const size = chunks[0].attributes[name].itemSize, values = new Float32Array(vertexCount * size);
    let offset = 0;
    for (const chunk of chunks) {
      values.set(chunk.attributes[name].array, offset); offset += chunk.attributes[name].array.length;
    }
    geometry.setAttribute(name, new THREE.BufferAttribute(values, size));
  }
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let vertexOffset = 0, indexOffset = 0;
  for (const chunk of chunks) {
    for (const index of chunk.index.array) indices[indexOffset++] = vertexOffset + index;
    vertexOffset += chunk.attributes.position.count;
  }
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.boundingSphere = new THREE.Sphere();
  return { geometry, bounds: chunks.map(chunk => chunk.boundingSphere), offsets, spacing };
}

export function buildCoasterTrack(route, layer, materials) {
  const far = buildGeometry(route, layer, false), distant = buildGeometry(route, layer, false, true);
  const { geometry, bounds, offsets, spacing } = buildDetail(route, layer);
  const mesh = new THREE.Group(); mesh.name = 'coaster-track';
  const base = new THREE.Mesh(far, materials.voxel), detail = new THREE.Mesh(geometry, materials.voxel);
  detail.visible = false;
  for (const part of [base, detail]) { part.receiveShadow = true; part.matrixAutoUpdate = false; mesh.add(part); }
  const anchors = [], position = new THREE.Vector3(), tangent = new THREE.Vector3();
  for (let distance = 0; distance <= route.trackLength; distance += 8) {
    route.sample(distance, position, tangent); anchors.push(position.clone());
  }
  let detailed = false, firstChunk = -1, lastChunk = -1;
  return { mesh,
    update(camera, riding) {
      let closest = Infinity, nearest = 0;
      for (let index = 0; index < anchors.length; index++) {
        const distance = anchors[index].distanceToSquared(camera.position);
        if (distance < closest) { closest = distance; nearest = index * 8; }
      }
      detailed = riding || camera.position.y < 14 && closest < (detailed ? 28 ** 2 : 24 ** 2);
      base.geometry = camera.position.y > 22 || closest > 80 ** 2 ? distant : far;
      detail.visible = detailed;
      if (detailed) {
        const first = Math.max(0, Math.floor((nearest - 28) / spacing));
        const last = Math.min(bounds.length, Math.ceil((nearest + 28) / spacing));
        if (first !== firstChunk || last !== lastChunk) {
          firstChunk = first; lastChunk = last;
          geometry.setDrawRange(offsets[first], offsets[last] - offsets[first]);
          geometry.boundingSphere.copy(bounds[first]);
          for (let index = first + 1; index < last; index++) geometry.boundingSphere.union(bounds[index]);
        }
      }
    },
  };
}
