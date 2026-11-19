"""Monta o atlas de sprites do jogo a partir da prancha assets-src/sheet-hero.png.

1. recorta cada desenho (mesma segmentação de tools/segment.py)
2. limpa o fundo branco preso entre pernas/capa e a borda clara do recorte
3. gera variações de cor (inimigos de cada região)
4. calcula o ponto dos pés (âncora) de cada quadro
5. empacota tudo em public/sprites/atlas.png + src/data/atlas.json

uso: python3 -I tools/build_sprites.py
"""
import colorsys
import json
import os
import subprocess
import sys
from collections import deque
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TMP = os.path.join(ROOT, 'node_modules', '.sprite-cache')
SRC = os.path.join(ROOT, 'assets-src', 'sheet-hero.png')

if not os.path.exists(os.path.join(TMP, 'labels-map.png')):
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'segment.py'), SRC, TMP])
cut = Image.open(os.path.join(TMP, 'cutout.png')).convert('RGBA')
comps = {c['k']: c for c in json.load(open(os.path.join(TMP, 'comps.json')))}
labmap = Image.open(os.path.join(TMP, 'labels-map.png')).convert('RGB')
assert len(comps) == 238, f'segmentação mudou ({len(comps)} componentes): revise os números abaixo'

# ── o que entra no jogo ───────────────────────────────────────────────
# grupo: (lista de recortes, altura no jogo em px lógicos, lado para onde olha: 1 = direita, -1 = esquerda)
HERO = {
    'hero_idle': [14, 15, 16],
    'hero_walk': [46, 47, 48, 49, 50],
    'hero_jump': [26],
    'hero_fall': [13],
    'hero_atk0': [71, 74, 75],
    'hero_atk1': [72, 76, 77],
    'hero_atk2': [73, 78, 79],
    'hero_wind': [90, 93],
    'hero_whirl': [91, 94],
    'hero_thunder': [92, 95],
    'hero_hurt': [118, 119],
    'hero_dead': [122, 124, 126, 128],
}
SINGLE = {
    # NPCs
    'npc_brida': (2, 50, 1), 'npc_taro': (11, 48, 1), 'npc_ivy': (1, 52, 1),
    # inimigos comuns
    'slime_blue': (143, 24, 1), 'slime_green': (144, 24, 1),
    'mushroom_red': (130, 34, 1), 'mushroom_purple': (131, 34, 1),
    'bat': (132, 26, -1), 'bee': (133, 28, 1),
    'goblin': (145, 36, 1), 'skeleton': (135, 40, 1),
    'wolf': (137, 34, -1), 'boar': (138, 32, -1),
    'golem_small': (139, 50, 1), 'treant': (140, 52, 1), 'ogre': (141, 50, 1), 'mage': (142, 44, 1),
    # chefes
    'werewolf': (146, 72, -1), 'fire_wolf': (147, 70, -1), 'ice_beast': (148, 72, -1), 'orc_axe': (149, 80, 1),
    'dark_knight': (150, 84, 1), 'angel': (151, 84, 1), 'red_dragon': (152, 96, -1), 'blue_dragon': (153, 88, -1),
    'golem_big': (154, 90, 1), 'demon_lord': (155, 96, 1), 'gold_angel': (156, 96, 1),
    # efeitos
    'fx_slash': (158, 22, 1), 'fx_tornado': (163, 40, 1), 'fx_fireball': (169, 20, 1),
}
HERO_H = 52  # altura do herói parado no jogo

# ícones dos equipamentos (id do item -> recorte), altura 28
ICONS = {
    'training_sword': 32, 'bronze_sword': 36, 'moon_blade': 35, 'rune_greatsword': 31, 'storm_saber': 38,
    'ember_blade': 37, 'frost_fang': 34, 'sun_greatsword': 33, 'void_edge': 40,
    'leather_vest': 58, 'chainmail': 57, 'warden_plate': 42, 'scale_mail': 59, 'ember_plate': 60,
    'frost_guard': 43, 'aegis_plate': 61,
    'cloth_hood': 70, 'iron_helm': 69,
    'sapphire_ring': 82, 'falcon_amulet': 84, 'ember_ring': 83, 'star_pendant': 81,
}
ICON_VARIANTS = {'horned_helm': ('iron_helm', 0.08, 1.6, 1.0), 'crown_helm': ('iron_helm', 0.13, 2.5, 1.3)}

