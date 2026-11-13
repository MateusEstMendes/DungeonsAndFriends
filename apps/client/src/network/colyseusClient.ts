import { Client, type Room } from "@colyseus/sdk";
import { PROTOCOL_VERSION, RoomCodeSchema, SessionCredentialsPayloadSchema, type RoomState, type CharacterCreationPayload, type ApprovalStatus } from "@df/shared";
import { initialGameState, useGameStore } from "../store/useGameStore";
import { useUIStore } from "../store/useUIStore";

import { savedSession, persistCredentials, persistReconnectionToken, clearSession } from "./sessionPersistence";
export { savedSession } from "./sessionPersistence";

const client = new Client(import.meta.env.VITE_SERVER_URL || window.location.origin, {
  urlBuilder: url => {
    if (import.meta.env.DEV && !import.meta.env.VITE_SERVER_URL && url.protocol.startsWith("ws")) url.pathname = `/colyseus${url.pathname}`;
    return url.toString();
  },
});
let active: Room<unknown, RoomState> | undefined;
let heartbeat: ReturnType<typeof setInterval> | undefined;
let attempt = 0;
function screenFor(status: ApprovalStatus) {
  useGameStore.setState({ approvalStatus: status });
  useUIStore.setState({ screen: status === "PENDING_APPROVAL" || status === "REJECTED" ? "WAITING" : "ROOM" });
}
function attach(room: Room<unknown, RoomState>) {
  active = room;
  room.reconnection.maxRetries = 30;
  room.reconnection.minUptime = 0;
  room.reconnection.maxDelay = 3000;
  useGameStore.setState({ connectionState: "CONNECTED", roomCode: room.roomId });
  persistReconnectionToken(room.reconnectionToken);
  let lastPlayers = "";
  let networkErrorNotice: string | undefined;
  const sync = (state: RoomState) => {
    const players = Array.from(state.players.values(), player => ({ id: player.id, name: player.name, role: player.role, status: player.status, connected: player.connected, characterId:player.characterId, characterName:player.characterName, raceId:player.raceId, archetypeId:player.archetypeId, hp:player.hp, maxHp:player.maxHp, mp:player.mp, maxMp:player.maxMp, defense:player.defense, speed:player.speed, tokenUrl:player.tokenUrl, portraitUrl:player.portraitUrl }));
    const serialized = JSON.stringify(players);
    if (serialized !== lastPlayers) { lastPlayers = serialized; useGameStore.setState({ players }); }
    const own = state.players.get(useGameStore.getState().playerId);
    if (own) screenFor(own.status);
    if (useGameStore.getState().sessionStatus !== state.sessionStatus) useGameStore.setState({ sessionStatus: state.sessionStatus });
  };
  room.onStateChange(sync);
  room.onMessage("SESSION_CREDENTIALS", (input: unknown) => {
    const parsed = SessionCredentialsPayloadSchema.safeParse(input);
    if (!parsed.success) { useUIStore.getState().setNotice("Credenciais de sessão inválidas recebidas do servidor."); return; }
    const data = parsed.data;
    if (!persistCredentials(data)) useUIStore.getState().setNotice("Seu navegador não permitiu salvar a sessão. Evite fechar esta aba.");
    useGameStore.setState({ playerId: data.playerId, playerName: data.playerName, role: data.role });
    if (room.state?.players) sync(room.state);
  });
  room.onMessage("APPROVAL_RESULT", (status: ApprovalStatus) => screenFor(status));
  room.onMessage("ACTION_ERROR", (message: string) => useUIStore.getState().setNotice(message));
  room.onMessage("PING", (timestamp: number) => room.send("PONG", timestamp));
  let pingSent = 0;
  room.onMessage("PONG", (timestamp: number) => {
    if (timestamp === pingSent) useGameStore.setState({ latencyMs: Math.max(0, Date.now() - timestamp) });
  });
  const ping = () => { if (useGameStore.getState().connectionState === "CONNECTED") { pingSent = Date.now(); room.send("PING", pingSent); } };
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(ping, 20_000);
  ping();
  room.onDrop(() => useGameStore.setState({ connectionState: "RECONNECTING" }));
  room.onReconnect(() => {
    persistReconnectionToken(room.reconnectionToken);
    useGameStore.setState({ connectionState: "CONNECTED" });
    if (networkErrorNotice && useUIStore.getState().notice === networkErrorNotice) useUIStore.setState({ notice: "" });
    networkErrorNotice = undefined;
    ping();
  });
  room.onLeave(() => {
    if (active !== room) return;
    active = undefined;
    if (heartbeat) clearInterval(heartbeat);
    useGameStore.setState({ connectionState: "DISCONNECTED", latencyMs: null });
    useUIStore.setState({ screen: "LOBBY", notice: "Conexão encerrada. Você pode tentar continuar sua sessão." });
  });
  room.onError((_code, message) => {
    networkErrorNotice = message ?? "Erro de conexão.";
    useUIStore.getState().setNotice(networkErrorNotice);
  });
}
async function connect(action: () => Promise<Room<unknown, RoomState>>) {
  if (active || useGameStore.getState().connectionState === "CONNECTING") return;
  const currentAttempt = ++attempt;
  useUIStore.setState({ notice: "" });
  useGameStore.setState({ connectionState: "CONNECTING" });
  try {
    const room = await action();
    if (currentAttempt !== attempt) { await room.leave(); return; }
    attach(room);
  } catch (error) {
    if (currentAttempt !== attempt) return;
    useGameStore.setState({ connectionState: "DISCONNECTED" });
    useUIStore.setState({ screen: "LOBBY", notice: error instanceof Error ? error.message : "Não foi possível conectar." });
  }
}
export function joinPlayer(code: string, name: string) {
  return connect(() => client.joinById<RoomState>(RoomCodeSchema.parse(code), { name, clientVersion: PROTOCOL_VERSION }));
}
export function joinMaster(code: string, password: string) {
  return connect(() => client.joinById<RoomState>(RoomCodeSchema.parse(code), { password, clientVersion: PROTOCOL_VERSION }));
}
export function reconnectSaved() {
  return connect(async () => {
    const saved = savedSession();
    if (saved.reconnectionToken) {
      try { return await client.reconnect<RoomState>(saved.reconnectionToken); } catch { /* servidor reiniciou ou janela expirou */ }
    }
    if (!saved.sessionToken || !saved.roomCode) throw new Error("Não há sessão salva neste navegador.");
    return client.joinById<RoomState>(saved.roomCode, { name: saved.name || "Aventureiro", sessionToken: saved.sessionToken, clientVersion: PROTOCOL_VERSION });
  });
}
export async function leaveRoom(forget = false) {
  ++attempt;
  const room = active;
  active = undefined;
  if (heartbeat) clearInterval(heartbeat);
  if (forget) clearSession();
  useGameStore.setState({ ...initialGameState });
  useUIStore.setState({ screen: "LOBBY", notice: "" });
  await room?.leave();
}
export function decidePlayer(targetPlayerId: string, approve: boolean) { active?.send(approve ? "APPROVE_PLAYER" : "REJECT_PLAYER", { targetPlayerId }); }

export function submitCharacter(payload:CharacterCreationPayload):Promise<void> {
 const room=active;
 if(!room||useGameStore.getState().connectionState!=="CONNECTED")return Promise.reject(new Error("Aguarde a conexão com a sala."));
 return new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>finish(new Error("A confirmação demorou. Reconecte antes de tentar novamente.")),15000);
  const onState=(state:RoomState)=>{if(state.players.get(useGameStore.getState().playerId)?.status==="READY")finish();};
  room.onStateChange(onState);
  const offError=room.onMessage("ACTION_ERROR",(message:string)=>finish(new Error(message)));
  const onLeave=()=>finish(new Error("A conexão foi encerrada. Seu rascunho foi preservado."));
  room.onLeave(onLeave);
  function finish(error?:Error){clearTimeout(timeout);room?.onStateChange.remove(onState);offError();room?.onLeave.remove(onLeave);if(error)reject(error);else resolve();}
  try{room.send("SUBMIT_CHARACTER",payload);}catch(error){finish(error instanceof Error?error:new Error("Falha ao enviar ficha."));}
 });
}
