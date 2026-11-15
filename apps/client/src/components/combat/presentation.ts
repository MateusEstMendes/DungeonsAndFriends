import type { CombatEvent } from '@df/shared';

export function combatResultText(event: CombatEvent): string {
  if (event.outcome === 'MISSED_DEFENSE') return 'Errou: defesa do alvo';
  if (event.outcome === 'DODGED_ACTIVE') return 'Esquiva ativa!';
  if (event.outcome === 'DODGED_PASSIVE') return 'Esquiva passiva!';
  if (event.damage) return `${event.outcome === 'CRITICAL' ? 'Crítico! ' : ''}−${event.damage} HP${event.drAbsorbed ? ` · DR absorveu ${event.drAbsorbed}` : ''}`;
  if (event.healAmount || event.outcome === 'HEALED') return `Cura: +${event.healAmount ?? 0} HP`;
  if (event.outcome === 'FLED') return 'Fuga bem-sucedida!';
  if (event.outcome === 'FLEE_FAILED') return 'Fuga falhou';
  return event.outcome === 'PROTECTED' ? 'Proteção preparada' : 'Defesa preparada';
}
export function combatActionText(event: CombatEvent): string {
  const kind = event.actorKind === 'MONSTER' ? 'Monstro' : 'Herói';
  const verb = event.type === 'ATTACK' ? 'ataca' : event.outcome === 'HEALED' ? 'cura' : event.type === 'FLEE' ? 'tenta fugir' : 'defende';
  return `${kind} ${event.actorName} ${verb}${event.type === 'FLEE' ? '' : ` ${event.targetName}`}`;
}
