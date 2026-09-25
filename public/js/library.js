// The sarees the viewer can try on.
//
// An entry is a photograph of the garment being worn, cut out of its shot, and
// the four anchor points that say where that model's shoulders and hips are in
// the picture: [x, y] as shares of its width and height, at the JOINTS, the
// way the pose model reads the customer, and named for her own left and right.
// Cloth that reaches past her joints in the photo reaches past the
// customer's. `free`, where given, outlines what may hang past the customer's
// outline - the pallu off the shoulder - where the rest is clipped to it.
// `tools/garment_cutout.py` writes the image and prints the anchors; they are
// recorded here so the cut can be remade from the photo the shop keeps. The
// commands also pass her elbows and sleeve hem, which the tool prints as a
// `sleeves` block: the viewer fits the garment as one piece and does not use
// it, so it is left out of the entries.
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
    // and over half again at the hips, and the cloth came out squeezed.
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
  },
  {
    id: "blue-saree",
    name: "Blue, gold brocade",
    tags: { fabric: "tissue silk", border: "blue", colour: "gold" },
    // python3 tools/garment_cutout.py photos/blueSaree.png public/textures/blue-saree.png \
    //     --box 920,0,1320,1024 --plain \
    //     --skin --skin-hue 0.08 \
    //     --skin-area 1010,150 1115,150 1115,236 1010,236 \
    //     --skin-area 945,318 1024,318 1024,413 982,432 945,432 \
    //     --neck 930,176 1005,173 1020,168 1026,178 1034,190 1035,222 1039,227 1045,224 1050,221 \
    //            1055,218 1060,215 1065,212 1070,209 1075,207 1085,201 1105,190 1115,184 1125,179 \
    //            1135,173 1140,170 1145,169 1150,166 1210,162 1320,162 \
    //     --patch 1024,395 1025,413 1134,414 1137,402 1141,390 1146,376 1152,364 1158,352 1160,329 \
    //             1192,329 1192,388 1187,398 1186,410 1177,416 1175,424 1170,448 1160,466 1146,478 \
    //             1132,488 1122,504 1110,511 1090,515 1070,511 1056,502 1045,490 1032,478 1018,470 \
    //             1004,460 992,448 982,432 986,421 994,412 1004,404 1014,398 \
    //     --drop 1218,160 1300,160 1300,842 1192,842 1192,329 1218,329 \
    //     --anchors 1182,202 997,199 1144,464 1049,465 \
    //     --elbows 1187,340 973,341 --sleeve 326 --name blue-saree
    //
    // The photo is a pair: a turned close-up and, on the right, the full-length
    // front-on figure, which --box takes. Anchors and elbows are the pose
    // model's reading of that crop (pose-test on it), moved back into the
    // photo's pixels.
    //
    // Gold tissue silk is as warm, bright and half saturated as skin, so the
    // skin is told by hue (skin 0.04-0.07 round the wheel, this gold 0.09 and
    // up) and looked for only in the V of the neckline and on her right
    // forearm: the weave's pink flowers are as red as skin. The neckline cut
    // runs down her blouse's edge and up the pallu's teal border, taking the
    // necklace with the skin. Her hands, both wrists of bangles and her left
    // forearm are in front of the pleats: the --patch outline pulls the cloth
    // below up over them, its top edge along the belt and the teal border.
    // The pallu hanging behind her left arm is dropped, as the mustard one's
    // was; the waist belt stays, as the shop styled it.
    image: "textures/blue-saree.png",
    anchors: {
      shoulderLeft: [0.819, 0.042],
      shoulderRight: [0.149, 0.039],
      hipLeft: [0.681, 0.349],
      hipRight: [0.337, 0.35],
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
