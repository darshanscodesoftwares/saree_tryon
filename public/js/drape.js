// The garment: a photograph of a saree, warped onto the customer's body.
//
// This is the jewellery viewer's idea carried up to something big and soft. A
// ring is a rigid thing at a landmark, so it is placed and turned. A saree is
// cloth over a whole body: it cannot be placed, it has to be FITTED, and the
// only honest way to show a particular saree's drape, pleats and pallu is to
// take them from a photograph of that saree being worn and pull that image
// onto the customer's own frame.
//
// So the garment is a grid of triangles carrying the cut-out as its texture,
// and every frame each vertex is moved to where its part of the cloth belongs
// on this body. Four points place the cloth - the two shoulders and the two
// hips, on the photographed model and on the customer - and everything
// between them is interpolated. Two more, the elbows, turn the sleeves about
// the shoulders to follow the arms.
//
// What this does NOT do is simulate cloth. Nothing hangs or folds that the
// photograph did not; only the sleeves turn, rigidly, with the arms. For a
// proof of concept that is the right trade: the drape you see is the real
// garment's, photographed, not a guess at how fabric falls.
//
// It is drawn in two layers, like a paper doll. The body layer is the
// picture with the sleeves taken out and the torso's sides carried on
// outward, mirrored, so that it reaches past any body and is cut to the
// customer's own outline by the shader. The sleeve layer is the sleeves, and
// turns with the arms. Nothing joins the two, so nothing is stretched between
// them: an arm raised shows the body layer's cloth where the sleeve was, as
// a blouse does. As one sheet, the print was pulled out between arm and body
// like elastic, and cloth widened to meet a broader body was smeared at the
// sides.

import * as THREE from "three";

// The grid's density, for the sleeve layer; the body layer is wider and has
// as many columns per share of the picture. The warp is smooth, so this is
// about how well the garment follows a bend rather than how detailed it
// looks: too coarse and a leaning body creases the print into facets.
const ACROSS = 32;
const DOWN = 64;

// How far the body layer reaches past the picture on each side, as a share of
// its width. The widest a customer was measured to need past the model's
// torso was a quarter of a shoulder width (a man's chest, under the arm),
// and a shoulder width is two thirds of the picture; the torso's edge is
// already inside the picture besides. So a quarter is room to spare.
const BODY_PAD = 0.25;

// Down to BODY_FROM the torso's sides are carried on outward in the body
// layer, faded in over the rows just above the shoulder line and out over
// the rows just above SKIRT_FROM, since below that the cloth hangs free and
// is not cut to the customer's outline: carried on there, it would be drawn
// whole. Mirrored, not smeared: a mirrored brocade reads as more brocade,
// where repeating the edge made streaks. The mirror's axis is a smooth curve
// BODY_INSET columns inside the edge, taken over BODY_AXIS rows either way;
// see _bodyLayer. It passes over pixels darker than BODY_DIM of the row's
// own median: the side of a torso in the photo is its shadow, and the
// mustard saree's pallu side, mirrored, was a brown band down the
// customer's.
//
// Before any of that, what is left of her beside the sleeves is taken out to
// be filled like the rest: within SHADOW_REACH shoulder widths of a sleeve,
// dark pixels - the shadow of her arm against her side - and skin, both of
// which a raised arm uncovered on the customer; and slivers under
// BODY_SLIVER pixels at either end of a row, which the fill could not reach
// past. Gaps between cloth near a sleeve - her arm's skin cut out, below a
// short sleeve - are filled from either side; gaps elsewhere, a midriff left
// open, are the drape's and stay. Skin within BODY_RIM pixels of a row's end,
// from the chest to the thigh, goes too: the soft rim left where her hands
// hung at her sides, which an arm held out uncovered on the customer's hips.
// Only at the ends, since a pink flower in the weave is as red as skin. And
// so does dim cloth at a row's end, up to BODY_SHADE of the row's width in:
// the side of her body turning from the light, which with the arms down is
// under the customer's arm, and with them held out was a dark band down the
// customer's side. The mirror then carries lit cloth out over it.
// Guesses, by eye.
const BODY_FADE = 0.1;
const BODY_AXIS = 30;
const BODY_INSET = 3;
const BODY_TRIM = 2;
const SHADOW_REACH = 0.12;
const BODY_SLIVER = 8;
const BODY_DIM = 0.7;
const BODY_RIM = 12;
const BODY_SHADE = 0.15;

// The heights, as `t` down the torso, at which the cloth's edge is matched to
// the body's edge. Nine is a row every eighth of a torso: enough to follow a
// waist in and a hip out, few enough to read from the mask every frame.
export const LEVELS = 9;

// How far out along each row the edge is looked for, in `s`. `s` counts in
// joint-to-joint widths at that height, and the hip joints are only half as
// far apart as the shoulders: a hip's outline sits 0.76 past its joint, and
// looked for out to 0.6, the customer's hips were never found and the skirt
// kept the model's width. 1.4 is room for a broad hip.
const ROW_REACH = 1.4;

// Below this far down the torso the cloth is a skirt, and a skirt is wider
// than the legs inside it - clipping it to the customer's outline would draw
// a saree as tight as trousers. From here down it hangs free.
const SKIRT_FROM = 1.05;

// A broader body is not met by widening the torso's cloth - the body layer
// already reaches past it and is cut to it - but the skirt, hanging free, has
// to be as wide as the hips it hangs from. So widening fades in from
// WIDEN_FROM down to SKIRT_FROM. Narrowing is everywhere, evenly. A guess.
const WIDEN_FROM = 0.75;

