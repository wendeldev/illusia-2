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
                'body': body_marks(sm, ax, ay, H0 * SCALE),
                'im': sm, 'ax': round(ax, 1), 'ay': round(ay, 1),
                'head': rel(head[0], top) + [round(head[2] * SCALE - ax, 1)],
                'hand': rel(*hand), 'h': round(h * SCALE, 1),
            })
        out[f'{variant}_{anim}'] = frames
    return out


def body_marks(im, ax, ay, Hs):
    """Pontos do corpo num quadro (px relativos à âncora/pés), para vestir as peças:
    pescoço, quadril, fim do calção, pés (cada pé), mãos e largura do tronco.
    A cabeça tem tamanho fixo (46% da altura de pé); o tronco também; as pernas ocupam o resto."""
    a = im.getchannel('A')
    px = a.load()
    W, H = im.size
    bb = a.getbbox()
    top, bottom = bb[1], bb[3]
    op = lambda x, y: px[x, y] > 110
    neck = top + 0.46 * Hs
    hip = neck + 0.2 * Hs
    if hip > bottom - 0.12 * Hs:          # agachado/encolhido: o quadril sobe junto
        hip = bottom - 0.12 * Hs
        neck = min(neck, hip - 0.16 * Hs)
    shorts = hip + 0.38 * (bottom - hip)
    def span(y0, y1):
        xs = [x for y in range(max(0, int(y0)), min(H, int(y1) + 1)) for x in range(W) if op(x, y)]
        return (min(xs), max(xs)) if xs else (W * 0.3, W * 0.7)
    # tronco: miolo das linhas entre o pescoço e o quadril (sem os braços: mediana das larguras)
    rows = []
    for y in range(int(neck + 2), int(hip)):
        xs = [x for x in range(W) if op(x, y)]
        if xs:
            rows.append((min(xs), max(xs)))
    if rows:
        ws = sorted(r[1] - r[0] for r in rows)
        tw = ws[len(ws) // 3]
        cx = sorted((r[0] + r[1]) / 2 for r in rows)[len(rows) // 2]
    else:
        tw, cx = W * 0.4, W / 2
    tw = min(tw, Hs * 0.34)
    hx0, hx1 = span(hip, hip + 0.06 * Hs)
    hx0, hx1 = max(hx0, cx - tw * 0.62), min(hx1, cx + tw * 0.62)
    # pés: grupos de pixels nas últimas linhas
    fy0 = bottom - 0.1 * Hs
    cols = sorted({x for y in range(int(fy0), bottom) for x in range(W) if op(x, y)})
    groups = []
    for x in cols:
        if groups and x - groups[-1][1] <= 3:
            groups[-1][1] = x
        else:
            groups.append([x, x])
    groups = [g for g in groups if g[1] - g[0] >= 3] or [[cols[0], cols[-1]]] if cols else [[W * 0.3, W * 0.7]]
    if len(groups) == 1:
        g0, g1 = groups[0]
        groups = [[g0, (g0 + g1) / 2], [(g0 + g1) / 2, g1]] if g1 - g0 > Hs * 0.22 else [[g0, g1]]
    groups = sorted(groups, key=lambda g: g[1] - g[0], reverse=True)[:2]
    groups.sort()
    # mão de trás: ponto mais à esquerda na faixa dos punhos
    hb = (W, int(hip))
    for y in range(int(neck + 0.06 * Hs), int(hip + 0.1 * Hs)):
        xs = [x for x in range(W) if op(x, y)]
        if xs and min(xs) < hb[0] - 1:
            hb = (min(xs), y)
    X = lambda v: round(v - ax, 1)
    Y = lambda v: round(v - ay, 1)
    return {'neck': Y(neck), 'hip': Y(hip), 'shorts': Y(shorts), 'bottom': Y(bottom), 'fy0': Y(fy0),
            'cx': X(cx), 'tw': round(tw, 1), 'hips': [X(hx0), X(hx1)], 'feet': [[X(g[0]), X(g[1])] for g in groups],
            'handB': [X(hb[0] + 2), Y(hb[1])]}
