import { useEffect, useState } from "react";
import { boardCommand } from "../../network/colyseusClient";
import { useGameStore } from "../../store/useGameStore";
import { useBoardStore } from "../../store/useBoardStore";
export function PlayerHUD() {
  const own = useGameStore(s => s.players.find(p => p.id === s.playerId));
  const mode = useBoardStore(s => s.explorationMode);
  const [now, setNow] = useState(Date.now()), [q, setQ] = useState("0"), [r, setR] = useState("0");
  useEffect(() => { const interval = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(interval); }, []);
  if (!own || own.awaitingPosition) return null;
  const seconds = Math.max(0, Math.ceil((own.moveCooldownEndsAt - now) / 1000));
  const steps = seconds === 0 && own.remainingSteps === 0 ? own.speed : own.remainingSteps;
  return <>
    <div className="movement-hud board-glass">
      <div className="cooldown" role="timer" aria-label={seconds ? `Movimento disponível em ${seconds} segundos` : "Movimento disponível"} style={{ background: `conic-gradient(#d9b66b ${seconds / (mode === "FREE_EXPLORATION" ? 1 : 30) * 360}deg, #49414e 0)` }}><span>{seconds || "✓"}</span></div>
      <div><strong>{mode === "FREE_EXPLORATION" ? "Exploração livre" : "Exploração tensa"}</strong><small>{seconds ? `Aguarde ${seconds}s` : mode === "FREE_EXPLORATION" ? "Caminho livre" : `${steps} de ${own.speed} passos disponíveis`}</small></div>
      <button disabled={seconds > 0} onClick={() => boardCommand("END_MOVEMENT")}>Encerrar passo</button>
    </div>
    <section className="vitals-hud board-glass" aria-label="Seu personagem">
      {own.tokenUrl && <img src={own.tokenUrl} width={56} height={56} alt=""/>}
      <div><strong>{own.characterName}</strong><label>HP {own.hp}/{own.maxHp}<meter min={0} max={own.maxHp || 1} value={own.hp}/></label><label>MP {own.mp}/{own.maxMp}<meter min={0} max={own.maxMp || 1} value={own.mp}/></label></div>
      <small>Hexágono ({own.q}, {own.r})</small>
      <details><summary>Mover por coordenadas</summary><form className="coordinate-form" onSubmit={e => { e.preventDefault(); boardCommand("REQUEST_MOVE", { targetQ: Number(q), targetR: Number(r), revision: own.moveRevision }); }}><label>q<input type="number" min={-200} max={200} required value={q} onChange={e => setQ(e.target.value)}/></label><label>r<input type="number" min={-200} max={200} required value={r} onChange={e => setR(e.target.value)}/></label><button disabled={seconds > 0}>Mover</button></form></details>
    </section>
  </>;
}
