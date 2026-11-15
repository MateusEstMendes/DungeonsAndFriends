import { SESSION_LOG_LIMIT } from '@df/shared';
import { create } from 'zustand';
import type { InventorySnapshot, ShopSnapshot, ChestSnapshot, EphemeralChatMessage, SessionLogEntry, DiceResult } from '@df/shared';
interface EconomyState {
  activeShopId: string | null; activeChestId: string | null;
  inventories: Record<string, InventorySnapshot>; shop: ShopSnapshot | null; chest: ChestSnapshot | null;
  chats: EphemeralChatMessage[]; log: SessionLogEntry[]; lastDice: DiceResult | null;
}
export const initialEconomyState: EconomyState = { activeShopId: null, activeChestId: null, inventories: {}, shop: null, chest: null, chats: [], log: [], lastDice: null };
export const useEconomyStore = create<EconomyState>(() => ({ ...initialEconomyState }));
export function receiveChat(message: EphemeralChatMessage, now: number) {
  if (message.expiresAt <= now) return;
  useEconomyStore.setState(s => ({ chats: [...s.chats.filter(e => e.expiresAt > now && e.actorId !== message.actorId), message].slice(-50) }));
}
export function expireChat(id: string) { useEconomyStore.setState(s => ({ chats: s.chats.filter(e => e.id !== id) })); }
export function receiveLog(entries: SessionLogEntry[], replace = false) {
  useEconomyStore.setState(s => {
    const unique = new Map((replace ? entries : [...s.log, ...entries]).map(e => [e.id, e]));
    return { log: [...unique.values()].sort((a, b) => a.createdAt - b.createdAt).slice(-SESSION_LOG_LIMIT) };
  });
}

/** Match replies to the currently requested view; late broadcasts must not reopen a dismissed modal. */
export function requestEconomyObject(kind: 'SHOP' | 'CHEST', id: string) {
  useEconomyStore.setState({ shop: null, chest: null, activeShopId: kind === 'SHOP' ? id : null, activeChestId: kind === 'CHEST' ? id : null });
}
export function closeEconomyObject(kind: 'SHOP' | 'CHEST') {
  useEconomyStore.setState(kind === 'SHOP' ? { shop: null, activeShopId: null } : { chest: null, activeChestId: null });
}
export function receiveShop(snapshot: ShopSnapshot) {
  if (useEconomyStore.getState().activeShopId === snapshot.shopId) useEconomyStore.setState({ shop: snapshot });
}
export function receiveChest(snapshot: ChestSnapshot) {
  if (useEconomyStore.getState().activeChestId === snapshot.chestId) useEconomyStore.setState({ chest: snapshot });
}
