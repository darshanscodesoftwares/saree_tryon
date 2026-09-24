// The camera feed. Asks for the back-facing width a body needs: a saree is a
// whole person, so the frame has to hold one, not a face.
export async function startCamera(video) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("This browser will not give the page a camera.");
  }

  // Only a width is asked for. Asking for a shape as well - 4:3 from a 16:9
  // sensor - makes the camera crop its sides to fit, and the picture narrows
  // to less of the room.
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1920 } },
    audio: false,
  });

  video.srcObject = stream;
  await video.play();
  // Metadata can still be pending when play() resolves, and everything that
  // maps the frame to the screen needs the real size.
  if (!video.videoWidth) {
    await new Promise((done) => video.addEventListener("loadedmetadata", done, { once: true }));
  }

  // A phone's camera often starts zoomed in, which crops the body out of the
  // frame. Back it off to its widest where the browser allows it.
  const track = stream.getVideoTracks()[0];
  const zoom = track.getCapabilities?.().zoom;
  if (zoom) {
    try {
      await track.applyConstraints({ advanced: [{ zoom: zoom.min }] });
    } catch {
      // Not every camera that reports zoom will accept being set.
    }
  }

  return { stream, zoomed: Boolean(zoom) };
}
