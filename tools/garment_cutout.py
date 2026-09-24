"""Cut a saree out of a photo of it being worn, and measure where it hangs.

A saree cannot be shown from a folded product shot. What a customer wants to
see is the drape - how the pleats fall, where the border sits, how the pallu
lies over the shoulder - and that only exists on a body. So the model for the
viewer is a photograph of the garment being worn, cut out of its shot and
pulled onto the customer's own frame.

    python3 tools/garment_cutout.py photos/red-silk.png public/textures/red-silk.png \\
        --plain --anchors 410,300 590,300 400,690 600,690

Two things come out of it: the image, and the four anchor points the viewer
needs - the model's shoulders and hips, as a share of the picture. It prints
them as the library entry to paste.

What it does:

1. Takes the background off. `--plain` is for a photo shot on a flat backdrop,
   which is the case to ask for: the background is the colour running round
   the border, and the garment is what is not that colour. A photo that
   arrives with its background already removed needs neither.
2. Takes the model off, where asked.
   - `--skin` drops her arms, hands, neck and midriff: skin-coloured areas
     big enough to be skin. A skin-toned thread in a border is too small to
     count, which is why it is by area and not by pixel. It will still eat a
     cream or peach saree whole, so it is off by default.
   - `--neck` is a line in photo pixels, left to right, above which
     everything goes: her head, her hair and her earrings.
   - `--hair` is a box where her hair falls over the garment. The dark mass
     in it is taken out and the hole filled with the garment's own print,
     copied from nearby in patches that best match the edge of the hole, so
     the customer does not wear a stranger's hair or a gap.
3. Measures. `--free` outlines the part of the garment that hangs off the
   body - the pallu beside the arm - which the viewer lets fall past the
   customer's outline where the rest is clipped to it.
   `--anchors` is four points in photo pixels - left shoulder, right
   shoulder, left hip, right hip, the model's own left and right, at the
   joints - and they are written out as shares of the picture, which is what
   the viewer warps against.

Needs Pillow and numpy.
"""
import argparse

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def reach_from(mask, y, x):
    """The one shape of `mask` that holds (y, x), or the nearest to it."""
    h, w = mask.shape
    if not mask[y, x]:
        ys, xs = np.nonzero(mask)
        if not len(ys):
            return mask
        k = np.argmin((ys - y) ** 2 + (xs - x) ** 2)
        y, x = int(ys[k]), int(xs[k])
    out = np.zeros_like(mask)
    out[y, x] = True
    stack = [(y, x)]
    while stack:
        cy, cx = stack.pop()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                stack.append((ny, nx))
    return out


def filt(mask, f):
    return np.asarray(Image.fromarray((mask * 255).astype(np.uint8), "L").filter(f)) > 127


def opened(mask, k):
    """`mask` without anything thinner than `k` pixels."""
    return filt(filt(mask, ImageFilter.MinFilter(k)), ImageFilter.MaxFilter(k))


def closed(mask, k):
    """`mask` with gaps narrower than `k` pixels filled."""
    return filt(filt(mask, ImageFilter.MaxFilter(k)), ImageFilter.MinFilter(k))


