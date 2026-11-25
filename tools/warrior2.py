# Guerreiro novo (assets-src/warrior2/): corpo base sem equipamento em duas pranchas (body-move 4×8: parado, andar,
# correr, pular; body-combat 3×8: ataque, dano, morte) e os trajes (traje-*.png, 7×8 com as mesmas 7 fileiras),
# que caem dos chefes. Quadros 0-55 em todos: 0-7 parado, 8-15 andar, 16-23 correr, 24-31 pular, 32-39 ataque,
# 40-47 dano, 48-55 morte. A escala vem da distância dos pés à venda dos olhos no quadro parado (a mesma em todas as
# pranchas, com ou sem chapéu), e os pés ficam alinhados pela base de cada fileira.
import os

import numpy as np
from PIL import Image

import combat_cells as CC

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'assets-src', 'warrior2')
TRAJES = ['principe', 'nuvem', 'chifres', 'chama', 'palha', 'ovelha', 'pistoleiro']
ROWS = ['idle', 'walk', 'run', 'jump', 'atk', 'hurt', 'death']
FEET_TO_EYES = 26.0   # px no jogo (o boneco tem ~56 px de altura com o cabelo)


def _cells(path, rows):
    S = Image.open(path).convert('RGBA')
    cw, ch = S.size[0] / 8, S.size[1] / rows
    opaque = (np.asarray(S.getchannel('A')) == 0).mean() < 0.05
    out = []
    for r in range(rows):
        row = []
        for c in range(8):
            im = S.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
            if opaque:
                im = CC.cut_bg(im)   # fundo branco/desfocado: sai pelo degradê até o contorno
            row.append(CC.cut_alpha(im, min_px=150))
        out.append(row)
    return out


def _eyes(im):
    """Linha da venda dos olhos: a faixa quase preta mais larga na metade de cima do boneco."""
    a = np.asarray(im).astype(int)
    al = a[..., 3] > 0
    ys = np.nonzero(al.any(1))[0]
    y0, y1 = ys.min(), ys.max()
    dark = al & (a[..., :3].max(2) < 60)
    rng = range(y0, y0 + int((y1 - y0) * 0.6))
    by = max(rng, key=lambda y: dark[y].sum())
    return by, y1


# pés→venda em fração da altura da célula (mediana das pranchas). Se a medida de uma prancha foge muito disso
# (chapéu preto confundido com a venda), usa a mediana.
EYE_RATIO = 0.51


def _frames(rows):
    """Quadros (img, ax, ay) com âncora nos pés: escala pela venda, pés pela base da fileira."""
    ey, fy = _eyes(rows[0][0])
    d, ch = fy - ey, rows[0][0].size[1]
    if abs(d / ch - EYE_RATIO) > 0.1:
        d = EYE_RATIO * ch
    k = FEET_TO_EYES / d
    out = []
    for row in rows:
        ground = max(im.getchannel('A').getbbox()[3] for im in row if im.getchannel('A').getbbox())
        for im in row:
            bb = im.getchannel('A').getbbox()
            if not bb:
                out.append((Image.new('RGBA', (1, 1)), 0, 0)); continue
            crop = im.crop(bb)
            sm = crop.resize((max(1, round(crop.size[0] * k)), max(1, round(crop.size[1] * k))), Image.LANCZOS)
            out.append((sm, round((im.size[0] / 2 - bb[0]) * k), round((ground - bb[1]) * k)))
    return out


def load_body():
    move = _cells(os.path.join(DIR, 'body-move.png'), 4)
    combat = _cells(os.path.join(DIR, 'body-combat.png'), 3)
    # a escala de cada prancha pela venda do seu primeiro quadro (de pé)
    return _frames(move) + _frames(combat)


def load_trajes():
    return {t: _frames(_cells(os.path.join(DIR, f'traje-{t}.png'), 7)) for t in TRAJES}
