import type { DamageDice, Equipment } from './items.js';

export const SPELL_IDS = ['ARCANE_DART', 'IGNEOUS_BLAST', 'HEALING_LIGHT', 'FREEZING_RAY'] as const;
export type SpellId = typeof SPELL_IDS[number];
export interface Spell {
  id: SpellId; name: string; description: string; mpCost: number;
  targetMode: 'SINGLE_ENEMY' | 'ALL_ENEMIES' | 'SINGLE_ALLY';
  damageDice: DamageDice; attribute: 'INT' | 'WIS'; element: 'ARCANE' | 'FIRE' | 'LIGHT' | 'ICE';
  effect?: { type: 'SLOW'; speedPenalty: number; rounds: number };
}
/** JRPG targeting: no hex distance or grid-area calculation in combat. */
export const SPELL_CATALOG = {
  ARCANE_DART: { id: 'ARCANE_DART', name: 'Dardo Arcano', description: 'Causa 1d6 + mod_INT de dano arcano a um inimigo.', mpCost: 4, targetMode: 'SINGLE_ENEMY', damageDice: '1d6', attribute: 'INT', element: 'ARCANE' },
  IGNEOUS_BLAST: { id: 'IGNEOUS_BLAST', name: 'Explosão Ígnea', description: 'Causa 2d6 + mod_INT de dano de fogo a todos os inimigos vivos.', mpCost: 10, targetMode: 'ALL_ENEMIES', damageDice: '2d6', attribute: 'INT', element: 'FIRE' },
  HEALING_LIGHT: { id: 'HEALING_LIGHT', name: 'Luz Curativa', description: 'Cura 2d6 + max(0, mod_SAB) HP de um aliado ou de si próprio.', mpCost: 6, targetMode: 'SINGLE_ALLY', damageDice: '2d6', attribute: 'WIS', element: 'LIGHT' },
  FREEZING_RAY: { id: 'FREEZING_RAY', name: 'Raio Congelante', description: 'Causa 1d8 + mod_INT de dano de gelo e reduz a velocidade em 1 por uma rodada.', mpCost: 8, targetMode: 'SINGLE_ENEMY', damageDice: '1d8', attribute: 'INT', element: 'ICE', effect: { type: 'SLOW', speedPenalty: 1, rounds: 1 } },
} as const satisfies Record<SpellId, Spell>;
/** Ownership, learned spells and valid targets remain authoritative handler checks. */
export function canCastSpell(characterEquipment: Readonly<Equipment>, currentMp: number, spell: Spell): boolean {
  return Number.isSafeInteger(currentMp) && currentMp >= spell.mpCost
    && [characterEquipment.mainHand, characterEquipment.offHand].some(item => item?.category === 'MAGIC_FOCUS');
}
