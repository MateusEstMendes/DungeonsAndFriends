import { useEffect, useRef, useState } from 'react';
import { ATTRIBUTE_IDS, RACE_IDS, RACES, ARCHETYPE_IDS, ARCHETYPES, applyRacialModifiers, calculateMaxHp, calculateMaxMp, calculateBaseDefense, calculatePassiveDodge, calculateSpeed, calculateFlatDR, getModifier, validatePointBuy, canIncrementAttribute, CharacterCreationSchema, type RaceId, type AttributeId } from '@df/shared';
import { loadDraft, racePreset, LAYER_LABELS, LAYER_OPTIONS, OPTION_LABELS, RACE_SYMBOLS, type CharacterDraft, type LayerId } from '../../game/characterCreator/catalog';
import { ModularRenderer } from '../../game/characterCreator/ModularRenderer';
import { exportCharacter } from '../../game/characterCreator/TokenExporter';
import { submitCharacter } from '../../network/colyseusClient';
import { useGameStore } from '../../store/useGameStore';
import './character.css';
const attrNames:Record<AttributeId,string>={str:'Força',dex:'Destreza',con:'Constituição',int:'Inteligência',wis:'Sabedoria',cha:'Carisma'};
const attrShort:Record<AttributeId,string>={str:'FOR',dex:'DES',con:'CON',int:'INT',wis:'SAB',cha:'CAR'};
const tabs=['Origem','Atributos','Aparência'];
const signed=(n:number)=>n>=0?`+${n}`:String(n);
export function CharacterCreatorScreen(){
 const roomCode=useGameStore(s=>s.roomCode),connected=useGameStore(s=>s.connectionState==='CONNECTED');
 const [draft,setDraft]=useState<CharacterDraft>(()=>loadDraft(roomCode));
 const [tab,setTab]=useState(0),[ready,setReady]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[saveWarning,setSaveWarning]=useState(false),[retry,setRetry]=useState(0);
 const host=useRef<HTMLDivElement>(null),renderer=useRef<ModularRenderer|null>(null),latest=useRef(draft); latest.current=draft;
 const touch=useRef<{x:number;y:number}|null>(null);
 const mounted=useRef(true);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>{
  const instance=new ModularRenderer();renderer.current=instance;let cancelled=false;setReady(false);
  void instance.init(host.current!).then(async()=>{if(cancelled)return;await instance.update(latest.current.raceId,latest.current.visualConfig);if(!cancelled)setReady(true);}).catch(()=>{if(!cancelled)setError('Não foi possível iniciar o retrato. Verifique se a aceleração gráfica está disponível e tente novamente.');});
  return()=>{cancelled=true;instance.destroy();if(renderer.current===instance)renderer.current=null;};
 },[retry]);
 useEffect(()=>{if(!ready)return;void renderer.current?.update(draft.raceId,draft.visualConfig).catch(()=>setError('Não foi possível atualizar o retrato. Tente recarregar o preview.'));},[draft.raceId,draft.visualConfig,ready]);
 useEffect(()=>{try{localStorage.setItem(`df_char_draft_${roomCode}`,JSON.stringify(draft));setSaveWarning(false);}catch{setSaveWarning(true);}},[draft,roomCode]);
 const pointBuy=validatePointBuy(draft.baseAttributes);
 const final=applyRacialModifiers(draft.baseAttributes,draft.raceId,draft.raceId==='HUMAN'?(draft.humanBonusAttribute??'str'):undefined);
 if(draft.raceId==='HUMAN'&&!draft.humanBonusAttribute)final.str-=1;
 const dex=getModifier(final.dex),wis=getModifier(final.wis);
 const stats=[['Vida',calculateMaxHp(getModifier(final.con))],['Mana',calculateMaxMp(final.int,wis)],['Defesa',calculateBaseDefense(dex,draft.raceId)],['Esquiva',`${calculatePassiveDodge(dex,draft.raceId)}%`],['Velocidade',calculateSpeed(dex)],['Redução',calculateFlatDR(draft.raceId)]];
 const missingBonus=draft.raceId==='HUMAN'&&!draft.humanBonusAttribute;
 function chooseRace(raceId:RaceId){setDraft(d=>({...d,raceId,humanBonusAttribute:undefined,visualConfig:racePreset(raceId)}));}
 function changeAttr(key:AttributeId,delta:number){setDraft(d=>({...d,baseAttributes:{...d.baseAttributes,[key]:d.baseAttributes[key]+delta}}));}
 async function conclude(){
  if(busy||!renderer.current||missingBonus)return;
  setBusy(true);setError('');
  try{
   const current=latest.current;
   await renderer.current.update(current.raceId,current.visualConfig);
   const images=await exportCharacter(renderer.current);
   const payload=CharacterCreationSchema.parse({...current,...images});
   await submitCharacter(payload);
   try{localStorage.removeItem(`df_char_draft_${roomCode}`);}catch{/* ficha confirmada; armazenamento é opcional */}
  }catch(e){if(mounted.current)setError(e instanceof Error?e.message:'Falha ao criar ficha. Seu rascunho foi preservado.');}
  finally{if(mounted.current)setBusy(false);}
 }
 return <section className="creator" aria-label="Criação de personagem">
  <header className="creator-heading"><span className="eyebrow">O início da sua lenda</span><h1>Dê vida ao seu <em>aventureiro</em></h1><p>Uma origem. Uma vocação. Uma história que só você pode contar.</p></header>
  <div className="creator-layout">
   <aside className="character-preview"><div className="portrait-frame"><span className="frame-star" aria-hidden="true">✧</span><div ref={host} className="portrait-canvas" role="img" aria-label={`Retrato de ${draft.name}, ${RACES[draft.raceId].name}`}/>{!ready&&<span className="preview-loading">Preparando retrato…</span>}<div className="portrait-caption"><span className="eyebrow">{RACES[draft.raceId].name} · {ARCHETYPES[draft.archetypeId].name}</span><h2>{draft.name||'Seu aventureiro'}</h2></div></div>
   <div className="derived-stats" aria-label="Status derivados" aria-live="polite">{stats.map(([label,value])=><div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>
   <p className="preview-note">✧ {missingBonus?'Escolha o bônus humano para finalizar os status.':'Os números já incluem seus bônus raciais.'}</p></aside>
   <div className="character-editor">
    <div className="creator-tabs" role="tablist" aria-label="Etapas da criação">{tabs.map((label,index)=><button key={label} id={`creator-tab-${index}`} role="tab" aria-selected={tab===index} aria-controls={`creator-panel-${index}`} tabIndex={tab===index?0:-1} onKeyDown={e=>{if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();const next=(index+(e.key==='ArrowRight'?1:2))%3;setTab(next);document.getElementById(`creator-tab-${next}`)?.focus();}}} onClick={()=>setTab(index)}><span>0{index+1}</span>{label}</button>)}</div>
    <fieldset className="creator-fields" disabled={busy}>
    <div role="tabpanel" id={`creator-panel-${tab}`} aria-labelledby={`creator-tab-${tab}`} className="creator-tab-content" key={tab} onTouchStart={e=>{const t=e.touches[0];touch.current={x:t.clientX,y:t.clientY};}} onTouchEnd={e=>{const start=touch.current;touch.current=null;if(!start||busy)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;if(Math.abs(dx)>70&&Math.abs(dy)<40)setTab(value=>Math.max(0,Math.min(2,value+(dx<0?1:-1))));}}>
    {tab===0&&<><label className="character-name">Nome do personagem<input maxLength={40} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Como sua lenda será conhecida?"/></label>
     <div className="section-title"><h2>Escolha sua origem</h2><span>8 raças</span></div>
     <div className="race-grid">{RACE_IDS.map(id=><button type="button" key={id} className={`race-card ${draft.raceId===id?'selected':''}`} aria-pressed={draft.raceId===id} onClick={()=>chooseRace(id)}><span className="race-symbol" aria-hidden="true">{RACE_SYMBOLS[id]}</span><strong>{RACES[id].name}</strong><small>{Object.entries(RACES[id].modifiers).map(([key,value])=>`${signed(value)} ${attrShort[key as AttributeId]}`).join(' · ')}</small></button>)}</div>
     <div className="racial-passive"><span aria-hidden="true">✦</span><div><strong>{RACES[draft.raceId].passive.name}</strong><p>{passiveDescription(draft.raceId)}</p></div></div>
     <div className="section-title"><h2>Siga sua vocação</h2><span>5 arquétipos</span></div><div className="archetype-grid">{ARCHETYPE_IDS.map(id=><button type="button" className={draft.archetypeId===id?'selected':''} key={id} aria-pressed={draft.archetypeId===id} onClick={()=>setDraft({...draft,archetypeId:id})}>{ARCHETYPES[id].name}</button>)}</div>
     <p className="ability-info"><strong>{ARCHETYPES[draft.archetypeId].signatureAbility.name}</strong> · {ARCHETYPES[draft.archetypeId].signatureAbility.cost.amount} {ARCHETYPES[draft.archetypeId].signatureAbility.cost.type==='MP'?'MP':'rodadas de recarga'}<br/>{ARCHETYPES[draft.archetypeId].signatureAbility.description}</p>
    </>}
    {tab===1&&<><div className="section-title"><h2>Forje seus atributos</h2><span className="point-budget" aria-live="polite">{pointBuy.remaining} / 27 disponíveis</span></div><p className="muted">Todos começam em 8. Os valores 14 e 15 custam 2 pontos por incremento.</p><div className="attribute-head"><span>Atributo base</span><span>Final · Mod.</span></div>{ATTRIBUTE_IDS.map(key=><div className="attribute-row" key={key}><label htmlFor={`base-${key}`}><b>{attrShort[key]}</b><span>{attrNames[key]}</span></label><div className="point-controls"><button aria-label={`Diminuir ${attrNames[key]}`} disabled={draft.baseAttributes[key]<=8} onClick={()=>changeAttr(key,-1)}>−</button><output id={`base-${key}`}>{draft.baseAttributes[key]}</output><button aria-label={`Aumentar ${attrNames[key]}`} disabled={!canIncrementAttribute(draft.baseAttributes[key],pointBuy.remaining)} onClick={()=>changeAttr(key,1)}>+</button></div><div className="final-attribute"><strong>{final[key]}</strong><small>{signed(getModifier(final[key]))}</small></div></div>)}
     {draft.raceId==='HUMAN'&&<label className="human-bonus">Adaptabilidade · +1 em um atributo à escolha<select value={draft.humanBonusAttribute??''} onChange={e=>setDraft({...draft,humanBonusAttribute:e.target.value as AttributeId})}><option value="" disabled>Escolha seu atributo extra</option>{ATTRIBUTE_IDS.map(key=><option key={key} value={key}>{attrNames[key]}</option>)}</select></label>}
     <p className="muted">Bônus raciais são aplicados depois da compra e não consomem pontos.</p></>}
    {tab===2&&<><div className="section-title"><h2>Uma face para sua lenda</h2><span>Preview em tempo real</span></div><div className="piece-grid">{(Object.keys(LAYER_OPTIONS) as LayerId[]).filter(id=>id!=='30_ears'&&(id!=='80_horns'||draft.raceId==='DEMON'||draft.raceId==='HALF_DRAGON')).map(id=><label key={id}>{LAYER_LABELS[id]}<select value={draft.visualConfig.layers[id]} onChange={e=>setDraft({...draft,visualConfig:{...draft.visualConfig,layers:{...draft.visualConfig.layers,[id]:e.target.value}}})}>{LAYER_OPTIONS[id].map(option=><option key={option} value={option}>{OPTION_LABELS[option]}</option>)}</select></label>)}</div><h2>Paleta do personagem</h2><div className="color-grid">{Object.entries({skin:'Pele',hair:'Cabelo e barba',eyes:'Íris',details:'Marcas e escamas',horns:'Chifres'}).map(([key,label])=><label key={key}><input type="color" aria-label={label} value={draft.visualConfig.colors[key]} onChange={e=>setDraft({...draft,visualConfig:{...draft.visualConfig,colors:{...draft.visualConfig.colors,[key]:e.target.value}}})}/><span>{label}<small>{draft.visualConfig.colors[key]}</small></span></label>)}</div><button className="reset-appearance" onClick={()=>setDraft({...draft,visualConfig:racePreset(draft.raceId)})}>Restaurar aparência da raça</button></>}
    </div></fieldset>
    {error&&<div className="creator-error" role="alert">{error}{!ready&&<button onClick={()=>{setError('');setRetry(n=>n+1);}}>Tentar preview novamente</button>}</div>}
    <div className="creator-bottom"><span>{saveWarning?'Seu navegador não permitiu salvar o rascunho.':'Rascunho salvo neste navegador'}</span><div className="step-actions">{tab>0&&<button disabled={busy} onClick={()=>setTab(tab-1)}>Voltar</button>}{tab<2?<button className="primary" onClick={()=>setTab(tab+1)}>Continuar <span aria-hidden="true">→</span></button>:<button className="primary" disabled={!ready||busy||!connected||!pointBuy.valid||!draft.name.trim()||missingBonus} onClick={()=>void conclude()}>{busy?'Salvando ficha…':'Concluir Ficha e Entrar na Masmorra'}</button>}</div>{tab===2&&missingBonus&&<button className="bonus-reminder" onClick={()=>setTab(1)}>Escolha seu bônus humano na aba Atributos.</button>}</div>
   </div>
  </div>
 </section>;
}
function passiveDescription(race:RaceId):string {return {HUMAN:'+1 em todos os atributos e +1 extra em um atributo à escolha.',DWARF:'+1 de redução de dano permanente.',ELF:'+5% de esquiva passiva, respeitando o teto de 20%.',ORC:'+2 de dano físico quando sua vida está abaixo de 30%.',VAMPIRE:'Recupera como vida 20% do dano corpo a corpo causado.',DEMON:'Ataques mágicos ignoram 2 pontos de redução de dano.',HALF_DRAGON:'+2 de Defesa base natural.',HALF_SHARK:'+2 de dano corpo a corpo contra alvos com vida abaixo de 50%.'}[race];}
