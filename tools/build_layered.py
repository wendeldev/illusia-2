#!/usr/bin/env python3
"""
Gera as spritesheets em camadas ("layered sprites") de Guerreiro, Mago e Assassino.

  python3 -I tools/build_layered.py        (depois de tools/build_sprites.py)

Saída em spritesheets/<classe>/:
  body.png, hair.png, face.png                 corpo base separado em 3 camadas
  halo_<raridade>.png                          halo (auréola) nas 8 raridades — o mesmo desenho nas 4 classes
  armor_..., gloves_..., pants_..., cape_...   set da classe nas 8 raridades
  boots_<raridade>.png                          botas
  weapon_<tipo>_<raridade>.png                  armas da classe
  preview.png / preview.gif                     tudo junto (set Lendário), para conferir
Cada PNG: 8 colunas × 10 linhas de quadros 128×128 (uma linha por animação, na ordem de rig.ANIMS),
pés no ponto (64, 112) de todo quadro, fundo transparente, pixels sem suavização.
Também grava src/data/rig.json (o jogo anima o personagem com o mesmo rig).
"""
import json
import math
import os
import sys

from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anatomy as AN  # noqa: E402
import rig as RIG  # noqa: E402
import split_head as SH  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'spritesheets')
CELL, AX, AY, COLS = 128, 64, 112, 8
RARITIES = ['comum', 'incomum', 'raro', 'epico', 'lendario', 'mitico', 'divino', 'celestial']
SETS = {'warrior': 'warrior', 'assassin': 'assassin', 'mage': 'mage'}
WEAPONS = {'warrior': ['sword', 'axe', 'spear'], 'assassin': ['dagger'], 'mage': ['staff']}
NEAREST = Image.NEAREST

# ── leitura do atlas já montado (public/sprites/mythic.webp) ──
ATLAS = json.load(open(os.path.join(ROOT, 'src', 'data', 'atlas.json')))
SHEETS = {}


def sprite(name, frame=0):
    d = ATLAS[name]
    sh = d.get('sheet', 0)
    if sh not in SHEETS:
        SHEETS[sh] = Image.open(os.path.join(ROOT, 'public', 'sprites', {5: 'mythic.webp'}[sh])).convert('RGBA')
    f = d['frames'][frame]
    return SHEETS[sh].crop((f[0], f[1], f[0] + f[2], f[1] + f[3]))


# ── matrizes afins 3×3 (coordenadas de tela, y para baixo; ângulo positivo = horário) ──
def mat(a=1, b=0, c=0, d=0, e=1, f=0):
    return [[a, b, c], [d, e, f], [0, 0, 1]]


def mul(m, n):
    return [[sum(m[i][k] * n[k][j] for k in range(3)) for j in range(3)] for i in range(3)]


def tr(x, y): return mat(1, 0, x, 0, 1, y)
def sc(x, y): return mat(x, 0, 0, 0, y, 0)


def ro(deg):
    r = math.radians(deg)
    return mat(math.cos(r), -math.sin(r), 0, math.sin(r), math.cos(r), 0)


def inv(m):
    a, b, c = m[0]; d, e, f = m[1]
    det = a * e - b * d
    ia, ib, id_, ie = e / det, -b / det, -d / det, a / det
    return [[ia, ib, -(ia * c + ib * f)], [id_, ie, -(id_ * c + ie * f)], [0, 0, 1]]


def warp(src, m, size=(CELL, CELL)):
    """Desenha `src` transformada por m (src → tela), sem interpolação."""
    i = inv(m)
    return src.transform(size, Image.AFFINE, (i[0][0], i[0][1], i[0][2], i[1][0], i[1][1], i[1][2]), resample=NEAREST)


def global_m(fr):
    """Movimento do quadro: altura (sy) e rotação em torno dos pés, depois deslocamento."""
    return mul(tr(AX + fr['dx'], AY + fr['dy']), mul(ro(fr['rot']), mul(sc(1, fr['sy']), tr(-AX, -AY))))


