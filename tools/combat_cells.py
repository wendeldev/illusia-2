# Animações de combate por raridade (assets-src/<classe>-combat/<raridade>.png): prancha 3×8 com
# fileiras ataque, dano e morte. Recorta cada célula tirando o fundo desfocado (preenchimento a partir
# das bordas que segue o degradê suave do fundo e para no contorno escuro do personagem).
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = ['atk', 'hurt', 'death']
STEP = 13       # diferença máxima entre vizinhos do fundo (degradê suave)
DARK = 70       # contorno do personagem (brilho máximo dos canais)


def path(cls, rar):
    return os.path.join(ROOT, 'assets-src', f'{cls}-combat', f'{rar}.png')


def available(cls):
    d = os.path.join(ROOT, 'assets-src', f'{cls}-combat')
    return sorted(f[:-4] for f in os.listdir(d) if f.endswith('.png')) if os.path.isdir(d) else []


def cut_bg(im):
    a = np.asarray(im.convert('RGB').filter(ImageFilter.MedianFilter(3)), dtype=np.int16)
    H, W, _ = a.shape
    bg = np.zeros((H, W), bool)
    mx = a.max(2)
    q = deque()
    for x in range(W):
        q.append((x, 0)); q.append((x, H - 1))
    for y in range(H):
        q.append((0, y)); q.append((W - 1, y))
    for x, y in q:
        bg[y, x] = True
    while q:
        x, y = q.popleft()
        c = a[y, x]
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not bg[ny, nx] and mx[ny, nx] > DARK:
                if int(np.abs(a[ny, nx] - c).sum()) <= STEP:
                    bg[ny, nx] = True
                    q.append((nx, ny))
    out = np.asarray(im.convert('RGBA')).copy()
    out[bg, 3] = 0
    # restos pequenos soltos (pontos de brilho do fundo)
    res = Image.fromarray(out)
    return res


def cells(cls, rar):
    S = Image.open(path(cls, rar)).convert('RGBA')
    cw, ch = S.size[0] / 8, S.size[1] / 3
    return [[cut_bg(S.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))) for c in range(8)]
            for r in range(3)]


def frames(cls, rar, idle):
    """24 quadros (ataque 0-7, dano 8-15, morte 16-23) na escala e nos pés do quadro parado do visual
    (`idle` = (imagem, ax, ay) do quadro 0 do visual da mesma raridade). Cada fileira começa parada,
    então a âncora de cada fileira vem do 1º quadro dela, alinhado ao quadro parado do visual."""
    im0, ax0, ay0 = idle
    out = []
    rows = cells(cls, rar)
    for row in rows:
        b0 = row[0].getchannel('A').getbbox()
        k = im0.size[1] / (b0[3] - b0[1])
        fx, fy = b0[0] + ax0 / k, b0[1] + ay0 / k     # pés na célula
        for im in row:
            bb = im.getchannel('A').getbbox()
            crop = im.crop(bb)
            sm = crop.resize((max(1, round(crop.size[0] * k)), max(1, round(crop.size[1] * k))), Image.LANCZOS)
            out.append((sm, round((fx - bb[0]) * k), round((fy - bb[1]) * k)))
    return out
