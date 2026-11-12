import { decidePlayer } from "../../network/colyseusClient";
import { useGameStore } from "../../store/useGameStore";
import { useUIStore } from "../../store/useUIStore";
export function ApprovalQueuePopover() {
  const players = useGameStore(state => state.players);
  const pending = players.filter(player => player.role === "PLAYER" && player.status === "PENDING_APPROVAL");
  const open = useUIStore(state => state.queueOpen);
  const connected = useGameStore(state => state.connectionState === "CONNECTED");
  return <div className="queue"><button className={pending.length ? "queue-badge breathing" : "queue-badge"} aria-expanded={open} aria-controls="approval-queue" onClick={() => useUIStore.setState({ queueOpen: !open })}>Pedidos <span aria-live="polite">{pending.length}</span></button>
    {open && <section id="approval-queue" className="popover"><h2>Fila de aventureiros</h2>{pending.length === 0 ? <p className="muted">Nenhum pedido pendente.</p> : <ul>{pending.map(player => <li key={player.id}><strong>{player.name}</strong><small>{player.connected ? "Conectado" : "Reconectando…"}</small><div className="actions"><button disabled={!connected} onClick={() => decidePlayer(player.id, true)}>Aprovar</button><button className="danger" disabled={!connected} onClick={() => decidePlayer(player.id, false)}>Recusar</button></div></li>)}</ul>}</section>}
  </div>;
}
