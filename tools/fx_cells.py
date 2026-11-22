# Efeitos dos poderes (assets-src/fx-<classe>.png): 8 linhas (um poder cada) × 6 quadros.
# O fundo colorido da prancha é só cor em pixels transparentes: fica de fora.
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKILLS = {
    'warrior': ['w_slash_h', 'w_slash_v', 'w_dash', 'w_whirl', 'w_shock', 'w_flame', 'w_quake', 'w_shield'],
    'mage': ['m_fireball', 'm_fireburst', 'm_icespear', 'm_icestorm', 'm_arcane', 'm_meteor', 'm_circle', 'm_heal'],
    'assassin': ['a_quick', 'a_blades', 'a_teleport', 'a_thrust', 'a_shadowburst', 'a_daggers', 'a_poison', 'a_clone'],
    'archer': ['r_wind', 'r_triple', 'r_pierce', 'r_rain', 'r_explode', 'r_ice', 'r_poison', 'r_eagle'],
}


def bands(S):
    """As 8 faixas (linhas) de efeitos da prancha, achadas pelas linhas vazias entre elas."""
    a = S.getchannel('A').point(lambda v: 255 if v > 90 else 0)
    W, H = a.size
    px = a.load()
    out, start = [], None
    for y in range(H):
        busy = sum(1 for x in range(0, W, 2) if px[x, y]) > 3
        if busy and start is None:
            start = y
        elif not busy and start is not None:
            if y - start > 8:
                out.append((start, y))
            start = None
    if start is not None:
        out.append((start, H))
    assert len(out) == 8, out
    return out


def load():
    out = {}
    for cls, ids in SKILLS.items():
        S = Image.open(os.path.join(ROOT, 'assets-src', f'fx-{cls}.png')).convert('RGBA')
        cw = S.size[0] / 6
        for r, sid in enumerate(ids):
            y0, y1 = bands(S)[r]
            frames = []
            for c in range(6):
                im = S.crop((round(c * cw), max(0, y0 - 4), round((c + 1) * cw), min(S.size[1], y1 + 4)))
                a = im.getchannel('A').point(lambda v: 0 if v < 40 else v)
                im.putalpha(a)
                px = im.load()
                for y in range(im.size[1]):
                    for x in range(im.size[0]):
                        if px[x, y][3] == 0:
                            px[x, y] = (0, 0, 0, 0)
                frames.append(im)
            # mesmo recorte para os 6 quadros (o efeito cresce sem pular de lugar)
            boxes = [f.getchannel('A').point(lambda v: 255 if v > 90 else 0).getbbox() for f in frames]
            boxes = [b for b in boxes if b]
            box = (min(b[0] for b in boxes), min(b[1] for b in boxes), max(b[2] for b in boxes), max(b[3] for b in boxes))
            out[sid] = [f.crop(box) for f in frames]
    return out