// A sleeve turns about its shoulder joint to follow the customer's upper arm,
// and what turns is the cloth round the model's own upper arm: within
// SLEEVE_REACH of it, measured square to the arm, in shoulder widths. The
// sleeves' inner edges sat 0.06-0.13 inboard of the arm on the two photos
// measured, so 0.1. Measured square to the arm and not across the body's
// rows, because an elbow-length sleeve lies alongside the torso: counted by
// rows, the side of the body next to it turned with the arm and zig-zagged
// with the hands on the hips. SLEEVE_BLEND only softens the line.
//
// Along the arm the sleeve starts at the joint, over SLEEVE_CAP below it, and
// nothing above it on the neck side is sleeve: cloth level with the joint
// there, carried up with a raised arm, rose toward the chin. On the outer
// side it starts SLEEVE_CAP_UP higher, taking the top of the shoulder, which
// a real sleeve's seam goes over: cut square at the joint, a sleeve was a box
// with a corner standing proud of the shoulder. Below the hem it lets go over
// SLEEVE_FADE, centred on the hem, so the cloth under the sleeve stays with
// the body. SLEEVE_BLEND softens the sleeve's inner edge against the body
// layer beneath it. All guesses, by eye.
const SLEEVE_REACH = 0.1;
const SLEEVE_BLEND = 0.08;
const SLEEVE_CAP = 0.1;
const SLEEVE_CAP_UP = 0.08;
const SLEEVE_FADE = 0.15;

// Each sleeve is laid along the customer's own upper arm - her joint on
// theirs, her elbow on theirs - and widened to the arm as the outline shows
// it, SLEEVE_FIT more for the cloth's thickness: a man's shirt sleeve is
// wider than a woman's bare arm, and a sleeve only as wide as hers left his
// showing round it. Each side of the arm is widened on its own, since the
// inner side can only be seen when the arm is away from the body.
//
// The inner side is not her cloth stretched: in toward her body from her
// arm's line the photo shows her armpit and the saree's edge, and stretched
// over the underside of a raised arm it was a pale band. The sleeve's own
// outer half is laid over it instead, mirrored across the arm's line - the
// `under` layer - so the arm is in sleeve all the way round. Kept
// between SLEEVE_WIDEST and a little under the photo's own proportions, so a
// chair beside the arm does not become sleeve. Guesses.
const SLEEVE_FIT = 0.12;
const SLEEVE_WIDEST = 2;

// An upper arm pointing at the camera reads shorter than this share of the
// shoulder width, and its direction is noise: the sleeve then keeps the last
// direction it had. A guess.
const SLEEVE_STUB = 0.2;

// How much of a change in a sleeve's width is taken per frame: the outline's
// edge round an arm flickers. A guess.
const WIDTH_EASE = 0.15;

// A grid of the picture - `width` of it, centred, so a width over 1 reaches
// past its sides - with each vertex's place in the picture, as shares of its
// width and height, kept because the plane's own positions are about to be
// overwritten, and room for where each sits on the photographed body.
function grid(width, across, material) {
  const geometry = new THREE.PlaneGeometry(width, 1, across, DOWN);
  // Every vertex is rewritten each frame, so the attribute is dynamic and the
  // bounding sphere is disabled: three would otherwise recompute it against
  // vertices that have already moved on.
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  const pos = geometry.attributes.position;
  const n = pos.count;
  const layer = {
    mesh,
    x: new Float32Array(n), // 0 at the picture's left, 1 at its right
    y: new Float32Array(n), // 0 at its top, 1 at its bottom
    // `s` across the photographed body, 0 at her left joint and 1 at her
    // right, `t` down it, 0 on the shoulder line and 1 on the hip line.
    s: new Float32Array(n),
    t: new Float32Array(n),
    // 1 where the cloth may hang outside the customer's outline - the skirt,
    // anything an entry marks `free` - and 0 where it is cut to the body.
    free: new Float32Array(n),
  };
  for (let i = 0; i < n; i++) {
    layer.x[i] = pos.getX(i) + 0.5;
    layer.y[i] = 0.5 - pos.getY(i);
  }
  geometry.setAttribute("aFree", new THREE.BufferAttribute(layer.free, 1));
  return layer;
}

export class Garment {
  // `material` draws the body layer, `sleeveMaterial` the sleeves, and
  // `underMaterial` their mirrored undersides.
  constructor(material, sleeveMaterial = material, underMaterial = sleeveMaterial) {
    this.body = grid(1 + 2 * BODY_PAD, Math.round(ACROSS * (1 + 2 * BODY_PAD)), material);
    // Where each body vertex sits on the customer's body, (s, t), rewritten
    // every frame: the shader cuts the body layer off at the customer's
    // torso's edge in these terms - see scene.js.
    this._bodyST = new Float32Array(this.body.x.length * 2);
    this.body.mesh.geometry.setAttribute("aBody", new THREE.BufferAttribute(this._bodyST, 2));
    this.body.mesh.geometry.attributes.aBody.setUsage(THREE.DynamicDrawUsage);
    this.sleeve = grid(1, ACROSS, sleeveMaterial);
    this.under = grid(1, ACROSS, underMaterial);
    this.mesh = this.body.mesh;
    this.sleeveMesh = this.sleeve.mesh;
    this.underMesh = this.under.mesh;
    // The sleeves are drawn after the body, so that an arm across it lies
    // over it, and their undersides last: the sleeve pass reaches a little
    // past the arm's line, where the photo may have something that is not
    // sleeve - the mustard saree's pallu runs right beside her sleeve - and
    // the underside covers that with sleeve.
    this.sleeveMesh.renderOrder = 1;
    this.underMesh.renderOrder = 2;
    this._v = new THREE.Vector3();

    // Where the model's arms are in the picture, for telling sleeve from
    // body: worked out once per saree, when its picture has loaded, since
    // distances square to the arm need the picture's shape. `arms` is read
    // by the shader too - see sleeveUniforms. The swing itself is per frame.
    this._sleeves = null;
    this.arms = null;
    // Each sleeve vertex in its own arm's frame in the picture: how far down
    // the arm, and how far in toward the body from its line.
    this._along = new Float32Array(this.sleeve.x.length);
    this._inward = new Float32Array(this.sleeve.x.length);
    // Per side, the last direction each sleeve pointed, and its widths as
    // shares of the photo's own proportions, damped.
    this._dir = [null, null];
    this._width = [{ out: 1, under: 1 }, { out: 1, under: 1 }];
    this._U = new THREE.Vector3();
    this._N = new THREE.Vector3();
    this._own = new THREE.Vector3();

    // The photographed body's own edge at each level, as `s` on her left and
    // on her right. Read off the cut-out once it has loaded; until then the
    // cloth is not reshaped.
    this.photoEdges = null;

    this.setAnchors(DEFAULT_ANCHORS);
  }

