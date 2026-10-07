/// <reference path="./pet-contracts.d.ts" />
/* Pocket Pet 3D presentation. It consumes detached snapshots and Scene Forge authored assets;
 * every motion here is presentation time and never advances or commands the simulation. */
declare namespace LWPetRenderer {
 interface Stats {mode:string;frames:number;model:string;triangles:number;props:string[];accessories:string[];}
 interface Surface {draw(snapshot:LWPetRuntime.Snapshot,time:number,dt:number):void;orbit(yaw:number,pitch?:number):void;zoom(factor:number):void;anchor():{x:number;y:number}|null;stats():Stats;destroy():void;readonly mode:string;}
 interface Api {create(canvas:HTMLCanvasElement,assets:readonly unknown[],layout:LWPetData.Scene):Surface;}
}
(function(inputRoot:unknown){
 'use strict';
 // Three.js is the vendored global used by the colony renderer; it is intentionally loosely typed here.
 type O=any;
 interface Root {THREE:any;LWAssetRenderer:{createFromDefinition(kit:unknown,parent:O,input:unknown,model?:string,options?:Record<string,unknown>):{root:O;handles:Map<string,O>}};LWPetRenderer?:LWPetRenderer.Api;}
 interface Instance {root:O;handles:Map<string,O>;}
 interface Rest {node:O;position:O;rotation:O;scale:O;}
 const root=inputRoot as Root;
 const ease=(from:number,to:number,rate:number,dt:number):number=>from+(to-from)*(1-Math.exp(-rate*dt));
 function create(canvas:HTMLCanvasElement,assetInput:readonly unknown[],layout:LWPetData.Scene):LWPetRenderer.Surface{
  const T=root.THREE,owned:O[]=[],geometries=new Map<string,O>(),materials=new Map<string,O>();
  const assets=new Map<string,Record<string,any>>();
  for(const asset of assetInput)if(asset&&typeof asset==='object')assets.set(String((asset as {id:unknown}).id),asset as Record<string,any>);
  let context:WebGL2RenderingContext|null=null;
  try{context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});}catch{context=null;}
  const mode=context?'WebGL · Scene Forge assets':'Unavailable';
  const renderer:O=context?new T.WebGLRenderer({canvas,context,antialias:true,alpha:false,preserveDrawingBuffer:true}):null;
  if(renderer){renderer.setPixelRatio(Math.min(2,globalThis.devicePixelRatio||1));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;}
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(30,1,.1,60);
  const hemi=new T.HemisphereLight('#fff4e6','#c7a98a',1.6),sun=new T.DirectionalLight('#fff1d6',2.4),lamp=new T.PointLight('#ffd58a',0,6,1.6),glow=new T.PointLight('#ffe6b0',0,3,2);
  sun.position.set(3.5,6,4.5);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:20});sun.shadow.bias=-.0005;
  lamp.position.set(1.75,1.38,-1.8);scene.add(hemi,sun,lamp,glow);
  // Kit: the generic asset interpreter asks for groups, primitives and cached materials.
  function geo(kind:string):O{
   if(!geometries.has(kind))geometries.set(kind,kind==='box'?new T.BoxGeometry(1,1,1):kind==='ball'?new T.IcosahedronGeometry(1,0):kind==='tiny'?new T.SphereGeometry(1,6,4):kind==='soft'?new T.SphereGeometry(1,10,7):kind==='cone'?new T.ConeGeometry(1,1,7):kind==='cylinder'?new T.CylinderGeometry(1,1,1,8):kind==='ground'?new T.PlaneGeometry(1,1).rotateX(-Math.PI/2):new T.TorusGeometry(1,.07,4,16));
   return geometries.get(kind);
  }
  function mat(color:string,extra:Record<string,unknown>={}):O{
   const key=color+JSON.stringify(extra);
   if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness:.9,flatShading:true,...extra}));
   return materials.get(key);
  }
  const kit={T,mat,group(parent:O){const g=new T.Group();parent.add(g);return g;},
   piece(parent:O,kind:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,rotation=0,extra={}){const m=new T.Mesh(geo(kind),mat(color,extra));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=rotation;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}};
  function instance(id:string,model='world',parent:O=scene):Instance{
   const asset=assets.get(id);if(!asset)throw Error('Missing Pocket Pet asset '+id);
   const made=root.LWAssetRenderer.createFromDefinition(kit,parent,asset,model);owned.push(made.root);return made;
  }
  const props=new Map<string,Instance>();
  function prop(id:string):Instance{let p=props.get(id);if(!p){p=instance(id);props.set(id,p);}return p;}
  let roomId='',bed:Instance|null=null,pet:Instance|null=null,petKey='',petModel='',worn:string[]=[],petTop=.6,rest:Rest[]=[],petMaterials:{material:O;color:O}[]=[];
  const messes=new Map<string,Instance>(),position={x:0,z:0,yaw:0},view={yaw:.62,pitch:.46,distance:5.6};
  let frames=0,sparkle=0,blink=0,lastStage='';
  function rig(snapshot:LWPetRuntime.Snapshot,role:string):O[]{
   const refs=assets.get(snapshot.pet.asset)?.rig?.[snapshot.pet.model]?.[role];
   return (Array.isArray(refs)?refs:refs?[refs]:[]).map((id:string)=>pet?.handles.get(id)).filter(Boolean);
  }
  /** A skin names base material roles; variant-specific roles such as `skin-adult-bramble` follow their base. */
  function skinMaterials(asset:Record<string,any>,skin:Record<string,string>):Record<string,unknown>{
   const out:Record<string,unknown>={};
   for(const [role,value] of Object.entries(asset.materials??{})){
    const color=skin[role.split('-')[0]!];if(!color)continue;
    out[role]=typeof value==='string'?color:{...(value as Record<string,unknown>),color};
   }
   return out;
  }
  function buildPet(snapshot:LWPetRuntime.Snapshot):void{
   const wardrobe=snapshot.wardrobe,key=JSON.stringify([snapshot.pet.asset,snapshot.pet.model,wardrobe.materials,wardrobe.accessories]);if(key===petKey)return;
   if(pet){scene.remove(pet.root);owned.splice(owned.indexOf(pet.root),1);for(const entry of petMaterials)entry.material.dispose();}
   const asset=assets.get(snapshot.pet.asset);if(!asset)throw Error('Missing Pocket Pet asset '+snapshot.pet.asset);
   petKey=key;petModel=snapshot.pet.asset+'/'+snapshot.pet.model;
   pet=root.LWAssetRenderer.createFromDefinition(kit,scene,asset,snapshot.pet.model,{materials:skinMaterials(asset,wardrobe.materials)});owned.push(pet.root);
   // Per-instance material copies let sickness tint this pet without touching shared catalog materials.
   petMaterials=[];pet.root.traverse((node:O)=>{if(node.isMesh){node.material=node.material.clone();petMaterials.push({material:node.material,color:node.material.color.clone()});}});
   // Equipped accessories attach to the model's authored socket roles; stages without a socket show none.
   worn=[];
   for(const accessory of wardrobe.accessories){
    const socket=rig(snapshot,accessory.slot)[0];const item=assets.get(accessory.asset);
    if(socket&&item){root.LWAssetRenderer.createFromDefinition(kit,socket,item,'world');worn.push(accessory.item);}
   }
   petTop=new T.Box3().setFromObject(pet.root).max.y;
   rest=[];pet.root.traverse((node:O)=>rest.push({node,position:node.position.clone(),rotation:node.rotation.clone(),scale:node.scale.clone()}));
   if(lastStage&&lastStage!==snapshot.pet.stage)sparkle=2.2;lastStage=snapshot.pet.stage;
  }
  function syncMesses(snapshot:LWPetRuntime.Snapshot,mess:string,t:number):void{
   const live=new Set(snapshot.messes.map(m=>m.id));
   for(const [id,item] of messes)if(!live.has(id)){scene.remove(item.root);messes.delete(id);}
   for(const m of snapshot.messes){let item=messes.get(m.id);if(!item){item=instance(mess);messes.set(m.id,item);}item.root.position.set(m.x,0,m.z);item.root.scale.setScalar(1+Math.sin(t*3+m.x)*.03);}
  }
  function animate(snapshot:LWPetRuntime.Snapshot,t:number,dt:number,spots:{pet:{x:number;z:number};bed:{x:number;z:number}}):void{
   if(!pet)return;
   for(const r of rest){r.node.position.copy(r.position);r.node.rotation.copy(r.rotation);r.node.scale.copy(r.scale);}
   const kind=snapshot.activity?.kind??'',sleeping=snapshot.sleeping,departed=snapshot.status!=='alive',egg=snapshot.pet.stage==='egg';
   let tx=spots.pet.x+Math.sin(t*.21)*.45,tz=spots.pet.z+Math.sin(t*.29+1)*.28;
   if(sleeping){tx=spots.bed.x;tz=spots.bed.z;}else if(kind||egg){tx=spots.pet.x;tz=spots.pet.z;}
   const moving=Math.hypot(tx-position.x,tz-position.z)>.03&&!sleeping;
   // Activities and pauses face the viewer so expressions and props read clearly.
   const heading=moving?Math.atan2(tx-position.x,tz-position.z):view.yaw+Math.sin(t*.4)*(kind?0:.3);
   position.x=ease(position.x,tx,sleeping?1.5:2.2,dt);position.z=ease(position.z,tz,sleeping?1.5:2.2,dt);
   let delta=heading-position.yaw;while(delta>Math.PI)delta-=Math.PI*2;while(delta<-Math.PI)delta+=Math.PI*2;position.yaw+=delta*(1-Math.exp(-5*dt));
   pet.root.visible=!departed;pet.root.position.set(position.x,sleeping?.06:0,position.z);pet.root.rotation.y=egg?0:position.yaw;
   const mood=snapshot.mood,happy=mood==='happy'||kind==='play'||kind==='cuddle';
   for(const body of rig(snapshot,'body')){
    const hop=kind==='play'?Math.abs(Math.sin(t*6))*.12:moving?Math.abs(Math.sin(t*9))*.035:0;
    body.position.y+=hop;const breath=1+Math.sin(t*(sleeping?1.4:2.4))*(sleeping?.035:.02);body.scale.y*=breath;body.scale.x*=2-breath;
    if(snapshot.sick)body.rotation.z+=Math.sin(t*1.3)*.08;
    if(sleeping)body.rotation.x+=.18;
   }
   for(const head of rig(snapshot,'head')){
    head.rotation.z+=Math.sin(t*.9)*.07;
    if(kind==='feed'||kind==='treat')head.rotation.x+=.18+Math.sin(t*10)*.12;
    else if(mood==='sad'||snapshot.sick)head.rotation.x+=.15;
    if(sleeping)head.rotation.x+=.25;
   }
   blink-=dt;if(blink<-.14)blink=2+((Math.sin(t*12.9898)*43758.5453)%1+1)%1*3;
   const closed=sleeping||departed||blink<0;
   for(const eye of rig(snapshot,'eyes'))eye.scale.y*=closed?.08:happy?.82:1;
   for(const mouth of rig(snapshot,'mouth')){
    if(kind==='feed'||kind==='treat')mouth.scale.y*=1+Math.abs(Math.sin(t*10))*2.2;
    if(mood==='sad'||mood==='sick'||mood==='hungry'||mood==='dirty')mouth.rotation.z+=Math.PI;
    if(sleeping)mouth.scale.x*=.5;
   }
   for(const cheek of rig(snapshot,'cheeks'))cheek.scale.multiplyScalar(happy?1.25:snapshot.sick?.6:1);
   rig(snapshot,'ears').forEach((ear,i)=>{ear.rotation.z+=Math.sin(t*(happy?7:2)+i)*(happy?.18:.06);});
   for(const tail of rig(snapshot,'tail'))tail.rotation.y+=Math.sin(t*(happy?8:2.5))*(happy?.5:.18);
   for(const sprout of rig(snapshot,'sprout'))sprout.rotation.z+=Math.sin(t*1.7)*.16;
   rig(snapshot,'arms').forEach((arm,i)=>{arm.rotation.x+=kind==='play'||kind==='cuddle'?-1.1+Math.sin(t*8+i*Math.PI)*.4:Math.sin(t*2+i*Math.PI)*.08;});
   rig(snapshot,'feet').forEach((foot,i)=>{if(moving)foot.position.y+=Math.max(0,Math.sin(t*9+i*Math.PI))*.03;});
   for(const shell of rig(snapshot,'shell')){
    const urge=snapshot.pet.stageProgress**3,burst=Math.max(0,Math.sin(t*1.6))**8;
    shell.rotation.z+=Math.sin(t*14)*(.03+urge*.28)*(.25+burst);shell.rotation.x+=Math.cos(t*11)*urge*.06*burst;
   }
   const tint=snapshot.sick?.35:departed?.6:0;
   for(const entry of petMaterials)entry.material.color.copy(entry.color).lerp(new T.Color(snapshot.sick?'#a6c48a':'#b9b4c4'),tint);
  }
  function activityProps(snapshot:LWPetRuntime.Snapshot,t:number):void{
  const active=snapshot.activity;
  for(const [id,item] of props)item.root.visible=!!active&&active.prop===id;
  if(!active)return;
  // Props are placed relative to the pet on the viewer's side, so they never hide its face.
  const item=prop(active.prop),progress=1-active.remaining/Math.max(.001,active.total),r=item.root;
  const fx=Math.sin(view.yaw),fz=Math.cos(view.yaw),sx=Math.cos(view.yaw),sz=-Math.sin(view.yaw);
  const front=(distance:number,side=0):[number,number]=>[position.x+fx*distance+sx*side,position.z+fz*distance+sz*side];
  r.visible=true;r.rotation.set(0,view.yaw,0);r.scale.setScalar(1);
  if(active.kind==='feed'||active.kind==='treat'){const [x,z]=front(.42);r.position.set(x,0,z);r.scale.setScalar(Math.max(.35,1-progress*.6));}
  else if(active.kind==='play'){const phase=t*2.2,[x,z]=front(.55,Math.sin(phase)*.6);r.position.set(x,Math.abs(Math.sin(phase*2))*.55,z);r.rotation.x=t*6;}
  else if(active.kind==='clean'){r.position.set(position.x,.1+(t*.4%1)*petTop,position.z);r.scale.setScalar(1.6+Math.sin(t*4)*.15);r.rotation.y=t;}
  else if(active.kind==='cuddle'){const [x,z]=front(.12,.12);r.position.set(x,petTop+.12+(t*.6%1)*.45,z);r.rotation.y=view.yaw+Math.sin(t*3)*.4;}
  else{const [x,z]=front(.32,.3);r.position.set(x,.08,z);r.rotation.z=-.5+Math.sin(t*3)*.2;}
 }
 function lighting(snapshot:LWPetRuntime.Snapshot,t:number):void{
   const hour=snapshot.clock.hour+snapshot.clock.minute/60,daylight=Math.max(0,Math.sin((hour-6)/14*Math.PI));
   const lights=snapshot.lights,background=new T.Color('#1b2233').lerp(new T.Color('#f7e7d4'),daylight*.55+(lights?.25:0));
   scene.background=background;
   hemi.intensity=(lights?.95:.32)+daylight*.9;hemi.color.set(lights?'#fff4e6':'#9fb4ff');
   sun.intensity=.35+daylight*2.4;sun.color.set(daylight>.2?'#fff1d6':'#a8b8ff');
   lamp.intensity=lights&&daylight<.6?7:0;
   glow.intensity=sparkle>0?6*Math.min(1,sparkle):0;glow.position.set(position.x,1.1,position.z);
   if(snapshot.status!=='alive'){const star=prop(layout.sparkle);star.root.visible=true;star.root.position.set(layout.pet.x,.5+Math.sin(t*1.2)*.08,layout.pet.z);star.root.rotation.y=t*.8;star.root.scale.setScalar(1.6);}
   else if(sparkle>0){const star=prop(layout.sparkle);star.root.visible=true;star.root.position.set(position.x+Math.cos(t*4)*.55,.6+(2.2-sparkle)*.5,position.z+Math.sin(t*4)*.55);star.root.rotation.y=t*5;star.root.scale.setScalar(1+Math.sin(t*9)*.2);}
  }
  function place():void{
   const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);
   if(renderer&&(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())))renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.fov=w/h<1?42:30;camera.updateProjectionMatrix();
   // The camera eases toward the pet so it stays the subject while the room remains readable.
   const target=new T.Vector3(position.x*.55,.42,position.z*.55+.1);
   camera.position.set(target.x+Math.sin(view.yaw)*Math.cos(view.pitch)*view.distance,target.y+Math.sin(view.pitch)*view.distance,target.z+Math.cos(view.yaw)*Math.cos(view.pitch)*view.distance);
   camera.lookAt(target);
  }
  function draw(snapshot:LWPetRuntime.Snapshot,time:number,dt:number):void{
   if(!renderer)return;
   const spots={pet:layout.pet,bed:layout.bedSpot};
   if(!roomId){roomId=layout.room;instance(layout.room);}
   if(!bed){bed=instance(layout.bed);bed.root.position.set(spots.bed.x,0,spots.bed.z);}
   buildPet(snapshot);syncMesses(snapshot,layout.mess,time);
   const step=Math.min(.1,Math.max(0,dt));sparkle=Math.max(0,sparkle-step);
   animate(snapshot,time,step,spots);activityProps(snapshot,time);
   if(sparkle<=0&&snapshot.status==='alive'&&props.has(layout.sparkle)&&snapshot.activity?.prop!==layout.sparkle)props.get(layout.sparkle)!.root.visible=false;
   lighting(snapshot,time);place();renderer.render(scene,camera);frames++;
  }
  function anchor():{x:number;y:number}|null{
   if(!pet||!renderer||!pet.root.visible)return null;
   const point=new T.Vector3();pet.root.updateMatrixWorld(true);new T.Box3().setFromObject(pet.root).getCenter(point);point.y=new T.Box3().setFromObject(pet.root).max.y+.1;
   point.project(camera);return {x:(point.x+1)/2*canvas.clientWidth,y:(1-point.y)/2*canvas.clientHeight};
  }
  return {mode,draw,anchor,
   orbit(yaw,pitch=0){view.yaw=Math.max(-.35,Math.min(1.55,view.yaw+yaw));view.pitch=Math.max(.18,Math.min(1.05,view.pitch+pitch));},
   zoom(factor){view.distance=Math.max(2.8,Math.min(10,view.distance*factor));},
   stats:()=>({mode,frames,model:petModel,accessories:[...worn],triangles:renderer?.info.render.triangles??0,props:[...props].filter(([,p])=>p.root.visible).map(([id])=>id)}),
   destroy(){
    for(const node of owned)scene.remove(node);
    for(const g of geometries.values())g.dispose();for(const m of materials.values())m.dispose();for(const entry of petMaterials)entry.material.dispose();
    renderer?.dispose();
   }
  };
 }
 root.LWPetRenderer={create};
})(globalThis);
