import { boardCommand } from '../../network/colyseusClient';
import { useEconomyStore } from '../../store/useEconomyStore';
import { useGameStore } from '../../store/useGameStore';
import { EconomyDialog } from './EconomyDialog';
export function DiceTrayModal({ chamberId, onClose }: { chamberId?: string; onClose: () => void }) {
  const result = useEconomyStore(s => s.lastDice), connected = useGameStore(s => s.connectionState === 'CONNECTED');
  return <EconomyDialog title="Bandeja de dados" onClose={onClose}><p>Escolha um dado para rolar na câmara.</p><div className="dice-buttons">{[4, 6, 8, 10, 12, 20, 100].map(faces => <button key={faces} disabled={!connected} onClick={() => boardCommand('ROLL_DICE', { faces, ...(chamberId ? { chamberId } : {}) })}>d{faces}</button>)}</div><p role="status">{result ? `${result.actorName} · d${result.faces}: ${result.value}` : 'Aguardando rolagem'}</p></EconomyDialog>;
}
