#!/usr/bin/env python3
"""Generate the extension icons (green circle + white checkmark) as PNGs
using only the Python standard library."""
import math
import struct
import zlib
from pathlib import Path

GREEN = (22, 163, 74)  # #16a34a
WHITE = (255, 255, 255)

# Checkmark polyline in unit coordinates.
CHECK = [(0.28, 0.52), (0.44, 0.68), (0.73, 0.35)]


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    c1 = vx * wx + vy * wy
    c2 = vx * vx + vy * vy
    t = 0.0 if c2 == 0 else max(0.0, min(1.0, c1 / c2))
    dx, dy = px - (ax + t * vx), py - (ay + t * vy)
    return math.hypot(dx, dy)


def smoothstep(edge0, edge1, x):
    t = max(0.0, min(1.0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)


def make_icon(size):
    cx = cy = size / 2
    radius = size * 0.47
    stroke = size * 0.085
    aa = max(1.0, size * 0.03)
    rows = []
    for y in range(size):
        row = bytearray([0])  # PNG filter byte
        for x in range(size):
            px, py = x + 0.5, y + 0.5
            d_circle = math.hypot(px - cx, py - cy) - radius
            alpha = 1.0 - smoothstep(-aa, aa, d_circle)
            if alpha <= 0:
                row += bytes((0, 0, 0, 0))
                continue
            d_check = min(
                seg_dist(px / size, py / size, *CHECK[i], *CHECK[i + 1]) * size
                for i in range(len(CHECK) - 1)
            ) - stroke
            mix = 1.0 - smoothstep(-aa, aa, d_check)
            r = round(GREEN[0] + (WHITE[0] - GREEN[0]) * mix)
            g = round(GREEN[1] + (WHITE[1] - GREEN[1]) * mix)
            b = round(GREEN[2] + (WHITE[2] - GREEN[2]) * mix)
            row += bytes((r, g, b, round(alpha * 255)))
        rows.append(bytes(row))
    return b"".join(rows)


def chunk(tag, data):
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )


def write_png(path, size):
    raw = make_icon(size)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "extension" / "shared" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        write_png(out / f"icon{size}.png", size)
