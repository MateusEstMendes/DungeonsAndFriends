import { useEffect, useState } from 'react';
import { isCharacterPresent } from '@df/shared';
import { boardCommand } from '../../network/colyseusClient';
import { useGameStore, type Player } from '../../store/useGameStore';
import { useBoardStore } from '../../store/useBoardStore';
import { useCombatStore } from '../../store/useCombatStore';
import { useUIStore } from '../../store/useUIStore';

export function CharacterRoster() {
  const [open, setOpen] = useState(false);
  const queueOpen = useUIStore(s => s.queueOpen);
  useEffect(() => { if (queueOpen) setOpen(false); }, [queueOpen]);
  const players = useGameStore(s => s.players);
  const connected = useGameStore(s => s.connectionState === 'CONNECTED');
  const characters = players.filter(p => p.role === 'PLAYER' && p.characterId);
  const active = characters.filter(p => p.connected || p.reconnecting);
  const absent = characters.filter(p => !p.connected && !p.reconnecting);
  return <div className="queue character-roster">
    <button aria-expanded={open} aria-controls="character-roster" onClick={() => { setOpen(!open); useUIStore.setState({ queueOpen: false }); }}>Personagens · {active.length}</button>
    {open && <section id="character-roster" className="popover" aria-label="Personagens da sala">
      <h2>Conectados</h2>
      {active.length ? active.map(p => <CharacterEntry key={p.id} player={p} enabled={connected}/>) : <p>Nenhum personagem conectado.</p>}
      <h2>Ausentes</h2>
      {absent.length ? absent.map(p => <CharacterEntry key={p.id} player={p} enabled={connected}/>) : <p>Nenhum personagem ausente.</p>}
    </section>}
  </div>;
}

function CharacterEntry({ player: p, enabled }: { player: Player; enabled: boolean }) {
  const { chambers } = useBoardStore();
  const combat = useCombatStore(s => s.combat);
  const [confirmKick, setConfirmKick] = useState(false);
  return <article className="character-entry">
    <strong>{p.characterName} · {p.name}</strong>
    <small>{p.status === 'PENDING_APPROVAL' ? 'Nova aprovação necessária' : p.status === 'REJECTED' ? 'Entrada recusada' : p.reconnecting ? 'Reconectando (até 60s)' : !p.connected ? 'Ausente' : p.awaitingPosition ? 'Aguardando posicionamento pelo mestre' : 'Na sala'}</small>
    <details><summary>Consultar ficha</summary>
      {p.portraitUrl && <img src={p.portraitUrl} alt={`Retrato de ${p.characterName}`} width={64} height={64}/>}
      <p>{p.raceId} · {p.archetypeId}<br/>HP {p.hp}/{p.maxHp} · MP {p.mp}/{p.maxMp}<br/>Defesa {p.defense} · Velocidade {p.speed}</p>
    </details>
    {p.connected && p.status === 'READY' && p.awaitingPosition && <form onSubmit={e => {
      e.preventDefault(); const data = new FormData(e.currentTarget);
      boardCommand('MASTER_POSITION_PLAYER', { entityId: p.id, chamberId: String(data.get('chamber')), q: Number(data.get('q')), r: Number(data.get('r')) });
    }}>
      <label>Câmara de {p.characterName}<select name="chamber" defaultValue={chambers.some(c => c.id === p.currentChamberId) ? p.currentChamberId : chambers[0]?.id}>{chambers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <div className="coordinate-form"><label>q<input name="q" type="number" min={-200} max={200} defaultValue={p.q} required/></label><label>r<input name="r" type="number" min={-200} max={200} defaultValue={p.r} required/></label><button disabled={!enabled}>Posicionar</button></div>
    </form>}
    {p.connected && isCharacterPresent(p) && combat.active && combat.chamberId === p.currentChamberId && !combat.turnOrder.includes(p.id) && p.hp > 0 && <button disabled={!enabled} onClick={() => boardCommand('MASTER_ADD_COMBAT_PLAYER', { targetPlayerId: p.id })}>Incluir no combate</button>}
    {(p.status === 'READY' || p.connected || p.reconnecting) && (confirmKick ? <div role="group" aria-label={`Confirmar expulsão de ${p.characterName}`}>
      <p>Expulsar {p.characterName}? A ficha será preservada e o retorno exigirá nova aprovação.</p>
      <button className="danger" disabled={!enabled} onClick={() => { boardCommand('MASTER_KICK_PLAYER', { targetPlayerId: p.id }); setConfirmKick(false); }}>Confirmar expulsão</button>
      <button onClick={() => setConfirmKick(false)}>Cancelar</button>
    </div> : <button className="danger" disabled={!enabled} onClick={() => setConfirmKick(true)}>Expulsar {p.characterName}</button>)}
  </article>;
}
