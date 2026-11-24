# Rig das animações em camadas: o mesmo movimento para todas as camadas (corpo, cabelo, rosto,
# capacete, armadura, luvas, calças, botas, capa) e um movimento de arma por estilo de arma.
# Usado por tools/build_layered.py (gera as spritesheets) e pelo jogo (src/data/rig.json).
#
# Corpo, por quadro: f = quadro do corpo base (0..4), dx/dy = deslocamento (px), sy = altura (1 = normal),
# rot = rotação em graus em torno dos pés (negativo = para trás).
# Arma, por quadro: w = ângulo em graus em relação ao desenho (horário positivo), t = estocada para a frente (px).

ANIMS = [('idle', 4), ('walk', 8), ('run', 8), ('jump', 4), ('fall', 4),
         ('atk1', 6), ('atk2', 6), ('atk3', 8), ('hurt', 4), ('death', 8)]
NAMES_PT = {'idle': 'Idle', 'walk': 'Andar', 'run': 'Correr', 'jump': 'Pular', 'fall': 'Cair',
            'atk1': 'Ataque 1', 'atk2': 'Ataque 2', 'atk3': 'Ataque 3', 'hurt': 'Dano', 'death': 'Morte'}
FPS = {'idle': 6, 'walk': 12, 'run': 16, 'jump': 10, 'fall': 10, 'atk1': 16, 'atk2': 16, 'atk3': 16, 'hurt': 12, 'death': 10}
LOOP = {'idle', 'walk', 'run', 'fall'}

# quadros de passada de cada classe (os quadros 3 e 4 da Maga e do Arqueiro mudam o penteado)
STRIDE = {'warrior': [1, 2, 3, 4], 'assassin': [1, 2, 3, 4], 'mage': [0, 1, 2, 1]}


import json as _json
import os as _os
_NB = _os.path.join(_os.path.dirname(_os.path.dirname(_os.path.abspath(__file__))), 'src', 'data', 'newbody.json')
NEW_BODY = set(_json.load(open(_NB))) if _os.path.exists(_NB) else {'warrior'}


def new_body_rig():
    """Corpo base novo (prancha 4×8 de cada classe): 0-7 parado, 8-15 andar,
    16-23 correr, 24-31 pular (24 de pé, 25 agacha, 26 impulso, 27 subindo, 28 encolhido, 29 descendo,
    30 retomada/pouso, 31 de pé). O movimento vem dos próprios desenhos (sem balanço artificial)."""
    fr = lambda f, **k: {'f': f, 'dx': 0, 'dy': 0, 'sy': 1.0, 'rot': 0, **k}
    return {
        'idle': [fr(f) for f in (0, 1, 2, 7)],
        'walk': [fr(8 + i) for i in range(8)],
        'run': [fr(16 + i) for i in range(8)],
        'jump': [fr(f) for f in (25, 26, 27, 28)],
        'fall': [fr(f) for f in (28, 29, 29, 29)],
        'land': [fr(f) for f in (30, 30, 31, 0)],
        'atk1': [fr(f, dx=x) for f, x in zip((0, 0, 10, 10, 10, 0), (0, -1, 2, 4, 3, 1))],
        'atk2': [fr(f, dx=x) for f, x in zip((14, 14, 10, 10, 14, 0), (0, 1, 3, 4, 2, 0))],
        'atk3': [fr(f, dx=x, dy=d) for f, x, d in zip((0, 25, 25, 26, 18, 18, 30, 0), (0, -2, -1, 3, 6, 6, 3, 1), (0, 0, 0, -4, -2, 0, 0, 0))],
        'hurt': [fr(0, dx=x, dy=d) for x, d in ((-2, 0), (-3, -1), (-2, 0), (-1, 0))],
        'death': [fr(f, dx=x, rot=r) for f, x, r in zip((0, 30, 30, 30, 30, 30, 30, 30), (-1, -2, -3, -4, -4, -4, -4, -4), (0, -8, -20, -40, -60, -80, -90, -90))],
    }


