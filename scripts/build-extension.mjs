import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { zipSync } from "fflate";

const out = "build/txlens-extension";
const serviceUrl = new URL(process.env.TXLENS_SERVICE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:5173"));
if ((serviceUrl.protocol !== "https:" && !(serviceUrl.protocol === "http:" &&
  ["localhost", "127.0.0.1"].includes(serviceUrl.hostname))) ||
  serviceUrl.username || serviceUrl.password || serviceUrl.search || serviceUrl.hash ||
  serviceUrl.pathname !== "/") throw new Error("TXLENS_SERVICE_URL must be an HTTPS origin (or local HTTP).");

await mkdir(out, { recursive: true });
await build({
  entryPoints: ["extension/background.ts", "extension/inpage.ts", "extension/bridge.ts", "extension/ui.tsx"],
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
    TXLENS_SERVICE_URL: JSON.stringify(serviceUrl.origin),
  },
  tsconfig: "tsconfig.json",
});
const assets = ["index.html", "icon-16.png", "icon-32.png", "icon-48.png", "icon-128.png", "INSTALL.txt"];
for (const name of assets) await copyFile(`extension/${name}`, `${out}/${name}`);
const manifest = JSON.parse(await readFile("extension/manifest.json", "utf8"));
manifest.host_permissions = [...new Set([...manifest.host_permissions, `${serviceUrl.origin}/*`])];
await writeFile(`${out}/manifest.json`, JSON.stringify(manifest, null, 2) + "\n");
const entries = {};
// Only known deliverables enter the ZIP, including in a reused build directory.
for (const name of [...assets, "manifest.json", "background.js", "inpage.js", "bridge.js", "ui.js", "ui.css"]) {
  entries[`txlens-extension/${name}`] = new Uint8Array(await readFile(`${out}/${name}`));
}
await mkdir("public/downloads", { recursive: true });
await writeFile("public/downloads/txlens-extension.zip", zipSync(entries, { level: 6 }));
console.log(`Extension built: ${out} (service: ${serviceUrl.origin})`);
