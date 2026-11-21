"""Recorta as pranchas novas: chefes míticos (animações), mapas (panoramas),
inimigos dos mapas (1 desenho cada) e as peças em camadas (equipamentos por raridade)."""
import os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def sheet(n):
    return Image.open(os.path.join(ROOT, 'assets-src', f'sheet-{n}.png')).convert('RGBA')

def cutout(im, box, is_bg, tol=None, cap=120, seed_self=False):
    """Remove o fundo ligado às bordas. Com `tol`, também 'escorre' por cores parecidas (fundos com degradê)."""
    im = im.crop(box).copy()
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    dq = deque((x, y, None) for x in range(W) for y in (0, H - 1))
    dq.extend((x, y, None) for y in range(H) for x in (0, W - 1))
    while dq:
        x, y, prev = dq.popleft()
        i = y * W + x
        if seen[i]:
            continue
        c = px[x, y]
        if prev is None and seed_self:
            prev = c
        ok = is_bg(c) or (tol is not None and prev is not None and max(c[:3]) < cap and sum(abs(c[k] - prev[k]) for k in range(3)) < tol)
        if not ok:
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                dq.append((nx, ny, c))
    return im

def comps(im, min_px=40):
    W, H = im.size
    px = im.load()
    lab = bytearray(W * H)
    out = []
    for sy in range(H):
        for sx in range(W):
            if lab[sy * W + sx] or px[sx, sy][3] == 0:
                continue
            dq = deque([(sx, sy)]); lab[sy * W + sx] = 1; pts = []
            while dq:
                x, y = dq.popleft(); pts.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and not lab[ny * W + nx] and px[nx, ny][3] > 0:
                            lab[ny * W + nx] = 1; dq.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            w, h = max(xs) - min(xs) + 1, max(ys) - min(ys) + 1
            if len(pts) < min_px or w <= 3 or h <= 3:
                continue
            # linhas de moldura: muito finas e longas
            if (h <= 5 and w > 30) or (w <= 5 and h > 30):
                continue
            # cantos de moldura em L: quase vazios por dentro
            if len(pts) < 0.07 * w * h and (w > 25 or h > 25):
                continue
            out.append({'x0': min(xs), 'x1': max(xs), 'y0': min(ys), 'y1': max(ys), 'pts': pts})
    return out

def render(im, cs):
    src = im.load()
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    op = out.load()
    for c in cs:
        for x, y in c['pts']:
            op[x, y] = src[x, y]
    bb = out.getbbox()
    return out.crop(bb) if bb else None

def frames_in(im, n, min_px=40):
    """Divide a faixa em n quadros pelos maiores vãos verticais entre manchas."""
    cs = comps(im, min_px)
    if not cs:
        return []
    W = im.size[0]
    occ = [0] * W
    for c in cs:
        for x, _ in c['pts']:
            occ[x] += 1
    xs = [x for x in range(W) if occ[x]]
    a, b = xs[0], xs[-1]
    cuts = []
    for k in range(1, n):
        target = a + (b - a) * k / n
        lo, hi = int(target - (b - a) / (2.6 * n)), int(target + (b - a) / (2.6 * n))
        cut = min(range(max(a, lo), min(b, hi) + 1), key=lambda x: (occ[x], abs(x - target)))
        cuts.append(cut)
    edges = [a - 1] + cuts + [b + 1]
    res = []
    for i in range(n):
        lo, hi = edges[i], edges[i + 1]
        part = [c for c in cs if lo < (c['x0'] + c['x1']) / 2 <= hi]
        img = render(im, part)
        if img is not None:
            res.append(img)
    return res

# ── chefes míticos ──
MBOSSES = ['infernal_dragon', 'lich_king', 'crystal_titan', 'valkyrie', 'abyss_demon', 'deep_hydra', 'fallen_archangel']
MB_ROWS = [(111, 196), (238, 326), (366, 453), (494, 581), (621, 708), (750, 836), (878, 965)]
# coluna: (x0, x1, nº de quadros)
MB_COLS = [('idle', 316, 470, 2), ('walk', 470, 645, 3), ('atk1', 645, 830, 3), ('atk2', 830, 1046, 3), ('atk3', 1046, 1260, 3), ('hit', 1260, 1406, 2), ('death', 1406, 1532, 1)]
def dark(c):
    return max(c[:3]) < 40

def load_bosses():
    S = sheet('mythic-bosses')
    out = {}
    for name, (y0, y1) in zip(MBOSSES, MB_ROWS):
        an = {}
        for k, x0, x1, n in MB_COLS:
            im = cutout(S, (x0 + 3, y0, x1 - 3, y1), dark, tol=26)
            an[k] = frames_in(im, n)
        out[name] = an
    return out

# ── mapas: panoramas inteiros ──
MAP_ROWS = [(82, 196), (210, 326), (339, 455), (466, 582), (593, 710), (720, 836), (848, 964)]
def load_maps():
    S = sheet('mythic-maps')
    return {name: S.crop((314, y0, 1530, y1)) for name, (y0, y1) in zip(MBOSSES, MAP_ROWS)}

# ── inimigos: 7 por mapa, 1 desenho cada ──
EN_ROWS = [(90, 178), (218, 310), (348, 440), (478, 568), (606, 696), (736, 826), (866, 958)]
EN_X = [380, 545, 685, 850, 1015, 1180, 1340, 1535]
def load_enemies():
    S = sheet('mythic-enemies')
    out = {}
    for name, (y0, y1) in zip(MBOSSES, EN_ROWS):
        lst = []
        for i in range(7):
            im = cutout(S, (EN_X[i] + 4, y0 + 2, EN_X[i + 1] - 4, y1 - 2), dark, tol=22, cap=256, seed_self=True)
            cs = comps(im, 60)
            if not cs:
                lst.append(None); continue
            big = max(cs, key=lambda c: len(c['pts']))
            keep = [c for c in cs if c is big or (c['x1'] >= big['x0'] - 6 and c['x0'] <= big['x1'] + 6 and c['y1'] >= big['y0'] - 6 and c['y0'] <= big['y1'] + 6)]
            lst.append(render(im, keep))
        out[name] = lst
    return out

