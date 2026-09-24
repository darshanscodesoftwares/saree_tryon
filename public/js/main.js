// Wiring: camera in, body tracking, stage, controls, render loop.

import { startCamera } from "./camera.js";
import { Tracker } from "./tracking.js";
import { Stage } from "./scene.js";
import { SAREES, byId, defaultSaree } from "./library.js";

const el = (id) => document.getElementById(id);
const video = el("video");
const canvas = el("canvas");
const statusEl = el("status");

const stage = new Stage(canvas);
const tracker = new Tracker();

let running = false;
let lastTimestamp = 0;
let lastVideoTime = -1;
let frames = 0;
let fpsClock = performance.now();

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = kind;
  statusEl.style.display = text ? "block" : "none";
}

// The stage takes the camera's own shape, as large as the window allows.
// Squeezed into any other shape, `object-fit: cover` crops the difference off,
// and a laptop's landscape camera in a portrait box loses more than half its
// width - which reads as the camera being zoomed right in.
function layout() {
  const stageEl = el("stage");
  const viewer = el("viewer");
  if (video.videoWidth && video.videoHeight) {
    const pad = 32;
    const aspect = video.videoWidth / video.videoHeight;
    const room = { w: viewer.clientWidth - pad, h: innerHeight - pad };
    const w = Math.min(room.w, room.h * aspect);
    stageEl.style.maxWidth = "none";
    stageEl.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`;
    stageEl.style.width = `${Math.floor(w)}px`;
  }
  stage.resize(stageEl.clientWidth, stageEl.clientHeight);
  stage.setVideoSize(video.videoWidth, video.videoHeight);
}

function fillModels() {
  const select = el("model");
  select.innerHTML = "";
  for (const saree of SAREES) {
    const option = document.createElement("option");
    option.value = saree.id;
    option.textContent = saree.name;
    select.appendChild(option);
  }
  const first = defaultSaree();
  if (first) {
    select.value = first.id;
    wear(first);
  }
  el("model-count").textContent = `${SAREES.length} saree${SAREES.length === 1 ? "" : "s"}`;
}

function wear(entry) {
  stage.wear(entry);
  el("model-tags").textContent = Object.entries(entry.tags ?? {})
    .map(([k, v]) => `${k}: ${v}`)
    .join("   ");
}

function bindControls() {
  el("model").addEventListener("change", (e) => {
    const entry = byId(e.target.value);
    if (entry) wear(entry);
  });

  const slider = (id, apply) => {
    el(id).addEventListener("input", (e) => {
      const value = Number(e.target.value);
      el(`${id}-value`).textContent = value.toFixed(2);
      apply(value);
    });
  };
  slider("scale", (v) => (stage.settings.scale = v));
  slider("offsetY", (v) => (stage.settings.offsetY = v));
  slider("opacity", (v) => stage.setOpacity(v));

  el("mirror").addEventListener("change", (e) => {
    stage.setMirror(e.target.checked);
    video.classList.toggle("mirrored", e.target.checked);
  });

  el("reset").addEventListener("click", () => {
    for (const [id, value] of [["scale", 1], ["offsetY", 0], ["opacity", 1]]) {
      el(id).value = String(value);
      el(`${id}-value`).textContent = value.toFixed(2);
    }
    stage.settings.scale = 1;
    stage.settings.offsetY = 0;
    stage.setOpacity(1);
  });

  el("snapshot").addEventListener("click", () => {
    const shot = document.createElement("canvas");
    shot.width = canvas.clientWidth;
    shot.height = canvas.clientHeight;
    const ctx = shot.getContext("2d");
    if (stage.mirror) {
      ctx.translate(shot.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, shot.width, shot.height);
    if (stage.mirror) ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(canvas, 0, 0, shot.width, shot.height);
    const link = document.createElement("a");
    link.href = shot.toDataURL("image/png");
    link.download = `saree-${Date.now()}.png`;
    link.click();
  });

  addEventListener("resize", layout);
  // A phone turned on its side hands over a frame of the other shape.
  video.addEventListener("resize", layout);
}

function tick() {
  if (!running) return;
  requestAnimationFrame(tick);

  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    let timestamp = performance.now();
    // MediaPipe wants strictly increasing timestamps.
    if (timestamp <= lastTimestamp) timestamp = lastTimestamp + 1;
    lastTimestamp = timestamp;

    try {
      const body = tracker.detect(video, timestamp);
      if (body) {
        stage.update(body.marks, body.hipsSeen);
        setStatus("");
      } else {
        stage.hide();
        setStatus("Stand where the camera can see your shoulders and chest.");
      }
    } catch (error) {
      console.error("detection failed", error);
    }
  }

  stage.render();

  frames++;
  const now = performance.now();
  if (now - fpsClock >= 1000) {
    el("fps").textContent = String(frames);
    frames = 0;
    fpsClock = now;
  }
}

async function boot() {
  bindControls();
  fillModels();

  try {
    setStatus("Requesting camera…");
    await startCamera(video);
    layout();

    await tracker.ensure(setStatus);
    setStatus("Stand where the camera can see your shoulders and chest.");

    running = true;
    tick();
  } catch (error) {
    console.error(error);
    setStatus(error.message, "error");
  }
}

boot();
