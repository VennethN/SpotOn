"""Cuts the shots from shoot.mjs into the deck's crops and the poster's pictures.

Every size here is the size of the picture it replaces, so the deck's placeholders and
the poster's figures take the new picture without moving. Coordinates are CSS pixels on
a shot taken at twice the density. Needs Pillow.
"""
import os
from PIL import Image, ImageDraw, ImageOps

here = os.path.dirname(os.path.abspath(__file__))
S = os.path.join(here, 'shots')
C = os.path.join(here, 'crops')
P = os.path.join(here, 'poster', 'img')
os.makedirs(C, exist_ok=True)

def rounded(im, r):
    """Transparent rounded corners, as the deck's pictures have."""
    im = im.convert('RGBA')
    mask = Image.new('L', im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, im.width - 1, im.height - 1], radius=r, fill=255)
    im.putalpha(mask)
    return im

def at2(im, x, y, w, h):
    return im.crop((round(x * 2), round(y * 2), round((x + w) * 2), round((y + h) * 2)))

rank = Image.open(os.path.join(S, 'app-rank.png'))                    # 3200 x 1800
rounded(rank, 36).save(os.path.join(C, 'app-rank-r.png'))
rank.convert('RGB').resize((2400, 1350), Image.LANCZOS).save(os.path.join(P, 'light-app-rank-coffee.jpg'), quality=90)
rounded(at2(rank, 700, 40, 900, 730), 44).save(os.path.join(C, 'ask-r.png'))   # 1800 x 1460
rank.crop((1700, 120, 3200, 1337)).convert('RGB').save(os.path.join(P, 'ask.jpg'), quality=90)  # 1500 x 1217

card = Image.open(os.path.join(S, 'card.png'))
rounded(ImageOps.fit(card, (684, 990), Image.LANCZOS, centering=(0, 0)), 44).save(os.path.join(C, 'area-breakdown-r.png'))
why = Image.open(os.path.join(S, 'why.png'))
rounded(ImageOps.fit(why, (748, 1670), Image.LANCZOS, centering=(0.5, 0)), 44).save(os.path.join(C, 'why-r.png'))

raised = Image.open(os.path.join(S, 'map-3d.png'))                    # 3840 x 2160
piece = at2(raised, 400, 100, 970, 760)                                # 1940 x 1520
rounded(piece, 44).save(os.path.join(C, 'map-3d-r.png'))
piece.convert('RGB').save(os.path.join(C, 'map-3d.png'))
at2(raised, 420, 120, 900, 705).convert('RGB').save(os.path.join(P, 'map-3d.jpg'), quality=90)  # 1800 x 1410

for d in (C, P):
    for f in sorted(os.listdir(d)):
        im = Image.open(os.path.join(d, f)); print(os.path.relpath(os.path.join(d, f), here), im.size, im.mode)