  // Place every vertex on the photographed body. The same (s, t) is then put
  // on the customer's body each frame, so her shoulder lands on the
  // customer's shoulder whatever the photo's framing, slope or handedness.
  // `sleeves`, when the entry has them, is where the model's elbows are in
  // the picture and how far down the torso her sleeves end; without them the
  // sleeves stay as photographed.
  setAnchors(anchors, free = [], sleeves = null) {
    this._q = {
      sl: anchors.shoulderLeft, sr: anchors.shoulderRight,
      hl: anchors.hipLeft, hr: anchors.hipRight,
    };
    this._freeShape = free;
    if (sleeves && !Number.isFinite(sleeves.hem)) {
      // Without a hem every weight would be NaN and the sleeves would sit
      // still with no word why.
      console.warn("sleeves given without a hem; the sleeves will not turn");
      sleeves = null;
    }
    this._sleeveShape = sleeves;
    this.arms = null;
    this._sleeves = sleeves && {
      left: bodyAt(this._q, ...sleeves.elbowLeft),
      right: bodyAt(this._q, ...sleeves.elbowRight),
    };
    this.forget();
    for (const layer of [this.body, this.sleeve, this.under]) {
      for (let i = 0; i < layer.x.length; i++) {
        const [s, t] = bodyAt(this._q, layer.x[i], layer.y[i]);
        layer.s[i] = s;
        layer.t[i] = t;
        const skirt = Math.min(Math.max((t - SKIRT_FROM) / 0.1, 0), 1);
        layer.free[i] = Math.max(skirt, inside(free, layer.x[i], layer.y[i]) ? 1 : 0);
      }
      layer.mesh.geometry.attributes.aFree.needsUpdate = true;
    }
    this.photoEdges = null;
  }

