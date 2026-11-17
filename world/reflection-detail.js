import * as THREE from 'three';
import { createReflectionLandMask, reflectionFootprint } from './reflection-land-mask.js';

export function createReflectionDetail({ scene, grid, level }) {
  let land = createReflectionLandMask(grid);
  const sources = [], batches = [], surfaces = [], hidden = [];
  const projection = new THREE.Matrix4(), inverse = new THREE.Matrix4(), transform = new THREE.Matrix4(), instance = new THREE.Matrix4();
  const bounds = new THREE.Box3(), footprint = { x0: 0, x1: 0, z0: 0, z1: 0 };
  let warming = false;
  scene.traverse(object => {
    if (object.isInstancedMesh && object.geometry.getAttribute('iLayers')
      || object.isMesh && !object.isInstancedMesh && object.geometry.getAttribute('tileLayer') && object.geometry.index) sources.push(object);
  });
  for (const source of sources) {
    source.geometry.computeBoundingBox();
    if (!source.isInstancedMesh) {
      const original = source.geometry, position = original.getAttribute('position'), index = original.index, chunks = new Map();
      const point = new THREE.Vector3(), triangle = new THREE.Box3();
      for (let offset = 0; offset < index.count; offset += 3) {
        triangle.makeEmpty();
        for (let corner = 0; corner < 3; corner++) triangle.expandByPoint(point.fromBufferAttribute(position, index.array[offset + corner]));
        triangle.getCenter(point);
        const key = `${Math.floor(point.x / 8)},${Math.floor(point.y / 4)},${Math.floor(point.z / 8)}`;
        if (!chunks.has(key)) chunks.set(key, { bounds: new THREE.Box3(), indices: [] });
        const chunk = chunks.get(key); chunk.bounds.union(triangle);
        chunk.indices.push(index.array[offset], index.array[offset + 1], index.array[offset + 2]);
      }
      const geometry = new THREE.BufferGeometry();
      for (const [name, attribute] of Object.entries(original.attributes)) geometry.setAttribute(name, attribute);
      geometry.setIndex(new THREE.BufferAttribute(new index.array.constructor(index.count), 1).setUsage(THREE.DynamicDrawUsage));
      if (!original.boundingSphere) original.computeBoundingSphere();
      geometry.boundingSphere = original.boundingSphere.clone();
      const mesh = new THREE.Mesh(geometry, source.material);
      mesh.userData.reflectionSource = source;
      mesh.name = 'water-reflection-surface'; mesh.visible = false; mesh.matrixAutoUpdate = false;
      source.parent.add(mesh);
      const entries = [...chunks.values()];
      surfaces.push({ source, mesh, geometry: original, buffers: Object.entries(original.attributes), chunks: entries, position, index, positionVersion: position.version, indexVersion: index.version,
        worldBounds: entries.map(() => new THREE.Box3()), ...selection(entries.length) });
      continue;
    }
    const geometry = source.geometry.clone();
    const mesh = new THREE.InstancedMesh(geometry, source.material, source.instanceMatrix.count);
    mesh.userData.reflectionSource = source;
    mesh.name = 'water-reflection-detail'; mesh.visible = false; mesh.matrixAutoUpdate = false;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (source.instanceColor) mesh.instanceColor = source.instanceColor.clone().setUsage(THREE.DynamicDrawUsage);
    const attributes = Object.values(geometry.attributes).filter(attribute => attribute.isInstancedBufferAttribute);
    const originals = Object.values(source.geometry.attributes).filter(attribute => attribute.isInstancedBufferAttribute);
    for (const attribute of attributes) attribute.setUsage(THREE.DynamicDrawUsage);
    if (!source.boundingSphere) source.computeBoundingSphere();
    mesh.boundingSphere = source.boundingSphere.clone();
    source.parent.add(mesh);
    const capacity = source.instanceMatrix.count, cells = new Map();
    for (let index = 0; index < capacity; index++) {
      const offset = index * 16, values = source.instanceMatrix.array;
      const key = `${Math.floor(values[offset + 12] / 8)},${Math.floor(values[offset + 13] / 4)},${Math.floor(values[offset + 14] / 8)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(index);
    }
    batches.push({ source, mesh, attributes, originals, buffers: Object.entries(source.geometry.attributes), geometry: source.geometry, matrices: source.instanceMatrix,
      color: source.instanceColor, position: source.geometry.getAttribute('position'), positionVersion: source.geometry.getAttribute('position').version,
      index: source.geometry.index, indexVersion: source.geometry.index?.version,
      geometryVersions: Object.entries(source.geometry.attributes).filter(([, attribute]) => !attribute.isInstancedBufferAttribute).map(([name, attribute]) => ({ name, version: attribute.version })),
      matrixVersion: -1, copies: new Float32Array(capacity * 16), worldBounds: new Float64Array(capacity * 6),
      groups: [...cells.values()].map(indices => ({ indices: Uint32Array.from(indices), bounds: new THREE.Box3() })),
      kept: new Uint8Array(capacity),
      uploads: [source.instanceMatrix, source.instanceColor, ...originals].filter(Boolean),
      versions: new Int32Array(2 + originals.length).fill(-1), ...selection(capacity) });
  }
  function selection(capacity) {
    return { selected: new Uint32Array(capacity), count: -1, sourceCount: -1, ready: false,
      worldMatrix: new THREE.Matrix4(), view: new THREE.Matrix4(), eye: new THREE.Vector3() };
  }
  function visible(source, camera) {
    if (!source.layers.test(camera.layers)) return false;
    for (let object = source; object; object = object.parent) if (!object.visible) return false;
    return true;
  }
  function compatible(entry) {
    const geometry = entry.source.geometry;
    if (geometry !== entry.geometry || geometry.index !== entry.index || geometry.index?.version !== entry.indexVersion) return false;
    for (const [name, attribute] of entry.buffers) if (geometry.getAttribute(name) !== attribute) return false;
    if (entry.geometryVersions) for (const attribute of entry.geometryVersions) if (geometry.getAttribute(attribute.name).version !== attribute.version) return false;
    return true;
  }
  function show(entry) {
    const { source, mesh } = entry;
    source.visible = false; hidden.push(source); mesh.visible = entry.count > 0;
    mesh.matrix.copy(source.matrix); mesh.matrixWorld.copy(source.matrixWorld);
    mesh.material = source.material; mesh.layers.mask = source.layers.mask; mesh.renderOrder = source.renderOrder;
    mesh.receiveShadow = source.receiveShadow;
  }
  function loadBounds(values, index) {
    const offset = index * 6;
    bounds.min.set(values[offset], values[offset + 1], values[offset + 2]);
    bounds.max.set(values[offset + 3], values[offset + 4], values[offset + 5]);
  }
  function remember(entry, camera, count) {
    entry.ready = true; entry.sourceCount = count;
    entry.worldMatrix.copy(entry.source.matrixWorld); entry.view.copy(projection); entry.eye.copy(camera.position);
  }
  function covered(camera) {
    return bounds.max.y < level || reflectionFootprint(camera, projection, inverse, bounds, level, footprint) && land.covers(footprint);
  }
  return {
    get cacheBufferBytes() {
      let bytes = 0;
      for (const entry of surfaces) bytes += entry.selected.byteLength;
      for (const batch of batches) {
        bytes += batch.selected.byteLength + batch.copies.byteLength + batch.worldBounds.byteLength + batch.kept.byteLength + batch.versions.byteLength;
        for (const group of batch.groups) bytes += group.indices.byteLength;
      }
      return bytes;
    },
    warmup(on) { warming = on; },
    invalidate() {
      land = createReflectionLandMask(grid);
      for (const entry of surfaces) entry.ready = false;
      for (const batch of batches) batch.ready = false;
    },
    beginReflection(camera) {
      if (warming) return;
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); inverse.copy(projection).invert();
      for (const entry of surfaces) {
        const { source, mesh, chunks, selected, worldBounds } = entry, geometry = source.geometry;
        if (!visible(source, camera)) continue;
        if (!compatible(entry) || entry.position.version !== entry.positionVersion
          || geometry.drawRange.start !== 0 || geometry.drawRange.count < geometry.index.count) continue;
        const moved = !entry.ready || !entry.worldMatrix.equals(source.matrixWorld);
        if (moved) for (let index = 0; index < chunks.length; index++) worldBounds[index].copy(chunks[index].bounds).applyMatrix4(source.matrixWorld);
        if (moved || !entry.view.equals(projection) || !entry.eye.equals(camera.position)) {
          let count = 0, changed = !entry.ready;
          for (let index = 0; index < chunks.length; index++) {
            bounds.copy(worldBounds[index]);
            if (covered(camera)) continue;
            if (selected[count] !== index) changed = true;
            selected[count++] = index;
          }
          changed ||= count !== entry.count;
          entry.count = count; remember(entry, camera, chunks.length);
          if (changed && count < chunks.length) {
            let offset = 0;
            for (let index = 0; index < count; index++) for (const vertex of chunks[selected[index]].indices) mesh.geometry.index.array[offset++] = vertex;
            mesh.geometry.setDrawRange(0, offset); mesh.geometry.index.needsUpdate = true;
          }
        }
        if (entry.count < chunks.length) show(entry);
      }
      for (const batch of batches) {
        const { source, mesh, attributes, originals, selected, worldBounds, copies, groups, kept } = batch;
        if (!source.count || !visible(source, camera)) continue;
        if (!compatible(batch) || source.instanceMatrix !== batch.matrices || source.instanceColor !== batch.color
          || batch.position.version !== batch.positionVersion || source.count > selected.length) continue;
        const moved = !batch.ready || !batch.worldMatrix.equals(source.matrixWorld);
        const matrixChanged = batch.matrixVersion !== source.instanceMatrix.version;
        const countChanged = batch.sourceCount !== source.count;
        if (moved || matrixChanged || countChanged) {
          const values = source.instanceMatrix.array;
          for (let index = 0; index < source.count; index++) {
            const offset = index * 16;
            let changed = moved || index >= batch.sourceCount;
            if (!changed && matrixChanged) for (let component = 0; component < 16; component++) if (copies[offset + component] !== values[offset + component]) { changed = true; break; }
            if (!changed) continue;
            for (let component = 0; component < 16; component++) copies[offset + component] = values[offset + component];
            instance.fromArray(values, offset); transform.multiplyMatrices(source.matrixWorld, instance);
            bounds.copy(source.geometry.boundingBox).applyMatrix4(transform);
            bounds.min.toArray(worldBounds, index * 6); bounds.max.toArray(worldBounds, index * 6 + 3);
          }
          for (const group of groups) {
            group.bounds.makeEmpty();
            for (const index of group.indices) if (index < source.count) { loadBounds(worldBounds, index); group.bounds.union(bounds); }
          }
          batch.matrixVersion = source.instanceMatrix.version;
        }
        let changed = false;
        if (moved || matrixChanged || countChanged || !batch.view.equals(projection) || !batch.eye.equals(camera.position)) {
          let count = 0;
          changed = !batch.ready;
          kept.fill(0, 0, source.count);
          for (const group of groups) {
            if (group.bounds.isEmpty()) continue;
            bounds.copy(group.bounds);
            if (covered(camera)) continue;
            for (const index of group.indices) {
              if (index >= source.count) continue;
              loadBounds(worldBounds, index);
              if (!covered(camera)) kept[index] = 1;
            }
          }
          for (let index = 0; index < source.count; index++) if (kept[index]) {
            if (selected[count] !== index) changed = true;
            selected[count++] = index;
          }
          changed ||= count !== batch.count;
          batch.count = count; remember(batch, camera, source.count);
        }
        if (batch.count === source.count) continue;
        let upload = changed;
        for (let index = 0; index < batch.uploads.length; index++) if (batch.versions[index] !== batch.uploads[index].version) upload = true;
        if (upload) {
          for (let count = 0; count < batch.count; count++) {
            const index = selected[count];
            for (let component = 0; component < 16; component++) mesh.instanceMatrix.array[count * 16 + component] = source.instanceMatrix.array[index * 16 + component];
            if (source.instanceColor) for (let component = 0; component < 3; component++) mesh.instanceColor.array[count * 3 + component] = source.instanceColor.array[index * 3 + component];
            for (let attributeIndex = 0; attributeIndex < attributes.length; attributeIndex++) {
              const target = attributes[attributeIndex], original = originals[attributeIndex];
              for (let component = 0; component < target.itemSize; component++) target.array[count * target.itemSize + component] = original.array[index * target.itemSize + component];
            }
          }
          mesh.instanceMatrix.needsUpdate = true;
          if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
          for (const attribute of attributes) attribute.needsUpdate = true;
          for (let index = 0; index < batch.uploads.length; index++) batch.versions[index] = batch.uploads[index].version;
          mesh.count = batch.count;
          mesh.boundingSphere.copy(source.boundingSphere);
        }
        show(batch);
      }
    },
    endReflection() {
      for (const source of hidden) source.visible = true;
      hidden.length = 0;
      for (const { mesh } of batches) mesh.visible = false;
      for (const { mesh } of surfaces) mesh.visible = false;
    },
  };
}
