import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveCloudflaredBinary } from "../src/cloudflared.js";

const folders: string[] = [];
function setup() {
  const toolsDirectory = mkdtempSync(join(tmpdir(), "df-cloudflared-"));
  folders.push(toolsDirectory);
  return { configuredPath: "", toolsDirectory };
}
afterEach(() => { for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true }); });
describe("executável Cloudflared", () => {
  it("encontra o .exe local no Windows, inclusive em caminho com espaços", () => {
    const options = setup(), binary = join(options.toolsDirectory, "cloudflared.exe");
    writeFileSync(binary, "fixture");
    expect(resolveCloudflaredBinary({ ...options, platform: "win32" })).toBe(binary);
  });
  it("prioriza o caminho configurado e preserva o executável sem extensão", () => {
    const options = setup(), binary = join(options.toolsDirectory, "cloudflared");
    writeFileSync(binary, "fixture");
    expect(resolveCloudflaredBinary({ ...options, configuredPath: "C:/custom path/cloudflared.exe", platform: "win32" })).toBe("C:/custom path/cloudflared.exe");
    expect(resolveCloudflaredBinary({ ...options, platform: "win32" })).toBe(binary);
    expect(resolveCloudflaredBinary({ ...options, platform: "linux" })).toBe(binary);
  });
  it("recorre ao PATH se não houver executável local", () => {
    expect(resolveCloudflaredBinary({ ...setup(), platform: "win32" })).toBe("cloudflared");
  });
});