  // Read where the photographed body's edge is at each level, from the
  // cut-out's own transparency: along each row between her hip-to-shoulder
  // lines, the outermost opaque cloth that is not free to hang, and not
  // sleeve. The midriff is a hole in the cloth, not an edge, which is why it
  // is the outermost. The sleeves are left out because they are the arm's,
  // not the body's.
  //
  // Returns the body layer's picture, as a canvas: see bodyLayer.
  measure(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    this._findArms(image.width / image.height, data, width, height);
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
      if (inside(this._freeShape, x, y)) return false;
      if (this._sleeveAt(x, y) >= 0.5) return false;
      return data[(Math.floor(y * height) * width + Math.floor(x * width)) * 4 + 3] > 128;
    };
    this.photoEdges = rowEdges(this._q, solid);
    return this._bodyLayer(data, width, height);
  }

  // The body layer's picture: the cut-out without its sleeves, BODY_PAD wider
  // on each side, and each row of the torso carried on past its outermost
  // cloth by mirroring what is next to it - over and over, if it has far to
  // go. Where the sleeves were, outside the torso, is filled the same way:
  // the side of a blouse under a raised arm is not in the photo, and the
  // cloth beside it is the best guess at it.
  _bodyLayer(src, W, H) {
    const P = Math.round(BODY_PAD * W);
    const OW = W + 2 * P;
    const out = document.createElement("canvas");
    out.width = OW;
    out.height = H;
    const octx = out.getContext("2d");
    const img = octx.createImageData(OW, H);
    const d = img.data;
    const solid = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const px = (x + 0.5) / W, py = (y + 0.5) / H;
        const sleeve = this._sleeveAt(px, py);
        const r = src[i * 4], g = src[i * 4 + 1], b = src[i * 4 + 2];
        const leftover = (r + g + b < 3 * 90 || isSkin(r, g, b)) && this._sleeveAt(px, py, SHADOW_REACH) > 0.5;
        const a = sleeve >= 0.5 || leftover ? 0 : src[i * 4 + 3];
        const o = (y * OW + x + P) * 4;
        d[o] = src[i * 4];
        d[o + 1] = src[i * 4 + 1];
        d[o + 2] = src[i * 4 + 2];
        d[o + 3] = a;
        solid[i] = a > 200 && !inside(this._freeShape, (x + 0.5) / W, (y + 0.5) / H) ? 1 : 0;
      }
    }

    // Each row's outermost solid cloth - after the slivers at its ends are
    // cleared - smoothed down the rows so that the mirror does not jump
    // where the edge is ragged.
    const q = this._q;
    const midX = (q.sl[0] + q.sr[0] + q.hl[0] + q.hr[0]) / 4;
    const left = new Float32Array(H).fill(NaN), right = new Float32Array(H).fill(NaN);
    const clear = (y, from, to) => {
      for (let x = from; x < to; x++) {
        solid[y * W + x] = 0;
        d[(y * OW + x + P) * 4 + 3] = 0;
      }
    };
    const luma = (i) => 0.2126 * src[i * 4] + 0.7152 * src[i * 4 + 1] + 0.0722 * src[i * 4 + 2];
    const skinAt = (i) => isSkin(src[i * 4], src[i * 4 + 1], src[i * 4 + 2]);
    const median = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      const t = bodyAt(q, midX, (y + 0.5) / H)[1];
      if (t > 0.3 && t < 1.3) {
        // Her hands' rims: skin at either end of the row, and anything
        // half-see-through beyond it, which is the rest of the rim.
        let x0 = 0, x1 = W - 1;
        while (x0 < W && !solid[y * W + x0]) x0++;
        while (x1 >= 0 && !solid[y * W + x1]) x1--;
        for (let x = x0; x <= Math.min(x0 + BODY_RIM, x1); x++) if (skinAt(y * W + x)) clear(y, 0, x + 1);
        for (let x = x1; x >= Math.max(x1 - BODY_RIM, x0); x--) if (skinAt(y * W + x)) clear(y, x, W);
      }
      const ls = [];
      for (let x = 0; x < W; x += 2) if (solid[y * W + x]) ls.push(luma(y * W + x));
      median[y] = ls.length ? ls.sort((a, b) => a - b)[ls.length >> 1] : 0;
      if (t > 0 && t < SKIRT_FROM - BODY_FADE) {
        // The shaded side: from each end inward, as far as the dim cloth
        // runs before four lit pixels in a row.
        let a = 0, b = W - 1;
        while (a < W && !solid[y * W + a]) a++;
        while (b >= 0 && !solid[y * W + b]) b--;
        const depth = Math.round((b - a) * BODY_SHADE);
        // Never across a gap: past one is the far side of an open midriff,
        // and trimmed to it, the fill covered the midriff over. And never
        // the whole of the end's cloth, BODY_SLIVER of it is kept.
        const shade = (from, dir) => {
          let last = -1, lit = 0, run = 0;
          while (run < depth && solid[y * W + from + dir * run]) run++;
          for (let k = 0, x = from; k < run - BODY_SLIVER && lit < 4; k++, x += dir) {
            if (luma(y * W + x) < BODY_DIM * median[y]) (last = x), (lit = 0);
            else lit++;
          }
          return last;
        };
        const l = a <= b ? shade(a, 1) : -1, r = a <= b ? shade(b, -1) : -1;
        if (l >= 0) clear(y, 0, l + 1);
        if (r >= 0) clear(y, r, W);
      }
      const runs = [];
      for (let x = 0; x < W; x++) {
        if (!solid[y * W + x]) continue;
        if (runs.length && runs[runs.length - 1][1] === x) runs[runs.length - 1][1] = x + 1;
        else runs.push([x, x + 1]);
      }
      while (runs.length > 1 && runs[0][1] - runs[0][0] < BODY_SLIVER) clear(y, ...runs.shift());
      while (runs.length > 1 && runs[runs.length - 1][1] - runs[runs.length - 1][0] < BODY_SLIVER) clear(y, ...runs.pop());
      // The photo's own edge is soft, blended with the pale backdrop, and
      // beside the fill it showed as a thin light line: BODY_TRIM pixels of
      // it go, for the fill to cover.
      if (runs.length && t > 0 && t < SKIRT_FROM - BODY_FADE) {
        const first = runs[0], last = runs[runs.length - 1];
        clear(y, first[0], Math.min(first[0] + BODY_TRIM, first[1]));
        first[0] = Math.min(first[0] + BODY_TRIM, first[1] - 1);
        clear(y, Math.max(last[1] - BODY_TRIM, last[0]), last[1]);
        last[1] = Math.max(last[1] - BODY_TRIM, last[0] + 1);
      }
      if (runs.length) (left[y] = runs[0][0]), (right[y] = runs[runs.length - 1][1] - 1);
      for (let k = 1; k < runs.length; k++) {
        const g0 = runs[k - 1][1], g1 = runs[k][0];
        if (this._sleeveAt((g0 + g1) / 2 / W, (y + 0.5) / H, SHADOW_REACH) <= 0.5) continue;
        for (let x = g0; x < g1; x++) {
          const sx = x - g0 < g1 - x ? Math.max(runs[k - 1][0], 2 * g0 - 1 - x) : Math.min(runs[k][1] - 1, 2 * g1 - 1 - x);
          const o = (y * OW + x + P) * 4, i = (y * W + sx) * 4;
          d[o] = src[i];
          d[o + 1] = src[i + 1];
          d[o + 2] = src[i + 2];
          d[o + 3] = 255;
        }
      }
    }
    // The mirror's axis on each side: a smooth curve just inside the torso's
    // edge, the same for every row near it. Mirrored about each row's own
    // edge, rows whose edges differed came out as horizontal bands, and
    // softened to hide the bands, as blur. About one smooth axis the filled
    // cloth is the photo's own cloth reflected whole, as in a mirror held to
    // the body's side: coherent from row to row, with nothing to hide.
    const axis = (edge, inward) => {
      const n = BODY_AXIS;
      // Taken from the rows' innermost edge nearby, so the axis is inside
      // the cloth wherever an edge dips in - the notch a dropped forearm
      // left - and then smoothed.
      const deep = new Float32Array(H).fill(NaN);
      for (let y = 0; y < H; y++) {
        let best = NaN;
        for (let k = Math.max(0, y - n); k <= Math.min(H - 1, y + n); k++) {
          const e = edge[k];
          if (Number.isNaN(e)) continue;
          if (Number.isNaN(best) || (inward > 0 ? e > best : e < best)) best = e;
        }
        deep[y] = best;
      }
      const out = new Float32Array(H).fill(NaN);
      for (let y = 0; y < H; y++) {
        let sum = 0, m = 0;
        for (let k = Math.max(0, y - n); k <= Math.min(H - 1, y + n); k++) if (!Number.isNaN(deep[k])) (sum += deep[k]), m++;
        if (m && !Number.isNaN(edge[y])) {
          const a = sum / m + inward * BODY_INSET;
          out[y] = inward > 0 ? Math.max(a, edge[y] + BODY_INSET) : Math.min(a, edge[y] - BODY_INSET);
        }
      }
      return out;
    };
    const aL = axis(left, 1), aR = axis(right, -1);
    // How far in the reflection reaches before it turns back, the same for
    // every row: a quarter of the torso's usual width, so that on a body only
    // the first reflection is seen - past it the reflection of a reflection
    // repeats, in chevrons - while it stays on this side of the body.
    const widths = [];
    for (let y = 0; y < H; y++) if (!Number.isNaN(left[y])) widths.push(right[y] - left[y]);
    widths.sort((x, y) => x - y);
    const span = Math.max(8, Math.round((widths[widths.length >> 1] || W) / 4));
    const usable = (sx, sy) => {
      if (sx < 0 || sx >= W || sy < 0 || sy >= H || !solid[sy * W + sx]) return false;
      return luma(sy * W + sx) >= BODY_DIM * median[sy];
    };

    for (let y = 0; y < H; y++) {
      const t = bodyAt(q, midX, (y + 0.5) / H)[1];
      const fade = smooth((t + BODY_FADE) / BODY_FADE) * (1 - smooth((t - SKIRT_FROM + BODY_FADE) / BODY_FADE));
      if (fade <= 0 || Number.isNaN(aL[y]) || Number.isNaN(aR[y])) continue;
      const alpha = Math.round(255 * fade);
      const copy = (x, a, dir) => {
        const o = (y * OW + x + P) * 4;
        if (d[o + 3] >= alpha) return;
        const m = Math.abs(x - a) % (2 * span);
        const tri = m < span ? m : 2 * span - m;
        let sx = Math.round(a + dir * tri), sy = y;
        // Where the reflection lands on a gap or a shadow, the same place a
        // few rows up or down - which keeps to the reflection - and only
        // then the other half of its swing.
        for (let k = 1; k <= 12 && !usable(sx, sy); k++) sy = y + (k % 2 ? 1 : -1) * ((k + 1) >> 1);
        if (!usable(sx, sy)) {
          sx = Math.round(a + dir * (span - tri));
          sy = y;
        }
        if (!usable(sx, sy)) return;
        const i = (sy * W + sx) * 4;
        d[o] = src[i];
        d[o + 1] = src[i + 1];
        d[o + 2] = src[i + 2];
        d[o + 3] = alpha;
      };
      for (let x = left[y] - 1; x >= -P; x--) copy(x, aL[y], 1);
      for (let x = right[y] + 1; x < W + P; x++) copy(x, aR[y], -1);
    }
    octx.putImageData(img, 0, 0);

    // The body grid's picture coordinates, into this wider picture.
    const uv = this.body.mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, (this.body.x[i] * W + P) / OW);
    uv.needsUpdate = true;
    return out;
  }

  // The model's upper arms, for telling sleeve from body: see SLEEVE_REACH.
  // Worked in the picture's own proportions - `aspect` is its width over its
  // height - with the shoulder width as the unit.
  //
  // Also measured here, for laying each sleeve along the customer's arm: her
  // upper arm's length, her torso's, and how far her sleeve reaches out from
  // her arm's line - read off the cut-out's own transparency across the
  // sleeve, at a few places down it. `data` is the picture's pixels, W by H.
  _findArms(aspect, data, W, H) {
    this.arms = null;
    const sleeves = this._sleeveShape;
    if (!sleeves) return;
    const q = this._q;
    const at = ([x, y]) => [x * aspect, y];
    const width = Math.hypot((q.sl[0] - q.sr[0]) * aspect, q.sl[1] - q.sr[1]);
    const middle = at([(q.sl[0] + q.sr[0] + q.hl[0] + q.hr[0]) / 4, (q.sl[1] + q.sr[1] + q.hl[1] + q.hr[1]) / 4]);
    this._torso = Math.hypot(((q.hl[0] + q.hr[0] - q.sl[0] - q.sr[0]) / 2) * aspect, (q.hl[1] + q.hr[1] - q.sl[1] - q.sr[1]) / 2);
    const opaque = (px, py) => {
      const x = px / aspect, y = py;
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
      return data[(Math.floor(y * H) * W + Math.floor(x * W)) * 4 + 3] > 128;
    };
    this.arms = [[q.sl, sleeves.elbowLeft], [q.sr, sleeves.elbowRight]].map(([pivot, elbow]) => {
      const p = at(pivot), e = at(elbow);
      const length = Math.hypot(e[0] - p[0], e[1] - p[1]);
      const ux = (e[0] - p[0]) / length, uy = (e[1] - p[1]) / length;
      // Square to the arm, pointing in toward the body's middle.
      let nx = -uy, ny = ux;
      if ((middle[0] - p[0]) * nx + (middle[1] - p[1]) * ny < 0) (nx = -nx), (ny = -ny);
      // The hem, as a distance down the arm: it is given as a share of the
      // torso, and the elbow's own share says how far down the arm that is.
      // A sleeve past the elbow would need the forearm too; it is held at
      // the elbow's reach and a little past.
      const share = Math.min(sleeves.hem / Math.max(bodyAt(q, ...elbow)[1], 1e-3), 1.2);
      const hem = length * share;
      // How far out from the arm's line the sleeve reaches, at 40, 60 and 80
      // per cent of the way to its hem: the last cloth before three samples
      // of none.
      const reaches = [];
      for (const f of [0.4, 0.6, 0.8]) {
        const ax = p[0] + ux * hem * f, ay = p[1] + uy * hem * f;
        let last = null, gap = 0;
        for (let d = 0; d <= 0.6 * width && gap < 3; d += 0.005 * width) {
          if (opaque(ax - nx * d, ay - ny * d)) (last = d), (gap = 0);
          else gap++;
        }
        if (last !== null) reaches.push(last);
      }
      reaches.sort((a, b) => a - b);
      const outer = reaches.length ? Math.max(reaches[reaches.length >> 1], 0.05 * width) : 0.15 * width;
      // `hemShare` is how far down the upper arm the sleeve ends: above it
      // the sleeve covers the customer's arm, below it the arm is bare.
      // `inner` is how far in from the arm's line the sleeve reaches: to
      // where it is cut from the body, SLEEVE_REACH.
      return { p, ux, uy, nx, ny, hem, width, aspect, hemShare: share, length, outer, inner: SLEEVE_REACH * width };
    });
    // Each sleeve vertex in its own side's arm frame.
    const sl = this.sleeve;
    for (let i = 0; i < sl.x.length; i++) {
      const a = this.arms[sl.s[i] < 0.5 ? 0 : 1];
      const vx = sl.x[i] * aspect - a.p[0], vy = sl.y[i] - a.p[1];
      this._along[i] = vx * a.ux + vy * a.uy;
      this._inward[i] = vx * a.nx + vy * a.ny;
    }
  }

  // How much a point of the picture belongs to either sleeve - or, given
  // `more`, to a sleeve reaching that many shoulder widths further in.
  _sleeveAt(x, y, more = 0) {
    if (!this.arms) return 0;
    return Math.max(sleeveWeight(this.arms[0], x, y, more), sleeveWeight(this.arms[1], x, y, more));
  }

  // Hand the shader the model's arms, so it can tell sleeve from body pixel
  // by pixel in the same terms as sleeveWeight: `u` is the stage's uniforms.
  sleeveUniforms(u) {
    const arms = this.arms;
    u.uSleeveOn.value = arms ? 1 : 0;
    if (!arms) return;
    arms.forEach((a, i) => {
      u.uSleeveA.value[i].set(a.p[0], a.p[1], a.ux, a.uy);
      u.uSleeveB.value[i].set(a.nx, a.ny, a.hem, 0);
    });
    u.uSleeveShape.value.set(arms[0].width, arms[0].aspect);
  }

  // `frame` is the customer's two shoulders and two hips, in world space,
  // named for the customer's own left and right as the anchors are named for
  // the model's. `edges`, when given, is the customer's own edge at each
  // level, in the same `s` terms as photoEdges: see restretch. `elbows` is
  // `arms` is, for `left` and `right`, the customer's elbow in world space
  // and how far their arm reaches out from its line (`out`) and in toward
  // the body (`in`), in world units, as the outline shows it - either null
  // where not seen; see SLEEVE_FIT.
  update({ shoulderLeft, shoulderRight, hipLeft, hipRight }, edges = null, arms = null) {
    const shoulderMid = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5);
    const hipMid = hipLeft.clone().add(hipRight).multiplyScalar(0.5);
    const torso = hipMid.clone().sub(shoulderMid);
    const acrossTop = shoulderRight.clone().sub(shoulderLeft);
    const acrossHip = hipRight.clone().sub(hipLeft);
    const v = this._v;
    const reshape = edges && this.photoEdges;
    const fit = (s, t) => (reshape ? restretch(s, t, this.photoEdges, edges) : s);

    // Where a point of the photographed body lands on this one.
    const place = (s, t, out) => {
      if (t <= 1) {
        // Between the shoulder and hip lines, and above the shoulders too,
        // where the same blend carries on: that is the pallu over the
        // shoulder, kept on it rather than floating.
        out.copy(shoulderLeft).addScaledVector(acrossTop, s).multiplyScalar(1 - t);
        return out.addScaledVector(hipLeft, t).addScaledVector(acrossHip, s * t);
      }
      // Below the hips the cloth hangs from the hip line along the body. It
      // is not flared: how the skirt opens out is already in the photo.
      return out.copy(hipMid).addScaledVector(acrossHip, s - 0.5).addScaledVector(torso, t - 1);
    };

    const body = this.body, pos = body.mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const s = fit(body.s[i], body.t[i]);
      place(s, body.t[i], v);
      pos.setXYZ(i, v.x, v.y, v.z);
      this._bodyST[i * 2] = s;
      this._bodyST[i * 2 + 1] = body.t[i];
    }
    pos.needsUpdate = true;
    body.mesh.geometry.attributes.aBody.needsUpdate = true;

    if (!this.arms) return;
    // The customer's shoulder width as it would be seen square-on - an arm
    // does not get thinner when the body turns - and so the size of the
    // photo's units on this body.
    const shoulders = Math.max(acrossTop.length(), (torso.length() * this.arms[0].width) / this._torso);
    const scale = shoulders / this.arms[0].width;
    const frames = [0, 1].map((k) => {
      const side = k === 0 ? "left" : "right";
      const P = k === 0 ? shoulderLeft : shoulderRight;
      const arm = this.arms[k];
      const got = arms?.[side];
      // The arm's direction: to the customer's elbow; or, where it cannot be
      // read, the last one; or, before any, where her own elbow lands on
      // this body.
      const U = new THREE.Vector3();
      let length;
      if (got?.elbow && got.elbow.distanceTo(P) >= SLEEVE_STUB * shoulders) {
        U.copy(got.elbow).sub(P);
        length = U.length();
        U.divideScalar(length);
        this._dir[k] = { U: U.clone(), length };
      } else if (this._dir[k]) {
        U.copy(this._dir[k].U);
        length = this._dir[k].length;
      } else {
        const hers = this._sleeves[side];
        U.copy(place(hers[0], hers[1], this._own)).sub(P);
        length = U.length();
        U.divideScalar(length);
      }
      const N = inwardOf(U, torso, acrossTop, k === 0);
      // Along the arm: her upper arm onto theirs, within reason of the
      // photo's proportions, since a foreshortened arm reads short.
      const along = Math.min(Math.max(length / arm.length, 0.5 * scale), 1.3 * scale);
      // Across: each side of the arm widened to the outline, damped. The
      // underside, where it cannot be seen, is taken to be as wide as the
      // outer side: an arm is round.
      const w = this._width[k];
      const fitTo = (reach) => Math.min(Math.max((reach * (1 + SLEEVE_FIT)) / arm.outer / scale, 0.9), SLEEVE_WIDEST);
      const outWant = got?.out ? fitTo(got.out) : 1;
      w.out += (outWant - w.out) * WIDTH_EASE;
      const underWant = got?.in ? fitTo(got.in) : w.out;
      w.under += (underWant - w.under) * WIDTH_EASE;
      return { P, U, N, along, out: w.out * scale, under: w.under * scale, in: scale };
    });

    // Each half of the sleeve layer is laid rigidly along its arm, so nothing
    // in it stretches between arm and body; what of it is not sleeve is not
    // drawn.
    const sleeve = this.sleeve, spos = sleeve.mesh.geometry.attributes.position;
    const upos = this.under.mesh.geometry.attributes.position;
    for (let i = 0; i < spos.count; i++) {
      const f = frames[sleeve.s[i] < 0.5 ? 0 : 1];
      const n = this._inward[i];
      v.copy(f.P).addScaledVector(f.U, this._along[i] * f.along).addScaledVector(f.N, n * (n >= 0 ? f.in : f.out));
      spos.setXYZ(i, v.x, v.y, v.z);
      // The underside: the same cloth, mirrored across the arm's line.
      v.copy(f.P).addScaledVector(f.U, this._along[i] * f.along).addScaledVector(f.N, -n * f.under);
      upos.setXYZ(i, v.x, v.y, v.z);
    }
    spos.needsUpdate = true;
    upos.needsUpdate = true;
  }

  // The sleeves let go of the last body's arms.
  forget() {
    this._dir = [null, null];
    this._width = [{ out: 1, under: 1 }, { out: 1, under: 1 }];
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.sleeveMesh.geometry.dispose();
    this.underMesh.geometry.dispose();
  }
}

