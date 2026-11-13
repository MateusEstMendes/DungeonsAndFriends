import { ATTRIBUTE_IDS, type Attributes, type AttributeId } from "./pointBuy.js";

export const RACE_IDS = ["HUMAN", "DWARF", "ELF", "ORC", "VAMPIRE", "DEMON", "HALF_DRAGON", "HALF_SHARK"] as const;
export type RaceId = (typeof RACE_IDS)[number];
export type RacialPassive = { name: string } & (
  | { effect: "EXTRA_ATTRIBUTE"; amount: number }
  | { effect: "FLAT_DR" | "PASSIVE_DODGE" | "MELEE_LIFESTEAL" | "MAGIC_DR_PENETRATION" | "BASE_DEFENSE"; amount: number }
  | { effect: "PHYSICAL_DAMAGE" | "MELEE_DAMAGE"; amount: number; hpBelowPercent: number; hpSubject: "SELF" | "TARGET" }
);
export interface RaceDefinition { name: string; modifiers: Readonly<Partial<Attributes>>; passive: RacialPassive }
export const RACES = {
  HUMAN: { name: "Humano", modifiers: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 }, passive: { name: "Adaptabilidade", effect: "EXTRA_ATTRIBUTE", amount: 1 } },
  DWARF: { name: "Anão", modifiers: { con: 2, str: 1, dex: -1 }, passive: { name: "Resiliência das Rochas", effect: "FLAT_DR", amount: 1 } },
  ELF: { name: "Elfo", modifiers: { dex: 2, int: 1, con: -1 }, passive: { name: "Graça Silvestre", effect: "PASSIVE_DODGE", amount: 5 } },
  ORC: { name: "Orc", modifiers: { str: 2, con: 1, int: -2 }, passive: { name: "Fúria Indomável", effect: "PHYSICAL_DAMAGE", amount: 2, hpBelowPercent: 30, hpSubject: "SELF" } },
  VAMPIRE: { name: "Vampiro", modifiers: { dex: 2, int: 1, con: -1 }, passive: { name: "Toque Sanguíneo", effect: "MELEE_LIFESTEAL", amount: 20 } },
  DEMON: { name: "Demônio", modifiers: { int: 2, str: 1, cha: -1 }, passive: { name: "Pacto Flamejante", effect: "MAGIC_DR_PENETRATION", amount: 2 } },
  HALF_DRAGON: { name: "Meio-Dragão", modifiers: { str: 2, con: 1, wis: -1 }, passive: { name: "Couraça Escamosa", effect: "BASE_DEFENSE", amount: 2 } },
  HALF_SHARK: { name: "Meio-Tubarão", modifiers: { dex: 2, str: 1, wis: -1 }, passive: { name: "Instinto Predador", effect: "MELEE_DAMAGE", amount: 2, hpBelowPercent: 50, hpSubject: "TARGET" } },
} as const satisfies Record<RaceId, RaceDefinition>;

export function applyRacialModifiers(base: Attributes, raceId: RaceId, humanBonusAttribute?: AttributeId): Attributes {
  if ((raceId === "HUMAN") !== (humanBonusAttribute !== undefined)
    || (humanBonusAttribute !== undefined && !ATTRIBUTE_IDS.includes(humanBonusAttribute))) {
    throw new Error("Apenas Humanos devem escolher um atributo para Adaptabilidade.");
  }
  const modifiers: RaceDefinition["modifiers"] = RACES[raceId].modifiers;
  return Object.fromEntries(ATTRIBUTE_IDS.map(key => [key,
    base[key] + (modifiers[key] ?? 0) + (raceId === "HUMAN" && humanBonusAttribute === key ? 1 : 0),
  ])) as Attributes;
}
