import { useState } from 'react';
import { ARCHETYPES, RACES, isTwoHanded, type ArchetypeId, type RaceId, type EquipmentSlot, type InventoryEntry } from '@df/shared';
import { boardCommand } from '../../network/colyseusClient';
import { useEconomyStore } from '../../store/useEconomyStore';
import { useGameStore } from '../../store/useGameStore';
import { useCombatStore } from '../../store/useCombatStore';
import { ItemIcon } from '../icons/ItemIcons';
import { EconomyDialog } from './EconomyDialog';
const passiveText: Record<RaceId, string> = {
  HUMAN: '+1 em um atributo escolhido na criação da ficha.',
  DWARF: 'Reduz o dano recebido em 1.',
  ELF: '+5% de esquiva passiva, respeitando o limite de 20%.',
  ORC: '+2 de dano físico quando está abaixo de 30% de HP.',
  VAMPIRE: 'Recupera 20% do dano causado em ataques corpo a corpo.',
  DEMON: 'Ataques mágicos ignoram 2 de redução de dano.',
  HALF_DRAGON: '+2 de Defesa natural.',
  HALF_SHARK: '+2 de dano corpo a corpo contra alvos abaixo de 50% de HP.',
};
const slots = [['mainHand', 'MAIN_HAND', 'Mão Principal'], ['offHand', 'OFF_HAND', 'Mão Secundária'], ['armor', 'ARMOR', 'Armadura']] as const;
export function CharacterSheetDrawer({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const [tab, setTab] = useState('Ficha');
  const inventory = useEconomyStore(s => s.inventories[playerId]);
  const game = useGameStore(), combat = useCombatStore();
  const player = game.players.find(p => p.id === playerId);
  const readOnly = game.playerId !== playerId || game.connectionState !== 'CONNECTED';
  const locked = readOnly || combat.combat.active;
  if (!inventory) return <EconomyDialog title="Ficha do personagem" onClose={onClose}><p role="status">Carregando ficha…</p></EconomyDialog>;
  const bag = inventory.items.filter(e => e.slot === 'BAG');
  const race = RACES[inventory.raceId as RaceId], archetype = ARCHETYPES[inventory.archetypeId as ArchetypeId];
  const hasFocus = [inventory.equipment.mainHand, inventory.equipment.offHand].some(e => e?.item.category === 'MAGIC_FOCUS');
  function use(entry: InventoryEntry) {
    const item = entry.item;
    if (item.category !== 'CONSUMABLE' || readOnly) return;
    if (item.effect.type === 'LEARN_SPELL') { boardCommand('USE_SCROLL', { inventoryId: entry.inventoryId }); return; }
    const c = combat.combat;
    if (!c.active || c.activeParticipantId !== playerId || c.isPaused || combat.pending || Date.now() < combat.busyUntil || c.actionIndex > 0) return;
    useCombatStore.setState({ pending: true, busyUntil: Date.now() + 1200 });
    boardCommand('COMBAT_ACTION', { type: 'ITEM', itemId: entry.itemId, targetId: playerId, turnToken: c.turnToken }); onClose();
  }
  return <EconomyDialog title={inventory.name} onClose={onClose} drawer>
    <p className="gold-balance">{inventory.gold} G</p>
    <nav aria-label="Abas da ficha">{['Ficha', 'Equipamentos & Mochila', 'Grimório'].map(t => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</button>)}</nav>
    {tab === 'Ficha' && <section aria-label="Atributos do personagem">
      {player?.portraitUrl && <img className="sheet-portrait" src={player.portraitUrl} alt={`Retrato de ${inventory.name}`}/>}
      <h3>{race?.name} · {archetype?.name}</h3><p>HP {inventory.stats.hp}/{inventory.stats.maxHp} · MP {inventory.stats.mp}/{inventory.stats.maxMp}</p>
      <dl className="sheet-stats">{([['FOR', 'finalStr'], ['DES', 'finalDex'], ['CON', 'finalCon'], ['INT', 'finalInt'], ['SAB', 'finalWis'], ['CAR', 'finalCha'], ['Defesa', 'defense'], ['Esquiva', 'dodgeChance'], ['DR', 'flatDr'], ['Velocidade', 'speed']] as const).map(([label, key]) => <div key={key}><dt>{label}</dt><dd>{inventory.stats[key]}{key === 'dodgeChance' ? '%' : ''}</dd></div>)}</dl>
      <h3>{race?.passive.name}</h3><p>{passiveText[inventory.raceId as RaceId]}</p><h3>{archetype?.signatureAbility.name}</h3><p>{archetype?.signatureAbility.description}</p>
    </section>}
    {tab === 'Equipamentos & Mochila' && <section><h3>Equipamentos</h3>{slots.map(([key, slot, label]) => { const entry = inventory.equipment[key]; return <article className="economy-row" key={slot}><div><strong>{label}</strong><p>{entry ? <><ItemIcon item={entry.item}/>{entry.item.name}</> : key === 'offHand' && isTwoHanded(inventory.equipment.mainHand?.item ?? null) ? '🔒 Ocupada por arma de duas mãos' : 'Vazio'}</p></div>{entry && <button disabled={locked} onClick={() => boardCommand('UNEQUIP_ITEM', { slot })}>Desequipar {label}</button>}</article>; })}
      <h3>Mochila</h3>{!bag.length && <p>Mochila vazia.</p>}{bag.map(entry => <article className="economy-row" key={entry.inventoryId}><ItemIcon item={entry.item}/><div><strong>{entry.item.name} ×{entry.quantity}</strong>{'damageDice' in entry.item && <small>{entry.item.damageDice} · {isTwoHanded(entry.item) ? 'Duas mãos' : 'Uma mão'}</small>}{entry.item.category === 'CONSUMABLE' && entry.item.effect.type !== 'LEARN_SPELL' && <small>Usar em si durante o próprio turno de combate.</small>}</div><div className="item-actions">{entry.item.slot !== 'BAG' ? <>{([entry.item.slot, ...('handedness' in entry.item && entry.item.handedness === 'ONE_HANDED' ? ['OFF_HAND' as EquipmentSlot] : [])]).map(slot => <button key={slot} disabled={locked} onClick={() => boardCommand('EQUIP_ITEM', { inventoryId: entry.inventoryId, slot })}>Equipar {slot === 'OFF_HAND' ? 'secundária' : slot === 'ARMOR' ? 'armadura' : 'principal'}</button>)}</> : entry.item.category === 'CONSUMABLE' && <button disabled={entry.item.effect.type === 'LEARN_SPELL' ? locked || inventory.spells.some(s => s.id === (entry.item.category === 'CONSUMABLE' && entry.item.effect.type === 'LEARN_SPELL' ? entry.item.effect.spellId : '')) : readOnly || !combat.combat.active || combat.combat.activeParticipantId !== playerId || combat.combat.isPaused || combat.pending || Date.now() < combat.busyUntil || combat.combat.actionIndex > 0} onClick={() => use(entry)}>{entry.item.effect.type === 'LEARN_SPELL' ? 'Ler pergaminho' : 'Usar'}</button>}</div></article>)}
      {combat.combat.active && <p role="status">Equipamentos e pergaminhos disponíveis após o combate.</p>}
    </section>}
    {tab === 'Grimório' && <section><p>{hasFocus ? 'Foco mágico equipado' : 'Requer foco mágico equipado para conjurar.'}</p>{!inventory.spells.length && <p>Nenhum feitiço aprendido.</p>}{inventory.spells.map(spell => <article className="economy-row" key={spell.id}><ItemIcon spell={spell.element}/><div><h3>{spell.name} · {spell.mpCost} MP</h3><p>{spell.description}</p><small>{inventory.stats.mp < spell.mpCost ? 'MP insuficiente · ' : ''}Conjure pelo menu Atacar durante seu turno.</small></div></article>)}{bag.filter(e => e.item.category === 'CONSUMABLE' && e.item.effect.type === 'LEARN_SPELL').map(e => <button key={e.inventoryId} disabled={locked || inventory.spells.some(s => e.item.category === 'CONSUMABLE' && e.item.effect.type === 'LEARN_SPELL' && s.id === e.item.effect.spellId)} onClick={() => use(e)}>Ler {e.item.name}</button>)}</section>}
  </EconomyDialog>;
}
