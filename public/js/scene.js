// The stage: the three.js side, and the map from the camera frame to it.
//
// The garment has to sit ON the video, so the scene's job is to make one world
// unit mean the same thing as a fraction of the frame. The warp itself lives
// in drape.js; what lives here is everything read off the camera each frame -
// the body's frame, its outline, and where its arms are.

import * as THREE from "three";
import { Garment, DEFAULT_ANCHORS, LEVELS, rowEdges } from "./drape.js";
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
// wearing and any arm held against the side, so an unbounded match would dress
// a baggy jacket or both elbows. Guesses, to be settled on real people.
const EDGE_MIN = 0.8;
const EDGE_MAX = 1.25;

// An arm counts as raised when its elbow is higher than this far below the
// shoulder, in shoulder widths; a hanging elbow is about 0.9 below. Raising an
// arm drags the pose model's shoulder up with it, so a raised arm's shoulder
// is held where it was, relative to the other one.
const RAISED = 0.4;

// The forearm and the hand, as capsules round the pose model's points, in
// shoulder widths: about 7 cm across a forearm and 9 across a hand against 34
// between the shoulder joints, with some margin because the points wobble.
// Estimates, not measured. Where these cross the body the customer's own arm
// is drawn over the cloth.
const FOREARM = 0.13;
const HAND = 0.17;

// How far past the outline the cloth may reach, as a share of the frame's
// width. Cloth has thickness, and the outline is soft at its edge.
const MARGIN = 0.012;

