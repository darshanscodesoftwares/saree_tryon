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

Open <http://localhost:5190> and allow the camera. No install step and no
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

`public/js/tracking.js` runs MediaPipe's pose model and reads four landmarks:
the two shoulders and the two hips. That is the body's frame - its width, its
height and its lean - and it is all the garment needs.

`public/js/drape.js` carries the cut-out on a grid of triangles, and every
frame moves each vertex to where its part of the cloth belongs on this body.
Above the hips the shoulder line rules; below them the cloth falls along the
body's own axis and opens out, because a saree is not a tube. Above the
shoulders the same interpolation carries on and keeps the pallu on the
shoulder.

Two things are worth knowing about the numbers:

- **The garment reaches past the joints.** The pose model puts a shoulder at
  the joint, well inside the body's outline, so a garment fitted exactly
  between the two shoulders leaves both arms bare. It is spread about a sixth
  wider.
- **Four landmarks or none.** If any of the four is read with low confidence -
  hips out of frame, an arm across the body - the garment is hidden rather
  than hung on a guess. Half a frame reads worse than no garment.

## The library

`public/js/library.js`. A saree is its cut-out plus the four anchor points
that say where the photographed model's shoulders and hips are in the picture.
`tools/garment_cutout.py` writes the image and prints the entry.

## What is not here yet

- Real sarees. The one in the list is drawn by `tools/make_demo.py` so the
  viewer runs; it is a stand-in and looks it.
- Occlusion. An arm in front of the body is drawn behind the cloth, because
  nothing here knows the arm is nearer. Pose gives a depth per landmark that
  could carry this.
- Any fit stored per product. The sliders are calibration only, as they are in
  the jewellery viewer at this stage.
