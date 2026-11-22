# Corpo base novo de uma classe (assets-src/sheet-hero-white.png = Guerreiro; sheet-body-<classe>.png = as outras),
# 4×8 quadros no mesmo formato:
# linhas = parado, andar, correr, pular (com a retomada no fim). Reduzido para o tamanho do corpo base antigo
# (61 px de altura) e ancorado pelo chão de cada fileira, para as peças em camadas seguirem cada quadro.
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROWS = ['idle', 'walk', 'run', 'jump']
TARGET_H = {'warrior': 61, 'assassin': 53, 'mage': 46, 'archer': 47}  # altura do corpo antigo de cada classe


FILES = {'warrior': 'sheet-hero-white.png', 'mage': 'sheet-body-mage.png', 'assassin': 'sheet-body-assassin.png', 'archer': 'sheet-body-archer.png'}


def available():
    """Classes que já têm a prancha de corpo nova."""
    return [c for c, f in FILES.items() if os.path.exists(os.path.join(ROOT, 'assets-src', f))]


def load(cls='warrior'):
    S = Image.open(os.path.join(ROOT, 'assets-src', FILES[cls])).convert('RGBA')
    cols, rows = 8, 4
    cw, ch = S.size[0] / cols, S.size[1] / rows
    cells = []
    for r in range(rows):
        row = []
        for c in range(cols):
            im = S.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))
            px = im.load()
            for y in range(im.size[1]):
                for x in range(im.size[0]):
                    if px[x, y][3] < 200:   # halo cinza e sujeira semitransparente
                        px[x, y] = (0, 0, 0, 0)
            row.append(im)
        cells.append(row)
    ref = cells[0][0].getchannel('A').getbbox()
    k = TARGET_H[cls] / (ref[3] - ref[1])
    frames = []   # (imagem, ax, ay) com âncora nos pés (chão da fileira) e no centro da célula
    for r, row in enumerate(cells):
        ground = max(im.getchannel('A').getbbox()[3] for im in (row if ROWS[r] != 'jump' else [row[0], row[7]]))
        for c, im in enumerate(row):
            bb = im.getchannel('A').getbbox()
            g = bb[3] if ROWS[r] == 'jump' and 2 <= c <= 5 else ground   # no ar: pés = posição do corpo
            crop = im.crop(bb)
            sm = crop.resize((max(1, round(crop.size[0] * k)), max(1, round(crop.size[1] * k))), Image.LANCZOS)
            ax = (im.size[0] / 2 - bb[0]) * k
            ay = (g - bb[1]) * k
            frames.append((sm, round(ax), round(ay)))
    return frames
