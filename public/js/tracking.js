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
};

// How sure the model has to be about a landmark before it is used. Below this
// it is guessing at a joint it cannot see - an arm behind the back, hips out
// of frame - and a guessed hip drags the whole garment with it.
const SURE = 0.6;

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
      });
      return this.pose;
    })();

    try {
      return await this._loading;
    } finally {
      this._loading = null;
    }
  }

  // Returns the landmarks, or null when nobody is in frame. The caller hides
  // the garment on null rather than leaving it hanging in the air.
  detect(video, timestampMs) {
    if (!this.pose) return null;
    const result = this.pose.detectForVideo(video, timestampMs);
    const marks = result?.landmarks?.[0];
    if (!marks) return null;

    // The shoulders and hips are the garment's whole frame. Without all four
    // read confidently there is nothing to hang it on, and half a frame reads
    // worse than no garment at all.
    for (const k of [POSE.SHOULDER_LEFT, POSE.SHOULDER_RIGHT, POSE.HIP_LEFT, POSE.HIP_RIGHT]) {
      const m = marks[k];
      if (!m || (m.visibility ?? 1) < SURE) return null;
    }
    return marks;
  }
}
