"""Recorta os ícones da prancha assets-src/sheet-items.png.
Cada faixa (painel) é uma linha de ícones sobre fundo escuro; os ícones são separados
por colunas vazias e devolvidos em ordem, da esquerda para a direita."""
import os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-items.png')).convert('RGBA')

# painel: (x0, y0, x1, y1) da faixa de ícones (abaixo do título)
PANELS = {
    'coins': (30, 126, 805, 210), 'potions': (850, 126, 1525, 212),
    'chests': (22, 263, 690, 345), 'keys': (722, 263, 1100, 345), 'crystals': (1135, 263, 1525, 345),
    'quest': (22, 398, 625, 475), 'materials': (668, 398, 1525, 475),
    'buffs': (22, 532, 510, 610), 'orbs': (545, 532, 980, 610), 'cards': (1015, 532, 1525, 610),
    'food': (22, 664, 600, 735), 'tickets': (630, 664, 1030, 735), 'others': (1062, 664, 1525, 735),
    'drops': (22, 788, 1025, 862), 'souls': (1058, 788, 1525, 862),
    'status': (22, 920, 395, 1000), 'events': (430, 920, 990, 1000), 'evolution': (1020, 920, 1525, 1000),
}

COUNT = {'coins': 9, 'potions': 7, 'chests': 7, 'keys': 5, 'crystals': 6, 'quest': 7, 'materials': 11, 'buffs': 7,
         'orbs': 7, 'cards': 9, 'food': 9, 'tickets': 6, 'others': 7, 'drops': 16, 'souls': 8, 'status': 6, 'events': 8, 'evolution': 7}

def is_bg(c):
    r, g, b, a = c
    return max(r, g, b) < 58 and abs(r - b) < 40

def cut(box):
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
    return im

def icons(name):
    im = cut(PANELS[name])
    W, H = im.size
    px = im.load()
    occ = [sum(1 for y in range(H) if px[x, y][3] > 0) for x in range(W)]
    out, start, gap = [], None, 0
    for x in range(W):
        if occ[x] > 1:
            if start is None:
                start = x
            gap, end = 0, x
        elif start is not None:
            gap += 1
            if gap >= 3:
                out.append((start, end)); start = None
    if start is not None:
        out.append((start, end))
    out = [(a, b) for a, b in out if b - a >= 6]
    want = COUNT[name]
    # divide o grupo mais largo no ponto mais vazio até ter o número certo de ícones
    while len(out) < want:
        k = max(range(len(out)), key=lambda i: out[i][1] - out[i][0])
        a, b = out[k]
        w = b - a
        cx = min(range(a + int(w * 0.3), a + int(w * 0.7) + 1), key=lambda x: occ[x])
        out[k:k + 1] = [(a, cx), (cx + 1, b)]
    # junta os pares mais próximos se sobrou pedaço
    while len(out) > want:
        k = min(range(len(out) - 1), key=lambda i: (out[i + 1][0] - out[i][1], (out[i][1] - out[i][0]) + (out[i + 1][1] - out[i + 1][0])))
        out[k:k + 2] = [(out[k][0], out[k + 1][1])]
    res = []
    for a, b in out:
        c = im.crop((a, 0, b + 1, H))
        bb = c.getbbox()
        if bb and bb[3] - bb[1] >= 16:
            res.append(c.crop(bb))
    return res

def load():
    return {k: icons(k) for k in PANELS}

if __name__ == '__main__':
    import sys
    d = load()
    sh = Image.new('RGB', (1200, 70 * len(d)), (60, 64, 80))
    for r, (k, ims) in enumerate(d.items()):
        x = 0
        for im in ims:
            sh.paste(im, (x, r * 70 + 4), im)
            x += im.size[0] + 8
        print(k, len(ims), [im.size for im in ims])
    sh.save(sys.argv[1])
