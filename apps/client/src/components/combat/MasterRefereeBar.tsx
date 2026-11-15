import { selectMonster, useCombatStore } from '../../store/useCombatStore';
import { useGameStore } from '../../store/useGameStore';
import { boardCommand } from '../../network/colyseusClient';
export function MasterRefereeBar() {
  const { combat: c, participants, selectedMonsterId, cutoffs } = useCombatStore();
  if (useGameStore(s => s.role) !== 'MASTER') return null;
  function move(index: number, delta: number) { const order = [...c.turnOrder]; [order[index], order[index + delta]] = [order[index + delta], order[index]]; boardCommand('MASTER_REORDER_INITIATIVE', { turnOrder: order }); }
  return <aside className="referee-bar" aria-label="Barra de Árbitro do Mestre">
    <strong>✦ Árbitro</strong><button disabled={!c.active} aria-pressed={c.isPaused} onClick={() => boardCommand('MASTER_PAUSE_COMBAT', { paused: !c.isPaused })}>{c.isPaused ? 'Retomar' : 'Pausar'}</button>
    <label>Fuga<select disabled={!c.active} value={c.fleeMode} onChange={e => boardCommand('MASTER_SET_FLEE_MODE', { mode: e.target.value })}><option value="NORMAL">Normal</option><option value="BLOCKED">Bloquear fuga</option><option value="GUARANTEED_100">100% de Chance de Fuga</option></select></label>
    <button disabled={!c.active} onClick={() => boardCommand('MASTER_FORCE_TURN_SKIP')}>Pular turno</button>
    <details><summary>Iniciativa</summary><ol>{c.turnOrder.map((id,index) => <li key={id}><span>{id === c.activeParticipantId ? '▶ ' : ''}{participants.find(p => p.id === id)?.name}</span><button disabled={index === 0 || !c.active} aria-label={`Adiantar ${participants.find(p => p.id === id)?.name}`} onClick={() => move(index,-1)}>↑</button><button disabled={index === c.turnOrder.length - 1 || !c.active} aria-label={`Atrasar ${participants.find(p => p.id === id)?.name}`} onClick={() => move(index,1)}>↓</button></li>)}</ol></details>
    <details><summary>Controlar monstro</summary><div>{participants.filter(p => p.kind === 'MONSTER').map(p => <button key={p.id} aria-pressed={selectedMonsterId === p.id} disabled={p.hp <= 0} onClick={() => selectMonster(p.id)}>{p.name}{p.id !== c.activeParticipantId ? ' · aguarde o turno' : ''}</button>)}</div></details>
    <details><summary>Faixas d20</summary><form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); boardCommand('MASTER_SET_D20_CUTOFFS', { criticalFailure: Number(form.get('criticalFailure')), success: Number(form.get('success')), criticalSuccess: Number(form.get('criticalSuccess')) }); }}>
      <label>Falha crítica até<input type="number" min={1} max={18} name="criticalFailure" defaultValue={cutoffs.criticalFailure}/></label><label>Sucesso a partir de<input type="number" min={2} max={19} name="success" defaultValue={cutoffs.success}/></label><label>Crítico a partir de<input type="number" min={3} max={20} name="criticalSuccess" defaultValue={cutoffs.criticalSuccess}/></label><button disabled={!c.active}>Aplicar</button>
    </form></details>
    <button className="end-combat" disabled={!c.active} onClick={() => boardCommand('MASTER_END_COMBAT')}>Encerrar combate</button>
  </aside>;
}
