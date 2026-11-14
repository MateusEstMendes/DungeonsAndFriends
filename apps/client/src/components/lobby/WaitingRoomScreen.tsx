import { leaveRoom } from "../../network/colyseusClient";
import { useGameStore } from "../../store/useGameStore";
export function WaitingRoomScreen() {
  const name = useGameStore(state => state.playerName);
  const code = useGameStore(state => state.roomCode);
  const hasCharacter = useGameStore(state => Boolean(state.players.find(p => p.id === state.playerId)?.characterId));
  const rejected = useGameStore(state => state.approvalStatus === "REJECTED");
  return <section className="panel waiting"><span className="eyebrow">Sala {code}</span>
    <div className={rejected ? "sigil" : "sigil breathing"} aria-hidden="true">✦</div>
    <h1>{rejected ? "Entrada recusada" : "Sua aventura está próxima"}</h1>
    <p role="status">{rejected ? `${name}, o Mestre recusou este pedido de entrada.` : `${name}, aguardando aprovação do Mestre…`}</p>
    <p className="muted">{rejected ? "Converse com o Mestre antes de enviar um novo pedido." : "Você entrará assim que o Mestre aprovar seu pedido."}</p>
    <button onClick={() => void leaveRoom(!hasCharacter)}>{rejected ? "Voltar ao início" : "Cancelar pedido"}</button>
  </section>;
}
