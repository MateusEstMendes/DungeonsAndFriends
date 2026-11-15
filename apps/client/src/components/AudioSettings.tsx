import { useAudioStore } from '../store/useAudioStore';
import { boardCommand } from '../network/colyseusClient';
import { useGameStore } from '../store/useGameStore';
export function AudioSettings() {
  const prefs = useAudioStore(), role = useGameStore(s => s.role);
  return <details className="audio-settings"><summary>Áudio</summary><div className="audio-panel panel">
    <button aria-pressed={prefs.isMuted} onClick={() => useAudioStore.setState({ isMuted: !prefs.isMuted })}>{prefs.isMuted ? 'Ativar som' : 'Silenciar'}</button>
    {([['masterVolume', 'Volume geral'], ['bgmVolume', 'Música'], ['sfxVolume', 'Efeitos']] as const).map(([key, label]) => <label key={key}>{label}<input aria-label={label} type="range" min="0" max="1" step="0.05" value={prefs[key]} onChange={e => useAudioStore.setState({ [key]: Number(e.target.value) })}/></label>)}
    {!prefs.audioUnlocked && <p>Toque na tela para ativar o áudio.</p>}
    {role === 'MASTER' && <><p>Efeitos para toda a mesa</p><button onClick={() => boardCommand('MASTER_NARRATIVE_SFX', { effect: 'master_thunder' })}>Trovão</button><button onClick={() => boardCommand('MASTER_NARRATIVE_SFX', { effect: 'master_door_slam' })}>Porta Pesada</button></>}
  </div></details>;
}
