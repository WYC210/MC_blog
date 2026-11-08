# Ocean appearance

The optional `OCEAN` export in `world/layout.js` enables the first-stage ocean appearance. Worlds without this export retain the original flat pool surface.

```js
export const OCEAN = { waveHeight: 0.12, shoreFoam: 0.65 };
```

- `waveHeight` sets the base displacement amplitude in metres, clamped to 0–0.15. Wind modifies it, while nearby land and the player reduce it. This is not peak-to-trough wave height.
- `shoreFoam` controls the strength of the moving shoreline foam, clamped to 0–1. Set it to zero to disable foam.
- Mean water level remains `POOL.water`. There is no tidal cycle, beach flooding, terrain change, or change to swimming and vehicle collision rules in this stage.

## Rendering

`engine/world/ocean.js` bakes coastal distance, seabed depth and open-sea connectivity from the voxel grid once at startup. Land at sea level produces a shoreline; overhead bridges do not. Enclosed ponds do not receive ocean displacement or foam. The generated map is not downloaded and is not rebuilt each frame.

The existing water mesh remains a single draw call. At low camera heights its grid concentrates vertices near the camera: 1,568 triangles on desktop and 800 on mobile. Displacement fades between 12 and 36 metres above or below mean water level. At 36 metres, or with reduced motion enabled, the same mesh uses a two-triangle surface. Beyond 100 metres horizontally the displaced water returns to mean level. The outer water boundary stays at the existing sea level.

Water colour combines baked depth, distance from shore and viewing angle; it is an artistic near-shore colour transition, not a physical bathymetric simulation. Foam uses the same material and introduces no extra render passes, lights or reflection targets. Fine rain rings are skipped when their screen-space detail is too small to resolve.

The player and nearby shoreline have calm displacement zones to preserve existing swimming, boarding and fishing behavior. Wave-driven buoyancy for swimmers and floating objects, dynamic underwater thresholds, and tide-driven navigation are deferred to the next stage.

## Checks

Start the preview server, then run:

```sh
npm run check:ocean
npm run check:beach
npm run check:jet-ski
npm run check
```

Ocean screenshots and measurements are written to `tools/.check/`. Checks cover desktop/mobile geometry, shore data, weather changes, high viewpoints, underwater rendering, reduced motion and the unmodified showcase pool. Software-rendered frame times are not phone performance measurements; check actual mobile scrolling, camera movement and swimming before publishing.