# blocos de terreno e objetos de cenário: nome -> recorte (altura no jogo definida na hora de desenhar)
TILES = {
    'tile_grass': 189, 'tile_grass2': 190, 'tile_dirt': 208, 'tile_rock': 209, 'tile_brick': 192, 'tile_brick2': 210,
    'tile_moss': 193, 'tile_moss2': 211,
    'tree_green': 221, 'tree_snow': 222, 'tree_dead': 223, 'bush': 224, 'bush2': 232,
    'rock1': 218, 'rock2': 219, 'rock3': 225, 'rock4': 226, 'rock5': 220, 'rock6': 233,
    'crystal_blue': 234, 'mushroom_deco': 235, 'flowers_y': 236, 'flowers_b': 237,
    'column': 203, 'column_vine': 205, 'column_thin': 206, 'arch_vine': 204, 'arch': 207,
    'ruin1': 228, 'ruin2': 229, 'ruin3': 230, 'ruin4': 231, 'waterfall': 227,
    'banner': 194, 'banner2': 195, 'brazier_px': 196, 'goblet': 197, 'sign': 198, 'fence_px': 199,
    'barrel_px': 212, 'chest': 213, 'chest_blue': 214, 'chest_red': 215, 'door': 216,
    'gallows': 200, 'ladder': 201,
}
TILE_RECTS = {'tree_orange': (151, 894, 290, 1021), 'tree_pink': (290, 894, 434, 1021)}
# variações de cor do terreno por região
TILE_VARIANTS = {
    'tile_snow': ('tile_grass', 0.0, 0.12, 1.55), 'tile_sand': ('tile_grass', 1.11, 0.5, 1.35),
    'tile_swamp': ('tile_grass', 0.05, 0.6, 0.8), 'tile_ash': ('tile_rock', 0.0, 0.35, 0.6),
    'tile_lava': ('tile_rock', 1.02, 0.9, 0.7), 'tile_cave': ('tile_rock', 0.62, 0.5, 0.75),
    'tile_cloud': ('tile_grass', 0.05, 0.5, 1.3), 'tile_sandrock': ('tile_dirt', 1.08, 0.45, 1.25),
    'tile_icerock': ('tile_rock', 0.55, 0.6, 1.25), 'tile_darkbrick': ('tile_brick', 0.7, 0.5, 0.7),
    'tile_moss_snow': ('tile_moss', 0.0, 0.12, 1.55), 'tile_moss_sand': ('tile_moss', 1.1, 0.5, 1.3),
    'tile_moss_dark': ('tile_moss', 0.62, 0.4, 0.65), 'tile_moss_lava': ('tile_moss', 1.03, 0.7, 0.5),
    'tile_moss_swamp': ('tile_moss', 0.05, 0.6, 0.8),
    'tree_dead_dark': ('tree_dead', 0.0, 0.5, 0.6), 'crystal_purple': ('crystal_blue', 0.12, 1.0, 1.0),
    'crystal_gold': ('crystal_blue', 0.45, 1.0, 1.2), 'column_dark': ('column', 0.65, 0.4, 0.7),
    'rock_snow': ('rock1', 0.0, 0.15, 1.35), 'rock_lava': ('rock4', -0.05, 1.5, 0.6),
}

