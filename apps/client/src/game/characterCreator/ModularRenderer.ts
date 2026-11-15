import { Application, Container, Sprite, Texture } from 'pixi.js';
import { VISUAL_LAYER_IDS, type RaceId, type VisualConfig } from '@df/shared';
import { pieceArt, svgDocument } from './art';
import { LAYER_OPTIONS, type LayerId } from './catalog';
const colorKey: Record<LayerId,string> = {'00_back_hair':'hair','10_body_base':'skin','20_skin_details':'details','30_ears':'skin','40_eyes_iris':'eyes','50_mouth_fangs':'skin','60_facial_hair':'hair','70_front_hair':'hair','80_horns':'horns'};
async function rasterize(svg:string):Promise<Texture> {
 const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
 try {const image=new Image(); image.src=url; await image.decode();
 const canvas=document.createElement('canvas'); canvas.width=canvas.height=512;
 const context=canvas.getContext('2d'); if(!context) throw new Error('Canvas 2D indisponível.');
 context.drawImage(image,0,0); return Texture.from(canvas);
 } finally {URL.revokeObjectURL(url);}
}
export class ModularRenderer {
 readonly app=new Application();
 readonly character=new Container({sortableChildren:true});
 private disposed=false;
 private revision=0;
 private initialized=false;
 private pending:Promise<void>=Promise.resolve();
 private layers=new Map<LayerId,{key:string;container:Container;shading:Sprite;ink:Sprite}>();
 async init(host:HTMLElement) {
  await this.app.init({width:512,height:512,resolution:1,backgroundAlpha:0,antialias:true,autoStart:false,preference:'webgl'});
  this.initialized=true;
  if(this.disposed){this.app.destroy({removeView:true,releaseGlobalResources:false},{children:true,texture:false});return;}
  this.app.stage.addChild(this.character); host.appendChild(this.app.canvas);
 }
 update(race:RaceId,config:VisualConfig):Promise<void> {
  const revision=++this.revision;
  // Serialize texture creation so rapid edits cannot allocate unbounded concurrent textures.
  this.pending=this.pending.catch(()=>{}).then(async()=>{
   if(this.disposed||revision!==this.revision)return;
   for(const [index,id] of VISUAL_LAYER_IDS.entries()) {
    const options=LAYER_OPTIONS[id] as readonly string[];
    const option=config.layers[id]??options[0];
    if(!options.includes(option))throw new Error('Peça modular inválida.');
    const key=`${race}:${option}`;
    let layer=this.layers.get(id);
    if(layer?.key!==key) {
     const art=pieceArt(id,option,race);
     const textures:Texture[]=[];
     try {for(const content of art) textures.push(await rasterize(svgDocument(content)));}
     catch(error){textures.forEach(t=>t.destroy(true));throw error;}
     if(this.disposed||revision!==this.revision){textures.forEach(t=>t.destroy(true));return;}
     if(layer)this.release(layer);
     // Ears sit behind the face so their skin fill cannot cover its outline.
     const zIndex=id==='30_ears'?5:index*10;
     const container=new Container({zIndex,label:id});
     const shading=new Sprite(textures[0]),ink=new Sprite(textures[1]);
     ink.tint=0xFFFFFF;container.addChild(shading,ink);this.character.addChild(container);
     layer={key,container,shading,ink};this.layers.set(id,layer);
    }
    layer.shading.tint=config.colors[colorKey[id]]??'#FFFFFF';
   }
   if(!this.disposed&&revision===this.revision)this.app.render();
  });
  return this.pending;
 }
 private release(layer:{container:Container;shading:Sprite;ink:Sprite}) {
  const textures=[layer.shading.texture,layer.ink.texture];
  layer.container.destroy({children:true,texture:false});
  textures.forEach(texture=>texture.destroy(true));
 }
 get textureCount(){return this.layers.size*2;}
 destroy(){
  if(this.disposed)return;
  this.disposed=true;++this.revision;
  for(const layer of this.layers.values())this.release(layer);
  this.layers.clear();
  if(this.initialized)this.app.destroy({removeView:true,releaseGlobalResources:false},{children:true,texture:false});
 }
}
