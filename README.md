# Saree Try-On — proof of concept

Camera try-on for sarees. A photograph of the garment being worn is warped
onto the customer's own body, live.

Separate from the jewellery viewer and sharing no code with it, because the
problem is not the same one. Built on what that viewer settled, though - see
**Why a photograph** below.

## Run it

```bash
cd saree_tryon
npm start
```

Open <http://localhost:5190> and allow the camera. If that port is taken,
`PORT=5191 npm start` (and `HTTPS_PORT` for the phone one). No install step and no
dependencies: three.js and the tracking model come from a CDN, and a stand-in
saree is in the box so it runs before any photo arrives.

To use it from a phone, put a certificate in `certs/` and the server also
serves HTTPS on 5453 - browsers give the camera only to localhost or https.

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
  -keyout certs/key.pem -out certs/cert.pem \
  -subj "/CN=Saree try-on (dev)" \
  -addext "subjectAltName=IP:<your LAN IP>,IP:127.0.0.1,DNS:localhost"
```

## Why a photograph, and not a model of a saree

A ring is a rigid thing at a landmark: it can be built in code and placed. A
saree is six metres of cloth whose whole value to a customer is how it falls -
the pleats, the border, the pallu over the shoulder. Nothing about that can be
derived from a folded product shot, and simulating it convincingly is a
research project, not a proof of concept.

So the garment IS a photograph of itself, taken on a model, cut out and pulled
onto the customer's frame. The drape you see is the real one, photographed.
The jewellery viewer reached the same conclusion for its earrings after trying
it the other way: a photograph of the piece beats a model of it whenever the
piece is seen from roughly the angle it was shot at.

What this does **not** do: simulate cloth. Nothing swings, and no fold appears
that was not already in the photograph.

## How the fit works

`public/js/tracking.js` runs MediaPipe's pose model and reads the two
shoulders and, when they are in frame, the two hips. That is the body's frame -
its width, its height and its lean - and it is all the garment needs.

Most customers will stand at a phone framed from the neck to the stomach, with
the hips below the edge. Then `public/js/scene.js` puts the hips where they
would be: straight down from the shoulders, square to them, at average adult
proportions measured against both the shoulder width and the drop from the
mouth to the shoulders. The second of those holds when the customer turns and
the shoulders foreshorten.

`public/js/drape.js` carries the cut-out on a grid of triangles. Each vertex
is placed once on the photographed body - how far across it, how far down
from the shoulder line to the hip line - and every frame the same place is
found on the customer's body. So her left shoulder lands on the customer's
left shoulder whatever the photo's framing or slope, and the pallu sits on the
same shoulder it was draped over. Below the hips the cloth hangs along the
body's axis as it did in the photo.

Four points alone give a sticker: the cloth stops where the photo's did, and
hangs over the background wherever the customer is narrower. So the pose
model's outline of the person is read as well, every frame, and the garment
is drawn in two layers, like a paper doll:

- **The body layer reaches past any body and is cut to it.** When a saree
  loads, its picture is made into a body layer: the sleeves taken out, and
  each row of the torso carried on outward by mirroring the cloth beside the
  edge - swinging up and down as it goes, so a flower is not doubled into a
  butterfly, and passing over the torso's shaded sides and what is left of
  the model's hands - then softened a little, since each row is mirrored on
  its own and the rows came out as bands. A shader then cuts it to the customer's outline, a
  centimetre or so past it for the cloth's thickness, and to the torso's own
  edge as read at nine heights, so it does not creep onto an arm held away
  from the body. A broader customer, or a man's straight waist, is covered
  without the print being pulled wide.
- **The sleeves are their own layer, laid along the customer's arms.** Each
  sleeve is put on the customer's upper arm - her shoulder joint on theirs,
  her elbow on theirs, both read by the pose model - and widened to the arm
  as the outline shows it: a man's shirt sleeve is wider than her bare arm.
  Its underside is its own outer half, mirrored, so the arm is in sleeve all
  the way round; stretched over the underside, her armpit was a pale band.
  Nothing joins the sleeves to the body layer, so nothing stretches between
  them: a raised arm shows the body layer's cloth where the sleeve was, as a
  blouse does. What counts as sleeve is the cloth close round her upper arm,
  measured square to it, and the top of her shoulder, which a sleeve's seam
  goes over.
- **The edge is read at the hips too.** The customer's edge is looked for
  well past each joint: the hip joints are half as far apart as the
  shoulders, and looked for as near as at the shoulders, the hips' outline
  was never found and the skirt kept the model's width. The skirt, which
  hangs free, is widened to the hips; above it the body layer does the
  covering. Where an arm lies against the side the torso reaches at least as
  far as the arm, so the cloth goes under it.
- **The outline is smoothed before anything reads it.** The pose model's
  outline is blocky and changes every frame; cloth clipped to it straight
  gets a lumpy edge that crawls. It is averaged over frames and blurred
  first, and the cut round it is reached for in twelve directions, not four,
  so a sloping shoulder or hip is not a staircase.
- **Arms go in front.** The forearms and hands, from the pose model's elbows,
  wrists and fingers, are cut out of both layers; the upper arm below the
  sleeve's hem out of the body layer.
- **A raised arm does not drag the garment.** Raising an arm pulls the pose
  model's shoulder point up and out with it; that shoulder is held where it
  sat against the other one while the arm is up. With both arms up the
  shoulder line is held against the mouth instead, which stays put in a
  shrug - and with the hips out of frame the garment's whole height comes
  from the shoulder width, so a spread shoulder line made it grow.

Two things are worth knowing:

- **Anchors are the pose model's own reading of the photo.** Run
  `public/pose-test.html?img=<photo>` on the source photo and it prints the
  `--anchors` and `--elbows` to use. Placed by eye they came out a quarter too wide at the
  shoulders and over half again at the hips, because the pose model's points
  sit at the joints, well inside the outline; the customer is read by the same
  model, so the photo has to be as well.
- **Shoulders or nothing.** If either shoulder is read with low confidence,
  the garment is hidden rather than hung on a guess. Half a frame reads worse
  than no garment.

Two pages check the fit without a camera. `public/fit-test.html` puts it on
synthetic bodies - square-on and turned, framed to the stomach and with the
hips in frame, broader than the photo, an arm raised across the chest.
`public/pose-test.html` runs the real pose model on a still photo; on the
saree's own photo the cut-out should land back on the model's own saree.

## The library

`public/js/library.js`. A saree is its cut-out plus the four anchor points
that say where the photographed model's shoulders and hips are in the picture.
`tools/garment_cutout.py` writes the image and prints the entry.

## What is not here yet

- Photos of the shop's own sarees. The mustard saree's photo may be a
  generated image, and the body proportions used when the hips are out of
  frame were measured on that one photo. The demo is drawn by
  `tools/make_demo.py`.
- Occlusion by the upper arm. Forearms and hands go in front of the cloth;
  an upper arm across the chest does not.
- Any fit stored per product. The sliders are calibration only, as they are in
  the jewellery viewer at this stage.
