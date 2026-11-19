"""Recorta os chefes da prancha assets-src/sheet-bosses.png.
Cada linha = um chefe; os quadros são separados por espaço vazio na horizontal e
atribuídos às colunas do cabeçalho (parado, andar, ataque 1/2/3, dano, morte) pela posição x.
Os efeitos ficam no painel da direita."""
import os
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-bosses.png')).convert('RGBA')

BOSSES = ['dragon', 'skeleton_king', 'golem_elder', 'demoness', 'dark_knight', 'hydra', 'dark_god']
ROWS = [(116, 222), (232, 344), (352, 466), (472, 586), (594, 704), (712, 824), (834, 1004)]
# limites x das colunas (cabeçalho da prancha)
COLS = [('idle', 262, 372), ('walk', 372, 528), ('atk1', 528, 650), ('atk2', 650, 790), ('atk3', 790, 975), ('hit', 975, 1095), ('death', 1095, 1214)]
FX_X = (1230, 1530)

def is_bg(c):
    r, g, b, a = c
    return max(r, g, b) < 46

def cutout(box, lines=True):
    im = SHEET.crop(box).copy()
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    dq = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while dq:
        x, y = dq.popleft()
        i = y * W + x
        if seen[i] or not is_bg(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                dq.append((nx, ny))
    # linhas finas das molduras (quase toda a largura/altura opaca e fina)
    for y in (range(H) if lines else []):
        if sum(1 for x in range(W) if px[x, y][3] > 0) > W * 0.85:
            for x in range(W):
                px[x, y] = (0, 0, 0, 0)
    for x in (range(W) if lines else []):
        if sum(1 for y in range(H) if px[x, y][3] > 0) > H * 0.9:
            for y in range(H):
                px[x, y] = (0, 0, 0, 0)
    return im

def runs(im, gap=3, minw=12):
    W, H = im.size
    px = im.load()
    cols = [sum(1 for y in range(H) if px[x, y][3] > 0) for x in range(W)]
    out, start, g = [], None, 0
    for x in range(W):
        if cols[x] > 2:
            if start is None:
                start = x
            g = 0
            end = x
        elif start is not None:
            g += 1
            if g >= gap:
                out.append((start, end))
                start = None
    if start is not None:
        out.append((start, end))
    return [(a, b) for a, b in out if b - a >= minw]

def piece(im, a, b):
    c = im.crop((a, 0, b + 1, im.size[1]))
    bb = c.getbbox()
    return c.crop(bb) if bb else None

def components(im, min_px=120):
    """Manchas opacas conectadas (8 vizinhos). Descarta linhas finas de moldura."""
    W, H = im.size
    px = im.load()
    lab = bytearray(W * H)
    out = []
    for sy in range(H):
        for sx in range(W):
            if lab[sy * W + sx] or px[sx, sy][3] == 0:
                continue
            dq = deque([(sx, sy)])
            lab[sy * W + sx] = 1
            pts = []
            while dq:
                x, y = dq.popleft()
                pts.append((x, y))
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < W and 0 <= ny < H and not lab[ny * W + nx] and px[nx, ny][3] > 0:
                            lab[ny * W + nx] = 1
                            dq.append((nx, ny))
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
            w, h = x1 - x0 + 1, y1 - y0 + 1
            if len(pts) < min_px or h <= 4 or w <= 4 or len(pts) < 0.08 * w * h:
                continue
            out.append({'x0': x0, 'x1': x1, 'y0': y0, 'y1': y1, 'pts': pts})
    return out

def render(im, comp_list, x0, x1):
    """Imagem só com os pixels das manchas, recortada entre x0 e x1."""
    W, H = im.size
    src = im.load()
    out = Image.new('RGBA', (x1 - x0 + 1, H), (0, 0, 0, 0))
    op = out.load()
    for c in comp_list:
        for x, y in c['pts']:
            if x0 <= x <= x1:
                op[x - x0, y] = src[x, y]
    bb = out.getbbox()
    return out.crop(bb) if bb else None

def group(im, comps, max_w):
    """Junta manchas pequenas à grande mais próxima e divide manchas largas demais."""
    big = [c for c in comps if (c['y1'] - c['y0']) > 26 or (c['x1'] - c['x0']) > 40]
    small = [c for c in comps if c not in big]
    for c in small:
        cx = (c['x0'] + c['x1']) / 2
        best = min(big, key=lambda b: 0 if b['x0'] <= cx <= b['x1'] else min(abs(cx - b['x0']), abs(cx - b['x1'])), default=None)
        if best is not None and (best['x0'] - 20 <= cx <= best['x1'] + 20):
            best.setdefault('extra', []).append(c)
    frames = []
    for b in sorted(big, key=lambda c: c['x0']):
        allc = [b] + b.get('extra', [])
        w = b['x1'] - b['x0'] + 1
        n = max(1, round(w / max_w)) if w > max_w * 1.45 else 1
        for k in range(n):
            a = b['x0'] + round(k * w / n)
            z = b['x0'] + round((k + 1) * w / n) - 1
            img = render(im, allc, a, z)
            if img is not None and img.size[1] > 20:
                frames.append(((a + z) / 2, img))
    return frames

# largura típica de um quadro de cada chefe (para dividir quadros grudados)
FRAME_W = {'dragon': 100, 'skeleton_king': 88, 'golem_elder': 88, 'demoness': 90, 'dark_knight': 92, 'hydra': 98, 'dark_god': 90}

def clean_lines(im):
    """Mantém só manchas que não são linhas finas de moldura."""
    keep = components(im, 30)
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    src, op = im.load(), out.load()
    for c in keep:
        for x, y in c['pts']:
            op[x, y] = src[x, y]
    return out

def split_runs(im, max_w, gap=3):
    W, H = im.size
    px = im.load()
    occ = [sum(1 for y in range(H) if px[x, y][3] > 0) for x in range(W)]
    rs = runs(im, gap, 6)
    # junta pedacinhos (caudas, faíscas) ao vizinho mais perto
    merged = []
    for a, b in rs:
        if merged and (b - a < 24 or merged[-1][1] - merged[-1][0] < 24) and a - merged[-1][1] < 14:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    out = []
    def rec(a, b):
        w = b - a + 1
        if w <= max_w * 1.4:
            out.append((a, b))
            return
        n = round(w / max_w)
        lo, hi = a + int(w / n * 0.6), a + int(w / n * 1.4)
        cut = min(range(lo, min(hi, b)), key=lambda x: occ[x])
        rec(a, cut)
        rec(cut + 1, b)
    for a, b in merged:
        rec(a, b)
    return out

def load():
    bosses = {}
    for name, (y0, y1) in zip(BOSSES, ROWS):
        strip = clean_lines(cutout((262, y0, 1214, y1)))
        anims = {k: [] for k, _, _ in COLS}
        for a, b in split_runs(strip, FRAME_W[name]):
            cx = 262 + (a + b) / 2
            img = piece(strip, a, b)
            if img is None or img.size[1] < 20:
                continue
            for k, c0, c1 in COLS:
                if c0 <= cx < c1:
                    anims[k].append(img)
        fy = y0 + (30 if name == 'dark_god' else 22)
        fstrip = clean_lines(cutout((FX_X[0], fy, FX_X[1], y1), lines=name != 'dark_god'))
        fxs = [p for p in (piece(fstrip, a, b) for a, b in split_runs(fstrip, 76)) if p is not None and p.size[1] > 14]
        bosses[name] = (anims, fxs)
    return bosses

if __name__ == '__main__':
    import sys
    data = load()
    sheet = Image.new('RGB', (1600, 7 * 130), (60, 64, 80))
    for i, (name, (anims, fxs)) in enumerate(data.items()):
        x = 0
        for k, fr in anims.items():
            for f in fr:
                sheet.paste(f, (x, i * 130 + 10), f)
                x += f.size[0] + 4
            x += 14
        x += 20
        for f in fxs:
            sheet.paste(f, (x, i * 130 + 10), f)
            x += f.size[0] + 4
        print(name, {k: len(v) for k, v in anims.items()}, 'fx', len(fxs))
    sheet.save(sys.argv[1])
