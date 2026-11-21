# Encaixe do capacete na cabeça (layered sprites).
#
# Cada capacete é medido individualmente (sem escala fixa): contorno, abertura do rosto (o vão entre as
# laterais/bochechas do capacete) e o contorno de baixo, coluna a coluna. Cada quadro do corpo também é
# medido: linha dos olhos, testa, laterais do rosto (onde ficariam as orelhas), centro do rosto e topo do crânio.
#
# Regra do encaixe:
#  - capacete com abertura: a abertura tem a largura do rosto e começa na testa; o capacete cobre o topo, as
#    laterais e a testa; o rosto aparece pela abertura;
#  - capacete sem abertura (gorro, coroa, chapéu): a borda de baixo fica na testa e a largura é a do crânio;
#  - o cabelo fica embaixo do capacete e é cortado acima da borda do capacete (não atravessa o capacete).
# O mesmo cálculo roda no jogo (src/game/art/layers.ts) a partir de src/data/helmets.json.
import colorsys
from collections import deque


def _alpha(im):
    px = im.load()
    W, H = im.size
    return [[px[x, y][3] > 60 for x in range(W)] for y in range(H)]


def helmet_info(im):
    """Medidas do capacete em px do desenho: bbox, abertura do rosto e contorno de baixo por coluna."""
    W, H = im.size
    A = _alpha(im)
    xs = [x for y in range(H) for x in range(W) if A[y][x]]
    ys = [y for y in range(H) for x in range(W) if A[y][x]]
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    # vão interno: pixel transparente com capacete à esquerda E à direita na mesma linha (só na parte de baixo)
    gap = [[False] * W for _ in range(H)]
    for y in range(y0 + (y1 - y0) // 4, y1 + 1):
        row = A[y]
        if not any(row):
            continue
        l = row.index(True)
        r = W - 1 - row[::-1].index(True)
        for x in range(l + 1, r):
            gap[y][x] = not row[x]
    # maior região conectada do vão = abertura do rosto
    seen = [[False] * W for _ in range(H)]
    best = []
    for y in range(H):
        for x in range(W):
            if gap[y][x] and not seen[y][x]:
                comp, q = [], deque([(x, y)])
                seen[y][x] = True
                while q:
                    cx, cy = q.popleft()
                    comp.append((cx, cy))
                    for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                        if 0 <= nx < W and 0 <= ny < H and gap[ny][nx] and not seen[ny][nx]:
                            seen[ny][nx] = True
                            q.append((nx, ny))
                if len(comp) > len(best):
                    best = comp
    opening = None
    if len(best) >= max(6, (x1 - x0) * (y1 - y0) * 0.04):
        ox = [p[0] for p in best]
        oy = [p[1] for p in best]
        ow = max(ox) - min(ox) + 1
        if ow >= (x1 - x0) * 0.25:
            # largura útil da abertura: a mediana das larguras por linha (ignora pontas estreitas)
            rows = {}
            for px_, py_ in best:
                rows.setdefault(py_, []).append(px_)
            widths = sorted(max(v) - min(v) + 1 for v in rows.values())
            opening = [min(ox), min(oy), max(ox) + 1, max(oy) + 1, widths[len(widths) // 2]]
    # contorno de baixo: para cada coluna, a linha mais baixa com capacete
    bottom = []
    for x in range(W):
        col = [y for y in range(H) if A[y][x]]
        bottom.append(max(col) + 1 if col else -1)
    rimW = rimCx = None
    if opening:
        ys_ = sorted({p[1] for p in best})[:4]
        xs_ = [p[0] for p in best if p[1] in ys_]
        rimW = max(xs_) - min(xs_) + 1
        rimCx = (max(xs_) + min(xs_) + 1) / 2
        # a abertura larga logo abaixo da borda (vão do rosto): maior largura nas linhas de cima até a metade
        half = [p for p in best if p[1] <= opening[1] + (opening[3] - opening[1]) * 0.5]
        if half:
            hx = [p[0] for p in half]
            rimW = max(rimW, max(hx) - min(hx) + 1)
            rimCx = (max(hx) + min(hx) + 1) / 2
    return {'w': W, 'h': H, 'box': [x0, y0, x1 + 1, y1 + 1], 'open': opening, 'bottom': bottom, 'rimW': rimW, 'rimCx': rimCx}


def _v(c):
    return max(c[:3]) / 255


def head_marks(im, an, neck0, skin):
    """Pontos da cabeça num quadro do corpo (px do quadro)."""
    px = im.load()
    sk = skin.load()
    hx0, _, hx1, _ = an['head']
    # olhos: linha com mais pixels escuros na frente do rosto
    span = range(hx0 + int((hx1 - hx0) * 0.35), hx1 - 2)
    best, eye = -1, int(neck0 * 0.62)
    for y in range(int(neck0 * 0.5), neck0 - 2):
        n = sum(1 for x in span if px[x, y][3] > 40 and _v(px[x, y]) < 0.42)
        if n > best:
            best, eye = n, y
    # laterais do rosto: extremos da pele entre os olhos e o queixo
    xs = [x for y in range(eye - 1, neck0 - 1) for x in range(im.size[0]) if sk[x, y][3] > 40]
    fl, fr = (min(xs), max(xs) + 1) if xs else (hx0 + 4, hx1 - 2)
    face_w = fr - fl
    brow = eye - max(2, round((neck0 - eye) * 0.35))
    # topo do crânio (sem o cabelo): proporção chibi — o crânio tem ~1,15× a altura do rosto acima da testa
    skull_top = brow - round((neck0 - brow) * 0.95)
    return {'eye': eye, 'brow': brow, 'fl': fl, 'fr': fr, 'fw': face_w, 'cx': (fl + fr) / 2,
            'top': skull_top, 'chin': neck0, 'skullW': round(face_w * 1.3, 1)}


# Tipo de cada capacete da prancha (revisado um a um):
#  open   = aberto na frente (abertura em U): a abertura tem a largura do rosto e começa na testa
#  closed = fechado com viseira: cobre o rosto até o queixo (os olhos aparecem pelas frestas)
#  cap    = gorro/elmo curto: cobre o topo e a testa, borda nas sobrancelhas
#  hat    = chapéu: mais largo, aba na testa
RAR = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino', 'celestial']
KIND = {
    'warrior': ['open', 'open', 'open', 'open', 'open', 'open', 'closed', 'closed'],
    'assassin': ['cap', 'cap', 'cap', 'open', 'cap', 'open', 'open', 'open'],
    'mage': ['cap', 'hat', 'hat', 'hat', 'hat', 'hat', 'cap', 'cap'],
    'archer': ['open', 'closed', 'open', 'open', 'open', 'open', 'closed', 'closed'],
}


def kind_of(name):
    """gs_<set>_<raridade>_helmet → tipo."""
    parts = name.split('_')
    try:
        return KIND[parts[1]][RAR.index(parts[2])]
    except (KeyError, ValueError, IndexError):
        return 'cap'


def opening_rim(info, im=None):
    """Abertura em U medida na linha da testa: topo e largura do vão logo abaixo da borda do capacete."""
    op = info['open']
    return op


def fit(info, m, kind='open'):
    """Caixa (x0, y0, x1, y1) do capacete no quadro do corpo, em px do quadro."""
    W, H = info['w'], info['h']
    bx0, by0, bx1, by1 = info['box']
    bw, bh = bx1 - bx0, by1 - by0
    op = info['open']
    sk = m['skullW']
    if kind == 'open' and op and op[3] - op[1] >= bh * 0.25:
        ox0, oy0, ox1, oy1, _ = op
        rim = info.get('rimW') or (ox1 - ox0)
        # a abertura (na altura da testa) tem a largura do rosto; o capacete fica entre 1,05× e 1,3× o crânio
        s = m['fw'] * 1.05 / rim
        s = max(sk * 1.05 / bw, min(sk * 1.3 / bw, s))
        cx = (info.get('rimCx') or (ox0 + ox1) / 2)
        x0 = m['cx'] - cx * s
        y0 = (m['brow'] - 2) - oy0 * s
    elif kind == 'closed':
        s = sk * 1.22 / bw
        x0 = m['cx'] - (bx0 + bw / 2) * s
        y0 = (m['chin'] + 2) - by1 * s
    else:
        k = 1.35 if kind == 'hat' else 1.12
        s = sk * k / bw
        cx = m['cx'] - m['fw'] * (0.08 if kind == 'hat' else 0.12)
        x0 = cx - (bx0 + bw / 2) * s
        # borda principal (não a ponta mais baixa das abas): mediana do contorno de baixo no miolo
        mid = [b for b in info['bottom'][bx0 + bw // 4: bx1 - bw // 4] if b > 0]
        rim = sorted(mid)[len(mid) // 2] if mid else by1
        y0 = (m['brow'] + (2 if kind == 'hat' else 1)) - rim * s
    return [round(x0, 2), round(y0, 2), round(x0 + W * s, 2), round(y0 + H * s, 2)]


def hair_cut(info, box, kind='open'):
    """Linha de corte do cabelo (px do quadro): o cabelo acima dela fica escondido pelo capacete.
    Devolve [y_lados, [(x, y_borda), ...]] — dentro da largura do capacete, o corte segue a borda de baixo."""
    x0, y0, x1, y1 = box
    s = (x1 - x0) / info['w']
    bx0, by0, bx1, by1 = info['box']
    pts = []
    for x in range(bx0, bx1, max(1, (bx1 - bx0) // 12)):
        b = info['bottom'][x]
        if b > 0:
            # dentro da abertura do rosto o cabelo (franja) aparece só até a borda de cima da abertura
            op = info['open'] if kind == 'open' else None
            if op and op[0] <= x < op[2]:
                b = op[1] + 1
            pts.append((round(x0 + (x + 0.5) * s, 1), round(y0 + b * s - 1, 1)))
    mid = [b for b in info['bottom'][bx0 + (bx1 - bx0) // 4: bx1 - (bx1 - bx0) // 4] if b > 0]
    rim = sorted(mid)[len(mid) // 2] if mid else by1
    side = round(y0 + min(rim, by0 + (by1 - by0) * 0.55) * s, 1)
    return [side, pts]
