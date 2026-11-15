import type { CombatAction, AttackType } from './actions.js';
import type { CombatantStats } from './damage.js';
import type { Equipment } from '../rules/items.js';
import type { Spell } from '../rules/spells.js';
export type CombatBuffKind = 'POISON' | 'SLOW' | 'THE_JUICE' | 'MAGIC_BOOK';
export interface CombatBuff { kind: CombatBuffKind; amount: number; remainingTurns: number; appliedRound?: number; skipFirstEnd?: boolean }
export interface CombatActionOption { label: string; action: CombatAction; mpCost?: number; quantity?: number }
export interface CombatParticipant extends CombatantStats {
  id: string; kind: 'PLAYER' | 'MONSTER'; name: string; catalogName?: string;
  str: number; int: number; dex: number; wis: number; speed: number; baseSpeed: number; initiativeSpeed?: number;
  mp: number; maxMp: number; archetypeId: string; attackType: AttackType; baseDamage: number;
  characterId?: string; equipment: Equipment; spells: Spell[];
  consumables: { itemId: string; name: string; quantity: number }[];
  cooldowns: Record<string, number>; buffs: CombatBuff[]; actions: CombatActionOption[];
  isAutoMode: boolean; allowAutoFlee: boolean; berserkUntilRound?: number; absent?: boolean;
}