if __name__ == '__main__':
    import sys
    outdir = sys.argv[1]
    b = load_bosses()
    sh = Image.new('RGB', (2000, 7 * 110), (60, 64, 80))
    for r, (n, an) in enumerate(b.items()):
        x = 0
        for k, fr in an.items():
            for f in fr:
                sh.paste(f, (x, r * 110 + 4), f); x += f.size[0] + 3
            x += 16
        print(n, {k: len(v) for k, v in an.items()})
    sh.save(os.path.join(outdir, 'mb.png'))
    e = load_enemies()
    sh = Image.new('RGB', (1100, 7 * 100), (60, 64, 80))
    for r, (n, lst) in enumerate(e.items()):
        x = 0
        for f in lst:
            if f is not None:
                sh.paste(f, (x, r * 100 + 4), f); x += f.size[0] + 8
    sh.save(os.path.join(outdir, 'me.png'))

# ── peças em camadas ──
RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino']

def grid_cells(S, box, cols, rows, min_px=25):
    """Recorta cada célula da grade separadamente (as linhas da grade isolam o fundo)."""
    out = {}
    for ri in range(len(rows) - 1):
        for ci in range(len(cols) - 1):
            b = (int(cols[ci]) + 5, int(rows[ri]) + 4, int(cols[ci + 1]) - 5, int(rows[ri + 1]) - 4)
            im = cutout(S, b, dark, tol=22, cap=90)
            px = im.load()
            W, H = im.size
            for y in range(H):
                for x in range(W):
                    if max(px[x, y][:3]) < 22:
                        px[x, y] = (0, 0, 0, 0)
            cs = comps(im, min_px)
            if cs:
                out[(ri, ci)] = render(im, cs)
    return out

def region_cells(S, box, cols, rows, min_px=25):
    """Recorta a região inteira e agrupa as manchas pela célula do centro."""
    x0, y0, x1, y1 = box
    im = cutout(S, box, dark, tol=22, cap=90)
    cs = comps(im, min_px)
    out = {}
    for c in cs:
        cx = x0 + (c['x0'] + c['x1']) / 2
        cy = y0 + (c['y0'] + c['y1']) / 2
        ci = next((i for i in range(len(cols) - 1) if cols[i] <= cx < cols[i + 1]), None)
        ri = next((i for i in range(len(rows) - 1) if rows[i] <= cy < rows[i + 1]), None)
        if ci is not None and ri is not None:
            out.setdefault((ri, ci), []).append(c)
    return {k: render(im, v) for k, v in out.items()}

LAYER_COLS = ['body', 'hair', 'face', 'helmet', 'armor', 'arms', 'pants', 'boots', 'cape', 'wings_back', 'wings_front', 'aura']
def load_layers():
    S = sheet('layers')
    cols = [488, 564, 644, 725, 814, 913, 1008, 1090, 1170, 1250, 1335, 1425, 1515]
    rows = [138, 190, 242, 294, 346]
    g = grid_cells(S, (488, 138, 1500, 346), cols, rows)
    return {(r, LAYER_COLS[c]): im for (r, c), im in g.items()}

SET_CLASSES = ['warrior', 'assassin', 'mage', 'archer']
SET_PIECES = ['helmet', 'armor', 'arms', 'pants', 'cape']
SET_GROUPS = [(157, 337), (350, 527), (541, 717), (731, 909), (927, 1103), (1117, 1296), (1311, 1514)]
def load_sets():
    S = sheet('layers')
    rows = [432, 476, 520, 563, 607]
    out = {}
    for gi, (gx0, gx1) in enumerate(SET_GROUPS):
        w = (gx1 - gx0) / 5
        cols = [gx0 + w * k for k in range(6)]
        g = region_cells(S, (gx0, 432, gx1, 607), cols, rows, 15)
        for (r, c), im in g.items():
            out[(SET_CLASSES[r], RARITIES[gi], SET_PIECES[c])] = im
    return out

WEAPON_KINDS = ['sword', 'axe', 'spear', 'dagger', 'bow', 'staff']
def load_weapons():
    S = sheet('layers')
    cols = [155, 270, 390, 507, 624, 740, 846, 945]
    rows = [695, 742, 788, 834, 880, 930, 980]
    g = grid_cells(S, (155, 695, 945, 980), cols, rows, 30)
    return {(WEAPON_KINDS[r], RARITIES[c]): im for (r, c), im in g.items()}

MONTAGES = ['warrior_legendary', 'assassin_epic', 'mage_mythic', 'archer_divine', 'warrior_mythic', 'assassin_legendary', 'mage_divine', 'archer_celestial']
def load_montages():
    S = sheet('layers')
    out = {}
    xs = [966, 1108, 1250, 1390, 1530]
    for i, name in enumerate(MONTAGES):
        r, c = divmod(i, 4)
        y0, y1 = (662, 798) if r == 0 else (820, 952)
        im = cutout(S, (xs[c] + 2, y0, xs[c + 1] - 2, y1), dark, tol=18, cap=80)
        bb = im.getbbox()
        out[name] = im.crop(bb) if bb else im
    return out
