// The stage: the three.js side, and the map from the camera frame to it.
//
// The garment has to sit ON the video, so the scene's job is to make one world
// unit mean the same thing as a fraction of the frame. The warp itself lives
// in drape.js; what lives here is everything read off the camera each frame -
// the body's frame, its outline, and where its arms are.

import * as THREE from "three";
import { Garment, DEFAULT_ANCHORS, LEVELS, bodySides, inwardOf, SLEEVE_GLSL } from "./drape.js";
import { POSE, seen } from "./tracking.js";

// The plane the garment is drawn on, in front of the camera. Its distance is
// arbitrary; what matters is that the mapping below uses the same number.
const PLANE = 10;

// Where the hips are when the camera cannot see them - a customer framed from
// the neck to the stomach, which is how most will stand at a phone. These are
// body proportions in the pose model's own terms, measured by running it on
// the mustard saree's photo (public/pose-test.html): shoulders 266 px apart,
// shoulders to hips 416 px, mouth to shoulders 135 px, hips 136 px apart.
// That is one woman, in what may be a generated image, so they are a start
// and not a population:
// - shoulders to hips is 1.56 times the width between the shoulders;
// - it is 3.1 times the drop from the mouth to the shoulder line;
// - the hip points sit 0.51 as far apart as the shoulder points. The pose
//   model's hips are at the joints, well inside the outline.
// The width reading shrinks as the customer turns away and the neck reading
// does not, so the longer of the two is taken.
const TORSO_PER_SHOULDERS = 1.56;
const TORSO_PER_NECK = 3.1;
const HIPS_PER_SHOULDERS = 0.51;

// How much of the reading is taken each frame. The pose model wobbles a few
// pixels between frames and on something the size of a saree that reads as the
// whole garment breathing, so it is damped - but not so hard that it lags a
// body that has actually moved.
const EASE = 0.35;

// How far the cloth's edge may be moved to meet the body's, as a share of
// where the photo had it. The outline includes whatever the customer is
// wearing, so an unbounded match would dress a baggy jacket. Widening only
// reaches the skirt - above it the body layer covers a broader body without
// it, see restretch in drape.js - and a skirt half as wide again as the
// model's hips is the most a saree would hang. Guesses, to be settled on
// real people.
const EDGE_MIN = 0.75;
const EDGE_MAX = 1.5;

// How much of the edge reading is taken each frame - gentler than the fit,
// because the outline's edge flickers wherever an arm nearly touches the
// side, and a garment whose sides twitch reads as a glitch. A guess.
const EDGE_EASE = 0.15;

// The customer's build: how far their shoulders reach past the joints, read
// along the shoulder line - the one row the arms do not hide while they hang
// down - against how far the model's did. It sets how wide the body layer is
// taken to be where an arm hides the torso's edge, so a broad-shouldered
// customer is not dressed in a slim model's width there. (The sleeves are
// sized to the arms themselves; see _armWidths.) It
// is read only while that arm hangs (elbow within BUILD_ELBOW shoulder widths
// of straight below the shoulder): an arm out to the side reads as shoulder.
// Bounds and rates are guesses; the reading is slow on purpose, since build
// does not change from frame to frame.
const BUILD_MIN = 0.85;
const BUILD_MAX = 1.4;
const BUILD_EASE = 0.05;
const BUILD_ELBOW = 0.3;

// The outline as the pose model gives it is read in blocks and decided afresh
// every frame, so its edge is ragged and crawls. Clipped to directly, cloth
// that reaches past the body gets a lumpy edge that shimmers. So it is
// averaged over frames (MASK_EASE of each new one) and blurred MASK_BLUR
// samples each way - about 8 px of a 1280 frame - before anything reads it.
// Guesses, chosen by eye against a ragged synthetic outline.
const MASK_EASE = 0.3;
const MASK_BLUR = 2;

// An arm counts as raised when its elbow is higher than this far below the
// shoulder, in shoulder widths; a hanging elbow is about 0.9 below. Raising an
// arm drags the pose model's shoulder up and out with it, so a raised arm's
// shoulder is held where it was: against the other shoulder when one arm is
// up, and against the mouth when both are - the mouth stays put in a shrug,
// and with the hips out of frame the garment's whole height comes from the
// shoulder width, so a spread shoulder line made it grow.
const RAISED = 0.4;

// How much of the elbow reading is taken each frame: slower than the frame,
// because a sleeve turning is more visible than a hem shifting, and the
// elbow is the noisiest of the joints read. A guess.
const ELBOW_EASE = 0.2;

// How many frames an elbow that drops out of view - off the bottom of the
// frame, say, with the hands on the hips - is kept where it was before the
// sleeve lets go. The pose model's confidence flickers at the edge of the
// frame, and a sleeve that let go on every flicker twitched. About two thirds
// of a second; a guess.
const ELBOW_GRACE = 20;

// How far across the upper arm its width is looked for, either side of the
// arm's line, in shoulder widths, and in what steps. Further than an arm is
// thick, so that an arm against the body - no background before the torso -
// reads as not seen on that side. Guesses.
const ARM_SCAN = 0.6;
const ARM_STEP = 0.015;

