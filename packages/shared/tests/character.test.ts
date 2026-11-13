import { expect, it } from "vitest";
import { CharacterCreationSchema, WebPBase64Schema } from "../src/index.js";
import { characterPayload, webp } from "./characterFixture.js";

it("valida a ficha, as camadas modulares e imagens WebP puras ou data URL", () => {
  expect(CharacterCreationSchema.safeParse(characterPayload()).success).toBe(true);
  for (const field of ["hp", "finalAttributes", "playerId", "roomId"]) {
    expect(CharacterCreationSchema.safeParse({ ...characterPayload(), [field]: 999 }).success).toBe(false);
  }
  for (const value of [7, 16, 8.5]) expect(CharacterCreationSchema.safeParse({ ...characterPayload(), baseAttributes: { ...characterPayload().baseAttributes, dex: value } }).success).toBe(false);
  for (const raceId of ["INVALID", "HUMAN"]) expect(CharacterCreationSchema.safeParse({ ...characterPayload(), raceId }).success).toBe(false);
  expect(CharacterCreationSchema.safeParse({ ...characterPayload(), archetypeId: "INVALID" }).success).toBe(false);
  expect(CharacterCreationSchema.safeParse({ ...characterPayload(), humanBonusAttribute: "str" }).success).toBe(false);
  expect(CharacterCreationSchema.safeParse({ ...characterPayload(), raceId: "HUMAN", humanBonusAttribute: "str" }).success).toBe(true);
  expect(CharacterCreationSchema.safeParse({ ...characterPayload(), visualConfig: { layers: { unknown: "piece" }, colors: {} } }).success).toBe(false);
  for (const color of ["red", "#fff", "#12345678", "#GGHHII"]) expect(CharacterCreationSchema.safeParse({ ...characterPayload(), visualConfig: { layers: {}, colors: { skin: color } } }).success).toBe(false);
  for (const invalid of ["", "not-base64", btoa("not a webp image"), `data:image/png;base64,${webp}`, webp.slice(0, -4), "A".repeat(90_000)]) expect(WebPBase64Schema.safeParse(invalid).success).toBe(false);
});
