import { expect, it } from "vitest";
import { FogMemory } from "../src/game/layers/FogMemory";
it("lembra apenas o terreno da visita atual e descarta tudo ao cruzar um portal", () => {
  const memory = new FogMemory();
  memory.visit("atrium", new Set(["0,0", "1,0"]));
  memory.visit("atrium", new Set(["2,0"]));
  expect(memory.has("0,0")).toBe(true);
  expect(memory.has("2,0")).toBe(true);
  expect(memory.has("5,0")).toBe(false);
  memory.visit("gallery", new Set(["-4,0"]));
  expect(memory.has("0,0")).toBe(false);
  memory.visit("atrium", new Set(["4,0"]));
  expect(memory.has("0,0")).toBe(false);
  expect(memory.has("1,0")).toBe(false);
  expect(memory.has("4,0")).toBe(true);
});