// The arms, as capsules round the pose model's points, in shoulder widths:
// about 9 cm across an upper arm, 7 across a forearm and 9 across a hand
// against 34 between the shoulder joints, with some margin because the points
// wobble. The shoulder width is taken square-on - the longer of it and the
// torso's length against it - since an arm does not get thinner when the
// customer turns and their shoulders foreshorten; sized from the
// foreshortened width, a turned customer's arm showed cloth down its edge. Estimates, not measured. All three stop the reading of the body's
// edge. The forearm and hand are drawn over both layers. The upper arm is
// cut from the body layer only below the sleeve's hem, or UPPER_ARM_FROM of
// the way down it without sleeves: above the hem the sleeve covers the arm,
// and cut there, the capsule - wider than the sleeve reaches inward - left a
// strip of bare arm down the sleeve's inside.
const UPPER_ARM = 0.15;
const UPPER_ARM_FROM = 0.3;

// The body layer reaches past the torso, and the soft outline let it creep
// onto the edges of an arm held away from the body - a halo of saree round
// the forearms with the hands on the hips. So it is also cut off at the
// customer's torso's edge as read at each level, EDGE_CLIP shoulder widths
// out: loosely, since the levels are coarse and the outline gives the
// torso's own side. At 0.05 the straight runs between the levels were the
// garment's edge, and a customer saw their saree's sides as a hexagon; at
// 0.15 the outline, smooth, is the edge, and the levels only stop the cloth
// short of an arm held well away. A guess.
const EDGE_CLIP = 0.15;
const FOREARM = 0.13;
const HAND = 0.17;

// How far past the outline the cloth may reach, as a share of the frame's
// width: the body layer reaches past every body, so this is where the
// saree's side edge falls - about a centimetre out, for the cloth's own
// thickness, at the distance a customer stands. The sleeves stand off the arm
// a little more. Guesses. It is reached for in MARGIN_STEPS directions round
// a circle: in four, left right up and down, every sloping edge - a shoulder,
// a hip, a leaning body - came out as a staircase.
const MARGIN = 0.01;
const SLEEVE_MARGIN = 0.02;
const MARGIN_STEPS = 12;


// Clips the cloth to the customer's outline and cuts their forearms and hands
// out of it. `vFree` is 1 where the cloth may hang past the outline - the
// pallu, the skirt - and the mask is the person, unmirrored, top row first.
// It also keeps each pass to its own part of the picture: the torso pass
// (uPart 0) draws what is not sleeve, the sleeve pass (uPart 1) the outer
// half of each sleeve, from its arm's line out, and the underside pass
// (uPart 2) the same half again, mirrored onto the arm's inner side.
const CLIP = /* glsl */ `
uniform sampler2D uMask;
uniform float uMaskOn;
uniform float uMirror;
uniform vec2 uResolution;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform vec2 uVideoSize;
uniform vec2 uMargin;
uniform vec2 uSleeveMargin;
uniform vec4 uArms[6];
uniform float uArmRadius[6];
uniform float uPart;
uniform sampler2D uOriginal;
uniform vec2 uPad;
uniform float uEdgeOn;
uniform vec2 uEdges[${LEVELS}];
uniform float uEdgeClip;
uniform float uSleeveOn;
uniform vec4 uSleeveA[2];
uniform vec4 uSleeveB[2];
uniform vec2 uSleeveShape;
varying float vFree;
varying vec2 vPic;
varying vec2 vBody;
${SLEEVE_GLSL}

// 1 inside the customer's torso's edge at this height, as last read, and 0
// past it: see EDGE_CLIP.
float withinTorso() {
  float k = clamp(vBody.y, 0.0, 1.0) * ${(LEVELS - 1).toFixed(1)};
  vec2 e = uEdges[0];
  for (int i = 0; i < ${LEVELS - 1}; i++) {
    float f = clamp(k - float(i), 0.0, 1.0);
    if (k >= float(i)) e = mix(uEdges[i], uEdges[i + 1], f);
  }
  float w = 0.01;
  return smoothstep(e.x - uEdgeClip - w, e.x - uEdgeClip, vBody.x)
    * (1.0 - smoothstep(e.y + uEdgeClip, e.y + uEdgeClip + w, vBody.x));
}

float onPerson(vec2 uv) { return texture2D(uMask, uv).r; }

float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * h);
}

float garmentKeep() {
  // The body layer is drawn whole - its picture has no sleeves in it - and
  // the sleeve layer only where it is sleeve.
  float part = 1.0;
  if (uPart > 0.5) {
    float sleeve = 0.0;
    if (uSleeveOn > 0.5) {
      // The sleeve pass reaches a little past the arm's line, and its
      // underside, drawn after it, a little past it the other way, each
      // opaque on the line: two soft edges meeting there let the camera
      // through.
      bool under = uPart > 1.5;
      float up = under ? 0.0 : 1.0;
      float from = 0.0, to = under ? 0.03 : 0.02;
      for (int k = 0; k < 2; k++) {
        float w = sleeveWeight(vPic, uSleeveA[k], uSleeveB[k], uSleeveShape, up);
        w *= 1.0 - smoothstep(from, to, sleeveInward(vPic, uSleeveA[k], uSleeveB[k], uSleeveShape));
        sleeve = max(sleeve, w);
      }
    }
    part = smoothstep(0.2, 0.8, sleeve);
  }
  if (uMaskOn < 0.5) {
    // No outline to cut the body layer to, so it keeps the photo's own
    // shape: without this its widened sides were a rectangle of cloth.
    if (uPart > 0.5) return part;
    vec2 o = vec2(vPic.x * uPad.x + uPad.y, 1.0 - vPic.y);
    return step(0.0, o.x) * step(o.x, 1.0) * texture2D(uOriginal, clamp(o, 0.0, 1.0)).a;
  }
  vec2 c = gl_FragCoord.xy / uResolution;
  c.y = 1.0 - c.y;
  if (uMirror > 0.5) c.x = 1.0 - c.x;
  vec2 uv = uCropOffset + c * uCropScale;

  float here = onPerson(uv);
  float near = here;
  vec2 margin = uPart > 0.5 ? uSleeveMargin : uMargin;
  for (int i = 0; i < ${MARGIN_STEPS}; i++) {
    float a = float(i) * ${(2 * Math.PI / MARGIN_STEPS).toFixed(6)};
    near = max(near, onPerson(uv + vec2(cos(a), sin(a)) * margin));
  }
  float keep = mix(smoothstep(0.15, 0.6, near), 1.0, vFree);
  if (uPart < 0.5 && uEdgeOn > 0.5) keep *= mix(withinTorso(), 1.0, vFree);
  keep *= part;

  // The forearms and hands are cut from both layers, the upper arms from the
  // body layer only.
  vec2 px = uv * uVideoSize;
  float arm = 0.0;
  for (int i = 0; i < 6; i++) {
    float r = uArmRadius[i];
    if (r > 0.0 && (i < 4 || uPart < 0.5)) {
      arm = max(arm, 1.0 - smoothstep(r * 0.8, r, toSegment(px, uArms[i].xy, uArms[i].zw)));
    }
  }
  arm *= smoothstep(0.3, 0.7, here);
  return keep * (1.0 - arm);
}
`;

