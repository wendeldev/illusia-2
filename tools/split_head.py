# Separa o corpo base em 3 camadas: corpo (com a pele da cabeça), cabelo e rosto (olhos, sobrancelhas, boca).
# Pela geometria: a oval do rosto fica na frente e embaixo da cabeça (visão lateral, virado para a direita).
import colorsys
from PIL import Image


def face_oval(im, a):
    px = im.load()
    neck = a['neck']
    hx0, _, hx1, _ = a['head']
    v = lambda c: max(c[:3]) / 255
    eyes = [(x, y) for y in range(int(neck * 0.58), neck - 3) for x in range(hx0 + int((hx1 - hx0) * 0.28), hx1 - 1)
            if px[x, y][3] > 40 and v(px[x, y]) < 0.42]
    ex0 = min(x for x, _ in eyes) if eyes else hx0 + (hx1 - hx0) // 3
    ey0 = min(y for _, y in eyes) if eyes else int(neck * 0.55)
    x0, x1 = ex0 - 3, hx1 - 2
    y0, y1 = ey0 - 3, neck + 1
    return (x0 + x1) / 2, (y0 + y1) / 2, max(4, (x1 - x0) / 2), max(4, (y1 - y0) / 2)


def eye_line(im, a, neck=None):
    """Linha dos olhos: a linha da frente do rosto com mais pixels escuros (olhos são grossos e escuros)."""
    px = im.load()
    neck = neck if neck is not None else a['neck']
    hx0, _, hx1, _ = a['head']
    v = lambda c: max(c[:3]) / 255
    best, by = -1, int(neck * 0.7)
    for y in range(int(neck * 0.5), neck - 2):
        n = sum(1 for x in range(hx0 + int((hx1 - hx0) * 0.35), hx1 - 2) if px[x, y][3] > 40 and v(px[x, y]) < 0.42)
        if n > best:
            best, by = n, y
    return by


def split(im, a, neck=None):
    W, H = im.size
    px = im.load()
    neck = neck if neck is not None else a['neck']
    cx, cy, rx, ry = face_oval(im, {**a, 'neck': neck})
    body, hair, face = (Image.new('RGBA', (W, H), (0, 0, 0, 0)) for _ in range(3))
    pb, ph, pf = body.load(), hair.load(), face.load()
    for y in range(H):
        for x in range(W):
            c = px[x, y]
            if c[3] <= 10:
                continue
            if y >= neck:
                pb[x, y] = c
                continue
            inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1
            if not inside:
                ph[x, y] = c
                continue
            h, s, v = colorsys.rgb_to_hsv(c[0] / 255, c[1] / 255, c[2] / 255)
            if v < 0.66 or (s > 0.5 and (h < 0.03 or h > 0.9)):
                pf[x, y] = c   # olhos, sobrancelhas, boca
            else:
                pb[x, y] = c   # pele
    return body, hair, face
