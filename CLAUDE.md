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
the copy after; source photos are never committed. `--sleeve` is the photo
row where the blouse's sleeves end; with the elbows it lets each sleeve
follow the customer's arm. For a model's arms, neck, hair and a hanging
pallu, the tool also takes `--skin`, `--neck`, `--hair`, `--mend`, `--drop`
and `--free` (see its docstring). It prints the library entry to paste into
`public/js/library.js`, with the command in a comment so the cut can be
remade.

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
