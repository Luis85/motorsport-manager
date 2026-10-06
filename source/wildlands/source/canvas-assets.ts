/* Canvas projection of the same validated primitive assets used by the 3D view.
 * The adapter reads installed model data; it never creates functional fixtures. */
(function(inputRoot:unknown){
 'use strict';
 type Vector=readonly[number,number,number];
 type Category='building'|'item'|'actor'|'pet';
 interface Node {mesh?:string;primitive:string;position?:Vector;scale?:Vector;rotation?:Vector;material?:string;materialProps?:{opacity?:number};visible?:boolean;children?:readonly Node[];}
 interface Material {color:string;opacity?:number;}
 interface Asset {meshes?:Readonly<Record<string,{positions:readonly number[];indices?:readonly number[]}>>;materials:Readonly<Record<string,string|Material>>;models:Readonly<Record<string,{nodes:readonly Node[]}>>;metadata?:{orientation?:string};}
 interface Face {points:Vector[];color:string;opacity:number;depth:number;}
 interface Options {rotation?:number;model?:string;scale?:number;}
 interface Api {draw(c:CanvasRenderingContext2D,category:Category,id:string,x:number,y:number,tw:number,th:number,options?:Options):boolean;actor(c:CanvasRenderingContext2D,actor:{archetype?:string},x:number,y:number,tw:number,th:number):boolean;}
 interface Root {LWAssets?:{get(category:Category,id:string):unknown};LWWorldProfile?:{readonly current:{materialColors:Readonly<Record<string,string>>}};LWCreatures?:{get(id:string):{visualAsset:string}};LWCanvasAssets?:Api;}
 const root=inputRoot as Root,zero:Vector=[0,0,0],one:Vector=[1,1,1];
 function transform(point:Vector,node:Node):Vector{
  const scale=node.scale||one,rotation=node.rotation||zero,position=node.position||zero;
  let x=point[0]*scale[0],y=point[1]*scale[1],z=point[2]*scale[2];
  let a=x*Math.cos(rotation[2])-y*Math.sin(rotation[2]),b=x*Math.sin(rotation[2])+y*Math.cos(rotation[2]);x=a;y=b;
  a=x*Math.cos(rotation[1])+z*Math.sin(rotation[1]);b=-x*Math.sin(rotation[1])+z*Math.cos(rotation[1]);x=a;z=b;
  a=y*Math.cos(rotation[0])-z*Math.sin(rotation[0]);b=y*Math.sin(rotation[0])+z*Math.cos(rotation[0]);y=a;z=b;
  return[x+position[0],y+position[1],z+position[2]];
 }
 function shade(hex:string,factor:number):string{
  const value=parseInt(hex.slice(1),16);return '#'+[value>>16&255,value>>8&255,value&255].map(channel=>Math.round(Math.min(255,Math.max(0,channel*factor))).toString(16).padStart(2,'0')).join('');
 }
 /** Baked mesh triangles keep the 3D winding, so the shared back-face test applies unchanged. */
 function meshFaces(mesh:{positions:readonly number[];indices?:readonly number[]}|undefined):Vector[][]{
  if(!mesh)return [];
  const p=mesh.positions,vertex=(i:number):Vector=>[p[i*3]!,p[i*3+1]!,p[i*3+2]!],faces:Vector[][]=[];
  const count=mesh.indices?mesh.indices.length:p.length/3;
  for(let i=0;i+2<count;i+=3){const a=mesh.indices?mesh.indices[i]!:i,b=mesh.indices?mesh.indices[i+1]!:i+1,c=mesh.indices?mesh.indices[i+2]!:i+2;faces.push([vertex(a),vertex(b),vertex(c)]);}
  return faces;
 }
 function geometry(kind:string):Vector[][]{
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
  // Smooth primitives use latitude rings; a ring uses the same authored torus radius.
  const ring=kind==='ring',columns=ring?16:8,rows=ring?6:6;
  const point=(row:number,column:number):Vector=>{
   const u=column/columns*Math.PI*2,v=ring?row/rows*Math.PI*2:row/rows*Math.PI-Math.PI/2;
   return ring?[(1+.07*Math.cos(v))*Math.cos(u),.07*Math.sin(v),(1+.07*Math.cos(v))*Math.sin(u)]:[Math.cos(v)*Math.cos(u),Math.sin(v),Math.cos(v)*Math.sin(u)];
  };
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++)faces.push([point(row,col+1),point(row,col),point(row+1,col),point(row+1,col+1)]);
  return faces;
 }
 function draw(c:CanvasRenderingContext2D,category:Category,id:string,x:number,y:number,tw:number,th:number,options:Options={}):boolean{
  const asset=root.LWAssets?.get(category,id) as Asset|null|undefined,model=asset?.models[options.model||'world']||asset?.models.world;if(!asset||!model)return false;
  const faces:Face[]=[],outer:Node={primitive:'group',rotation:[0,options.rotation||0,0],scale:[options.scale||1,options.scale||1,options.scale||1]};
  function visit(node:Node,ancestors:readonly Node[]):void{
   if(node.visible===false)return;
   const chain=[node,...ancestors];
   if(node.primitive!=='group'){
    const material=asset!.materials[node.material||''],chosen=typeof material==='string'?{color:material}:material||{color:'#808080'};
    const color=root.LWWorldProfile?.current.materialColors[chosen.color]||chosen.color;
    for(const raw of node.primitive==='mesh'?meshFaces(asset!.meshes?.[node.mesh||'']):geometry(node.primitive)){
     const points=raw.map(point=>chain.reduce((value,entry)=>transform(value,entry),point)),a=points[0]!,b=points[1]!,d=points[2]!;
     const u:Vector=[b[0]-a[0],b[1]-a[1],b[2]-a[2]],v:Vector=[d[0]-a[0],d[1]-a[1],d[2]-a[2]];
     const normal:Vector=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],length=Math.hypot(...normal);
     if(length<1e-10||normal[0]+normal[1]+normal[2]<=0)continue;
     faces.push({points,color:shade(color,.76+.24*Math.max(0,normal[1]/length)),opacity:node.materialProps?.opacity??chosen.opacity??1,depth:points.reduce((sum,p)=>sum+p[0]+p[1]+p[2],0)/points.length});
    }
   }
   for(const child of node.children||[])visit(child,chain);
  }
  for(const node of model.nodes)visit(node,[outer]);faces.sort((a,b)=>a.depth-b.depth);
  c.save();const alpha=c.globalAlpha,height=tw/Math.SQRT2*Math.sqrt(2/3);
  for(const face of faces){c.globalAlpha=alpha*face.opacity;c.fillStyle=face.color;c.beginPath();face.points.forEach((p,index)=>{const px=x+(p[0]-p[2])*tw/2,py=y+(p[0]+p[2])*th/2-p[1]*height;if(index)c.lineTo(px,py);else c.moveTo(px,py);});c.closePath();c.fill();}
  c.restore();return true;
 }
 function actor(c:CanvasRenderingContext2D,entry:{archetype?:string},x:number,y:number,tw:number,th:number):boolean{
  if(!entry.archetype||!root.LWCreatures)return false;return draw(c,'actor',root.LWCreatures.get(entry.archetype).visualAsset,x,y,tw,th);
 }
 const api:Api=Object.freeze({draw,actor});root.LWCanvasAssets=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
