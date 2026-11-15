import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
const folder = new URL('../apps/client/public/icons/', import.meta.url); mkdirSync(folder, { recursive: true });
function crc32(data) { let c = -1; for (const b of data) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; }
function chunk(type, data) { const t = Buffer.from(type), n = Buffer.alloc(4), crc = Buffer.alloc(4); n.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t,data]))); return Buffer.concat([n,t,data,crc]); }
function icon(size, name) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const vertices = Array.from({length: 6}, (_, i) => { const a = Math.PI / 3 * i - Math.PI / 2; return [0.5 + Math.cos(a) * 0.32, 0.5 + Math.sin(a) * 0.32]; });
  const edges = vertices.map((v,i) => [v, vertices[(i+1)%6]]);
  const center = [0.5,0.5]; for (let i = 0; i < 6; i++) edges.push([vertices[i], center]);
  const distance = (x,y,a,b) => { const dx=b[0]-a[0],dy=b[1]-a[1],u=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy))); return Math.hypot(x-a[0]-u*dx,y-a[1]-u*dy); };
  for (let y=0;y<size;y++) for(let x=0;x<size;x++) {
    const px=(x+0.5)/size,py=(y+0.5)/size, d=Math.min(...edges.map(([a,b]) => distance(px,py,a,b)));
    const gold=Math.max(0,Math.min(1,(0.012-d)*size+0.5)); const index=y*(size*4+1)+1+x*4;
    for(let k=0;k<3;k++) pixels[index+k]=Math.round([15,23,42][k]*(1-gold)+[217,182,107][k]*gold); pixels[index+3]=255;
  }
  const header=Buffer.alloc(13);header.writeUInt32BE(size);header.writeUInt32BE(size,4);header[8]=8;header[9]=6;
  writeFileSync(new URL(name,folder),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]));
}
for (const [size,name] of [[192,'icon-192.png'],[512,'icon-512.png'],[512,'icon-maskable-512.png'],[180,'apple-touch-icon.png']]) icon(size,name);
