/** Deterministic portable short-surface detail. No shaders, canvas, clocks or network. */
namespace LWAssetSurfaceContract {
 export interface Surface {version?:1|2;kind:'fur'|'cloth'|'leather';seed:number;scale:number;strength:number;}
 export interface Pixels {width:number;height:number;color:Uint8Array;normal:Uint8Array;}
 export interface Api {readonly algorithmVersion:'littlewild-surface-v1';algorithm(surface:Surface):'littlewild-surface-v1'|'littlewild-surface-v2';key(surface:Surface):string;generate(surface:Surface):Pixels;sphereUVs(positions:readonly number[]):number[];png(pixels:Uint8Array,width:number,height:number):Uint8Array;}
}
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWAssetSurface?:LWAssetSurfaceContract.Api};
 type Surface=LWAssetSurfaceContract.Surface;
 const SIZE=128;
 function algorithm(surface:Surface):'littlewild-surface-v1'|'littlewild-surface-v2'{return surface.version===2?'littlewild-surface-v2':'littlewild-surface-v1';}
 function key(surface:Surface):string{return [surface.kind,surface.seed,surface.scale,surface.strength].join('/')+(surface.version===2?'/v2':'');}
 function noise(x:number,y:number,seed:number):number{
  let n=Math.imul(x^seed,374761393)^Math.imul(y+seed,668265263);
  n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;
 }
 function generate(surface:Surface):LWAssetSurfaceContract.Pixels{
  if((surface.version!==undefined&&surface.version!==1&&surface.version!==2)||!['fur','cloth','leather'].includes(surface.kind)||!Number.isInteger(surface.seed)||surface.seed<0||surface.seed>65535||!Number.isFinite(surface.scale)||surface.scale<1||surface.scale>16||!Number.isFinite(surface.strength)||surface.strength<0||surface.strength>1)throw Error('Invalid bounded asset surface');
  const heights=new Float64Array(SIZE*SIZE),color=new Uint8Array(SIZE*SIZE*4),normal=new Uint8Array(color.length);
  const sample=(x:number,y:number)=>noise((x+SIZE)%SIZE,(y+SIZE)%SIZE,surface.seed);
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const grain=sample(x,y);let h:number;
   if(surface.kind==='fur'){
    // Short vertical fibres, staggered rather than a repetitive checkerboard.
    h=.55*sample(x,Math.floor(y/4))+.25*sample(x-1,Math.floor((y+2)/4))+.2*grain;
   }else if(surface.kind==='cloth'){
    const warp=.5+.5*Math.cos(x*Math.PI/2),weft=.5+.5*Math.cos(y*Math.PI/2);
    h=.45*warp+.45*weft+.1*grain;
   }else h=.65*grain+.35*sample(Math.floor(x/3),Math.floor(y/3));
   heights[y*SIZE+x]=h;
  }
  if(surface.version===2)fineHeights(surface,heights);
  const height=(x:number,y:number)=>heights[((y+SIZE)%SIZE)*SIZE+(x+SIZE)%SIZE]!;
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   const i=(y*SIZE+x)*4,h=height(x,y),strength=surface.strength;
   const relief=surface.version===2?.38:.65;
   const dx=(height(x-1,y)-height(x+1,y))*strength*relief,dy=(height(x,y-1)-height(x,y+1))*strength*relief;
   const length=Math.hypot(dx,dy,1),shade=Math.round(255-(1-h)*strength*(surface.version===2?18:surface.kind==='fur'?26:20));
   color.set([shade,shade,shade,255],i);normal.set([Math.round((dx/length*.5+.5)*255),Math.round((dy/length*.5+.5)*255),Math.round((1/length*.5+.5)*255),255],i);
  }
  return {width:SIZE,height:SIZE,color,normal};
 }
 /** Version 2 uses continuous tapered strands; version 1 above remains byte-for-byte replayable. */
 function fineHeights(surface:Surface,heights:Float64Array):void{
  const sample=(x:number,y:number)=>noise((x+SIZE)%SIZE,(y+SIZE)%SIZE,surface.seed);
  if(surface.kind==='fur'){
   for(let i=0;i<heights.length;i++)heights[i]=.28+.025*sample(i%SIZE,Math.floor(i/SIZE));
   for(let strand=0;strand<1800;strand++){
    const x0=noise(strand,0,surface.seed)*SIZE,y0=Math.floor(noise(strand,1,surface.seed)*SIZE);
    const length=6+Math.floor(noise(strand,2,surface.seed)*13),lean=(noise(strand,3,surface.seed)-.5)*.6;
    const width=.45+noise(strand,4,surface.seed)*.35,relief=.25+.3*noise(strand,5,surface.seed);
    for(let step=0;step<length;step++){
     const t=step/(length-1),center=x0+lean*step+Math.sin(t*Math.PI)*.65;
     const envelope=Math.pow(Math.sin(t*Math.PI),.65),y=(y0+step)%SIZE;
     for(let offset=-1;offset<=1;offset++){
      const x=Math.floor(center)+offset,distance=Math.abs(x+.5-center)/width;
      if(distance>=1.5)continue;
      const h=.28+relief*envelope*Math.exp(-distance*distance*2),index=y*SIZE+((x%SIZE)+SIZE)%SIZE;
      heights[index]=Math.max(heights[index]!,h);
     }
    }
   }
   return;
  }
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
   if(surface.kind==='cloth'){
    const warp=.5+.5*Math.cos(x*Math.PI/2),weft=.5+.5*Math.cos(y*Math.PI/2);
    const over=(Math.floor(x/4)+Math.floor(y/4))%2===0;
    heights[y*SIZE+x]=.3+.25*(over?warp:weft)+.08*(over?weft:warp)+.025*sample(x,y);
   }else heights[y*SIZE+x]=.4+.08*sample(x,y)+.06*(sample(x-1,y)+sample(x+1,y)+sample(x,y-1)+sample(x,y+1));
  }
 }
 /** Legacy meshes get a local spherical projection; authored seam-aware UVs take precedence. */
 function sphereUVs(positions:readonly number[]):number[]{
  const out:number[]=[];for(let i=0;i<positions.length;i+=3){const x=positions[i]!,y=positions[i+1]!,z=positions[i+2]!,r=Math.hypot(x,y,z);out.push(.5+Math.atan2(z,x)/(2*Math.PI),r?Math.acos(Math.max(-1,Math.min(1,y/r)))/Math.PI:.5);}return out;
 }
 const crcTable=Array.from({length:256},(_,v)=>{for(let bit=0;bit<8;bit++)v=v&1?0xedb88320^(v>>>1):v>>>1;return v>>>0;});
 function crc(bytes:Uint8Array):number{let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]!^(n>>>8);return (n^0xffffffff)>>>0;}
 function chunk(name:string,data:Uint8Array):Uint8Array{
  const out=new Uint8Array(data.length+12),view=new DataView(out.buffer);view.setUint32(0,data.length);for(let i=0;i<4;i++)out[4+i]=name.charCodeAt(i);out.set(data,8);view.setUint32(out.length-4,crc(out.subarray(4,out.length-4)));return out;
 }
 /** Minimal RGBA PNG encoder using stored DEFLATE blocks; bytes are identical in Node and browsers. */
 function png(pixels:Uint8Array,width:number,height:number):Uint8Array{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>128||height>128||pixels.length!==width*height*4)throw Error('Surface PNG dimensions exceed 128 x 128');
  const raw=new Uint8Array(height*(1+width*4));for(let y=0;y<height;y++)raw.set(pixels.subarray(y*width*4,(y+1)*width*4),y*(1+width*4)+1);
  const blocks=Math.ceil(raw.length/65535),zlib=new Uint8Array(2+raw.length+blocks*5+4);zlib.set([0x78,0x01]);let cursor=2;
  for(let start=0;start<raw.length;start+=65535){const n=Math.min(65535,raw.length-start),last=start+n===raw.length;zlib[cursor++]=last?1:0;zlib[cursor++]=n&255;zlib[cursor++]=n>>>8;zlib[cursor++]=(~n)&255;zlib[cursor++]=((~n)>>>8)&255;zlib.set(raw.subarray(start,start+n),cursor);cursor+=n;}
  let a=1,b=0;for(const value of raw){a=(a+value)%65521;b=(b+a)%65521;}new DataView(zlib.buffer).setUint32(cursor,((b<<16)|a)>>>0);
  const ihdr=new Uint8Array(13),iv=new DataView(ihdr.buffer);iv.setUint32(0,width);iv.setUint32(4,height);ihdr.set([8,6,0,0,0],8);
  const parts=[new Uint8Array([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib),chunk('IEND',new Uint8Array())];
  const out=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));cursor=0;for(const part of parts){out.set(part,cursor);cursor+=part.length;}return out;
 }
 const api=Object.freeze({algorithmVersion:'littlewild-surface-v1' as const,algorithm,key,generate,sphereUVs,png});root.LWAssetSurface=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