// The photographed body's edge at each level: along the row across it at
// that height, from the middle outward on each side, the last point that
// `solid` says is cloth - so her midriff, a hole in the cloth and not its
// edge, is passed over. Rows run ROW_REACH out past each joint. Returns [left, right] per level, or
// null where a side has no cloth at all.
export function rowEdges({ sl, sr, hl, hr }, solid) {
  const out = [];
  for (let k = 0; k < LEVELS; k++) {
    const at = rowAt({ sl, sr, hl, hr }, k / (LEVELS - 1));
    const edge = (dir) => {
      let last = 0.5;
      for (let s = 0.5; s >= -ROW_REACH && s <= 1 + ROW_REACH; s += dir * 0.02) if (solid(...at(s))) last = s;
      return last;
    };
    const row = [edge(-1), edge(1)];
    out.push(row[0] === 0.5 || row[1] === 0.5 ? null : row);
  }
  return out;
}

// The customer's edge at each level: along the row from the middle outward,
// the first point where the body gives way to background - two samples of
// it, not one, as a speck in the outline is not the body's edge. Where an arm
// comes first the torso's own edge is under it: that side is returned at the
// arm's middle, with `blocked` set, since the torso reaches at least as far
// as that under the arm. Stopped where the arm begins, the body layer ended
// short of the sleeve and the customer's shirt showed between. A level whose middle cannot be read at all - off the frame,
// or under an arm across the chest - is null.
export function bodySides({ sl, sr, hl, hr }, solid, onArm) {
  const out = [];
  for (let k = 0; k < LEVELS; k++) {
    const at = rowAt({ sl, sr, hl, hr }, k / (LEVELS - 1));
    if (!solid(...at(0.5)) || onArm(...at(0.5))) {
      out.push(null);
      continue;
    }
    const side = (dir) => {
      let last = 0.5;
      let gap = 0;
      for (let s = 0.5; s >= -ROW_REACH && s <= 1 + ROW_REACH; s += dir * 0.02) {
        const p = at(s);
        if (onArm(...p)) {
          let end = s;
          for (let e = s; e >= -ROW_REACH && e <= 1 + ROW_REACH && onArm(...at(e)); e += dir * 0.02) end = e;
          return { s: (s + end) / 2, blocked: true };
        }
        if (solid(...p)) {
          last = s;
          gap = 0;
        } else if (++gap >= 2) {
          return { s: last, blocked: false };
        }
      }
      return null;
    };
    out.push([side(-1), side(1)]);
  }
  return out;
}

