import { useCombatStore } from '../../store/useCombatStore';
import { useEconomyStore } from '../../store/useEconomyStore';
export function EphemeralChatBubble({ chamberId }: { chamberId?: string }) {
  const offset = useCombatStore(s => s.serverClockOffset);
  const chats = useEconomyStore(s => s.chats);
  return <div className="ephemeral-chat" aria-live="polite">{chats.filter(c => c.chamberId === chamberId).slice(-3).map(c => <p key={c.id} style={{ animationDuration: `${Math.max(0, c.expiresAt - Date.now() - offset)}ms` }}><strong>{c.actorName}: </strong>{c.text}</p>)}</div>;
}
