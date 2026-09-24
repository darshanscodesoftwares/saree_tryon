// Body tracking. One model, one job: where the customer's shoulders and hips
// are, in the frame.
//
// A saree is not a piece at a landmark, the way a ring or an earring is. It is
// cloth over the whole upper body, so what it needs is the body's frame - the
// shoulder line, the hip line and the lean between them - and that is what the
// pose model gives. The face model the jewellery viewer uses cannot help here;
// it stops at the chin.

import { FilesetResolver, PoseLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

const WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const POSE_MODEL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task";

// The landmarks this viewer reads, out of the thirty-three the model returns.
// Left and right are the subject's own, not the viewer's.
export const POSE = {
  SHOULDER_LEFT: 11,
  SHOULDER_RIGHT: 12,
  ELBOW_LEFT: 13,
  ELBOW_RIGHT: 14,
  WRIST_LEFT: 15,
  WRIST_RIGHT: 16,
  HIP_LEFT: 23,
  HIP_RIGHT: 24,
  KNEE_LEFT: 25,
  KNEE_RIGHT: 26,
  NOSE: 0,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  PINKY_LEFT: 17,
  PINKY_RIGHT: 18,
  INDEX_LEFT: 19,
  INDEX_RIGHT: 20,
};

// The person's outline is read at about this width. It is sampled on the CPU
// every frame to find the body's edges, and uploaded for the shader to clip
// against; a quarter of a 1280 frame is sharp enough for both, and a full
// frame would be most of the frame's time spent copying.
const MASK_WIDTH = 320;

// How sure the model has to be about a landmark before it is used. Below this
// it is guessing at a joint it cannot see - an arm behind the back, hips out
// of frame - and a guessed hip drags the whole garment with it.
const SURE = 0.6;

// A landmark read confidently and inside the camera frame. The model will
// place a hip below the bottom edge and still call it fairly visible; that is
// an extrapolation, and it swings with every breath.
export const seen = (m) => Boolean(m) && (m.visibility ?? 1) >= SURE && m.y >= 0 && m.y <= 1;

export class Tracker {
  constructor() {
    this.pose = null;
    this._loading = null;
  }

  // Loading twice in parallel is easy to trigger by reloading quickly, so the
  // in-flight promise is shared.
  async ensure(onProgress = () => {}) {
    if (this.pose) return this.pose;
    if (this._loading) return this._loading;

    this._loading = (async () => {
      onProgress("Loading body tracking…");
      const fileset = await FilesetResolver.forVisionTasks(WASM);
      this.pose = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: POSE_MODEL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
        // The outline of the person, besides the joints: what lets the cloth
        // meet the body's edge instead of stopping where the photo did.
        outputSegmentationMasks: true,
      });
      return this.pose;
    })();

    try {
      return await this._loading;
    } finally {
      this._loading = null;
    }
  }

  // Returns the landmarks, whether the hips are among them, and the person's
  // outline, or null when there is nobody to dress. The caller hides the
  // garment on null rather than leaving it hanging in the air.
  detect(video, timestampMs) {
    if (!this.pose) return null;
    const result = this.pose.detectForVideo(video, timestampMs);
    const masks = result?.segmentationMasks ?? [];
    try {
      const marks = result?.landmarks?.[0];
      if (!marks) return null;

      // The shoulders are the one thing the garment cannot do without. The
      // hips are welcome but optional: a customer at a phone is usually
      // framed neck to stomach, and the stage works out where the hips would
      // be.
      if (!seen(marks[POSE.SHOULDER_LEFT]) || !seen(marks[POSE.SHOULDER_RIGHT])) return null;
      const hipsSeen = seen(marks[POSE.HIP_LEFT]) && seen(marks[POSE.HIP_RIGHT]);
      return { marks, hipsSeen, mask: masks[0] ? shrink(masks[0]) : null };
    } finally {
      // The masks hold GPU memory until closed, one per frame.
      for (const m of masks) m.close();
    }
  }
}

// The outline, copied out of MediaPipe at MASK_WIDTH across: one byte per
// sample, 255 on the person. Row 0 is the top of the camera frame, unmirrored.
function shrink(mask) {
  const step = Math.max(1, Math.round(mask.width / MASK_WIDTH));
  const width = Math.floor(mask.width / step);
  const height = Math.floor(mask.height / step);
  const src = mask.getAsFloat32Array();
  const data = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = y * step * mask.width;
    for (let x = 0; x < width; x++) data[y * width + x] = src[row + x * step] * 255;
  }
  return { data, width, height };
}