// The row across a body at `t` down it, as a function of `s` along it.
function rowAt({ sl, sr, hl, hr }, t) {
  const lx = sl[0] + (hl[0] - sl[0]) * t, ly = sl[1] + (hl[1] - sl[1]) * t;
  const rx = sr[0] + (hr[0] - sr[0]) * t, ry = sr[1] + (hr[1] - sr[1]) * t;
  return (s) => [lx + (rx - lx) * s, ly + (ry - ly) * s];
}

// Move `s` so that the photographed body's edges at this height land on the
// customer's, evenly from the middle of the row; outside the edges the cloth
// keeps its own width and moves with the edge. A narrower customer is met
// everywhere. A broader one only toward the skirt - see WIDEN_FROM - since
// above it the body layer already reaches past them.
function restretch(s, t, photo, body) {
  const k = Math.min(Math.max(t, 0), 1) * (LEVELS - 1);
  const k0 = Math.floor(k), k1 = Math.min(k0 + 1, LEVELS - 1), f = k - k0;
  const at = (edges, side) => {
    const a = edges[k0], b = edges[k1];
    if (!a || !b || a[side] === null || b[side] === null) return null;
    return a[side] + (b[side] - a[side]) * f;
  };
  const side = s < 0.5 ? 0 : 1;
  const p = at(photo, side), c = at(body, side);
  if (p === null || c === null || Math.abs(p - 0.5) < 1e-3) return s;
  let wider = (c - 0.5) / (p - 0.5);
  if (wider > 1) wider = 1 + (wider - 1) * smooth((t - WIDEN_FROM) / (SKIRT_FROM - WIDEN_FROM));
  if (side === 0 ? s < p : s > p) return 0.5 + (p - 0.5) * wider + (s - p);
  return 0.5 + (s - 0.5) * wider;
}