# variações de cor: nome -> (sprite base, deslocamento de matiz 0..1, saturação, brilho)
VARIANTS = {
    'slime_olive': ('slime_green', 0.08, 0.8, 0.85),
    'slime_gray': ('slime_blue', 0.0, 0.15, 0.95),
    'slime_sand': ('slime_green', -0.18, 0.9, 1.1),
    'slime_ice': ('slime_blue', 0.0, 0.5, 1.2),
    'slime_magma': ('slime_green', -0.32, 1.2, 1.0),
    'slime_shadow': ('slime_blue', 0.18, 0.7, 0.7),
    'slime_cloud': ('slime_blue', 0.0, 0.1, 1.35),
    'bat_green': ('bat', 0.33, 0.8, 0.9),
    'bat_gray': ('bat', 0.0, 0.1, 1.0),
    'bat_brown': ('bat', 0.06, 0.6, 0.8),
    'bat_dark': ('bat', 0.75, 0.4, 0.75),
    'bee_storm': ('bee', 0.55, 0.9, 1.0),
    'wolf_sand': ('wolf', 0.08, 0.5, 1.25),
    'wolf_snow': ('wolf', 0.0, 0.15, 1.45),
    'wolf_dark': ('wolf', 0.75, 0.6, 0.6),
    'wolf_orange': ('wolf', 0.05, 1.4, 1.15),
    'boar_teal': ('boar', 0.45, 0.9, 1.0),
    'golem_rust': ('golem_small', 0.55, 0.9, 0.95),
    'golem_ice': ('golem_small', 0.0, 0.5, 1.3),
    'golem_magma': ('golem_small', 0.5, 1.2, 0.7),
    'golem_sky': ('golem_small', 0.1, 0.3, 1.35),
    'golem_big_rust': ('golem_big', 0.55, 0.9, 0.9),
    'ogre_white': ('ogre', 0.0, 0.1, 1.45),
    'treant_dark': ('treant', 0.05, 0.6, 0.75),
    'mushroom_pale': ('mushroom_red', 0.0, 0.2, 1.1),
    'werewolf_gold': ('werewolf', 0.12, 1.2, 1.4),
    'skeleton_dark': ('skeleton', 0.7, 0.4, 0.55),
}

# ── limpeza ───────────────────────────────────────────────────────────

def crop(k):
    """Recorta só os pixels do componente k (vizinhos sobrepostos ficam de fora)."""
    c = comps[k]
    box = (c['x'], c['y'], c['x'] + c['w'], c['y'] + c['h'])
    im = cut.crop(box)
    lm = labmap.crop(box).load()
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, _ = lm[x, y]
            if r + (g << 8) != c['id']:
                px[x, y] = (0, 0, 0, 0)
    return im

def crop_rect(x0, y0, x1, y1):
    """Recorte por retângulo (para desenhos grudados na prancha, ex.: árvores 217)."""
    return cut.crop((x0, y0, x1, y1))

def clean(im):
    """Remove branco preso dentro do desenho (áreas grandes) e a franja clara da borda."""
    im = im.copy()
    W, H = im.size
    px = im.load()
    def white(c):
        return c[3] > 0 and min(c[:3]) > 236 and max(c[:3]) - min(c[:3]) < 14
    seen = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            if seen[y * W + x] or not white(px[x, y]):
                continue
            region = []
            dq = deque([(x, y)])
            seen[y * W + x] = 1
            while dq:
                cx, cy = dq.popleft()
                region.append((cx, cy))
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx] and white(px[nx, ny]):
                        seen[ny * W + nx] = 1
                        dq.append((nx, ny))
            if len(region) >= 40:
                for cx, cy in region:
                    px[cx, cy] = (0, 0, 0, 0)
    # franja: pixels claros encostados na transparência (2 passadas)
    for _ in range(2):
        kill = []
        for y in range(H):
            for x in range(W):
                c = px[x, y]
                if c[3] == 0 or min(c[:3]) < 200:
                    continue
                for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                    if not (0 <= nx < W and 0 <= ny < H) or px[nx, ny][3] == 0:
                        kill.append((x, y))
                        break
        for x, y in kill:
            px[x, y] = (0, 0, 0, 0)
    bbox = im.getbbox()
    return im.crop(bbox) if bbox else im

def recolor(im, dh, sat, val):
    im = im.copy()
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if s < 0.12 and v < 0.25:  # contorno escuro: mantém
                continue
            # dh >= 1: colorir com matiz fixo (dh - 1); senão desloca o matiz
            h = (dh - 1) if dh >= 1 else (h + dh) % 1
            s = min(1, s * sat)
            v = min(1, v * val)
            r2, g2, b2 = colorsys.hsv_to_rgb(h, s, v)
            px[x, y] = (int(r2 * 255), int(g2 * 255), int(b2 * 255), a)
    return im

