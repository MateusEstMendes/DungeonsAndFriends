import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';

test('master places new enemies and the arena loads their supplied artwork', async ({ browser }) => {
  test.setTimeout(180_000);
  const gmContext = await browser.newContext({ reducedMotion: 'reduce' });
  const playerContext = await browser.newContext({ reducedMotion: 'reduce' });
  const gm = await gmContext.newPage(), player = await playerContext.newPage();
  const errors: string[] = [], missing: string[] = [];
  for (const page of [gm, player]) {
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().includes('/enemies/') && !response.ok()) missing.push(response.url()); });
  }
  try {
    await gm.goto('/'); await gm.getByText('Acesso do Mestre', { exact: true }).click();
    await gm.getByLabel('Senha do Mestre').fill('board-e2e-password');
    await gm.getByRole('button', { name: 'Entrar como Mestre' }).click();
    await expect(gm.getByRole('heading', { name: 'Átrio das Tochas' })).toBeVisible();
    await gm.getByRole('button', { name: 'Entidades', exact: true }).click();
    const select = gm.getByRole('combobox', { name: 'Monstro do catálogo' });
    await expect(select.locator('option')).toHaveCount(10);
    for (const name of await select.locator('option').allTextContents()) {
      await select.selectOption({ label: name });
      await expect(gm.getByRole('img', { name: `Prévia de ${name}`, exact: true })).toHaveJSProperty('naturalWidth', 1254);
    }
    const canvas = gm.locator('.board-canvas canvas'), box = (await canvas.boundingBox())!;
    const scale = Math.min(1, box.width / 850, box.height / 730);
    for (const [name, q] of [['Slime', -2], ['Golem de Pedra', 0], ['Dragão Jovem', 2]] as const) {
      await select.selectOption({ label: name });
      await canvas.click({ position: { x: box.width / 2 + q * Math.sqrt(3) * 40 * scale, y: box.height / 2 } });
    }
    const fixture = JSON.parse(readFileSync('.local/e2e-player.json', 'utf8'));
    await playerContext.addInitScript(data => {
      localStorage.setItem('df_session_token', data.token); localStorage.setItem('df_room_code', data.roomCode); localStorage.setItem('df_player_name', data.name);
    }, fixture);
    await player.goto('/'); await player.getByRole('button', { name: 'Continuar sessão' }).click();
    await expect(player.getByRole('region', { name: 'Seu personagem' })).toBeVisible();
    await gm.getByRole('button', { name: 'Iniciar Combate', exact: true }).click();
    await expect(gm.getByRole('region', { name: 'Arena de combate', exact: true })).toBeVisible();
    for (const name of ['Slime', 'Golem de Pedra', 'Dragão Jovem']) {
      await expect(player.getByRole('button', { name: new RegExp(`^${name} `) })).toBeVisible();
    }
    await gm.screenshot({ timeout: 60_000, path: '.local/enemies-arena.png', animations: 'disabled' });
    expect(errors).toEqual([]); expect(missing).toEqual([]);
    await gm.getByRole('button', { name: 'Encerrar combate', exact: true }).click();
    await gm.bringToFront();
    await expect(gm.getByRole('region', { name: 'Mesa de aventura', exact: true })).toBeVisible({ timeout: 60_000 });
    await player.getByRole('button', { name: 'Sair', exact: true }).click();
    await gm.getByRole('button', { name: 'Sair', exact: true }).click();
  } finally { await playerContext.close(); await gmContext.close(); }
});
