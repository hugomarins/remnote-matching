"""Marketplace logo for Matching Cards: the queue's board in miniature.

Rows of a left piece (tab on its right edge) and a right piece (socket in its
left edge), as drawn by src/style.css. Top row connected (dark stripes), middle
piece being dragged in, bottom row apart (light stripes).

Usage (needs Pillow): python3 assets/logo.py public/logo.png
"""
import sys
from PIL import Image, ImageDraw, ImageFilter

OUT = sys.argv[1]
SIZE, K = 414, 4  # final size, supersampling
S = SIZE * K

SURFACE = (255, 255, 255, 255)
BORDER = (151, 162, 176, 255)
IDLE = (167, 203, 233, 255)   # --mc-idle
ON = (11, 103, 176, 255)      # --mc-on
TEXT = (203, 210, 219, 255)

ROW_H, ROW_GAP = 82, 30
LEFT_W, RIGHT_W, GAP = 132, 172, 36
STRIPE, TAB, BW, RAD = 15, 15, 2.5, 4
TOP = (SIZE - (3 * ROW_H + 2 * ROW_GAP)) / 2
X0 = (SIZE - (LEFT_W + GAP + RIGHT_W)) / 2

k = lambda v: round(v * K)


def text_lines(d, x0, x1, y, h):
    """Two grey bars standing for the piece's text."""
    cy, t = y + h / 2, 7
    for dy, frac in ((-11, 1.0), (11, 0.62)):
        d.rounded_rectangle([k(x0), k(cy + dy - t / 2), k(x0 + (x1 - x0) * frac), k(cy + dy + t / 2)], radius=k(t / 2), fill=TEXT)


def left_piece(x, y, stripe):
    """Its own layer: body, stripe on the left, half-disc tab on the right edge."""
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    r = [k(x), k(y), k(x + LEFT_W), k(y + ROW_H)]
    d.rounded_rectangle(r, radius=k(RAD), fill=SURFACE, outline=BORDER, width=k(BW))
    cx, cy = x + LEFT_W, y + ROW_H / 2
    d.ellipse([k(cx - TAB), k(cy - TAB), k(cx + TAB), k(cy + TAB)], fill=SURFACE, outline=BORDER, width=k(BW))
    # Hide the half of the tab's rim that lies inside the body.
    d.rectangle([k(cx - TAB - 1), k(cy - TAB + BW), k(cx - BW / 2), k(cy + TAB - BW)], fill=SURFACE)
    d.rounded_rectangle([k(x), k(y), k(x + STRIPE), k(y + ROW_H)], radius=k(RAD), fill=stripe)
    d.rectangle([k(x + RAD), k(y), k(x + STRIPE), k(y + ROW_H)], fill=stripe)
    text_lines(d, x + STRIPE + 14, x + LEFT_W - TAB - 12, y, ROW_H)
    return layer


def right_piece(x, y, stripe):
    """Its own layer: body with a real hole for the socket, stripe on the right."""
    layer = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle([k(x), k(y), k(x + RIGHT_W), k(y + ROW_H)], radius=k(RAD), fill=SURFACE, outline=BORDER, width=k(BW))
    d.rounded_rectangle([k(x + RIGHT_W - STRIPE), k(y), k(x + RIGHT_W), k(y + ROW_H)], radius=k(RAD), fill=stripe)
    d.rectangle([k(x + RIGHT_W - STRIPE), k(y), k(x + RIGHT_W - RAD), k(y + ROW_H)], fill=stripe)
    cy, rr = y + ROW_H / 2, TAB + 2
    d.ellipse([k(x - rr), k(cy - rr), k(x + rr), k(cy + rr)], fill=(0, 0, 0, 0))  # the hole
    d.arc([k(x - rr), k(cy - rr), k(x + rr), k(cy + rr)], start=-90, end=90, fill=BORDER, width=k(BW))
    text_lines(d, x + TAB + 16, x + RIGHT_W - STRIPE - 14, y, ROW_H)
    return layer


def shadow(layer, dx, dy, blur, alpha):
    a = layer.getchannel('A').point(lambda v: v * alpha // 255)
    sh = Image.new('RGBA', (S, S), (15, 23, 42, 0))
    sh.putalpha(a)
    sh = sh.transform((S, S), Image.AFFINE, (1, 0, -k(dx), 0, 1, -k(dy)))
    return sh.filter(ImageFilter.GaussianBlur(k(blur)))


img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
rows = [
    ('connected', ON),
    ('dragging', IDLE),
    ('apart', IDLE),
]
for i, (state, stripe) in enumerate(rows):
    y = TOP + i * (ROW_H + ROW_GAP)
    right = right_piece(X0 + LEFT_W + GAP, y, stripe)
    img.alpha_composite(shadow(right, 0, 1.5, 2, 70))
    img.alpha_composite(right)
    if state == 'connected':
        left = left_piece(X0 + GAP, y, stripe)  # slid into the socket
        img.alpha_composite(left)
    elif state == 'dragging':
        left = left_piece(X0 + 14, y - 9, stripe)  # lifted, on its way
        img.alpha_composite(shadow(left, 4, 10, 9, 110))
        img.alpha_composite(left)
    else:
        left = left_piece(X0, y, stripe)
        img.alpha_composite(shadow(left, 0, 1.5, 2, 70))
        img.alpha_composite(left)

img.resize((SIZE, SIZE), Image.LANCZOS).save(OUT, optimize=True)
print('wrote', OUT)