// Clips the cloth to the customer's outline and cuts their forearms and hands
// out of it. `vFree` is 1 where the cloth may hang past the outline - the
// pallu, the skirt - and the mask is the person, unmirrored, top row first.
const CLIP = /* glsl */ `
uniform sampler2D uMask;
uniform float uMaskOn;
uniform float uMirror;
uniform vec2 uResolution;
uniform vec2 uCropScale;
uniform vec2 uCropOffset;
uniform vec2 uVideoSize;
uniform vec2 uMargin;
uniform vec4 uArms[4];
uniform float uArmRadius[4];
varying float vFree;

float onPerson(vec2 uv) { return texture2D(uMask, uv).r; }

float toSegment(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  return length(p - a - ab * h);
}

float garmentKeep() {
  if (uMaskOn < 0.5) return 1.0;
  vec2 c = gl_FragCoord.xy / uResolution;
  c.y = 1.0 - c.y;
  if (uMirror > 0.5) c.x = 1.0 - c.x;
  vec2 uv = uCropOffset + c * uCropScale;

  float here = onPerson(uv);
  float near = here;
  near = max(near, onPerson(uv + vec2(uMargin.x, 0.0)));
  near = max(near, onPerson(uv - vec2(uMargin.x, 0.0)));
  near = max(near, onPerson(uv + vec2(0.0, uMargin.y)));
  near = max(near, onPerson(uv - vec2(0.0, uMargin.y)));
  float keep = mix(smoothstep(0.3, 0.7, near), 1.0, vFree);

  vec2 px = uv * uVideoSize;
  float arm = 0.0;
  for (int i = 0; i < 4; i++) {
    float r = uArmRadius[i];
    if (r > 0.0) arm = max(arm, 1.0 - smoothstep(r * 0.8, r, toSegment(px, uArms[i].xy, uArms[i].zw)));
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
      uArms: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      uArmRadius: { value: [0, 0, 0, 0] },
    };
    this.material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute float aFree;\nvarying float vFree;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFree = aFree;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${CLIP}`)
        .replace("#include <opaque_fragment>", "diffuseColor.a *= garmentKeep();\n#include <opaque_fragment>");
    };

    this.garment = new Garment(this.material);
    this.scene.add(this.garment.mesh);

    this.anchors = DEFAULT_ANCHORS;
    this.mirror = true;
    this.visible = false;
    this.settings = { scale: 1, offsetY: 0, opacity: 1 };

    this._fit = null;
    this._edges = null;
    this._across = null;
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
  }

  // Load a saree. The texture is cached, so flipping back and forth through
  // the list does not refetch. Its body's edges are read off the image once
  // it is in, which is why that waits for the load.
  wear(entry) {
    this._wearing = entry;
    this.anchors = entry.anchors ?? DEFAULT_ANCHORS;
    this.garment.setAnchors(this.anchors, entry.free ?? []);
    this._edges = null;
    const show = (texture) => {
      if (this._wearing !== entry) return;
      this.material.map = texture;
      this.material.needsUpdate = true;
      this.garment.measure(texture.image);
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
    this._setMask(mask, arms);
    this.garment.update(this._fit, this._readEdges(mask, arms));
    this.visible = true;
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
    if (left === right) {
      if (!left) this._across = shoulderRight.clone().sub(shoulderLeft);
      return { shoulderLeft, shoulderRight };
    }
    if (!this._across) return { shoulderLeft, shoulderRight };
    return left
      ? { shoulderLeft: shoulderRight.clone().sub(this._across), shoulderRight }
      : { shoulderLeft, shoulderRight: shoulderRight.copy(shoulderLeft).add(this._across) };
  }

  // The forearms and hands, as segments in camera pixels with a radius each:
  // elbow to wrist, and wrist to the middle of the hand.
  _arms(landmarks) {
    const { width: vw, height: vh } = this._video;
    const px = (m) => [m.x * vw, m.y * vh];
    const sl = px(landmarks[POSE.SHOULDER_LEFT]), sr = px(landmarks[POSE.SHOULDER_RIGHT]);
    const width = Math.hypot(sl[0] - sr[0], sl[1] - sr[1]);
    const out = [];
    for (const [elbow, wrist, index, pinky] of [
      [POSE.ELBOW_LEFT, POSE.WRIST_LEFT, POSE.INDEX_LEFT, POSE.PINKY_LEFT],
      [POSE.ELBOW_RIGHT, POSE.WRIST_RIGHT, POSE.INDEX_RIGHT, POSE.PINKY_RIGHT],
    ]) {
      const e = landmarks[elbow], w = landmarks[wrist];
      if (!seen(e) || !seen(w)) continue;
      out.push({ a: px(e), b: px(w), r: FOREARM * width });
      const i = landmarks[index], p = landmarks[pinky];
      if (seen(i) && seen(p)) {
        const hand = [((i.x + p.x) / 2) * vw, ((i.y + p.y) / 2) * vh];
        out.push({ a: px(w), b: hand, r: HAND * width });
      }
    }
    return out;
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
    this.renderer.getDrawingBufferSize(u.uResolution.value);
    for (let i = 0; i < 4; i++) {
      const arm = arms[i];
      u.uArmRadius.value[i] = arm ? arm.r : 0;
      if (arm) u.uArms.value[i].set(arm.a[0], arm.a[1], arm.b[0], arm.b[1]);
    }
  }

  // The customer's own edge at each level, read off the outline along the
  // rows of the fitted garment, kept within reach of where the photo had it
  // and damped like the fit. A row that cannot be read - off the frame, or
  // with an arm across the middle of it - keeps its last value.
  _readEdges(mask, arms) {
    const photo = this.garment.photoEdges;
    if (!mask || !photo) return null;
    const { width: vw, height: vh } = this._video;
    const solid = (x, y) =>
      x >= 0 && y >= 0 && x < 1 && y < 1 &&
      mask.data[Math.floor(y * mask.height) * mask.width + Math.floor(x * mask.width)] >= 128;
    const onArm = (x, y) => arms.some(({ a, b, r }) => toSegment(x * vw, y * vh, a, b) < r);
    const f = this._fit;
    const q = {
      sl: this._toVideo(f.shoulderLeft), sr: this._toVideo(f.shoulderRight),
      hl: this._toVideo(f.hipLeft), hr: this._toVideo(f.hipRight),
    };
    const read = rowEdges(q, solid, onArm);
    if (!this._edges) this._edges = photo.map((e) => e && [...e]);
    for (let k = 0; k < LEVELS; k++) {
      const p = photo[k], r = read[k], e = this._edges[k];
      if (!p || !r || !e) continue;
      for (const side of [0, 1]) {
        const dir = side === 0 ? -1 : 1;
        const had = (p[side] - 0.5) * dir;
        const got = Math.min(Math.max((r[side] - 0.5) * dir, had * EDGE_MIN), had * EDGE_MAX);
        e[side] += (0.5 + got * dir - e[side]) * EASE;
      }
    }
    return this._edges;
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
  // the damping forgets where the last body was.
  hide() {
    this.visible = false;
    this._fit = null;
    this._edges = null;
  }

  render() {
    this.garment.mesh.visible = this.visible;
    this.renderer.render(this.scene, this.camera);
  }
}

const toSegment = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const h = Math.min(Math.max(((x - ax) * dx + (y - ay) * dy) / Math.max(dx * dx + dy * dy, 1e-6), 0), 1);
  return Math.hypot(x - ax - dx * h, y - ay - dy * h);
};