def fill_from_print(rgb, hole, source, tile=20):
    """Fill `hole` with patches copied from `source`, a tile at a time.

    Each tile takes the shift whose copy best matches what already surrounds
    it - the photo's own pixels, or tiles already filled - with a small
    preference for nearby patches, whose print is least distorted by the
    body's curve. A print is close to periodic, so a well-chosen shift lands
    on the pattern's own rhythm. It is not texture synthesis, and a close
    look finds the seams; at a phone's size on a body they do not show.
    """
    h, w = hole.shape
    out = rgb.copy()
    done = np.zeros_like(hole)
    ys, xs = np.nonzero(hole)
    for y0 in range(ys.min(), ys.max() + 1, tile):
        for x0 in range(xs.min(), xs.max() + 1, tile):
            cell = np.zeros_like(hole)
            cell[y0:y0 + tile, x0:x0 + tile] = True
            cell &= hole
            if not cell.any():
                continue
            around = filt(cell, ImageFilter.MaxFilter(13)) & ~cell & (source | done) & ~(hole & ~done)
            cy, cx = np.nonzero(cell)
            ay, ax = np.nonzero(around)
            best = None
            for dy in range(-50, 51, 2):
                for dx in range(-60, 181, 2):
                    if abs(dx) < 14 and abs(dy) < 14:
                        continue
                    sy, sx = cy + dy, cx + dx
                    if sy.min() < 0 or sx.min() < 0 or sy.max() >= h or sx.max() >= w or not source[sy, sx].all():
                        continue
                    e = 0.0
                    if len(ay):
                        qy, qx = ay + dy, ax + dx
                        if qy.min() < 0 or qx.min() < 0 or qy.max() >= h or qx.max() >= w:
                            continue
                        e = np.abs(out[ay, ax] - rgb[qy, qx]).mean()
                    e += 0.0001 * (abs(dx) + abs(dy))
                    if best is None or e < best[0]:
                        best = (e, dy, dx)
            if best is None:
                print(f"note: no patch of print to fill the hair at {x0},{y0}; it is left see-through")
                continue
            _, dy, dx = best
            out[cy, cx] = rgb[cy + dy, cx + dx]
            done |= cell
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("out")
    pair = lambda t: tuple(float(v) for v in t.split(","))
    ap.add_argument("--box", type=pair, default=None, metavar="X0,Y0,X1,Y1", help="a crop round the garment, in photo pixels")
    ap.add_argument("--plain", action="store_true", help="the garment stands on a flat backdrop, read off the border")
    ap.add_argument("--skin", action="store_true", help="drop the model's arms, hands, neck and midriff")
    ap.add_argument("--neck", type=pair, nargs="+", default=None, metavar="X,Y",
                    help="a line across the neckline, left to right, in photo pixels; everything above it goes")
    ap.add_argument("--hair", type=pair, default=None, metavar="X0,Y0,X1,Y1",
                    help="a box where hair falls over the garment, to be taken out and filled with the print")
    ap.add_argument("--anchors", type=pair, nargs=4, default=None, metavar="X,Y",
                    help="the model's left shoulder, right shoulder, left hip and right hip, in photo pixels")
    ap.add_argument("--free", type=pair, nargs="+", default=None, metavar="X,Y",
                    help="an outline round what may hang outside the customer's body - the pallu off the shoulder - in photo pixels")
    ap.add_argument("--size", type=int, default=1024, help="the longer side of the image written")
    ap.add_argument("--name", default=None, help="what to call the entry it prints")
    args = ap.parse_args()

    photo = Image.open(args.photo).convert("RGBA")
    x0, y0 = 0, 0
    if args.box:
        x0, y0, x1, y1 = (int(round(v)) for v in args.box)
        photo = photo.crop((x0, y0, x1, y1))

    rgb = np.asarray(photo.convert("RGB")).astype(np.float32) / 255
    alpha = np.asarray(photo)[..., 3].astype(np.float32) / 255
    luma = rgb @ np.array([0.2126, 0.7152, 0.0722], np.float32)
    mx = rgb.max(-1)
    sat = (mx - rgb.min(-1)) / np.maximum(mx, 1e-3)

    if alpha.min() > 0.99 and args.plain:
        # The backdrop is whatever colour runs round the edge of the frame.
        edge = np.concatenate([rgb[:3].reshape(-1, 3), rgb[-3:].reshape(-1, 3),
                               rgb[:, :3].reshape(-1, 3), rgb[:, -3:].reshape(-1, 3)])
        back = np.median(edge, axis=0)
        distance = np.abs(rgb - back).sum(-1)
        keep = distance > 0.18
        keep = np.asarray(
            Image.fromarray((keep * 255).astype(np.uint8), "L").filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5))
        ) > 127
        keep = reach_from(keep, keep.shape[0] // 2, keep.shape[1] // 2)
        alpha = keep.astype(np.float32)
    elif alpha.min() > 0.99:
        print("note: this photo has no transparency and --plain was not given, so nothing was cut away")

    h, w = alpha.shape
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    hue = np.where(mx == r, ((g - b) / np.maximum(mx - rgb.min(-1), 1e-6)) % 6,
                   np.where(mx == g, (b - r) / np.maximum(mx - rgb.min(-1), 1e-6) + 2,
                            (r - g) / np.maximum(mx - rgb.min(-1), 1e-6) + 4)) / 6
    # Skin is warm, not very saturated and fairly bright; measured on the
    # first worn photo, skin ran 0.16-0.39 saturation and the mustard cloth
    # 0.65-0.95. Only areas at least 7 px across count, and they are grown a
    # little to take the soft edge between skin and cloth.
    skin = opened((sat > 0.08) & (sat < 0.45) & (r > b + 0.06) & (mx > 0.55), 7)
    skin = filt(skin, ImageFilter.MaxFilter(5))

    if args.hair:
        hx0, hy0, hx1, hy1 = (int(round(v)) - o for v, o in zip(args.hair, (x0, y0, x0, y0)))
        box = np.zeros_like(alpha, bool)
        box[max(hy0, 0):hy1, max(hx0, 0):hx1] = True
        # Hair is a dark, warm MASS; the print's dark lines are thin, and the
        # opening takes them out before the mass is grown back over the
        # hair's highlights.
        hair = opened((mx < 0.5) & (r >= b) & box, 9)
        hair = filt(filt(hair, ImageFilter.MaxFilter(15)), ImageFilter.MinFilter(9)) & box
        hole = filt(hair, ImageFilter.MaxFilter(5)) & (alpha > 0.5)
        # What may be copied from: the garment's own print, not the plain
        # cloth, which is the one big saturated field. Gaps between threads
        # that read as backdrop are closed first, or no patch is ever clean.
        field = opened((sat > 0.6) & (hue > 0.08) & (hue < 0.14), 9)
        cloth = closed((alpha > 0.5) & ~skin & ~field, 7) & ~field & ~skin & ~hole
        source = filt(cloth, ImageFilter.MinFilter(5))
        near = np.zeros_like(source)
        near[max(hy0 - 60, 0):hy1 + 60, max(hx0 - 60, 0):hx1 + 220] = True
        if hole.any():
            rgb = fill_from_print(rgb, hole, source & near)
            skin &= ~hole

    if args.skin:
        alpha = np.minimum(alpha, 1 - skin.astype(np.float32))

    if args.neck:
        line = [(x - x0, y - y0) for x, y in args.neck]
        above = Image.new("L", (w, h), 0)
        ImageDraw.Draw(above).polygon([(0, 0), (w, 0), (w, line[-1][1])] + line[::-1] + [(0, line[0][1])], fill=255)
        alpha = np.minimum(alpha, 1 - (np.asarray(above) > 127).astype(np.float32))

    if args.skin or args.neck or args.hair:
        # Whatever the cuts left stranded - a wisp of hair, an earring, a
        # fingertip - is not part of the garment, and nor is the hairline of
        # an arm's soft edge against the backdrop, which is neither skin nor
        # backdrop by colour.
        keep = opened(alpha > 0.5, 5)
        keep = reach_from(keep, int(np.mean(np.nonzero(keep)[0])), w // 2)
        alpha = np.minimum(alpha, keep.astype(np.float32))

    ys, xs = np.nonzero(alpha > 0.4)
    if not len(xs):
        raise SystemExit("nothing left: check --box, and whether the backdrop really is flat")
    a, b = xs.min(), xs.max() + 1
    c, d = ys.min(), ys.max() + 1

    out = np.dstack([rgb * 255, alpha * 255])[c:d, a:b]
    image = Image.fromarray(out.clip(0, 255).astype(np.uint8), "RGBA")
    edge = image.split()[3].filter(ImageFilter.GaussianBlur(1.0))
    image.putalpha(edge)

    scale = args.size / max(image.size)
    if scale < 1:
        image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    image.save(args.out)
    print(f"wrote {args.out}: {image.width}x{image.height}")

    if not args.anchors:
        print("\nno --anchors given, so the entry will use the defaults in drape.js.")
        print("measure the model's shoulders and hips in the photo and pass them.")
        return

    # The anchors are given in the original photo's pixels, so they follow the
    # crop and the trim before they mean anything to the viewer.
    (slx, sly), (srx, sry), (hlx, hly), (hrx, hry) = args.anchors
    w = b - a
    h = d - c
    fx = lambda v: (v - x0 - a) / w
    fy = lambda v: (v - y0 - c) / h
    name = args.name or args.out.split("/")[-1].rsplit(".", 1)[0]
    free = ""
    if args.free:
        free = "\n    free: [" + ", ".join(f"[{fx(x):.3f}, {fy(y):.3f}]" for x, y in args.free) + "],"
    print(f"""
  {{
    id: "{name}",
    name: "{name}",
    tags: {{ fabric: "", border: "", colour: "" }},
    image: "textures/{args.out.split('/')[-1]}",
    anchors: {{
      shoulderLeft: [{fx(slx):.3f}, {fy(sly):.3f}],
      shoulderRight: [{fx(srx):.3f}, {fy(sry):.3f}],
      hipLeft: [{fx(hlx):.3f}, {fy(hly):.3f}],
      hipRight: [{fx(hrx):.3f}, {fy(hry):.3f}],
    }},{free}
  }},""")


if __name__ == "__main__":
    main()
