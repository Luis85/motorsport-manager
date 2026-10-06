/// <reference path="./renderer-contracts.d.ts" />
/** Detached scene geometry shared by the real 2D graphics backends. */
declare namespace LittlewildRenderer2D {
 interface Painter {
  polygon(points:readonly LittlewildRenderer.Point[],color:string,opacity?:number):void;
  circle(x:number,y:number,radius:number,color:string):void;
  text(value:string,x:number,y:number,color:string,size:number):void;
 }
 interface AssetOptions {model?:string;rotation?:number;scale?:number|readonly[number,number,number];opacity?:number;pose?:number;materials?:Readonly<Record<string,string>>;}
 interface Api {
  draw(frame:LittlewildRenderer.Frame,context:LittlewildRenderer.Context,painter:Painter):void;
  drawAsset(context:LittlewildRenderer.Context,painter:Painter,category:'actor'|'building'|'item',id:string,x:number,y:number,unit:number,options?:AssetOptions):boolean;
  project(tile:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame):LittlewildRenderer.Point;
  toTile(point:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame):LittlewildRenderer.Point;
  hitTest(point:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame):LittlewildRenderer.Hit|null;
 }
}
declare var LWRendererScene2D:LittlewildRenderer2D.Api;
(function(inputRoot:unknown){
 'use strict';
 type Point=LittlewildRenderer.Point;
 type Frame=LittlewildRenderer.Frame;
 type Context=LittlewildRenderer.Context;
 type Painter=LittlewildRenderer2D.Painter;
 type Vector=readonly[number,number,number];
 interface Node {id?:string;mesh?:string;primitive:string;position?:Vector;scale?:Vector;rotation?:Vector;material?:string;materialProps?:{opacity?:number};visible?:boolean;children?:readonly Node[];}
 interface Asset {meshes?:Readonly<Record<string,{positions:readonly number[];indices?:readonly number[]}>>;rig?:{arms?:readonly string[];head?:string};materials:Readonly<Record<string,string|{color:string;opacity?:number}>>;models:Readonly<Record<string,{nodes:readonly Node[]}>>;behaviors?:{appearances?:Readonly<Record<string,{model?:string;scale?:Vector;materials?:Readonly<Record<string,string>>}>>};}
 interface Face {points:Vector[];color:string;opacity:number;depth:number;}
 interface Layout {unit:number;cx:number;cy:number;x:number;y:number;}
 interface RoomLayout {unit:number;origin:Point;surface:LittlewildRenderer.Surface;floor:NonNullable<Frame['room']>['floors'][number];}
 interface Environment {background:string;floor:string;alternateFloor:string;trim:string;wall:string;}
 const root=inputRoot as {LWRendererScene2D?:LittlewildRenderer2D.Api},zero:Vector=[0,0,0],one:Vector=[1,1,1];
 const ink='#31463d',paper='#e3eadd',gold='#f3df9d';
 function record(value:unknown):Readonly<Record<string,unknown>> {return value&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,unknown>>:{};}
 function environment(frame:Frame):Environment|null {
  const value=record(frame.environment);if(value.mode!=='indoor')return null;
  const color=(key:string,fallback:string):string=>typeof value[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key])?value[key]:fallback;
  return{background:color('background','#dce3e8'),floor:color('floor','#e4e2d9'),alternateFloor:color('alternateFloor','#d6dadd'),wall:color('wall','#b8c7cf'),trim:color('trim','#577588')};
 }
 function bounds(frame:Frame):LWSceneGraph.Bounds|null {return frame.scene?.bounds??null;}
 function inside(point:Point,frame:Frame):boolean {const box=bounds(frame);return !box||(point.x>=box.x&&point.y>=box.y&&point.x<box.x+box.width&&point.y<box.y+box.height);}
 function layout(frame:Frame):Layout {
  const box=bounds(frame),unit=48*frame.camera.z;
  if(!box)return{unit,cx:9,cy:9,x:frame.viewport.width/2+frame.camera.x,y:frame.viewport.height/2+frame.camera.y};
  const fit=Math.min(48,(frame.viewport.width-40)/((box.width+box.height)/2),(frame.viewport.height-100)/((box.width+box.height)/4));
  return{unit:Math.max(4,fit)*frame.camera.z,cx:box.x+(box.width-1)/2,cy:box.y+(box.height-1)/2,x:frame.viewport.width/2+frame.camera.x,y:frame.viewport.height/2+frame.camera.y+24};
 }
 function roomLayout(frame:Frame):RoomLayout|null {
  const floor=frame.room?.floors.find(value=>value.id===frame.interiorView?.floorId);if(!floor)return null;
  const embedded=frame.presentation.embedded===true;const surface=frame.interiorView?.surface||(embedded?{x:8,y:8,width:frame.viewport.width-16,height:frame.viewport.height-16}:{x:20,y:50,width:frame.viewport.width-40,height:frame.viewport.height-80});
  const box=frame.scene?.kind==='interior'&&bounds(frame)||{x:0,y:0,width:floor.width,height:floor.height};
  const unit=Math.max(4,Math.min(72,(surface.width-(embedded?8:32))/((box.width+box.height)/2),(surface.height-(embedded?24:100))/((box.width+box.height)/4)));
  const origin={x:surface.x+surface.width/2-(box.x-box.y+(box.width-box.height)/2)*unit/2,y:surface.y+surface.height/2-(box.x+box.y+(box.width+box.height-2)/2)*unit/4+(embedded?8:25)};
  return{unit,origin,surface,floor};
 }
 function roomProject(point:Point&{height?:number},view:RoomLayout):Point {return{x:view.origin.x+(point.x-point.y)*view.unit/2,y:view.origin.y+(point.x+point.y-(point.height??0))*view.unit/4};}
 function project(tile:Point & {height?:number},frame:Frame):Point {
  const room=roomLayout(frame);if(room)return roomProject(tile,room);
  const view=layout(frame),x=tile.x-view.cx,y=tile.y-view.cy;
  const height=tile.height??frame.tiles.find(value=>value.x===Math.round(tile.x)&&value.y===Math.round(tile.y))?.height??0;
  return{x:view.x+(x-y)*view.unit/2,y:view.y+(x+y-height)*view.unit/4};
 }
 function inverse(point:Point,origin:Point,unit:number,cx=0,cy=0):Point {const a=(point.x-origin.x)/(unit/2),b=(point.y-origin.y)/(unit/4);return{x:Math.round(cx+(a+b)/2),y:Math.round(cy+(b-a)/2)};}
 function toTile(point:Point,frame:Frame):Point {
  const room=roomLayout(frame);if(room)return inverse(point,room.origin,room.unit);
  const view=layout(frame),tiles=frame.tiles.filter(tile=>inside(tile,frame)).slice().sort((a,b)=>b.x+b.y-a.x-a.y);
  for(const tile of tiles){const p=project(tile,frame),width=view.unit-.4;if(Math.abs(point.x-p.x)/(width/2)+Math.abs(point.y-p.y)/(width/4)<=1)return{x:tile.x,y:tile.y};}
  return inverse(point,{x:view.x,y:view.y},view.unit,view.cx,view.cy);
 }
 function diamond(painter:Painter,p:Point,width:number,color:string,opacity=1):void {painter.polygon([{x:p.x,y:p.y-width/4},{x:p.x+width/2,y:p.y},{x:p.x,y:p.y+width/4},{x:p.x-width/2,y:p.y}],color,opacity);}
 function rectangle(painter:Painter,x:number,y:number,width:number,height:number,color:string):void {painter.polygon([{x,y},{x:x+width,y},{x:x+width,y:y+height},{x,y:y+height}],color);}
 function cutaway(painter:Painter,frame:Frame,tiles:Frame['tiles'],colors:Environment,unit:number):void {
  const present=new Set(tiles.map(tile=>tile.x+','+tile.y));
  for(const tile of tiles)for(const side of [-1,1]){
   if(present.has((tile.x-(side===-1?1:0))+','+(tile.y-(side===1?1:0))))continue;
   const p=project(tile,frame),a={x:p.x,y:p.y-unit/4},b={x:p.x+side*unit/2,y:p.y};
   const face=(from:number,to:number,bottom:number,top:number,color:string):void=>{
    const point=(fraction:number,rise:number):Point=>({x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction-rise});
    painter.polygon([point(from,bottom),point(to,bottom),point(to,top),point(from,top)],color);
   };
   face(0,1,0,unit*4/3,colors.wall);face(0,1,0,unit*.1,colors.trim);face(0,1,unit*4/3,unit*4/3+unit*.05,colors.trim);
   const position=side===-1?tile.y:tile.x;
   if(((position%4)+4)%4>=2){face(.08,.92,unit*.3,unit*1.04,colors.trim);face(.14,.86,unit*.36,unit*.98,colors.background);face(.48,.52,unit*.36,unit*.98,colors.wall);}
  }
 }
 function transform(point:Vector,node:Node):Vector {
  const scale=node.scale||one,rotation=node.rotation||zero,position=node.position||zero;
  let x=point[0]*scale[0],y=point[1]*scale[1],z=point[2]*scale[2];
  let a=x*Math.cos(rotation[2])-y*Math.sin(rotation[2]),b=x*Math.sin(rotation[2])+y*Math.cos(rotation[2]);x=a;y=b;
  a=x*Math.cos(rotation[1])+z*Math.sin(rotation[1]);b=-x*Math.sin(rotation[1])+z*Math.cos(rotation[1]);x=a;z=b;
  a=y*Math.cos(rotation[0])-z*Math.sin(rotation[0]);b=y*Math.sin(rotation[0])+z*Math.cos(rotation[0]);y=a;z=b;
  return[x+position[0],y+position[1],z+position[2]];
 }
 function shade(color:string,factor:number):string {
  if(!/^#[0-9a-f]{6}$/i.test(color))return color;
  const value=parseInt(color.slice(1),16);return '#'+[value>>16&255,value>>8&255,value&255].map(channel=>Math.round(Math.min(255,Math.max(0,channel*factor))).toString(16).padStart(2,'0')).join('');
 }
 /** Baked mesh triangles keep the 3D winding, so the shared back-face test applies unchanged. */
 function meshFaces(mesh:{positions:readonly number[];indices?:readonly number[]}|undefined):Vector[][] {
  if(!mesh)return [];
  const p=mesh.positions,vertex=(i:number):Vector=>[p[i*3]!,p[i*3+1]!,p[i*3+2]!],faces:Vector[][]=[];
  const count=mesh.indices?mesh.indices.length:p.length/3;
  for(let i=0;i+2<count;i+=3){const a=mesh.indices?mesh.indices[i]!:i,b=mesh.indices?mesh.indices[i+1]!:i+1,c=mesh.indices?mesh.indices[i+2]!:i+2;faces.push([vertex(a),vertex(b),vertex(c)]);}
  return faces;
 }
 function geometry(kind:string):Vector[][] {
  if(kind==='ground')return[[[-.5,0,-.5],[-.5,0,.5],[.5,0,.5],[.5,0,-.5]]];
  if(kind==='box')return[
   [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
   [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
   [[-.5,.5,-.5],[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5]],
   [[-.5,-.5,.5],[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5]],
   [[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5],[-.5,-.5,.5]],
   [[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5],[.5,-.5,-.5]]];
  if(kind==='roof')return[
   [[-.5,0,.5],[.5,0,.5],[0,.62,.5]],[[.5,0,-.5],[-.5,0,-.5],[0,.62,-.5]],
   [[-.5,0,-.5],[-.5,0,.5],[0,.62,.5],[0,.62,-.5]],[[0,.62,-.5],[0,.62,.5],[.5,0,.5],[.5,0,-.5]],
   [[-.5,0,.5],[-.5,0,-.5],[.5,0,-.5],[.5,0,.5]]];
  const faces:Vector[][]=[];
  if(kind==='cylinder'||kind==='cone'){
   const top:Vector[]=[],bottom:Vector[]=[];
   for(let i=0;i<8;i++){
    const a=i*Math.PI/4,b=(i+1)*Math.PI/4,pa:Vector=[Math.cos(a),-.5,Math.sin(a)],pb:Vector=[Math.cos(b),-.5,Math.sin(b)];
    bottom.unshift(pa);top.push([pa[0],.5,pa[2]]);
    faces.push(kind==='cone'?[pb,pa,[0,.5,0]]:[pb,pa,[pa[0],.5,pa[2]],[pb[0],.5,pb[2]]]);
   }
   faces.push(bottom.reverse());if(kind==='cylinder')faces.push(top.reverse());return faces;
  }
  if(!['ball','soft','tiny','ring'].includes(kind))return [];
  const ring=kind==='ring',columns=ring?16:8,rows=6;
  const point=(row:number,column:number):Vector=>{
   const u=column/columns*Math.PI*2,v=ring?row/rows*Math.PI*2:row/rows*Math.PI-Math.PI/2;
   return ring?[(1+.07*Math.cos(v))*Math.cos(u),.07*Math.sin(v),(1+.07*Math.cos(v))*Math.sin(u)]:[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)];
  };
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)faces.push([point(row,col+1),point(row,col),point(row+1,col),point(row+1,col+1)]);
  return faces;
 }
 function drawAsset(context:Context,painter:Painter,category:'actor'|'building'|'item',id:string,x:number,y:number,unit:number,options:LittlewildRenderer2D.AssetOptions={}):boolean {
  const asset=context.query.asset(category,id) as unknown as Asset|null,model=asset?.models[options.model||'world']||asset?.models.world;if(!asset||!model)return false;
  const scale=typeof options.scale==='number'?[options.scale,options.scale,options.scale] as const:options.scale||one;
  const faces:Face[]=[],outer:Node={primitive:'group',rotation:[0,options.rotation||0,0],scale};
  function visit(node:Node,ancestors:readonly Node[]):void {
   if(node.visible===false)return;
   if(options.pose!==undefined&&node.id){const gesture=Math.sin(options.pose*Math.PI*2);if(asset!.rig?.arms?.includes(node.id))node={...node,rotation:[(node.rotation||zero)[0]+gesture*1.1,(node.rotation||zero)[1],(node.rotation||zero)[2]]};else if(asset!.rig?.head===node.id)node={...node,rotation:[(node.rotation||zero)[0]+gesture*.15,(node.rotation||zero)[1],(node.rotation||zero)[2]]};}
   const chain=[node,...ancestors];
   if(node.primitive!=='group'){
    const material=asset!.materials[node.material||''],chosen=typeof material==='string'?{color:material}:material||{color:'#808080'};
    const color=options.materials?.[node.material||'']||chosen.color;
    for(const raw of node.primitive==='mesh'?meshFaces(asset!.meshes?.[node.mesh||'']):geometry(node.primitive)){
     const points=raw.map(point=>chain.reduce((value,entry)=>transform(value,entry),point)),a=points[0]!,b=points[1]!,d=points[2]!;
     const u:Vector=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v:Vector=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
     const normal:Vector=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
     if(length<1e-10||normal[0]+normal[1]+normal[2]<=0)continue;
     faces.push({points,color:shade(color,.76+.24*Math.max(0,normal[1]/length)),opacity:(node.materialProps?.opacity??chosen.opacity??1)*(options.opacity??1),depth:points.reduce((sum,p)=>sum+p[0]+p[1]+p[2],0)/points.length});
    }
   }
   for(const child of node.children||[])visit(child,chain);
  }
  for(const node of model.nodes)visit(node,[outer]);faces.sort((a,b)=>a.depth-b.depth);
  for(const face of faces)painter.polygon(face.points.map(p=>({x:x+(p[0]-p[2])*unit/2,y:y+(p[0]+p[2])*unit/4-p[1]*unit/Math.sqrt(3)})),face.color,face.opacity);
  return faces.length>0;
 }
 function actor(context:Context,painter:Painter,entry:{visualAsset:string;personality?:string;equipment?:unknown}&LittlewildRenderer.Pose,p:Point,unit:number):void {
  const asset=entry.visualAsset?context.query.asset('actor',entry.visualAsset) as unknown as Asset|null:null;
  const appearance=asset?.behaviors?.appearances?.[entry.personality||''];
  const options:LittlewildRenderer2D.AssetOptions={...(entry.rotation===undefined?{}:{rotation:entry.rotation}),...(entry.opacity===undefined?{}:{opacity:entry.opacity}),...(entry.pose===undefined?{}:{pose:entry.pose})};
  if(appearance?.model)options.model=appearance.model;if(appearance?.scale)options.scale=appearance.scale;if(appearance?.materials)options.materials=appearance.materials;
  if(entry.scale!==undefined)options.scale=appearance?.scale?appearance.scale.map(value=>value*entry.scale!) as unknown as Vector:entry.scale;
  if(!entry.visualAsset||!drawAsset(context,painter,'actor',entry.visualAsset,p.x,p.y,unit,options))painter.circle(p.x,p.y-unit*.2,unit*.15,'#819d7b');
  let offset=0;
  for(const id of Object.values(record(entry.equipment))){if(typeof id!=='string'||!id)continue;drawAsset(context,painter,'item',id,p.x+unit*.25+offset,p.y,unit*.55,{model:'equipped'});offset+=unit*.12;}
 }
 function drawRoom(frame:Frame,context:Context,painter:Painter):boolean {
  const room=frame.room,view=roomLayout(frame);if(!room||!view)return false;
  const {floor,surface,unit}=view,place=(p:Point):Point=>roomProject(p,view);
  rectangle(painter,surface.x,surface.y,surface.width,surface.height,'#f6f5ee');
  const embedded=frame.presentation.embedded===true;if(!embedded)painter.text(room.buildingName+' · '+floor.label,surface.x+surface.width/2,surface.y+20,ink,14);
  const cells=floor.cells||Array.from({length:floor.width*floor.height},(_,index)=>({x:index%floor.width,y:Math.floor(index/floor.width)}));
  for(const cell of cells.filter(cell=>frame.scene?.kind!=='interior'||inside(cell,frame)))diamond(painter,place(cell),unit-1,(cell.x+cell.y)%2?'#ddd1ad':'#e6d9b6');
  for(const edge of floor.edges||[]){
   const a=place({x:edge.x+(edge.side==='w'?-.5:.5),y:edge.y+(edge.side==='n'?-.5:.5)}),b=place({x:edge.x+(edge.side==='e'? .5:-.5),y:edge.y+(edge.side==='s'?.5:-.5)});
   const height=edge.side==='s'||edge.side==='e'?unit*.12:unit*.6;
   painter.polygon([a,b,{x:b.x,y:b.y-height},{x:a.x,y:a.y-height}],edge.kind==='window'?'#9bb6af':edge.kind==='door'?'#bca678':'#c0cebc');
  }
  diamond(painter,place(floor.door),unit*.7,'#a2ba8d');
  for(const stair of floor.stairs){const p=place(stair);diamond(painter,p,unit*.65,'#b49d6d');if(!embedded)painter.text('Stairs',p.x,p.y+unit*.3,ink,11);}
  const objects:({depth:number;station:typeof floor.stations[number]}|{depth:number;prop:LittlewildRenderer.Value<LittlewildDeveloper.SceneProp>&LittlewildRenderer.Pose&{height?:number}}|{depth:number;actor:typeof room.actors[number]})[]=[
   ...floor.stations.filter(station=>frame.scene?.kind!=='interior'||inside(station,frame)).map(station=>({depth:station.x+station.y,station})),
   ...(room.sceneProps?.floorId===floor.id?room.sceneProps.props:[]).filter(prop=>frame.scene?.kind!=='interior'||inside(prop,frame)).map(prop=>({depth:prop.x+prop.y,prop})),
   ...room.actors.filter(value=>value.floorId===floor.id&&(frame.scene?.kind!=='interior'||inside(value,frame))).map(actor=>({depth:actor.x+actor.y+.01,actor}))];
  objects.sort((a,b)=>a.depth-b.depth);
  for(const entry of objects){
   if('prop' in entry){const p=place(entry.prop);drawAsset(context,painter,entry.prop.category,entry.prop.assetId,p.x,p.y,unit,{model:entry.prop.model,...(entry.prop.rotation===undefined?{}:{rotation:entry.prop.rotation}),...(entry.prop.scale===undefined?{}:{scale:entry.prop.scale}),...(entry.prop.opacity===undefined?{}:{opacity:entry.prop.opacity})});}
   else if('station' in entry){const p=place(entry.station);if(!entry.station.production||!room.fixtureAsset||!drawAsset(context,painter,'building',room.fixtureAsset,p.x,p.y,unit,{model:room.fixtureModel}))diamond(painter,p,unit*.7,'#c4a175');if(!embedded)painter.text(entry.station.label,p.x,p.y+unit*.38,ink,11);}
   else {const p=place(entry.actor);actor(context,painter,entry.actor,p,unit*.8);painter.text(entry.actor.name,p.x,p.y-unit*.8,ink,embedded?Math.max(8,Math.min(11,unit*.45)):12);if(!embedded&&!entry.actor.stationId)painter.text(entry.actor.action,p.x,p.y+unit*.45,ink,11);for(const [index,item] of (entry.actor.cargoItems??[]).slice(0,3).entries())drawAsset(context,painter,'item',item.id,p.x+unit*(.25+index*.14),p.y,unit*.35,{model:'carry'});}
  }
  return true;
 }
 function draw(frame:Frame,context:Context,painter:Painter):void {
  const colors=environment(frame);rectangle(painter,0,0,frame.viewport.width,frame.viewport.height,colors?.background??paper);
  if(drawRoom(frame,context,painter))return;
  const unit=layout(frame).unit,tiles=frame.tiles.filter(tile=>inside(tile,frame)).slice().sort((a,b)=>a.x+a.y-b.x-b.y),edits=record(frame.terrain.tiles);
  for(const tile of tiles){
   const p=project(tile,frame),edited=record(edits[tile.x+','+tile.y]).ground;
   const floor=tile.ground==='water'?'#90b9b5':colors&&typeof edited!=='string'?(tile.x+tile.y)%2?colors.alternateFloor:colors.floor:(tile.x+tile.y)%2?'#b6c8a0':'#bed0a9';
   diamond(painter,{x:p.x,y:p.y+unit*.1},unit,colors?.trim??'#76916e');diamond(painter,p,unit-.4,floor);
  }
  if(colors)cutaway(painter,frame,tiles,colors,unit);
  const previews=record(frame.presentation.terraformPreview);
  if(Array.isArray(previews.tiles))for(const value of previews.tiles){const tile=record(value);if(typeof tile.x==='number'&&typeof tile.y==='number'){const point:Point & {height?:number}={x:tile.x,y:tile.y};if(!inside(point,frame))continue;if(typeof tile.height==='number')point.height=tile.height;diamond(painter,project(point,frame),unit*.9,gold,.6);}}
  if(Array.isArray(previews.plants))for(const value of previews.plants){const plant=record(value);if(typeof plant.x!=='number'||typeof plant.y!=='number'||typeof plant.kind!=='string'||typeof plant.model!=='string')continue;const point={x:plant.x,y:plant.y};if(!inside(point,frame))continue;const p=project(point,frame);diamond(painter,p,unit*.8,gold,.6);drawAsset(context,painter,'item',plant.kind,p.x,p.y,unit,{model:plant.model});}
  const preview=record(frame.presentation.constructionPreview),design=record(preview.design),footprint=preview.footprint??design.footprint,previewHover=record(frame.presentation.hover);
  const previewX=typeof preview.x==='number'?preview.x:previewHover.x,previewY=typeof preview.y==='number'?preview.y:previewHover.y;
  if(Array.isArray(footprint)&&typeof previewX==='number'&&typeof previewY==='number')for(const value of footprint){const cell=record(value);if(typeof cell.x!=='number'||typeof cell.y!=='number')continue;const tile={x:previewX+cell.x,y:previewY+cell.y};if(inside(tile,frame))diamond(painter,project(tile,frame),unit*.92,gold,.5);}
  const plants:LittlewildDeveloper.SceneProp[]=[];
  for(const [key,value] of Object.entries(record(frame.terrain.plants))){const data=record(value),[x,y]=key.split(',').map(Number);if(x!==undefined&&y!==undefined&&Number.isFinite(x)&&Number.isFinite(y)&&typeof data.kind==='string'&&typeof data.model==='string')plants.push({id:'plant:'+key,name:'',category:'item',assetId:data.kind,model:data.model,x,y});}
  const objects:({depth:number;object:LittlewildRenderer.ObjectRecord;category:'building'|'item'}|{depth:number;prop:LittlewildRenderer.Value<LittlewildDeveloper.SceneProp>&LittlewildRenderer.Pose&{height?:number}}|{depth:number;actor:LittlewildRenderer.Actor})[]=[
   ...frame.nodes.filter(value=>(value.opacity??1)>0&&inside(value,frame)).map(object=>({depth:object.x+object.y,object,category:'item' as const})),
   ...frame.buildings.filter(value=>(value.opacity??1)>0&&inside(value,frame)).map(object=>({depth:object.x+object.y,object,category:'building' as const})),
   ...[...frame.props,...plants].filter(value=>inside(value,frame)).map(prop=>({depth:prop.x+prop.y,prop})),
   ...frame.actors.filter(value=>!value.away&&(value.opacity??1)>0&&inside(value,frame)).map(actor=>({depth:actor.x+actor.y+.01,actor}))];
  objects.sort((a,b)=>a.depth-b.depth);
  for(const entry of objects){
   if('object' in entry){const p=project(entry.object,frame),details=entry.object.details,id=typeof details.assetId==='string'?details.assetId:entry.object.kind;const options:LittlewildRenderer2D.AssetOptions={};if(typeof details.model==='string')options.model=details.model;if(typeof details.rotation==='number')options.rotation=details.rotation;if(entry.object.rotation!==undefined)options.rotation=entry.object.rotation;if(entry.object.scale!==undefined)options.scale=entry.object.scale;if(entry.object.opacity!==undefined)options.opacity=entry.object.opacity;if(!drawAsset(context,painter,entry.category,id,p.x,p.y,unit,options))diamond(painter,p,unit*.5,entry.category==='building'?'#bd9b70':'#739677');}
   else if('prop' in entry){const p=project(entry.prop,frame);drawAsset(context,painter,entry.prop.category,entry.prop.assetId,p.x,p.y,unit,{model:entry.prop.model,...(entry.prop.rotation===undefined?{}:{rotation:entry.prop.rotation}),...(entry.prop.scale===undefined?{}:{scale:entry.prop.scale}),...(entry.prop.opacity===undefined?{}:{opacity:entry.prop.opacity})});painter.text(entry.prop.name,p.x,p.y+unit*.35,ink,11);}
   else {const p=project(entry.actor,frame);if(entry.actor.selected)diamond(painter,p,unit*.65,gold);actor(context,painter,entry.actor,p,unit);painter.text(entry.actor.name,p.x,p.y-unit*.75,ink,12);}
  }
  const placement=frame.presentation.placement,hover=record(frame.presentation.hover);
  if(typeof placement==='string'&&typeof hover.x==='number'&&typeof hover.y==='number'){const tile={x:hover.x,y:hover.y};if(inside(tile,frame)){const p=project(tile,frame);diamond(painter,p,unit,gold,.65);drawAsset(context,painter,'building',placement,p.x,p.y,unit);}}
 }
 function hitTest(point:Point,frame:Frame):LittlewildRenderer.Hit|null {
  const room=roomLayout(frame);
  if(room){
   const box=room.surface;if(point.x<box.x||point.y<box.y||point.x>box.x+box.width||point.y>box.y+box.height)return null;
   for(const value of frame.room!.actors.filter(value=>value.floorId===room.floor.id&&(frame.scene?.kind!=='interior'||inside(value,frame))).slice().sort((a,b)=>b.x+b.y-a.x-a.y)){const p=roomProject(value,room);if(Math.hypot(p.x-point.x,p.y-room.unit*.2-point.y)<Math.max(12,room.unit*.3))return{x:Math.round(value.x),y:Math.round(value.y),actorId:value.id,objectType:'pip'};}
   const tile=toTile(point,frame),floor=room.floor;if(frame.scene?.kind==='interior'&&!inside(tile,frame))return null;
   return floor.cells?floor.cells.some(cell=>cell.x===tile.x&&cell.y===tile.y)?tile:null:tile.x>=0&&tile.y>=0&&tile.x<floor.width&&tile.y<floor.height?tile:null;
  }
  const unit=layout(frame).unit;
  for(const value of frame.actors.filter(value=>!value.away&&inside(value,frame)).slice().sort((a,b)=>b.x+b.y-a.x-a.y)){const p=project(value,frame);if(Math.hypot(p.x-point.x,p.y-unit*.25-point.y)<Math.max(12,unit*.3))return{x:Math.round(value.x),y:Math.round(value.y),actorId:value.id,objectType:'pip'};}
  for(const value of [...frame.buildings,...frame.nodes].filter(value=>inside(value,frame)).sort((a,b)=>b.x+b.y-a.x-a.y)){const p=project(value,frame);if(Math.hypot(p.x-point.x,p.y-point.y)<Math.max(12,unit*.4))return{x:value.x,y:value.y,objectId:value.id,objectType:value.kind};}
  return toTile(point,frame);
 }
 const api:LittlewildRenderer2D.Api=Object.freeze({draw,drawAsset,project,toTile,hitTest});root.LWRendererScene2D=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