// The same weight in the shader, for a point of the picture `pic`: `a` is an
// arm's joint and direction, `b` its inward direction and hem, `shape` the
// shoulder width and the picture's aspect - see sleeveUniforms.
export const SLEEVE_GLSL = /* glsl */ `
float sleeveSmooth(float x) { float k = clamp(x, 0.0, 1.0); return k * k * (3.0 - 2.0 * k); }
// \`up\` is 1 for the sleeve and 0 for its mirrored underside, whose top must
// not reach above the joint: mirrored, the top of the shoulder lands on the
// inside, by the neck.
float sleeveInward(vec2 pic, vec4 a, vec4 b, vec2 shape) {
  return dot(vec2(pic.x * shape.y, pic.y) - a.xy, b.xy) / shape.x;
}
float sleeveWeight(vec2 pic, vec4 a, vec4 b, vec2 shape, float up) {
  vec2 v = vec2(pic.x * shape.y, pic.y) - a.xy;
  float along = dot(v, a.zw), inward = dot(v, b.xy);
  float cap = -${SLEEVE_CAP_UP.toFixed(4)} * up * sleeveSmooth(-inward / shape.x / ${SLEEVE_REACH.toFixed(4)});
  return (1.0 - sleeveSmooth((inward / shape.x - ${SLEEVE_REACH.toFixed(4)}) / ${SLEEVE_BLEND.toFixed(4)} + 0.5))
    * sleeveSmooth((along / shape.x - cap) / ${SLEEVE_CAP.toFixed(4)})
    * (1.0 - sleeveSmooth((along - b.z) / shape.x / ${SLEEVE_FADE.toFixed(4)} + 0.5));
}
`;

