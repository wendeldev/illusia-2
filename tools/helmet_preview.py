#!/usr/bin/env python3
"""Prévia ampliada de cada capacete equipado em cada classe (spritesheets/helmet_check/)."""
import os
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_layered as BL  # noqa: E402
import helmet_fit as HF  # noqa: E402

SETS = ['warrior', 'assassin', 'mage', 'archer']
OUT = os.path.join(BL.OUT, 'helmet_check')


def compose(B, fi, helm_name, mark=False):
    """Cabeça + capacete num quadro do corpo, com o cabelo cortado pela borda do capacete."""
    a = B.anat[fi]
    body, hair, face = B.parts[fi]
    skin = body.copy(); skin.alpha_composite(face)
    m = HF.head_marks(B.frames[fi], a, B.neck0, skin)
    W, H = B.frames[fi].size
    pad = 20
    cv = Image.new('RGBA', (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    if helm_name:
        img = BL.sprite(helm_name)
        info = HF.helmet_info(img)
        kind = HF.kind_of(helm_name)
        box = HF.fit(info, m, kind)
        side, pts = HF.hair_cut(info, box, kind)
        # máscara do cabelo: some acima do corte
        hm = hair.copy(); hp = hm.load()
        xs = [p[0] for p in pts]
        for y in range(H):
            for x in range(W):
                if not hp[x, y][3]:
                    continue
                if xs and xs[0] - 1 <= x <= xs[-1] + 1:
                    j = min(range(len(pts)), key=lambda k: abs(pts[k][0] - x))
                    lim = pts[j][1]
                else:
                    lim = side
                if y < lim:
                    hp[x, y] = (0, 0, 0, 0)
        cv.alpha_composite(hm, (pad, pad))
        cv.alpha_composite(skin, (pad, pad))
        w, h = round(box[2] - box[0]), round(box[3] - box[1])
        hi = img.resize((max(1, w), max(1, h)), Image.NEAREST)
        cv.alpha_composite(hi, (pad + round(box[0]), pad + round(box[1])))
    else:
        cv.alpha_composite(B.frames[fi], (pad, pad))
    if mark:
        d = ImageDraw.Draw(cv)
        d.line((pad, pad + m['brow'], pad + W, pad + m['brow']), fill=(0, 255, 0, 200))
        d.line((pad + m['fl'], pad + m['eye'], pad + m['fr'], pad + m['eye']), fill=(255, 0, 0, 200))
    return cv


def main():
    os.makedirs(OUT, exist_ok=True)
    Z = 4
    for cls in BL.RIG.CLASSES:
        B = BL.Body(cls)
        tiles = []
        for sc in SETS:
            row = [compose(B, 0, None)] + [compose(B, 0, f'gs_{sc}_{r}_helmet') for r in BL.RARITIES]
            tiles.append(row)
        tw = max(t.size[0] for r in tiles for t in r); th = max(t.size[1] for r in tiles for t in r)
        crop_h = int(th * 0.62)
        sheet = Image.new('RGBA', (tw * 9 * Z, crop_h * 4 * Z), (34, 38, 56, 255))
        for r, row in enumerate(tiles):
            for c, t in enumerate(row):
                t = t.crop((0, 0, tw, crop_h)).resize((tw * Z, crop_h * Z), Image.NEAREST)
                sheet.alpha_composite(t, (c * tw * Z, r * crop_h * Z))
        sheet.save(os.path.join(OUT, f'{cls}.png'))
        print(cls)


if __name__ == '__main__':
    main()
