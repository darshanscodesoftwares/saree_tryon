// Static server for the viewer. Plain HTTP on 5190, and HTTPS on 5453 when a
// certificate is present - a phone will not give a page its camera over plain
// http from another machine, only over localhost or https.
import { createServer } from "node:http";
import { createServer as createSecureServer } from "node:https";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { networkInterfaces } from "node:os";

const ROOT = new URL("public/", import.meta.url).pathname;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".glb": "model/gltf-binary",
};

async function serve(req, res) {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
  const file = join(ROOT, normalize(path === "/" ? "/index.html" : path));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("no");
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}

// Overridable so a second copy can run while the first still holds the port.
const PORT = Number(process.env.PORT) || 5190;
const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 5453;

createServer(serve).listen(PORT, () => console.log(`http://localhost:${PORT}`));

if (existsSync("certs/cert.pem") && existsSync("certs/key.pem")) {
  const options = { cert: readFileSync("certs/cert.pem"), key: readFileSync("certs/key.pem") };
  createSecureServer(options, serve).listen(HTTPS_PORT, () => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((n) => n && n.family === "IPv4" && !n.internal);
    console.log(`https://${lan ? lan.address : "localhost"}:${HTTPS_PORT}  (share this with a phone)`);
  });
}
