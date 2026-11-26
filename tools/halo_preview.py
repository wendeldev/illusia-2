#!/usr/bin/env python3
"""Prévia ampliada: cada halo (8 raridades) em cada classe → spritesheets/halo_check.png."""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_layered as BL  # noqa: E402

LAYERS = ['cape_lendario', 'body', 'face', 'hair', 'pants_lendario', 'boots_lendario', 'armor_lendario', 'gloves_lendario']
WEAPON = {'warrior': 'weapon_sword_lendario', 'assassin': 'weapon_dagger_lendario', 'mage': 'weapon_staff_lendario', 'archer': 'weapon_bow_lendario'}


def frame(cls, name, col=0, row=0):
    im = Image.open(os.path.join(BL.OUT, cls, name + '.png'))
    return im.crop((col * BL.CELL, row * BL.CELL, (col + 1) * BL.CELL, (row + 1) * BL.CELL))


def main():
    Z, cw, ch = 3, 84, 100
    classes = BL.RIG.CLASSES
    out = Image.new('RGBA', ((len(BL.RARITIES) + 1) * cw * Z, len(classes) * ch * Z), (24, 22, 34, 255))
    for r, cls in enumerate(classes):
        base = Image.new('RGBA', (BL.CELL, BL.CELL), (0, 0, 0, 0))
        for name in LAYERS + [WEAPON[cls]]:
            base.alpha_composite(frame(cls, name))
        for c, rar in enumerate([None] + BL.RARITIES):
            im = base.copy()
            if rar:
                im.alpha_composite(frame(cls, f'halo_{rar}'))
            im = im.crop((22, 14, 22 + cw, 14 + ch)).resize((cw * Z, ch * Z), Image.NEAREST)
            out.alpha_composite(im, (c * cw * Z, r * ch * Z))
    out.save(os.path.join(BL.OUT, 'halo_check.png'), optimize=True)


if __name__ == '__main__':
    main()
