CREATE TABLE `character_grimoire` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`spell_id` text NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`spell_id`) REFERENCES `spells_catalog`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `character_grimoire_spell_unique` ON `character_grimoire` (`character_id`,`spell_id`);--> statement-breakpoint
CREATE TABLE `chests` (
	`object_id` text PRIMARY KEY NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`items_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `placed_objects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "chests_gold_valid" CHECK(typeof("chests"."gold") = 'integer' AND "chests"."gold" >= 0 AND "chests"."gold" <= 9007199254740991),
	CONSTRAINT "chests_items_valid" CHECK(json_valid("chests"."items_json") AND json_type("chests"."items_json") = 'array')
);
--> statement-breakpoint
CREATE TABLE `inventories` (
	`id` text PRIMARY KEY NOT NULL,
	`character_id` text NOT NULL,
	`item_id` text NOT NULL,
	`slot` text DEFAULT 'BAG' NOT NULL,
	`quantity` integer DEFAULT 1 NOT NULL,
	FOREIGN KEY (`character_id`) REFERENCES `characters`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`item_id`) REFERENCES `items_catalog`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "inventories_slot_valid" CHECK("inventories"."slot" IN ('MAIN_HAND','OFF_HAND','ARMOR','BAG')),
	CONSTRAINT "inventories_quantity_valid" CHECK(typeof("inventories"."quantity") = 'integer' AND "inventories"."quantity" >= 1 AND "inventories"."quantity" <= 1000000 AND ("inventories"."slot" = 'BAG' OR "inventories"."quantity" = 1))
);
--> statement-breakpoint
CREATE INDEX `inventories_character_idx` ON `inventories` (`character_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `inventories_equipped_slot_unique` ON `inventories` (`character_id`,`slot`) WHERE "inventories"."slot" != 'BAG';--> statement-breakpoint
CREATE UNIQUE INDEX `inventories_bag_stack_unique` ON `inventories` (`character_id`,`item_id`) WHERE "inventories"."slot" = 'BAG';--> statement-breakpoint
CREATE TABLE `items_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`handedness` text,
	`slot` text NOT NULL,
	`base_price_gold` integer NOT NULL,
	`damage_dice` text,
	`damage_type` text,
	`armor_type` text,
	`defense_bonus` integer DEFAULT 0 NOT NULL,
	`dr_bonus` integer DEFAULT 0 NOT NULL,
	`dex_penalty` integer DEFAULT 0 NOT NULL,
	`dodge_mod` integer DEFAULT 0 NOT NULL,
	`max_dex_bonus` integer,
	`effect_json` text,
	CONSTRAINT "items_price_valid" CHECK(typeof("items_catalog"."base_price_gold") = 'integer' AND "items_catalog"."base_price_gold" >= 0 AND "items_catalog"."base_price_gold" <= 9007199254740991)
);
--> statement-breakpoint
CREATE TABLE `npc_shops` (
	`object_id` text PRIMARY KEY NOT NULL,
	`npc_name` text NOT NULL,
	`dialogue` text DEFAULT '' NOT NULL,
	`inventory_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`object_id`) REFERENCES `placed_objects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "npc_shops_inventory_valid" CHECK(json_valid("npc_shops"."inventory_json") AND json_type("npc_shops"."inventory_json") = 'array')
);
--> statement-breakpoint
CREATE TABLE `spells_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`mp_cost` integer NOT NULL,
	`target_mode` text NOT NULL,
	`damage_dice` text NOT NULL,
	`attribute` text NOT NULL,
	`element` text NOT NULL,
	`effect_json` text,
	CONSTRAINT "spells_mp_valid" CHECK(typeof("spells_catalog"."mp_cost") = 'integer' AND "spells_catalog"."mp_cost" >= 0)
);
--> statement-breakpoint
-- Additive upgrades preserve references from players and live encounters.
ALTER TABLE characters ADD gold integer NOT NULL DEFAULT 50 CONSTRAINT characters_gold_valid CHECK(typeof(gold) = 'integer' AND gold >= 0 AND gold <= 9007199254740991);
--> statement-breakpoint
ALTER TABLE characters ADD human_bonus_attribute text CONSTRAINT characters_human_bonus_valid CHECK(human_bonus_attribute IS NULL OR (race_id = 'HUMAN' AND human_bonus_attribute IN ('str','dex','con','int','wis','cha')));
--> statement-breakpoint
ALTER TABLE characters ADD base_final_dex integer;
--> statement-breakpoint
ALTER TABLE characters ADD starter_kit_granted integer NOT NULL DEFAULT 0 CONSTRAINT characters_starter_kit_valid CHECK(starter_kit_granted IN (0,1));
--> statement-breakpoint
ALTER TABLE placed_objects ADD is_archived integer NOT NULL DEFAULT 0 CONSTRAINT placed_objects_archived_valid CHECK(is_archived IN (0,1));
--> statement-breakpoint
ALTER TABLE combat_encounters ADD global_ai_enabled integer NOT NULL DEFAULT 0;

--> statement-breakpoint
-- Canonical catalogs; startup also repairs missing IDs without overwriting tuned entries.
INSERT OR IGNORE INTO items_catalog (id,name,category,slot,base_price_gold,handedness,damage_dice,damage_type,armor_type,defense_bonus,dr_bonus,dex_penalty,dodge_mod,max_dex_bonus,effect_json) VALUES
('GREAT_SWORD','Espada Grande','WEAPON','MAIN_HAND',100,'TWO_HANDED','2d6','SLASHING',NULL,0,0,0,0,NULL,NULL),
('BATTLE_AXE','Machado de Batalha','WEAPON','MAIN_HAND',90,'TWO_HANDED','1d12','SLASHING',NULL,0,0,0,0,NULL,NULL),
('LONG_SPEAR','Lança Longa','WEAPON','MAIN_HAND',75,'TWO_HANDED','1d10','THRUST',NULL,0,0,0,0,NULL,NULL),
('SHORT_SWORD','Espada Curta','WEAPON','MAIN_HAND',60,'ONE_HANDED','1d6','SLASHING',NULL,0,0,0,0,NULL,NULL),
('DAGGER','Adaga','WEAPON','MAIN_HAND',40,'ONE_HANDED','1d4','THRUST',NULL,0,0,0,0,NULL,NULL),
('MACE','Maça','WEAPON','MAIN_HAND',50,'ONE_HANDED','1d6','BLUNT',NULL,0,0,0,0,NULL,NULL),
('SHORT_BOW','Arco Curto','RANGED','MAIN_HAND',70,'TWO_HANDED','1d6','THRUST',NULL,0,0,0,0,NULL,NULL),
('CROSSBOW','Besta','RANGED','MAIN_HAND',85,'TWO_HANDED','1d8','THRUST',NULL,0,0,0,0,NULL,NULL),
('WOODEN_SHIELD','Escudo de Madeira','SHIELD','OFF_HAND',30,NULL,NULL,NULL,NULL,2,0,0,0,NULL,NULL),
('STEEL_SHIELD','Escudo de Aço','SHIELD','OFF_HAND',80,NULL,NULL,NULL,NULL,3,1,0,0,NULL,NULL),
('ARCANE_STAFF','Cajado Arcano','MAGIC_FOCUS','MAIN_HAND',70,'TWO_HANDED',NULL,NULL,NULL,0,0,0,0,NULL,NULL),
('WAND','Varinha','MAGIC_FOCUS','MAIN_HAND',50,'ONE_HANDED',NULL,NULL,NULL,0,0,0,0,NULL,NULL),
('DIVINE_FOCUS','Foco Divino','MAGIC_FOCUS','MAIN_HAND',50,'ONE_HANDED',NULL,NULL,NULL,0,0,0,0,NULL,NULL),
('STUDDED_LEATHER','Couro Batido','ARMOR','ARMOR',60,NULL,NULL,NULL,'LIGHT',2,0,0,5,NULL,NULL),
('CHAIN_MAIL','Cota de Malha','ARMOR','ARMOR',120,NULL,NULL,NULL,'MEDIUM',4,0,0,0,2,NULL),
('PLATE_ARMOR','Armadura de Placas','ARMOR','ARMOR',200,NULL,NULL,NULL,'HEAVY',7,2,2,-10,NULL,NULL),
('HEALTH_POTION','Poção de Vida','CONSUMABLE','BAG',20,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"RESTORE_HP","amount":25}'),
('MANA_POTION','Poção de Mana','CONSUMABLE','BAG',25,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"RESTORE_MP","amount":20}'),
('ANTIDOTE','Antídoto','CONSUMABLE','BAG',15,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"CURE_STATUS","status":"POISON"}'),
('MAGIC_BOOK','Livro Mágico','CONSUMABLE','BAG',40,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"MAGIC_DAMAGE","amount":4,"rounds":2}'),
('THE_JUICE','O Suco','CONSUMABLE','BAG',40,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"PHYSICAL_DAMAGE","multiplier":1.2,"rounds":2}'),
('SPELL_SCROLL_ARCANE_DART','Pergaminho de Dardo Arcano','CONSUMABLE','BAG',40,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"LEARN_SPELL","spellId":"ARCANE_DART"}'),
('SPELL_SCROLL_IGNEOUS_BLAST','Pergaminho de Explosão Ígnea','CONSUMABLE','BAG',100,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"LEARN_SPELL","spellId":"IGNEOUS_BLAST"}'),
('SPELL_SCROLL_HEALING_LIGHT','Pergaminho de Luz Curativa','CONSUMABLE','BAG',60,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"LEARN_SPELL","spellId":"HEALING_LIGHT"}'),
('SPELL_SCROLL_FREEZING_RAY','Pergaminho de Raio Congelante','CONSUMABLE','BAG',80,NULL,NULL,NULL,NULL,0,0,0,0,NULL,'{"type":"LEARN_SPELL","spellId":"FREEZING_RAY"}'),
('KEY','Chave','NARRATIVE','BAG',5,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL),
('ROPE','Corda','NARRATIVE','BAG',10,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL),
('TORCH','Tocha','NARRATIVE','BAG',5,NULL,NULL,NULL,NULL,0,0,0,0,NULL,NULL);
--> statement-breakpoint
INSERT OR IGNORE INTO spells_catalog (id,name,description,mp_cost,target_mode,damage_dice,attribute,element,effect_json) VALUES
('ARCANE_DART','Dardo Arcano','Causa 1d6 + mod_INT de dano arcano a um inimigo.',4,'SINGLE_ENEMY','1d6','INT','ARCANE',NULL),
('IGNEOUS_BLAST','Explosão Ígnea','Causa 2d6 + mod_INT de dano de fogo a todos os inimigos vivos.',10,'ALL_ENEMIES','2d6','INT','FIRE',NULL),
('HEALING_LIGHT','Luz Curativa','Cura 2d6 + max(0, mod_SAB) HP de um aliado ou de si próprio.',6,'SINGLE_ALLY','2d6','WIS','LIGHT',NULL),
('FREEZING_RAY','Raio Congelante','Causa 1d8 + mod_INT de dano de gelo e reduz a velocidade em 1 por uma rodada.',8,'SINGLE_ENEMY','1d8','INT','ICE','{"type":"SLOW","speedPenalty":1,"rounds":1}');
--> statement-breakpoint
UPDATE combat_participants SET stats_json = json_patch('{"isAutoMode":false,"allowAutoFlee":false}', stats_json) WHERE kind = 'MONSTER' AND json_valid(stats_json) AND json_type(stats_json) = 'object';
