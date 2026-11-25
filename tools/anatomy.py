# Anatomia de um corpo base (cabeça, pescoço, quadril, pés, mãos) para vestir as peças em camadas.

def anatomy(im):
    W, H = im.size
    px = im.load()
    op = lambda x, y: px[x, y][3] > 40
    def shorts(c):
        r, g, b, a = c
        # calção/saia: azul ou roxo, verde ou rosa/magenta
        return a > 40 and ((b > r + 15 and b > g + 5) or (g > r + 10 and g > b + 10) or (r > 100 and r > g + 50 and b > g + 15)
                         or (40 < r < 115 and g < 75 and b < 105 and b > g + 8 and r > g + 12 and abs(r - b) < 40))   # roxo escuro (Assassino)
    sx = [x for y in range(int(H * 0.5), H) for x in range(W) if shorts(px[x, y])]
    sy = [y for y in range(int(H * 0.5), H) for x in range(W) if shorts(px[x, y])]
    # só as linhas com calção de verdade (3+ pixels), no maior bloco contínuo (sombras soltas ficam de fora)
    from collections import Counter as _C
    cnt = _C(sy)
    rows_ = sorted(y for y, n in cnt.items() if n >= 3)
    if rows_ and max(sy) - min(sy) > H * 0.2:   # só quando sombras soltas esticam a caixa
        runs, cur = [], [rows_[0]]
        for y in rows_[1:]:
            if y - cur[-1] <= 2: cur.append(y)
            else: runs.append(cur); cur = [y]
        runs.append(cur)
        best = max(runs, key=lambda r: sum(cnt[y] for y in r))
        y0_, y1_ = best[0], best[-1]
        pts = [(x, y) for x, y in zip(sx, sy) if y0_ <= y <= y1_]
        sx, sy = [p[0] for p in pts], [p[1] for p in pts]
    if len(sx) < 5:
        # calça sem cor marcada (Guerreiro novo, calça escura): faixa de 55% a 70% da altura
        ys_ = [y for y in range(int(H * 0.55), int(H * 0.7)) for x in range(W) if op(x, y)]
        xs_ = [x for y in range(int(H * 0.55), int(H * 0.7)) for x in range(W) if op(x, y)]
        sx, sy = (xs_, ys_) if xs_ else ([0, W - 1], [int(H * 0.55), int(H * 0.7)])
    hips = (min(sx), min(sy), max(sx), max(sy))
    # pés: últimas linhas
    fy0 = H - max(3, H // 12)
    fx = [x for y in range(fy0, H) for x in range(W) if op(x, y)]
    feet = (min(fx), fy0, max(fx), H - 1)
    # largura por linha
    rows = []
    for y in range(H):
        xs = [x for x in range(W) if op(x, y)]
        rows.append((min(xs), max(xs)) if xs else None)
    # pescoço: linha mais estreita entre 30% e topo do quadril
    lo, hi = int(H * 0.3), hips[1] - 3
    neck = min(range(lo, hi), key=lambda y: (rows[y][1] - rows[y][0]) if rows[y] else 999)
    # regata clara (Maga): o tronco começa no topo dela — o cabelo comprido engana a busca pelo pescoço
    light = [y for y in range(int(H * 0.35), hips[1]) for x in range(W)
             if px[x, y][3] > 40 and min(px[x, y][:3]) > 195 and max(px[x, y][:3]) - min(px[x, y][:3]) < 45]
    if len(light) >= 6:
        neck = max(neck, min(light) - 1)
    # mãos: extremos entre o pescoço e o fim do quadril
    band = [rows[y] for y in range(neck + 2, hips[3] + 1) if rows[y]]
    hand_l = min(b[0] for b in band); hand_r = max(b[1] for b in band)
    # cabelo comprido para os lados não conta como braço: limita à largura do quadril
    hwid = hips[2] - hips[0]
    hand_l = max(hand_l, int(hips[0] - hwid * 0.9)); hand_r = min(hand_r, int(hips[2] + hwid * 0.9))
    # cabeça: do topo ao pescoço
    hx = [x for y in range(0, neck) for x in range(W) if op(x, y)]
    head = (min(hx), 0, max(hx), neck)
    # rosto: pixels de pele na cabeça (para o elmo)
    def skin(c):
        r, g, b, a = c
        return a > 40 and r > 170 and g > 110 and b < 140 and r > b + 50
    fy = [y for y in range(0, neck) for x in range(W) if skin(px[x, y])]
    face_top = min(fy) if fy else neck // 2
    hand_y = max(range(neck + 2, hips[3] + 1), key=lambda y: (rows[y][1] if rows[y] else 0))
    return dict(W=W, H=H, head=head, face_top=face_top, neck=neck, hips=hips, feet=feet, hands=(hand_l, hand_r), hand_y=hand_y)

