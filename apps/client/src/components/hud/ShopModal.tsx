import { useState } from 'react';
import { calculateSellPrice } from '@df/shared';
import { boardCommand } from '../../network/colyseusClient';
import { useEconomyStore, closeEconomyObject } from '../../store/useEconomyStore';
import { useGameStore } from '../../store/useGameStore';
import { useCombatStore } from '../../store/useCombatStore';
import { EconomyDialog } from './EconomyDialog';
import { LootEditor } from './LootEditor';
import { ItemIcon } from '../icons/ItemIcons';
export function ShopModal() {
  const shop = useEconomyStore(s => s.shop), game = useGameStore();
  const inventory = useEconomyStore(s => s.inventories[game.playerId]);
  const combat = useCombatStore(s => s.combat.active);
  const [tab, setTab] = useState('Comprar');
  const [editing, setEditing] = useState(false), [name, setName] = useState(''), [dialogue, setDialogue] = useState('');
  const [rows, setRows] = useState<{ itemId: string; count: number | null }[]>([]);
  if (!shop) return null;
  const close = () => closeEconomyObject('SHOP');
  const disabled = combat || game.connectionState !== 'CONNECTED';
  return <EconomyDialog title={shop.npcName} onClose={close}><div className="merchant-portrait" aria-hidden="true">♙</div><p>{shop.dialogue}</p><p className="gold-balance">{inventory?.gold ?? 0} G</p>
    <nav aria-label="Abas da loja">{['Comprar', 'Vender (50%)'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setEditing(false); }}>{t}</button>)}{shop.canEdit && <button onClick={() => { setName(shop.npcName); setDialogue(shop.dialogue); setRows(shop.inventory.map(r => ({ itemId: r.item.id, count: r.stock }))); setEditing(true); }}>Editar Loja</button>}</nav>
    {editing && shop.canEdit ? <form onSubmit={e => { e.preventDefault(); boardCommand('MASTER_EDIT_SHOP', { shopId: shop.shopId, npcName: name, dialogue, inventory: rows.map(r => ({ itemId: r.itemId, stock: r.count })) }); setEditing(false); }}><label>Nome do mercador<input required maxLength={60} value={name} onChange={e => setName(e.target.value)}/></label><label>Diálogo<textarea aria-label="Diálogo" maxLength={1000} value={dialogue} onChange={e => setDialogue(e.target.value)}/></label><LootEditor rows={rows} onChange={setRows} shop/><button disabled={disabled}>Salvar loja</button></form>
    : tab === 'Comprar' ? <section>{shop.inventory.map(({ item, stock }) => <article className="economy-row" key={item.id}><ItemIcon item={item}/><div><strong>{item.name}</strong><small>{item.basePriceGold} G · Estoque: {stock ?? '∞'}</small></div><button disabled={disabled || game.role === 'MASTER' || stock === 0 || !inventory || inventory.gold < item.basePriceGold} onClick={() => boardCommand('BUY_ITEM', { shopId: shop.shopId, itemId: item.id, quantity: 1 })}>Comprar {item.name}</button></article>)}</section>
    : <section>{!inventory?.items.length && <p>Nenhum item para vender.</p>}{inventory?.items.map(entry => <article className="economy-row" key={entry.inventoryId}><ItemIcon item={entry.item}/><div><strong>{entry.item.name} ×{entry.quantity}</strong><small>{calculateSellPrice(entry.item.basePriceGold)} G por unidade{entry.slot !== 'BAG' ? ' · 🔒 Equipado' : ''}</small></div><button disabled={disabled || entry.slot !== 'BAG'} onClick={() => boardCommand('SELL_ITEM', { shopId: shop.shopId, inventoryId: entry.inventoryId, quantity: 1 })}>Vender {entry.item.name}</button></article>)}</section>}
    {combat && <p role="status">Negociações disponíveis após o combate.</p>}
  </EconomyDialog>;
}
