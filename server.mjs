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

createServer(serve).listen(5190, () => console.log("http://localhost:5190"));

if (existsSync("certs/cert.pem") && existsSync("certs/key.pem")) {
  const options = { cert: readFileSync("certs/cert.pem"), key: readFileSync("certs/key.pem") };
  createSecureServer(options, serve).listen(5453, () => {
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((n) => n && n.family === "IPv4" && !n.internal);
    console.log(`https://${lan ? lan.address : "localhost"}:5453  (share this with a phone)`);
  });
}
