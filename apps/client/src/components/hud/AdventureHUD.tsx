import { useEffect, useState } from 'react';
import { getHexEdgeKey, getHexKey, hexDistance } from '@df/shared';
import { boardCommand } from '../../network/colyseusClient';
import { useGameStore } from '../../store/useGameStore';
import { useBoardStore } from '../../store/useBoardStore';
import { useCombatStore } from '../../store/useCombatStore';
import { useEconomyStore, closeEconomyObject } from '../../store/useEconomyStore';
import { CharacterSheetDrawer } from './CharacterSheetDrawer';
import { ShopModal } from './ShopModal';
import { ChestModal } from './ChestModal';
import { DiceTrayModal } from './DiceTrayModal';
import { CombatLogDrawer } from './CombatLogDrawer';
import { EphemeralChatBubble } from './EphemeralChatBubble';
import './economy.css';
export function AdventureHUD({ chamberId, arena }: { chamberId?: string; arena: boolean }) {
  const game = useGameStore(), board = useBoardStore();
  const active = useCombatStore(s => s.combat.active);
  const [panel, setPanel] = useState<'sheet' | 'dice' | 'log' | null>(null), [text, setText] = useState('');
  const characters = game.players.filter(p => p.role === 'PLAYER' && p.characterId);
  const [selected, setSelected] = useState('');
  const targetId = game.role === 'MASTER' ? selected || characters[0]?.id || '' : game.playerId;
  const own = game.players.find(p => p.id === game.playerId), connected = game.connectionState === 'CONNECTED';
  useEffect(() => { if (panel === 'sheet' && targetId) boardCommand('REQUEST_INVENTORY', { targetPlayerId: targetId }); }, [panel, targetId]);
  useEffect(() => { if (panel === 'log') boardCommand('REQUEST_LOG'); }, [panel]);
  const chamber = board.chambers.find(c => c.id === own?.currentChamberId);
  const nearby = !active && game.role === 'PLAYER' && own && !own.awaitingPosition && own.hp > 0 ? board.objects.filter(o => ['CHEST', 'NPC_MERCHANT'].includes(o.kind ?? '') && !o.isHiddenByMaster && o.currentChamberId === own.currentChamberId && hexDistance(own, o) <= 1 && board.activeVision.includes(getHexKey(o.q, o.r)) && !(hexDistance(own, o) === 1 && chamber?.walls[getHexEdgeKey(own, o)])) : [];
  // Close object views when access changes; every command is also revalidated by the server.
  const shopId = useEconomyStore(s => s.activeShopId), chestId = useEconomyStore(s => s.activeChestId);
  useEffect(() => {
    if (active || (game.role === 'PLAYER' && shopId && !nearby.some(o => o.id === shopId))) closeEconomyObject('SHOP');
    if (active || (game.role === 'PLAYER' && chestId && !nearby.some(o => o.id === chestId))) closeEconomyObject('CHEST');
  }, [active, game.role, shopId, chestId, nearby.map(o => o.id).join(',')]);
  return <>
    <div className={`adventure-hud board-glass${arena ? ' in-arena' : ''}${game.role === 'MASTER' ? ' master-tools' : ''}`}>
      {game.role === 'MASTER' && <label className="sheet-player">Ficha de<select aria-label="Personagem da ficha" value={targetId} onChange={e => setSelected(e.target.value)}>{characters.map(p => <option key={p.id} value={p.id}>{p.characterName}</option>)}</select></label>}
      <nav aria-label="Ferramentas da aventura"><button disabled={!targetId || !connected} onClick={() => setPanel('sheet')}>🎒 Ficha</button><button disabled={!connected} onClick={() => setPanel('dice')}>🎲 Dados</button><button disabled={!connected} onClick={() => setPanel('log')}>📜 Log</button></nav>
      <details className="chat-compose"><summary>Chat da câmara</summary><form className="chat-form" onSubmit={e => { e.preventDefault(); const message = text.trim(); if (message && connected) { boardCommand('CHAT_MESSAGE', { text: message, ...(game.role === 'MASTER' && chamberId ? { chamberId } : {}) }); setText(''); } }}><input aria-label="Mensagem na câmara" placeholder="Fale com a câmara…" maxLength={200} required value={text} onChange={e => setText(e.target.value.replace(/[\u0000-\u001f\u007f]/g, ''))}/><button disabled={!connected || !text.trim()}>Enviar</button></form></details>
    </div>
    {!!nearby.length && <nav className="object-interactions board-glass" aria-label="Objetos próximos">{nearby.map(o => <button key={o.id} disabled={!connected} onClick={() => { boardCommand(o.kind === 'CHEST' ? 'OPEN_CHEST' : 'OPEN_SHOP', o.kind === 'CHEST' ? { chestId: o.id } : { shopId: o.id }); }}>{o.kind === 'CHEST' ? '🧰 Abrir Baú' : '💬 Comerciar'}</button>)}</nav>}
    {arena && <EphemeralChatBubble chamberId={chamberId}/>}
    {panel === 'sheet' && <CharacterSheetDrawer playerId={targetId} onClose={() => setPanel(null)}/>}
    {panel === 'dice' && <DiceTrayModal chamberId={game.role === 'MASTER' ? chamberId : undefined} onClose={() => setPanel(null)}/>}
    {panel === 'log' && <CombatLogDrawer onClose={() => setPanel(null)}/>}
    {shopId && <ShopModal key={shopId}/>}{chestId && <ChestModal key={chestId}/>}
  </>;
}
