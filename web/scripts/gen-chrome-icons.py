#!/usr/bin/env python3
"""Generate the Chrome (full) extension's rounded-corner icon set.

Source of truth: the blue-background PWA master. Each output size is resized
(LANCZOS) and given an anti-aliased rounded-rectangle alpha mask, so the corners
are transparent — Chrome renders extension icons as-is (it does NOT round them),
so the rounding must be baked into the PNG.

Output: chrome/full-icons/icon-<size>.png  (committed; build copies it to icons/)
Run:    python3 scripts/gen-chrome-icons.py   (from web/)
"""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))           # web/scripts
WEB = os.path.dirname(HERE)                                 # web
REPO = os.path.dirname(WEB)                                 # repo root

MASTER = os.path.join(WEB, "assets/images/logo/pwa-icons/icon-512.png")
OUT_DIR = os.path.join(REPO, "chrome", "full-icons")

SIZES = [16, 32, 48, 128, 192, 512]
RADIUS_RATIO = 0.22   # ~iOS/Big-Sur corner softness
SS = 4                # supersample factor for smooth, anti-aliased corners


def rounded(img, size):
    """Return `img` resized to size×size with rounded, transparent corners."""
    base = img.convert("RGBA").resize((size, size), Image.LANCZOS)

    # Build the mask at SS× resolution, then downscale → anti-aliased edge.
    big = size * SS
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, big - 1, big - 1],
        radius=int(round(big * RADIUS_RATIO)),
        fill=255,
    )
    mask = mask.resize((size, size), Image.LANCZOS)

    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(base, (0, 0), mask)
    return out


def main():
    if not os.path.exists(MASTER):
        raise SystemExit(f"master icon not found: {MASTER}")
    os.makedirs(OUT_DIR, exist_ok=True)
    master = Image.open(MASTER)
    for s in SIZES:
        rounded(master, s).save(os.path.join(OUT_DIR, f"icon-{s}.png"))
        print(f"generated icon-{s}.png")
    print(f"done → {OUT_DIR}")


if __name__ == "__main__":
    main()
