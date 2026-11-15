import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, sep } from 'node:path';
test.use({ actionTimeout: 60_000 });
test('grimório real, área JRPG e controle global/misto por turnos', async ({ browser }) => {
  test.setTimeout(240_000);
  const fixture = JSON.parse(readFileSync('.local/e2e-player.json', 'utf8')), filename = resolve(fixture.databasePath);
  expect(filename.startsWith(resolve('.local') + sep)).toBe(true);
  const SQLite = createRequire(resolve('apps/server/package.json'))('better-sqlite3'), db = new SQLite(filename);
  const original = db.prepare('SELECT hp,max_hp,mp,max_mp,final_str,final_int,speed,defense,dodge_chance FROM characters WHERE id=?').get(fixture.characterId);
  const enemies = db.prepare('SELECT id,hp,passive_dodge FROM monsters_catalog').all();
  const learned = db.prepare("SELECT id FROM character_grimoire WHERE character_id=? AND spell_id='IGNEOUS_BLAST'").get(fixture.characterId);
  db.prepare('UPDATE characters SET hp=100,max_hp=100,mp=100,max_mp=100,final_str=10,final_int=20,speed=20,defense=5,dodge_chance=0 WHERE id=?').run(fixture.characterId);
  db.prepare('UPDATE monsters_catalog SET hp=200,passive_dodge=0').run();
  if (!learned) db.prepare("INSERT INTO character_grimoire(id,character_id,spell_id) VALUES ('e2e-area',?,'IGNEOUS_BLAST')").run(fixture.characterId);
  const gmContext = await browser.newContext(), context = await browser.newContext({ viewport: { width: 1280, height: 844 }, reducedMotion: 'reduce' });
  const gm = await gmContext.newPage(), player = await context.newPage(), errors: string[] = [];
  gm.on('pageerror', e => errors.push(e.message)); player.on('pageerror', e => errors.push(e.message));
  try {
    await gm.goto('/'); await gm.getByText('Acesso do Mestre', { exact: true }).click(); await gm.getByLabel('Senha do Mestre').fill('board-e2e-password'); await gm.getByRole('button', { name: 'Entrar como Mestre' }).click();
    await gm.getByRole('combobox', { name: 'Ritmo da aventura' }).selectOption('FREE_EXPLORATION');
    await context.addInitScript(data => { if (location.protocol !== 'http:') return; localStorage.setItem('df_session_token', data.token); localStorage.setItem('df_room_code', data.roomCode); localStorage.setItem('df_player_name', data.name); }, fixture);
    await player.goto('/'); await player.getByRole('button', { name: 'Continuar sessão' }).click();
    await expect(player.getByRole('region', { name: 'Mesa de aventura', exact: true })).toBeVisible();
    await player.setViewportSize({ width: 390, height: 844 });
    await gm.getByRole('button', { name: 'Iniciar Combate', exact: true }).click();
    await expect(player.locator('.board-canvas canvas')).toHaveAttribute('aria-label', /Arena de combate/, { timeout: 60_000 });
    await gm.getByLabel('IA Global', { exact: true }).click(); await expect(gm.getByLabel('IA Global', { exact: true })).toBeChecked();
    await player.getByRole('button', { name: 'Atacar', exact: true }).click();
    await expect(player.getByRole('button', { name: 'Fogo', exact: true })).toHaveCount(0);
    await player.getByRole('button', { name: /Explosão Ígnea/ }).click();
    await expect(player.locator('.active-portrait')).toContainText('90 MP');
    await expect(player.locator('.combat-dice-status strong')).toContainText('Goblin:');
    await expect(player.locator('.combat-dice-status strong')).toContainText('Esqueleto Guerreiro:');
    await player.getByRole('button', { name: 'Atacar', exact: true }).click(); await player.getByRole('button', { name: /Dardo Arcano/ }).click();
    await player.getByRole('button', { name: '📜 Log', exact: true }).click();
    await expect(player.getByRole('dialog', { name: 'Log da aventura' })).toContainText('Monstro Goblin ataca Ael de Teste');
    await expect(player.getByRole('dialog', { name: 'Log da aventura' })).toContainText('Monstro Esqueleto Guerreiro ataca Ael de Teste');
    await player.getByRole('button', { name: 'Fechar janela', exact: true }).click();
    await expect(player.locator('.combat-heading h1')).toHaveText('Rodada 2');
    await expect(gm.locator('.combat-heading')).toContainText('Observando turno de Ael de Teste');
    await gm.getByText('Controlar monstro', { exact: true }).click(); await gm.getByLabel('IA de Goblin', { exact: true }).click(); await expect(gm.getByLabel('IA de Goblin', { exact: true })).not.toBeChecked();
    for (let i = 0; i < 2; i++) { await player.getByRole('button', { name: 'Atacar', exact: true }).click(); await player.getByRole('button', { name: /Dardo Arcano/ }).click(); }
    await gm.getByRole('button', { name: /^Goblin · Manual/ }).click();
    await expect(gm.locator('.combat-heading')).toContainText('Controlando: Goblin');
    await gm.getByRole('button', { name: 'Defender', exact: true }).click(); await gm.getByRole('button', { name: 'Esquiva Ativa', exact: true }).click();
    await expect(player.locator('.combat-heading h1')).toHaveText('Rodada 3');
    await player.screenshot({ timeout: 60_000, path: '.local/phase5-magic-ai.png' }); expect(errors).toEqual([]);
    await gm.getByLabel('IA Global', { exact: true }).click(); await expect(gm.getByLabel('IA Global', { exact: true })).not.toBeChecked(); await gm.getByRole('button', { name: 'Encerrar combate', exact: true }).click();
    await player.getByRole('button', { name: 'Sair', exact: true }).click(); await gm.getByRole('button', { name: 'Sair', exact: true }).click();
  } finally {
    try { if (!gm.isClosed() && await gm.getByRole('button', { name: 'Encerrar combate', exact: true }).isVisible() && await gm.getByRole('button', { name: 'Encerrar combate', exact: true }).isEnabled()) await gm.getByRole('button', { name: 'Encerrar combate', exact: true }).click(); } catch { /* Preserve the original test failure while closing an interrupted browser. */ }
    await context.close().catch(() => {}); await gmContext.close().catch(() => {});
    db.prepare('UPDATE characters SET hp=@hp,max_hp=@max_hp,mp=@mp,max_mp=@max_mp,final_str=@final_str,final_int=@final_int,speed=@speed,defense=@defense,dodge_chance=@dodge_chance WHERE id=@id').run({ ...original, id: fixture.characterId });
    for (const enemy of enemies) db.prepare('UPDATE monsters_catalog SET hp=?,passive_dodge=? WHERE id=?').run(enemy.hp, enemy.passive_dodge, enemy.id);
    if (!learned) db.prepare("DELETE FROM character_grimoire WHERE id='e2e-area'").run(); db.close();
  }
});