def fit(piece, box, mode='contain', align='mid'):
    """Peça redimensionada (vizinho mais próximo) e posição para caber na caixa."""
    x0, y0, x1, y1 = box
    bw, bh = max(1, x1 - x0), max(1, y1 - y0)
    pw, ph = piece.size
    if mode == 'fill':
        w, h = bw, bh
    else:
        s = min(bw / pw, bh / ph)
        w, h = pw * s, ph * s
    w, h = max(1, round(w)), max(1, round(h))
    x = x0 + (bw - w) / 2
    y = y0 if align == 'top' else (y1 - h if align == 'bottom' else y0 + (bh - h) / 2)
    return piece.resize((w, h), NEAREST), round(x), round(y)


def paste(canvas, img, x, y):
    layer = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    layer.paste(img, (x, y), img)
    canvas.alpha_composite(layer)


WEAPON_H = {'dagger': 0.38}


class Body:
    """Corpo base de uma classe: quadros, anatomia e as caixas de cada peça (mesmas regras do jogo)."""

    def __init__(self, cls):
        self.cls = cls
        n = len(ATLAS[f'pd_{cls}']['frames'])
        self.frames = [sprite(f'pd_{cls}', i) for i in range(n)]
        self.anat = [AN.anatomy(im) for im in self.frames]
        neck0 = self.anat[0]['neck']
        self.neck0 = neck0
        self.parts = [SH.split(im, a, neck0) for im, a in zip(self.frames, self.anat)]
        self.ovals = [SH.face_oval(im, {**a, 'neck': neck0}) for im, a in zip(self.frames, self.anat)]
        self.H0 = self.anat[0]['H']

    def origin(self, fi):
        f = ATLAS[f'pd_{self.cls}']['frames'][fi]   # âncora do quadro (pés) no atlas
        return AX - round(f[4]), AY - round(f[5])

    def boxes(self, fi):
        a = self.anat[fi]
        ox, oy = self.origin(fi)
        X = lambda v: ox + v
        Y = lambda v: oy + v
        hl, hr = a['hands']; span = hr - hl
        hx0, hy0, hx1, _ = a['hips']
        cx = X((hx0 + hx1) / 2)
        neck = Y(a['neck'])
        fx0, fy0, fx1, fy1 = a['feet']
        hd = a['head']
        hand_y = Y(a['hand_y'])
        return {
            'cape': ((cx - 3 - span * 0.46, neck - 1, cx - 3 + span * 0.46, Y(fy0) - 1), 'fill', 'top'),
            'pants': ((X(hx0) - 3, Y(hy0) - 1, X(hx1) + 3, Y(fy0) + 1), 'fill', 'top'),
            'boots': ((X(fx0) - 1, Y(fy0) - 4, X(fx1) + 1, Y(fy1) + 1), 'fill', 'top'),
            'armor': ((cx - span * 0.5, neck - 2, cx + span * 0.5, Y(hy0) + 3), 'fill', 'top'),
            'gloves': ((X(hl) - 1, hand_y - 6, X(hr) + 1, hand_y + 2), 'fill', 'top'),
            'hand': (X(hr) - 2, hand_y + 1),
        }

    def layer_frame(self, layer, fr, piece=None):
        """Um quadro 128×128 de uma camada do corpo (body/hair/face ou peça) já com o movimento do quadro."""
        fi = fr['f']
        cv = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
        ox, oy = self.origin(fi)
        if layer in ('body', 'hair', 'face'):
            paste(cv, self.parts[fi][('body', 'hair', 'face').index(layer)], ox, oy)
        elif layer == 'halo':
            # anel centrado no rosto, logo acima do cabelo (mesma regra do jogo: HALO_LIFT)
            name, frames = piece
            img0 = frames[fr['_i'] % len(frames)]
            hx0, hy0, hx1, _ = self.anat[fi]['head']
            w = (hx1 - hx0) * HALO_W.get(name, 1.05)
            h = w * img0.size[1] / img0.size[0]
            cx = ox + self.ovals[fi][0]
            cy = oy + hy0 - w * (HALO_LIFT + HALO_LIFT_CLS.get(self.cls, 0)) + math.sin(fr['_i'] * 1.4) * 0.8
            img = img0.resize((max(1, round(w)), max(1, round(h))), NEAREST)
            paste(cv, img, round(cx - w / 2), round(cy - h / 2))
        else:
            box, mode, align = self.boxes(fi)[layer]
            img, x, y = fit(piece, box, mode, align)
            paste(cv, img, x, y)
        return warp(cv, global_m(fr))

    def weapon_frame(self, kind, wimg, fr, wf):
        hx, hy = self.boxes(fr['f'])['hand']
        wh = self.H0 * WEAPON_H.get(kind, 0.5)
        ww = wimg.size[0] / wimg.size[1] * wh
        img = wimg.resize((max(1, round(ww)), max(1, round(wh))), NEAREST)
        # pivô no cabo (embaixo à esquerda do desenho)
        local = mul(tr(hx + wf['t'], hy), mul(ro(wf['w']), tr(-img.size[0] * 0.14, -img.size[1] * 0.88)))
        return warp(img, mul(global_m(fr), local))


