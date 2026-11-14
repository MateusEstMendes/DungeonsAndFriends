import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('master consults absent sheets, kicks a character and approves return with the same sheet', async ({ browser }) => {
  test.setTimeout(180_000);
  const fixture = JSON.parse(readFileSync('.local/e2e-player.json', 'utf8'));
  const gmContext = await browser.newContext(), context = await browser.newContext();
  const gm = await gmContext.newPage(), player = await context.newPage();
  const errors: string[] = [];
  gm.on('pageerror', error => errors.push(error.message));
  player.on('pageerror', error => errors.push(error.message));
  await context.addInitScript(data => {
    localStorage.setItem('df_session_token', data.token);
    localStorage.setItem('df_room_code', data.roomCode);
    localStorage.setItem('df_player_name', data.name);
  }, fixture);
  try {
    await gm.goto('/'); await gm.getByText('Acesso do Mestre', { exact: true }).click();
    await gm.getByLabel('Senha do Mestre').fill('board-e2e-password');
    await gm.getByRole('button', { name: 'Entrar como Mestre' }).click();
    await expect(gm.getByRole('heading', { name: 'Átrio das Tochas' })).toBeVisible();
    await gm.getByRole('button', { name: /Personagens/ }).click();
    const roster = gm.getByRole('region', { name: 'Personagens da sala' });
    await expect(roster).toContainText('Ael de Teste');
    await expect(roster).toContainText('Ausente');
    await roster.getByText('Consultar ficha', { exact: true }).click();
    await expect(roster).toContainText('HP 110/110');
    await player.goto('/'); await player.getByRole('button', { name: 'Continuar sessão' }).click();
    await expect(player.getByRole('region', { name: 'Seu personagem' })).toContainText('Ael de Teste');
    await expect(roster).toContainText('Na sala');
    await roster.getByRole('button', { name: 'Expulsar Ael de Teste', exact: true }).click();
    await roster.getByRole('button', { name: 'Confirmar expulsão', exact: true }).click();
    await expect(player.getByRole('heading', { name: 'Dungeons & Friends' })).toBeVisible();
    await expect(player.getByRole('alert')).toContainText('Sua ficha foi preservada');
    await expect(roster).toContainText('Nova aprovação necessária');
    await player.getByRole('button', { name: 'Continuar sessão' }).click();
    await expect(player.getByRole('status').filter({ hasText: 'aguardando aprovação' })).toBeVisible();
    await gm.getByRole('button', { name: /Pedidos/ }).click();
    await gm.getByRole('button', { name: 'Aprovar', exact: true }).click();
    await gm.getByRole('button', { name: /Personagens/ }).click();
    await expect(player.getByRole('region', { name: 'Seu personagem' })).toContainText('Ael de Teste');
    await expect(player.getByRole('region', { name: 'Seu personagem' })).toContainText('HP 110/110');
    await player.getByRole('button', { name: 'Sair', exact: true }).click();
    await expect(roster).toContainText('Ausente');
    await gm.screenshot({ path: '.local/presence-master.png', animations: 'disabled' });
    expect(errors).toEqual([]);
    await gm.getByRole('button', { name: 'Sair', exact: true }).click();
  } finally { await context.close(); await gmContext.close(); }
});
