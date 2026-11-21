# Elementos de interface da prancha de inventário (assets-src/sheet-inventory.png): botões, bordas de raridade,
# estados de espaço/item, ícones dos filtros e das abas. O logo da prancha não é usado.
import os
from collections import deque

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# nome: (x0, y0, x1, y1) na prancha 1536×1024
UI = {
    # botões
    'btn_equip': (31, 611, 151, 657), 'btn_unequip': (157, 611, 274, 657), 'btn_use': (282, 611, 382, 657),
    'btn_details': (389, 611, 491, 657), 'btn_sort': (498, 611, 610, 657), 'btn_sell': (617, 611, 713, 657),
    'btn_split': (720, 611, 800, 657), 'btn_plus': (807, 611, 849, 657), 'btn_minus': (856, 611, 898, 657),
    'btn_trash': (904, 611, 954, 657),
    # filtros (o 1º, "Tudo", vermelho = selecionado)
    'flt_all': (980, 607, 1064, 659), 'flt_weapon': (1070, 607, 1139, 659), 'flt_armor': (1145, 607, 1214, 659),
    'flt_helmet': (1220, 607, 1289, 659), 'flt_ring': (1295, 607, 1364, 659), 'flt_wings': (1370, 607, 1439, 659),
    'flt_gem': (1445, 607, 1513, 659),
    # espaços
    'slot_empty': (19, 721, 88, 791), 'slot_sel': (93, 721, 163, 791), 'slot_lock': (244, 721, 312, 791),
    'slot_off': (318, 721, 387, 791),
    # bordas de raridade (comum → divino)
    'rar_0': (423, 731, 489, 798), 'rar_1': (493, 731, 559, 798), 'rar_2': (562, 731, 628, 798),
    'rar_3': (630, 731, 696, 798), 'rar_4': (698, 731, 764, 798), 'rar_5': (766, 731, 832, 798),
    'rar_6': (835, 731, 901, 798),
    # indicadores de item
    'badge_e': (290, 896, 319, 924), 'badge_n': (388, 896, 417, 924),
    'arrow_up': (573, 942, 600, 975), 'arrow_down': (668, 942, 693, 977),
    'item_sel': (130, 895, 217, 978),
    # setas de página
    'nav_left': (1391, 910, 1443, 979), 'nav_right': (1461, 910, 1513, 979),
    # topo: título, moedas, fechar
    'title_inv': (290, 2, 622, 66), 'coin': (693, 10, 742, 58), 'gem_blue': (958, 10, 1008, 58),
    'gem_red': (1205, 10, 1255, 58), 'btn_close': (1448, 2, 1518, 66),
    # ícones das abas da esquerda
    'tab_equip': (24, 122, 74, 174), 'tab_items': (24, 198, 74, 252), 'tab_mats': (24, 272, 74, 326),
    'tab_cons': (20, 340, 78, 402), 'tab_other': (20, 414, 78, 474),
    # aba (fundo vermelho = selecionada, escura = normal)
    'tab_on': (14, 116, 194, 182), 'tab_off': (14, 412, 194, 478),
}
# ícones das abas ficam sobre o fundo da aba: recorte por cor (sem o fundo)
ICON_ONLY = {'tab_equip', 'tab_items', 'tab_mats', 'tab_cons', 'tab_other', 'coin', 'gem_blue', 'gem_red',
             'badge_e', 'badge_n', 'arrow_up', 'arrow_down'}


def clear_bg(im, thr=42, seed_all_edges=True):
    """Fundo escuro ligado às bordas do recorte → transparente."""
    im = im.convert('RGBA')
    W, H = im.size
    px = im.load()
    dark = lambda c: max(c[:3]) < thr
    seen = set()
    q = deque((x, y) for x in range(W) for y in (0, H - 1)) if seed_all_edges else deque()
    q.extend((x, y) for y in range(H) for x in (0, W - 1))
    while q:
        x, y = q.popleft()
        if (x, y) in seen or not (0 <= x < W and 0 <= y < H) or not dark(px[x, y]):
            continue
        seen.add((x, y))
        px[x, y] = (0, 0, 0, 0)
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return im


def by_color(im, sat=0.25, val=0.45):
    """Só o desenho colorido/claro (ícones sobre fundo de botão)."""
    import colorsys
    im = im.convert('RGBA')
    px = im.load()
    W, H = im.size
    for y in range(H):
        for x in range(W):
            r, g, b, _ = px[x, y]
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if not (v > val and (s > sat or v > 0.8)):
                px[x, y] = (0, 0, 0, 0)
    bb = im.getbbox()
    return im.crop(bb) if bb else im


def load_ui():
    S = Image.open(os.path.join(ROOT, 'assets-src', 'sheet-inventory.png')).convert('RGBA')
    out = {}
    for name, box in UI.items():
        im = S.crop(box)
        out[name] = by_color(im) if name in ICON_ONLY else clear_bg(im)
    return out
