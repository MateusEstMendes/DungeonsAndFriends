import { test, expect, type Page } from "./fixtures";
import { readFileSync } from "node:fs";
async function masterLogin(page: Page) {
  await page.goto("/");
  await page.getByText("Acesso do Mestre", { exact: true }).click();
  await page.getByLabel("Senha do Mestre").fill("board-e2e-password");
  await page.getByRole("button", { name: "Entrar como Mestre" }).click();
  await expect(page.getByRole("heading", { name: "Átrio das Tochas" })).toBeVisible();
  await expect(page.locator(".board-canvas canvas")).toBeVisible({ timeout: 15000 });
}
test("Mestre edita, desfaz/refaz, troca câmara e usa visão macro sem erros gráficos", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await masterLogin(page);
  await page.getByRole("combobox", { name: "Câmara", exact: true }).selectOption("training-2");
  await expect(page.getByRole("heading", { name: "Galeria Submersa" })).toBeVisible();
  await page.getByRole("button", { name: "Visão Macro Panorâmica" }).click();
  await page.getByRole("button", { name: "Focar Câmara" }).click();
  await page.getByRole("combobox", { name: "Câmara", exact: true }).selectOption("training-1");
  await page.getByRole("button", { name: "Terreno", exact: true }).click();
  await page.getByRole("combobox", { name: "Terreno", exact: true }).selectOption("GRASS");
  const canvas = page.locator(".board-canvas canvas"), box = (await canvas.boundingBox())!;
  // Center is q=0,r=0 after the camera tween completes.
  await page.waitForTimeout(700); await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await page.getByRole("button", { name: "↶ Undo" }).click();
  await page.keyboard.press("Control+y");
  await page.getByRole("button", { name: "Debug", exact: true }).click();
  await expect(page.getByRole("button", { name: "Debug", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({ timeout: 60_000, path: ".local/phase3-master.png" });
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dungeons & Friends" })).toBeVisible();
  expect(errors).toEqual([]);
});
test("Jogador recebe visão filtrada, move e mantém a névoa; mobile respeita limites da tela", async ({ browser }) => {
  const fixture = JSON.parse(readFileSync(".local/e2e-player.json", "utf8"));
  const gmContext = await browser.newContext(), gm = await gmContext.newPage(); await masterLogin(gm);
  await gm.getByRole("combobox", { name: "Ritmo da aventura" }).selectOption("FREE_EXPLORATION");
  await expect(gm.getByRole("combobox", { name: "Ritmo da aventura" })).toHaveValue("FREE_EXPLORATION");
  await gm.getByRole("button", { name: "Sair", exact: true }).click();
  await gmContext.close();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  await context.addInitScript(data => {
    localStorage.setItem("df_session_token", data.token); localStorage.setItem("df_room_code", data.roomCode); localStorage.setItem("df_player_name", data.name);
  }, fixture);
  const page = await context.newPage(), frames: Buffer[] = [], errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("websocket", ws => ws.on("framereceived", ({ payload }) => frames.push(Buffer.isBuffer(payload) ? payload : Buffer.from(payload))));
  await page.goto("/"); await page.getByRole("button", { name: "Continuar sessão" }).click();
  await expect(page.getByRole("heading", { name: "Átrio das Tochas" })).toBeVisible();
  await expect(page.locator(".board-canvas canvas")).toBeVisible({ timeout: 15000 });
  const firstFrames = Buffer.concat(frames).toString("utf8");
  expect(firstFrames).not.toContain("training-1:monster"); expect(firstFrames).not.toContain("training-2:chest");
  await page.screenshot({ timeout: 60_000, path: ".local/phase3-player-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  // Test real touch movement at the adjacent eastern hex center.
  const canvas = page.locator(".board-canvas canvas"), box = (await canvas.boundingBox())!;
  await expect(canvas).toHaveAttribute("data-scene-ready", "true");
  const scale = Math.min(1, box.width / 850, box.height / 730);
  await page.touchscreen.tap(box.x + box.width / 2 + Math.sqrt(3) * 40 * scale, box.y + box.height / 2);
  await expect(page.getByText("Hexágono (1, 0)", { exact: true })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ timeout: 60_000, path: ".local/phase3-player-moved.png" });
  // Cross and return through the portal using the accessible coordinate controls.
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.getByText("Mover por coordenadas", { exact: true }).click();
  const form = page.locator(".vitals-hud .coordinate-form");
  await form.getByLabel("q", { exact: true }).fill("5");
  await form.getByRole("button", { name: "Mover", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Galeria Submersa" })).toBeVisible();
  await expect(page.getByText("Hexágono (-4, 0)", { exact: true })).toBeVisible();
  await expect(form.getByRole("button", { name: "Mover", exact: true })).toBeEnabled();
  await form.getByLabel("q", { exact: true }).fill("-5");
  await form.getByRole("button", { name: "Mover", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Átrio das Tochas" })).toBeVisible();
  await expect(page.getByText("Hexágono (4, 0)", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await context.close();
});
test.afterEach(async ({ page }) => {
  const leave = page.getByRole("button", { name: "Sair", exact: true });
  if (await leave.isVisible()) await leave.click();
});
