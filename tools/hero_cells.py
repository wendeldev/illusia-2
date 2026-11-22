# Novo personagem (prancha assets-src/sheet-hero-b.png, 8×8 quadros de ~157 px):
# linhas 0-3 sem armadura (parado, andar, correr, pular) e 4-7 com armadura, botas, luvas e asas.
# Cada quadro: recorte pelo desenho, âncora nos pés (linha do chão de cada fileira), ponto da mão da frente
# (para a arma) e caixa da cabeça (para o halo).
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ANIMS = ['idle', 'walk', 'run', 'jump']
SCALE = 0.72   # reduz um pouco a prancha (o jogo desenha o personagem com ~56 px de altura)


def load():
    S = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-hero-b.png')).convert('RGBA')
    n = 8
    cw = S.size[0] / n
    out = {}
    for row in range(8):
        variant = 'bare' if row < 4 else 'armor'
        anim = ANIMS[row % 4]
        cells = []
        for col in range(n):
            box = (round(col * cw), round(row * cw), round((col + 1) * cw), round((row + 1) * cw))
            im = S.crop(box)
            # alfa fraco = sujeira em volta; a cor dos pixels transparentes é zerada
            px = im.load()
            for y in range(im.size[1]):
                for x in range(im.size[0]):
                    r, g, b, a = px[x, y]
                    px[x, y] = (r, g, b, a) if a >= 48 else (0, 0, 0, 0)
            cells.append(im)
        # linha do chão da fileira: o pé mais baixo dos quadros parados no chão (o 1º quadro)
        ground = max(c.getchannel('A').getbbox()[3] for c in (cells if anim != 'jump' else cells[:1]))
        cx = cw / 2
        frames = []
        H0 = cells[0].getchannel('A').getbbox()
        H0 = H0[3] - H0[1]
        for im in cells:
            bb = im.getchannel('A').getbbox()
            crop = im.crop(bb)
            w, h = crop.size
            sm = crop.resize((max(1, round(w * SCALE)), max(1, round(h * SCALE))), Image.LANCZOS)
            ax = (cx - bb[0]) * SCALE
            ay = (ground - bb[1]) * SCALE
            a = crop.getchannel('A')
            px = a.load()
            # cabeça: largura da parte de cima (25% da altura do quadro parado)
            top = 0
            hh = int(h * 0.3)
            xs = [x for y in range(hh) for x in range(w) if px[x, y] > 100]
            head = [min(xs), 0, max(xs)] if xs else [0, 0, w]
            # mão da frente: ponto mais à direita na faixa do meio do corpo (os punhos ficam ali)
            # medida a partir dos pés (a altura de pé H0 vale também para os quadros agachados)
            band = range(max(0, int(h - H0 * 0.48)), max(1, int(h - H0 * 0.28)))
            best = (0, int(h * 0.55))
            for y in band:
                row_x = [x for x in range(w) if px[x, y] > 100]
                if row_x and max(row_x) > best[0]:
                    best = (max(row_x), y)
            hand = [best[0] - 4, best[1]]
            rel = lambda x, y: [round(x * SCALE - ax, 1), round(y * SCALE - ay, 1)]
            frames.append({
                'im': sm, 'ax': round(ax, 1), 'ay': round(ay, 1),
                'head': rel(head[0], top) + [round(head[2] * SCALE - ax, 1)],
                'hand': rel(*hand), 'h': round(h * SCALE, 1),
            })
        out[f'{variant}_{anim}'] = frames
    return out
