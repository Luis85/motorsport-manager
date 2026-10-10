/// <reference path="./armored-presentation-contracts.d.ts" />
/** Stable battlefield render graph. Authored models are admitted by the content boundary. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {THREE:any;LWArmoredWorld?:unknown};
 const T=root.THREE;
 function create(scene:any,mission:LWArmoredData.Mission,models:LWArmoredPresentation.Models){
  const geometry=new Map<string,any>(),materials=new Map<string,any>(),vehicles=new Map<string,any>(),obstacles=new Map<string,any>();
  const effects:any[]=[],seenEvents=new Set<string>();let eventTick=-1;
  const templates=new Map<string,any>(),projectiles=new Map<string,any>(),smoke=new Map<string,any>(),world=new T.Group();
  scene.add(world);
  const mat=(color:string)=>{if(!materials.has(color))materials.set(color,new T.MeshStandardMaterial({color,roughness:.95}));return materials.get(color);};
  const geo=(kind:string)=>{if(!geometry.has(kind))geometry.set(kind,kind==='box'?new T.BoxGeometry(1,1,1):kind==='ball'?new T.IcosahedronGeometry(1,1):kind==='cone'?new T.ConeGeometry(1,1,7):new T.CylinderGeometry(1,1,1,10));return geometry.get(kind);};
  function mesh(parent:any,kind:string,color:string,p:number[],s:number[]){const obj=new T.Mesh(geo(kind),mat(color));obj.position.set(...p);obj.scale.set(...s);obj.castShadow=true;obj.receiveShadow=true;parent.add(obj);return obj;}
  const terrain=mission.terrain;
  function height(x:number,z:number):number {
   const gx=Math.max(0,Math.min(terrain.width-1,x/terrain.cellSize)),gz=Math.max(0,Math.min(terrain.depth-1,z/terrain.cellSize));
   const ix=Math.floor(gx),iz=Math.floor(gz),nx=Math.min(ix+1,terrain.width-1),nz=Math.min(iz+1,terrain.depth-1),fx=gx-ix,fz=gz-iz;
   return ((terrain.heights[iz*terrain.width+ix]??0)*(1-fx)+(terrain.heights[iz*terrain.width+nx]??0)*fx)*(1-fz)+((terrain.heights[nz*terrain.width+ix]??0)*(1-fx)+(terrain.heights[nz*terrain.width+nx]??0)*fx)*fz;
  }
  const terrainGeo=new T.PlaneGeometry((terrain.width-1)*terrain.cellSize,(terrain.depth-1)*terrain.cellSize,terrain.width-1,terrain.depth-1);
  terrainGeo.rotateX(-Math.PI/2);
  terrainGeo.translate((terrain.width-1)*terrain.cellSize/2,0,(terrain.depth-1)*terrain.cellSize/2);
  const position=terrainGeo.attributes.position;
  for(let i=0;i<position.count;i++)position.setY(i,height(position.getX(i),position.getZ(i)));
  terrainGeo.computeVertexNormals();
  const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=512;
  const ctx=textureCanvas.getContext('2d')!;ctx.fillStyle='#788064';ctx.fillRect(0,0,512,512);
  let seed=8173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  for(let i=0;i<21000;i++){const l=Math.floor(65+random()*55);ctx.fillStyle=`rgba(${l+12},${l+15},${l-10},.24)`;ctx.fillRect(random()*512,random()*512,1+random()*3,1+random()*3);}
  const texture=new T.CanvasTexture(textureCanvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(14,14);texture.anisotropy=4;
  const groundMat=new T.MeshStandardMaterial({map:texture,color:'#b1b794',roughness:1});
  const ground=new T.Mesh(terrainGeo,groundMat);ground.receiveShadow=true;world.add(ground);
  const horizon=mesh(world,'box','#6e795b',[0,-8,0],[3000,12,3000]);horizon.castShadow=false;
  const centerX=(terrain.width-1)*terrain.cellSize/2,centerZ=(terrain.depth-1)*terrain.cellSize/2,extent=Math.hypot(centerX,centerZ);
  for(let i=0;i<50;i++){
   const angle=i/50*Math.PI*2,radius=extent+45+random()*65;
   const hill=mesh(world,'ball','#67715a',[centerX+Math.sin(angle)*radius,-8+random()*9,centerZ+Math.cos(angle)*radius],[20+random()*45,14+random()*20,20+random()*45]);hill.castShadow=false;
  }
  function obstacle(item:LWArmoredData.Obstacle){
   const g=new T.Group();g.position.set(item.position.x,item.position.y+item.size.y/2,item.position.z);world.add(g);
   const {x,y,z}=item.size,color=/wood|timber|hedge|tree|foliage|vegetation/i.test(item.material)?'#5b6650':'#a09882';
   if(/tree|foliage|hedge|vegetation/i.test(item.material)){
    mesh(g,'cylinder','#675740',[0,-y*.15,0],[Math.min(x,z)*.14,y*.7,Math.min(x,z)*.14]);
    for(let i=0;i<5;i++)mesh(g,'ball',i%2?'#4f6243':'#61724f',[(random()-.5)*x*.55,y*.12+(random()-.5)*y*.4,(random()-.5)*z*.5],[x*.5,y*.44,z*.5]);
   }else{
    mesh(g,'box',color,[0,0,0],[x,y,z]);
    if(y>2.5&&x>3){
     const roof=mesh(g,'cylinder','#726454',[0,y*.56,0],[x*.74,y*.25,z*.74]);roof.rotation.y=Math.PI/4;
     for(const side of [-1,1])for(let j=0;j<Math.max(1,Math.floor(x/3));j++)mesh(g,'box','#39413b',[-x*.35+j*2.5,y*.13,side*(z*.5+.012)],[.72,.88,.035]);
     mesh(g,'box','#635b4c',[0,-y*.25,z*.5+.025],[1.1,y*.5,.04]);
    }else if(/wood|timber/i.test(item.material)){
     for(let j=-1;j<=1;j++)mesh(g,'box','#675a46',[j*x*.35,0,0],[.1,y+.18,z+.06]);
    }
   }
   obstacles.set(item.id,g);
  }
  mission.obstacles.forEach(obstacle);
  function template(asset:string){
   if(!templates.has(asset)){
    const source=models[asset];if(!source)throw Error(`Vehicle model “${asset}” is missing. Rebuild the game asset pack.`);
    const json=(source as {object?:unknown}).object??source;
    const parsed=new T.ObjectLoader().parse(json);templates.set(asset,parsed);
   }
   return templates.get(asset);
  }
  function update(snapshot:LWArmoredRuntime.Snapshot,catalog:LWArmoredData.Catalog,alpha:number,seconds:number){
   const live=new Set<string>();
   for(const vehicle of snapshot.vehicles){
    live.add(vehicle.id);let entry=vehicles.get(vehicle.id);
    if(!entry){
     const definition=catalog.vehicles.find(v=>v.id===vehicle.definition)!;const model=template(definition.asset).clone(true);
     const outer=new T.Group();outer.add(model);world.add(outer);const wheels:any[]=[],tones:any[]=[];const bindings=(models[definition.asset] as any).semantics?.bindings??[];
     const bound=(role:string)=>{const binding=bindings.find((b:any)=>b.role===role);return binding?model.getObjectByName(binding.path):null;};
     model.traverse((part:any)=>{if(part.isMesh){part.castShadow=true;part.receiveShadow=true;if(part.material&&!Array.isArray(part.material)){part.material=part.material.clone();if(part.material.color)tones.push({material:part.material,color:part.material.color.clone()});}}});
     for(const binding of bindings){if(/^(left|right)Wheel/.test(binding.role)){const wheel=model.getObjectByName(binding.path);if(wheel)wheels.push(wheel);}}
     const gun=bound('gun'),recoil=bound('recoil');
     entry={outer,model,turret:bound('turret'),gun,recoil,recoilRest:recoil?.position.clone(),wheels,tones,damageStatus:'',wheelAngle:0};vehicles.set(vehicle.id,entry);
    }
    const a=vehicle.previous,b=vehicle.transform,p=a.position,q=b.position;
    entry.outer.visible=true;entry.outer.position.set(p.x+(q.x-p.x)*alpha,p.y+(q.y-p.y)*alpha-catalog.vehicles.find(v=>v.id===vehicle.definition)!.groundClearance,p.z+(q.z-p.z)*alpha);
    let turn=b.yaw-a.yaw;while(turn>Math.PI)turn-=Math.PI*2;while(turn< -Math.PI)turn+=Math.PI*2;
    entry.outer.rotation.set(-b.pitch,a.yaw+turn*alpha,b.roll,'YXZ');
    if(entry.turret)entry.turret.rotation.y=vehicle.weapon.turretYaw-b.yaw;
    if(entry.gun)entry.gun.rotation.x=-vehicle.weapon.elevation;
    if(entry.recoil&&entry.recoilRest)entry.recoil.position.z=entry.recoilRest.z-vehicle.weapon.recoil*.2;
    entry.wheelAngle+=seconds*(vehicle.body.velocity.x*Math.sin(b.yaw)+vehicle.body.velocity.z*Math.cos(b.yaw))/.3;
    for(const wheel of entry.wheels)wheel.rotation.x=entry.wheelAngle;
    entry.model.visible=true;
    if(entry.damageStatus!==vehicle.damage.status){entry.damageStatus=vehicle.damage.status;const burnt=['destroyed','disabled'].includes(vehicle.damage.status);for(const tone of entry.tones)tone.material.color.copy(tone.color).multiplyScalar(burnt?.35:1);}
   }
   vehicles.forEach((entry,id)=>{entry.outer.visible=live.has(id);});
   for(const item of snapshot.obstacles){const obj=obstacles.get(item.id);if(obj){obj.scale.y=item.destroyed ? .12 : 1;obj.position.y=item.position.y+(item.destroyed?item.size.y*.06:item.size.y*.5);}}
   const shots=new Set<string>();
   for(const shell of snapshot.projectiles){shots.add(shell.id);let obj=projectiles.get(shell.id);if(!obj){obj=mesh(world,'ball','#f9e2a0',[0,0,0],[.1,.1,.8]);obj.material=new T.MeshBasicMaterial({color:'#ffe5a0'});projectiles.set(shell.id,obj);}obj.position.set(shell.position.x,shell.position.y,shell.position.z);obj.lookAt(shell.position.x+shell.velocity.x,shell.position.y+shell.velocity.y,shell.position.z+shell.velocity.z);}
   projectiles.forEach((obj,id)=>{if(!shots.has(id)){world.remove(obj);obj.material.dispose();projectiles.delete(id);}});
   if(snapshot.tick<eventTick){seenEvents.clear();for(const effect of effects){world.remove(effect.mesh);effect.mesh.material.dispose();}effects.length=0;}eventTick=snapshot.tick;
   for(const event of snapshot.events){
    const key=event.tick+':'+event.sequence+':'+event.kind+':'+String(event.entityId??event.source??'');
    if(seenEvents.has(key))continue;seenEvents.add(key);
    const p=event.position as LWArmoredData.Vec3|undefined;if(!p||!['shot','impact','armor-impact'].includes(event.kind))continue;
    const shot=event.kind==='shot',count=shot?1:5;
    for(let i=0;i<count;i++){
     const material=new T.MeshBasicMaterial({color:shot?'#fff3aa':event.kind==='armor-impact'?'#d5ad71':'#9e957e',transparent:true,opacity:shot?.95:.6,depthWrite:false});
     const effect=new T.Mesh(geo('ball'),material);effect.position.set(p.x,p.y,p.z);world.add(effect);
     effects.push({mesh:effect,age:Math.max(0,(snapshot.tick-Number(event.tick??snapshot.tick))/60),life:shot?.14:.65,scale:shot?.65:.5,vx:Math.sin(i*2.4)*2,vz:Math.cos(i*2.4)*2,vy:shot?0:1.5+i*.2});
    }
   }
   for(let i=effects.length-1;i>=0;i--){const effect=effects[i];effect.age+=seconds;if(effect.age>effect.life){world.remove(effect.mesh);effect.mesh.material.dispose();effects.splice(i,1);continue;}const scale=effect.scale*(1+effect.age*3);effect.mesh.scale.setScalar(scale);effect.mesh.position.x+=effect.vx*seconds;effect.mesh.position.y+=effect.vy*seconds;effect.mesh.position.z+=effect.vz*seconds;effect.mesh.material.opacity=(1-effect.age/effect.life)*.7;}
   if(seenEvents.size>4096)seenEvents.clear();
   const clouds=new Set<string>();
   for(const cloud of snapshot.smoke){clouds.add(cloud.id);let obj=smoke.get(cloud.id);if(!obj){obj=mesh(world,'ball','#b5b7a4',[0,0,0],[1,1,1]);obj.material=new T.MeshStandardMaterial({color:'#b5b7a4',transparent:true,opacity:.72,roughness:1,depthWrite:false});smoke.set(cloud.id,obj);}obj.position.set(cloud.position.x,cloud.position.y+cloud.radius*.5,cloud.position.z);obj.scale.set(cloud.radius,cloud.radius*.8,cloud.radius);}
   smoke.forEach((obj,id)=>{if(!clouds.has(id)){world.remove(obj);obj.material.dispose();smoke.delete(id);}});
  }
  return {update,height,vehicles,obstacles,dispose(){
   world.traverse((obj:any)=>{if(obj.isMesh){obj.geometry?.dispose();if(Array.isArray(obj.material))obj.material.forEach((m:any)=>m.dispose());else obj.material?.dispose();}});
   texture.dispose();scene.remove(world);templates.clear();vehicles.clear();obstacles.clear();geometry.clear();materials.clear();
  }};
 }
 root.LWArmoredWorld={create};
})(typeof globalThis!=='undefined'?globalThis:this);
