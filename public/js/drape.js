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
// on this body. Four points do the work - the two shoulders and the two hips,
// on the photographed model and on the customer - and everything between them
// is interpolated.
//
// What this does NOT do is simulate cloth. Nothing swings, and nothing folds
// that was not already folded in the photograph. For a proof of concept that
// is the right trade: the drape you see is the real garment's, photographed,
// not a guess at how fabric falls.

import * as THREE from "three";

// The grid's density. The warp is smooth, so this is about how well the
// garment follows a bend rather than how detailed it looks: too coarse and a
// leaning body creases the print into facets. It is also how sharply the
// pallu's edge is told from the body's, since that is decided per vertex.
const ACROSS = 32;
const DOWN = 64;

// The heights, as `t` down the torso, at which the cloth's edge is matched to
// the body's edge. Nine is a row every eighth of a torso: enough to follow a
// waist in and a hip out, few enough to read from the mask every frame.
export const LEVELS = 9;

// Below this far down the torso the cloth is a skirt, and a skirt is wider
// than the legs inside it - clipping it to the customer's outline would draw
// a saree as tight as trousers. From here down it hangs free.
const SKIRT_FROM = 1.05;

export class Garment {
  constructor(material) {
    const geometry = new THREE.PlaneGeometry(1, 1, ACROSS, DOWN);
    // Every vertex is rewritten each frame, so the attribute is dynamic and
    // the bounding sphere is disabled: three would otherwise recompute it
    // against vertices that have already moved on.
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);

    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.frustumCulled = false;
    this._v = new THREE.Vector3();