ORDER = ['cape', 'body', 'face', 'hair', 'pants', 'boots', 'armor', 'gloves', 'weapon', 'halo']
# largura do halo em relação à largura da cabeça (o anel simples é estreito; com asas abre mais) — igual ao jogo
HALO_LIFT = 0.2
HALO_LIFT_CLS = {'mage': 0.16, 'assassin': 0.16}
HALO_W = {'comum': 0.72, 'incomum': 0.95, 'raro': 1.05, 'epico': 1.05, 'lendario': 1.05, 'mitico': 1.05, 'divino': 1.12, 'celestial': 1.12}


def sheet(frames_by_anim):
    out = Image.new('RGBA', (CELL * COLS, CELL * len(RIG.ANIMS)), (0, 0, 0, 0))
    for r, (name, n) in enumerate(RIG.ANIMS):
        for c, im in enumerate(frames_by_anim[name]):
            out.paste(im, (c * CELL, r * CELL))
    return out


def build_class(cls):
    B = Body(cls)
    rig = RIG.body_rig(cls)
    d = os.path.join(OUT, cls)
    os.makedirs(d, exist_ok=True)
    files = []

    def save(name, fn):
        frames = {a: [fn(fr, i, a) for i, fr in enumerate(rig[a])] for a, _ in RIG.ANIMS}
        sheet(frames).save(os.path.join(d, name + '.png'), optimize=True)
        files.append(name)
        return frames

    layers = {}
    for base in ('body', 'hair', 'face'):
        layers[base] = save(base, lambda fr, i, a, base=base: B.layer_frame(base, fr))
    set_cls = SETS[cls]
    # halo: igual para todas as classes (4 quadros de brilho, acompanhando a cabeça)
    for r in RARITIES:
        n = len(ATLAS[f'halo_{r}']['frames'])
        hp = (r, [sprite(f'halo_{r}', k) for k in range(n)])
        fr_h = save(f'halo_{r}', lambda fr, i, a, hp=hp: B.layer_frame('halo', {**fr, '_i': i}, hp))
        if r == 'lendario':
            layers['halo'] = fr_h
    for piece, part in (('armor', 'armor'), ('gloves', 'arms'), ('pants', 'pants'), ('cape', 'cape')):
        for r in RARITIES:
            img = sprite(f'gs_{set_cls}_{r}_{part}')
            fr_ = save(f'{piece}_{r}', lambda fr, i, a, piece=piece, img=img: B.layer_frame(piece, fr, img))
            if r == 'lendario':
                layers[piece] = fr_
    for r in RARITIES:
        img = sprite(f'gb_{r}')
        fr_ = save(f'boots_{r}', lambda fr, i, a, img=img: B.layer_frame('boots', fr, img))
        if r == 'lendario':
            layers['boots'] = fr_
    for kind in WEAPONS[cls]:
        wrig = RIG.weapon_rig(RIG.STYLE_OF[kind])
        for r in RARITIES:
            img = sprite(f'gw_{kind}_{r}')
            fr_ = save(f'weapon_{kind}_{r}', lambda fr, i, a, img=img, kind=kind, wrig=wrig: B.weapon_frame(kind, img, fr, wrig[a][i]))
            if r == 'lendario' and kind == WEAPONS[cls][0]:
                layers['weapon'] = fr_
    # prévia: todas as camadas na ordem de desenho
    order = ORDER
    comp = {}
    for a, n in RIG.ANIMS:
        comp[a] = []
        for i in range(n):
            im = Image.new('RGBA', (CELL, CELL), (0, 0, 0, 0))
            for k in order:
                im.alpha_composite(layers[k][a][i])
            comp[a].append(im)
    sheet(comp).save(os.path.join(d, 'preview.png'), optimize=True)
    # GIF animado (2×) com todas as animações em sequência
    gif = []
    for a, n in RIG.ANIMS:
        for _ in range(2 if a in RIG.LOOP else 1):
            for im in comp[a]:
                bg = Image.new('RGBA', (CELL, CELL), (34, 38, 56, 255))
                bg.alpha_composite(im)
                gif.append(bg.resize((CELL * 2, CELL * 2), NEAREST).convert('P', palette=Image.ADAPTIVE))
    gif[0].save(os.path.join(d, 'preview.gif'), save_all=True, append_images=gif[1:], duration=90, loop=0)
    return comp, files


