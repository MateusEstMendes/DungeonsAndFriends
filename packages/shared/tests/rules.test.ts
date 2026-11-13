import { describe, expect, it } from "vitest";
import {
  ATTRIBUTE_IDS, RACE_IDS, RACES, ARCHETYPES, ARCHETYPE_IDS, applyRacialModifiers,
  calculatePointBuyCost, canIncrementAttribute, validatePointBuy, getModifier,
  calculateMaxHp, calculateMaxMp, calculateBaseDefense, calculatePassiveDodge,
  calculateSpeed, calculateFlatDR, type Attributes,
} from "../src/index.js";

describe("Point Buy", () => {
  it("valida as 262.144 combinações dos seis atributos e cada incremento", () => {
    const costs = [0, 1, 2, 3, 4, 5, 7, 9];
    let mismatches = 0;
    for (let encoded = 0; encoded < 8 ** 6; encoded++) {
      let n = encoded, cost = 0;
      const attributes = {} as Attributes;
      for (const key of ATTRIBUTE_IDS) {
        const digit = n % 8; n = Math.floor(n / 8);
        attributes[key] = 8 + digit; cost += costs[digit];
      }
      const result = validatePointBuy(attributes);
      if (calculatePointBuyCost(attributes) !== cost || result.valid !== (cost <= 27) || result.remaining !== 27 - cost) mismatches++;
      for (const value of Object.values(attributes)) {
        const expected = value < 15 && costs[value - 7] - costs[value - 8] <= 27 - cost;
        if (canIncrementAttribute(value, 27 - cost) !== expected) mismatches++;
      }
    }
    expect(mismatches).toBe(0);
  });
  it("rejeita atributos ausentes, inválidos e orçamentos excedidos", () => {
    const base = { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
    for (const value of [7, 16, 8.5, NaN, Infinity, undefined]) {
      expect(validatePointBuy({ ...base, str: value } as Attributes).valid).toBe(false);
      expect(canIncrementAttribute(value as number, 27)).toBe(false);
    }
    expect(validatePointBuy({ ...base, str: 15, dex: 15, con: 15, int: 9 })).toMatchObject({ valid: false, remaining: -1 });
    expect(canIncrementAttribute(13, 1)).toBe(false);
    expect(canIncrementAttribute(14, 2)).toBe(true);
  });
});

describe("raças e status", () => {
  it("aplica os modificadores exatos das oito raças e o bônus humano", () => {
    const base = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
    const expected = [
      [11, 11, 11, 11, 11, 11], [11, 9, 12, 10, 10, 10], [10, 12, 9, 11, 10, 10],
      [12, 10, 11, 8, 10, 10], [10, 12, 9, 11, 10, 10], [11, 10, 10, 12, 10, 9],
      [12, 10, 11, 10, 9, 10], [11, 12, 10, 10, 9, 10],
    ];
    RACE_IDS.forEach((race, index) => {
      const result = applyRacialModifiers(base, race, race === "HUMAN" ? "str" : undefined);
      expect(ATTRIBUTE_IDS.map(key => result[key])).toEqual(expected[index].map((v, i) => v + (race === "HUMAN" && i === 0 ? 1 : 0)));
      expect(RACES[race].passive.name).toBeTruthy();
    });
    for (const key of ATTRIBUTE_IDS) expect(applyRacialModifiers(base, "HUMAN", key)[key]).toBe(12);
    expect(() => applyRacialModifiers(base, "HUMAN")).toThrow();
    expect(() => applyRacialModifiers(base, "ELF", "str")).toThrow();
    expect(base).toEqual({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
  });
  it("arredonda negativos para baixo e respeita pisos e teto de esquiva", () => {
    expect(getModifier(7)).toBe(-2); expect(getModifier(9)).toBe(-1); expect(getModifier(17)).toBe(3);
    expect(calculateMaxHp(-1)).toBe(90); expect(calculateMaxMp(8, -2)).toBe(10);
    expect(calculateMaxMp(16, 1)).toBe(37);
    expect(calculateBaseDefense(3, "HALF_DRAGON")).toBe(15);
    expect(calculateBaseDefense(3, "ELF")).toBe(13);
    expect(calculatePassiveDodge(getModifier(17), "ELF")).toBe(16);
    expect(calculatePassiveDodge(getModifier(24), "ELF")).toBe(20);
    for (const race of RACE_IDS) for (let mod = -20; mod <= 20; mod++) {
      expect(calculatePassiveDodge(mod, race)).toBe(Math.min(20, Math.max(0, 5 + mod * 2 + (race === "ELF" ? 5 : 0))));
      expect(calculateFlatDR(race)).toBe(race === "DWARF" ? 1 : 0);
    }
    expect(calculateSpeed(-1)).toBe(1); expect(calculateSpeed(-20)).toBe(1);
    expect(calculateSpeed(3)).toBe(3); expect(calculateSpeed(4)).toBe(4);
  });
  it("define cinco habilidades com custo de mana ou cooldown inteiro", () => {
    expect(Object.keys(ARCHETYPES)).toEqual(ARCHETYPE_IDS);
    for (const archetype of Object.values(ARCHETYPES)) {
      expect(archetype.signatureAbility.cost.amount).toBeGreaterThan(0);
      expect(Number.isInteger(archetype.signatureAbility.cost.amount)).toBe(true);
    }
  });
});
