import { afterEach, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CombatEvent } from '@df/shared';
import { CombatOverlay } from '../src/components/combat/CombatOverlay';
import { initialCombatState, selectMonster, useCombatStore, type CombatParticipant } from '../src/store/useCombatStore';
import { initialGameState, useGameStore } from '../src/store/useGameStore';
import { combatActionText, combatResultText } from '../src/components/combat/presentation';
// SSR normally reads the store's original snapshot; use the arranged client snapshot.
vi.mock('../src/store/useCombatStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/store/useCombatStore')>();
  return { ...actual, useCombatStore: Object.assign(() => actual.useCombatStore.getState(), actual.useCombatStore) };
});
vi.mock('../src/store/useGameStore', async importOriginal => {
  const actual = await importOriginal<typeof import('../src/store/useGameStore')>();
  return { ...actual, useGameStore: Object.assign(() => actual.useGameStore.getState(), actual.useGameStore) };
});
vi.mock('../src/network/colyseusClient', () => ({ boardCommand: vi.fn() }));
const participant: CombatParticipant = { id: 'hero', name: 'Ael', kind: 'PLAYER', hp: 50, maxHp: 50, mp: 20, maxMp: 20,
  defense: 10, dexMod: 0, passiveDodge: 0, flatDR: 0, str: 10, int: 10, dex: 10, speed: 3, archetypeId: 'MAGE', attackType: 'ARCANE', baseDamage: 6, cooldowns: {}, potions: 2 };
const monster: CombatParticipant = { ...participant, id: 'goblin', name: 'Goblin 2', kind: 'MONSTER', attackType: 'THRUST' };
const event: CombatEvent = { id: 'hit', encounterId: 'encounter', actorId: monster.id, actorName: monster.name, actorKind: 'MONSTER',
  targetId: 'hero', targetName: 'Ael', targetKind: 'PLAYER', targets: [], type: 'ATTACK', round: 1, startedAt: Date.now(), duration: 1200,
  rolls: [], outcome: 'CRITICAL', damage: 8, drAbsorbed: 2 };
afterEach(() => { useCombatStore.setState(initialCombatState); useGameStore.setState(initialGameState); vi.restoreAllMocks(); });
function prepare(role: 'MASTER' | 'PLAYER', activeParticipantId: string) {
  useGameStore.setState({ role, playerId: role === 'PLAYER' ? 'hero' : 'master', connectionState: 'CONNECTED' });
  useCombatStore.setState({ ...initialCombatState, participants: [participant, monster],
    combat: { ...initialCombatState.combat, active: true, encounterId: 'encounter', activeParticipantId, turnOrder: ['hero', 'goblin'], remainingActions: 1 } });
}
it('shows observation without hero commands for the master', () => {
  prepare('MASTER', 'hero'); const html = renderToStaticMarkup(createElement(CombatOverlay));
  expect(html).toContain('Observando turno de Ael'); expect(html).not.toContain('aria-label="Ações de combate"');
  expect(html).toContain('Selecione um monstro');
});
it('inspects a different monster without changing the active actor or granting actions', () => {
  prepare('MASTER', 'goblin'); useCombatStore.setState({ targetId: 'hero' }); selectMonster('other');
  expect(useCombatStore.getState().targetId).toBe(''); expect(useCombatStore.getState().combat.activeParticipantId).toBe('goblin');
  expect(renderToStaticMarkup(createElement(CombatOverlay))).not.toContain('aria-label="Ações de combate"');
  selectMonster('goblin'); const html = renderToStaticMarkup(createElement(CombatOverlay));
  expect(html).toContain('Controlando: Goblin 2'); expect(html).toContain('aria-label="Ações de combate"');
});
it('highlights the receiving hero and only applies personal impact to that player', () => {
  prepare('PLAYER', 'goblin'); useCombatStore.setState({ events: [{ ...event, startedAt: Date.now() }] });
  const html = renderToStaticMarkup(createElement(CombatOverlay));
  expect(html).toContain('combat-own-impact'); expect(html).toContain('combat-target-feedback'); expect(html).toContain('Monstro Goblin 2 ataca Ael');
  useGameStore.setState({ playerId: 'observer' });
  expect(renderToStaticMarkup(createElement(CombatOverlay))).not.toContain('combat-own-impact');
});
it('distinguishes defense misses, dodge, healing and absorbed damage in text', () => {
  expect(combatResultText(event)).toBe('Crítico! −8 HP · DR absorveu 2');
  expect(combatResultText({ ...event, outcome: 'MISSED_DEFENSE', damage: 0 })).toBe('Errou: defesa do alvo');
  expect(combatResultText({ ...event, outcome: 'DODGED_ACTIVE', damage: 0 })).toBe('Esquiva ativa!');
  expect(combatResultText({ ...event, outcome: 'HEALED', damage: 0, healAmount: 12 })).toBe('Cura: +12 HP');
  expect(combatActionText({ ...event, actorKind: 'PLAYER', actorName: 'Ael', targetName: 'Goblin 2' })).toBe('Herói Ael ataca Goblin 2');
});
