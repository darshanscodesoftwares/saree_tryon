# Saree try-on — working notes

Camera try-on for sarees. A photograph of the garment being worn is warped onto
the customer's body, live. Read `README.md` first; it explains why the garment
is a photograph rather than a model, and how the fit works.

## Run and check

```bash
npm start          # http://localhost:5190
```

No build step, no dependencies: three.js and MediaPipe come from a CDN.

There is no test suite. Verify by running it, and say what was not verified. The
two things worth checking after any change to the fit:

- **The app boots.** Load it headless with `--deny-permission-prompts`: it
  stops at the camera, having loaded every module and filled the dropdown,
  which is enough to catch a page error or a missing export. Do NOT use
  `--use-fake-device-for-media-stream` here: on this Mac it has opened the
  real webcam instead and photographed whoever was in the room.
- **The pose model and the fit agree.** `pose-test.html` on the saree's own
  photo runs the real pose model and mask; the cut-out should land back on
  the model's own saree.
- **The warp fits a body.** There is no body in a headless browser, so
  `public/fit-test.html` imports `Stage` from `js/scene.js`, hands `update()`
  a synthetic set of pose landmarks, draws a schematic body behind it at the
  same coordinates, and is screenshotted (`?saree=<id>` picks the entry). Test a square-on body AND a turned
  one - a warp can look right head-on and fall apart the moment someone leans.
  Serve that page from the app's own origin (drop it in `public/`), or the
  module import is blocked cross-origin.

## Adding a saree

Photos go in `photos/` (gitignored). They must be of the saree **being worn**,
front-on, on a plain backdrop - `photos/README.md` says why, and what to ask
the shop for. Then:

```bash
python3 tools/garment_cutout.py photos/<name>.png public/textures/<name>.png \
    --plain --anchors <LSx,LSy> <RSx,RSy> <LHx,LHy> <RHx,RHy>
```

The anchors are the photographed model's left shoulder, right shoulder, left
hip and right hip in photo pixels - her own left and right - **as the pose
model reads them**, not as they look: copy the photo into `public/`, open
`pose-test.html?img=<it>`, and it prints `--anchors` and `--elbows`. Delete
the copy after; source photos are never committed. The viewer fits the
garment as one piece; turning the sleeves with the arms was tried and taken
out, as it tore the cloth at the underarm on real bodies. `--elbows` and
`--sleeve` still record where the model's arms are, for when it is tried
again, and the viewer ignores them. For a model's arms, neck, hair, hands in front of
the cloth and a hanging pallu, the tool also takes `--skin`, `--neck`,
`--hair`, `--mend`, `--patch`, `--drop` and `--free`, and `--box` crops a
composite (see its docstring). `--skin` eats gold, cream or peach cloth: for
those, add `--skin-hue` (skin is redder than gold) and `--skin-area` (where
skin may be looked for). Draw a `--patch` outline's top edge along a belt or
a border: the cloth below is pulled up over the patch, and its top is the
one place it jumps. It prints the library entry to paste into
`public/js/library.js`, with the command in a comment so the cut can be
remade.

`garment_cutout.py` needs Pillow and numpy, which the viewer does not: run it
as `.venv/bin/python` (`python3 -m venv .venv && .venv/bin/pip install Pillow
numpy` once).

## Looking at what is in the library

```bash
.venv/bin/python tools/make_previews.py        # all of them
.venv/bin/python tools/make_previews.py <id>   # one
```

Writes a sheet per saree into `previews/`, and `previews/_all.png` with them
all side by side: the cut-out on a teal checkerboard - teal because every
saree so far is warm, and a checker because a hole in the cloth and a
transparent background look alike against anything flat - with the four
anchors and the shoulder and hip lines drawn on, the `free` outline where an
entry has one, and the spans those anchors imply. Since the viewer only ever
wears the front view, a cut-out IS the model, so this is the whole of what
there is to look at. `previews/` is not committed; rerun it after recutting.

## Conventions

- Comments say **why**, not what. The reason a number is 1.18 belongs next to
  it; a line that restates the code does not.
- Numbers in the fit are measured, not chosen. If one is a guess, say so in the
  comment and in the reply.
- Commit in small, logical commits, each one buildable. Never push.
- Cut-out images are committed; source photos never are.

## Traps already paid for

- **Do not try to cut a garment out of a busy photo.** On the sister project
  (jewellery), a piece held in tweezers on a workshop bench could not be
  separated from them by brightness, colour, focus or thickness - the tweezers
  were in focus, warm with reflected gold, and thicker than the rings the piece
  hung on. Ask for a plain backdrop or a background-free PNG instead. Hours
  went into proving that.
- **MediaPipe puts a shoulder at the joint**, well inside the body's outline.
  A garment fitted exactly between the two shoulders leaves both arms bare.
- **Landmarks wobble.** The fit is damped; a saree is big enough that an
  undamped reading reads as the whole garment breathing.
