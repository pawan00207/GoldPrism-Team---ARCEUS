#!/usr/bin/env python3
"""
Cut a near-white background out of a flat cartoon PNG -> transparent PNG.

Usage: python scripts/cutout_white.py <input.png> <output.png> [--threshold 245] [--feather 3]

Strategy:
  1. Pixels whose min(R,G,B) >= threshold are background (near-white).
  2. Flood-fill from the borders so interior white highlights (eyes, ingot
     glints) are preserved.
  3. Feather the alpha edge by `feather` px for smooth compositing.
"""

import argparse
import sys
from collections import deque

from PIL import Image, ImageFilter


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("input")
    ap.add_argument("output")
    ap.add_argument("--threshold", type=int, default=232)
    ap.add_argument("--feather", type=int, default=2)
    args = ap.parse_args()

    img = Image.open(args.input).convert("RGBA")
    w, h = img.size
    px = img.load()
    thr = args.threshold

    def is_bg(p):
        return min(p[0], p[1], p[2]) >= thr

    # Flood fill from every border pixel so interior whites survive
    visited = bytearray(w * h)
    q = deque()

    def idx(x, y):
        return y * w + x

    for x in range(w):
        for y in (0, h - 1):
            if is_bg(px[x, y]):
                q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(px[x, y]):
                q.append((x, y))

    while q:
        x, y = q.popleft()
        i = idx(x, y)
        if visited[i]:
            continue
        visited[i] = 1
        px[x, y] = (px[x, y][0], px[x, y][1], px[x, y][2], 0)
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not visited[idx(nx, ny)] and is_bg(px[nx, ny]):
                q.append((nx, ny))

    # Feather alpha edge
    r, g, b, a = img.split()
    a = a.filter(ImageFilter.GaussianBlur(args.feather / 2))
    img = Image.merge("RGBA", (r, g, b, a))

    img.save(args.output)
    print(f"[cutout] wrote {args.output} ({w}x{h})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
