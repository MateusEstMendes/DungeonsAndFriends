import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function resolveCloudflaredBinary({
  configuredPath = process.env.CLOUDFLARED_PATH,
  platform = process.platform,
  toolsDirectory = fileURLToPath(new URL("../../../.tools/", import.meta.url)),
}: { configuredPath?: string; platform?: NodeJS.Platform; toolsDirectory?: string } = {}) {
  if (configuredPath?.trim()) return configuredPath;
  const candidates = platform === "win32" ? ["cloudflared.exe", "cloudflared"] : ["cloudflared"];
  for (const filename of candidates) {
    const path = join(toolsDirectory, filename);
    if (existsSync(path)) return path;
  }
  return "cloudflared";
}