export class Stage {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);

    // The photograph carries its own light, as the jewellery cut-outs do, so
    // it is shown unlit. Lighting a photograph again is what makes a picture
    // of silk under a lamp look like silk under two lamps.
    this.material = new THREE.MeshBasicMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
      opacity: 1,
    });

    // The customer's outline, as the shader reads it. One byte a sample,
    // replaced every frame; a single "on person" sample until the first.
    this.maskTexture = new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
    this.maskTexture.magFilter = THREE.LinearFilter;
    this.maskTexture.minFilter = THREE.LinearFilter;
    this.maskTexture.unpackAlignment = 1;
    this.maskTexture.needsUpdate = true;
    this._mask = null;

    this.uniforms = {
      uMask: { value: this.maskTexture },
      uMaskOn: { value: 0 },
      uMirror: { value: 1 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uCropScale: { value: new THREE.Vector2(1, 1) },
      uCropOffset: { value: new THREE.Vector2(0, 0) },
      uVideoSize: { value: new THREE.Vector2(1, 1) },
      uMargin: { value: new THREE.Vector2(MARGIN, MARGIN) },
      uSleeveMargin: { value: new THREE.Vector2(SLEEVE_MARGIN, SLEEVE_MARGIN) },
      uArms: { value: [0, 1, 2, 3, 4, 5].map(() => new THREE.Vector4()) },
      uOriginal: { value: null },
      uPad: { value: new THREE.Vector2(1, 0) },
      uEdgeOn: { value: 0 },
      uEdges: { value: Array.from({ length: LEVELS }, () => new THREE.Vector2(-10, 10)) },
      uEdgeClip: { value: EDGE_CLIP },
      uArmRadius: { value: [0, 0, 0, 0, 0, 0] },
    };
    Object.assign(this.uniforms, {
      uSleeveOn: { value: 0 },
      uSleeveA: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uSleeveB: { value: [new THREE.Vector4(), new THREE.Vector4()] },
      uSleeveShape: { value: new THREE.Vector2(1, 1) },
    });
    // The same shader twice, told apart by uPart: the torso pass and the
    // sleeve pass. The uniforms are shared; only uPart is each one's own.
    const shade = (part) => (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { uPart: { value: part } });
      const body = part === 0;
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\nattribute float aFree;\n${body ? "attribute vec2 aBody;" : ""}\nvarying float vFree;\nvarying vec2 vPic;\nvarying vec2 vBody;`)
        .replace("#include <begin_vertex>", `#include <begin_vertex>\nvFree = aFree;\nvPic = vec2(uv.x, 1.0 - uv.y);\nvBody = ${body ? "aBody" : "vec2(0.5)"};`);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${CLIP}`)
        .replace("#include <opaque_fragment>", "diffuseColor.a *= garmentKeep();\n#include <opaque_fragment>");
    };
    this.material.onBeforeCompile = shade(0);
    this.sleeveMaterial = this.material.clone();
    this.sleeveMaterial.onBeforeCompile = shade(1);
    // Two programs, not one: three would otherwise share the first's.
    this.sleeveMaterial.customProgramCacheKey = () => "sleeve";
    this.underMaterial = this.material.clone();
    this.underMaterial.onBeforeCompile = shade(2);
    this.underMaterial.customProgramCacheKey = () => "under";

    this.garment = new Garment(this.material, this.sleeveMaterial, this.underMaterial);
    this.scene.add(this.garment.mesh);
    this.scene.add(this.garment.underMesh);
    this.scene.add(this.garment.sleeveMesh);

    this.anchors = DEFAULT_ANCHORS;
    this.mirror = true;
    this.visible = false;
    this.settings = { scale: 1, offsetY: 0, opacity: 1 };

    this._fit = null;
    this._edges = null;
    this._across = null;
    this._belowMouth = null;
    this._build = [1, 1];
    this._elbow = { left: null, right: null };
    this._elbowLost = { left: 0, right: 0 };
    this._maskSum = null;
    this._armPoints = new Map();
    this._wearing = null;
    this._video = { width: 0, height: 0 };
    this._textures = new Map();
  }

  resize(width, height) {
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }

  setVideoSize(width, height) {
    this._video = { width, height };
  }

  setMirror(on) {
    this.mirror = on;
  }

  setOpacity(value) {
    this.settings.opacity = value;
    this.material.opacity = value;
    this.sleeveMaterial.opacity = value;
    this.underMaterial.opacity = value;
  }

  // Load a saree. The texture is cached, so flipping back and forth through
  // the list does not refetch. Its body's edges are read off the image once
  // it is in, which is why that waits for the load.
  wear(entry) {
    this._wearing = entry;
    this.anchors = entry.anchors ?? DEFAULT_ANCHORS;
    this.garment.setAnchors(this.anchors, entry.free ?? [], entry.sleeves ?? null);
    this._edges = null;
    const show = (texture) => {
      if (this._wearing !== entry) return;
      for (const m of [this.sleeveMaterial, this.underMaterial]) {
        m.map = texture;
        m.needsUpdate = true;
      }
      // The body layer is made from the picture once it is in; see
      // Garment.measure. It is small work, so it is not kept.
      const canvas = this.garment.measure(texture.image);
      const layer = new THREE.CanvasTexture(canvas);
      layer.colorSpace = THREE.SRGBColorSpace;
      // The body layer's picture coordinates back to the photo's.
      const w = texture.image.width;
      this.uniforms.uOriginal.value = texture;
      this.uniforms.uPad.value.set(canvas.width / w, -(canvas.width - w) / 2 / w);
      layer.anisotropy = 8;
      this._layer?.dispose();
      this._layer = layer;
      this.material.map = layer;
      this.material.needsUpdate = true;
      this.garment.sleeveUniforms(this.uniforms);
    };
    const cached = this._textures.get(entry.image);
    if (cached) return show(cached);
    new THREE.TextureLoader().load(entry.image, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      this._textures.set(entry.image, texture);
      show(texture);
    });
  }

  // What `object-fit: cover` shows of the camera frame on this canvas: the
  // overflowing side is cropped evenly. As a scale and an offset from the
  // canvas's own 0-1 to the frame's.
  _crop() {
    const { width: vw, height: vh } = this._video;
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    const videoAspect = vw / Math.max(vh, 1);
    const canvasAspect = cw / Math.max(ch, 1);
    if (videoAspect > canvasAspect) {
      const shown = canvasAspect / videoAspect;
      return { sx: shown, sy: 1, ox: (1 - shown) / 2, oy: 0 };
    }
    const shown = videoAspect / canvasAspect;
    return { sx: 1, sy: shown, ox: 0, oy: (1 - shown) / 2 };
  }

  _planeSize() {
    const h = 2 * PLANE * Math.tan((this.camera.fov * Math.PI) / 360);
    return { w: h * this.camera.aspect, h };
  }

  // The inverse of _toWorld: a point on the plane, back to a share of the
  // camera frame, unmirrored, as the pose model and its mask see it.
  _toVideo(v) {
    const { w, h } = this._planeSize();
    let x = v.x / w + 0.5;
    const y = 0.5 - v.y / h;
    if (this.mirror) x = 1 - x;
    const c = this._crop();
    return [c.ox + x * c.sx, c.oy + y * c.sy];
  }

  // A landmark, which MediaPipe gives as a share of the frame, to the world.
  //
  // The frame and the canvas rarely have the same shape, and the video is
  // drawn with `object-fit: cover`, so the same crop has to be applied here or
  // the garment sits beside the body rather than on it.
  _toWorld(mark, out = new THREE.Vector3()) {
    const c = this._crop();
    let x = (mark.x - c.ox) / c.sx;
    const y = (mark.y - c.oy) / c.sy;
    if (this.mirror) x = 1 - x;
    const { w, h } = this._planeSize();
    return out.set((x - 0.5) * w, (0.5 - y) * h, -PLANE);
  }

  // Fit the garment to a body. Called on every frame that has one. `mask`
  // is the person's outline from tracking.js, or null.
  update(landmarks, hipsSeen, mask = null) {
    const read = (k) => this._toWorld(landmarks[k], new THREE.Vector3());
    let shoulderLeft = read(POSE.SHOULDER_LEFT);
    let shoulderRight = read(POSE.SHOULDER_RIGHT);
    ({ shoulderLeft, shoulderRight } = this._holdRaised(shoulderLeft, shoulderRight, landmarks));
    const { hipLeft, hipRight } = hipsSeen
      ? { hipLeft: read(POSE.HIP_LEFT), hipRight: read(POSE.HIP_RIGHT) }
      : this._hipsFrom(shoulderLeft, shoulderRight, landmarks);

    // The shop's own fit, before damping: `scale` opens the garment out from
    // the body's middle, `offsetY` slides it up and down the torso.
    const mid = shoulderLeft.clone().add(shoulderRight).add(hipLeft).add(hipRight).multiplyScalar(0.25);
    const torso = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5).distanceTo(
      hipLeft.clone().add(hipRight).multiplyScalar(0.5)
    );
    const raw = { shoulderLeft, shoulderRight, hipLeft, hipRight };
    for (const key of Object.keys(raw)) {
      raw[key].sub(mid).multiplyScalar(this.settings.scale).add(mid);
      raw[key].y -= this.settings.offsetY * torso;
    }

    if (!this._fit) {
      this._fit = raw;
    } else {
      for (const key of Object.keys(raw)) this._fit[key].lerp(raw[key], EASE);
    }

    const arms = this._arms(landmarks);
    const outline = this._smooth(mask);
    this._setMask(outline, arms);
    const edges = this._readEdges(outline, arms);
    this._setEdges(edges);
    const elbows = this._elbowsOf(landmarks, mid, torso);
    this.garment.update(this._fit, edges, this._armWidths(outline, elbows));
    this.visible = true;
  }

  // The customer's elbows in world space, put through the shop's fit as the
  // frame is and damped like it, so a sleeve turns with the arm but does not
  // shiver with the pose model's reading of it. Null where not seen.
  _elbowsOf(landmarks, mid, torso) {
    for (const [side, k] of [["left", POSE.ELBOW_LEFT], ["right", POSE.ELBOW_RIGHT]]) {
      const m = landmarks[k];
      if (!seen(m)) {
        if (++this._elbowLost[side] > ELBOW_GRACE) this._elbow[side] = null;
        continue;
      }
      this._elbowLost[side] = 0;
      const now = this._toWorld(m).sub(mid).multiplyScalar(this.settings.scale).add(mid);
      now.y -= this.settings.offsetY * torso;
      this._elbow[side] = this._elbow[side] ? this._elbow[side].lerp(now, ELBOW_EASE) : now;
    }
    return this._elbow;
  }

  // For each arm, its elbow and how far it reaches out from its line and in
  // toward the body, in world units, as the outline shows it: across the
  // upper arm at a few places down the part the sleeve covers, the first
  // background after the arm. A side that meets the torso, or the edge of the
  // frame, before any background is not seen. See SLEEVE_FIT in drape.js.
  _armWidths(outline, elbows) {
    const f = this._fit;
    const out = { left: null, right: null };
    if (!f) return out;
    const across = f.shoulderRight.clone().sub(f.shoulderLeft);
    const down = f.hipLeft.clone().add(f.hipRight).sub(f.shoulderLeft).sub(f.shoulderRight).multiplyScalar(0.5);
    const shoulders = Math.max(across.length(), down.length() / TORSO_PER_SHOULDERS);
    const at = (p) => {
      const [x, y] = this._toVideo(p);
      if (x < 0 || y < 0 || x >= 1 || y >= 1) return -1;
      return outline.data[Math.floor(y * outline.height) * outline.width + Math.floor(x * outline.width)] >= 128 ? 1 : 0;
    };
    const p = new THREE.Vector3();
    for (const [k, side, P] of [[0, "left", f.shoulderLeft], [1, "right", f.shoulderRight]]) {
      const E = elbows[side];
      if (!E) continue;
      out[side] = { elbow: E, out: null, in: null };
      if (!outline) continue;
      const length = E.distanceTo(P);
      if (length < 0.2 * shoulders) continue;
      const U = E.clone().sub(P).divideScalar(length);
      const N = inwardOf(U, down, across, k === 0);
      const hem = Math.max(this.garment.arms?.[k].hemShare ?? 0.5, 0.35);
      const reach = (from, dir) => {
        let last = 0, gap = 0;
        for (let d = 0; d <= ARM_SCAN * shoulders; d += ARM_STEP * shoulders) {
          const hit = at(p.copy(from).addScaledVector(N, dir * d));
          if (hit < 0) return null;
          if (hit) (last = d), (gap = 0);
          else if (++gap >= 2) return last;
        }
        return null;
      };
      const outs = [], ins = [];
      for (const share of [0.4, 0.6, 0.8]) {
        const A = P.clone().addScaledVector(U, length * hem * share);
        if (at(A) !== 1) continue;
        const o = reach(A, -1), i = reach(A, 1);
        if (o !== null) outs.push(o);
        if (i !== null) ins.push(i);
      }
      const median = (a) => (a.length >= 2 ? a.sort((x, y) => x - y)[a.length >> 1] : null);
      out[side].out = median(outs);
      out[side].in = median(ins);
    }
    return out;
  }

  // Hold a raised arm's shoulder where it was against the other shoulder. The
  // pose model follows the arm up with the shoulder point, and a garment hung
  // on that tilts every time someone waves. With both arms down, or both up,
  // the reading stands.
  _holdRaised(shoulderLeft, shoulderRight, landmarks) {
    const width = shoulderLeft.distanceTo(shoulderRight);
    const raised = (elbow, shoulder) =>
      seen(landmarks[elbow]) && this._toWorld(landmarks[elbow]).y > shoulder.y - RAISED * width;
    const left = raised(POSE.ELBOW_LEFT, shoulderLeft);
    const right = raised(POSE.ELBOW_RIGHT, shoulderRight);
    const ml = landmarks[POSE.MOUTH_LEFT], mr = landmarks[POSE.MOUTH_RIGHT];
    const mouth = seen(ml) && seen(mr) ? this._toWorld(ml).add(this._toWorld(mr)).multiplyScalar(0.5) : null;
    if (!left && !right) {
      this._across = shoulderRight.clone().sub(shoulderLeft);
      if (mouth) this._belowMouth = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5).sub(mouth);
      return { shoulderLeft, shoulderRight };
    }
    if (!this._across) return { shoulderLeft, shoulderRight };
    if (left && right) {
      if (!mouth || !this._belowMouth) {
        // No mouth to hold them against - the head out of the top of the
        // frame, as it is with the arms up at a laptop. Their spread is held
        // at least, about where they are: it is the spread that made the
        // garment grow.
        const mid = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5);
        return {
          shoulderLeft: mid.clone().addScaledVector(this._across, -0.5),
          shoulderRight: mid.clone().addScaledVector(this._across, 0.5),
        };
      }
      const mid = mouth.add(this._belowMouth);
      return {
        shoulderLeft: mid.clone().addScaledVector(this._across, -0.5),
        shoulderRight: mid.clone().addScaledVector(this._across, 0.5),
      };
    }
    return left
      ? { shoulderLeft: shoulderRight.clone().sub(this._across), shoulderRight }
      : { shoulderLeft, shoulderRight: shoulderRight.copy(shoulderLeft).add(this._across) };
  }

  // The arms, as segments in camera pixels with a radius each: shoulder to
  // elbow, elbow to wrist, wrist to the middle of the hand. `cut` is what the
  // shader draws in front of the cloth, `all` what stops the edge reading.
  // The points are damped like the fit, or the cut-out round a forearm
  // shivers.
  _arms(landmarks) {
    const { width: vw, height: vh } = this._video;
    const point = (k) => {
      const m = landmarks[k];
      if (!seen(m)) {
        this._armPoints.delete(k);
        return null;
      }
      const now = [m.x * vw, m.y * vh];
      const was = this._armPoints.get(k);
      const p = was ? [was[0] + (now[0] - was[0]) * EASE, was[1] + (now[1] - was[1]) * EASE] : now;
      this._armPoints.set(k, p);
      return p;
    };
    const sl = landmarks[POSE.SHOULDER_LEFT], sr = landmarks[POSE.SHOULDER_RIGHT];
    let width = Math.hypot((sl.x - sr.x) * vw, (sl.y - sr.y) * vh);
    if (this._fit) {
      const f = this._fit;
      const top = this._toVideo(f.shoulderLeft.clone().add(f.shoulderRight).multiplyScalar(0.5));
      const hip = this._toVideo(f.hipLeft.clone().add(f.hipRight).multiplyScalar(0.5));
      width = Math.max(width, Math.hypot((top[0] - hip[0]) * vw, (top[1] - hip[1]) * vh) / TORSO_PER_SHOULDERS);
    }
    const cut = [];
    const all = [];
    const upper = [];
    for (const [shoulder, elbow, wrist, index, pinky] of [
      [POSE.SHOULDER_LEFT, POSE.ELBOW_LEFT, POSE.WRIST_LEFT, POSE.INDEX_LEFT, POSE.PINKY_LEFT],
      [POSE.SHOULDER_RIGHT, POSE.ELBOW_RIGHT, POSE.WRIST_RIGHT, POSE.INDEX_RIGHT, POSE.PINKY_RIGHT],
    ]) {
      const s = point(shoulder), e = point(elbow), w = point(wrist), i = point(index), p = point(pinky);
      if (s && e) {
        all.push({ a: s, b: e, r: UPPER_ARM * width });
        const hem = this.garment.arms?.[shoulder === POSE.SHOULDER_LEFT ? 0 : 1].hemShare;
        const k = Math.min(Math.max(hem ?? UPPER_ARM_FROM, UPPER_ARM_FROM), 1);
        const from = [s[0] + (e[0] - s[0]) * k, s[1] + (e[1] - s[1]) * k];
        upper.push({ a: from, b: e, r: UPPER_ARM * width });
      }
      if (e && w) cut.push({ a: e, b: w, r: FOREARM * width });
      if (w && i && p) cut.push({ a: w, b: [(i[0] + p[0]) / 2, (i[1] + p[1]) / 2], r: HAND * width });
    }
    return { cut, upper, all: all.concat(cut) };
  }

  // The outline, averaged over frames and blurred: see MASK_EASE. The same
  // arrays are reused every frame; the frame's mask is only read.
  _smooth(mask) {
    if (!mask) return null;
    const { width: w, height: h, data } = mask;
    const n = w * h;
    let m = this._maskSum;
    if (!m || m.width !== w || m.height !== h) {
      m = this._maskSum = { width: w, height: h, sum: Float32Array.from(data), row: new Float32Array(n), out: new Uint8Array(n) };
    } else {
      for (let i = 0; i < n; i++) m.sum[i] += (data[i] - m.sum[i]) * MASK_EASE;
    }
    const r = MASK_BLUR, k = 1 / (2 * r + 1);
    const at = (v, max) => (v < 0 ? 0 : v > max ? max : v);
    for (let y = 0; y < h; y++) {
      const o = y * w;
      let acc = 0;
      for (let x = -r; x <= r; x++) acc += m.sum[o + at(x, w - 1)];
      for (let x = 0; x < w; x++) {
        m.row[o + x] = acc * k;
        acc += m.sum[o + at(x + r + 1, w - 1)] - m.sum[o + at(x - r, w - 1)];
      }
    }
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let y = -r; y <= r; y++) acc += m.row[at(y, h - 1) * w + x];
      for (let y = 0; y < h; y++) {
        m.out[y * w + x] = acc * k;
        acc += m.row[at(y + r + 1, h - 1) * w + x] - m.row[at(y - r, h - 1) * w + x];
      }
    }
    return { data: m.out, width: w, height: h };
  }

  // Hand the shader this frame's outline, arms and the map from the canvas
  // to the camera frame.
  _setMask(mask, arms) {
    const u = this.uniforms;
    u.uMaskOn.value = mask ? 1 : 0;
    if (mask) {
      const t = this.maskTexture;
      if (t.image.width !== mask.width || t.image.height !== mask.height) {
        // A texture's size is fixed once uploaded, so a new size is a new one.
        t.dispose();
      }
      t.image = { data: mask.data, width: mask.width, height: mask.height };
      t.needsUpdate = true;
    }
    this._mask = mask;
    const c = this._crop();
    u.uCropScale.value.set(c.sx, c.sy);
    u.uCropOffset.value.set(c.ox, c.oy);
    u.uMirror.value = this.mirror ? 1 : 0;
    const { width: vw, height: vh } = this._video;
    u.uVideoSize.value.set(vw, vh);
    u.uMargin.value.set(MARGIN, (MARGIN * vw) / Math.max(vh, 1));
    u.uSleeveMargin.value.set(SLEEVE_MARGIN, (SLEEVE_MARGIN * vw) / Math.max(vh, 1));
    this.renderer.getDrawingBufferSize(u.uResolution.value);
    // Slots 0-3 the forearms and hands, 4-5 the upper arms: see the shader.
    const slots = [arms.cut[0], arms.cut[1], arms.cut[2], arms.cut[3], arms.upper[0], arms.upper[1]];
    for (let i = 0; i < 6; i++) {
      const arm = slots[i];
      u.uArmRadius.value[i] = arm ? arm.r : 0;
      if (arm) u.uArms.value[i].set(arm.a[0], arm.a[1], arm.b[0], arm.b[1]);
    }
  }

  // Hand the shader the customer's torso's edge at each level, for cutting
  // the body layer off past it; a level not read is left wide open.
  _setEdges(edges) {
    const u = this.uniforms;
    u.uEdgeOn.value = edges ? 1 : 0;
    if (!edges) return;
    for (let k = 0; k < LEVELS; k++) {
      const e = edges[k];
      if (e) u.uEdges.value[k].set(e[0], e[1]);
      else u.uEdges.value[k].set(-10, 10);
    }
  }

  // The customer's own edge at each level, read off the outline along the
  // rows of the fitted garment, kept within reach of where the photo had it
  // and damped. Where the edge cannot be seen - an arm against the side, an
  // arm held out at shoulder height - that side eases back to the photo's own
  // width, which is the photographed body's and the best guess there is. A
  // whole row that cannot be read - off the frame, or with an arm across its
  // middle - keeps its last value.
  _readEdges(mask, arms) {
    const photo = this.garment.photoEdges;
    if (!mask || !photo) return null;
    const { width: vw, height: vh } = this._video;
    const solid = (x, y) =>
      x >= 0 && y >= 0 && x < 1 && y < 1 &&
      mask.data[Math.floor(y * mask.height) * mask.width + Math.floor(x * mask.width)] >= 128;
    const onArm = (x, y) => arms.all.some(({ a, b, r }) => toSegment(x * vw, y * vh, a, b) < r);
    const f = this._fit;
    const q = {
      sl: this._toVideo(f.shoulderLeft), sr: this._toVideo(f.shoulderRight),
      hl: this._toVideo(f.hipLeft), hr: this._toVideo(f.hipRight),
    };
    this._readBuild(q, solid, photo[0]);
    const read = bodySides(q, solid, onArm);
    if (!this._edges) this._edges = photo.map((e) => e && [...e]);
    for (let k = 0; k < LEVELS; k++) {
      const p = photo[k], r = read[k], e = this._edges[k];
      if (!p || !r || !e) continue;
      for (const side of [0, 1]) {
        const dir = side === 0 ? -1 : 1;
        const had = (p[side] - 0.5) * dir * this._build[side];
        let want = had;
        const got = r[side];
        if (got) {
          const reach = Math.min(Math.max((got.s - 0.5) * dir, had * EDGE_MIN), had * EDGE_MAX);
          // An arm against the side hides the torso's edge, but the torso
          // reaches at least as far as the arm begins.
          want = got.blocked ? Math.max(had, reach) : reach;
        }
        e[side] += (0.5 + want * dir - e[side]) * EDGE_EASE;
      }
    }
    return this._edges;
  }

  // How far the customer's shoulders reach past the joints against the
  // model's, per side: see BUILD_MIN. `shoulders` is the photo's own reach
  // along its shoulder line.
  _readBuild(q, solid, shoulders) {
    if (!shoulders) return;
    const row = bodySides(q, solid, () => false)[0];
    if (!row) return;
    const pts = this._armPoints;
    for (const [side, shoulder, elbow, other] of [
      [0, POSE.SHOULDER_LEFT, POSE.ELBOW_LEFT, POSE.SHOULDER_RIGHT],
      [1, POSE.SHOULDER_RIGHT, POSE.ELBOW_RIGHT, POSE.SHOULDER_LEFT],
    ]) {
      const s = pts.get(shoulder), e = pts.get(elbow), o = pts.get(other);
      if (!s || !e || !o || !row[side]) continue;
      const width = Math.hypot(s[0] - o[0], s[1] - o[1]);
      const outward = (e[0] - s[0]) * Math.sign(s[0] - o[0]);
      if (outward > BUILD_ELBOW * width || e[1] < s[1] + BUILD_ELBOW * width) continue;
      const dir = side === 0 ? -1 : 1;
      const ratio = ((row[side].s - 0.5) * dir) / ((shoulders[side] - 0.5) * dir);
      const want = Math.min(Math.max(ratio, BUILD_MIN), BUILD_MAX);
      this._build[side] += (want - this._build[side]) * BUILD_EASE;
    }
  }

  // The hips of a body whose hips are out of frame: straight down from the
  // shoulders, square to the shoulder line, at the proportions above.
  _hipsFrom(shoulderLeft, shoulderRight, landmarks) {
    const across = shoulderRight.clone().sub(shoulderLeft);
    const mid = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5);
    const down = new THREE.Vector3(across.y, -across.x, 0).normalize();
    if (down.y > 0) down.negate();

    let torso = TORSO_PER_SHOULDERS * across.length();
    const ml = landmarks[POSE.MOUTH_LEFT];
    const mr = landmarks[POSE.MOUTH_RIGHT];
    if (seen(ml) && seen(mr)) {
      const mouth = this._toWorld(ml).add(this._toWorld(mr)).multiplyScalar(0.5);
      const neck = mid.clone().sub(mouth).dot(down);
      torso = Math.max(torso, TORSO_PER_NECK * neck);
    }

    const hipMid = mid.addScaledVector(down, torso);
    const half = across.multiplyScalar(HIPS_PER_SHOULDERS / 2);
    return { hipLeft: hipMid.clone().sub(half), hipRight: hipMid.clone().add(half) };
  }

  // Nobody in frame: the garment goes away rather than hanging in the air, and
  // everything learned about the last body is forgotten - the next one may be
  // a different person, with a different build.
  hide() {
    this.visible = false;
    this._fit = null;
    this._edges = null;
    this.uniforms.uEdgeOn.value = 0;
    this._elbow.left = this._elbow.right = null;
    this._elbowLost.left = this._elbowLost.right = 0;
    this._maskSum = null;
    this._armPoints.clear();
    this._across = null;
    this._belowMouth = null;
    this._build = [1, 1];
    this.garment.forget();
  }

  render() {
    this.garment.mesh.visible = this.visible;
    this.garment.sleeveMesh.visible = this.visible;
    this.garment.underMesh.visible = this.visible;
    this.renderer.render(this.scene, this.camera);
  }
}

const toSegment = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const h = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / Math.max(dx * dx + dy * dy, 1e-6), 0), 1);
  return Math.hypot(x - ax - dx * h, y - ay - dy * h);
};
