import { useEffect, useState } from 'react';
import { canCastSpell, calculateTotalActions, validateAction, type CombatAction } from '@df/shared';
import { useCombatStore } from '../../store/useCombatStore';
import { useGameStore } from '../../store/useGameStore';
import { boardCommand } from '../../network/colyseusClient';

import { combatActionText, combatResultText } from './presentation';

export function CombatOverlay() {
  const store = useCombatStore(), game = useGameStore(), c = store.combat;
  const [menu, setMenu] = useState<'ATTACK' | 'DEFEND' | 'ITEM' | null>(null), [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => setMenu(null), [c.activeParticipantId, c.encounterId, store.selectedMonsterId]);
  const actor = store.participants.find(p => p.id === c.activeParticipantId);
  const awaitingAdmission = c.active && game.role === 'PLAYER' && !c.turnOrder.includes(game.playerId);
  const ownTurn = actor && (game.role === 'MASTER' ? actor.kind === 'MONSTER' && store.selectedMonsterId === actor.id && !actor.isAutoMode : actor.id === game.playerId);
  const disabled = !c.active || !ownTurn || c.isPaused || store.pending || now < store.busyUntil || game.connectionState !== 'CONNECTED';
  const side = game.role === 'MASTER' ? 'MONSTER' : 'PLAYER';
  const inspected = game.role === 'MASTER' ? store.participants.find(p => p.id === store.selectedMonsterId && p.kind === 'MONSTER') : actor;
  const showCommands = game.role !== 'MASTER' || !!ownTurn;
  const enemies = store.participants.filter(p => p.kind !== side);
  const chosen = store.participants.find(p => p.id === store.targetId && p.hp > 0);
  const enemy = chosen && chosen.kind !== actor?.kind ? chosen : enemies.find(p => p.hp > 0);
  const ally = chosen && chosen.kind === actor?.kind ? chosen : actor;
  const portrait = game.players.find(p => p.id === inspected?.id)?.portraitUrl;
  const allowed = (action: CombatAction) => !!actor && validateAction(action, c.actionIndex, actor.str, actor.int);
  function send(action: CombatAction) {
    if (disabled || !allowed(action)) return;
    useCombatStore.setState({ pending: true, busyUntil: Date.now() + 1200 });
    boardCommand(game.role === 'MASTER' ? 'MASTER_MANUAL_MONSTER_ACTION' : 'COMBAT_ACTION', { ...action, turnToken: c.turnToken });
    setMenu(null);
  }
  const last = store.events.at(-1);
  const recent = last && now + store.serverClockOffset < last.startedAt + last.duration + 500 ? last : undefined;
  const ownResult = recent?.targets.find(t => t.targetId === game.playerId) ?? (recent?.targetId === game.playerId ? recent : undefined);
  const ownImpact = (ownResult?.damage ?? 0) > 0;
  return <div className={`combat-overlay${ownImpact ? ' received-impact' : ''}`}>
    {ownImpact && recent && <div key={recent.id} className="combat-own-impact" aria-hidden="true"/>}
    <div className="combat-heading"><span className="eyebrow">Arena · {({ CAVE: 'Caverna', FOREST: 'Floresta', TAVERN: 'Taverna', DUNGEON: 'Masmorra' } as Record<string,string>)[c.biome] ?? c.biome}</span><h1>Rodada {c.round}</h1><p role="status">{!c.active ? 'Encontro encerrado' : awaitingAdmission ? 'Aguardando inclusão no combate pelo mestre.' : c.isPaused ? 'Combate pausado pelo Mestre' : game.role === 'MASTER' ? actor?.kind === 'PLAYER' ? `Observando turno de ${actor.name}` : ownTurn ? `Controlando: ${actor?.name}` : actor?.isAutoMode ? `IA controlando: ${actor.name}` : `Turno de ${actor?.name ?? '…'} · selecione a criatura para comandar` : ownTurn ? 'Seu turno. Escolha sua ação.' : `Turno de ${actor?.name ?? '…'}`}</p></div>
    <div className="combat-allies" aria-label={game.role === 'MASTER' ? 'Heróis e alvos de ataque' : 'Aliados e alvos de cura'}>{store.participants.filter(p => p.kind === 'PLAYER').map(p => {
      const player = game.players.find(a => a.id === p.id);
      return <button key={p.id} className={`combat-ally${recent && (recent.targetId === p.id || recent.targets.some(t => t.targetId === p.id)) ? ' combat-target-feedback' : ''}${c.activeParticipantId === p.id ? ' combat-acting' : ''}`} aria-pressed={store.targetId === p.id} disabled={p.hp <= 0} onClick={() => useCombatStore.setState({ targetId: p.id })}>
        {player?.portraitUrl && <img src={player.portraitUrl} alt=""/>}<span><strong>{p.name || player?.characterName}</strong><small>{p.hp}/{p.maxHp} HP · {p.mp} MP</small>{recent && (recent.targetId === p.id || recent.targets.some(t => t.targetId === p.id)) && <small key={recent.id} className="combat-card-result">{combatResultText({ ...recent, ...(recent.targets.find(t => t.targetId === p.id) ?? {}), targets: [] })}</small>}<meter aria-label={`HP de ${p.name}`} value={p.hp} max={p.maxHp}/></span>
      </button>;
    })}</div>
    <div className="combat-enemies" aria-label="Selecionar alvo">{enemies.map(p => <button key={p.id} disabled={p.hp <= 0} aria-pressed={store.targetId === p.id} onClick={() => useCombatStore.setState({ targetId: p.id })}>{p.name} <small>{p.hp}/{p.maxHp}</small></button>)}</div>
    {game.role === 'MASTER' && menu === 'DEFEND' && <div className="combat-support-targets" aria-label="Aliados monstros para suporte">{store.participants.filter(p => p.kind === 'MONSTER').map(p => <button key={p.id} disabled={p.hp <= 0} aria-pressed={store.targetId === p.id} onClick={() => useCombatStore.setState({ targetId: p.id })}>{p.name} · {p.hp}/{p.maxHp} HP</button>)}</div>}
    <div className="combat-dice-status" aria-live="polite">{last && <><p>{combatActionText(last)}</p><span>{last.rolls.map(r => `d${r.faces}: ${r.value}`).join(' · ')}</span><strong>{combatResultText(last)}</strong></>}</div>
    <div className="combat-bottom">
      <div className="active-portrait">{portrait ? <img src={portrait} alt={`Retrato de ${inspected?.name}`}/> : <span className="portrait-rune">✦</span>}<div><small>{game.role === 'MASTER' ? ownTurn ? 'CONTROLANDO' : 'INSPEÇÃO / ARBITRAGEM' : 'EM AÇÃO'}</small><strong>{inspected?.name ?? 'Selecione um monstro'}</strong>{inspected && <><span>{inspected.hp}/{inspected.maxHp} HP · {inspected.mp} MP</span><span>{inspected.id === actor?.id ? `${c.remainingActions} ação(ões)${c.actionIndex > 0 ? ` · ${calculateTotalActions(inspected.str, inspected.int).extraType === 'PHYSICAL_ONLY' ? 'Física extra' : 'Mágica extra'}` : ''}` : 'Aguardando seu turno'}</span></>}</div></div>
      {showCommands && <div className="combat-command-panel">
        {menu && <div className="combat-submenu" aria-label={menu === 'ATTACK' ? 'Tipos de ataque' : menu === 'DEFEND' ? 'Tipos de defesa' : 'Consumíveis'}>
          <button className="submenu-close" aria-label="Fechar opções" onClick={() => setMenu(null)}>×</button>
          {(actor?.actions ?? []).filter(option => menu === 'ATTACK' ? option.action.type === 'ATTACK' || option.action.type === 'SPELL' : option.action.type === menu).map((option, index) => {
            const spell = option.action.type === 'SPELL' ? actor?.spells.find(s => s.id === (option.action as Extract<CombatAction, {type:'SPELL'}>).spellId) : undefined;
            const friendly = option.action.type === 'ITEM' || option.action.type === 'DEFEND' || spell?.targetMode === 'SINGLE_ALLY';
            const target = friendly ? ally : enemy;
            const action: CombatAction = { ...option.action, ...('targetId' in option.action ? { targetId: target?.id ?? '' } : {}) };
            const focusReady = !spell || (!!actor && canCastSpell(actor.equipment, actor.mp, spell));
            return <button key={index} disabled={disabled || !target || !allowed(action) || (option.mpCost ?? 0) > (actor?.mp ?? 0) || !focusReady} onClick={() => send(action)}>{option.label}{option.mpCost ? <small>{option.mpCost} MP{!focusReady ? ' · requer foco' : ''}</small> : option.quantity !== undefined ? <small>x{option.quantity}</small> : null}</button>;
          })}
          <p>{menu === 'ATTACK' ? `Inimigo: ${enemy?.name ?? '…'} · Aliado: ${ally?.name ?? '…'}` : `Alvo: ${ally?.name ?? 'Escolha um alvo'}`}</p>
        </div>}
        <nav className="battle-dock" aria-label="Ações de combate">
          <button aria-label="Atacar" disabled={disabled} aria-expanded={menu === 'ATTACK'} onClick={() => setMenu(menu === 'ATTACK' ? null : 'ATTACK')}><span aria-hidden="true">⚔</span>Atacar</button>
          <button aria-label="Defender" disabled={disabled} aria-expanded={menu === 'DEFEND'} onClick={() => setMenu(menu === 'DEFEND' ? null : 'DEFEND')}><span aria-hidden="true">⛨</span>Defender</button>
          <button aria-label="Itens" disabled={disabled || c.actionIndex > 0 || !actor?.consumables.length} aria-expanded={menu === 'ITEM'} onClick={() => setMenu(menu === 'ITEM' ? null : 'ITEM')}><span aria-hidden="true">♜</span>Itens</button>
          <button aria-label="Fugir" disabled={disabled || c.fleeMode === 'BLOCKED' || !allowed({ type: 'FLEE' })} title={c.actionIndex > 0 ? 'Fuga proibida em ação extra' : c.fleeMode === 'BLOCKED' ? 'Fuga bloqueada pelo Mestre' : 'Tentar fugir'} onClick={() => send({ type: 'FLEE' })}><span aria-hidden="true">{c.fleeMode === 'BLOCKED' ? '🔒' : '➶'}</span>Fugir{c.fleeMode === 'GUARANTEED_100' && <small>100%</small>}</button>
        </nav>
      </div>}
    </div>
  </div>;
}
