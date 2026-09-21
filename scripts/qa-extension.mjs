// Local-only QA host. It serves the production bundles with explicit Chrome/wallet
// doubles, never user wallet state. This harness is not included in the product ZIP.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://127.0.0.1:5174").pathname;
  try {
    if (path === "/") { res.setHeader("Content-Type", "text/html"); res.end(await readFile("tests/inspector/browser/harness.html")); return; }
    if (path === "/withdrawal.json") {
      res.setHeader("Content-Type", "application/json");
      res.end(await readFile("tests/inspector/fixtures/arbitrum-remove-liquidity.json")); return;
    }
    if (path === "/api/explain" && req.method === "POST") {
      const chunks = []; for await (const chunk of req) chunks.push(chunk);
      // Exercise the real local API with the observed extension origin. This
      // explicit HTTP proxy does not claim to emulate browser extension CORS.
      const response = await fetch("http://localhost:5173/api/explain", {
        method: "POST", headers: {"Content-Type":"application/json", "Origin":"chrome-extension://gnachfkfadmgpofiicagmgnbamcbhmem"},
        body: Buffer.concat(chunks),
      });
      res.writeHead(response.status, {"Content-Type":"application/json"});
      res.end(await response.text()); return;
    }
    if (path === "/background.html") { res.setHeader("Content-Type", "text/html"); res.end('<script>window.chrome=parent.qa.chromeFor("background",location.href)</script><script src="/background.js"></script>'); return; }
    if (path === "/index.html") {
      let html = await readFile("build/txlens-extension/index.html", "utf8");
      html = html.replace("<head>", '<head><script>window.chrome=parent.qa.chromeFor("ui",location.href);if(new URLSearchParams(parent.location.search).has("service"))window.fetch=parent.qa.explain;</script>');
      res.setHeader("Content-Type", "text/html"); res.end(html); return;
    }
    if (!/^\/(inpage|bridge|background|ui)\.(js|css)$/.test(path)) { res.writeHead(404); res.end(); return; }
    res.setHeader("Content-Type", path.endsWith("css") ? "text/css" : "text/javascript");
    res.end(await readFile("build/txlens-extension" + path));
  } catch { res.writeHead(500); res.end("QA asset unavailable"); }
});
server.listen(5174, "127.0.0.1", () => console.log("TxLens test-wallet QA: http://127.0.0.1:5174"));
