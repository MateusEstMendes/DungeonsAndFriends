import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";
import { resolveCloudflaredBinary } from "./cloudflared.js";

const binary = resolveCloudflaredBinary();
const version = spawnSync(binary, ["--version"], { encoding: "utf8", windowsHide: true, timeout: 10_000 });
if (version.error || version.status !== 0) {
  console.error(`Não foi possível executar o Cloudflared (${binary}). Coloque o executável em .tools/cloudflared.exe no Windows ou .tools/cloudflared no Linux/macOS, ou configure CLOUDFLARED_PATH.`);
  console.error(version.error?.message ?? version.stderr);
  process.exit(1);
}
const children: ChildProcess[] = [];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => stop());
function launch(command: string, args: string[], stdio: "inherit" | "pipe") {
  const child = spawn(command, args, { stdio, windowsHide: true, env: { ...process.env, PORT: "2567" } });
  children.push(child);
  child.on("error", error => { console.error(error.message); stop(1); });
  child.on("exit", code => { if (!stopping) stop(code ?? 1); });
  return child;
}
// Recusa uma porta ocupada para não expor outro serviço por engano.
const { createServer } = await import("node:net");
await new Promise<void>((resolve, reject) => {
  const probe = createServer();
  probe.once("error", () => reject(new Error("A porta 2567 já está em uso. Encerre o servidor anterior com Ctrl+C antes de iniciar outro host.")));
  probe.listen(2567, "0.0.0.0", () => probe.close(() => resolve()));
});
launch(process.execPath, [fileURLToPath(new URL("../dist/index.js", import.meta.url))], "inherit");
let ready = false;
let hostRoomCode = "";
for (let attempt = 0; attempt < 100 && !stopping; attempt++) {
  try {
    const response = await fetch("http://localhost:2567/health", { signal: AbortSignal.timeout(1000) });
    if (response.ok) {
      const info = await fetch("http://localhost:2567/api/host-info").then(result => result.json()) as { roomCode: string };
      hostRoomCode = info.roomCode;
      ready = true; break;
    }
  } catch { /* aguarda o bootstrap */ }
  await new Promise(resolve => setTimeout(resolve, 200));
}
if (!ready || stopping) {
  console.error("Servidor não iniciou; túnel cancelado.");
  stop(1);
} else {
  const tunnel = launch(binary, ["tunnel", "--url", "http://localhost:2567"], "pipe");
  let output = "";
  let printed = false;
  const read = (chunk: Buffer) => {
    process.stderr.write(chunk);
    output = (output + chunk.toString()).slice(-8192);
    const url = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
    if (url && !printed) {
      printed = true;
      const link = new URL(url[0]);
      const room = hostRoomCode;
      if (room && /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(room)) link.searchParams.set("room", room);
      console.log(`\nAcesso público: ${link.href}\n`);
      qrcode.generate(link.href, { small: true });
    }
  };
  tunnel.stdout?.on("data", read);
  tunnel.stderr?.on("data", read);
}
