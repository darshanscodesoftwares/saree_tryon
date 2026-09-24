"""Draw the stand-in saree, so the viewer runs before any photo arrives.

This is NOT a garment. It is a flat drape with a border, a pallu over one
shoulder and a printed grid, at the proportions a worn photo would have, and
it exists so the fit can be seen working - and so an empty textures folder is
not the first thing a new checkout hits.
"""
from PIL import Image, ImageDraw

W, H = 700, 1500
SILK = (124, 20, 42)
DEEP = (92, 12, 30)
ZARI = (198, 160, 78)

# The same anchors the library entry carries, as shares of the image.
SHOULDER_Y, HIP_Y = 0.085, 0.34
SHOULDER_L, SHOULDER_R = 0.30, 0.70
HIP_L, HIP_R = 0.28, 0.72
HEM_L, HEM_R = 0.10, 0.90

im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
d = ImageDraw.Draw(im)

sy, hy = SHOULDER_Y * H, HIP_Y * H
body = [(SHOULDER_L * W, sy), (SHOULDER_R * W, sy), (HIP_R * W, hy),
        (HEM_R * W, H), (HEM_L * W, H), (HIP_L * W, hy)]
d.polygon(body, fill=SILK)

# Pleats: the fall of the front, drawn as darker seams that open out.
for i in range(1, 9):
    k = i / 9
    top = (HIP_L * W + (HIP_R - HIP_L) * W * k, hy)
    bottom = (HEM_L * W + (HEM_R - HEM_L) * W * k, H)
    d.line([top, bottom], fill=DEEP, width=3)

# The border runs up the near edge and round the hem, as a woven one does.
d.line([(HIP_L * W, hy), (HEM_L * W, H)], fill=ZARI, width=16)
d.line([(HEM_L * W, H - 26), (HEM_R * W, H - 26)], fill=ZARI, width=44)
d.line([(HEM_L * W, H - 62), (HEM_R * W, H - 62)], fill=ZARI, width=6)

# The pallu over the left shoulder, down across the body.
pallu = [(SHOULDER_L * W - 8, sy - 30), (SHOULDER_L * W + 120, sy - 22),
         (HIP_R * W - 10, hy + 250), (HIP_R * W - 120, hy + 300)]
d.polygon(pallu, fill=DEEP)
d.line([pallu[1], pallu[2]], fill=ZARI, width=10)
d.line([pallu[0], pallu[3]], fill=ZARI, width=10)

# A quiet grid of motifs, so the warp has something to read against.
for y in range(int(hy) + 60, H - 90, 110):
    for x in range(int(HEM_L * W) + 50, int(HEM_R * W) - 30, 90):
        d.ellipse([x - 7, y - 7, x + 7, y + 7], outline=ZARI, width=3)

im.save("public/textures/demo-kanchipuram.png")
print("wrote public/textures/demo-kanchipuram.png", im.size)
