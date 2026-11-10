export const COASTER_STATIONS = [
  { id: 'home', name: '主岛北岸总站', en: 'North Shore Station', x: 15, y: 2.25, z: -31, exit: { x: 13.5, y: 2.25, z: -31 } },
  { id: 'qin', name: '秦岛码头', en: 'Qin Island', x: 88, y: 0, z: 19, exit: { x: 90, y: 0, z: 19 } },
];

export const COASTER_POINTS = [
  [15, 2.43, -25.4], [15, 2.43, -31], [15, 2.43, -38], [19, 6, -43], [26, 24, -59],
  [38, 42, -65], [45, 42, -63], [49, 24, -59], [53, 3.8, -54],
  [62, 4.5, -47], [73, 17, -38], [77, 19, -27], [67, 6, -19],
  [52, 8, -22], [44, 16, -12], [52, 23, -1], [66, 20, 0],
  [77, 9, -7], [79, 3, 3], [85, 1.2, 10], [88, 0.18, 13.4], [88, 0.18, 19], [88, 0.18, 24.6],
];

export const COASTER_CAR_COUNT = 3;
export const COASTER_CAR_SPACING = 2.65;
export const COASTER_BRAKING = 10;
export const COASTER_PLATFORM = { x0: 8.5, x1: 21.5, z0: -36.5, z1: -24.8, y: 2.25 };
export const COASTER_STEPS = Array.from({ length: 13 }, (_, index) => ({
  x0: 12.8, x1: 17.2, z0: -20 - index * 0.4, z1: -19.6 - index * 0.4, y: (index + 1) * 2.25 / 13,
}));
export const COASTER_LOOP_POINTS = [
  [15, 2.43, -25.4], [15, 2.43, -31], [15, 2.43, -38], [11, 2.43, -43], [3, 12, -53],
  [-15, 36, -58], [-30, 38, -54], [-43, 30, -42], [-49, 5, -29], [-52, 5, -13],
  [-52, 28, 4], [-48, 30, 22], [-35, 32, 44], [-14, 33, 62], [12, 33, 65],
  [28, 24, 60], [41, 5, 49], [49, 4, 34], [57, 29, 16], [57, 31, -7],
  [54, 33, -27], [36, 36, -54], [16, 28, -51],
  [12, 10, -49], [11, 4, -44], [13, 2.43, -41], [15, 2.43, -38], [15, 2.43, -31], [15, 2.43, -25.4],
];
export const COASTER_LOOP_SECTIONS = [
  { id: 'north', name: '北岸高空全景', en: 'North island panorama', from: 5, to: 7, speed: 7 },
  { id: 'west', name: '西岸建筑群', en: 'West coast buildings', from: 10, to: 12, speed: 7 },
  { id: 'south', name: '南湾与空中小屋', en: 'South bay and sky cottage', from: 12, to: 14, speed: 7 },
  { id: 'east', name: '东岸摩天轮', en: 'East coast ferris wheel', from: 18, to: 20, speed: 7 },
];

export function createCoasterRoute(id = 'qin') {
  const points = id === 'loop' ? COASTER_LOOP_POINTS : COASTER_POINTS;
  const resolution = 32, count = (points.length - 1) * resolution + 1;
  const positions = new Float64Array(count * 3), distances = new Float64Array(count), tangents = new Float64Array(count * 3);
  for (let index = 0; index < count; index++) {
    const segment = Math.min(points.length - 2, Math.floor(index / resolution));
    const amount = (index - segment * resolution) / resolution;
    const previous = points[Math.max(0, segment - 1)], start = points[segment];
    const end = points[segment + 1], next = points[Math.min(points.length - 1, segment + 2)];
    for (let axis = 0; axis < 3; axis++) {
      let first = (end[axis] - previous[axis]) * 0.5, last = (next[axis] - start[axis]) * 0.5;
      if (axis === 0 && start[0] === 15 && end[0] === 15 && start[1] === 2.43 && end[1] === 2.43) first = last = 0;
      if (axis === 1) {
        const before = start[axis] - previous[axis], current = end[axis] - start[axis], after = next[axis] - end[axis];
        first = before * current > 0 ? 2 * before * current / (before + current) : 0;
        last = current * after > 0 ? 2 * current * after / (current + after) : 0;
      }
      positions[index * 3 + axis] = (2 * start[axis] - 2 * end[axis] + first + last) * amount ** 3
        + (-3 * start[axis] + 3 * end[axis] - 2 * first - last) * amount ** 2 + first * amount + start[axis];
    }
    if (index) distances[index] = distances[index - 1] + Math.hypot(
      positions[index * 3] - positions[index * 3 - 3], positions[index * 3 + 1] - positions[index * 3 - 2], positions[index * 3 + 2] - positions[index * 3 - 1]);
  }
  for (let index = 0; index < count; index++) {
    const previous = Math.max(0, index - 1) * 3, next = Math.min(count - 1, index + 1) * 3;
    const horizontal = positions[next] - positions[previous], vertical = positions[next + 1] - positions[previous + 1], depth = positions[next + 2] - positions[previous + 2];
    const magnitude = Math.hypot(horizontal, vertical, depth);
    tangents[index * 3] = horizontal / magnitude; tangents[index * 3 + 1] = vertical / magnitude; tangents[index * 3 + 2] = depth / magnitude;
  }
  const length = distances[count - 1];
  function sample(distance, position, tangent) {
    const clamped = Math.max(0, Math.min(length, distance));
    let lower = 0, upper = count - 1;
    while (upper - lower > 1) {
      const middle = (lower + upper) >> 1;
      if (distances[middle] <= clamped) lower = middle;
      else upper = middle;
    }
    const span = distances[upper] - distances[lower], amount = span > 0 ? (clamped - distances[lower]) / span : 0;
    const offset = lower * 3, next = upper * 3;
    position.x = positions[offset] + (positions[next] - positions[offset]) * amount;
    position.y = positions[offset + 1] + (positions[next + 1] - positions[offset + 1]) * amount;
    position.z = positions[offset + 2] + (positions[next + 2] - positions[offset + 2]) * amount;
    tangent.x = tangents[offset] + (tangents[next] - tangents[offset]) * amount;
    tangent.y = tangents[offset + 1] + (tangents[next + 1] - tangents[offset + 1]) * amount;
    tangent.z = tangents[offset + 2] + (tangents[next + 2] - tangents[offset + 2]) * amount;
    const magnitude = Math.hypot(tangent.x, tangent.y, tangent.z);
    tangent.x /= magnitude; tangent.y /= magnitude; tangent.z /= magnitude;
    return position;
  }
  const start = distances[resolution], end = distances[(points.length - 2) * resolution];
  const trackLength = id === 'loop' ? distances[(points.length - 3) * resolution] : length;
  const sections = id === 'loop' ? COASTER_LOOP_SECTIONS.map(section => ({
    ...section, start: distances[section.from * resolution], end: distances[section.to * resolution],
  })) : [];
  function sectionAt(distance) {
    for (const section of sections) if (distance >= section.start && distance <= section.end) return section;
    return null;
  }
  function speedLimit(distance, direction) {
    let limit = 30;
    for (const section of sections) {
      if (distance >= section.start && distance <= section.end) limit = Math.min(limit, section.speed);
      const ahead = direction > 0 ? section.start - distance : distance - section.end;
      if (ahead >= 0) limit = Math.min(limit, Math.sqrt(section.speed ** 2 + 2 * COASTER_BRAKING * ahead));
    }
    return limit;
  }
  return { id, length, start, end, trackLength, sample, sections, sectionAt, speedLimit };
}
