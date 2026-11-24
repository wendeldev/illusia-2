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
# segunda prancha: personagens das classes jogáveis
TMP2 = os.path.join(ROOT, 'node_modules', '.sprite-cache-classes')
SRC2 = os.path.join(ROOT, 'assets-src', 'sheet-classes.png')
if not os.path.exists(os.path.join(TMP2, 'labels-map.png')):
    subprocess.check_call([sys.executable, '-I', os.path.join(ROOT, 'tools', 'segment.py'), SRC2, TMP2])
cut2 = Image.open(os.path.join(TMP2, 'cutout.png')).convert('RGBA')
comps2 = {c['k']: c for c in json.load(open(os.path.join(TMP2, 'comps.json')))}
labmap2 = Image.open(os.path.join(TMP2, 'labels-map.png')).convert('RGB')
assert len(comps2) == 326, f'segmentação da prancha de classes mudou ({len(comps2)})'

cut = Image.open(os.path.join(TMP, 'cutout.png')).convert('RGBA')
comps = {c['k']: c for c in json.load(open(os.path.join(TMP, 'comps.json')))}
labmap = Image.open(os.path.join(TMP, 'labels-map.png')).convert('RGB')
assert len(comps) == 238, f'segmentação mudou ({len(comps)} componentes): revise os números abaixo'

# ── o que entra no jogo ───────────────────────────────────────────────
# grupo: (lista de recortes, altura no jogo em px lógicos, lado para onde olha: 1 = direita, -1 = esquerda)
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

CLASS_FX = {'fx_orb': 139}   # ataque básico da Maga

