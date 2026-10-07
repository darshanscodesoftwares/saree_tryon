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
    id: "pink-banarasi",
    name: "Blush pink, banarasi silk",
    tags: { fabric: "banarasi silk", border: "magenta and zari", colour: "blush pink" },
    // python3 tools/garment_cutout.py "photos/Blush Pink Bridal Saree Portrait.png" \
    //     public/textures/pink-banarasi.png --plain \
    //     --neck 0,190 300,190 340,225 370,248 392,258 410,278 430,292 452,302 \
    //            474,309 496,315 516,312 536,302 550,292 564,278 578,260 600,250 \
    //            680,244 1023,200 \
    //     --skin --skin-area 398,296 535,296 505,345 483,390 452,350 402,312 \
    //     --drop 299,518 294,540 289,560 284,580 279,600 274,620 271,640 268,660 \
    //            264,680 259,700 249,720 242,740 239,760 244,780 239,800 235,820 \
    //            241,840 251,860 270,880 275,888 293,892 295,880 292,860 302,840 \
    //            301,820 303,800 300,780 304,760 307,740 313,720 312,700 320,680 \
    //            329,660 339,640 347,620 355,600 363,580 368,560 369,540 375,518 \
    //     --patch 600,517 690,517 696,540 702,560 708,580 713,605 717,630 721,655 \
    //             726,680 737,705 744,730 750,755 748,780 755,805 753,830 745,855 \
    //             716,882 700,892 650,892 650,855 651,805 653,755 655,705 655,655 \
    //             654,625 640,600 618,570 604,545 \
    //     --drop 711,520 785,520 785,905 711,905 \
    //     --drop 700,1430 1023,1430 1023,1535 240,1535 240,1508 700,1508 \
    //     --free <the 70-point trace of the pallu, printed as `free` below> \
    //     --anchors 630,330 362,331 561,730 425,730 \
    //     --elbows 649,539 330,562 --sleeve 523 --name pink-banarasi
    //
    // The first saree photographed to this project's own brief - square on,
    // arms down and away, hands empty, no veil, plain grey backdrop - which is
    // why it needs neither --mend nor --hair, where the first two did.
    //
    // What the cut does, and why:
    // - blush pink and peach do not sit above skin in hue the way the gold did,
    //   they straddle it: measured on this photo, her cheek is hue 0.049 and the
    //   pallu's peach sheen 0.044, at the same saturation and brightness. So no
    //   --skin-hue separates them, and --skin is confined by --skin-area to the
    //   one patch of bare chest inside the blouse's V. Drawn a hundred pixels
    //   wider it reached the pallu crossing her chest and bit a notch out of the
    //   pleats;
    // - her right arm hangs clear of the cloth, with backdrop between it and the
    //   saree at every row, so it is dropped outright. Its outline is traced from
    //   the photo rather than drawn by eye: the henna is not darker than her skin
    //   (RGB 190,130,113 against her cheek's 200,146,124), so the skin test reads
    //   the two alike and neither reliably;
    // - her left arm does NOT hang clear. It lies along the pallu's outer edge
    //   with no backdrop between them from the sleeve hem to her fingertips.
    //   Dropped, it notched the pallu for 350 rows, so it is --patch'ed and the
    //   pallu's own border pulled up through it. Her hand and bangles reach past
    //   where the pallu ends, where there is no cloth below to pull, so those
    //   columns are dropped instead;
    // - the floor shadow to her left survived the backdrop flood, being joined to
    //   the hem, and goes with the contact shadow under the hem.
    image: "textures/pink-banarasi.png",
    anchors: {
      shoulderLeft: [0.713, 0.045],
      shoulderRight: [0.139, 0.045],
      hipLeft: [0.565, 0.369],
      hipRight: [0.274, 0.369],
    },
    // The pallu hangs clear of the body from the shoulder to below the knee.
    // The first entry to use `free`: the other two had their hanging pallu cut
    // away instead, theirs being a strip behind an arm that could not follow a
    // different one. Traced off the cloth mask row by row, not drawn by eye.
    free: [[0.816, 0.009], [0.818, 0.028], [0.818, 0.053], [0.822, 0.081], [0.827, 0.109], [0.831, 0.138], [0.835, 0.165], [0.839, 0.189], [0.846, 0.215], [0.854, 0.241], [0.872, 0.268], [0.889, 0.296], [0.908, 0.324], [0.927, 0.347], [0.946, 0.367], [0.964, 0.387], [0.968, 0.411], [0.974, 0.430], [0.979, 0.447], [0.966, 0.465], [0.946, 0.476], [0.919, 0.484], [0.891, 0.494], [0.895, 0.519], [0.908, 0.552], [0.921, 0.584], [0.934, 0.624], [0.946, 0.665], [0.959, 0.706], [0.972, 0.746], [0.985, 0.787], [0.998, 0.827], [1.002, 0.841], [0.996, 0.846], [0.974, 0.848], [0.964, 0.855], [0.940, 0.856], [0.919, 0.858], [0.897, 0.860], [0.876, 0.861], [0.854, 0.863], [0.833, 0.864], [0.812, 0.865], [0.790, 0.866], [0.760, 0.868], [0.739, 0.870], [0.732, 0.839], [0.722, 0.791], [0.709, 0.750], [0.692, 0.710], [0.687, 0.661], [0.685, 0.612], [0.692, 0.572], [0.704, 0.531], [0.719, 0.495], [0.734, 0.465], [0.747, 0.430], [0.754, 0.393], [0.747, 0.357], [0.743, 0.320], [0.737, 0.288], [0.730, 0.257], [0.726, 0.230], [0.773, 0.207], [0.820, 0.192], [0.827, 0.165], [0.822, 0.134], [0.818, 0.101], [0.814, 0.065], [0.809, 0.030]],
  },
  {
    id: "red-bridal",
    name: "Red, net and sequin bridal",
    tags: { fabric: "net with sequin work", border: "scalloped", colour: "red" },
    // python3 tools/garment_cutout.py "photos/Regal Red Indian Bridal Portrait.png" \
    //     public/textures/red-bridal.png --plain \
    //     --patch 616,690 680,688 684,720 682,760 680,800 676,830 670,852 640,860 \
    //             618,850 614,820 612,780 612,740 614,710 \
    //     --neck 0,320 400,320 430,318 470,317 510,317 550,317 580,314 600,300 \
    //            620,285 650,278 690,274 1023,274 \
    //     --drop 290,688 360,688 358,712 361,732 365,748 368,762 369,790 369,820 \
    //            369,840 362,852 320,858 290,850 \
    //     --drop 0,1286 332,1286 332,1346 276,1346 276,1392 316,1396 396,1404 \
    //            436,1414 436,1424 0,1424 \
    //     --drop 776,1286 1023,1286 1023,1424 636,1424 636,1414 678,1404 796,1396 \
    //            850,1392 850,1346 776,1346 \
    //     --drop 0,1418 1023,1418 1023,1536 0,1536 \
    //     --anchors 611,356 395,368 565,719 446,723 \
    //     --elbows 653,560 367,558 --sleeve 690 --name red-bridal
    //
    // The second photo of this saree. The first had her hands clasped at her
    // waist over the cloth, which cost a --patch 243 columns wide across the
    // whole front; here her arms hang at her sides, so the only patch left is
    // 73 columns at one hand. Still no --skin anywhere: red is as far from skin
    // as a saree gets, and the blouse is full-sleeved to the wrist, so there is
    // no bare arm at all.
    //
    // The GREEN channel is what sorts this photo out: the red cloth sits at
    // 4-7, her henna'd hands at 115-121. Every boundary round the hands is
    // traced on it. One trap in that: the sheer veil panels hanging down both
    // sides read 108, the grey backdrop showing through them, so green alone
    // calls them skin too. They are told apart by G-B - skin runs 12 and more
    // above blue, the veil at or below it.
    //
    // Her right arm hangs at the garment's own edge, so the hand, its bangles
    // and the henna are dropped along the saree's edge. Her left hand has about
    // 20 px of pallu outside it, so it is an island and is patched instead.
    // Both regions run to y=852, past the fingertips: cut off at 826, the patch
    // pulled her own fingers UP into the hole from below, since the cloth it
    // pulls from is everything opaque below the hole and that included them.
    //
    // The necklace is KEPT, as in the first cut, and for the same reason. It is
    // a lace of thin strands - 27% of its area is pearl, the rest is the blouse
    // showing between them - so removing it means fabricating a third of the
    // chest. --mend cannot see it, the tool opening the skin mask by 7 px where
    // the strands are thinner than that, and a --patch across the whole
    // necklace pulled the saree's bold florals over the blouse's finer work and
    // read as a pasted slab. Left alone it is the garment's own cloth. If the
    // shop wants it gone it needs a photo shot without it; no cut will do it.
    //
    // No `free`: the train spreads wide but entirely below the hip line, where
    // the viewer already lets the skirt hang, and above the hips nothing is
    // clear of the body. `sleeves` is recorded this time - the first photo's
    // clasped hands made the pose model put her left wrist down at her hip, and
    // here both wrists read correctly.
    image: "textures/red-bridal.png",
    anchors: {
      shoulderLeft: [0.583, 0.059],
      shoulderRight: [0.206, 0.070],
      hipLeft: [0.503, 0.381],
      hipRight: [0.295, 0.384],
    },
  },
  {
    id: "mauve-net",
    name: "Mauve, net with thread work",
    tags: { fabric: "net with thread work", border: "scalloped", colour: "mauve" },
    // python3 tools/garment_cutout.py "photos/Elegant Mauve Saree Studio Portrait.png" \
    //     public/textures/mauve-net.png --plain \
    //     --patch 605,690 650,683 690,690 700,730 698,775 688,805 660,820 620,818 \
    //             602,780 598,735 \
    //     --neck 0,402 300,402 380,402 399,402 401,376 405,362 409,346 413,333 \
    //            417,320 421,304 425,295 434,293 443,293 449,300 453,352 463,353 \
    //            473,352 483,348 497,344 513,337 533,323 553,309 575,296 605,286 \
    //            635,281 665,279 700,281 1023,281 \
    //     --drop 300,388 401,388 401,430 401,470 403,505 402,540 393,560 388,580 \
    //            383,600 379,620 375,640 372,660 372,690 373,720 372,750 370,780 \
    //            369,810 371,838 345,850 300,842 \
    //     --drop 0,1385 326,1385 326,1490 0,1490 \
    //     --drop 788,1390 1023,1390 1023,1490 788,1490 \
    //     --drop 0,1482 1023,1482 1023,1536 0,1536 \
    //     --anchors 627,319 395,318 586,692 455,704 --name mauve-net
    //
    // The second photo of this saree. The first was turned about 35 degrees
    // with both hands clasped over the cloth; this one is square on with her
    // arms hanging down, as photos/README asks, and that does most of the work.
    //
    // The blouse's STRAP is kept and nothing else of it, which is what this
    // cut is about. Across the shoulder line the photo runs skin, strap, skin,
    // saree in that order - her shoulder out to x=418, the strap from 420 to
    // 437, her bare chest and its necklace from 440 to 470, then the saree -
    // so the --neck line has to rise over the strap and drop again on both
    // sides of it. An earlier cut put the line flat at y=293 across x 420-448
    // and so kept her neck and chest as well, pearls and all: a pink wedge
    // where the blouse should be.
    //
    // None of that could be found by eye or by any test the tool has, because
    // the strap is nude and her skin is the same tone: hue, saturation and
    // brightness all overlap. What separates them is RED MINUS BLUE - her skin
    // runs 95-110, the nude strap 64-80, with no overlap along the whole
    // boundary. Every number in the --neck line between x=405 and x=472, and
    // in the top of the --drop, is read off that one channel. Read by eye the
    // left edge came out five pixels wrong and left a strip of her forearm down
    // the side.
    //
    // There is still no --skin anywhere: the saree is a dusty mauve, the blouse
    // is nude and her skin sits between them, so nothing here is cut by colour
    // thresholds. A skin-tone test over the finished cut flags 146k pixels,
    // almost all of them the saree.
    //
    // Her right arm hangs beside the cloth rather than over it, so it is
    // dropped along the traced edge and the garment keeps its full width. Her
    // left arm is BEHIND the pallu, which is sheer, so her arm shows through the
    // net from about y=400 to y=685 and the crook of her elbow is legible in
    // the cloth. That is the one fault left in this cut, and both ways out were
    // tried and are worse. --patch pulls cloth up from below, and below the arm
    // is her hand and then the skirt, so the pallu's own embroidery would be
    // replaced with skirt pulled over it - the red saree's first cut failed
    // exactly that way. --mend fills from the print around it, and over
    // embroidery this dense it laid down misaligned tiles and cut a hairline of
    // transparency along its own outline; it took the skin-range pixels from
    // 640 to 312 and looked far worse doing it. 640 px is 0.16% of the cut, so
    // it is left. The real fix is not a cut at all: sheer cloth wants partial
    // alpha, so that the CUSTOMER's arm shows through the pallu instead of this
    // model's. Only her left hand, which comes out below the pallu's hem and
    // lies over the skirt, is patched.
    //
    // No `free`: the hem spreads below the hip line, where the skirt already
    // hangs free, and nothing above the hips is clear of the body.
    //
    // One side effect of keeping the blouse, worth knowing before anyone debugs
    // it. Without it this was a one-shoulder drape with nothing at all on the
    // shoulder line's bare side, so rowEdges nulled level 0 and _readBuild
    // never ran. The strap puts cloth back on that line, so the build is read
    // again - and on her own photo it reads 1.000 on the pallu side and 1.095
    // on the strap side, because there the cloth stops at the strap while her
    // body goes on to her bare shoulder. That comparison is meaningless on a
    // one-shoulder garment: the true ratio is 1.82 and only BUILD_MAX holds it
    // to 1.1. It does no visible harm, because _readEdges then clamps the edge
    // to within a tenth of that widened figure and drives it at the customer's
    // own outline anyway - pose-test on this photo lands back on her own saree
    // either way. But a much broader customer will be stretched a tenth more on
    // the strap side than on the pallu side. If that ever shows, the fix is to
    // put the strap in `free`, which takes it out of photoEdges and restores
    // the old behaviour - at the cost of letting it hang off a narrow
    // shoulder, which is the worse artefact of the two.
    image: "textures/mauve-net.png",
    anchors: {
      shoulderLeft: [0.690, 0.030],
      shoulderRight: [0.156, 0.029],
      hipLeft: [0.595, 0.341],
      hipRight: [0.294, 0.351],
    },
  },
];

export const byId = (id) => SAREES.find((s) => s.id === id) ?? null;

// What the dropdown lands on when the viewer opens. Named rather than left to
// whichever entry sits first, so reordering the list changes nothing.
export const DEFAULT_SAREE = "yellow-ikat";

export const defaultSaree = () => byId(DEFAULT_SAREE) ?? SAREES[0] ?? null;
