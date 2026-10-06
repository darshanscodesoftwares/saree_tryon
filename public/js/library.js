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
    // python3 tools/garment_cutout.py "photos/Elegant Red Bridal Portrait.png" \
    //     public/textures/red-bridal.png --plain \
    //     --patch 378,534 400,532 425,530 450,528 475,529 500,530 525,528 550,528 \
    //             575,532 600,534 612,534 616,562 612,592 600,612 390,614 378,600 \
    //             374,566 \
    //     --neck 0,280 380,280 400,300 420,316 450,322 480,324 510,324 540,322 \
    //            565,314 590,296 620,280 1023,280 \
    //     --anchors 611,365 401,371 571,715 463,717 --name red-bridal
    //
    // The easiest cut of the three and the only one needing no --skin at all:
    // red is as far from both skin and a grey backdrop as a saree gets, and the
    // blouse is full-sleeved to the wrist, so there is no bare arm anywhere.
    // The backdrop came away in one pass, taking the sheer net train's outer
    // reach with it - net over grey reads as grey.
    //
    // Her hands are clasped at her waist, over the cloth, which is what --patch
    // is for. Its top edge follows the bottom of her necklace, which is a real
    // edge and so the one place the cloth jumps; from there the saree below is
    // pulled up 86 px over the hands, the bangles and the rings.
    //
    // The necklace is KEPT, and that is a decision rather than an oversight.
    // It is a lace of thin strands, not a solid mass: only 27% of its area is
    // pearl and the other 73% is the blouse showing between the strands, so
    // taking it out means fabricating a third of the chest. Both ways were
    // tried. --mend cannot see it - the tool opens the skin mask by 7 px and
    // the strands are thinner than that, so it catches 5% of them. And a
    // --patch over the whole necklace pulled 249 columns of the saree's bold
    // florals up over the blouse's much finer work, which read as a pasted
    // slab with hard vertical seams. Left alone it is the garment's own cloth,
    // correct in every pixel. If the shop wants it gone, it needs a photo shot
    // without it.
    //
    // No `free`: the train spreads wide but entirely below the hip line, where
    // the viewer already lets the skirt hang, and above the hips nothing is
    // clear of the body - the dupatta lies along her arm. And no `sleeves`:
    // the pose model put her left wrist at 658,717, down at her hip, because
    // her hands are clasped and lost under the bangles. Recording that would
    // mislead whoever next tries turning a sleeve.
    image: "textures/red-bridal.png",
    anchors: {
      shoulderLeft: [0.580, 0.070],
      shoulderRight: [0.204, 0.076],
      hipLeft: [0.508, 0.375],
      hipRight: [0.315, 0.377],
    },
  },
  {
    id: "mauve-net",
    name: "Mauve, net with thread work",
    tags: { fabric: "net with thread work", border: "scalloped", colour: "mauve" },
    // python3 tools/garment_cutout.py "photos/Elegant Mauve Saree Portrait.png" \
    //     public/textures/mauve-net.png --plain \
    //     --patch 372,582 400,572 430,566 460,566 476,578 484,615 520,650 540,700 \
    //             552,760 545,812 500,824 455,818 430,770 408,710 388,650 374,614 \
    //     --neck 0,445 320,445 400,448 435,442 460,412 485,386 510,358 535,338 \
    //            560,318 585,300 610,288 640,280 670,277 720,275 1023,275 \
    //     --drop 318,438 410,438 406,500 410,545 420,582 318,582 \
    //     --drop 0,1415 338,1415 338,1500 0,1500 \
    //     --drop 688,1415 1023,1415 1023,1500 688,1500 \
    //     --drop 0,1492 1023,1492 1023,1536 0,1536 \
    //     --anchors 620,328 385,326 579,706 444,708 --name mauve-net
    //
    // Cut entirely by geometry, with no --skin at all, because no colour test
    // could have worked here: the blouse is nude, within a few points of her
    // own skin, and the saree itself is a dusty mauve not far off either. Where
    // the gold saree needed --skin-hue and the pink one a tight --skin-area,
    // this one needs the skin found by hand and cut by outline.
    //
    // The --neck line is diagonal, not level, because the saree's own top edge
    // is: it follows the scalloped border up over her left shoulder, so the
    // line takes her head, hair, earrings, the fine necklace, her bare right
    // shoulder and the nude blouse strap in one pass, and keeps every pixel of
    // cloth below it.
    //
    // Her right arm hangs at the garment's own left edge with backdrop beside
    // it, so it is dropped; both forearms and hands are clasped in front of the
    // cloth lower down, an island with saree all round it, so those are
    // patched. The two regions ABUT at y=582 and do not overlap: the tool runs
    // every --patch before every --drop, so a drop laid over a patch reopens
    // the hole the patch had just filled. An earlier cut with them overlapping
    // by four pixels left a grey notch down the side.
    //
    // She stands turned about 35 degrees, which is off the brief in photos/README,
    // and it costs something real: the pose model reads her shoulders 235 px
    // apart against a 380 px torso, where a square-on body of her build reads
    // nearer 1.56. The fit still works - the four anchors carry the turn - but
    // the garment is a turned garment and reads slightly narrow on a square-on
    // customer.
    //
    // No `free`: the hem spreads below the hip line, where the skirt already
    // hangs free, and nothing above the hips is clear of the body.
    //
    // One consequence of a one-shoulder drape, worth knowing before anyone
    // debugs it: her right shoulder is bare, so the shoulder line - level 0 of
    // the nine - has no cloth on that side at all. rowEdges returns null for
    // that level, so _readBuild never runs and this saree is never widened to
    // the customer's build; it is always shown at the photo's own width. With
    // BUILD held to 0.92-1.1 that is at most a tenth either way.
    image: "textures/mauve-net.png",
    anchors: {
      shoulderLeft: [0.741, 0.033],
      shoulderRight: [0.145, 0.032],
      hipLeft: [0.637, 0.347],
      hipRight: [0.294, 0.349],
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
