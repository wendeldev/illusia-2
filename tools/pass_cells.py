# Ícones do passe de batalha (assets-src/sheet-pass.png, 1536×1024): recorta o desenho de cada recompensa
# e tira o fundo escuro do painel (preenchimento a partir das bordas pelos tons escuros).
import os
from collections import deque

import numpy as np
from PIL import Image

import combat_cells as CC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROW0, ROW_H = 85, 71.4


def _row(col, k):
    x0, x1 = (44, 182) if col == 0 else (402, 545)
    y = ROW0 + k * ROW_H
    return (x0, round(y) + 5, x1, round(y + 58))


# nome: caixa na prancha
ICONS = {
    'cons': _row(0, 0), 'xp': _row(1, 0), 'mats': _row(1, 4), 'chest': _row(1, 5), 'tickets': _row(1, 6),
    'ring': _row(1, 8), 'amulet': _row(0, 9), 'skull': _row(1, 9), 'wings_blue': _row(0, 10),
    'fire_boots': _row(1, 10), 'fire_armor': _row(0, 11), 'bow_black': _row(1, 11), 'staff_white': _row(0, 12),
    'swords_neon': _row(1, 12),
    'horns': (790, 322, 990, 505), 'wings_black': (1148, 322, 1352, 505),
    'cow_boots': (790, 540, 975, 722), 'cow_suit': (1165, 536, 1340, 722),
    'bow_green': (790, 748, 978, 945), 'swords_green': (1150, 748, 1325, 945),
}


def cut(im, dark=50):
    a = np.asarray(im.convert('RGBA')).copy()
    H, W, _ = a.shape
    mx = a[..., :3].max(2)
    bg = np.zeros((H, W), bool)
    q = deque([(x, 0) for x in range(W)] + [(x, H - 1) for x in range(W)] + [(0, y) for y in range(H)] + [(W - 1, y) for y in range(H)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= W or y >= H or bg[y, x] or mx[y, x] > dark:
            continue
        bg[y, x] = True
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    a[bg, 3] = 0
    im = CC.cut_alpha(Image.fromarray(a), min_px=40)
    return im.crop(im.getchannel('A').getbbox())


def load():
    S = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-pass.png')).convert('RGBA')
    return {n: cut(S.crop(b)) for n, b in ICONS.items()}


def ICONS_IMG():
    """Recortes crus (sem tirar o fundo) de cada ícone."""
    S = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-pass.png')).convert('RGBA')
    return {n: S.crop(b) for n, b in ICONS.items()}
