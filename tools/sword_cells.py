# Espadas do Guerreiro (assets-src/sheet-swords.png): 5 espadas (linhas) × 8 ângulos (colunas), células 32×32.
# Usa a 1ª coluna (lâmina para cima e para a esquerda) espelhada: cabo embaixo à esquerda e lâmina para cima à
# direita, como o jogo espera (ele gira a arma). Linhas = Comum, Incomum, Raro, Épico, Lendário; Mítico, Divino e
# Celestial são a Lendária recolorida.
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = ['comum', 'incomum', 'raro', 'epico', 'lendario']
CELL = 32


def load():
    S = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-swords.png')).convert('RGBA')
    out = {}
    for r, rar in enumerate(ROWS):
        im = S.crop((0, r * CELL, CELL, (r + 1) * CELL)).transpose(Image.FLIP_LEFT_RIGHT)
        out[rar] = im.crop(im.getchannel('A').getbbox())
    # espada Incomum desenhada à parte (em pé, cabo embaixo): inclina 45° para a direita e reduz ao tamanho das outras
    inc = os.path.join(ROOT, 'assets-src', 'sword-incomum.png')
    if os.path.exists(inc):
        im = Image.open(inc).convert('RGBA')
        im = im.crop(im.getchannel('A').getbbox())
        k = 34 / im.size[1]
        im = im.resize((max(1, round(im.size[0] * k)), 34), Image.LANCZOS)
        im = im.rotate(-45, resample=Image.BICUBIC, expand=True)
        a = im.getchannel('A').point(lambda v: 255 if v > 110 else 0)
        im.putalpha(a)
        out['incomum'] = im.crop(im.getchannel('A').getbbox())
    return out
