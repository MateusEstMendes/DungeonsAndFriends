import { useEconomyStore } from '../../store/useEconomyStore';
import { combatActionText, combatResultText } from '../combat/presentation';
import { EconomyDialog } from './EconomyDialog';
export function CombatLogDrawer({ onClose }: { onClose: () => void }) {
  const log = useEconomyStore(s => s.log);
  return <EconomyDialog title="Log da aventura" onClose={onClose} drawer><p>Últimos {log.length} eventos desta sessão</p><ol className="session-log">{log.map(entry => <li key={entry.id}><time dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleTimeString('pt-BR')}</time>{entry.type === 'DICE' ? <p>{entry.result.actorName} · d{entry.result.faces}: <strong>{entry.result.value}</strong></p> : <><p>Rodada {entry.event.round} · {combatActionText(entry.event)}</p><strong>{combatResultText(entry.event)}</strong><small>{entry.event.rolls.map(r => `d${r.faces}: ${r.value}`).join(' · ')}</small></>}</li>)}</ol>{!log.length && <p>Nenhum evento nesta câmara.</p>}</EconomyDialog>;
}
