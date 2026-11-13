import { Container, Graphics, Rectangle, Sprite } from 'pixi.js';
import type { ModularRenderer } from './ModularRenderer';
const dataUrl=(canvas:{toDataURL?: (type?:string,quality?:number)=>string})=>{
 if(!canvas.toDataURL)throw new Error('Exportação de canvas indisponível.');
 const value=canvas.toDataURL('image/webp',.88);
 if(!value.startsWith('data:image/webp;base64,'))throw new Error('Seu navegador não oferece exportação WebP. Use uma versão atual do navegador.');
 return value;
};
export async function exportCharacter(renderer:ModularRenderer) {
 const {app,character}=renderer;
 app.render();
 const portraitCanvas=await app.renderer.extract.canvas({target:character,frame:new Rectangle(0,0,512,512),resolution:1});
 const portraitBase64=dataUrl(portraitCanvas);
 const texture=app.renderer.generateTexture({target:character,frame:new Rectangle(0,0,512,512),resolution:1});
 const token=new Container();
 try {
  const sprite=new Sprite(texture);sprite.width=sprite.height=128;
  const mask=new Graphics().circle(64,64,60).fill(0xffffff);
  sprite.mask=mask;token.addChild(sprite,mask);
  token.addChild(new Graphics().circle(64,64,60).stroke({width:5,color:0x635037}).circle(64,64,60).stroke({width:3,color:0xd7b776}).circle(64,64,57).stroke({width:1,color:0xffe8ab}));
  const tokenCanvas=await app.renderer.extract.canvas({target:token,frame:new Rectangle(0,0,128,128),resolution:1});
  const tokenBase64=dataUrl(tokenCanvas);
  const bytes=(value:string)=>atob(value.split(',')[1]).length;
  if(bytes(portraitBase64)+bytes(tokenBase64)>=50*1024)throw new Error('As imagens ultrapassaram 50 KiB. Simplifique as peças e tente novamente.');
  return {portraitBase64,tokenBase64};
 } finally {token.destroy({children:true,texture:false});texture.destroy(true);}
}
