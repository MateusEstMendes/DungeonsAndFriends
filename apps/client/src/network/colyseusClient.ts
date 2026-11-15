import type { CharacterCreationPayload } from '@df/shared';
import { useUIStore } from '../store/useUIStore';
export { savedSession } from './sessionStorage';
type Runtime = typeof import('./colyseusRuntime');
let runtime: Runtime | undefined;
let loading: Promise<Runtime> | undefined;
function loadRuntime() {
  return loading ??= import('./colyseusRuntime').then(module => runtime = module).catch(error => { loading = undefined; throw error; });
}
async function connect(action: (module: Runtime) => Promise<void>) {
  try { await action(await loadRuntime()); }
  catch (error) { useUIStore.getState().setNotice(error instanceof Error ? error.message : 'Não foi possível carregar a conexão.'); }
}
export function joinPlayer(code: string, name: string) { return connect(module => module.joinPlayer(code, name)); }
export function joinMaster(code: string, password: string) { return connect(module => module.joinMaster(code, password)); }
export function reconnectSaved() { return connect(module => module.reconnectSaved()); }
export async function leaveRoom(forget = false) { return (await loadRuntime()).leaveRoom(forget); }
export function decidePlayer(targetPlayerId: string, approve: boolean) { runtime?.decidePlayer(targetPlayerId, approve); }
export function boardCommand(type: string, payload?: unknown) { runtime?.boardCommand(type, payload); }
export async function submitCharacter(payload: CharacterCreationPayload) { return (await loadRuntime()).submitCharacter(payload); }
