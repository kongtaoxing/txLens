import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import manifest from "./extension/manifest.json";

const extensionIds = process.env.TXLENS_EXTENSION_IDS || "";
const stableExtensionId = createHash("sha256").update(Buffer.from(manifest.key, "base64"))
  .digest("hex").slice(0, 32).replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
const nextConfig: NextConfig = {
  // New builds retain one ID across unpacking paths. Keep explicitly configured
  // older installation IDs working without allowing arbitrary website origins.
  allowedDevOrigins: [stableExtensionId, ...extensionIds.split(",").map((id) => id.trim()).filter((id) => /^[a-p]{32}$/.test(id))],
};
export default nextConfig;
