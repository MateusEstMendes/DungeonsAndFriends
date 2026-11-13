export const ARCHETYPE_IDS = ["WARRIOR", "BARBARIAN", "ROGUE", "MAGE", "CLERIC"] as const;
export type ArchetypeId = (typeof ARCHETYPE_IDS)[number];
export interface ArchetypeDefinition {
  name: string;
  signatureAbility: { name: string; description: string; cost: { type: "MP" | "COOLDOWN_ROUNDS"; amount: number } };
}
// Custos de MP iniciais de balanceamento; a resolução das habilidades pertence ao combate.
export const ARCHETYPES = {
  WARRIOR: { name: "Guerreiro", signatureAbility: { name: "Golpe Avassalador", description: "Desfere um golpe físico poderoso.", cost: { type: "COOLDOWN_ROUNDS", amount: 3 } } },
  BARBARIAN: { name: "Bárbaro", signatureAbility: { name: "Fúria Berserk", description: "Aumenta o dano físico causado e o dano recebido temporariamente.", cost: { type: "COOLDOWN_ROUNDS", amount: 3 } } },
  ROGUE: { name: "Ladino", signatureAbility: { name: "Ataque Furtivo", description: "Executa um golpe de alta precisão.", cost: { type: "COOLDOWN_ROUNDS", amount: 2 } } },
  MAGE: { name: "Mago", signatureAbility: { name: "Feitiço Arcano de Assinatura", description: "Canaliza um ataque arcano.", cost: { type: "MP", amount: 10 } } },
  CLERIC: { name: "Clérigo", signatureAbility: { name: "Cura Divina", description: "Restaura HP de um aliado em alcance.", cost: { type: "MP", amount: 10 } } },
} as const satisfies Record<ArchetypeId, ArchetypeDefinition>;