def overview(comps):
    """Prancha de conferência no formato da referência: classe × animações (2 quadros cada)."""
    names = {'warrior': 'Guerreiro', 'mage': 'Mago', 'assassin': 'Assassino'}
    label_w, cell = 150, 96
    W = label_w + sum((2 if n > 1 else 1) * cell for _, n in RIG.ANIMS)
    H = 30 + len(comps) * (cell + 10)
    out = Image.new('RGBA', (W, H), (14, 12, 20, 255))
    dr = ImageDraw.Draw(out)
    try:
        font = ImageFont.load_default(size=14)
    except TypeError:
        font = ImageFont.load_default()
    x = label_w
    for a, n in RIG.ANIMS:
        dr.text((x + 6, 8), f'{RIG.NAMES_PT[a]} ({n})', fill=(255, 220, 110), font=font)
        x += 2 * cell
    for r, cls in enumerate(['warrior', 'mage', 'assassin']):
        y = 30 + r * (cell + 10)
        dr.rectangle((4, y, W - 4, y + cell), outline=(150, 110, 40))
        dr.text((12, y + cell // 2 - 8), names[cls], fill=(255, 255, 255), font=font)
        x = label_w
        for a, n in RIG.ANIMS:
            for k in (0, n // 2):
                im = comps[cls][a][k].crop((16, 16, 112, 112))
                out.alpha_composite(im, (x, y))
                x += cell
    out.save(os.path.join(OUT, 'preview_all.png'), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    comps, manifest = {}, {}
    for cls in RIG.CLASSES:
        comps[cls], manifest[cls] = build_class(cls)
        print(cls, len(manifest[cls]), 'folhas')
    overview(comps)
    meta = {
        'frame': [CELL, CELL], 'feet': [AX, AY], 'columns': COLS,
        'animations': [{'name': n, 'row': i, 'frames': c, 'fps': RIG.FPS[n], 'loop': n in RIG.LOOP} for i, (n, c) in enumerate(RIG.ANIMS)],
        'drawOrder': ORDER,
        'nota': 'O halo (halo_<raridade>) é o mesmo nas 4 classes e fica por último, flutuando acima da cabeça.',
        'rarities': RARITIES, 'files': manifest,
    }
    json.dump(meta, open(os.path.join(OUT, 'layers.json'), 'w'), indent=1, ensure_ascii=False)
    json.dump(RIG.full_rig(), open(os.path.join(ROOT, 'src', 'data', 'rig.json'), 'w'), separators=(',', ':'))
    print('ok →', OUT)


if __name__ == '__main__':
    main()
