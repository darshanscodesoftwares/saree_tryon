// The stage: the three.js side, and the map from the camera frame to it.
//
// The garment has to sit ON the video, so the scene's job is to make one world
// unit mean the same thing as a fraction of the frame. Everything else - the
// warp itself - lives in drape.js.

import * as THREE from "three";
import { Garment, DEFAULT_ANCHORS } from "./drape.js";
import { POSE } from "./tracking.js";

// The plane the garment is drawn on, in front of the camera. Its distance is
// arbitrary; what matters is that the mapping below uses the same number.
const PLANE = 10;

// How far past the joints the cloth reaches. The pose model puts a shoulder
// at the joint, which is well inside the body's outline, and a garment fitted
// exactly between the two shoulders is a garment that leaves both arms bare.
// Measured against a standing body, a saree covers about a sixth wider than
// the joints alone.
const SPREAD = 1.18;

// How much of the reading is taken each frame. The pose model wobbles a few
// pixels between frames and on something the size of a saree that reads as the
// whole garment breathing, so it is damped - but not so hard that it lags a
// body that has actually moved.
const EASE = 0.35;

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

    this.garment = new Garment(this.material);
    this.scene.add(this.garment.mesh);

    this.anchors = DEFAULT_ANCHORS;
    this.mirror = true;
    this.visible = false;
    this.settings = { scale: 1, offsetY: 0, opacity: 1 };

    this._fit = null;
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
  // the list does not refetch.
  wear(entry) {
    this.anchors = entry.anchors ?? DEFAULT_ANCHORS;
    const cached = this._textures.get(entry.image);
    if (cached) {
      this.material.map = cached;
      this.material.needsUpdate = true;
      return;
    }
    new THREE.TextureLoader().load(entry.image, (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      this._textures.set(entry.image, texture);
      this.material.map = texture;
      this.material.needsUpdate = true;
    });
  }

  // A landmark, which MediaPipe gives as a share of the frame, to the world.
  //
  // The frame and the canvas rarely have the same shape, and the video is
  // drawn with `object-fit: cover`, so the same crop has to be applied here or
  // the garment sits beside the body rather than on it.
  _toWorld(mark, out = new THREE.Vector3()) {
    const { width: vw, height: vh } = this._video;
    const cw = this.canvas.clientWidth || 1;
    const ch = this.canvas.clientHeight || 1;
    const videoAspect = vw / Math.max(vh, 1);
    const canvasAspect = cw / Math.max(ch, 1);

    // What `cover` shows of the frame: the overflowing side is cropped evenly.
    let x = mark.x;
    let y = mark.y;
    if (videoAspect > canvasAspect) {
      const shown = canvasAspect / videoAspect;
      x = (x - (1 - shown) / 2) / shown;
    } else {
      const shown = videoAspect / canvasAspect;
      y = (y - (1 - shown) / 2) / shown;
    }

    if (this.mirror) x = 1 - x;

    const h = 2 * PLANE * Math.tan((this.camera.fov * Math.PI) / 360);
    const w = h * this.camera.aspect;
    return out.set((x - 0.5) * w, (0.5 - y) * h, -PLANE);
  }

  // Fit the garment to a body. Called on every frame that has one.
  update(landmarks) {
    const read = (k) => this._toWorld(landmarks[k], new THREE.Vector3());
    const shoulderLeft = read(POSE.SHOULDER_LEFT);
    const shoulderRight = read(POSE.SHOULDER_RIGHT);
    const hipLeft = read(POSE.HIP_LEFT);
    const hipRight = read(POSE.HIP_RIGHT);

    // The shop's own fit, before damping: `scale` opens the garment out from
    // the body's middle, `offsetY` slides it up and down the torso.
    const mid = shoulderLeft.clone().add(shoulderRight).add(hipLeft).add(hipRight).multiplyScalar(0.25);
    const torso = shoulderLeft.clone().add(shoulderRight).multiplyScalar(0.5).distanceTo(
      hipLeft.clone().add(hipRight).multiplyScalar(0.5)
    );
    const raw = { shoulderLeft, shoulderRight, hipLeft, hipRight };
    for (const key of Object.keys(raw)) {
      raw[key].sub(mid).multiplyScalar(SPREAD * this.settings.scale).add(mid);
      raw[key].y -= this.settings.offsetY * torso;
    }

    if (!this._fit) {
      this._fit = raw;
    } else {
      for (const key of Object.keys(raw)) this._fit[key].lerp(raw[key], EASE);
    }

    this.garment.update(this._fit, this.anchors);
    this.visible = true;
  }

  // Nobody in frame: the garment goes away rather than hanging in the air, and
  // the damping forgets where the last body was.
  hide() {
    this.visible = false;
    this._fit = null;
  }

  render() {
    this.garment.mesh.visible = this.visible;
    this.renderer.render(this.scene, this.camera);
  }
}
