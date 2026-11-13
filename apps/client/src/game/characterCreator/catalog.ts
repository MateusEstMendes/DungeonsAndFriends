import { z } from 'zod';
import { BaseAttributesSchema, VisualConfigSchema, RACE_IDS, ARCHETYPE_IDS, type RaceId, type VisualConfig } from '@df/shared';
export const DraftSchema = z.object({ name: z.string().max(40), raceId: z.enum(RACE_IDS), archetypeId: z.enum(ARCHETYPE_IDS), baseAttributes: BaseAttributesSchema, humanBonusAttribute: z.enum(['str','dex','con','int','wis','cha']).optional(), visualConfig: VisualConfigSchema });
export type CharacterDraft = z.infer<typeof DraftSchema>;
export const LAYER_OPTIONS = {
  '00_back_hair': ['short','long','braids','none'], '10_body_base': ['angular','soft'],
  '20_skin_details': ['racial','none'], '30_ears': ['racial'], '40_eyes_iris': ['focused','gentle'],
  '50_mouth_fangs': ['neutral','smile'], '60_facial_hair': ['none','beard','braided'],
  '70_front_hair': ['swept','short','fringe','none'], '80_horns': ['curved','crown','none'],
} as const;
export type LayerId = keyof typeof LAYER_OPTIONS;
export const LAYER_LABELS: Record<LayerId,string> = { '00_back_hair':'Cabelo traseiro','10_body_base':'Traços do rosto','20_skin_details':'Marcas raciais','30_ears':'Orelhas','40_eyes_iris':'Olhar','50_mouth_fangs':'Expressão','60_facial_hair':'Barba','70_front_hair':'Penteado','80_horns':'Chifres' };
export const OPTION_LABELS: Record<string,string> = {short:'Curto',long:'Longo',braids:'Tranças',none:'Sem',angular:'Angulares',soft:'Suaves',racial:'Da raça',focused:'Intenso',gentle:'Suave',neutral:'Serena',smile:'Sorriso',beard:'Cheia',braided:'Trançada',swept:'Ondulado',fringe:'Franja',curved:'Curvos',crown:'Coroa'};
export const RACE_SYMBOLS: Record<RaceId,string> = { HUMAN:'☀', DWARF:'⚒', ELF:'❧', ORC:'⚔', VAMPIRE:'☾', DEMON:'♜', HALF_DRAGON:'♢', HALF_SHARK:'≋' };
const skin: Record<RaceId,string> = { HUMAN:'#EDBD96',DWARF:'#DAA477',ELF:'#F3C9A6',ORC:'#A8AD72',VAMPIRE:'#E7D4D1',DEMON:'#C87D70',HALF_DRAGON:'#DDB18C',HALF_SHARK:'#A8B6CD' };
export function racePreset(race: RaceId): VisualConfig {
 return {layers:{'00_back_hair':race==='DWARF'?'braids':'short','10_body_base':'angular','20_skin_details':'racial','30_ears':'racial','40_eyes_iris':'focused','50_mouth_fangs':'neutral','60_facial_hair':race==='DWARF'?'braided':'none','70_front_hair':'swept','80_horns':race==='DEMON'||race==='HALF_DRAGON'?'curved':'none'},colors:{skin:skin[race],hair:'#775449',eyes:race==='VAMPIRE'?'#D13946':race==='HALF_DRAGON'?'#39C9BD':'#8EA85E',details:'#71879B',horns:'#8D7975'}};
}
export function initialDraft(): CharacterDraft {return {name:'Aventureiro',raceId:'HUMAN',archetypeId:'WARRIOR',baseAttributes:{str:8,dex:8,con:8,int:8,wis:8,cha:8},visualConfig:racePreset('HUMAN')};}
export function loadDraft(roomCode:string): CharacterDraft {
 try {const value=DraftSchema.parse(JSON.parse(localStorage.getItem(`df_char_draft_${roomCode}`)||'null'));
 for(const [layer, options] of Object.entries(LAYER_OPTIONS)) if(!(options as readonly string[]).includes(value.visualConfig.layers[layer as LayerId]??'')) return initialDraft();
 return value;
 } catch {return initialDraft();}
}
