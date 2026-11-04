export const REST_POINTS = [];

export function addRestPoint({ id, name, en, x, y, z, floor = 0, yaw = 0, kind = 'sit' }) {
  const point = { id, name, en, x, y, z, floor, yaw, kind };
  REST_POINTS.push(point);
  return point;
}
