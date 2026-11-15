import { useRegisterSW } from 'virtual:pwa-register/react';
import { useCombatStore } from '../store/useCombatStore';
export function PwaUpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({ immediate: true });
  const combatActive = useCombatStore(s => s.combat.active);
  if (!needRefresh) return null;
  return <aside className="pwa-update" role="status"><span>{combatActive ? 'Atualização disponível. Encerre o combate para atualizar.' : 'Uma nova versão está disponível.'}</span>
    <button disabled={combatActive} onClick={() => { if (!useCombatStore.getState().combat.active) void updateServiceWorker(true); }}>Atualizar agora</button>
  </aside>;
}
