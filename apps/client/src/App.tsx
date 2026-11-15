import { RecoveryModal } from "./components/master/RecoveryModal";
import { boardCommand } from "./network/colyseusClient";
import { PROTOCOL_VERSION } from "@df/shared";
import { PwaUpdatePrompt } from "./components/PwaUpdatePrompt";
import { AudioSettings } from "./components/AudioSettings";
import { initializeAudio } from "./audio/soundManager";
import { useEffect } from "react";
import { lazy, Suspense } from "react";
const CharacterCreatorScreen = lazy(() => import("./components/character/CharacterCreatorScreen").then(module => ({ default: module.CharacterCreatorScreen })));
const BoardScreen = lazy(() => import("./components/BoardScreen").then(module => ({ default: module.BoardScreen })));
import { LobbyScreen } from "./components/lobby/LobbyScreen";
import { WaitingRoomScreen } from "./components/lobby/WaitingRoomScreen";
import { ApprovalQueuePopover } from "./components/master/ApprovalQueuePopover";
import { CharacterRoster } from "./components/master/CharacterRoster";
import { leaveRoom } from "./network/colyseusClient";
import { useGameStore } from "./store/useGameStore";
import { useUIStore } from "./store/useUIStore";
export function App() {
  useEffect(initializeAudio, []);
  const screen = useUIStore(state => state.screen);
  const own = useGameStore(state => state.players.find(p => p.id === state.playerId));
  const notice = useUIStore(state => state.notice);
  return <main>
    {screen !== "LOBBY" && <ConnectionBar/>}
    {notice && <div className="notice" role="alert"><span>{notice}</span><button aria-label="Fechar aviso" onClick={() => useUIStore.setState({ notice: "" })}>×</button></div>}
    {screen === "LOBBY" ? <LobbyScreen/> : screen === "WAITING" ? <WaitingRoomScreen/> : own?.status === "NEEDS_CHARACTER_CREATION" && !own.characterId ? <Suspense fallback={<p role="status">Preparando criação de personagem…</p>}><CharacterCreatorScreen key={own.id}/></Suspense> : own?.role === "MASTER" || own?.status === "READY" ? <Suspense fallback={<p role="status">Preparando tabuleiro…</p>}><BoardScreen/></Suspense> : <RoomScreen/>}
    <RecoveryModal/>
    <PwaUpdatePrompt/>
    <footer>Dungeons & Friends · v{PROTOCOL_VERSION}</footer>
  </main>;
}
function ConnectionBar() {
  const roomCode = useGameStore(state => state.roomCode);
  const role = useGameStore(state => state.role);
  const connectionState = useGameStore(state => state.connectionState);
  const latencyMs = useGameStore(state => state.latencyMs);
  const connectionLabels = { DISCONNECTED: "Desconectado", CONNECTING: "Conectando…", CONNECTED: "Conectado", RECONNECTING: "Reconectando…" };
  return <header className="topbar"><span>✦ Sala <strong>{roomCode}</strong></span><span role="status">{connectionLabels[connectionState]} {latencyMs !== null && `· ${latencyMs} ms`}</span><AudioSettings/>{role === "MASTER" && <><CharacterRoster/><ApprovalQueuePopover/><button onClick={() => { if (window.confirm("Encerrar esta sessão e seu combate? As fichas e os itens serão preservados.")) boardCommand("MASTER_CLOSE_SESSION"); }}>Encerrar Sessão</button></>}</header>;
}
function RoomScreen() {
  const role = useGameStore(state => state.role);
  const roomCode = useGameStore(state => state.roomCode);
  const playerName = useGameStore(state => state.playerName);
  const players = useGameStore(state => state.players);
  const game = { role, roomCode, playerName, players };
  return <section className="panel room">
      <span className="eyebrow">{game.role === "MASTER" ? "Mesa do Mestre" : "Entrada aprovada"}</span>
      <h1>{game.role === "MASTER" ? "Sua mesa está pronta" : `Bem-vindo, ${game.playerName}`}</h1>
      <p className="muted">{game.role === "MASTER" ? "Compartilhe o convite e aprove os aventureiros na fila de pedidos." : "Sua ficha está pronta. Aguarde o Mestre para começar a aventura."}</p>
      {game.role === "MASTER" && <div className="invite"><label>Convite da sala<input readOnly value={`${location.origin}/?room=${game.roomCode}`} onFocus={event => event.target.select()}/></label><button onClick={() => { void navigator.clipboard?.writeText(`${location.origin}/?room=${game.roomCode}`).then(() => useUIStore.getState().setNotice("Convite copiado.")).catch(() => useUIStore.getState().setNotice("Selecione e copie o convite acima.")); }}>Copiar convite</button></div>}
      <h2>Aventureiros na mesa</h2><ul className="roster">{game.players.filter(player => player.status !== "REJECTED" && (player.connected || player.reconnecting)).map(player => <li key={player.id}><span className={player.connected ? "dot online" : "dot"}/><strong>{player.characterName || player.name}</strong>{player.tokenUrl && <img src={player.tokenUrl} alt={`Token de ${player.characterName}`} width={48} height={48}/> }<small>{player.role === "MASTER" ? "Mestre" : player.status === "PENDING_APPROVAL" ? "Aguardando aprovação" : player.status === "READY" ? "Ficha pronta" : "Criando personagem"} · {player.connected ? "Online" : "Offline"}</small></li>)}</ul>
      <button onClick={() => void leaveRoom()}>Sair da sala</button>
    </section>;
}
