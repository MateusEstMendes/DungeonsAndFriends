import type { CharacterCreationPayload } from "../src/index.js";

export const webp = "UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA";
export function characterPayload(): CharacterCreationPayload {
  return {
    name: "Ael", raceId: "ELF", archetypeId: "MAGE",
    baseAttributes: { str: 8, dex: 15, con: 14, int: 15, wis: 10, cha: 8 },
    visualConfig: { layers: { "10_body_base": "elf_base_01" }, colors: { skin: "#AABBCC" } },
    portraitBase64: `data:image/webp;base64,${webp}`, tokenBase64: webp,
  };
}
