import { boardCommand } from '../../network/colyseusClient';
import { useRecoveryStore } from '../../store/useRecoveryStore';
import { useGameStore } from '../../store/useGameStore';
export function RecoveryModal() {
  const summary = useRecoveryStore(s => s.summary), role = useGameStore(s => s.role);
  if (!summary || role !== 'MASTER') return null;
  return <div className="recovery-backdrop"><section className="panel recovery-modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title">
    <h2 id="recovery-title">Sessão anterior interrompida</h2><p>Deseja restaurar de onde parou?</p>
    <p>Último registro: {new Date(summary.updatedAt).toLocaleString('pt-BR')}. {summary.inCombat ? `Combate · rodada ${summary.round}.` : 'Exploração.'}</p>
    <p>{summary.heroes.join(', ')}</p><p>O combate será restaurado pausado. Aguarde os jogadores reconectarem antes de despausar.</p>
    <button autoFocus onClick={() => boardCommand('MASTER_RESTORE_SESSION')}>Restaurar Sessão</button>
    <button onClick={() => boardCommand('MASTER_DISCARD_SESSION')}>Descartar e Criar Nova</button>
  </section></div>;
}
