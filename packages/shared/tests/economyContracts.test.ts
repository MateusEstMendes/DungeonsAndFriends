import { expect, it } from 'vitest';
import { BuyItemSchema, ChatMessageSchema, CombatActionSchema, EquipItemSchema, LootChestItemSchema, MasterEditChestSchema, MasterEditShopSchema,
  MasterGrantItemSchema, MasterSetGlobalAiSchema, MasterSetMonsterAiSchema, MasterEditSchema, RollDiceSchema, VersionHandshakePayloadSchema,
  PROTOCOL_VERSION, CombatStateSchema, MonsterSchema, type CombatAction } from '../src/index.js';
it('checks catalog identities, integer quantities and denies client-supplied prices or owner identities', () => {
  expect(BuyItemSchema.parse({ shopId: 'shop', itemId: 'DAGGER', quantity: 1 })).toBeDefined();
  for (const extra of [{ price: 0 }, { gold: 1000 }, { characterId: 'other' }])
    expect(BuyItemSchema.safeParse({ shopId: 'shop', itemId: 'DAGGER', quantity: 1, ...extra }).success).toBe(false);
  for (const quantity of [0, -1, 1.5, Infinity, 1000001]) expect(BuyItemSchema.safeParse({ shopId: 'shop', itemId: 'DAGGER', quantity }).success).toBe(false);
  expect(BuyItemSchema.safeParse({ shopId: 'shop', itemId: 'INVENTED', quantity: 1 }).success).toBe(false);
  expect(EquipItemSchema.safeParse({ inventoryId: 'inventory', slot: 'BAG' }).success).toBe(false);
});
it('separates gold and item loot/grants and rejects negative or fractional gold', () => {
  expect(LootChestItemSchema.safeParse({ chestId: 'chest', kind: 'GOLD' }).success).toBe(true);
  expect(LootChestItemSchema.safeParse({ chestId: 'chest', kind: 'ITEM', itemId: 'DAGGER', quantity: 1 }).success).toBe(true);
  expect(LootChestItemSchema.safeParse({ chestId: 'chest', kind: 'GOLD', quantity: 1 }).success).toBe(false);
  for (const gold of [-1, .5, Number.MAX_SAFE_INTEGER + 1]) {
    expect(MasterEditChestSchema.safeParse({ chestId: 'chest', gold, items: [] }).success).toBe(false);
    expect(MasterGrantItemSchema.safeParse({ targetPlayerId: 'player', kind: 'GOLD', gold }).success).toBe(false);
  }
});
it('supports infinite stock explicitly while preventing ambiguous duplicate stock or loot rows', () => {
  const shop = { shopId: 'shop', npcName: 'Ferreiro', dialogue: 'Olá!', inventory: [{ itemId: 'DAGGER', stock: null }] };
  expect(MasterEditShopSchema.safeParse(shop).success).toBe(true);
  expect(MasterEditShopSchema.safeParse({ ...shop, inventory: [...shop.inventory, ...shop.inventory] }).success).toBe(false);
  expect(MasterEditShopSchema.safeParse({ ...shop, inventory: [{ itemId: 'DAGGER', stock: -1 }] }).success).toBe(false);
  expect(MasterEditChestSchema.safeParse({ chestId: 'chest', gold: 0, items: [{ itemId: 'DAGGER', quantity: 1 }, { itemId: 'DAGGER', quantity: 2 }] }).success).toBe(false);
});
it('bounds transient chat and the allowed dice', () => {
  expect(ChatMessageSchema.parse({ text: '  Olá!  ' })).toEqual({ text: 'Olá!' });
  for (const text of ['', '  ', 'a'.repeat(201), 'oi\u0000', 'oi\nali']) expect(ChatMessageSchema.safeParse({ text }).success).toBe(false);
  for (const faces of [4, 6, 8, 10, 12, 20, 100]) expect(RollDiceSchema.safeParse({ faces }).success).toBe(true);
  for (const faces of [1, 3, 7, 20.5, 1000]) expect(RollDiceSchema.safeParse({ faces }).success).toBe(false);
});
it('introduces explicit manual defaults and strict AI and merchant contracts', () => {
  expect(new MonsterSchema()).toMatchObject({ isAutoMode: false, allowAutoFlee: false });
  expect(new CombatStateSchema().globalAiEnabled).toBe(false);
  expect(MasterSetMonsterAiSchema.safeParse({ monsterId: 'goblin', isAutoMode: true, allowAutoFlee: false }).success).toBe(true);
  expect(MasterSetGlobalAiSchema.safeParse({ enabled: 'true' }).success).toBe(false);
  expect(MasterEditSchema.safeParse({ layer: 'OBJECT', kind: 'NPC_MERCHANT', chamberId: 'room', q: 0, r: 0, rotation: 0, hidden: false }).success).toBe(true);
});
it('accepts typed spells and offhand attacks without introducing range fields', () => {
  const actions: CombatAction[] = [{ type: 'SPELL', spellId: 'IGNEOUS_BLAST', targetId: 'enemy' }, { type: 'ATTACK', subType: 'THRUST', targetId: 'enemy', hand: 'OFF' }];
  for (const action of actions) {
    expect(CombatActionSchema.parse(action)).toEqual(action);
    expect(CombatActionSchema.safeParse({ ...action, rangeHex: 4 }).success).toBe(false);
  }
  expect(CombatActionSchema.safeParse({ type: 'SPELL', spellId: 'UNKNOWN', targetId: 'enemy' }).success).toBe(false);
  expect(PROTOCOL_VERSION).toBe('0.5.0');
  expect(VersionHandshakePayloadSchema.safeParse({ clientVersion: '0.4.0' }).success).toBe(false);
});
