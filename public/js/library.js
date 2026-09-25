// The sarees the viewer can try on.
//
// An entry is a photograph of the garment being worn, cut out of its shot, and
// the four anchor points that say where that model's shoulders and hips are in
// the picture: [x, y] as shares of its width and height, at the JOINTS, the
// way the pose model reads the customer, and named for her own left and right.
// Cloth that reaches past her joints in the photo reaches past the
// customer's. `free`, where given, outlines what may hang past the customer's
// outline - the pallu off the shoulder - where the rest is clipped to it.
// `sleeves` is where her elbows are, and how far down the torso her sleeves
// end, so each sleeve can turn to follow the customer's upper arm. `tools/garment_cutout.py` writes the image and prints the
// anchors; they are recorded here so the cut can be remade from the photo the
// shop keeps.
//
export const SAREES = [
  {
    id: "yellow-ikat",
    name: "Mustard, ikat border",
    tags: { fabric: "silk blend", border: "ikat", colour: "mustard" },
    // python3 tools/garment_cutout.py photos/measuredSaree.png public/textures/yellow-ikat.png \
    //     --plain --skin --hair 260,240,430,480 \
    //     --neck 200,325 290,318 390,345 430,358 470,362 520,336 590,298 700,290 760,300 \
    //     --mend 600,445 642,445 628,560 635,660 648,760 628,760 612,650 604,550 \
    //     --drop 660,300 800,300 800,1370 595,1370 610,1000 655,800 665,450 \
    //     --drop 320,448 348,448 348,560 320,560 \
    //     --anchors 614,333 349,353 542,755 406,762 \
    //     --elbows 639,549 302,585 --sleeve 445 --name yellow-ikat
    //
    // The anchors and elbows are where the pose model itself puts her
    // joints, read by running public/pose-test.html on the photo - the same
    // model that will read the customer, so the two agree on what "shoulder"
    // means. Placed by eye the anchors were a quarter wider at the shoulders
    // and over half again at the hips, and the cloth came out squeezed. The
    // sleeve hem is the row where both sleeves end, off the photo.
    //
    // What else the cut does, and why:
    // - her hair over her right shoulder is taken out and the blouse filled
    //   from its own print;
    // - her left arm overlaps the side of her body, so the cloth behind it is
    //   filled from the cloth around it (--mend) - cut, it left a hole down
    //   the customer's side where their shirt showed through;
    // - the pallu where it hangs behind her left arm is taken out (the first
    //   --drop): from the front it is a strip beside her arm, and on anyone
    //   else it floated beside theirs. So is a sliver of shadow under her
    //   right arm (the second);
    // - her midriff is left open, as the drape has it.
    image: "textures/yellow-ikat.png",
    anchors: {
      shoulderLeft: [0.871, 0.027],
      shoulderRight: [0.202, 0.042],
      hipLeft: [0.689, 0.347],
      hipRight: [0.346, 0.352],
    },
    // Her arms hang nearly straight, 7° and 11° out from vertical: the pose
    // the sleeves swing from to follow the customer's.
    sleeves: {
      elbowLeft: [0.934, 0.191],
      elbowRight: [0.083, 0.218],
      hem: 0.245,
    },
  },
  {
    id: "blue-saree",
    name: "Blue, gold brocade",
    tags: { fabric: "tissue silk", border: "blue", colour: "gold" },
    // python3 tools/garment_cutout.py photos/blueSaree.png public/textures/blue-saree.png \
    //     --box 920,0,1320,1024 --plain \
    //     --neck 930,176 1005,174 1050,200 1080,222 1095,212 1140,166 1210,162 1320,162 \
    //     --patch 1160,326 1212,326 1212,360 1180,440 1128,450 1128,412 1160,360 \
    //     --patch 1005,405 1058,405 1058,438 1180,438 1180,505 1005,505 \
    //     --drop 940,326 998,326 1006,410 1006,470 940,470 \
    //     --drop 1213,160 1300,160 1300,880 1200,880 1200,415 1213,415 \
    //     --anchors 1182,202 997,199 1144,464 1049,465 \
    //     --elbows 1187,340 973,341 --sleeve 326 --name blue-saree
    //
    // The photo is a pair: a turned close-up and, on the right, the full-length
    // front-on figure, which --box takes. Anchors and elbows are the pose
    // model's reading of that crop (pose-test on it), moved back into the
    // photo's pixels. No --skin: gold tissue silk is warm, bright and half
    // saturated, exactly the skin test, and it ate the saree whole. So her
    // right forearm, beside the body, is dropped by outline; her left forearm
    // and the clasped hands, in front of the pleats, are patched with the
    // cloth from below them. The pallu hanging behind her left arm is
    // dropped, as the mustard one's was. The choker and the waist belt stay:
    // they are how the saree is styled in the shop's own photo.
    image: "textures/blue-saree.png",
    anchors: {
      shoulderLeft: [0.819, 0.043],
      shoulderRight: [0.149, 0.04],
      hipLeft: [0.681, 0.35],
      hipRight: [0.337, 0.351],
    },
    // Elbow-length sleeves: they end nearly halfway down the torso.
    sleeves: {
      elbowLeft: [0.837, 0.205],
      elbowRight: [0.062, 0.206],
      hem: 0.475,
    },
  },
  {
    id: "demo-kanchipuram",
    name: "Demo, Kanchipuram silk",
    tags: { fabric: "silk", border: "zari", colour: "maroon" },
    // A stand-in, generated by tools/make_demo.py rather than photographed,
    // so the viewer runs before the shop's own photos arrive. It is a flat
    // drape with a border and a pallu - enough to see the fit working, and
    // not a real garment.
    // Its anchors were first set at the cloth's edges, when the viewer
    // spread every garment a sixth past the joints; these are the same points
    // pulled a sixth inward. Left is on the picture's left, as if it were a
    // mirror photo, which keeps its pallu where it always was.
    image: "textures/demo-kanchipuram.png",
    anchors: {
      shoulderLeft: [0.331, 0.085],
      shoulderRight: [0.669, 0.085],
      hipLeft: [0.314, 0.34],
      hipRight: [0.686, 0.34],
    },
  },
];

export const byId = (id) => SAREES.find((s) => s.id === id) ?? null;

// What the dropdown lands on when the viewer opens. Named rather than left to
// whichever entry sits first, so reordering the list changes nothing.
export const DEFAULT_SAREE = "yellow-ikat";

export const defaultSaree = () => byId(DEFAULT_SAREE) ?? SAREES[0] ?? null;
