import { z } from 'zod';
import { ITEM_IDS } from '../rules/items.js';
import { SPELL_IDS } from '../rules/spells.js';
import { PHYSICAL_ATTACKS, MAGICAL_ATTACKS } from '../combat/actions.js';

const id = z.string().trim().min(1).max(100);
const count = z.number().int().min(1).max(1_000_000);
const gold = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const ItemIdSchema = z.enum(ITEM_IDS);
export const SpellIdSchema = z.enum(SPELL_IDS);
export const EquipmentSlotSchema = z.enum(['MAIN_HAND', 'OFF_HAND', 'ARMOR']);
export const EquipItemSchema = z.strictObject({ inventoryId: id, slot: EquipmentSlotSchema });
export const UnequipItemSchema = z.strictObject({ slot: EquipmentSlotSchema });
export const UseScrollSchema = z.strictObject({ inventoryId: id });
export const OpenChestSchema = z.strictObject({ chestId: id });
export const LootChestItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({ chestId: id, kind: z.literal('ITEM'), itemId: ItemIdSchema, quantity: count }),
  z.strictObject({ chestId: id, kind: z.literal('GOLD') }),
]);
export const OpenShopSchema = z.strictObject({ shopId: id });
export const BuyItemSchema = z.strictObject({ shopId: id, itemId: ItemIdSchema, quantity: count });
export const SellItemSchema = z.strictObject({ shopId: id, inventoryId: id, quantity: count });
const stock = z.array(z.strictObject({ itemId: ItemIdSchema, stock: z.number().int().min(0).max(1_000_000).nullable() })).max(100)
  .refine(rows => new Set(rows.map(row => row.itemId)).size === rows.length, 'Não repita itens no estoque.');
const loot = z.array(z.strictObject({ itemId: ItemIdSchema, quantity: count })).max(100)
  .refine(rows => new Set(rows.map(row => row.itemId)).size === rows.length, 'Não repita itens no baú.');
export const MasterEditShopSchema = z.strictObject({ shopId: id, npcName: z.string().trim().min(1).max(60), dialogue: z.string().trim().max(1000), inventory: stock });
export const MasterEditChestSchema = z.strictObject({ chestId: id, gold, items: loot });
export const MasterGrantItemSchema = z.discriminatedUnion('kind', [
  z.strictObject({ targetPlayerId: id, kind: z.literal('ITEM'), itemId: ItemIdSchema, quantity: count }),
  z.strictObject({ targetPlayerId: id, kind: z.literal('GOLD'), gold }),
]);
export const MasterSetMonsterAiSchema = z.strictObject({ monsterId: id, isAutoMode: z.boolean(), allowAutoFlee: z.boolean() });
export const MasterSetGlobalAiSchema = z.strictObject({ enabled: z.boolean() });
export const CHAT_TTL_MS = 7000;
export const ChatMessageSchema = z.strictObject({ text: z.string().trim().min(1).max(200).regex(/^[^\u0000-\u001f\u007f]+$/, 'Mensagem contém caracteres de controle.') });
export const RollDiceSchema = z.strictObject({ faces: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(10), z.literal(12), z.literal(20), z.literal(100)]) });
export const CombatActionSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('ATTACK'), subType: z.enum([...PHYSICAL_ATTACKS, ...MAGICAL_ATTACKS]), targetId: id, hand: z.enum(['MAIN', 'OFF']).optional() }),
  z.strictObject({ type: z.literal('SPELL'), spellId: SpellIdSchema, targetId: id }),
  z.strictObject({ type: z.literal('DEFEND'), subType: z.enum(['ACTIVE_DODGE', 'SHIELD_BLOCK', 'HEAL', 'PROTECT']), targetId: id.optional() }),
  z.strictObject({ type: z.literal('ITEM'), itemId: ItemIdSchema, targetId: id }),
  z.strictObject({ type: z.literal('FLEE') }),
]);
/** Command registry for the handlers introduced in the next increments. */
export const ECONOMY_COMMAND_SCHEMAS = {
  EQUIP_ITEM: EquipItemSchema, UNEQUIP_ITEM: UnequipItemSchema, USE_SCROLL: UseScrollSchema,
  OPEN_CHEST: OpenChestSchema, LOOT_CHEST_ITEM: LootChestItemSchema, OPEN_SHOP: OpenShopSchema,
  BUY_ITEM: BuyItemSchema, SELL_ITEM: SellItemSchema, MASTER_EDIT_SHOP: MasterEditShopSchema,
  MASTER_EDIT_CHEST: MasterEditChestSchema, MASTER_GRANT_ITEM: MasterGrantItemSchema,
  MASTER_SET_MONSTER_AI: MasterSetMonsterAiSchema, MASTER_SET_GLOBAL_AI: MasterSetGlobalAiSchema,
  CHAT_MESSAGE: ChatMessageSchema, ROLL_DICE: RollDiceSchema,
} as const;
export type EconomyCommand = keyof typeof ECONOMY_COMMAND_SCHEMAS;
export type EconomyPayload<C extends EconomyCommand> = z.infer<typeof ECONOMY_COMMAND_SCHEMAS[C]>;