def feet(im):
    """Âncora: centro dos pixels opacos nas últimas linhas (pés)."""
    W, H = im.size
    px = im.load()
    xs = []
    for y in range(max(0, H - 8), H):
        for x in range(W):
            if px[x, y][3] > 0:
                xs.append(x)
    xs.sort()
    return (xs[len(xs) // 2] if xs else W // 2), H

# ── montagem ──────────────────────────────────────────────────────────

frames = {}   # nome -> [(imagem, ax, ay)]
meta = {}     # nome -> {scale, faces}
hero_ref = clean(crop(HERO['hero_idle'][0])).size[1]
for name, ks in HERO.items():
    imgs = [clean(crop(k)) for k in ks]
    frames[name] = [(im, *feet(im)) for im in imgs]
    meta[name] = {'scale': HERO_H / hero_ref, 'faces': 1}
for name, (k, h, faces) in SINGLE.items():
    im = clean(crop(k))
    frames[name] = [(im, *feet(im))]
    meta[name] = {'scale': h / im.size[1], 'faces': faces}
for name, k in ICONS.items():
    im = clean(crop(k))
    frames['icon_' + name] = [(im, *feet(im))]
    meta['icon_' + name] = {'scale': 28 / max(im.size), 'faces': 1}
for name, (base, dh, sat, val) in ICON_VARIANTS.items():
    im = recolor(frames['icon_' + base][0][0], dh, sat, val)
    frames['icon_' + name] = [(im, *feet(im))]
    meta['icon_' + name] = dict(meta['icon_' + base])
for name, k in TILES.items():
    im = clean(crop(k)) if not name.startswith('tile_') else crop(k).crop(crop(k).getbbox())
    frames[name] = [(im, *feet(im))]
    meta[name] = {'scale': 1, 'faces': 1}
for name, r in TILE_RECTS.items():
    im = clean(crop_rect(*r))
    frames[name] = [(im, *feet(im))]
    meta[name] = {'scale': 1, 'faces': 1}
for name, (base, dh, sat, val) in TILE_VARIANTS.items():
    im = recolor(frames[base][0][0], dh, sat, val)
    frames[name] = [(im, *feet(im))]
    meta[name] = {'scale': 1, 'faces': 1}
for name, (base, dh, sat, val) in VARIANTS.items():
    im = recolor(frames[base][0][0], dh, sat, val)
    frames[name] = [(im, *feet(im))]
    meta[name] = dict(meta[base])
# ataques: a âncora dos quadros com efeito usa a do corpo (primeiro quadro) para o herói não "pular"
for name in ('hero_atk0', 'hero_atk1', 'hero_atk2', 'hero_wind', 'hero_whirl', 'hero_thunder'):
    base_ax = frames[name][0][1]
    frames[name] = [(im, base_ax if i else ax, ay) for i, (im, ax, ay) in enumerate(frames[name])]

# empacotamento em prateleiras
items = [(name, i, im, ax, ay) for name, lst in frames.items() for i, (im, ax, ay) in enumerate(lst)]
items.sort(key=lambda t: -t[2].size[1])
AW, pad = 2048, 2
x = y = row_h = 0
places = []
for name, i, im, ax, ay in items:
    w, h = im.size
    if x + w + pad > AW:
        x, y, row_h = 0, y + row_h + pad, 0
    places.append((name, i, im, ax, ay, x, y))
    x += w + pad
    row_h = max(row_h, h)
AH = y + row_h
atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
out = {name: {'scale': round(meta[name]['scale'], 4), 'faces': meta[name]['faces'], 'frames': [None] * len(frames[name])} for name in frames}
for name, i, im, ax, ay, px_, py_ in places:
    atlas.paste(im, (px_, py_))
    out[name]['frames'][i] = [px_, py_, im.size[0], im.size[1], ax, ay]

os.makedirs(os.path.join(ROOT, 'public', 'sprites'), exist_ok=True)
atlas.save(os.path.join(ROOT, 'public', 'sprites', 'atlas.png'), optimize=True)
json.dump(out, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'atlas {AW}x{AH}, {len(items)} quadros, {len(out)} sprites')
