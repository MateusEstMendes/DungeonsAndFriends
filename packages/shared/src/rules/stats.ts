import type { RaceId } from "./races.js";

export const getModifier = (attr: number) => Math.floor((attr - 10) / 2);
export const calculateMaxHp = (conMod: number) => 100 + conMod * 10;
export const calculateMaxMp = (finalInt: number, wisMod: number) => Math.max(10, finalInt * 2 + wisMod * 5);
export const calculateBaseDefense = (dexMod: number, raceId: RaceId) => 10 + dexMod + (raceId === "HALF_DRAGON" ? 2 : 0);
export const calculatePassiveDodge = (dexMod: number, raceId: RaceId) => Math.min(20, Math.max(0, 5 + dexMod * 2 + (raceId === "ELF" ? 5 : 0)));
export const calculateSpeed = (dexMod: number) => Math.max(1, 2 + Math.floor(dexMod / 2));
export const calculateFlatDR = (raceId: RaceId) => raceId === "DWARF" ? 1 : 0;
