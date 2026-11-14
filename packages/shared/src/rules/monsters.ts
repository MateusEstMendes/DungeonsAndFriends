import type { AttackType } from '../combat/actions.js';

export interface MonsterDefinition {
  id: string; name: string; imageUrl: string;
  hp: number; mp: number; str: number; dex: number; int: number; speed: number;
  flatDr: number; passiveDodge: number; attackType: AttackType; baseDamage: number;
}

/** Initial encounter stats; existing database customizations are preserved by the seed. */
export const MONSTER_CATALOG: readonly MonsterDefinition[] = [
  { id: 'GOBLIN', name: 'Goblin', imageUrl: '/enemies/goblin.png', hp: 30, mp: 0, str: 10, dex: 14, int: 8, speed: 4, flatDr: 0, passiveDodge: 5, attackType: 'THRUST', baseDamage: 6 },
  { id: 'SKELETON_WARRIOR', name: 'Esqueleto Guerreiro', imageUrl: '/enemies/skeleton-warrior.png', hp: 45, mp: 0, str: 14, dex: 10, int: 6, speed: 2, flatDr: 5, passiveDodge: 0, attackType: 'SLASHING', baseDamage: 8 },
  { id: 'ARCANE_CULTIST', name: 'Cultista Arcano', imageUrl: '/enemies/arcane-cultist.png', hp: 28, mp: 30, str: 8, dex: 12, int: 16, speed: 3, flatDr: 1, passiveDodge: 0, attackType: 'ARCANE', baseDamage: 9 },
  { id: 'SLIME', name: 'Slime', imageUrl: '/enemies/slime.png', hp: 20, mp: 0, str: 8, dex: 6, int: 2, speed: 2, flatDr: 0, passiveDodge: 0, attackType: 'BLUNT', baseDamage: 4 },
  { id: 'SHADOW_WOLF', name: 'Lobo Sombrio', imageUrl: '/enemies/shadow-wolf.png', hp: 40, mp: 0, str: 12, dex: 16, int: 4, speed: 6, flatDr: 0, passiveDodge: 10, attackType: 'SLASHING', baseDamage: 7 },
  { id: 'GIANT_SPIDER', name: 'Aranha Gigante', imageUrl: '/enemies/giant-spider.png', hp: 35, mp: 0, str: 10, dex: 15, int: 3, speed: 5, flatDr: 1, passiveDodge: 8, attackType: 'THRUST', baseDamage: 6 },
  { id: 'ZOMBIE', name: 'Zumbi', imageUrl: '/enemies/zombie.png', hp: 50, mp: 0, str: 14, dex: 6, int: 2, speed: 2, flatDr: 1, passiveDodge: 0, attackType: 'UNARMED', baseDamage: 7 },
  { id: 'ORC_RAIDER', name: 'Orc Saqueador', imageUrl: '/enemies/orc-raider.png', hp: 80, mp: 0, str: 18, dex: 10, int: 6, speed: 3, flatDr: 2, passiveDodge: 5, attackType: 'SLASHING', baseDamage: 10 },
  { id: 'STONE_GOLEM', name: 'Golem de Pedra', imageUrl: '/enemies/stone-golem.png', hp: 160, mp: 0, str: 24, dex: 4, int: 3, speed: 1, flatDr: 8, passiveDodge: 0, attackType: 'BLUNT', baseDamage: 14 },
  { id: 'YOUNG_DRAGON', name: 'Dragão Jovem', imageUrl: '/enemies/young-dragon.png', hp: 220, mp: 60, str: 22, dex: 14, int: 20, speed: 5, flatDr: 4, passiveDodge: 10, attackType: 'FIRE', baseDamage: 16 },
];

export function getMonsterDefinition(nameOrId: string): MonsterDefinition | undefined {
  const value = nameOrId.trim().toLocaleLowerCase('pt-BR');
  const legacy = value === 'sentinela' ? 'SKELETON_WARRIOR' : value === 'monstro' ? 'GOBLIN' : nameOrId;
  return MONSTER_CATALOG.find(monster => monster.id === legacy || monster.name.toLocaleLowerCase('pt-BR') === value);
}