def body_rig(cls):
    if cls in NEW_BODY:
        return new_body_rig()
    S = STRIDE[cls]
    # "quadro 2" e "quadro 3" = passos da passada da classe (Maga/Arqueiro: 1 e 2)
    F = {0: 0, 2: S[1], 3: S[2]}

    def fr(**k):
        d = {'f': 0, 'dx': 0, 'dy': 0, 'sy': 1.0, 'rot': 0, **k}
        if 'f' in k and k.get('_raw') is None:
            d['f'] = F.get(k['f'], k['f'])
        d.pop('_raw', None)
        return d
    walk = [fr(f=S[i // 2], _raw=1, dy=-(i % 2)) for i in range(8)]
    run = [fr(f=S[(i // 2 + 1) % 4], _raw=1, dx=1, dy=[0, -2, -1, 0][i % 4]) for i in range(8)]
    return {
        'idle': [fr(dy=d) for d in (0, -1, -1, 0)],
        'walk': walk,
        'run': run,
        'jump': [fr(f=f, dy=d, sy=s) for f, d, s in ((2, 0, 0.92), (2, -1, 1.06), (3, -2, 1.05), (3, -2, 1.02))],
        'fall': [fr(f=3, dy=d, sy=s) for d, s in ((0, 1.0), (0, 0.98), (-1, 1.0), (0, 0.98))],
        'atk1': [fr(f=f, dx=x) for f, x in zip((0, 0, 2, 2, 2, 0), (0, -1, 2, 4, 3, 1))],
        'atk2': [fr(f=f, dx=x) for f, x in zip((3, 3, 2, 2, 3, 0), (0, 1, 3, 4, 2, 0))],
        'atk3': [fr(f=f, dx=x, dy=d) for f, x, d in zip((0, 3, 3, 2, 2, 2, 0, 0), (0, -2, -1, 3, 6, 6, 3, 1), (0, 0, -2, -4, -2, 0, 0, 0))],
        'hurt': [fr(dx=x, dy=d) for x, d in ((-2, 0), (-3, -1), (-2, 0), (-1, 0))],
        'death': [fr(dx=x, rot=r) for x, r in zip((-1, -2, -3, -4, -4, -4, -4, -4), (0, -8, -20, -40, -60, -80, -90, -90))],
    }


def weapon_rig(style):
    w = lambda ws, ts=None: [{'w': a, 't': (ts[i] if ts else 0)} for i, a in enumerate(ws)]
    base = {
        'idle': w([-8, -6, -4, -6]),
        'walk': w([-10, -6, -2, -6, -10, -6, -2, -6]),
        'run': w([-40, -42, -44, -42, -40, -42, -44, -42]),
        'jump': w([-20, -35, -45, -45]),
        'fall': w([-30, -25, -20, -25]),
        'hurt': w([20, 30, 25, 10]),
        'death': w([30, 50, 80, 110, 130, 135, 135, 135]),
    }
    if style == 'staff':
        base.update({
            'idle': w([-25, -24, -22, -24]),
            'atk1': w([-30, -40, 10, 30, 20, 0], [0, -2, 4, 7, 5, 2]),
            'atk2': w([-60, -90, -110, -20, 30, 0]),
            'atk3': w([-60, -90, -120, -160, -200, -250, -300, -340], [0, 0, 0, 2, 2, 2, 0, 0]),
        })
    elif style == 'spear':
        base.update({
            'atk1': w([30, 40, 45, 45, 45, 30], [0, -3, 6, 10, 8, 2]),
            'atk2': w([45, 45, 45, 45, 40, 30], [0, 8, 2, 10, 6, 2]),
            'atk3': w([-20, -60, -100, 40, 45, 45, 45, 30], [0, 0, 0, 4, 10, 12, 8, 2]),
        })
    else:  # golpes cortantes (espada, machado, adaga)
        base.update({
            'atk1': w([-110, -130, -40, 40, 55, 20]),
            'atk2': w([50, 60, -10, -90, -100, -40]),
            'atk3': w([-100, -140, -200, -260, -320, -380, 20, 30]),
        })
    return base


STYLE_OF = {'sword': 'slash', 'axe': 'slash', 'dagger': 'slash', 'spear': 'spear', 'staff': 'staff'}
CLASSES = ['warrior', 'assassin', 'mage']


def full_rig():
    return {
        'anims': [[n, c] for n, c in ANIMS], 'fps': FPS, 'loop': sorted(LOOP),
        'body': {c: body_rig(c) for c in CLASSES},
        'weapon': {s: weapon_rig(s) for s in ('slash', 'spear', 'staff')},
        'styleOf': STYLE_OF,
    }