# ícones dos equipamentos (id do item -> recorte), altura 28
ICONS = {
    'training_sword': 32, 'bronze_sword': 36, 'moon_blade': 35, 'rune_greatsword': 31, 'storm_saber': 38,
    'ember_blade': 37, 'frost_fang': 34, 'sun_greatsword': 33, 'void_edge': 40,
    'leather_vest': 58, 'chainmail': 57, 'warden_plate': 42, 'scale_mail': 59, 'ember_plate': 60,
    'frost_guard': 43, 'aegis_plate': 61,
    'cloth_hood': 70, 'iron_helm': 69,
    'sapphire_ring': 82, 'falcon_amulet': 84, 'ember_ring': 83, 'star_pendant': 81,
    'leather_boots': 66, 'iron_boots': 65, 'winged_boots': 68, 'gold_boots': 67,
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

def crop2(k):
    """Recorte na prancha de classes; k pode ser uma tupla (junta vários recortes)."""
    ids = k if isinstance(k, tuple) else (k,)
    cs = [comps2[i] for i in ids]
    x0 = min(c['x'] for c in cs); y0 = min(c['y'] for c in cs)
    x1 = max(c['x'] + c['w'] for c in cs); y1 = max(c['y'] + c['h'] for c in cs)
    im = cut2.crop((x0, y0, x1, y1))
    want = {c['id'] for c in cs}
    lm = labmap2.crop((x0, y0, x1, y1)).load()
    px = im.load()
    for y in range(im.size[1]):
        for x in range(im.size[0]):
            r, g, _ = lm[x, y]
            if r + (g << 8) not in want:
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
for name, (k, h, faces) in SINGLE.items():
    im = clean(crop(k))
    frames[name] = [(im, *feet(im))]
    meta[name] = {'scale': h / im.size[1], 'faces': faces}
for name, k in CLASS_FX.items():
    im = clean(crop2(k))
    frames[name] = [(im, im.size[0] // 2, im.size[1] // 2)]
    meta[name] = {'scale': 22 / im.size[1] if name == 'fx_orb' else 1.0, 'faces': 1}
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

# ═══════════════════ prancha 3: cenários (fundos, blocos e objetos) ═══════════════════
# Recortes por retângulo (coordenadas medidas em assets-src/sheet-backgrounds.png).
from PIL import Image as _I
SHEET3 = _I.open(os.path.join(ROOT, 'assets-src', 'sheet-backgrounds.png')).convert('RGBA')

# panoramas (x0, y0, x1, y1): ficam opacos, viram o fundo com paralaxe
PANORAMAS = {
    'pano_forest': (0, 2, 716, 128), 'pano_ruins': (0, 133, 716, 244), 'pano_snow': (0, 249, 716, 357),
    'pano_desert': (0, 362, 716, 460), 'pano_volcano': (0, 465, 716, 547), 'pano_haunted': (0, 552, 716, 638),
    'pano_cave': (0, 645, 716, 714), 'pano_castle': (0, 721, 716, 803), 'pano_sky': (0, 808, 716, 907),
    'pano_void': (0, 912, 716, 1013),
}
# camadas que se movem (fundo próprio removido)
LAYERS = {
    'layer_clouds': (1143, 585, 1531, 651), 'layer_mount_snow': (1143, 651, 1531, 690),
    'layer_mount_blue': (1143, 690, 1531, 729), 'layer_mount_far': (1143, 732, 1531, 778),
    'layer_castles': (1145, 782, 1531, 846), 'layer_fog': (1145, 850, 1531, 903), 'layer_fog2': (1145, 968, 1531, 1013),
    'moon_blue': (1166, 905, 1230, 962), 'moon_red': (1266, 905, 1325, 958), 'sunset': (1342, 903, 1439, 970),
}
# blocos de terreno (bloco inteiro com topo)
BLOCKS = {
    'b_grass': (728, 6, 824, 83), 'b_grass2': (1024, 6, 1121, 83), 'b_moss': (728, 88, 824, 163),
    'b_brick': (728, 168, 824, 243), 'b_snowbrick': (728, 246, 824, 321), 'b_ice': (1024, 246, 1121, 321),
    'b_sand_snow': (728, 324, 824, 391), 'b_sand': (1024, 324, 1121, 391), 'b_lava': (728, 394, 824, 466),
    'b_lava2': (1024, 394, 1121, 466), 'b_purple': (728, 469, 824, 541), 'b_purple2': (1024, 469, 1121, 541),
    'b_carved': (728, 546, 824, 613), 'b_carved2': (1024, 546, 1121, 613), 'b_purplebrick': (935, 546, 1020, 613),
    'b_stone_plain': (730, 932, 790, 1012),
}
# objetos de cenário
OBJECTS = {
    'o_tree1': (1132, 6, 1239, 119), 'o_tree2': (1239, 6, 1339, 117), 'o_tree_orange': (1339, 6, 1437, 117),
    'o_tree_pink': (1437, 6, 1534, 117), 'o_tree_yellow': (1132, 124, 1240, 221), 'o_pine_snow': (1236, 108, 1294, 202),
    'o_tree_snow': (1287, 104, 1367, 202), 'o_dead1': (1364, 124, 1432, 209), 'o_dead2': (1432, 106, 1532, 206),
    'o_palm': (1246, 207, 1358, 299), 'o_bush_big': (1145, 224, 1240, 299), 'o_snow_bush': (1382, 213, 1482, 247),
    'o_bush_y': (1346, 261, 1429, 299), 'o_bush_g': (1434, 261, 1532, 299),
    'o_flowers1': (1145, 301, 1211, 346), 'o_flowers2': (1219, 304, 1287, 345), 'o_flowers3': (1294, 300, 1359, 346),
    'o_flowers4': (1367, 302, 1414, 344), 'o_flowers5': (1424, 304, 1474, 344), 'o_flowers6': (1482, 307, 1527, 343),
    'o_crystal_blue': (1305, 347, 1365, 397), 'o_crystal_purple': (1369, 343, 1430, 397),
    'o_mushroom': (1441, 343, 1494, 391), 'o_mushroom_s': (1493, 358, 1529, 391),
    'o_rock1': (1143, 401, 1215, 439), 'o_rock2': (1223, 396, 1294, 439), 'o_rock3': (1299, 405, 1380, 439),
    'o_log1': (1380, 405, 1451, 439), 'o_log2': (1462, 404, 1527, 439),
    'o_vines': (1142, 449, 1224, 496), 'o_flowers7': (1240, 449, 1323, 491), 'o_plant': (1336, 448, 1400, 490),
    'o_mush_small': (1409, 451, 1469, 489), 'o_rock4': (1477, 449, 1531, 491),
    'o_waterfall': (1143, 499, 1221, 574), 'o_waterfall2': (1224, 499, 1274, 574),
    'o_arch_bridge': (729, 624, 829, 681), 'o_arch2': (839, 624, 919, 681), 'o_column': (927, 621, 972, 684),
    'o_column2': (976, 621, 1009, 684), 'o_arch_big': (729, 696, 854, 746), 'o_ladder': (869, 694, 904, 759),
    'o_ruin_wall': (912, 694, 1013, 749), 'o_banner_red': (1029, 689, 1075, 764), 'o_banner_blue': (1077, 689, 1124, 764),
    'o_arch_small': (734, 756, 816, 801), 'o_crate': (831, 766, 865, 801), 'o_sign': (921, 769, 963, 811),
    'o_column_broken': (977, 756, 1003, 839), 'o_signboard': (1017, 781, 1074, 839), 'o_brazier': (1077, 766, 1128, 839),
    'o_crate2': (732, 806, 789, 846), 'o_arrow_sign': (832, 826, 899, 859), 'o_crate3': (907, 826, 952, 861),
    'o_crate_tall': (734, 864, 777, 921), 'o_fence_wood': (792, 881, 854, 921), 'o_fence_iron': (869, 874, 959, 921),
    'o_lantern': (974, 846, 1011, 921), 'o_lantern2': (1024, 844, 1069, 921), 'o_brazier2': (1069, 844, 1127, 921),
    'o_banner_green': (899, 931, 949, 1011), 'o_lantern3': (962, 929, 1014, 1011), 'o_cage': (1017, 929, 1064, 1011),
    'o_cage2': (1073, 929, 1122, 1011),
}

def _is_bg3(c):
    r, g, b, a = c
    lum = (r * 3 + g * 6 + b) / 10
    return lum < 64 and b >= r - 4 and b >= g - 10

def cut3(rect, remove_bg=True):
    im = SHEET3.crop(rect).copy()
    if not remove_bg:
        return im
    W, H = im.size
    px = im.load()
    seen = bytearray(W * H)
    dq = deque([(x, y) for x in range(W) for y in (0, H - 1)] + [(x, y) for y in range(H) for x in (0, W - 1)])
    while dq:
        x, y = dq.popleft()
        i = y * W + x
        if seen[i] or not _is_bg3(px[x, y]):
            continue
        seen[i] = 1
        px[x, y] = (0, 0, 0, 0)
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < W and 0 <= ny < H and not seen[ny * W + nx]:
                dq.append((nx, ny))
    bb = im.getbbox()
    return im.crop(bb) if bb else im

extra = {}
for n, r in PANORAMAS.items():
    extra[n] = cut3(r, False)
for n, r in LAYERS.items():
    extra[n] = cut3(r, True)
for n, r in BLOCKS.items():
    im = cut3(r, True)
    extra[n] = im
    # recheio: metade de baixo do bloco (sem a grama/neve do topo)
    w, h = im.size
    # recheio opaco (sem tirar fundo: senão as frestas escuras viram buracos)
    x0, y0, x1, y1 = r
    raw = SHEET3.crop((x0 + 6, y0 + int((y1 - y0) * 0.5), x1 - 6, y1 - 11))
    extra[n + '_fill'] = raw
for n, r in OBJECTS.items():
    extra[n] = cut3(r, True)

# empacota num 2º atlas (os panoramas são grandes)
items3 = sorted(extra.items(), key=lambda t: -t[1].size[1])
AW3, pad = 2048, 2
x = y = row_h = 0
pl = []
for n, im in items3:
    w, h = im.size
    if x + w + pad > AW3:
        x, y, row_h = 0, y + row_h + pad, 0
    pl.append((n, im, x, y))
    x += w + pad
    row_h = max(row_h, h)
atlas3 = _I.new('RGBA', (AW3, y + row_h), (0, 0, 0, 0))
meta3 = {}
for n, im, px_, py_ in pl:
    atlas3.paste(im, (px_, py_))
    w, h = im.size
    meta3[n] = {'scale': 1, 'faces': 1, 'frames': [[px_, py_, w, h, w // 2, h]], 'sheet': 1}
    if n.startswith('pano_'):
        # cor média do céu (topo) e de um pouco abaixo: vira degradê acima do panorama
        def avg(y0, y1):
            px = im.crop((0, y0, w, y1)).convert('RGB').resize((1, 1), _I.BOX).getpixel((0, 0))
            return '#%02x%02x%02x' % px
        meta3[n]['sky'] = [avg(0, 3), avg(3, 10)]
atlas3.save(os.path.join(ROOT, 'public', 'sprites', 'scenery.png'), optimize=True)
allmeta = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
allmeta.update(meta3)
json.dump(allmeta, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'cenário: {atlas3.size[0]}x{atlas3.size[1]}, {len(meta3)} peças')

# ═══════════════════ prancha 4: poderes (animações e ícones) ═══════════════════
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import powers_cells as PC
P_FRAMES, P_ICONS = PC.load()
# poder: (quadros do personagem lançando, quadros do efeito separado, âncora do personagem)
POWERS = {
    'w_slash_h': ([0, 1, 2, 3], [], 'left'), 'w_slash_v': ([0, 1, 2, 3], [], 'left'),
    'w_dash': ([0, 1, 2, 3], [], 'right'), 'w_whirl': ([0, 1, 2, 3], [], 'left'),
    'w_shock': ([0, 1, 2, 3], [4], 'left'), 'w_flame': ([0, 1, 2, 3, 4], [], 'left'),
    'w_quake': ([0, 1, 2], [3, 4], 'left'), 'w_shield': ([0, 1, 2, 3, 4], [], 'center'),
    'm_fireball': ([0, 1], [2, 3, 4], 'left'), 'm_fireburst': ([0, 1], [2, 3, 4], 'left'),
    'm_icespear': ([0, 1], [2, 3, 4], 'left'), 'm_icestorm': ([0, 1], [2, 3, 4], 'left'),
    'm_arcane': ([0, 1], [3, 4], 'left'), 'm_meteor': ([0, 1], [3, 4], 'left'),
    'm_circle': ([0, 1], [2, 3, 4], 'left'), 'm_heal': ([0, 1, 2, 3, 4], [], 'center'),
    'a_quick': ([0, 1, 2, 3, 4], [], 'left'), 'a_blades': ([0, 1, 2], [3], 'left'),
    'a_teleport': ([0, 1, 2, 3], [], 'right'), 'a_thrust': ([0, 1, 2, 3], [], 'left'),
    'a_shadowburst': ([0, 1, 2, 3], [], 'left'), 'a_daggers': ([0, 1, 2], [4], 'left'),
    'a_poison': ([0, 1], [4], 'left'), 'a_clone': ([0, 1, 2, 3, 4, 5], [], 'left'),
}
# só os ícones dos poderes (os efeitos vêm das pranchas fx-<classe>.png e o personagem é o boneco em camadas)
pw_extra = {}
for name in POWERS:
    ic = P_ICONS[name]
    pw_extra['ic_' + name] = ([(ic, ic.size[0] // 2, ic.size[1])], 1.0)

# 3º atlas: poderes
items4 = [(n, i, im, ax, ay) for n, (lst, _) in pw_extra.items() for i, (im, ax, ay) in enumerate(lst)]
items4.sort(key=lambda t: -t[2].size[1])
x = y = row_h = 0
pl4 = []
for n, i, im, ax, ay in items4:
    w, h = im.size
    if x + w + 2 > 2048:
        x, y, row_h = 0, y + row_h + 2, 0
    pl4.append((n, i, im, ax, ay, x, y))
    x += w + 2
    row_h = max(row_h, h)
atlas4 = _I.new('RGBA', (2048, y + row_h), (0, 0, 0, 0))
meta4 = {n: {'scale': round(sc, 4), 'faces': 1, 'frames': [None] * len(lst), 'sheet': 2} for n, (lst, sc) in pw_extra.items()}
for n, i, im, ax, ay, px_, py_ in pl4:
    atlas4.paste(im, (px_, py_))
    meta4[n]['frames'][i] = [px_, py_, im.size[0], im.size[1], ax, ay]
atlas4.save(os.path.join(ROOT, 'public', 'sprites', 'powers.png'), optimize=True)
allmeta = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
allmeta.update(meta4)
json.dump(allmeta, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'poderes: {atlas4.size[0]}x{atlas4.size[1]}, {len(meta4)} peças')

# ═══════════════════ prancha 5: chefes (animações completas e efeitos) ═══════════════════
import boss_cells as BC
B_DATA = BC.load()
# altura de cada chefe no jogo (px) e variações de cor (nome novo: base, matiz, saturação, brilho)
BOSS_H = {'dragon': 96, 'skeleton_king': 96, 'golem_elder': 96, 'demoness': 92, 'dark_knight': 96, 'hydra': 100, 'dark_god': 110}
BOSS_VARIANTS = {'crystal_golem': ('golem_elder', 0.55, 0.8, 1.05), 'red_dragon2': ('dragon', 0.12, 1.1, 1.05)}
boss_extra = {}

def add_boss(name, anims, fxs, recol=None):
    ref = anims['idle'][0] if anims['idle'] else anims['walk'][0]
    scale = BOSS_H[recol[0] if recol else name] / ref.size[1]
    rax = feet(ref)[0]
    rw = ref.size[0]
    for k, frs in anims.items():
        if not frs:
            frs = anims['idle']
        lst = []
        for im in frs:
            if recol:
                im = recolor(im, *recol[1:])
            # quadros com efeito ao lado: o corpo fica à esquerda, âncora alinhada ao parado
            ax = feet(im)[0] if im.size[0] <= rw * 1.25 else min(rax, im.size[0] - 1)
            lst.append((im, ax, im.size[1]))
        boss_extra[f'boss_{name}_{k}'] = (lst, scale)
    for i, im in enumerate(fxs):
        if recol:
            im = recolor(im, *recol[1:])
        boss_extra[f'bfx_{name}_{i}'] = ([(im, im.size[0] // 2, im.size[1] // 2)], scale)

for name, (anims, fxs) in B_DATA.items():
    add_boss(name, anims, fxs)
for name, (base, dh, sat, val) in BOSS_VARIANTS.items():
    anims, fxs = B_DATA[base]
    add_boss(name, anims, fxs, (base, dh, sat, val))

# chefes básicos/intermediários (prancha 6): 1 quadro por animação
import miniboss_cells as MC
MINI = MC.load()
# atk3 que é só efeito (sem o corpo): o corpo usa o ataque 2 e o efeito vira disparo/pancada
FX_ONLY_ATK3 = {'stone_golem', 'plant', 'serpent'}
MINI_H = {'troll': 74, 'wolf_alpha': 58, 'stone_golem': 72, 'spider': 54, 'plant': 70, 'minotaur': 80, 'orc': 76, 'serpent': 76, 'fallen_knight': 76, 'dark_mage': 78}
for name, an in MINI.items():
    ref = an['idle']
    scale = MINI_H[name] / ref.size[1]
    def fr(im, center=False):
        return (im, im.size[0] // 2, im.size[1] // 2) if center else (im, feet(im)[0], im.size[1])
    body3 = an['atk2'] if name in FX_ONLY_ATK3 else an['atk3']
    seq = {'idle': [an['idle']], 'walk': [an['idle'], an['walk']], 'atk1': [an['atk1']], 'atk2': [an['atk2']],
           'atk3': [body3], 'hit': [an['hit']], 'death': [an['hit'], an['death']]}
    for k, ims in seq.items():
        boss_extra[f'boss_{name}_{k}'] = ([fr(im) for im in ims if im is not None], scale)
    boss_extra[f'boss_{name}_fxspecial'] = ([fr(an['special'], True)], scale)
    if name in FX_ONLY_ATK3:
        boss_extra[f'boss_{name}_fxatk3'] = ([fr(an['atk3'], True)], scale)

items5 = [(n, i, im, ax, ay) for n, (lst, _) in boss_extra.items() for i, (im, ax, ay) in enumerate(lst)]
items5.sort(key=lambda t: -t[2].size[1])
x = y = row_h = 0
pl5 = []
for n, i, im, ax, ay in items5:
    w, h = im.size
    if x + w + 2 > 2048:
        x, y, row_h = 0, y + row_h + 2, 0
    pl5.append((n, i, im, ax, ay, x, y))
    x += w + 2
    row_h = max(row_h, h)
atlas5 = _I.new('RGBA', (2048, y + row_h), (0, 0, 0, 0))
meta5 = {n: {'scale': round(sc, 4), 'faces': 1, 'frames': [None] * len(lst), 'sheet': 3} for n, (lst, sc) in boss_extra.items()}
for n, i, im, ax, ay, px_, py_ in pl5:
    atlas5.paste(im, (px_, py_))
    meta5[n]['frames'][i] = [px_, py_, im.size[0], im.size[1], ax, ay]
atlas5.save(os.path.join(ROOT, 'public', 'sprites', 'bosses.png'), optimize=True)
allmeta = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
allmeta.update(meta5)
json.dump(allmeta, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'chefes: {atlas5.size[0]}x{atlas5.size[1]}, {len(meta5)} peças')

# ═══════════════════ prancha 7: itens e coletáveis ═══════════════════
import item_cells as IC
I_DATA = IC.load()
I_NAMES = {
    'coins': ['coin', 'coins', 'coin_pile', 'coin_bag', 'gem_blue', 'gem_red', 'gem_purple', 'gem_gold', 'gem_rainbow'],
    'potions': ['pot_hp', 'pot_mp', 'pot_hp2', 'pot_mp2', 'pot_mp3', 'pot_elixir', 'pot_divine'],
    'chests': ['chest_wood', 'chest_iron', 'chest_blue', 'chest_purple', 'chest_gold', 'chest_red', 'chest_angel'],
    'keys': ['key_bronze', 'key_silver', 'key_ruby', 'key_amethyst', 'key_angel'],
    'crystals': ['cry_blue', 'cry_red', 'cry_green', 'cry_gold', 'cry_purple', 'cry_white'],
    'quest': ['q_map', 'q_scroll', 'q_letter', 'q_book', 'q_orb', 'q_seal', 'q_amulet'],
    'materials': ['m_ore', 'm_iron', 'm_gold', 'm_sapphire', 'm_ruby', 'm_amethyst', 'm_herb', 'm_wood', 'm_leather', 'm_bone', 'm_essence'],
    'buffs': ['buff_atk', 'buff_def', 'buff_regen', 'buff_speed', 'buff_crit', 'buff_exp', 'buff_luck'],
    'orbs': ['orb_fire', 'orb_water', 'orb_wind', 'orb_thunder', 'orb_arcane', 'orb_star', 'orb_prism'],
    'cards': ['card_blade', 'card_guard', 'card_life', 'card_star', 'card_death', 'rune_silver', 'rune_green', 'rune_purple', 'rune_gold'],
    'food': ['f_drumstick', 'f_steak', 'f_bread', 'f_apple', 'f_grapes', 'f_cheese', 'f_juice', 'f_honey', 'f_fish'],
    'tickets': ['t_bronze', 't_blue', 't_purple', 't_gold', 't_key', 't_vip'],
    'others': ['o_clover', 'o_star', 'o_star_blue', 'wing_white', 'wing_angel', 'wing_bat', 'wing_fire'],
    'drops': ['d_orb_blue', 'd_orb_fire', 'd_orb_purple', 'd_orb_green', 'd_amber', 'd_moon', 'd_feather', 'd_eye', 'd_spike', 'd_fang', 'd_horn', 'd_batwing', 'd_redfeather', 'd_flame', 'd_icecrystal', 'd_void'],
    'souls': ['s_blue', 's_red', 's_green', 's_gold', 's_purple', 's_white', 's_pink', 's_void'],
    'status': ['st_alert', 'st_question', 'st_ok', 'st_no', 'st_refresh', 'st_bag'],
    'events': ['e_wings', 'e_crown', 'e_rose', 'e_ring', 'e_tome', 'e_hourglass', 'e_snowflake', 'e_pumpkin'],
    'evolution': ['ev_green', 'ev_blue', 'ev_purple', 'ev_gold', 'ev_red', 'ev_crest', 'ev_prism'],
}
item_extra = {}
for panel, names in I_NAMES.items():
    for name, im in zip(names, I_DATA[panel]):
        item_extra['it_' + name] = im
# luvas: não existem nas pranchas; desenhadas aqui em pixel art (16x16, ampliadas 4x)
GLOVE = [
    "......oooo......",
    ".....oaaaao.....",
    "....oaaaaaaoo...",
    "...oaaaaaaaaao..",
    "...oaabaabaabo..",
    "...oaabaabaabo..",
    "...oaaaaaaaaaoo.",
    "...oaaaaaaaaaaao",
    "...oaaaaaaaaaaao",
    "...oaaaaaaaaaao.",
    "...occcccccccco.",
    "...ocddcddcddco.",
    "...occcccccccco.",
    "....oaaaaaaaao..",
    "....oaaaaaaaao..",
    ".....oooooooo...",
]
def glove(a, b, c, d):
    im = _I.new('RGBA', (16, 16), (0, 0, 0, 0))
    pal = {'o': (29, 26, 36, 255), 'a': a, 'b': b, 'c': c, 'd': d}
    for y, row in enumerate(GLOVE):
        for x, ch in enumerate(row):
            if ch in pal:
                im.putpixel((x, y), pal[ch])
    return im.resize((64, 64), _I.NEAREST)
item_extra['it_glove_leather'] = glove((150, 98, 58, 255), (110, 70, 40, 255), (200, 160, 90, 255), (240, 210, 120, 255))
item_extra['it_glove_iron'] = glove((170, 178, 190, 255), (110, 118, 130, 255), (90, 96, 110, 255), (220, 230, 240, 255))
item_extra['it_glove_rune'] = glove((80, 60, 150, 255), (50, 36, 110, 255), (220, 176, 79, 255), (140, 220, 255, 255))
item_extra['it_glove_dragon'] = glove((180, 40, 40, 255), (120, 20, 30, 255), (240, 176, 60, 255), (255, 230, 120, 255))
items7 = sorted(item_extra.items(), key=lambda t: -t[1].size[1])
x = y = row_h = 0
pl7 = []
for n, im in items7:
    w, h = im.size
    if x + w + 2 > 2048:
        x, y, row_h = 0, y + row_h + 2, 0
    pl7.append((n, im, x, y)); x += w + 2; row_h = max(row_h, h)
atlas7 = _I.new('RGBA', (2048, y + row_h), (0, 0, 0, 0))
meta7 = {}
for n, im, px_, py_ in pl7:
    atlas7.paste(im, (px_, py_))
    meta7[n] = {'scale': 1, 'faces': 1, 'frames': [[px_, py_, im.size[0], im.size[1], im.size[0] // 2, im.size[1]]], 'sheet': 4}
atlas7.save(os.path.join(ROOT, 'public', 'sprites', 'items.png'), optimize=True)
allmeta = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
allmeta.update(meta7)
json.dump(allmeta, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'itens: {atlas7.size[0]}x{atlas7.size[1]}, {len(meta7)} ícones')

# ═══════════════════ pranchas 8-11: chefes míticos, mapas, inimigos e equipamentos em camadas ═══════════════════
import mythic_cells as MY
RAR_HUE = [(0.0, 0.08, 1.15), (1.33, 1.0, 1.0), (1.6, 1.0, 1.05), (1.78, 1.0, 1.0), (1.12, 1.2, 1.1), (1.0, 1.2, 1.0), None, (1.53, 0.9, 1.3)]
RAR = MY.RARITIES + ['celestial']
my_items = {}   # nome -> (lista de (img, ax, ay), escala)

def put(name, ims, scale=1.0, center=False):
    my_items[name] = ([(im, im.size[0] // 2, im.size[1] // 2 if center else im.size[1]) for im in ims], scale)

# chefes míticos (animações completas)
MB = MY.load_bosses()
MB_H = {'infernal_dragon': 104, 'lich_king': 100, 'crystal_titan': 104, 'valkyrie': 96, 'abyss_demon': 104, 'deep_hydra': 100, 'fallen_archangel': 104}
for name, an in MB.items():
    ref = an['idle'][0]
    sc = MB_H[name] / ref.size[1]
    rax = feet(ref)[0]
    rw = ref.size[0]
    for k, frs in an.items():
        frs = frs or an['idle']
        lst = []
        for im in frs:
            ax = feet(im)[0] if im.size[0] <= rw * 1.3 else min(rax, im.size[0] - 1)
            lst.append((im, ax, im.size[1]))
        my_items[f'boss_my_{name}_{k}'] = (lst, sc)

# inimigos dos mapas (1 desenho)
ME = MY.load_enemies()
for name, lst in ME.items():
    for i, im in enumerate(lst):
        if im is not None:
            put(f'mye_{name}_{i}', [im])

# panoramas (fundo opaco)
for name, im in MY.load_maps().items():
    put(f'pano_my_{name}', [im])

# equipamentos: armas e sets (7 raridades da prancha + celestial = divino recolorido)
for (kind, r), im in MY.load_weapons().items():
    if kind == 'bow':
        continue
    put(f'gw_{kind}_{r}', [im])
    if r == 'divino':
        put(f'gw_{kind}_celestial', [recolor(im, *RAR_HUE[7])])
for (cls, r, piece), im in MY.load_sets().items():
    if cls not in ('warrior', 'assassin', 'mage') or piece == 'helmet':
        continue   # só as classes do jogo; o espaço da cabeça é o halo
    put(f'gs_{cls}_{r}_{piece}', [im])
    if r == 'divino':
        put(f'gs_{cls}_celestial_{piece}', [recolor(im, *RAR_HUE[7])])
# botas, asas e aura: 1ª linha da tabela de camadas recolorida por raridade
LY = MY.load_layers()
for key, short in (('boots', 'gb'), ('wings_back', 'gwb'), ('wings_front', 'gwf'), ('aura', 'gau')):
    base = LY.get((0, key))
    for ri, r in enumerate(RAR):
        hue = RAR_HUE[ri]
        put(f'{short}_{r}', [base if hue is None else recolor(base, *hue)])
# corpos base (boneco em camadas) + anatomia de cada quadro → src/data/paperdoll.json
import anatomy as AN
PD = {}
import split_head as SH
import hero_white as HWH
BODIES = {c: f for c, f in MY.load_bodies().items() if c in ('warrior', 'assassin', 'mage')}
# corpo base novo (32 quadros: parado, andar, correr, pular) das classes que já têm a prancha
NEW_BODY = {c: HWH.load(c) for c in HWH.available()}
for c, fr in NEW_BODY.items():
    BODIES[c] = [im for im, _, _ in fr]
with open(os.path.join(ROOT, 'src', 'data', 'newbody.json'), 'w') as f:
    json.dump(sorted(NEW_BODY), f)
for cls, frs in BODIES.items():
    if cls in NEW_BODY:
        my_items[f'pd_{cls}'] = (NEW_BODY[cls], 1.0)
    else:
        put(f'pd_{cls}', frs)
    PD[cls] = [AN.anatomy(im) for im in frs]
    neck0 = PD[cls][0]['neck']
    for im, an in zip(frs, PD[cls]):
        an['oval'] = [round(v, 1) for v in SH.face_oval(im, {**an, 'neck': neck0})]
        an['neck0'] = neck0
with open(os.path.join(ROOT, 'src', 'data', 'paperdoll.json'), 'w') as f:
    json.dump(PD, f, separators=(',', ':'))
# auréolas (halo) no lugar dos capacetes: 4 variações = 4 quadros; Celestial = Divino recolorido
for r, frs in MY.load_halos().items():
    put(f'halo_{r}', frs, center=True)
    if r == 'divino':
        put('halo_celestial', [recolor(im, *RAR_HUE[7]) for im in frs], center=True)
# montagens prontas (prévias das recompensas)
for name, im in MY.load_montages().items():
    if not name.startswith('archer'):
        put(f'mont_{name}', [im])
# efeitos dos poderes (pranchas fx-<classe>.png): fx2_<poder> com 6 quadros (metade do tamanho, centro como âncora)
import fx_cells as FXC
for sid, frs in FXC.load().items():
    sm = [im.resize((max(1, im.size[0] // 2), max(1, im.size[1] // 2)), _I.LANCZOS) for im in frs]
    put(f'fx2_{sid}', sm, center=True)
# interface do inventário (botões, bordas de raridade, indicadores)
import ui_cells as UIC
for n, im in UIC.load_ui().items():
    if n not in ('item_sel', 'tab_on', 'tab_off', 'tab_equip'):
        put(f'ui_{n}', [im])
# tíquetes dos eventos
put('it_tk_legend', [recolor(I_DATA['tickets'][3], 1.12, 1.3, 1.15)])
put('it_tk_myth', [recolor(I_DATA['tickets'][3], 1.0, 1.4, 1.0)])

items8 = [(n, i, im, ax, ay) for n, (lst, _) in my_items.items() for i, (im, ax, ay) in enumerate(lst)]
items8.sort(key=lambda t: -t[2].size[1])
x = y = row_h = 0
pl8 = []
for n, i, im, ax, ay in items8:
    w, h = im.size
    if x + w + 2 > 2048:
        x, y, row_h = 0, y + row_h + 2, 0
    pl8.append((n, i, im, ax, ay, x, y)); x += w + 2; row_h = max(row_h, h)
atlas8 = _I.new('RGBA', (2048, y + row_h), (0, 0, 0, 0))
meta8 = {n: {'scale': round(sc, 4), 'faces': 1, 'frames': [None] * len(lst), 'sheet': 5} for n, (lst, sc) in my_items.items()}
for n, i, im, ax, ay, px_, py_ in pl8:
    atlas8.paste(im, (px_, py_))
    meta8[n]['frames'][i] = [px_, py_, im.size[0], im.size[1], ax, ay]
atlas8.save(os.path.join(ROOT, 'public', 'sprites', 'mythic.png'), optimize=True)
allmeta = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
allmeta.update(meta8)

json.dump(allmeta, open(os.path.join(ROOT, 'src', 'data', 'atlas.json'), 'w'), separators=(',', ':'))
print(f'míticos+equipamentos: {atlas8.size[0]}x{atlas8.size[1]}, {len(meta8)} peças')

# ── compressão: cada sprite com a própria paleta (256 cores, sem pontilhado) e folhas em WebP sem perdas ──
# (a paleta por peça mantém os cenários sem faixas; o WebP fica ~45% menor que o PNG)
SHEET_FILES = {None: 'atlas', 1: 'scenery', 2: 'powers', 3: 'bosses', 4: 'items', 5: 'mythic'}
total = 0
for sid, fname in SHEET_FILES.items():
    png = os.path.join(ROOT, 'public', 'sprites', fname + '.png')
    sheet = _I.open(png).convert('RGBA')
    for d in allmeta.values():
        if d.get('sheet') != sid:
            continue
        for f in d['frames']:
            box = (f[0], f[1], f[0] + f[2], f[1] + f[3])
            piece = sheet.crop(box)
            if len(piece.getcolors(1 << 16) or range(257)) <= 256:
                continue
            alpha = piece.getchannel('A')
            q = piece.quantize(256, method=_I.Quantize.FASTOCTREE, dither=_I.Dither.NONE).convert('RGBA')
            q.putalpha(alpha)
            sheet.paste(q, box)
    out = os.path.join(ROOT, 'public', 'sprites', fname + '.webp')
    sheet.save(out, 'WEBP', lossless=True, method=6, quality=100)
    os.remove(png)
    total += os.path.getsize(out)
print(f'folhas em WebP: {total // 1024} KB')
