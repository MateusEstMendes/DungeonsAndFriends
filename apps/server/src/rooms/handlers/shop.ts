import { and, eq } from 'drizzle-orm';
import { BuyItemSchema, SellItemSchema, EquipItemSchema, UnequipItemSchema, UseScrollSchema, OpenChestSchema, LootChestItemSchema, OpenShopSchema,
  MasterEditShopSchema, MasterEditChestSchema, MasterGrantItemSchema, RequestInventorySchema, calculateSellPrice, equipItemValidator,
  hexDistance, getHexEdgeKey, getHexKey, isCharacterPresent, type ChestSnapshot, type ShopSnapshot, type PlayerSchema, type RoomState } from '@df/shared';
import { characters, inventories, players, placedObjects, npcShops, chests, characterGrimoire } from '../../db/schema.js';
import type { Database } from '../../services/boardRepository.js';
import { InventoryRepository } from '../../services/inventoryRepository.js';

export type PrivateSend = (playerId: string, name: string, payload: unknown, includeMaster?: boolean) => void;
export class ShopHandler {
  private repository: InventoryRepository;
  private viewers = new Map<string, Set<string>>();
  constructor(private state: RoomState, private database: Database, private roomId: string, private send: PrivateSend, private refresh: () => void) {
    this.repository = new InventoryRepository(database);
  }
  private get db() { return this.database.db; }
  private idle() { if (this.state.combatState.active) throw new Error('Encerre o combate antes de alterar o inventário ou negociar.'); }
  private identity(actor: PlayerSchema) {
    if (this.state.players.get(actor.id) !== actor || !actor.connected) throw new Error('Ação não autorizada.');
  }
  private master(actor: PlayerSchema) { this.identity(actor); if (actor.role !== 'MASTER' || actor.id !== this.roomId) throw new Error('Ação exclusiva do Mestre.'); }
  private character(actor: PlayerSchema, requirePresent = true) {
    if (actor.role !== 'PLAYER' || actor.status !== 'READY' || !actor.characterId
      || (requirePresent && (!actor.connected || !isCharacterPresent(actor) || actor.hp <= 0))) throw new Error('Personagem indisponível.');
    const owner = this.db.select().from(players).where(and(eq(players.id, actor.id), eq(players.roomId, this.roomId))).get();
    const row = this.db.select().from(characters).where(and(eq(characters.id, actor.characterId), eq(characters.playerId, actor.id), eq(characters.roomId, this.roomId))).get();
    if (!row || owner?.approvalStatus !== 'APPROVED' || owner.characterId !== row.id) throw new Error('Ficha não autorizada.');
    return row;
  }
  private object(actor: PlayerSchema, objectId: string, kind: 'CHEST' | 'NPC_MERCHANT') {
    this.identity(actor);
    const object = this.db.select().from(placedObjects).where(eq(placedObjects.id, objectId)).get();
    const chamber = object && this.state.chambers.get(object.chamberId);
    if (!object || !chamber || object.kind !== kind || object.isArchived || !this.state.objects.has(object.id)) throw new Error('Objeto indisponível.');
    if (actor.role === 'MASTER') { this.master(actor); return object; }
    this.character(actor);
    if (object.hidden || actor.currentChamberId !== object.chamberId || hexDistance(actor, object) > 1
      || !chamber.cells.has(getHexKey(object.q, object.r)) || (hexDistance(actor, object) === 1 && chamber.walls.has(getHexEdgeKey(actor, object)))) {
      throw new Error('Aproxime-se de um objeto visível para interagir.');
    }
    return object;
  }
  private entry(characterId: string, inventoryId: string) {
    const row = this.db.select().from(inventories).where(and(eq(inventories.id, inventoryId), eq(inventories.characterId, characterId))).get();
    if (!row) throw new Error('Item não pertence a esta ficha.');
    return row;
  }
  syncInventory(actor: PlayerSchema) {
    const row = this.character(actor, false), snapshot = this.repository.snapshot(row);
    Object.assign(actor, { defense: row.defense, speed: row.speed, finalDex: row.finalDex, dodgeChance: row.dodgeChance, flatDr: row.flatDr, remainingSteps: row.remainingSteps });
    this.send(actor.id, 'INVENTORY_SYNC', snapshot, true); this.refresh();
  }
  requestInventory(actor: PlayerSchema, input: unknown) {
    this.identity(actor); const data = RequestInventorySchema.parse(input);
    if (data.targetPlayerId && data.targetPlayerId !== actor.id) this.master(actor);
    const target = data.targetPlayerId ? this.state.players.get(data.targetPlayerId) : actor;
    if (!target) throw new Error('Personagem indisponível.');
    if (actor.role === 'MASTER') this.master(actor);
    const row = this.character(target, false);
    this.send(actor.id, 'INVENTORY_SYNC', this.repository.snapshot(row));
  }
  equipItem(actor: PlayerSchema, input: unknown) {
    const data = EquipItemSchema.parse(input); this.identity(actor); this.idle();
    this.database.sqlite.transaction(() => {
      const character = this.character(actor), incoming = this.entry(character.id, data.inventoryId);
      if (incoming.slot !== 'BAG') throw new Error('Selecione um item da mochila.');
      const equipment = this.repository.equipment(character.id), newItem = this.repository.item(incoming.itemId);
      const { updatedEquipment } = equipItemValidator(equipment, newItem, data.slot);
      this.repository.remove(incoming, 1);
      const keys = { MAIN_HAND: 'mainHand', OFF_HAND: 'offHand', ARMOR: 'armor' } as const;
      for (const row of this.repository.entries(character.id)) if (row.slot !== 'BAG' && updatedEquipment[keys[row.slot]] !== equipment[keys[row.slot]]) {
        this.repository.remove(row, 1); this.repository.addBag(character.id, row.itemId, 1);
      }
      this.db.insert(inventories).values({ characterId: character.id, itemId: incoming.itemId, slot: data.slot, quantity: 1 }).run();
      this.repository.recalculate(character);
    }).immediate();
    this.syncInventory(actor);
  }
  unequipItem(actor: PlayerSchema, input: unknown) {
    const data = UnequipItemSchema.parse(input); this.identity(actor); this.idle();
    this.database.sqlite.transaction(() => {
      const character = this.character(actor), row = this.repository.entries(character.id).find(e => e.slot === data.slot);
      if (!row) throw new Error('Slot vazio.');
      this.repository.remove(row, 1); this.repository.addBag(character.id, row.itemId, 1); this.repository.recalculate(character);
    }).immediate();
    this.syncInventory(actor);
  }
  useScroll(actor: PlayerSchema, input: unknown) {
    const data = UseScrollSchema.parse(input); this.identity(actor); this.idle();
    this.database.sqlite.transaction(() => {
      const character = this.character(actor), row = this.entry(character.id, data.inventoryId), item = this.repository.item(row.itemId);
      if (row.slot !== 'BAG' || item.category !== 'CONSUMABLE' || item.effect.type !== 'LEARN_SPELL') throw new Error('Selecione um pergaminho da mochila.');
      const spellId = item.effect.spellId; this.repository.spell(spellId);
      if (this.db.select().from(characterGrimoire).where(and(eq(characterGrimoire.characterId, character.id), eq(characterGrimoire.spellId, spellId))).get()) throw new Error('Feitiço já aprendido.');
      this.repository.remove(row, 1); this.db.insert(characterGrimoire).values({ characterId: character.id, spellId }).run();
    }).immediate();
    this.syncInventory(actor);
  }
  private shopSnapshot(actor: PlayerSchema, shopId: string): ShopSnapshot {
    this.object(actor, shopId, 'NPC_MERCHANT');
    const row = this.db.select().from(npcShops).where(eq(npcShops.objectId, shopId)).get();
    if (!row) throw new Error('Loja indisponível.');
    const inventory = MasterEditShopSchema.shape.inventory.parse(JSON.parse(row.inventoryJson));
    return { shopId, npcName: row.npcName, dialogue: row.dialogue, canEdit: actor.role === 'MASTER', inventory: inventory.map(e => ({ item: this.repository.item(e.itemId), stock: e.stock })) };
  }
  private chestSnapshot(actor: PlayerSchema, chestId: string): ChestSnapshot {
    this.object(actor, chestId, 'CHEST');
    const row = this.db.select().from(chests).where(eq(chests.objectId, chestId)).get();
    if (!row) throw new Error('Baú indisponível.');
    const items = MasterEditChestSchema.shape.items.parse(JSON.parse(row.itemsJson));
    return { chestId, gold: row.gold, canEdit: actor.role === 'MASTER', items: items.map(e => ({ item: this.repository.item(e.itemId), quantity: e.quantity })) };
  }
  private watch(actor: PlayerSchema, id: string) { const viewers = this.viewers.get(id) ?? new Set<string>(); viewers.add(actor.id); this.viewers.set(id, viewers); }
  private notify(id: string, kind: 'CHEST' | 'NPC_MERCHANT') {
    const viewers = this.viewers.get(id);
    for (const playerId of viewers ?? []) {
      const actor = this.state.players.get(playerId);
      try {
        if (!actor || this.state.combatState.active) throw new Error();
        this.send(actor.id, kind === 'CHEST' ? 'CHEST_SYNC' : 'SHOP_SYNC', kind === 'CHEST' ? this.chestSnapshot(actor, id) : this.shopSnapshot(actor, id));
      } catch { viewers?.delete(playerId); }
    }
    if (!viewers?.size) this.viewers.delete(id);
  }
  disconnect(playerId: string) { for (const [id, viewers] of this.viewers) { viewers.delete(playerId); if (!viewers.size) this.viewers.delete(id); } }
  openShop(actor: PlayerSchema, input: unknown) {
    this.idle(); const { shopId } = OpenShopSchema.parse(input), snapshot = this.shopSnapshot(actor, shopId);
    this.watch(actor, shopId); this.send(actor.id, 'SHOP_SYNC', snapshot);
  }
  openChest(actor: PlayerSchema, input: unknown) {
    this.idle(); const { chestId } = OpenChestSchema.parse(input), snapshot = this.chestSnapshot(actor, chestId);
    this.watch(actor, chestId); this.send(actor.id, 'CHEST_SYNC', snapshot);
  }
  buyItem(actor: PlayerSchema, input: unknown) {
    const data = BuyItemSchema.parse(input); this.idle();
    this.database.sqlite.transaction(() => {
      this.object(actor, data.shopId, 'NPC_MERCHANT'); const character = this.character(actor);
      const row = this.db.select().from(npcShops).where(eq(npcShops.objectId, data.shopId)).get();
      if (!row) throw new Error('Loja indisponível.');
      const inventory = MasterEditShopSchema.shape.inventory.parse(JSON.parse(row.inventoryJson)), entry = inventory.find(e => e.itemId === data.itemId);
      if (!entry || (entry.stock !== null && entry.stock < data.quantity)) throw new Error('Estoque indisponível.');
      const price = this.repository.item(data.itemId).basePriceGold * data.quantity;
      if (!Number.isSafeInteger(price) || character.gold < price) throw new Error('Ouro insuficiente.');
      this.repository.setGold(character, character.gold - price);
      if (entry.stock !== null) entry.stock -= data.quantity;
      this.db.update(npcShops).set({ inventoryJson: JSON.stringify(inventory) }).where(eq(npcShops.objectId, row.objectId)).run();
      this.repository.addBag(character.id, data.itemId, data.quantity);
    }).immediate();
    this.watch(actor, data.shopId); this.syncInventory(actor); this.notify(data.shopId, 'NPC_MERCHANT');
  }
  sellItem(actor: PlayerSchema, input: unknown) {
    const data = SellItemSchema.parse(input); this.idle();
    this.database.sqlite.transaction(() => {
      this.object(actor, data.shopId, 'NPC_MERCHANT'); const character = this.character(actor);
      const row = this.entry(character.id, data.inventoryId);
      if (row.slot !== 'BAG') throw new Error('Desequipe o item antes de vender.');
      if (!this.db.select().from(npcShops).where(eq(npcShops.objectId, data.shopId)).get()) throw new Error('Loja indisponível.');
      const price = calculateSellPrice(this.repository.item(row.itemId).basePriceGold) * data.quantity;
      if (!Number.isSafeInteger(price)) throw new Error('Valor de venda inválido.');
      this.repository.remove(row, data.quantity); this.repository.setGold(character, character.gold + price);
    }).immediate();
    this.watch(actor, data.shopId); this.syncInventory(actor); this.notify(data.shopId, 'NPC_MERCHANT');
  }
  lootChestItem(actor: PlayerSchema, input: unknown) {
    const data = LootChestItemSchema.parse(input); this.idle();
    this.database.sqlite.transaction(() => {
      this.object(actor, data.chestId, 'CHEST'); const character = this.character(actor);
      const row = this.db.select().from(chests).where(eq(chests.objectId, data.chestId)).get();
      if (!row) throw new Error('Baú indisponível.');
      if (data.kind === 'GOLD') {
        if (row.gold <= 0) throw new Error('Baú sem ouro.');
        this.repository.setGold(character, character.gold + row.gold);
        this.db.update(chests).set({ gold: 0 }).where(eq(chests.objectId, row.objectId)).run();
      } else {
        const items = MasterEditChestSchema.shape.items.parse(JSON.parse(row.itemsJson)), entry = items.find(e => e.itemId === data.itemId);
        if (!entry || entry.quantity < data.quantity) throw new Error('Item indisponível no baú.');
        entry.quantity -= data.quantity;
        this.db.update(chests).set({ itemsJson: JSON.stringify(items.filter(e => e.quantity > 0)) }).where(eq(chests.objectId, row.objectId)).run();
        this.repository.addBag(character.id, data.itemId, data.quantity);
      }
    }).immediate();
    this.watch(actor, data.chestId); this.syncInventory(actor); this.notify(data.chestId, 'CHEST');
  }
  editShop(actor: PlayerSchema, input: unknown) {
    this.master(actor); this.idle(); const data = MasterEditShopSchema.parse(input);
    this.database.sqlite.transaction(() => {
      this.shopSnapshot(actor, data.shopId);
      for (const entry of data.inventory) this.repository.item(entry.itemId);
      this.db.update(npcShops).set({ npcName: data.npcName, dialogue: data.dialogue, inventoryJson: JSON.stringify(data.inventory) }).where(eq(npcShops.objectId, data.shopId)).run();
    }).immediate();
    this.watch(actor, data.shopId); this.notify(data.shopId, 'NPC_MERCHANT');
  }
  editChest(actor: PlayerSchema, input: unknown) {
    this.master(actor); this.idle(); const data = MasterEditChestSchema.parse(input);
    this.database.sqlite.transaction(() => {
      this.chestSnapshot(actor, data.chestId); for (const entry of data.items) this.repository.item(entry.itemId);
      this.db.update(chests).set({ gold: data.gold, itemsJson: JSON.stringify(data.items) }).where(eq(chests.objectId, data.chestId)).run();
    }).immediate();
    this.watch(actor, data.chestId); this.notify(data.chestId, 'CHEST');
  }
  grantItem(actor: PlayerSchema, input: unknown) {
    this.master(actor); this.idle(); const data = MasterGrantItemSchema.parse(input), target = this.state.players.get(data.targetPlayerId);
    if (!target) throw new Error('Personagem indisponível.');
    this.database.sqlite.transaction(() => {
      const character = this.character(target, false);
      if (data.kind === 'GOLD') this.repository.setGold(character, character.gold + data.gold);
      else this.repository.addBag(character.id, data.itemId, data.quantity);
    }).immediate();
    this.syncInventory(target);
  }
}
