import * as THREE from 'three';

export const COASTER_VIEW_TURN_RATE = 2.8;
export const COASTER_LOOK_TURN_RATE = 3.6;

export function createCoasterView(route, camera) {
  const position = new THREE.Vector3(), tangent = new THREE.Vector3();
  const behind = new THREE.Vector3(), ahead = new THREE.Vector3(), forward = new THREE.Vector3();
  const origin = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), basis = new THREE.Matrix4();
  const rotation = new THREE.Quaternion(), target = new THREE.Quaternion(), lookRotation = new THREE.Quaternion();
  const eye = new THREE.Vector3(), focus = new THREE.Vector3(), orbit = new THREE.Vector3();
  let lookYaw = 0, targetLookYaw = 0;
  let firstPerson = true, followDistance = 8.6, targetFollowDistance = 8.6, thirdBlend = 0;

  function aim(distance, direction, speed) {
    const span = 1.2 + speed * 0.08, preview = speed * 0.035;
    route.sample(distance + direction * (preview - span), behind, tangent);
    route.sample(distance + direction * (preview + span), ahead, tangent);
    forward.subVectors(ahead, behind).normalize();
    route.sample(distance, position, tangent);
    if (speed < 2) forward.lerp(tangent.multiplyScalar(direction), 1 - speed / 2).normalize();
    basis.lookAt(origin, forward, up); target.setFromRotationMatrix(basis);
  }

  function apply() {
    lookRotation.setFromAxisAngle(up, lookYaw);
    camera.quaternion.copy(rotation).premultiply(lookRotation);
    eye.set(0, 1.7, 0.12).applyQuaternion(rotation).add(position);
    if (thirdBlend > 0) {
      orbit.set(0, 0, 1).applyQuaternion(rotation); orbit.y = 0; orbit.normalize().applyQuaternion(lookRotation);
      focus.copy(position); focus.y += 1.15;
      camera.position.copy(focus).addScaledVector(orbit, followDistance * thirdBlend);
      camera.position.y += 1.65 * thirdBlend;
      if (thirdBlend < 1) camera.position.lerp(eye, 1 - thirdBlend);
      camera.lookAt(focus);
    } else camera.position.copy(eye);
    camera.updateMatrixWorld();
  }

  return {
    setRoute(next) { route = next; },
    setFirstPerson(value, immediate = false) {
      firstPerson = value;
      if (immediate) thirdBlend = value ? 0 : 1;
    },
    zoom(amount) { if (!firstPerson && Number.isFinite(amount)) targetFollowDistance = THREE.MathUtils.clamp(targetFollowDistance * amount, 6.5, 14); },
    turn(amount) { if (Number.isFinite(amount)) targetLookYaw += amount; },
    center() { targetLookYaw = Math.round(lookYaw / (Math.PI * 2)) * Math.PI * 2; },
    get yaw() { return Math.atan2(Math.sin(lookYaw), Math.cos(lookYaw)); },
    reset(distance, direction) {
      lookYaw = 0; targetLookYaw = 0;
      aim(distance, direction, 0); rotation.copy(target);
    },
    update(distance, direction, speed, dt, reduced = false) {
      aim(distance, direction, speed);
      const elapsed = Math.max(0, Math.min(dt, 0.05));
      const angle = rotation.angleTo(target), rate = reduced ? 1.8 : COASTER_VIEW_TURN_RATE;
      const amount = 1 - Math.exp(-elapsed / (reduced ? 0.18 : 0.12));
      if (angle > 1e-8) rotation.slerp(target, Math.min(amount, rate * elapsed / angle));
      const lookDelta = targetLookYaw - lookYaw, lookRate = reduced ? 2.4 : COASTER_LOOK_TURN_RATE;
      lookYaw += THREE.MathUtils.clamp(lookDelta * (1 - Math.exp(-elapsed / 0.08)), -lookRate * elapsed, lookRate * elapsed);
      if (Math.abs(lookYaw) > Math.PI * 2) {
        const turns = Math.trunc(lookYaw / (Math.PI * 2)) * Math.PI * 2;
        lookYaw -= turns; targetLookYaw -= turns;
      }
      thirdBlend = THREE.MathUtils.damp(thirdBlend, firstPerson ? 0 : 1, 12, elapsed);
      if (Math.abs(thirdBlend - (firstPerson ? 0 : 1)) < 0.001) thirdBlend = firstPerson ? 0 : 1;
      followDistance = THREE.MathUtils.damp(followDistance, targetFollowDistance, 12, elapsed);
      apply();
    },
  };
}
