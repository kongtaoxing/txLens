import { build } from "esbuild";
import { mkdir, copyFile, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
const out = "build/txlens-extension";
await mkdir(out, { recursive: true });
await build({
  entryPoints: [
    "extension/background.ts",
    "extension/inpage.ts",
    "extension/bridge.ts",
    "extension/ui.tsx",
  ],
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
  tsconfig: "tsconfig.json",
});
for (const name of [
  "manifest.json",
  "index.html",
  "icon-16.png",
  "icon-32.png",
  "icon-48.png",
  "icon-128.png",
])
  await copyFile(`extension/${name}`, `${out}/${name}`);
await writeFile(
  `${out}/INSTALL.txt`,
  await readFile("extension/INSTALL.txt", "utf8"),
);
await mkdir("public/downloads", { recursive: true });
execFileSync(
  "/usr/bin/zip",
  [
    "-q",
    "-r",
    "-FS",
    "../public/downloads/txlens-extension.zip",
    "txlens-extension",
  ],
  { cwd: "build" },
);
console.log(`Extension built: ${out}`);
