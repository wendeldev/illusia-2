# Recorte do fundo das pranchas de personagem: fundo desfocado (cut_bg: preenchimento a partir das bordas
# que segue o degradê suave e para no contorno escuro) ou transparente com sujeira (cut_alpha).
import os
from collections import deque

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STEP = 13       # diferença máxima entre vizinhos do fundo (degradê suave)
DARK = 70       # contorno do personagem (brilho máximo dos canais)


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
    res = Image.fromarray(out).copy()
    return res


def cut_alpha(im, min_px=80):
    """Prancha já com transparência: fica só o que é opaco, sem os pontinhos soltos do brilho do fundo."""
    a = np.asarray(im).copy()
    m = a[..., 3] >= 200
    H, W = m.shape
    seen = np.zeros((H, W), bool)
    keep = np.zeros((H, W), bool)
    for y0, x0 in zip(*np.nonzero(m)):
        if seen[y0, x0]:
            continue
        seen[y0, x0] = True
        st, comp = [(y0, x0)], []
        while st:
            y, x = st.pop()
            comp.append((y, x))
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and m[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    st.append((ny, nx))
        if len(comp) >= min_px:
            ys, xs = zip(*comp)
            keep[list(ys), list(xs)] = True
    a[~keep] = 0
    a[keep, 3] = 255
    return Image.fromarray(a).copy()
