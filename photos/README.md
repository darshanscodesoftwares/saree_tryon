# Photos for the sarees

Drop the source photo here, named for the saree. These are source files and
never reach the phone, which is why they live outside `public/`. They are not
committed either (see `.gitignore`): only the cut-out made from each one is,
and the command that remakes it is recorded in that saree's library entry.

## What makes a good photo

**A model wearing the saree, facing the camera.** Not a folded product shot. A
saree only exists as a drape - the fall of the pleats, where the border sits,
how the pallu lies over the shoulder - and none of that survives folding. The
viewer takes the drape from this photograph and pulls it onto the customer, so
what is photographed is what the customer sees.

- Standing square to the camera, arms down and away from the body.
- Shoulders and hips both clearly visible; the whole garment in frame.
- **A plain backdrop**, a wall or a sheet in one flat colour that the saree is
  not. Anything busy behind cannot be cut away reliably - that lesson cost an
  afternoon on the jewellery viewer, where pieces held up in tweezers on a
  workshop bench could not be separated from either.
- Even light, no hard shadow on the cloth.
- Better still: send it with the background already removed. The tool uses the
  transparency as it is and asks no questions.

Then:

    python3 tools/garment_cutout.py photos/red-silk.png \
        public/textures/red-silk.png --plain \
        --anchors 410,300 590,300 400,690 600,690

`--anchors` is four points in photo pixels - the model's left shoulder, right
shoulder, left hip, right hip, her own left and right. The tool prints the
library entry to paste, with those points turned into shares of the picture.
They are what the viewer fits to the customer's own shoulders and hips, so a
photo framed loosely works as well as one cropped tight.
