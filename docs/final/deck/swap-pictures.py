"""Puts the crops into the deck as built, picture for picture, without rebuilding it.

build.cjs is the source of the layout. This replaces only the ordinary pictures inside
../SpotOn_Pitch_Deck.pptx, each keyed by the slide it is on and its size in pixels, so
the text, the notes and every position stay exactly as they are. A crop must be the
same size as the picture it replaces, which crops.py guarantees.
"""
import io, os, re, zipfile
from PIL import Image

here = os.path.dirname(os.path.abspath(__file__))
deck = os.path.join(here, '..', 'SpotOn_Pitch_Deck.pptx')
crops = os.path.join(here, '..', 'crops')
WANT = {
    (3, 1800, 1460): 'ask-r.png',
    (5, 3200, 1800): 'app-rank-r.png',
    (6, 1940, 1520): 'map-3d-r.png',
    (6, 684, 990): 'area-breakdown-r.png',
    (7, 748, 1670): 'why-r.png',
    (8, 1940, 1520): 'map-3d.png',
}

zin = zipfile.ZipFile(deck)
on_slide = {}
for n in zin.namelist():
    m = re.match(r'ppt/slides/_rels/slide(\d+)\.xml\.rels', n)
    if m:
        for t in re.findall(r'Target="\.\./media/([^"]+)"', zin.read(n).decode()):
            on_slide['ppt/media/' + t] = int(m.group(1))
swap = {}
for n, slide in on_slide.items():
    im = Image.open(io.BytesIO(zin.read(n)))
    key = (slide, *im.size)
    if key in WANT:
        swap[n] = WANT[key]
missing = set(WANT.values()) - set(swap.values())
assert not missing, f'no picture in the deck matches {sorted(missing)}'

fresh = deck + '.new'
with zipfile.ZipFile(fresh, 'w', zipfile.ZIP_DEFLATED) as zout:
    for item in zin.infolist():
        data = zin.read(item.filename)
        if item.filename in swap:
            path = os.path.join(crops, swap[item.filename])
            new = Image.open(path)
            old = Image.open(io.BytesIO(data))
            assert new.size == old.size, f'{swap[item.filename]} is {new.size}, the deck holds {old.size}'
            data = open(path, 'rb').read()
            print(f'slide {on_slide[item.filename]}: {item.filename} <- {swap[item.filename]} {new.size}')
        zout.writestr(item, data)
zin.close()
os.replace(fresh, deck)
print('written', os.path.relpath(deck, here))
