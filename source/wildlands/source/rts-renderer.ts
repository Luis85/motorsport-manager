/// <reference path="./rts-demo-contracts.d.ts" />
/** Isometric presentation reads snapshots; camera gestures never mutate the world. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSRenderer?:LWRTSDemo.RendererApi};
 const palette={soil:'#d9d9b4',grid:'#b7be98',water:'#8baeb2',ink:'#31463d',fog:'#31463d',friendly:'#426a54',enemy:'#b77770',rose:'#b77770',gold:'#b78f4e',paper:'#fffef8'};
 function visible(view:LWRTSDemo.Snapshot,x:number,y:number,explored=false):boolean {
  const tiles=explored?view.fog.explored:view.fog.visible;
  return tiles.includes(y*view.map.width+x)||tiles.includes(x+','+y);
 }
 function create(canvas:HTMLCanvasElement):LWRTSDemo.Renderer {
  const context=canvas.getContext('2d')!;
  let view:LWRTSDemo.Snapshot|null=null,scale=1,zoom=1,center:LWRTSDemo.Point|null=null,origin={x:0,y:0};
  function screen(point:LWRTSDemo.Point):LWRTSDemo.Point{return {x:origin.x+(point.x-point.y)*scale*2,y:origin.y+(point.x+point.y)*scale};}
  function world(point:LWRTSDemo.Point):LWRTSDemo.Point {
   const x=(point.x-origin.x)/(scale*2),y=(point.y-origin.y)/scale;
   return {x:(x+y)/2,y:(y-x)/2};
  }
  function diamond(x:number,y:number,w:number,h:number,fill:string,stroke?:string):void {
   context.beginPath();context.moveTo(x,y-h);context.lineTo(x+w,y);context.lineTo(x,y+h);context.lineTo(x-w,y);context.closePath();context.fillStyle=fill;context.fill();
   if(stroke){context.strokeStyle=stroke;context.stroke();}
  }
  function terrain(snapshot:LWRTSDemo.Snapshot):void {
   for(let sum=0;sum<snapshot.map.width+snapshot.map.height;sum++)for(let x=0;x<snapshot.map.width;x++){
    const y=sum-x;if(y<0||y>=snapshot.map.height)continue;
    const point=screen({x:x+.5,y:y+.5}),tile=snapshot.map.tiles[y*snapshot.map.width+x];
    const id=typeof tile==='string'?tile:tile?.terrain;
    const definition=snapshot.catalog.terrain.find(value=>value.id===id);
    diamond(point.x,point.y,scale*2,scale,definition?.color||palette.soil,palette.grid);
    if(!visible(snapshot,x,y)){context.globalAlpha=visible(snapshot,x,y,true)?.48:.94;diamond(point.x,point.y,scale*2,scale,palette.fog);context.globalAlpha=1;}
   }
  }
  function entity(snapshot:LWRTSDemo.Snapshot,value:LWRTSDemo.Entity,selected:boolean):void {
   if(!visible(snapshot,Math.floor(value.x),Math.floor(value.y))&&value.faction!==snapshot.playerFaction)return;
   const point=screen(value),unit=snapshot.catalog.units.find(row=>row.id===value.definition),building=snapshot.catalog.buildings.find(row=>row.id===value.definition);
   const faction=snapshot.catalog.factions.find(row=>row.id===value.faction),color=faction?.color||unit?.color||building?.color||palette.gold;
   const size=Math.max(5,scale*.58),height=building?scale*2.5:size*1.8;
   context.globalAlpha=value.complete===false?.65:1;
   if(selected&&unit?.attack){context.save();context.globalAlpha=.3;context.strokeStyle=color;context.setLineDash([4,4]);context.beginPath();context.ellipse(point.x,point.y,unit.attack.range*scale*2,unit.attack.range*scale,0,0,Math.PI*2);context.stroke();context.restore();}
   if(selected){context.strokeStyle=palette.paper;context.lineWidth=2;context.beginPath();context.ellipse(point.x,point.y+2,size*(building?2.5:1.5),size*.7,0,0,Math.PI*2);context.stroke();}
   if(building){
    const w=scale*building.footprint.width,h=scale*building.footprint.height;
    diamond(point.x,point.y,w*2,h,palette.ink);
    context.fillStyle=color;context.beginPath();context.moveTo(point.x-w*2,point.y);context.lineTo(point.x-w*2,point.y-height);context.lineTo(point.x,point.y-height+h);context.lineTo(point.x+w*2,point.y-height);context.lineTo(point.x+w*2,point.y);context.lineTo(point.x,point.y+h);context.closePath();context.fill();
    diamond(point.x,point.y-height,w*2,h,color,palette.paper);
    context.fillStyle=palette.paper;context.fillRect(point.x-size*.4,point.y-height*.5,size*.8,height*.4);
   }else if(value.category==='resource'||value.category==='deposit'){
    context.fillStyle=snapshot.catalog.resources.find(row=>row.id===(value.resource||value.definition))?.color||palette.gold;
    context.beginPath();context.moveTo(point.x-size,point.y);context.lineTo(point.x-size*.5,point.y-size*2.2);context.lineTo(point.x+size*.3,point.y-size*2.8);context.lineTo(point.x+size,point.y);context.closePath();context.fill();
   }else{
    context.fillStyle=palette.ink;context.globalAlpha=.22;context.beginPath();context.ellipse(point.x,point.y+2,size*1.2,size*.5,0,0,Math.PI*2);context.fill();context.globalAlpha=1;context.fillStyle=color;
    if(unit?.shape==='tank'||unit?.shape==='boat'){context.fillRect(point.x-size*1.5,point.y-size,size*3,size*1.4);context.strokeStyle=palette.paper;context.beginPath();context.moveTo(point.x,point.y-size);context.lineTo(point.x+size*2,point.y-size*1.8);context.stroke();}
    else if(unit?.shape==='plane'){context.beginPath();context.moveTo(point.x,point.y-size*2);context.lineTo(point.x+size*2,point.y);context.lineTo(point.x,point.y-size*.5);context.lineTo(point.x-size*2,point.y);context.closePath();context.fill();}
    else{context.fillRect(point.x-size*.55,point.y-height*.65,size*1.1,height*.65);context.beginPath();context.arc(point.x,point.y-height,size*.55,0,Math.PI*2);context.fill();if(unit?.shape==='horse'||unit?.shape==='animal')context.fillRect(point.x-size,point.y-size,size*2,size*.65);}
   }
   context.globalAlpha=1;
   if(selected||value.hp<value.maxHp){context.fillStyle=palette.ink;context.fillRect(point.x-14,point.y-height-12,28,4);context.fillStyle=color;context.fillRect(point.x-14,point.y-height-12,28*Math.max(0,value.hp/value.maxHp),4);}
   if(value.complete===false){context.fillStyle=palette.gold;context.fillRect(point.x-14,point.y-height-5,28*(value.progress||0),3);}
  }
  function draw(snapshot:LWRTSDemo.Snapshot,selected:readonly string[],placement:string|null,hover:LWRTSDemo.Point|null):void {
   view=snapshot;const rect=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);
   canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);context.setTransform(dpr,0,0,dpr,0,0);
   scale=Math.max(2,Math.min(rect.width/(snapshot.map.width+snapshot.map.height)/2,rect.height/(snapshot.map.width+snapshot.map.height+5)))*zoom;
   origin={x:rect.width/2-(snapshot.map.width-snapshot.map.height)*scale,y:Math.max(30,(rect.height-(snapshot.map.width+snapshot.map.height)*scale)/2)};
   if(center)origin={x:rect.width/2-(center.x-center.y)*scale*2,y:rect.height/2-(center.x+center.y)*scale};
   context.fillStyle=palette.paper;context.fillRect(0,0,rect.width,rect.height);terrain(snapshot);
   [...snapshot.entities].sort((a,b)=>a.x+a.y-b.x-b.y||a.id.localeCompare(b.id)).forEach(value=>entity(snapshot,value,selected.includes(value.id)));
   for(const projectile of snapshot.projectiles||[]){const point=screen(projectile);context.fillStyle=palette.gold;context.beginPath();context.arc(point.x,point.y-scale,3,0,Math.PI*2);context.fill();}
   for(const event of snapshot.events){
    if(typeof event==='string'||event.tick===undefined||snapshot.tick-event.tick>3)continue;
    if(event.kind==='attack'){const source=snapshot.entities.find(value=>value.id===event.source),target=snapshot.entities.find(value=>value.id===event.target);if(source&&target){const a=screen(source);context.fillStyle=palette.gold;context.beginPath();context.arc(a.x,a.y-scale,3,0,Math.PI*2);context.fill();}}
    if(event.kind==='impact'&&event.x!==undefined&&event.y!==undefined){const point=screen({x:event.x,y:event.y});context.strokeStyle=palette.rose;context.beginPath();context.arc(point.x,point.y-scale,4+(snapshot.tick-event.tick)*2,0,Math.PI*2);context.stroke();}
   }
   if(placement&&hover){const building=snapshot.catalog.buildings.find(row=>row.id===placement);if(building){const point=screen({x:Math.floor(hover.x)+.5,y:Math.floor(hover.y)+.5});context.globalAlpha=.65;diamond(point.x,point.y,scale*building.footprint.width*2,scale*building.footprint.height,palette.friendly,palette.paper);context.globalAlpha=1;}}
  }
  function hit(point:LWRTSDemo.Point):LWRTSDemo.Entity|null {
   if(!view)return null;return [...view.entities].reverse().filter(value=>visible(view!,Math.floor(value.x),Math.floor(value.y))||value.faction===view!.playerFaction).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y)).find(value=>Math.hypot(value.x-point.x,value.y-point.y)<(view!.catalog.buildings.some(b=>b.id===value.definition)?1.7:.8))||null;
  }
  return {draw,screen,world,hit,zoom(delta){zoom=Math.max(.65,Math.min(2.5,zoom*delta));},center(point){center={x:point.x,y:point.y};zoom=Math.max(zoom,1.4);},reset(){zoom=1;center=null;}};
 }
 function minimap(canvas:HTMLCanvasElement,view:LWRTSDemo.Snapshot):void {
  const context=canvas.getContext('2d')!,sx=canvas.width/view.map.width,sy=canvas.height/view.map.height;
  context.fillStyle=palette.soil;context.fillRect(0,0,canvas.width,canvas.height);
  for(let y=0;y<view.map.height;y++)for(let x=0;x<view.map.width;x++)if(!visible(view,x,y)){context.fillStyle=visible(view,x,y,true)?'#7f8a79':palette.fog;context.fillRect(x*sx,y*sy,Math.ceil(sx),Math.ceil(sy));}
  for(const entity of view.entities){if(!visible(view,Math.floor(entity.x),Math.floor(entity.y))&&entity.faction!==view.playerFaction)continue;context.fillStyle=view.catalog.factions.find(row=>row.id===entity.faction)?.color||palette.gold;context.fillRect(entity.x*sx-2,entity.y*sy-2,4,4);}
 }
 root.LWRTSRenderer={create,minimap};
})(typeof window!=='undefined'?window:globalThis);
