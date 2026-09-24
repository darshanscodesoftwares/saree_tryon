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
2. Takes the model off, where asked. `--skin` drops skin-coloured pixels, for
   a photo where an arm or a shoulder shows beside the cloth. It is a blunt
   instrument and it will eat a skin-toned border, so it is off by default.
3. Measures. `--anchors` is four points in photo pixels - left shoulder, right
   shoulder, left hip, right hip, the model's own left and right, at the
   joints - and they are written out as shares of the picture, which is what
   the viewer warps against.

Needs Pillow and numpy.
"""
import argparse

import numpy as np
from PIL import Image, ImageFilter


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


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("photo")
    ap.add_argument("out")
    pair = lambda t: tuple(float(v) for v in t.split(","))
    ap.add_argument("--box", type=pair, default=None, metavar="X0,Y0,X1,Y1", help="a crop round the garment, in photo pixels")
    ap.add_argument("--plain", action="store_true", help="the garment stands on a flat backdrop, read off the border")
    ap.add_argument("--skin", action="store_true", help="drop skin-coloured pixels: for a photo where an arm shows beside the cloth")
    ap.add_argument("--anchors", type=pair, nargs=4, default=None, metavar="X,Y",
                    help="the model's left shoulder, right shoulder, left hip and right hip, in photo pixels")
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

    if args.skin:
        # Skin is warm, not very saturated, and fairly bright. Cloth that is
        # any of gold, cream or peach is all three, which is why this is not
        # the default.
        skin = (rgb[..., 0] > rgb[..., 2] + 0.08) & (sat > 0.12) & (sat < 0.45) & (luma > 0.25)
        skin = np.asarray(
            Image.fromarray((skin * 255).astype(np.uint8), "L").filter(ImageFilter.MedianFilter(5))
        ) > 127
        alpha = np.minimum(alpha, 1 - skin.astype(np.float32))

    ys, xs = np.nonzero(alpha > 0.4)
    if not len(xs):
        raise SystemExit("nothing left: check --box, and whether the backdrop really is flat")
    a, b = xs.min(), xs.max() + 1
    c, d = ys.min(), ys.max() + 1

    out = np.dstack([np.asarray(photo.convert("RGB")).astype(np.float32), alpha * 255])[c:d, a:b]
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
    }},
  }},""")


if __name__ == "__main__":
    main()
