import type { Item, InventorySlot } from '../rules/items.js';
import type { Spell } from '../rules/spells.js';
import type { CombatEvent } from '../combat/events.js';

export interface InventoryEntry { inventoryId: string; itemId: string; slot: InventorySlot; quantity: number; item: Item }
export interface InventorySnapshot {
  playerId: string; characterId: string; name: string; raceId: string; archetypeId: string; gold: number;
  stats: { finalStr: number; finalDex: number; finalCon: number; finalInt: number; finalWis: number; finalCha: number;
    hp: number; maxHp: number; mp: number; maxMp: number; defense: number; dodgeChance: number; speed: number; flatDr: number };
  equipment: { mainHand: InventoryEntry | null; offHand: InventoryEntry | null; armor: InventoryEntry | null };
  items: InventoryEntry[]; spells: Spell[];
}
export interface ShopSnapshot { shopId: string; npcName: string; dialogue: string; canEdit: boolean; inventory: { item: Item; stock: number | null }[] }
export interface ChestSnapshot { chestId: string; gold: number; canEdit: boolean; items: { item: Item; quantity: number }[] }
export interface EphemeralChatMessage { id: string; actorId: string; actorName: string; actorKind: 'PLAYER' | 'MASTER'; chamberId: string; text: string; createdAt: number; expiresAt: number }
export interface DiceResult { id: string; actorId: string; actorName: string; chamberId: string; faces: number; value: number; createdAt: number }
export type SessionLogEntry = { id: string; chamberId: string; createdAt: number } & (
  | { type: 'DICE'; result: DiceResult }
  | { type: 'COMBAT'; event: CombatEvent }
);

export const SESSION_LOG_LIMIT = 200;
