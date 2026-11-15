import { crossfadeBgm } from "../audio/soundManager";
import { useEffect, useRef, useState } from "react";
import { PixiApp } from "../game/PixiApp";
import { BoardScene } from "../game/scenes/BoardScene";
import { CombatPOVScene } from '../game/scenes/CombatPOVScene';
import { useCombatStore } from '../store/useCombatStore';
import { CombatOverlay } from './combat/CombatOverlay';
import { MasterRefereeBar } from './combat/MasterRefereeBar';
import { boardCommand } from '../network/colyseusClient';
import './combat/combat.css';
import { useGameStore } from "../store/useGameStore";
import { useBoardStore } from "../store/useBoardStore";
import { leaveRoom } from "../network/colyseusClient";
import { BoardEditor } from "./master/BoardEditor";
import { AdventureHUD } from "./hud/AdventureHUD";
import { PlayerHUD } from "./hud/PlayerHUD";
import "./board.css";
export function BoardScreen() {
  const host = useRef<HTMLDivElement>(null), [error, setError] = useState("");
  const game = useGameStore(), board = useBoardStore();
  const { combat, proximity } = useCombatStore();
  const own = game.players.find(p => p.id === game.playerId);
  const participating = combat.active && (game.role === 'MASTER' || (!own?.awaitingPosition && own?.currentChamberId === combat.chamberId));
  useEffect(() => { crossfadeBgm(participating ? 'bgm_combat_pov' : 'bgm_exploration'); }, [participating]);
  useEffect(() => () => crossfadeBgm(undefined), []);
  const [arena, setArena] = useState(participating);
  useEffect(() => {
    if (participating) { setArena(true); return; }
    const timeout = setTimeout(() => setArena(false), 1600); return () => clearTimeout(timeout);
  }, [participating]);
  const chamberId = game.role === "MASTER" ? board.focusChamberId || board.chambers.find(c => c.mapId === board.activeStageId)?.id : own?.currentChamberId;
  const chamber = board.chambers.find(c => c.id === chamberId);
  useEffect(() => {
    const pixi = new PixiApp(); let scene: BoardScene | CombatPOVScene | undefined, cancelled = false;
    void pixi.init(host.current!).then(ready => { if (ready && !cancelled) scene = arena ? new CombatPOVScene(pixi.app, host.current!) : new BoardScene(pixi.app, host.current!); }).catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao abrir tabuleiro."); });
    return () => { cancelled = true; scene?.destroy(); pixi.destroy(); };
  }, [arena]);
  return <section className={`board-screen${arena ? ' combat-screen' : ''}`} aria-label={arena ? 'Arena de combate' : 'Mesa de aventura'}>
    <div ref={host} className="board-canvas"/>
    {own?.awaitingPosition && <div className="board-error board-glass" role="status">Aguardando posicionamento pelo mestre. Não há casa livre na sua câmara.</div>}
    {error && <div className="board-error board-glass" role="alert">Não foi possível iniciar o tabuleiro: {error}. Recarregue a página e verifique a aceleração gráfica do navegador.</div>}
    <AdventureHUD chamberId={arena ? combat.chamberId : chamberId} arena={arena}/>
    {arena ? <><CombatOverlay/><MasterRefereeBar/></> : <>
    <div className="chamber-title board-glass"><span className="eyebrow">Masmorra de Treinamento · {game.role === "MASTER" ? "Mestre" : "Aventura"}</span><h1>{chamber?.name || "Preparando câmara…"}</h1><small>{game.role === "MASTER" ? "Todas as entidades visíveis ao Mestre" : "Visão compartilhada · 4 hexágonos"}</small></div>
    {game.role === "MASTER" ? <BoardEditor/> : <PlayerHUD/>}
    <div className="board-controls board-glass"><button onClick={() => useBoardStore.setState(s => ({ focusRevision: s.focusRevision + 1 }))}>Centralizar</button><button aria-pressed={board.debug} title="Ctrl+Shift+D" onClick={() => useBoardStore.setState(s => ({ debug: !s.debug }))}>Debug</button><button onClick={() => void leaveRoom()}>Sair</button></div>
    {game.role === "MASTER" && <details className="board-invite board-glass"><summary>Convidar aventureiros · Sala {game.roomCode}</summary><label>Link da sala<input readOnly value={`${location.origin}/?room=${game.roomCode}`} onFocus={e => e.target.select()}/></label><p>Aprove novos jogadores na fila do cabeçalho.</p></details>}
    <span className="board-help">Arraste para explorar · Role ou use dois dedos para ampliar</span>
    {game.role === 'MASTER' && <div className="proximity-alert board-glass"><span role="status">{proximity?.message ?? 'Preparar encontro nesta câmara'}</span><button onClick={() => { boardCommand('START_COMBAT', { chamberId: proximity?.chamberId ?? chamberId }); useCombatStore.setState({ proximity: null }); }}>Iniciar Combate</button></div>}
    </>}
  </section>;
}
