import { afterEach, expect, it, vi } from 'vitest';
import { CharacterCreationSchema, RACE_IDS } from '@df/shared';
import { characterPayload } from '../../../packages/shared/tests/characterFixture';
import { initialDraft, loadDraft, racePreset, LAYER_OPTIONS } from '../src/game/characterCreator/catalog';
import { pieceArt, svgDocument } from '../src/game/characterCreator/art';
afterEach(()=>vi.unstubAllGlobals());
it('recupera apenas rascunhos compatíveis e isolados pela sala',()=>{
 const draft={...initialDraft(),humanBonusAttribute:'dex'};
 const getItem=vi.fn((key:string)=>key==='df_char_draft_AB2CD'?JSON.stringify(draft):null);
 vi.stubGlobal('localStorage',{getItem});
 expect(loadDraft('AB2CD')).toEqual(draft);expect(loadDraft('XY2ZW')).toEqual(initialDraft());
 vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({...draft,name:''})});expect(loadDraft('AB2CD').name).toBe('');
 for(const stored of ['{','null',JSON.stringify({...draft,raceId:'INVALID'}),JSON.stringify({...draft,visualConfig:{...draft.visualConfig,layers:{...draft.visualConfig.layers,'70_front_hair':'unknown'}}})]){
  vi.stubGlobal('localStorage',{getItem:()=>stored});expect(loadDraft('AB2CD')).toEqual(initialDraft());
 }
 vi.stubGlobal('localStorage',{getItem:()=>{throw new Error('blocked');}});expect(loadDraft('AB2CD')).toEqual(initialDraft());
});
it('todos os presets raciais e pares de peças respeitam o contrato do servidor',()=>{
 for(const race of RACE_IDS){
 const visualConfig=racePreset(race);
 expect(CharacterCreationSchema.safeParse({...characterPayload(),raceId:race,humanBonusAttribute:race==='HUMAN'?'str':undefined,visualConfig}).success).toBe(true);
 for(const [layer,options] of Object.entries(LAYER_OPTIONS))for(const option of options){
 const pair=pieceArt(layer as keyof typeof LAYER_OPTIONS,option,race);
 expect(pair).toHaveLength(2);
 for(const svg of pair){expect(svgDocument(svg)).toContain('viewBox="0 0 512 512"');expect(svg).not.toContain('undefined');}
 }
 }
});
