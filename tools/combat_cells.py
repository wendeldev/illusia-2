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


def cells(cls, rar):
    S = Image.open(path(cls, rar)).convert('RGBA')
    # com transparência de verdade (fundo vazio) recorta pelo alfa; senão, pelo degradê do fundo
    transparent = (np.asarray(S.getchannel('A')) == 0).mean() > 0.1
    cut = cut_alpha if transparent else cut_bg
    cw, ch = S.size[0] / 8, S.size[1] / 3
    return [[cut(S.crop((round(c * cw), round(r * ch), round((c + 1) * cw), round((r + 1) * ch)))) for c in range(8)]
            for r in range(3)]


def frames(cls, rar, look_cell, k, anchor):
    """24 quadros (ataque 0-7, dano 8-15, morte 16-23) na escala e nos pés do visual da mesma raridade.
    `look_cell` = quadro parado do visual em tamanho original, `k` = escala dele no jogo e `anchor` = pés
    (x, y) na célula. Medido pelo corpo sem o halo, em tamanho original (reduzido, o halo encosta no cabelo)."""
    bl, fl = _body(look_cell)
    hl = bl[3] - bl[1]
    out = []
    for row in cells(cls, rar):
        bc, fc = _body(row[0])
        r = (bc[3] - bc[1]) / hl                 # px da prancha de combate por px do visual
        kc = k / r
        fy = bc[3] - (bl[3] - anchor[1]) * r
        fx = fc + (anchor[0] - fl) * r
        for im in row:
            bb = im.getchannel('A').getbbox()
            crop = im.crop(bb)
            sm = crop.resize((max(1, round(crop.size[0] * kc)), max(1, round(crop.size[1] * kc))), Image.LANCZOS)
            out.append((sm, round((fx - bb[0]) * kc), round((fy - bb[1]) * kc)))
    return out


def _body(im):
    """Corpo do quadro sem o halo solto: todas as partes, menos as que ficam inteiras acima do topo da
    maior parte (o halo). Devolve (bbox, centro dos pés)."""
    a = np.asarray(im.getchannel('A')) > 0
    H, W = a.shape
    lab = np.zeros((H, W), np.int32)
    comps = []
    for y0, x0 in zip(*np.nonzero(a)):
        if lab[y0, x0]:
            continue
        lab[y0, x0] = len(comps) + 1
        st, ys, xs = [(y0, x0)], [], []
        while st:
            y, x = st.pop()
            ys.append(y); xs.append(x)
            for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                if 0 <= ny < H and 0 <= nx < W and a[ny, nx] and not lab[ny, nx]:
                    lab[ny, nx] = len(comps) + 1
                    st.append((ny, nx))
        comps.append((np.array(ys), np.array(xs)))
    if not comps:
        return None
    big = max(comps, key=lambda c: len(c[0]))
    top = big[0].min()
    keep = [c for c in comps if c[0].max() > top + 3]
    ys = np.concatenate([c[0] for c in keep]); xs = np.concatenate([c[1] for c in keep])
    y0, y1 = ys.min(), ys.max() + 1
    band = xs[ys >= y1 - max(4, (y1 - y0) // 14)]
    return (xs.min(), y0, xs.max() + 1, y1), (band.min() + band.max() + 1) / 2


def frames_on_body(cls, body_idle):
    """Classe sem visual vestido (Guerreiro): quadros de combate de cada raridade na escala do corpo base
    (`body_idle` = (imagem, ax, ay) do quadro parado), com os pés no mesmo lugar. A escala é a mesma em
    todas as raridades: altura mediana do corpo parado (sem o halo solto) igual à do corpo base."""
    im0, ax0, ay0 = body_idle
    bb0, feet0 = _body(im0)
    dfx = feet0 - ax0                      # pés em relação à âncora, px do corpo base
    sheets = {rar: cells(cls, rar) for rar in available(cls)}
    hs = sorted(_body(rows[0][0])[0][3] - _body(rows[0][0])[0][1] for rows in sheets.values())
    k = (bb0[3] - bb0[1]) / hs[len(hs) // 2]
    out = {}
    for rar, rows in sheets.items():
        fr = []
        for row in rows:
            bb, feet = _body(row[0])
            fx, fy = feet - dfx / k, bb[3]
            for im in row:
                b = im.getchannel('A').getbbox()
                crop = im.crop(b)
                sm = crop.resize((max(1, round(crop.size[0] * k)), max(1, round(crop.size[1] * k))), Image.LANCZOS)
                fr.append((sm, round((fx - b[0]) * k), round((fy - b[1]) * k)))
        out[rar] = fr
    return out
