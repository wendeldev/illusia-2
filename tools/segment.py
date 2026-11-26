"""Recorta sprites de uma prancha: remove o fundo (cor uniforme conectada às bordas)
e separa os desenhos em componentes conectados. Gera uma prancha numerada para conferência.

uso: python3 tools/segment.py <prancha.png> <saida_dir> [--dark]
"""
import json
import sys
from collections import deque
from PIL import Image, ImageDraw

src, out = sys.argv[1], sys.argv[2]
dark = '--dark' in sys.argv
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()

def is_bg(c):
    r, g, b = c
    if dark:
        # fundo azul-marinho escuro da prancha de cenários
        return max(r, g, b) < 48 and b >= r and abs(r - 11) < 14 and abs(g - 20) < 14
    return min(r, g, b) > 228 and max(r, g, b) - min(r, g, b) < 18

# flood fill do fundo a partir das bordas
bg = bytearray(W * H)
q = deque()
for x in range(W):
    for y in (0, H - 1):
        q.append((x, y))
for y in range(H):
    for x in (0, W - 1):
        q.append((x, y))
while q:
    x, y = q.popleft()
    i = y * W + x
    if bg[i] or not is_bg(px[x, y]):
        continue
    bg[i] = 1
    if x > 0: q.append((x - 1, y))
    if x < W - 1: q.append((x + 1, y))
    if y > 0: q.append((x, y - 1))
    if y < H - 1: q.append((x, y + 1))

# componentes conectados do que não é fundo (8 vizinhos, com uma pequena "ponte" de 2px)
lab = [0] * (W * H)
comps = []
for sy in range(H):
    for sx in range(W):
        i = sy * W + sx
        if bg[i] or lab[i]:
            continue
        cid = len(comps) + 1
        x0 = x1 = sx; y0 = y1 = sy; n = 0
        dq = deque([(sx, sy)])
        lab[i] = cid
        while dq:
            x, y = dq.popleft()
            n += 1
            x0 = min(x0, x); x1 = max(x1, x); y0 = min(y0, y); y1 = max(y1, y)
            for dx in (-2, -1, 0, 1, 2):
                for dy in (-2, -1, 0, 1, 2):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < W and 0 <= ny < H:
                        j = ny * W + nx
                        if not bg[j] and not lab[j]:
                            lab[j] = cid
                            dq.append((nx, ny))
        comps.append({'id': cid, 'x': x0, 'y': y0, 'w': x1 - x0 + 1, 'h': y1 - y0 + 1, 'n': n})

comps = [c for c in comps if c['n'] > 30]
# ordena por linha (aprox.) e coluna
comps.sort(key=lambda c: (round((c['y'] + c['h'] / 2) / 40), c['x']))
for k, c in enumerate(comps):
    c['k'] = k

# imagem com transparência
rgba = im.convert('RGBA')
rp = rgba.load()
for y in range(H):
    for x in range(W):
        if bg[y * W + x]:
            rp[x, y] = (0, 0, 0, 0)
import os
os.makedirs(out, exist_ok=True)
rgba.save(os.path.join(out, 'cutout.png'))
json.dump(comps, open(os.path.join(out, 'comps.json'), 'w'))
# mapa de rótulos (id do componente codificado em RGB) para recortar só o desenho certo
labimg = Image.new('RGB', (W, H))
lp = labimg.load()
for y in range(H):
    for x in range(W):
        v = lab[y * W + x]
        if v:
            lp[x, y] = (v & 255, (v >> 8) & 255, 0)
labimg.save(os.path.join(out, 'labels-map.png'))

# prancha numerada
dbg = Image.new('RGB', (W, H), (40, 40, 48))
dbg.paste(rgba, (0, 0), rgba)
d = ImageDraw.Draw(dbg)
for c in comps:
    d.rectangle([c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h']], outline=(255, 0, 0))
    d.text((c['x'] + 1, c['y'] + 1), str(c['k']), fill=(255, 255, 0))
dbg.save(os.path.join(out, 'labels.png'))
print(len(comps), 'componentes')
