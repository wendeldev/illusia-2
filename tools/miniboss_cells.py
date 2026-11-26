"""Recorta os chefes básicos/intermediários de assets-src/sheet-minibosses.png.
Cada chefe ocupa uma linha com 8 células (parado, andar, ataque 1/2/3, habilidade, dano, morte)."""
import os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-minibosses.png')).convert('RGBA')
ANIMS = ['idle', 'walk', 'atk1', 'atk2', 'atk3', 'special', 'hit', 'death']
LEFT = ['troll', 'wolf_alpha', 'stone_golem', 'spider', 'plant']
RIGHT = ['minotaur', 'orc', 'serpent', 'fallen_knight', 'dark_mage']
ROWS = [(212, 318), (380, 486), (550, 652), (712, 808), (872, 982)]
COLS_L = [181, 245, 318, 397, 477, 553, 633, 697, 752]
COLS_R = [953, 1020, 1092, 1168, 1243, 1320, 1405, 1468, 1521]

def is_bg(c):
    return max(c[:3]) < 48

def cell(box):
    im = SHEET.crop(box).copy()
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    dq = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while dq:
        x, y = dq.popleft()
        i = y * W + x
        if seen[i] or not is_bg(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                dq.append((nx, ny))
    # mantém só a maior mancha e as próximas dela (tira restos das células vizinhas e linhas)
    lab = [0] * (W * H)
    comps = []
    for sy in range(H):
        for sx in range(W):
            if lab[sy * W + sx] or px[sx, sy][3] == 0:
                continue
            cid = len(comps) + 1
            dq = deque([(sx, sy)]); lab[sy * W + sx] = cid
            pts = []
            while dq:
                x, y = dq.popleft(); pts.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and not lab[ny * W + nx] and px[nx, ny][3] > 0:
                            lab[ny * W + nx] = cid; dq.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            comps.append((len(pts), min(xs), max(xs), min(ys), max(ys), pts))
    if not comps:
        return None
    good = [c for c in comps if not ((c[2] - c[1]) <= 5 and (c[4] - c[3]) > 3 * (c[2] - c[1] + 1))]
    big = max(good or comps, key=lambda c: c[0])
    keep = set()
    for c in comps:
        n, x0, x1, y0, y1, pts = c
        w, h = x1 - x0 + 1, y1 - y0 + 1
        thin = h <= 4 or w <= 6 and h > w * 3 or n < 0.12 * w * h
        near = x1 >= big[1] - 14 and x0 <= big[2] + 14 and y1 >= big[3] - 14 and y0 <= big[4] + 14
        if c is big or (near and not thin and n >= 4):
            keep.update(pts)
    for y in range(H):
        for x in range(W):
            if (x, y) not in keep:
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    return im.crop(bb) if bb else None

def load():
    out = {}
    for names, cols in ((LEFT, COLS_L), (RIGHT, COLS_R)):
        for name, (y0, y1) in zip(names, ROWS):
            out[name] = {a: cell((cols[i], y0, cols[i + 1], y1)) for i, a in enumerate(ANIMS)}
    return out

if __name__ == '__main__':
    import sys
    d = load()
    sh = Image.new('RGB', (900, 10 * 100), (60, 64, 80))
    for r, (n, an) in enumerate(d.items()):
        x = 0
        for a, im in an.items():
            if im is not None:
                sh.paste(im, (x, r * 100 + 4), im)
                x += im.size[0] + 10
        print(n, {a: (im.size if im else None) for a, im in an.items()})
    sh.save(sys.argv[1])
