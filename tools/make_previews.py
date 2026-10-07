"""Render one review sheet per saree in the library, into previews/.

The viewer only ever wears the front view, so a cut-out IS the model: there is
nothing to spin and nothing to light. A still of each one, on a background the
cloth cannot be mistaken for, is therefore the whole of what there is to check.

    python3 tools/make_previews.py            # all entries
    python3 tools/make_previews.py mauve-net  # just one

It reads public/js/library.js itself, through node, so the library stays the
one place a saree is defined and a new entry needs no change here. What each
sheet shows, and why each is worth looking at:

- the cut-out on a teal checkerboard. Teal because every saree so far is warm -
  pink, red, mauve, gold, maroon - so it is the one colour the cloth cannot be
  confused with, and a checker because a hole in the garment and a transparent
  background look identical against anything flat;
- the four anchors, with the shoulder line and the hip line drawn between them.
  These are what the warp fits to the customer, so an anchor off its joint is
  the one error that makes everything else look wrong;
- the `free` outline where an entry has one, since that decides what may hang
  past the customer's body and is otherwise invisible;
- and the numbers underneath: the spans the anchors imply, and the share of the
  frame that is actually cloth.

previews/ is NOT committed - it is derived from the textures, which are. Rerun
this after recutting anything.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "previews"
HEIGHT = 900          # the cut-out's height on a sheet; the sarees are all tall
CHECKER = 24
TEAL_A, TEAL_B = (0, 128, 128), (0, 104, 104)
PANEL = (24, 26, 28)

ANCHOR_COLOURS = [
    ("shoulderLeft", (255, 60, 60)),
    ("shoulderRight", (70, 120, 255)),
    ("hipLeft", (255, 176, 0)),
    ("hipRight", (0, 224, 128)),
]


def font(size, mono=False):
    for path in (["/System/Library/Fonts/Menlo.ttc"] if mono else []) + [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


def library():
    """The entries, read from library.js itself so it stays the only source."""
    script = (
        "import('./public/js/library.js')"
        ".then(m => console.log(JSON.stringify(m.SAREES)))"
    )
    out = subprocess.run(
        ["node", "-e", script], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout)


def checkerboard(size):
    bg = Image.new("RGB", size, TEAL_A)
    d = ImageDraw.Draw(bg)
    for y in range(0, size[1], CHECKER):
        for x in range(0, size[0], CHECKER):
            if (x // CHECKER + y // CHECKER) % 2:
                d.rectangle([x, y, x + CHECKER - 1, y + CHECKER - 1], fill=TEAL_B)
    return bg


def sheet(entry):
    path = ROOT / "public" / entry["image"]
    if not path.exists():
        print(f"  {entry['id']}: {path} is missing, skipped")
        return None
    im = Image.open(path).convert("RGBA")
    src_w, src_h = im.size
    scale = HEIGHT / src_h
    im = im.resize((max(1, round(src_w * scale)), HEIGHT), Image.LANCZOS)
    w, h = im.size

    pad, caption = 28, 176
    canvas = Image.new("RGB", (max(w + pad * 2, 620), h + pad * 2 + caption), PANEL)
    art = checkerboard((w, h))
    art = Image.alpha_composite(art.convert("RGBA"), im).convert("RGB")
    ox = (canvas.width - w) // 2
    canvas.paste(art, (ox, pad))

    d = ImageDraw.Draw(canvas)
    d.rectangle([ox - 1, pad - 1, ox + w, pad + h], outline=(70, 74, 78))

    a = entry.get("anchors") or {}
    pts = {}
    for name, colour in ANCHOR_COLOURS:
        if name not in a:
            continue
        fx, fy = a[name]
        x, y = ox + fx * w, pad + fy * h
        pts[name] = (x, y)
        r = 8
        d.ellipse([x - r, y - r, x + r, y + r], outline=colour, width=3)
        d.line([x - r * 2, y, x + r * 2, y], fill=colour, width=2)
        d.line([x, y - r * 2, x, y + r * 2], fill=colour, width=2)
    # The shoulder line and the hip line are what the warp actually fits.
    for p, q in (("shoulderLeft", "shoulderRight"), ("hipLeft", "hipRight")):
        if p in pts and q in pts:
            d.line([pts[p], pts[q]], fill=(255, 255, 255), width=2)

    free = entry.get("free")
    if free:
        poly = [(ox + fx * w, pad + fy * h) for fx, fy in free]
        d.line(poly + [poly[0]], fill=(255, 255, 0), width=2)

    # The numbers worth reading off a sheet, in the cut-out's own pixels.
    alpha = Image.open(path).convert("RGBA").split()[3]
    opaque = sum(1 for p in alpha.getdata() if p > 128) / (src_w * src_h)
    lines = [f"{entry['id']}   -   {entry.get('name', '')}",
             f"{src_w} x {src_h} px     {opaque * 100:.0f}% cloth"
             + (f"     free: {len(free)} pts" if free else "     free: none")]
    if {"shoulderLeft", "shoulderRight", "hipLeft", "hipRight"} <= pts.keys():
        sl, sr = pts["shoulderLeft"], pts["shoulderRight"]
        hl, hr = pts["hipLeft"], pts["hipRight"]
        span = abs(sl[0] - sr[0]) / scale
        hip = abs(hl[0] - hr[0]) / scale
        torso = abs((hl[1] + hr[1]) / 2 - (sl[1] + sr[1]) / 2) / scale
        lines.append(f"shoulders {span:.0f}px   hips {hip:.0f}px   torso {torso:.0f}px")
        lines.append(f"torso/shoulders {torso / span:.2f}      hips/shoulders {hip / span:.2f}")
    tags = entry.get("tags") or {}
    if tags:
        lines.append("   ".join(f"{k}: {v}" for k, v in tags.items()))

    y = pad + h + 16
    for i, text in enumerate(lines):
        d.text((ox, y), text, font=font(19 if i == 0 else 15, mono=0 < i < 4),
               fill=(240, 244, 246) if i == 0 else (150, 160, 166))
        y += 30 if i == 0 else 24
    return canvas


def main():
    wanted = set(sys.argv[1:])
    entries = [e for e in library() if not wanted or e["id"] in wanted]
    if wanted:
        missing = wanted - {e["id"] for e in entries}
        if missing:
            raise SystemExit(f"no such entry: {', '.join(sorted(missing))}")
    OUT.mkdir(exist_ok=True)
    made = []
    for entry in entries:
        s = sheet(entry)
        if s is None:
            continue
        p = OUT / f"{entry['id']}.png"
        s.save(p)
        print(f"  wrote {p.relative_to(ROOT)}  ({s.width}x{s.height})")
        made.append((entry["id"], s))

    # A contact sheet, so the whole library can be taken in at once.
    if len(made) > 1 and not wanted:
        th = 520
        thumbs = [s.resize((max(1, round(s.width * th / s.height)), th), Image.LANCZOS)
                  for _, s in made]
        gap = 12
        all_im = Image.new("RGB", (sum(t.width for t in thumbs) + gap * (len(thumbs) + 1),
                                   th + gap * 2), PANEL)
        x = gap
        for t in thumbs:
            all_im.paste(t, (x, gap))
            x += t.width + gap
        p = OUT / "_all.png"
        all_im.save(p)
        print(f"  wrote {p.relative_to(ROOT)}  ({all_im.width}x{all_im.height})")


if __name__ == "__main__":
    main()
