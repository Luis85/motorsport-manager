/// <reference path="./building-interior-data-contracts.d.ts" />
/* Discrete room connectivity shared by authored validation and authoritative movement. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWInteriorPaths?:unknown};
 const directions=[{x:0,y:-1,side:'n',back:'s'},{x:1,y:0,side:'e',back:'w'},{x:0,y:1,side:'s',back:'n'},{x:-1,y:0,side:'w',back:'e'}] as const;
 const key=(p:LWInterior.Point):string=>p.x+','+p.y;
 function cells(f:LWInterior.Floor):LWInterior.Point[]{return f.cells||Array.from({length:f.width*f.height},(_,i)=>({x:i%f.width,y:Math.floor(i/f.width)}));}
 function path(f:LWInterior.Floor,from:LWInterior.Point,to:LWInterior.Point):LWInterior.Point[]|null{
  const allowed=new Set(cells(f).map(key)),start={x:Math.round(from.x),y:Math.round(from.y)},end={x:Math.round(to.x),y:Math.round(to.y)};
  if(!allowed.has(key(start))||!allowed.has(key(end)))return null;
  const queue=[start],previous=new Map<string,LWInterior.Point|null>([[key(start),null]]);
  for(let index=0;index<queue.length;index++){
   const p=queue[index]!;if(key(p)===key(end)){const result:LWInterior.Point[]=[];let point:LWInterior.Point|null=p;while(point){result.unshift(point);point=previous.get(key(point))||null;}return result.length===1&&(from.x!==end.x||from.y!==end.y)?[end]:result.slice(1);}
   for(const d of directions){const next={x:p.x+d.x,y:p.y+d.y};if(!allowed.has(key(next))||previous.has(key(next)))continue;
    if(f.edges?.some(e=>e.kind!=='door'&&((e.x===p.x&&e.y===p.y&&e.side===d.side)||(e.x===next.x&&e.y===next.y&&e.side===d.back))))continue;
    previous.set(key(next),p);queue.push(next);
   }
  }return null;
 }
 function validate(f:LWInterior.Floor):void{
  const owned=new Set(cells(f).map(key));
  for(const edge of f.edges||[]){if(!owned.has(key(edge)))throw Error('Building interiors: edge has no floor cell.');const direction=directions.find(d=>d.side===edge.side)!,neighbor={x:edge.x+direction.x,y:edge.y+direction.y};const counterpart=f.edges?.find(e=>e.x===neighbor.x&&e.y===neighbor.y&&e.side===direction.back);if(counterpart&&counterpart.kind!==edge.kind)throw Error('Building interiors: contradictory boundary edges.');}
  const points=[...cells(f),...f.stations,f.door,...f.stairs];for(const p of points)if(path(f,f.door,p)===null)throw Error('Building interiors: disconnected room cell, station or stair.');
 }
 root.LWInteriorPaths=Object.freeze({path,cells,validate});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWInteriorPaths;
})(globalThis);
