"""Recorta os quadros de cada poder da prancha assets-src/sheet-powers.png.
Para cada linha (poder) pega a faixa à direita do rótulo, remove o fundo claro e
separa os desenhos em "células" (grupos separados por espaço vazio na horizontal).
Retorna {nome_do_poder: [imagem RGBA, ...]} e os ícones."""
from collections import deque
from PIL import Image
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-powers.png')).convert('RGBA')

ROWS = [(90, 157), (163, 231), (237, 302), (307, 377), (409, 470), (479, 547), (553, 617), (623, 689), (723, 788), (793, 859), (865, 931), (937, 1003)]
# faixa dos quadros (à direita do rótulo) e do ícone, por painel
PANELS = {'L': {'cells': (412, 846), 'icon': (234, 300)}, 'R': {'cells': (1070, 1532), 'icon': (864, 930)}}
NAMES = {
    'L': ['w_slash_h', 'w_slash_v', 'w_dash', 'w_whirl', 'm_fireball', 'm_fireburst', 'm_icespear', 'm_icestorm',
          'a_quick', 'a_blades', 'a_teleport', 'a_thrust'],
    'R': ['w_shock', 'w_flame', 'w_quake', 'w_shield', 'm_arcane', 'm_meteor', 'm_circle', 'm_heal',
          'a_shadowburst', 'a_daggers', 'a_poison', 'a_clone'],
}

def is_bg(c):
    r, g, b, a = c
    return min(r, g, b) > 222 and max(r, g, b) - min(r, g, b) < 26

def cutout(box):
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
    # linhas finas que separam as fileiras: linhas quase todas opacas e baixinhas
    for y in range(H):
        n = sum(1 for x in range(W) if px[x, y][3] > 0)
        edge = y < 3 or y > H - 4
        if n > W * 0.88 or (edge and n > W * 0.3):
            for x in range(W):
                px[x, y] = (0, 0, 0, 0)
    return im

def cells(im, min_gap=4):
    W, H = im.size
    px = im.load()
    cols = [sum(1 for y in range(H) if px[x, y][3] > 0) for x in range(W)]
    runs, start, gap = [], None, 0
    for x in range(W):
        if cols[x] > 1:
            if start is None:
                start = x
            gap = 0
            end = x
        elif start is not None:
            gap += 1
            if gap >= min_gap:
                runs.append((start, end))
                start = None
    if start is not None:
        runs.append((start, end))
    out = []
    for a, b in runs:
        if b - a < 10:
            continue
        c = im.crop((a, 0, b + 1, H))
        bb = c.getbbox()
        if bb and (bb[3] - bb[1]) > 10:
            out.append(c.crop(bb))
    return out

# células coladas (efeito encostando no quadro seguinte): índice -> em quantas partes dividir
SPLIT = {
    'w_whirl': {2: 2}, 'a_quick': {2: 2}, 'a_blades': {3: 2}, 'a_thrust': {1: 2}, 'w_flame': {3: 2},
    'w_quake': {1: 2}, 'm_meteor': {2: 3}, 'a_shadowburst': {1: 2}, 'a_daggers': {3: 3}, 'a_poison': {1: 4},
    'a_clone': {2: 2},
}

def split(name, frames):
    out = []
    for i, f in enumerate(frames):
        n = SPLIT.get(name, {}).get(i, 1)
        w = f.size[0]
        for k in range(n):
            part = f.crop((round(k * w / n), 0, round((k + 1) * w / n), f.size[1]))
            bb = part.getbbox()
            if bb:
                out.append(part.crop(bb))
    # descarta restos minúsculos (pedaço de seta do rótulo)
    return [f for f in out if f.size[0] > 18 and f.size[1] > 18]

def load():
    powers, icons = {}, {}
    for side, p in PANELS.items():
        for i, (y0, y1) in enumerate(ROWS):
            name = NAMES[side][i]
            powers[name] = split(name, cells(cutout((p['cells'][0], y0, p['cells'][1], y1)), 4))
            icons[name] = SHEET.crop((p['icon'][0], y0 + 1, p['icon'][1], y1 - 1))
    return powers, icons

if __name__ == '__main__':
    import sys
    out = sys.argv[1]
    powers, icons = load()
    sheet = Image.new('RGB', (1500, 24 * 80), (40, 44, 60))
    y = 0
    for name, frames in powers.items():
        x = 0
        ic = icons[name].convert('RGB')
        sheet.paste(ic, (0, y))
        x = 80
        for f in frames:
            sheet.paste(f, (x, y), f)
            x += f.size[0] + 10
        print(name, len(frames), [f.size for f in frames])
        y += 80
    sheet.save(out)
