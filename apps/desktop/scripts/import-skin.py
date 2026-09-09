"""Decode the original WMZ bitmaps and their documented color-key transparency."""
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image
from io import BytesIO

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'assets' / 'skin'
target.mkdir(parents=True, exist_ok=True)
manifest = {}
with zipfile.ZipFile(source) as archive:
    for entry in archive.infolist():
        if '/' in entry.filename or not entry.filename.endswith('.bmp'):
            continue
        name = Path(entry.filename).stem
        image = Image.open(BytesIO(archive.read(entry))).convert('RGBA')
        keys = {(255, 0, 255)}
        if name == 'head':
            keys.add((255, 0, 0))
        if name == 'vid_bkgd':
            keys.add((255, 255, 255))
        image.putdata([(*pixel[:3], 0 if pixel[:3] in keys else 255) for pixel in image.getdata()])
        image.save(target / f'{name}.png')
        manifest[name] = {'width': image.width, 'height': image.height}
    for filename in ['play_controls_map.bmp', 'minimize_close_map.bmp']:
        image = Image.open(BytesIO(archive.read(filename))).convert('RGB')
        colors = [(255,0,51),(255,255,0),(0,255,0),(0,255,255),(0,0,255)] if filename.startswith('play') else [(255,0,204),(204,0,102)]
        print(filename)
        for color in colors:
            positions = [(x,y) for y in range(image.height) for x in range(image.width) if image.getpixel((x,y)) == color]
            print(color, (min(x for x,y in positions), min(y for x,y in positions), max(x for x,y in positions)+1, max(y for x,y in positions)+1))
(Path(__file__).resolve().parents[1] / 'src/skin-dimensions.json').write_text(json.dumps(manifest, indent=2) + '\n')