// Skin, by the same test as the cut-out tool's --skin-hue: warm, redder than
// gold, not grey. Channels 0-255. The hue is held a little under the tool's
// 0.08: the blue saree's orange pallu ran to 0.079 beside her sleeve, and her
// skin measured 0.04-0.07.
function isSkin(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx < 115 || r <= b + 15 || mx !== r) return false;
  const sat = (mx - mn) / mx;
  const hue = (((g - b) / Math.max(mx - mn, 1)) % 6) / 6;
  return sat > 0.15 && sat < 0.6 && hue < 0.072;
}

// How much a point of the picture, (x, y) as shares of it, belongs to the
// sleeve of `arm`: see SLEEVE_REACH.
function sleeveWeight(arm, x, y, more = 0) {
  const { p, ux, uy, nx, ny, hem, width, aspect } = arm;
  const vx = x * aspect - p[0], vy = y - p[1];
  const along = vx * ux + vy * uy, inward = vx * nx + vy * ny;
  const cap = -SLEEVE_CAP_UP * smooth(-inward / width / SLEEVE_REACH);
  return (1 - smooth((inward / width - SLEEVE_REACH - more) / SLEEVE_BLEND + 0.5))
    * smooth((along / width - cap) / SLEEVE_CAP)
    * (1 - smooth((along - hem) / width / SLEEVE_FADE + 0.5));
}

const smooth = (x) => {
  const k = Math.min(Math.max(x, 0), 1);
  return k * k * (3 - 2 * k);
};

// Square to an arm's direction `U`, the side toward the body: for the left
// arm, the way `across` (left shoulder to right) lies from `down` (the
// torso's line), turned the same way round from `U`; the right arm the other
// way. Worked from the body's own lines, not from where its middle is, so an
// arm across the chest - pointing at the middle - does not flip it.
export function inwardOf(U, down, across, left) {
  const sense = Math.sign(down.x * across.y - down.y * across.x) || 1;
  const k = left ? sense : -sense;
  return new THREE.Vector3(-U.y * k, U.x * k, 0);
}

// Whether a point lies in a polygon given as [[x, y], ...].
function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// Where a point of the picture sits on the photographed body: the inverse of
// the map `update` applies to the customer's. Below the hip line the map is
// straight, so that part is solved directly - and it has to be decided first:
// hips narrower than shoulders make the blend between the two lines fold over
// on itself not far below the hips, and Newton's method, asked about a point
// down there, runs off to nonsense. Above the hip line it settles in a
// handful of steps.
function bodyAt({ sl, sr, hl, hr }, x, y) {
  const mx = (hl[0] + hr[0]) / 2, my = (hl[1] + hr[1]) / 2;
  const ax = hr[0] - hl[0], ay = hr[1] - hl[1];
  const dx = mx - (sl[0] + sr[0]) / 2, dy = my - (sl[1] + sr[1]) / 2;
  const side = (px, py) => ax * (py - hl[1]) - ay * (px - hl[0]);
  if (side(x, y) * side(mx - dx, my - dy) < 0) {
    const det = ax * dy - ay * dx;
    const px = x - mx, py = y - my;
    return [0.5 + (px * dy - py * dx) / det, 1 + (ax * py - ay * px) / det];
  }

  let s = 0.5;
  let t = 0.5;
  for (let k = 0; k < 30; k++) {
    const topX = sl[0] + s * (sr[0] - sl[0]), topY = sl[1] + s * (sr[1] - sl[1]);
    const botX = hl[0] + s * (hr[0] - hl[0]), botY = hl[1] + s * (hr[1] - hl[1]);
    const fx = topX + t * (botX - topX) - x;
    const fy = topY + t * (botY - topY) - y;
    const dsx = (1 - t) * (sr[0] - sl[0]) + t * (hr[0] - hl[0]);
    const dsy = (1 - t) * (sr[1] - sl[1]) + t * (hr[1] - hl[1]);
    const dtx = botX - topX, dty = botY - topY;
    const det = dsx * dty - dsy * dtx;
    if (Math.abs(det) < 1e-9) break;
    s -= (fx * dty - fy * dtx) / det;
    t -= (dsx * fy - dsy * fx) / det;
  }
  return [s, Math.min(t, 1)];
}

// Where the four anchors sit in a photograph when an entry gives none, as
// shares of its width and height: the model's own left shoulder and hip on
// the picture's right, since she faces the camera. Every entry overrides
// these with what its photo measured; they only keep the viewer sane.
export const DEFAULT_ANCHORS = {
  shoulderLeft: [0.66, 0.1],
  shoulderRight: [0.34, 0.1],
  hipLeft: [0.63, 0.36],
  hipRight: [0.37, 0.36],
};
