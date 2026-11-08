import * as THREE from 'three';
import { t, nameOf } from '@engine/lang.js';
import { QIN_WALL_TABLE, QIN_WALL_ROOM, QIN_GALLERY } from './qin-island-layout.js';
import { WALL_STOPS } from './qin-great-wall-data.js';
import { createWallSectionModel } from './qin-great-wall-models.js';

export function buildQinGreatWall({ architecture, batch, layer, materials, bakes, obstacles, solids, hotspots }) {
  const table = QIN_WALL_TABLE, bottom = table.floor + 0.96;
  const root = new THREE.Group(); root.name = 'qin-great-wall-projection';
  const wood = { tex: 'walnut', tint: 0x76604e };
  const metal = { tex: 'paint', tint: 0x263b3e };
  const bronze = { tex: 'paint', tint: 0xb29c71 };
  const glow = { tex: 'paint', tint: 0x73dddc, emissive: 0.8 };
  const box = (feature, x, y, z, width, height, depth, look) =>
    batch.box(x, y, z, width, height, depth, look, { tag: `qin-great-wall:${feature}` });
  box('plinth', table.x, table.floor, table.z, table.width - 0.8, 0.12, table.depth - 0.8, metal);
  for (let offset = -table.width / 2 + 1.6; offset < table.width / 2; offset += 4.8)
    box('pedestal', table.x + offset, table.floor + 0.12, table.z, 0.48, 0.54, table.depth - 1, wood);
  box('top', table.x, table.floor + 0.66, table.z, table.width, 0.12, table.depth, wood);
  box('projector-bed', table.x, table.floor + 0.78, table.z, table.width - 0.3, 0.035, table.depth - 0.3, metal);
  for (const side of [-1, 1]) {
    box('rim', table.x, table.floor + 0.78, table.z + side * (table.depth / 2 - 0.07), table.width, 0.055, 0.09, bronze);
    box('rim', table.x + side * (table.width / 2 - 0.07), table.floor + 0.78, table.z, 0.09, 0.055, table.depth - 0.15, bronze);
    box('light', table.x, table.floor + 0.74, table.z + side * (table.depth / 2 + 0.006), table.width - 0.35, 0.025, 0.025, glow);
    for (let offset = -table.width / 2 + 0.5; offset <= table.width / 2 - 0.5; offset += (table.width - 1) / 6) {
      box('emitter', table.x + offset, table.floor + 0.82, table.z + side * (table.depth / 2 - 0.5), 0.24, 0.06, 0.24, bronze);
      box('lens', table.x + offset, table.floor + 0.88, table.z + side * (table.depth / 2 - 0.5), 0.14, 0.025, 0.14, glow);
    }
  }
  architecture.sign('秦皇岛 · 长城投影桌', table.x, table.floor + 0.22, table.z + table.depth / 2 + 0.09, 5.4, 0.36);
  const bounds = { x0: table.x - table.width / 2 - 0.05, x1: table.x + table.width / 2 + 0.05,
    z0: table.z - table.depth / 2 - 0.05, z1: table.z + table.depth / 2 + 0.05, y0: table.floor, y1: bottom + 1.25 };
  solids.push(bounds); obstacles.push({ ...bounds, floor: table.floor });
  hotspots.push({ id: 'qin-great-wall', box: new THREE.Box3(new THREE.Vector3(bounds.x0, bounds.y0, bounds.z0), new THREE.Vector3(bounds.x1, bounds.y1, bounds.z1)) });
  bakes.push({ id: 'qin-great-wall-table', position: [table.x, bottom + 1.5, table.z], power: 0.7, radius: 7, direction: null });

  const model = createWallSectionModel({ layer, materials, width: table.width - 0.8, depth: table.depth - 1 });
  model.root.position.set(table.x, bottom, table.z); root.add(model.root);

  const ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 24), new THREE.MeshBasicMaterial({ color: 0xffd68b, side: THREE.DoubleSide, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.name = 'qin-wall-selected'; root.add(ring);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(table.width - 0.8, 0.06), new THREE.MeshBasicMaterial({ color: 0xa1ffef, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false }));
  scan.rotation.x = -Math.PI / 2; scan.position.set(table.x, bottom + 0.3, table.z); scan.name = 'qin-wall-scan'; root.add(scan);
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
  const context = canvas.getContext('2d'), texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.NearestFilter;
  const title = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.05), new THREE.MeshBasicMaterial({ map: texture, transparent: true, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false }));
  title.position.set(table.x, bottom + 2.05, table.z - table.depth / 2 + 0.2); title.name = 'qin-wall-title'; root.add(title);
  const center = new THREE.Vector3(table.x, bottom, table.z), sphere = new THREE.Sphere(center, Math.hypot(table.width, table.depth) / 2 + 1);
  const state = { selected: 'jiaoshan', touring: false, inRoom: false, updates: 0, elapsed: 0 };
  let sinceChange = 0, onChange = () => {};
  function labels() {
    const stop = WALL_STOPS.find(item => item.id === state.selected);
    context.clearRect(0, 0, 512, 128);
    context.fillStyle = 'rgba(6, 25, 31, .9)'; context.fillRect(0, 0, 512, 128);
    context.strokeStyle = '#619b9f'; context.strokeRect(1, 1, 510, 126);
    context.textAlign = 'center'; context.fillStyle = '#80d8d5'; context.font = '16px "Microsoft YaHei", sans-serif';
    context.fillText(t('秦皇岛长城全景  /  山 · 海 · 关', 'QINHUANGDAO  /  GREAT WALL ATLAS'), 256, 27);
    context.fillStyle = '#fff0ca'; context.font = 'bold 30px "Microsoft YaHei", sans-serif'; context.fillText(nameOf(stop), 256, 72, 480);
    context.fillStyle = '#b3dad6'; context.font = '15px "Microsoft YaHei", sans-serif';
    context.fillText(model.state.reference
      ? t('资料参考建模 · 代表性局部，非测绘复原 · 按 F 切换', 'REFERENCE STUDY · NOT A SURVEY · F TO CHANGE')
      : t('待补证 · 原艺术示意，非实景模型 · 按 F 切换', 'AWAITING EVIDENCE · ARTISTIC SCHEME · F TO CHANGE'), 256, 106, 480);
    texture.needsUpdate = true;
  }
  function select(id, manual = true) {
    if (!model.select(id)) return false;
    state.selected = id; if (manual) state.touring = false;
    sinceChange = 0; ring.position.copy(model.focus).add(model.root.position); labels(); onChange(); return true;
  }
  select(state.selected); root.visible = false;
  return {
    root, state, model, ring, scan, labels, select,
    onChange(callback) { onChange = callback; },
    tour(enabled) { state.touring = enabled && state.inRoom; sinceChange = 0; onChange(); },
    update(dt, camera, frustum, player, reducedMotion = false, hidden = document.hidden) {
      const room = QIN_WALL_ROOM;
      const inside = player.pos.x > room.x0 && player.pos.x < room.x1 && player.pos.z > room.z0 && player.pos.z < room.z1
        && player.y >= room.floor - 0.2 && player.y < room.floor + 1.8;
      if (inside !== state.inRoom) {
        state.inRoom = inside; state.touring = inside; sinceChange = 0; onChange();
      }
      const behindSlab = camera.position.y >= QIN_GALLERY.floor && camera.position.x >= QIN_GALLERY.x0 && camera.position.x < QIN_GALLERY.x1
        && camera.position.z >= QIN_GALLERY.z0 && camera.position.z < QIN_GALLERY.z1;
      root.visible = !behindSlab && camera.position.distanceToSquared(center) < 3600;
      if (!inside || hidden || !root.visible || !frustum.intersectsSphere(sphere) || reducedMotion) return;
      const step = Math.min(dt, 0.1); state.elapsed += step; state.updates++;
      scan.position.z = table.z + ((state.elapsed * 0.28 % 1) - 0.5) * (table.depth - 1);
      ring.rotation.z = state.elapsed * 0.3;
      if (!state.touring) return;
      sinceChange += step;
      if (sinceChange >= 7) select(WALL_STOPS[(WALL_STOPS.findIndex(stop => stop.id === state.selected) + 1) % WALL_STOPS.length].id, false);
    },
  };
}
