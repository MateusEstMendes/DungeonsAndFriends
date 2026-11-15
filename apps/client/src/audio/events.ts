import type { CombatEvent } from '@df/shared';
import type { Sfx } from './soundManager';
const sounds: Record<string, Sfx> = { FIRE: 'spell_fire', ICE: 'spell_ice', COLD: 'spell_ice', PIERCING: 'bow_shoot', SLASHING: 'sword_slash', BLUDGEONING: 'blunt_hit', UNARMED: 'blunt_hit' };
export function combatSfx(event: CombatEvent): Sfx | undefined {
  if (event.healAmount || event.targets.some(t => t.healAmount > 0)) return 'spell_heal';
  if (event.outcome?.startsWith('DODGED') || event.targets.some(t => t.outcome?.startsWith('DODGED'))) return 'dodge_whoosh';
  return event.vfxType ? sounds[event.vfxType] || 'blunt_hit' : undefined;
}
