import { useState } from 'react';
import { boardCommand } from '../../network/colyseusClient';
import { useEconomyStore, closeEconomyObject } from '../../store/useEconomyStore';
import { useGameStore } from '../../store/useGameStore';
import { useCombatStore } from '../../store/useCombatStore';
import { EconomyDialog } from './EconomyDialog';
import { LootEditor } from './LootEditor';
import { ItemIcon } from '../icons/ItemIcons';
export function ChestModal() {
  const chest = useEconomyStore(s => s.chest), game = useGameStore();
  const combat = useCombatStore(s => s.combat.active);
  const [editing, setEditing] = useState(false), [gold, setGold] = useState(0);
  const [rows, setRows] = useState<{ itemId: string; count: number | null }[]>([]);
  if (!chest) return null;
  const disabled = combat || game.connectionState !== 'CONNECTED';
  const loot = (kind: 'GOLD' | 'ITEM', itemId?: string, quantity?: number) => boardCommand('LOOT_CHEST_ITEM', { chestId: chest.chestId, kind, ...(kind === 'ITEM' ? { itemId, quantity } : {}) });
  return <EconomyDialog title="Baú compartilhado" onClose={() => closeEconomyObject('CHEST')}>
    {chest.canEdit && <button onClick={() => { setGold(chest.gold); setRows(chest.items.map(r => ({ itemId: r.item.id, count: r.quantity }))); setEditing(!editing); }}>{editing ? 'Cancelar edição' : 'Editar Baú'}</button>}
    {editing && chest.canEdit ? <form onSubmit={e => { e.preventDefault(); boardCommand('MASTER_EDIT_CHEST', { chestId: chest.chestId, gold, items: rows.map(r => ({ itemId: r.itemId, quantity: r.count })) }); setEditing(false); }}><label>Ouro do baú<input type="number" min={0} max={Number.MAX_SAFE_INTEGER} required value={gold} onChange={e => setGold(Number(e.target.value))}/></label><LootEditor rows={rows} onChange={setRows}/><button disabled={disabled}>Salvar baú</button></form>
    : <><article className="economy-row"><strong>{chest.gold} G</strong><button disabled={disabled || chest.gold === 0 || game.role === 'MASTER'} onClick={() => loot('GOLD')}>Coletar ouro</button></article>{chest.items.map(({ item, quantity }) => <article className="economy-row" key={item.id}><ItemIcon item={item}/><strong>{item.name} ×{quantity}</strong><button disabled={disabled || game.role === 'MASTER'} onClick={() => loot('ITEM', item.id, 1)}>Coletar {item.name}</button></article>)}{chest.gold === 0 && !chest.items.length ? <p>Baú vazio.</p> : <button disabled={disabled || game.role === 'MASTER'} onClick={() => { if (chest.gold) loot('GOLD'); chest.items.forEach(r => loot('ITEM', r.item.id, r.quantity)); }}>Coletar tudo</button>}</>}
  </EconomyDialog>;
}
