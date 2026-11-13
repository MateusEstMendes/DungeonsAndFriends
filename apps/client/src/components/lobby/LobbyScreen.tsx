import { useEffect, useState, type FormEvent } from "react";
import { joinMaster, joinPlayer, reconnectSaved, savedSession, leaveRoom } from "../../network/colyseusClient";
import { useGameStore } from "../../store/useGameStore";

export function LobbyScreen() {
  const [saved, setSaved] = useState(savedSession);
  const [code, setCode] = useState(() => new URLSearchParams(location.search).get("room")?.toUpperCase().slice(0, 5) ?? "");
  const [hostCode, setHostCode] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [playerOpen, setPlayerOpen] = useState(Boolean(code));
  const busy = useGameStore(state => state.connectionState === "CONNECTING");
  useEffect(() => { const controller = new AbortController(); fetch("/api/host-info", { signal: controller.signal }).then(response => response.json()).then((info: { roomCode: string }) => setHostCode(info.roomCode)).catch(() => {}); return () => controller.abort(); }, []);
  function enterPlayer(event: FormEvent) { event.preventDefault(); void joinPlayer(code, name); }
  function enterMaster(event: FormEvent) { event.preventDefault(); void joinMaster(code || hostCode, password).then(() => setPassword("")); }
  return <section className="panel lobby">
    <span className="eyebrow">Uma mesa. Muitas histórias.</span>
    <h1>Dungeons <span>&</span> Friends</h1>
    <p className="muted">Reúna seus aventureiros. A próxima história começa aqui.</p>
    {saved.sessionToken && <aside className="resume"><p>Uma aventura espera por você</p><strong>{saved.name || "Aventureiro"} · Sala {saved.roomCode}</strong><button disabled={busy} onClick={() => void reconnectSaved()}>Continuar sessão</button><button disabled={busy} onClick={() => { void leaveRoom(true).then(() => setSaved(savedSession())); }}>Esquecer sessão neste navegador</button></aside>}
    <button className="primary" disabled={busy} onClick={() => setPlayerOpen(value => !value)} aria-expanded={playerOpen}>Sou Jogador</button>
    {playerOpen && <form onSubmit={enterPlayer}>
      <label>Código da sala<input required pattern="[A-HJ-NP-Z2-9]{5}" maxLength={5} value={code} onChange={event => setCode(event.target.value.toUpperCase().replace(/[^A-Z2-9]/g, ""))} placeholder="ABCDE" autoCapitalize="characters" autoComplete="off" spellCheck={false}/></label>
      <label>Nome do aventureiro<input required maxLength={40} value={name} onChange={event => setName(event.target.value)} placeholder="Como devemos chamar você?" autoComplete="nickname"/></label>
      <button className="primary" disabled={busy || code.length !== 5 || !name.trim()}>{busy ? "Conectando…" : "Pedir para entrar"}</button>
    </form>}
    <details className="master-access"><summary>Acesso do Mestre</summary><form onSubmit={enterMaster}>
      <p className="muted">Use a senha padrão do projeto ou a senha definida pelo host.</p>
      <label>Senha do Mestre<input type="password" required maxLength={256} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password"/></label>
      <button disabled={busy || !(code || hostCode)}>{busy ? "Conectando…" : "Entrar como Mestre"}</button>
    </form></details>
    <small className="muted">v0.3.0 · Sem cadastro</small>
  </section>;
}
