import * as THREE from 'three';
import { BoxBatch } from '@engine/world/blocks.js';
import { COASTER_CAR_COUNT, COASTER_CAR_SPACING } from './coaster-route.js';

export function buildCoasterTrain(template, layer, materials, route) {
  const group = new THREE.Group(); group.name = 'coaster-train';
  const cars = Array.from({ length: COASTER_CAR_COUNT }, (_, index) => {
    const car = new THREE.Object3D(); car.name = `coaster-car-${index + 1}`;
    car.rotation.order = 'YXZ'; group.add(car); return car;
  });
  const batch = new BoxBatch(layer);
  for (const [kind, items] of Object.entries(template.items)) {
    batch.items[kind] = Array.from({ length: COASTER_CAR_COUNT }, () => items).flat();
  }
  const parts = batch.build(materials).map(mesh => {
    const count = mesh.count / COASTER_CAR_COUNT;
    const matrices = Array.from({ length: count }, (_, index) => {
      const matrix = new THREE.Matrix4(); mesh.getMatrixAt(index, matrix); return matrix;
    });
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 7);
    group.add(mesh); return { mesh, matrices, count };
  });
  const position = new THREE.Vector3(), tangent = new THREE.Vector3(), matrix = new THREE.Matrix4();
  function sync(route, distance, direction) {
    for (let index = 0; index < cars.length; index++) {
      const car = cars[index];
      route.sample(distance + (1 - index) * COASTER_CAR_SPACING, position, tangent);
      car.position.copy(position);
      car.rotation.set(-Math.atan2(tangent.y * direction, Math.hypot(tangent.x, tangent.z)), Math.atan2(tangent.x * direction, tangent.z * direction), 0);
      car.updateMatrix();
    }
    if (!group.visible) return;
    for (const { mesh, matrices, count } of parts) {
      for (let index = 0; index < cars.length; index++) for (let part = 0; part < count; part++) {
        matrix.multiplyMatrices(cars[index].matrix, matrices[part]); mesh.setMatrixAt(index * count + part, matrix);
      }
      mesh.boundingSphere.center.copy(cars[1].position);
      mesh.instanceMatrix.needsUpdate = true;
    }
  }
  sync(route, route.start, 1);
  return { group, cars, sync };
}
