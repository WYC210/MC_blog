import argparse
import json
import shutil
import zipfile
from pathlib import Path

from PIL import Image, ImageStat


ROOT = Path(__file__).resolve().parent.parent
PACK_VERSION = 'r250-v1'
TILE_SIZE = 256
TILES = [
    ('sand', ['sand'], 'original', 0.91),
    ('stone', ['stone'], 'original', 0.87),
    ('deepslate', ['deepslate'], 'original', 0.87),
    ('dirt', ['dirt'], 'original', 0.98),
    ('gravel', ['gravel'], 'original', 0.87),
    ('grass_block_top', ['grass_top'], 'grass', 0.98),
    ('oak_planks', ['oak', 'wood_floor', 'wood_panel', 'deck'], 'original', 0.73),
    ('dark_oak_planks', ['walnut'], 'original', 0.73),
    ('birch_planks', ['maple'], 'original', 0.73),
    ('oak_log', ['log'], 'original', 0.84),
    ('oak_log_top', ['log_top'], 'original', 0.87),
    ('white_concrete', ['concrete'], 'original', 0.91),
    ('terracotta', ['terracotta'], 'original', 0.88),
    ('white_wool', ['linen', 'velvet', 'chair_mesh', 'surface_cloth'], 'neutral', 0.97),
    ('oak_planks', ['surface_wood'], 'neutral', 0.73),
    ('stripped_oak_log', ['surface_timber'], 'neutral', 0.84),
    ('oak_log_top', ['surface_endgrain'], 'neutral', 0.87),
    ('stone', ['surface_stone'], 'neutral', 0.87),
    ('smooth_stone', ['surface_smooth'], 'neutral', 0.48),
    ('sandstone', ['surface_sandstone'], 'neutral', 0.87),
    ('white_concrete', ['surface_concrete'], 'neutral', 0.91),
    ('terracotta', ['surface_terracotta'], 'neutral', 0.88),
    ('quartz_block_side', ['surface_quartz'], 'neutral', 0.48),
]


def read_image(path):
    with Image.open(path) as source:
        if source.size != (TILE_SIZE, TILE_SIZE):
            raise ValueError(f'Expected {TILE_SIZE}x{TILE_SIZE}: {path}')
        return source.convert('RGBA').convert('RGB')


def color_image(image, mode):
    if mode == 'original':
        return image
    gray = image.convert('L')
    average = max(1, ImageStat.Stat(gray).mean[0])
    tone = (112, 152, 68) if mode == 'grass' else (242, 242, 242)
    channels = [gray.point(lambda value: round(min(255, value * channel / average))) for channel in tone]
    return Image.merge('RGB', channels)


def detail_image(source, name, roughness):
    normal = read_image(source / f'{name}_n.png')
    specular = read_image(source / f'{name}_s.png').convert('L')
    average = ImageStat.Stat(specular).mean[0]
    rough = specular.point(lambda value: round(255 * min(1, max(0.45, roughness * (1 + (average - value) / 255 * 0.6)))))
    normal_channels = normal.split()
    return Image.merge('RGB', (normal_channels[0], normal_channels[1], rough))


def main():
    parser = argparse.ArgumentParser(description='Extract the opt-in Homecraft HD textures without Minecraft models.')
    parser.add_argument('source', nargs='?', type=Path, default=ROOT / 'Ruidskin-Ultimate-256x-R250')
    args = parser.parse_args()
    source = args.source.resolve()
    blocks = source / 'assets' / 'minecraft' / 'textures' / 'block'
    destination = ROOT / 'assets' / 'ruidskin' / PACK_VERSION
    required = [source / 'LICENSE.txt']
    for name in dict.fromkeys(tile[0] for tile in TILES):
        required.extend(blocks / f'{name}{suffix}.png' for suffix in ('', '_n', '_s'))
    for path in required:
        if not path.is_file():
            raise FileNotFoundError(path)
    destination.mkdir(parents=True, exist_ok=True)
    entries = []
    details = set()
    for name, targets, mode, roughness in TILES:
        filename = f'{name}-{mode}.png'
        color_image(read_image(blocks / f'{name}.png'), mode).save(destination / filename, optimize=True)
        detail = f'{name}-detail.png'
        if detail not in details:
            detail_image(blocks, name, roughness).save(destination / detail, optimize=True)
            details.add(detail)
        entries.append({'targets': targets, 'color': filename, 'detail': detail})
    manifest = {'version': 1, 'pack': f'Ruidskin Ultimate 256x {PACK_VERSION}', 'size': TILE_SIZE, 'tiles': entries}
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(source / 'LICENSE.txt', destination / 'LICENSE.txt')
    with zipfile.ZipFile(destination / 'source.zip', 'w', compression=zipfile.ZIP_DEFLATED) as archive:
        for path in dict.fromkeys(required + [source / 'pack.mcmeta']):
            archive.write(path, path.relative_to(source).as_posix())
        archive.write(Path(__file__), 'prepare-ruidskin.py')
    files = [path for path in destination.iterdir() if path.is_file()]
    print(f'Prepared {len(entries)} tile mappings, {len(files)} files, {sum(path.stat().st_size for path in files):,} bytes in {destination}')


if __name__ == '__main__':
    main()
