import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const evidence = path.resolve("verification/realism-data-20261022");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
for (const [port, folder] of [
  [4262, "before/graphics"],
  [4263, "midpoint/graphics"],
  [4264, "after/graphics"],
  [4265, "."],
  [4267, "before-extended/graphics"],
  [4268, "after-extended/graphics"],
]) {
  const root = folder.endsWith("/graphics")
    ? path.resolve("dist-benchmark/realism-data-20261022", folder.split("/")[0])
    : path.resolve(evidence, folder);
  http
    .createServer(async (req, res) => {
      try {
        const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
        const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
        if (!file.startsWith(root + path.sep)) {
          res.writeHead(403).end();
          return;
        }
        if (!(await stat(file)).isFile()) throw new Error("missing");
        const data = await readFile(file);
        res
          .writeHead(200, {
            "content-type": types[path.extname(file)] ?? "application/octet-stream",
            "cache-control": "no-cache",
          })
          .end(data);
      } catch {
        res.writeHead(404).end("Not found");
      }
    })
    .listen(port, "127.0.0.1", () => console.log(`Evidence ${folder}: http://127.0.0.1:${port}`));
}
