"""Renders the PNG app icons from public/icons/icon.svg.

The PNGs are committed, so run this only when the icon changes:

    python3 scripts/make-icons.py      # needs Pillow (pip install pillow)

It understands just the subset of SVG that icon.svg uses: <rect>, <circle>, and a
<g transform="rotate(a cx cy)"> holding <path>s made of M/L/C/Z commands with
fill, stroke and stroke-width. Keep icon.svg within that subset.
"""
import math
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw

ICONS = Path(__file__).resolve().parent.parent / "public" / "icons"
OUTPUTS = {"apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512}
SUPERSAMPLE = 4
NS = "{http://www.w3.org/2000/svg}"


def cubic(p0, p1, p2, p3, steps=16):
    for i in range(1, steps + 1):
        t = i / steps
        u = 1 - t
        yield (
            u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
            u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
        )


def path_points(d):
    tokens = re.findall(r"[MLCZ]|-?\d+(?:\.\d+)?", d)
    points, cmd, i = [], None, 0
    while i < len(tokens):
        if tokens[i] in "MLCZ":
            cmd = tokens[i]
            i += 1
            if cmd == "Z":
                continue
        nums = [float(n) for n in tokens[i : i + (6 if cmd == "C" else 2)]]
        i += len(nums)
        if cmd == "C":
            points.extend(cubic(points[-1], nums[0:2], nums[2:4], nums[4:6]))
        else:
            points.append((nums[0], nums[1]))
    return points


def rotate(points, transform):
    m = re.match(r"rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)", transform or "")
    if not m:
        return points
    a, cx, cy = (float(v) for v in m.groups())
    r = math.radians(a)
    c, s = math.cos(r), math.sin(r)
    return [(cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c) for x, y in points]


def render(svg_path, size):
    root = ET.parse(svg_path).getroot()
    view = float(root.get("viewBox").split()[2])
    k = size * SUPERSAMPLE / view
    img = Image.new("RGBA", (size * SUPERSAMPLE,) * 2, (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    def scaled(points):
        return [(x * k, y * k) for x, y in points]

    for el in root.iter():
        tag = el.tag.replace(NS, "")
        if tag == "rect":
            w, h = float(el.get("width")), float(el.get("height"))
            draw.rectangle([0, 0, w * k - 1, h * k - 1], fill=el.get("fill"))
        elif tag == "circle":
            cx, cy, r = (float(el.get(a)) for a in ("cx", "cy", "r"))
            draw.ellipse([(cx - r) * k, (cy - r) * k, (cx + r) * k, (cy + r) * k], fill=el.get("fill"))
        elif tag == "g":
            for path in el.iter(NS + "path"):
                pts = scaled(rotate(path_points(path.get("d")), el.get("transform")))
                stroke = el.get("stroke")
                width = round(float(el.get("stroke-width", "0")) * k)
                if stroke and width:
                    # Approximate a centred stroke: draw it, then the fill on top covers the inner half.
                    draw.line(pts + pts[:1], fill=stroke, width=width, joint="curve")
                    for p in pts:
                        draw.ellipse([p[0] - width / 2, p[1] - width / 2, p[0] + width / 2, p[1] + width / 2], fill=stroke)
                draw.polygon(pts, fill=el.get("fill"))
    return img.resize((size, size), Image.LANCZOS)


if __name__ == "__main__":
    for name, size in OUTPUTS.items():
        render(ICONS / "icon.svg", size).convert("RGB").save(ICONS / name, optimize=True)
        print(f"wrote public/icons/{name} ({size}x{size})")
