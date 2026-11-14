from pathlib import Path

from PIL import Image, ImageDraw


COLORS = {
    'hair': '#202931', 'hair_light': '#36424b', 'hair_dark': '#151d25',
    'skin': '#e9c8a6', 'skin_light': '#f2d5b6', 'skin_shadow': '#cfaa87',
    'eye': '#22343c', 'mouth': '#af7f6c', 'ivory': '#f0e8d7',
    'robe': '#527e8a', 'robe_light': '#6d98a1', 'robe_dark': '#3e6472',
    'fold': '#355662', 'ink': '#293e49', 'gold': '#bc9a62',
    'jade': '#a9cabb', 'jade_shadow': '#6f9f91', 'boot': '#2a343d',
    'boot_light': '#414e56', 'sole': '#6c746f',
}
image = Image.new('RGBA', (64, 64))
draw = ImageDraw.Draw(image)


def rectangle(left, top, width, height, color):
    draw.rectangle((left, top, left + width - 1, top + height - 1), fill=COLORS[color])


def pixel(left, top, color):
    draw.point((left, top), fill=COLORS[color])


def surface(left, top, width, height, color_at):
    for row in range(height):
        for column in range(width):
            pixel(left + column, top + row, color_at(column, row))


def cloth(column, row, face=0):
    if column == 0:
        return 'robe_dark'
    if column == 2 and row % 5 != 4:
        return 'robe_light'
    return 'robe_dark' if face in (0, 3) and column % 3 == 0 else 'robe'


surface(8, 0, 8, 8, lambda column, row: 'hair_light' if (column + row * 2) % 7 == 0 else 'hair')
rectangle(16, 0, 8, 8, 'skin_shadow')
face_palette = {'H': 'hair', 'h': 'hair_light', 'S': 'skin', 's': 'skin_light',
                'D': 'skin_shadow', 'B': 'hair_dark', 'W': 'ivory', 'E': 'eye', 'M': 'mouth'}
face_rows = ['HHhHHHHH', 'HhHSSShH', 'HSssssSH', 'SBBSsBBS',
             'SWESSEWS', 'SSSDDSSS', 'SSSMMSSS', 'DSSSSSSD']
for row, pattern in enumerate(face_rows):
    for column, shade in enumerate(pattern):
        pixel(8 + column, 8 + row, face_palette[shade])
for left in (0, 16):
    surface(left, 8, 8, 8, lambda column, row: 'hair' if row < 3 or column < 2 or column > 5 else 'skin_shadow' if row == 7 else 'skin')
    rectangle(left + (5 if left == 0 else 2), 12, 1, 2, 'skin_light')
surface(24, 8, 8, 8, lambda column, row: 'hair_light' if column in (2, 5) and row < 6 else 'hair')
rectangle(24, 10, 8, 1, 'robe_dark')
rectangle(27, 10, 2, 2, 'jade')
rectangle(27, 12, 1, 4, 'robe_light')
rectangle(29, 12, 1, 3, 'robe_dark')
rectangle(42, 1, 4, 5, 'hair_dark')
rectangle(43, 1, 2, 4, 'hair_light')
rectangle(40, 3, 8, 1, 'gold')
pixel(47, 3, 'jade')
rectangle(41, 8, 2, 1, 'hair')
pixel(42, 9, 'hair')
rectangle(58, 8, 4, 3, 'hair_dark')
rectangle(59, 9, 2, 1, 'robe_light')

surface(20, 16, 8, 4, lambda column, row: 'ivory' if column in (2, 5) else 'robe_dark')
rectangle(23, 17, 2, 2, 'skin_shadow')
rectangle(28, 16, 8, 4, 'robe_dark')
for face, (left, width) in enumerate(((16, 4), (20, 8), (28, 4), (32, 8))):
    surface(left, 20, width, 12, lambda column, row, side=face: cloth(column, row, side))
    rectangle(left, 28, width, 2, 'ink')
    rectangle(left, 29, width, 1, 'fold')
rectangle(23, 20, 2, 2, 'skin')
for column, row in ((1, 0), (2, 1), (2, 2), (3, 3), (4, 4), (5, 5), (5, 6), (5, 7)):
    pixel(20 + column, 20 + row, 'ivory')
    if column < 5:
        pixel(21 + column, 20 + row, 'ivory')
for column, row in ((6, 0), (5, 1), (4, 2), (3, 3)):
    pixel(20 + column, 20 + row, 'ivory')
rectangle(23, 28, 2, 2, 'gold')
pixel(24, 29, 'ink')
rectangle(26, 30, 1, 2, 'gold')
rectangle(21, 24, 1, 3, 'robe_dark')
pixel(22, 24, 'robe_light')
pixel(20, 25, 'robe_light')
rectangle(34, 20, 4, 1, 'ivory')
rectangle(35, 21, 2, 2, 'robe_dark')
rectangle(35, 26, 1, 2, 'robe_light')
rectangle(35, 30, 1, 2, 'ink')
rectangle(37, 30, 1, 2, 'fold')


def sleeve(left, top):
    surface(left + 4, top, 4, 4, lambda column, row: cloth(column, row))
    rectangle(left + 8, top, 4, 4, 'skin_shadow')
    for face in range(4):
        surface(left + face * 4, top + 4, 4, 12, lambda column, row, side=face:
                'skin_shadow' if row == 11 else 'skin' if row == 10 else 'ivory' if row == 9
                else 'ink' if row == 8 else cloth(column, row, side))
        pixel(left + face * 4 + 2, top + 14, 'skin_light')


def skirt(left, top, first):
    rectangle(left + 4, top, 4, 4, 'robe_dark')
    rectangle(left + 8, top, 4, 4, 'sole')
    for face in range(4):
        surface(left + face * 4, top + 4, 4, 12, lambda column, row, side=face:
                'sole' if row == 11 else 'boot' if row >= 9 else 'ivory' if row == 8
                else 'ink' if row == 7 else cloth(column, row, side))
        rectangle(left + face * 4 + 1, top + 13, 2, 1, 'boot_light')
    rectangle(left + (7 if first else 4), top + 4, 1, 7, 'fold')
    if not first:
        rectangle(left + 6, top + 4, 1, 1, 'gold')
        rectangle(left + 5, top + 5, 2, 2, 'jade')
        pixel(left + 6, top + 6, 'jade_shadow')
        rectangle(left + 6, top + 7, 1, 2, 'ivory')


sleeve(40, 16)
sleeve(32, 48)
skirt(0, 16, True)
skirt(16, 48, False)
output = Path(__file__).resolve().parents[1] / 'assets' / 'me.png'
image.save(output, optimize=True)
print(f'{output}: {output.stat().st_size} bytes, 64x64 RGBA, classic four-pixel arms')
