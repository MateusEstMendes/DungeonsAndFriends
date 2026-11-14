import { useEffect, useState } from 'react';
import { calculateTotalActions, MAGICAL_ATTACKS, PHYSICAL_ATTACKS, validateAction, type CombatAction, type AttackType } from '@df/shared';
import { useCombatStore } from '../../store/useCombatStore';
import { useGameStore } from '../../store/useGameStore';
import { boardCommand } from '../../network/colyseusClient';

const names: Record<string, string> = { SLASHING: 'Corte', BLUNT: 'Impacto', THRUST: 'Perfuração', UNARMED: 'Desarmado',
  WARRIOR: 'Golpe Avassalador', BARBARIAN: 'Fúria Berserk', ROGUE: 'Ataque Furtivo', FIRE: 'Fogo', ICE: 'Gelo', LIGHT: 'Luz', DARKNESS: 'Trevas', ARCANE: 'Arcano' };
export function CombatOverlay() {
  const store = useCombatStore(), game = useGameStore(), c = store.combat;
  const [menu, setMenu] = useState<'ATTACK' | 'DEFEND' | 'ITEM' | null>(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => setMenu(null), [c.activeParticipantId, c.encounterId]);
  const actor = store.participants.find(p => p.id === c.activeParticipantId);
  const ownTurn = actor && (game.role === 'MASTER' ? actor.kind === 'MONSTER' && store.manualMonsterId === actor.id : actor.id === game.playerId);
  const disabled = !c.active || !ownTurn || c.isPaused || store.pending || now < store.busyUntil || game.connectionState !== 'CONNECTED';
  const side = game.role === 'MASTER' && actor?.kind === 'MONSTER' && store.manualMonsterId === actor.id ? 'MONSTER' : 'PLAYER';
  const enemies = store.participants.filter(p => p.kind !== side);
  const chosen = store.participants.find(p => p.id === store.targetId && p.hp > 0);
  const enemy = chosen && chosen.kind !== actor?.kind ? chosen : enemies.find(p => p.hp > 0);
  const ally = chosen && chosen.kind === actor?.kind ? chosen : actor;
  const portrait = game.players.find(p => p.id === actor?.id)?.portraitUrl;
  const allowed = (action: CombatAction) => !!actor && validateAction(action, c.actionIndex, actor.str, actor.int);
  function send(action: CombatAction) {
    if (disabled || !allowed(action)) return;
    useCombatStore.setState({ pending: true, busyUntil: Date.now() + 1200 });
    boardCommand(game.role === 'MASTER' ? 'MASTER_MANUAL_MONSTER_ACTION' : 'COMBAT_ACTION', { ...action, turnToken: c.turnToken });
    setMenu(null);
  }
  const last = store.events.at(-1);
  return <div className="combat-overlay">
    <div className="combat-heading"><span className="eyebrow">Arena · {({ CAVE: 'Caverna', FOREST: 'Floresta', TAVERN: 'Taverna', DUNGEON: 'Masmorra' } as Record<string,string>)[c.biome] ?? c.biome}</span><h1>Rodada {c.round}</h1><p role="status">{!c.active ? 'Encontro encerrado' : c.isPaused ? 'Combate pausado pelo Mestre' : ownTurn ? 'Seu turno. Escolha sua ação.' : `Turno de ${actor?.name ?? '…'}`}</p></div>
    <div className="combat-allies" aria-label="Aliados e alvos de cura">{store.participants.filter(p => p.kind === 'PLAYER').map(p => {
      const player = game.players.find(a => a.id === p.id);
      return <button key={p.id} className="combat-ally" aria-pressed={store.targetId === p.id} disabled={p.hp <= 0} onClick={() => useCombatStore.setState({ targetId: p.id })}>
        {player?.portraitUrl && <img src={player.portraitUrl} alt=""/>}<span><strong>{p.name || player?.characterName}</strong><small>{p.hp}/{p.maxHp} HP · {p.mp} MP</small><meter aria-label={`HP de ${p.name}`} value={p.hp} max={p.maxHp}/></span>
      </button>;
    })}</div>
    <div className="combat-enemies" aria-label="Selecionar alvo">{enemies.map(p => <button key={p.id} disabled={p.hp <= 0} aria-pressed={store.targetId === p.id} onClick={() => useCombatStore.setState({ targetId: p.id })}>{p.name} <small>{p.hp}/{p.maxHp}</small></button>)}</div>
    <div className="combat-dice-status" aria-live="polite">{last && <><span>{last.rolls.map(r => `d${r.faces}: ${r.value}`).join(' · ')}</span><strong>{last.outcome?.startsWith('DODGED') ? 'Esquivou!' : last.damage ? `${last.outcome === 'CRITICAL' ? 'Crítico! ' : ''}−${last.damage} HP${last.drAbsorbed ? ` · DR absorveu ${last.drAbsorbed}` : ''}` : last.outcome === 'FLED' ? 'Fuga bem-sucedida!' : last.outcome === 'FLEE_FAILED' ? 'Fuga falhou' : last.healAmount ? `+${last.healAmount} HP` : 'Defesa preparada'}</strong></>}</div>
    <div className="combat-bottom">
      <div className="active-portrait">{portrait ? <img src={portrait} alt={`Retrato de ${actor?.name}`}/> : <span className="portrait-rune">✦</span>}<div><small>EM AÇÃO</small><strong>{actor?.name}</strong><span>{actor?.hp}/{actor?.maxHp} HP · {actor?.mp} MP</span><span>{c.remainingActions} ação(ões){c.actionIndex > 0 && actor ? ` · ${calculateTotalActions(actor.str, actor.int).extraType === 'PHYSICAL_ONLY' ? 'Física extra' : 'Mágica extra'}` : ''}</span></div></div>
      <div className="combat-command-panel">
        {menu && <div className="combat-submenu" aria-label={menu === 'ATTACK' ? 'Tipos de ataque' : menu === 'DEFEND' ? 'Tipos de defesa' : 'Consumíveis'}>
          <button className="submenu-close" aria-label="Fechar opções" onClick={() => setMenu(null)}>×</button>
          {menu === 'ATTACK' && [...PHYSICAL_ATTACKS, ...MAGICAL_ATTACKS].filter(type => !['WARRIOR','BARBARIAN','ROGUE'].includes(type) || type === actor?.archetypeId).map(type => {
            const action: CombatAction = { type: 'ATTACK', subType: type as AttackType, targetId: enemy?.id ?? '' };
            const magic = (MAGICAL_ATTACKS as readonly string[]).includes(type);
            return <button key={type} disabled={disabled || !enemy || !allowed(action) || (magic && (actor?.mp ?? 0) < 10) || (actor?.cooldowns[type] ?? 0) > c.round} onClick={() => send(action)}>{names[type]}{magic && <small>10 MP</small>}</button>;
          })}
          {menu === 'DEFEND' && ([['ACTIVE_DODGE','Esquiva Ativa'],['SHIELD_BLOCK','Bloqueio de Escudo'],['HEAL','Cura · 10 MP'],['PROTECT','Proteção · 10 MP']] as const).map(([subType,label]) => {
            const magic = subType === 'HEAL' || subType === 'PROTECT';
            const action: CombatAction = { type: 'DEFEND', subType, targetId: magic ? ally?.id : actor?.id };
            return <button key={subType} disabled={disabled || !allowed(action) || (magic && (actor?.mp ?? 0) < 10)} onClick={() => send(action)}>{label}</button>;
          })}
          {menu === 'ITEM' && <button disabled={disabled || !actor?.potions || !allowed({ type: 'ITEM', itemId: 'HEALTH_POTION', targetId: ally?.id ?? '' })} onClick={() => send({ type: 'ITEM', itemId: 'HEALTH_POTION', targetId: ally?.id ?? '' })}>Poção de vida · +25 HP <small>{actor?.potions ?? 0} restante(s)</small></button>}
          <p>Alvo: {(menu === 'ATTACK' ? enemy : ally)?.name ?? 'Escolha um alvo'}</p>
        </div>}
        <nav className="battle-dock" aria-label="Ações de combate">
          <button aria-label="Atacar" disabled={disabled} aria-expanded={menu === 'ATTACK'} onClick={() => setMenu(menu === 'ATTACK' ? null : 'ATTACK')}><span aria-hidden="true">⚔</span>Atacar</button>
          <button aria-label="Defender" disabled={disabled} aria-expanded={menu === 'DEFEND'} onClick={() => setMenu(menu === 'DEFEND' ? null : 'DEFEND')}><span aria-hidden="true">⛨</span>Defender</button>
          <button aria-label="Itens" disabled={disabled || c.actionIndex > 0} aria-expanded={menu === 'ITEM'} onClick={() => setMenu(menu === 'ITEM' ? null : 'ITEM')}><span aria-hidden="true">♜</span>Itens</button>
          <button aria-label="Fugir" disabled={disabled || c.fleeMode === 'BLOCKED' || !allowed({ type: 'FLEE' })} title={c.actionIndex > 0 ? 'Fuga proibida em ação extra' : c.fleeMode === 'BLOCKED' ? 'Fuga bloqueada pelo Mestre' : 'Tentar fugir'} onClick={() => send({ type: 'FLEE' })}><span aria-hidden="true">{c.fleeMode === 'BLOCKED' ? '🔒' : '➶'}</span>Fugir{c.fleeMode === 'GUARANTEED_100' && <small>100%</small>}</button>
        </nav>
      </div>
    </div>
    <details className="combat-log"><summary>Histórico do encontro</summary><ol>{store.events.slice(-10).map(e => <li key={e.id}>Rodada {e.round} · {store.participants.find(p => p.id === e.actorId)?.name} · {e.vfxType ? names[e.vfxType] : e.type} · {e.outcome} {e.damage ? `−${e.damage} HP` : ''}{e.drAbsorbed ? ` (DR ${e.drAbsorbed})` : ''}</li>)}</ol></details>
  </div>;
}
