import { validateAction, type CombatAction, type CombatParticipant } from '@df/shared';
export interface TacticalContext { monster: CombatParticipant; participants: readonly CombatParticipant[]; actionIndex: number; fleeBlocked: boolean }
/** Pure JRPG decisions. Position and hex distance have no role during an encounter. */
export function decideMonsterAction({ monster, participants, actionIndex, fleeBlocked }: TacticalContext): CombatAction | null {
  const enemies = participants.filter(p => !p.absent && p.hp > 0 && p.kind !== monster.kind).sort((a, b) => a.hp - b.hp || a.id.localeCompare(b.id));
  const allies = participants.filter(p => !p.absent && p.hp > 0 && p.kind === monster.kind).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || a.id.localeCompare(b.id));
  const options = monster.actions.filter(o => (o.mpCost ?? 0) <= monster.mp && validateAction(o.action, actionIndex, monster.str, monster.int));
  const flee = options.find(o => o.action.type === 'FLEE');
  if (monster.allowAutoFlee && !fleeBlocked && monster.hp < monster.maxHp * .2 && flee) return flee.action;
  const wounded = allies.find(p => p.hp < p.maxHp * .4);
  if (wounded) {
    const heal = options.find(o => o.action.type === 'DEFEND' && o.action.subType === 'HEAL');
    if (heal?.action.type === 'DEFEND') return { ...heal.action, targetId: wounded.id };
  }
  const protection = options.find(o => o.action.type === 'DEFEND' && o.action.subType === 'PROTECT');
  if (protection?.action.type === 'DEFEND' && allies[0] && allies[0].hp < allies[0].maxHp * .65 && allies[0].stance !== 'SHIELD_BLOCK') return { ...protection.action, targetId: allies[0].id };
  if (enemies[0]) {
    const attack = options.find(o => o.action.type === 'ATTACK');
    if (attack?.action.type === 'ATTACK') return { ...attack.action, targetId: enemies[0].id };
  }
  return options.find(o => o.action.type === 'DEFEND' && o.action.subType === 'ACTIVE_DODGE')?.action ?? null;
}