    // Where each vertex sits in the picture, as a share of its width and
    // height, kept because the plane's own positions are about to be
    // overwritten.
    const pos = geometry.attributes.position;
    this._x = new Float32Array(pos.count);
    this._y = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this._x[i] = pos.getX(i) + 0.5; // 0 at the picture's left, 1 at its right
      this._y[i] = 0.5 - pos.getY(i); // 0 at its top, 1 at its bottom
    }
    // And where each sits on the photographed body: `s` across it, 0 at her
    // left side and 1 at her right, `t` down it, 0 on the shoulder line and 1
    // on the hip line. Worked out once per saree, in setAnchors.
    this._s = new Float32Array(pos.count);
    this._t = new Float32Array(pos.count);

    // 1 where the cloth may hang outside the customer's outline - the pallu
    // off the shoulder, the skirt - and 0 where it is clipped to the body.
    // The shader reads it; see scene.js.
    this._free = new Float32Array(pos.count);
    geometry.setAttribute("aFree", new THREE.BufferAttribute(this._free, 1));

    // The photographed body's own edge at each level, as `s` on her left and
    // on her right. Read off the cut-out once it has loaded; until then the
    // cloth is not reshaped.
    this.photoEdges = null;

    this.setAnchors(DEFAULT_ANCHORS);
  }

  // Place every vertex on the photographed body. The same (s, t) is then put
  // on the customer's body each frame, so her shoulder lands on the
  // customer's shoulder whatever the photo's framing, slope or handedness.
  setAnchors(anchors, free = []) {
    this._q = {
      sl: anchors.shoulderLeft, sr: anchors.shoulderRight,
      hl: anchors.hipLeft, hr: anchors.hipRight,
    };
    this._freeShape = free;
    for (let i = 0; i < this._x.length; i++) {
      const [s, t] = bodyAt(this._q, this._x[i], this._y[i]);
      this._s[i] = s;
      this._t[i] = t;
      const skirt = Math.min(Math.max((t - SKIRT_FROM) / 0.1, 0), 1);
      this._free[i] = Math.max(skirt, inside(free, this._x[i], this._y[i]) ? 1 : 0);
    }
    this.mesh.geometry.attributes.aFree.needsUpdate = true;
    this.photoEdges = null;
  }

  // Read where the photographed body's edge is at each level, from the
  // cut-out's own transparency: along each row between her hip-to-shoulder
  // lines, the outermost opaque cloth that is not free to hang. The midriff
  // is a hole in the cloth, not an edge, which is why it is the outermost.
  measure(image) {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const solid = (x, y) => {
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return false;
      if (inside(this._freeShape, x, y)) return false;
      return data[(Math.floor(y * height) * width + Math.floor(x * width)) * 4 + 3] > 128;
    };
    this.photoEdges = rowEdges(this._q, solid, () => false);
  }

  // `frame` is the customer's two shoulders and two hips, in world space,
  // named for the customer's own left and right as the anchors are named for
  // the model's. `edges`, when given, is the customer's own edge at each
  // level, in the same `s` terms as photoEdges: the cloth's edge is moved to
  // it, and everything between stretched to suit.
  update({ shoulderLeft, shoulderRight, hipLeft, hipRight }, edges = null) {
    const pos = this.mesh.geometry.attributes.position;
    const shoulderMid = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5);
    const hipMid = hipLeft.clone().add(hipRight).multiplyScalar(0.5);
    const torso = hipMid.clone().sub(shoulderMid);
    const acrossTop = shoulderRight.clone().sub(shoulderLeft);
    const acrossHip = hipRight.clone().sub(hipLeft);
    const v = this._v;
    const reshape = edges && this.photoEdges;

    for (let i = 0; i < pos.count; i++) {
      let s = this._s[i];
      const t = this._t[i];
      if (reshape) s = restretch(s, t, this.photoEdges, edges);
      if (t <= 1) {
        // Between the shoulder and hip lines, and above the shoulders too,
        // where the same blend carries on: that is the pallu over the
        // shoulder, kept on it rather than floating.
        v.copy(shoulderLeft).addScaledVector(acrossTop, s).multiplyScalar(1 - t);
        v.addScaledVector(hipLeft, t).addScaledVector(acrossHip, s * t);
      } else {
        // Below the hips the cloth hangs from the hip line along the body.
        // It is not flared: how the skirt opens out is already in the photo.
        v.copy(hipMid).addScaledVector(acrossHip, s - 0.5).addScaledVector(torso, t - 1);
      }
      pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

// The edge of a body at each level: along the row across it at that height,
// from the middle outward on each side, the last point that `solid` says is
// body before `stop` says to stop. Rows run from s = -0.6 to 1.6, far enough
// out for a sleeve past the shoulder joint. Returns [left, right] per level,
// or null for a level whose middle cannot be read: not body at all - off the
// frame, say - or already stopped, as by an arm held across the chest.
export function rowEdges({ sl, sr, hl, hr }, solid, stop) {
  const out = [];
  for (let k = 0; k < LEVELS; k++) {
    const t = k / (LEVELS - 1);
    const lx = sl[0] + (hl[0] - sl[0]) * t, ly = sl[1] + (hl[1] - sl[1]) * t;
    const rx = sr[0] + (hr[0] - sr[0]) * t, ry = sr[1] + (hr[1] - sr[1]) * t;
    const at = (s) => [lx + (rx - lx) * s, ly + (ry - ly) * s];
    if (!solid(...at(0.5)) || stop(...at(0.5))) {
      out.push(null);
      continue;
    }
    const edge = (dir) => {
      let last = 0.5;
      for (let s = 0.5; s >= -0.6 && s <= 1.6; s += dir * 0.02) {
        const p = at(s);
        if (stop(...p)) break;
        if (solid(...p)) last = s;
      }
      return last;
    };
    out.push([edge(-1), edge(1)]);
  }
  return out;
}

// Move `s` so that the photographed body's edges at this height land on the
// customer's. Between the edges the cloth is stretched evenly from the
// middle; outside them - the pallu, a sleeve's end - it keeps its own width
// and moves with the edge, so the pallu still hangs beside the arm.
function restretch(s, t, photo, body) {
  const k = Math.min(Math.max(t, 0), 1) * (LEVELS - 1);
  const k0 = Math.floor(k), k1 = Math.min(k0 + 1, LEVELS - 1), f = k - k0;
  const at = (edges, side) => {
    const a = edges[k0], b = edges[k1];
    if (!a || !b) return null;
    return a[side] + (b[side] - a[side]) * f;
  };
  const side = s < 0.5 ? 0 : 1;
  const p = at(photo, side), c = at(body, side);
  if (p === null || c === null || Math.abs(p - 0.5) < 1e-3) return s;
  if (side === 0 ? s >= p : s <= p) return 0.5 + ((s - 0.5) * (c - 0.5)) / (p - 0.5);
  return c + (s - p);
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
