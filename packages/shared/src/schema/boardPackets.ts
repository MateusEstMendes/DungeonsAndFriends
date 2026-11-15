import { z } from "zod";
import { TERRAIN_TYPES } from "./ChamberSchema.js";
const coord = z.number().int().min(-200).max(200);
const position = { q: coord, r: coord };
export const RequestMoveSchema = z.strictObject({ targetQ: coord, targetR: coord, revision: z.number().int().nonnegative() });
export const MasterMoveSchema = z.strictObject({ entityId: z.string().min(1).max(100), chamberId: z.string().min(1).max(100), ...position });
export const ExplorationModeSchema = z.enum(["DUNGEON_TENSE_30S", "FREE_EXPLORATION"]);
export const ChamberBiomeSchema = z.strictObject({ chamberId: z.string().min(1).max(100), biome: z.enum(['CAVE','FOREST','TAVERN','DUNGEON']) });
const base = { chamberId: z.string().min(1).max(100), ...position };
export const MasterEditSchema = z.discriminatedUnion("layer", [
  z.strictObject({ ...base, layer: z.literal("TERRAIN"), terrain: z.enum(TERRAIN_TYPES) }),
  z.strictObject({ ...base, layer: z.literal("WALL"), direction: z.number().int().min(0).max(5), erase: z.boolean() }),
  z.strictObject({ ...base, layer: z.literal("OBJECT"), kind: z.enum(["CHEST", "TABLE", "CHAIR", "DOOR", "TORCH", "NPC_MERCHANT"]), rotation: z.number().int().min(0).max(359), hidden: z.boolean() }),
  z.strictObject({ ...base, layer: z.literal("ENTITY"), name: z.string().trim().min(1).max(60), hidden: z.boolean() }),
]);
export const EntityHiddenSchema = z.strictObject({ entityId: z.string().min(1).max(100), hidden: z.boolean() });
export const DeleteEntitySchema = z.strictObject({ entityId: z.string().min(1).max(100) });
export const RotateObjectSchema = z.strictObject({ entityId: z.string().min(1).max(100), rotation: z.number().int().min(0).max(359) });
