# Peças vestíveis do passe de batalha, feitas a partir das peças do jogo (mesmo encaixe no corpo):
# fogo (armadura, braços e botas), vaca (macacão, braços e botas), asas azuis de fogo e pretas grandes,
# auras de caveira e de chifres (desenho do passe) e armas neon de cada classe.
import numpy as np
from PIL import Image, ImageFilter


def _arr(im):
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    lum = (a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11) / 255
    return a, lum


def _grad(lum, stops):
    """Mapa de cores por luminância: stops = [(l, (r, g, b)), ...] em ordem."""
    out = np.zeros(lum.shape + (3,), np.float32)
    ls = [s[0] for s in stops]
    for c in range(3):
        out[..., c] = np.interp(lum, ls, [s[1][c] for s in stops])
    return out


def _out(a, rgb, keep_dark=0.13, lum=None):
    b = a.copy()
    m = lum >= keep_dark if lum is not None else np.ones(a.shape[:2], bool)
    b[..., :3][m] = rgb[m]
    return Image.fromarray(np.clip(b, 0, 255).astype(np.uint8))


def fire(im):
    a, lum = _arr(im)
    l2 = np.clip((lum - 0.1) / 0.8, 0, 1)
    rgb = _grad(l2, [(0, (70, 8, 4)), (0.35, (190, 35, 10)), (0.6, (250, 110, 20)), (0.85, (255, 200, 60)), (1, (255, 245, 170))])
    return _out(a, rgb, lum=lum)


def cow(im, seed=3, pink_feet=False):
    a, lum = _arr(im)
    H, W = lum.shape
    l2 = np.clip((lum - 0.1) / 0.8, 0, 1)
    rgb = _grad(l2, [(0, (150, 150, 155)), (0.5, (225, 225, 228)), (1, (255, 255, 255))])
    # manchas pretas (ruído grosso, longe da borda)
    rs = np.random.RandomState(seed)
    n = rs.rand(max(2, H // 7), max(2, W // 7))
    nb = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((W, H), Image.BICUBIC)) / 255
    alpha = a[..., 3] > 0
    inner = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3))) > 0
    spot = (nb > 0.66) & inner
    rgb[spot] = (35, 32, 36)
    if pink_feet:
        ys = np.nonzero(alpha.any(1))[0]
        if len(ys):
            cut = ys.max() - max(2, (ys.max() - ys.min()) // 5)
            rgb[cut:][alpha[cut:]] = (240, 150, 175)
    return _out(a, rgb, lum=lum)


def dark_wings(im):
    a, lum = _arr(im)
    l2 = np.clip((lum - 0.1) / 0.85, 0, 1)
    rgb = _grad(l2, [(0, (4, 3, 6)), (0.8, (16, 11, 22)), (0.93, (38, 22, 58)), (1, (110, 60, 175))])
    return _out(a, rgb, lum=lum)


NEON = {
    'white': ((255, 255, 255), (255, 236, 160)),   # (cor do núcleo, brilho)
    'black': ((40, 24, 60), (180, 80, 255)),
    'violet': ((215, 150, 255), (170, 60, 255)),
    'green': ((150, 255, 140), (40, 255, 60)),
    'emerald': ((170, 255, 220), (0, 240, 150)),
}


def neon(im, style, pad=3):
    core, glow = NEON[style]
    a, lum = _arr(im)
    l2 = np.clip((lum - 0.1) / 0.85, 0, 1)
    if style == 'black':
        rgb = _grad(l2, [(0, (10, 6, 18)), (0.6, core), (1, (150, 90, 220))])
    else:
        rgb = _grad(l2, [(0, tuple(c * 0.35 for c in glow)), (0.5, glow), (1, core)])
    body = _out(a, rgb, lum=lum)
    W, H = body.size
    cv = Image.new('RGBA', (W + pad * 2, H + pad * 2), (0, 0, 0, 0))
    alpha = Image.new('L', cv.size, 0)
    alpha.paste(body.getchannel('A'), (pad, pad))
    halo = alpha.filter(ImageFilter.MaxFilter(3)).filter(ImageFilter.GaussianBlur(1.6))
    g = Image.new('RGBA', cv.size, glow + (0,))
    g.putalpha(halo.point(lambda v: min(255, int(v * 0.9))))
    cv.alpha_composite(g)
    cv.alpha_composite(body, (pad, pad))
    return cv


def blue_fire_wings(im):
    a, lum = _arr(im)
    l2 = np.clip((lum - 0.1) / 0.85, 0, 1)
    rgb = _grad(l2, [(0, (8, 20, 70)), (0.6, (20, 90, 220)), (0.85, (60, 170, 255)), (1, (200, 245, 255))])
    return _out(a, rgb, lum=lum)
