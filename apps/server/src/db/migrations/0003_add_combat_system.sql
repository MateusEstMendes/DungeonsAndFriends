CREATE TABLE monsters_catalog (
 id text PRIMARY KEY NOT NULL, name text NOT NULL, hp integer NOT NULL,
 mp integer DEFAULT 0 NOT NULL, str integer NOT NULL, dex integer NOT NULL,
 int integer NOT NULL, speed integer NOT NULL, flat_dr integer DEFAULT 0 NOT NULL,
 passive_dodge integer DEFAULT 0 NOT NULL, attack_type text NOT NULL, base_damage integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE combat_encounters (
 id text PRIMARY KEY NOT NULL, room_id text NOT NULL REFERENCES rooms(id), chamber_id text NOT NULL,
 status text DEFAULT 'ACTIVE' NOT NULL CHECK(status IN ('ACTIVE','ENDED','FLED')),
 biome text NOT NULL, round integer NOT NULL, turn_order_json text NOT NULL,
 active_participant_id text NOT NULL, remaining_actions integer NOT NULL, action_index integer DEFAULT 0 NOT NULL,
 flee_mode text DEFAULT 'NORMAL' NOT NULL, is_paused integer DEFAULT 0 NOT NULL,
 turn_token text NOT NULL, cutoffs_json text NOT NULL, updated_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX combat_encounters_room_idx ON combat_encounters(room_id);
--> statement-breakpoint
CREATE UNIQUE INDEX combat_encounters_one_active ON combat_encounters(room_id) WHERE status = 'ACTIVE';
--> statement-breakpoint
CREATE TABLE combat_participants (
 id text NOT NULL, encounter_id text NOT NULL REFERENCES combat_encounters(id), kind text NOT NULL,
 stats_json text NOT NULL, hp integer NOT NULL, mp integer NOT NULL,
 CONSTRAINT combat_participants_encounter_entity UNIQUE(encounter_id,id)
);
--> statement-breakpoint
CREATE TABLE active_buffs (
 id text PRIMARY KEY NOT NULL, encounter_id text NOT NULL REFERENCES combat_encounters(id),
 participant_id text NOT NULL, kind text NOT NULL, amount integer NOT NULL, expires_round integer NOT NULL
);
--> statement-breakpoint
INSERT INTO monsters_catalog(id,name,hp,mp,str,dex,int,speed,flat_dr,passive_dodge,attack_type,base_damage) VALUES
 ('GOBLIN','Goblin',30,0,10,14,8,4,0,5,'THRUST',6),
 ('SKELETON_WARRIOR','Esqueleto Guerreiro',45,0,14,10,6,2,5,0,'SLASHING',8),
 ('ARCANE_CULTIST','Cultista Arcano',28,30,8,12,16,3,1,0,'ARCANE',9);
