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
// on this body. Four points do the work - the two shoulders and the two hips -
// and everything between them is interpolated.
//
// What this does NOT do is simulate cloth. Nothing swings, and nothing folds
// that was not already folded in the photograph. For a proof of concept that
// is the right trade: the drape you see is the real garment's, photographed,
// not a guess at how fabric falls.

import * as THREE from "three";

// The grid's density. The warp is smooth, so this is about how well the
// garment follows a bend rather than how detailed it looks: too coarse and a
// leaning body creases the print into facets.
const ACROSS = 16;
const DOWN = 24;

// How far below the hips the garment reaches, as a share of the shoulder-to-
// hip distance. A saree falls to the ankles, which is roughly two and a half
// torsos down from the hips - usually past the bottom of the frame, and that
// is fine: what is off-screen is simply not drawn.
const SKIRT = 2.6;

// The skirt widens as it falls. A saree is not a tube; the pleats open out.
const FLARE = 0.55;

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

    // Where each vertex sits in the garment's own coordinates, kept because
    // the plane's own positions are about to be overwritten.
    const pos = geometry.attributes.position;
    this._u = new Float32Array(pos.count);
    this._t = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      this._u[i] = pos.getX(i) + 0.5; // 0 at the garment's left, 1 at its right
      this._t[i] = 0.5 - pos.getY(i); // 0 at the shoulder line, 1 at the hem
    }
  }

  // `fit` is where the garment's own anchor points have landed on this body:
  // the two shoulders and the two hips, in world space. `anchors` says where
  // those same four points sit in the image, so a photograph framed loosely
  // fits as well as one cropped tight.
  update({ shoulderLeft, shoulderRight, hipLeft, hipRight }, anchors) {
    const geometry = this.mesh.geometry;
    const pos = geometry.attributes.position;

    // The body's own axes. Across is the shoulder line; down is the lean from
    // shoulders to hips, which is what lets the garment follow someone who is
    // not standing square to the camera.
    const shoulderMid = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5);
    const hipMid = hipLeft.clone().add(hipRight).multiplyScalar(0.5);
    const down = hipMid.clone().sub(shoulderMid);
    const torso = down.length();
    down.normalize();

    const acrossTop = shoulderRight.clone().sub(shoulderLeft);
    const acrossHip = hipRight.clone().sub(hipLeft);

    // The image's own frame, so the warp maps the garment's shoulders to the
    // body's shoulders rather than the picture's corners to them.
    const a = anchors ?? DEFAULT_ANCHORS;
    const imageTorso = Math.max(a.hipY - a.shoulderY, 1e-3);

    for (let i = 0; i < pos.count; i++) {
      // Where this vertex sits in the picture, and therefore on the body:
      // `t` counted in torsos below the shoulder line - negative above it,
      // which is the pallu over the shoulder - and `u` across the picture.
      const t = (this._t[i] - a.shoulderY) / imageTorso;
      const u = this._u[i];

      // Across the body, the garment is the shoulder line above the hips and
      // the hip line below them, widening as it falls.
      let across;
      let mid;
      if (t <= 1) {
        // Above the hips the shoulder line rules, and above the shoulders it
        // carries on: `t` is negative there and the lerp extrapolates, which
        // is what keeps the pallu on the shoulder rather than floating.

        across = acrossTop.clone().lerp(acrossHip, t);
        mid = shoulderMid.clone().lerp(hipMid, t);
      } else {
        const below = t - 1;
        across = acrossHip.clone().multiplyScalar(1 + (below / SKIRT) * FLARE);
        mid = hipMid.clone().addScaledVector(down, below * torso);
      }

      // The picture's own left and right edges at this height, mapped onto
      // the body's width there.
      const clamped = Math.min(Math.max(t, 0), 1);
      const uL = lerp(a.shoulderLeftX, a.hipLeftX, clamped);
      const uR = lerp(a.shoulderRightX, a.hipRightX, clamped);
      const width = Math.max(uR - uL, 1e-3);
      const k = (u - uL) / width - 0.5;

      this._v.copy(mid).addScaledVector(across, k);
      pos.setXYZ(i, this._v.x, this._v.y, this._v.z);
    }

    pos.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
  }
}

const lerp = (a, b, t) => a + (b - a) * t;

// Where the four anchor points sit in a photograph, as a share of its width
// and height: the model's shoulders a tenth of the way down, hips at a third.
// Every entry overrides these with what its own photo measured - the tool
// prints them - and the numbers here only keep the viewer sane until it does.
export const DEFAULT_ANCHORS = {
  shoulderY: 0.1,
  hipY: 0.36,
  shoulderLeftX: 0.3,
  shoulderRightX: 0.7,
  hipLeftX: 0.32,
  hipRightX: 0.68,
};
