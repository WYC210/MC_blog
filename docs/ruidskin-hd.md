# Ruidskin HD materials

The Ruidskin Ultimate 256x pack is loaded only when a visitor opts into Ultra.
Normal mode never imports `world/hd-materials.js` or requests files under
`assets/ruidskin/r250-v1/`. The Ultra loader fetches a compact manifest and only
the deduplicated color/detail tiles that map to materials used by this world.
Other Minecraft models and pack textures are not shipped.

## Prepare or update the selected tiles

Keep the source pack at `Ruidskin-Ultimate-256x-R250/`. On Windows, install the
one-time image conversion dependency and run:

```powershell
py -m pip install -r tools/requirements-materials.txt
py tools/prepare-ruidskin.py
```

The preparation script checks every selected source image, normal map, and
specular map, generates small per-tile arrays, and copies the license and a
compressed copy of the source assets used by the conversion. The generated
files are served from the normal site `assets/` directory and are included in
the existing static build/deploy flow. The source pack and its original ZIP
are excluded from the Vercel deployment.

The 256× diffuse textures replace matching block layers. Grass is tinted from
the pack's grayscale grass tile; existing paletted block surfaces are converted
to neutral grayscale to preserve their authored color tint. The source normal
maps provide tangent-space normal XY; its specular map is conservatively
converted into per-material roughness. The current ultra material shader uses
derivative normals, so the HD tangent normals are added after them. Unmapped
layers keep their existing textures.

The generated resource path contains the pack revision. If the tiles change,
bump `PACK_VERSION` in `tools/prepare-ruidskin.py` and `ROOT` in
`world/hd-materials.js` together so versioned CDN/browser caching cannot serve
old files.

## License and attribution

The upstream pack is credited in `pack.mcmeta` to LingLing1301. Preserve the
upstream `LICENSE.txt`, `pack.mcmeta`, and source image assets used to create
the converted textures when redistributing those textures. The preparation
script includes a compressed copy of those source inputs and its own conversion
script in `assets/ruidskin/r250-v1/source.zip`; review those files and the
upstream licensing terms before publishing.

## Fallback and memory

If the manifest, any selected image, image decoder, or GPU texture limit fails,
the Ultra page retains the existing Homecraft textures and exposes the failure
in `world.hdMaterials.status` and the browser console. This opt-in feature
uses separate color and normal/roughness texture arrays; its reported memory
estimate covers mipmapped GPU texture data, not temporary image-decode memory.
