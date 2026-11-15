import type { CombatEvent } from '@df/shared';

export function combatResultText(event: CombatEvent): string {
  if (event.targets.length > 1) return event.targets.map(t => `${t.targetName}: ${combatResultText({ ...event, ...t, targets: [] })}`).join(' · ');
  if (event.outcome === 'MISSED_DEFENSE') return 'Errou: defesa do alvo';
  if (event.outcome === 'DODGED_ACTIVE') return 'Esquiva ativa!';
  if (event.outcome === 'DODGED_PASSIVE') return 'Esquiva passiva!';
  if (event.outcome === 'MANA_RESTORED') return `Mana: +${event.healAmount ?? 0} MP`;
  if (event.outcome === 'CURED') return 'Veneno removido';
  if (event.outcome === 'BUFFED') return 'Bônus aplicado';
  if (event.outcome === 'PASSED') return event.reason ?? 'Turno passado';
  if (event.outcome === 'POISONED') return `Veneno: −${event.damage} HP`;
  if (event.damage) return `${event.outcome === 'CRITICAL' ? 'Crítico! ' : ''}−${event.damage} HP${event.drAbsorbed ? ` · DR absorveu ${event.drAbsorbed}` : ''}`;
  if (event.healAmount || event.outcome === 'HEALED') return `Cura: +${event.healAmount ?? 0} HP`;
  if (event.outcome === 'FLED') return 'Fuga bem-sucedida!';
  if (event.outcome === 'FLEE_FAILED') return 'Fuga falhou';
  return event.outcome === 'PROTECTED' ? 'Proteção preparada' : 'Defesa preparada';
}
export function combatActionText(event: CombatEvent): string {
  const kind = event.actorKind === 'MONSTER' ? 'Monstro' : 'Herói';
  const verb = event.type === 'STATUS' ? 'sofre veneno' : event.type === 'PASS' ? 'passa o turno' : event.type === 'ITEM' ? 'usa item em' : event.type === 'SPELL' ? (event.outcome === 'HEALED' ? 'cura' : 'conjura em') : event.type === 'ATTACK' ? 'ataca' : event.outcome === 'HEALED' ? 'cura' : event.type === 'FLEE' ? 'tenta fugir' : 'defende';
  return `${kind} ${event.actorName} ${verb}${['FLEE','STATUS','PASS'].includes(event.type) ? '' : ` ${event.targetName}`}`;
}

/** Compact plate labels; full audit text remains in the status and session log. */
export function combatFloatingText(event: CombatEvent): string {
  if (event.outcome === 'MISSED_DEFENSE') return 'Errou!';
  if (event.outcome?.startsWith('DODGED')) return 'Esquivou!';
  if (event.damage) return `${event.outcome === 'CRITICAL' ? 'Crítico! ' : ''}−${event.damage}`;
  if (event.outcome === 'MANA_RESTORED') return `+${event.healAmount ?? 0} MP`;
  if (event.healAmount) return `+${event.healAmount} HP`;
  if (event.outcome === 'FLED') return 'Fugiu!';
  if (event.outcome === 'FLEE_FAILED') return 'Fuga falhou';
  if (event.outcome === 'CURED') return 'Curado!';
  if (event.outcome === 'BUFFED') return 'Bônus!';
  return 'Defesa!';
}
