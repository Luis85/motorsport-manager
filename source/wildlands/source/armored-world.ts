/// <reference path="./armored-presentation-contracts.d.ts" />
/** Stable battlefield render graph. Authored models are admitted by the content boundary. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {THREE:any;LWArmoredWorld?:unknown};
 const T=root.THREE;
 function create(scene:any,mission:LWArmoredData.Mission,models:LWArmoredPresentation.Models){
  const geometry=new Map<string,any>(),materials=new Map<string,any>(),vehicles=new Map<string,any>(),obstacles=new Map<string,any>();
  const effects:any[]=[],seenEvents=new Set<string>();let eventTick=-1;
  const templates=new Map<string,any>(),projectiles=new Map<string,any>(),smoke=new Map<string,any>(),depots=new Map<string,any>(),world=new T.Group();
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
  let seed=8173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
  const textureCanvas=document.createElement('canvas');textureCanvas.width=textureCanvas.height=1024;
  const ctx=textureCanvas.getContext('2d')!,pixels=ctx.createImageData(1024,1024);
  // Broad soil variations and fine grain share the actual terrain footprint. No decorative collision geometry.
  for(let z=0;z<1024;z++)for(let x=0;x<1024;x++){
   const broad=Math.sin(x*.012+Math.sin(z*.008)*2)*Math.cos(z*.015)+Math.sin((x+z)*.037)*.3;
   const grain=(random()-.5)*20,dry=Math.max(0,Math.sin(x*.006-z*.01))*13,index=(z*1024+x)*4;
   pixels.data[index]=105+broad*12+grain+dry;pixels.data[index+1]=113+broad*13+grain;pixels.data[index+2]=76+broad*8+grain;pixels.data[index+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const texture=new T.CanvasTexture(textureCanvas);texture.anisotropy=4;if(T.SRGBColorSpace)texture.colorSpace=T.SRGBColorSpace;
  const detailCanvas=document.createElement('canvas');detailCanvas.width=detailCanvas.height=256;
  const detailContext=detailCanvas.getContext('2d')!,detailPixels=detailContext.createImageData(256,256);
  for(let i=0;i<detailPixels.data.length;i+=4){const value=90+random()*90;detailPixels.data[i]=detailPixels.data[i+1]=detailPixels.data[i+2]=value;detailPixels.data[i+3]=255;}
  detailContext.putImageData(detailPixels,0,0);
  const detail=new T.CanvasTexture(detailCanvas);detail.wrapS=detail.wrapT=T.RepeatWrapping;detail.repeat.set(95,95);detail.anisotropy=4;
  const groundMat=new T.MeshStandardMaterial({map:texture,bumpMap:detail,bumpScale:.07,roughness:1});
  const ground=new T.Mesh(terrainGeo,groundMat);ground.receiveShadow=true;world.add(ground);
  const horizon=mesh(world,'box','#6e795b',[0,-8,0],[3000,12,3000]);horizon.castShadow=false;
  const centerX=(terrain.width-1)*terrain.cellSize/2,centerZ=(terrain.depth-1)*terrain.cellSize/2,extent=Math.hypot(centerX,centerZ);
  for(let i=0;i<50;i++){
   const angle=i/50*Math.PI*2,radius=extent+45+random()*65;
   const hill=mesh(world,'ball','#67715a',[centerX+Math.sin(angle)*radius,-8+random()*9,centerZ+Math.cos(angle)*radius],[20+random()*45,14+random()*20,20+random()*45]);hill.castShadow=false;
  }
  function obstacle(item:LWArmoredData.Obstacle){
   const g=new T.Group();g.position.set(item.position.x,item.position.y+item.size.y/2,item.position.z);world.add(g);
   const {x,y,z}=item.size,wood=/wood|timber|tree|foliage|hedge|vegetation/i.test(item.material);
   if(wood&&y>Math.max(x,z)*2){
    mesh(g,'cylinder','#615344',[0,-y*.2,0],[Math.min(x,z)*.12,y*.6,Math.min(x,z)*.12]);
    for(let i=0;i<6;i++){
     const level=i/6,radius=.49*(1-level*.78),crown=mesh(g,'cone',i%2?'#455a43':'#53694b',[0,-y*.16+level*y*.56,0],[x*radius,y*.38,z*radius]);
     crown.rotation.y=i*.91;
    }
   }else if(wood){
    mesh(g,'box','#60694d',[0,0,0],[x,y,z]);
   }else if(y>2.5&&x>3){
    // The roof, facade and trim remain inside the admitted obstacle's AABB.
    const eave=y*.2,wallHeight=y*.7,plaster=['#b6ad96','#a69d87','#c0b49a'][Math.floor(random()*3)]!;
    mesh(g,'box',plaster,[0,-y*.15,0],[x,wallHeight,z-.08]);
    mesh(g,'box','#7d7a67',[0,-y*.43,0],[x,y*.14,z]);
    const roofGeometry=new T.BufferGeometry();
    const a=[-x/2,eave,-z/2],b=[x/2,eave,-z/2],c=[0,y/2,-z/2],d=[-x/2,eave,z/2],e=[x/2,eave,z/2],f=[0,y/2,z/2];
    roofGeometry.setAttribute('position',new T.Float32BufferAttribute([...a,...d,...f,...a,...f,...c,...b,...c,...f,...b,...f,...e,...a,...c,...b,...d,...e,...f],3));roofGeometry.computeVertexNormals();
    const roof=new T.Mesh(roofGeometry,mat('#716659'));roof.castShadow=true;roof.receiveShadow=true;g.add(roof);
    for(const side of [-1,1])for(let row=0;row<2;row++)for(let j=0;j<Math.max(1,Math.floor(x/3));j++){
     const px=-x*.36+j*x*.72/Math.max(1,Math.floor(x/3)-1),py=-y*.22+row*y*.25;
     mesh(g,'box','#d1c8af',[px,py,side*(z/2-.035)],[.96,1.2,.06]);
     mesh(g,'box','#354343',[px,py,side*(z/2-.012)],[.68,.91,.02]);
     mesh(g,'box','#b0aa91',[px,py,side*(z/2-.002)],[.065,.94,.003]);
    }
    mesh(g,'box','#605c4a',[0,-y*.34,z/2-.012],[1.1,y*.32,.02]);
   }else{
    mesh(g,'box','#898977',[0,0,0],[x,y,z]);
    for(let row=0;row<3;row++)mesh(g,'box','#686d5d',[0,-y/2+(row+1)*y/3-.04,z/2-.01],[x,.055,.015]);
   }
   obstacles.set(item.id,g);
  }
  mission.obstacles.forEach(obstacle);
  function servicePad(depot:LWArmoredData.SupplyDepot){
   const group=new T.Group(),padGeometry=new T.RingGeometry(depot.radius-.2,depot.radius,80);padGeometry.rotateX(-Math.PI/2);
   const points=padGeometry.attributes.position;
   for(let i=0;i<points.count;i++){const x=points.getX(i)+depot.position.x,z=points.getZ(i)+depot.position.z;points.setXYZ(i,x,height(x,z)+.045,z);}
   const paint=new T.MeshBasicMaterial({color:'#c7bd88',transparent:true,opacity:.7,depthWrite:false,side:T.DoubleSide});
   group.add(new T.Mesh(padGeometry,paint));
   // Flat painted bars only: service markings never invent an obstacle or conceal a firing line.
   for(const axis of [0,1]){
    const marking=new T.PlaneGeometry(axis?1.2:4,axis?4:1.2,4,4);marking.rotateX(-Math.PI/2);
    const p=marking.attributes.position;
    for(let i=0;i<p.count;i++){const x=p.getX(i)+depot.position.x,z=p.getZ(i)+depot.position.z;p.setXYZ(i,x,height(x,z)+.05,z);}
    group.add(new T.Mesh(marking,paint));
   }
   world.add(group);return group;
  }
  function template(asset:string){
   if(!templates.has(asset)){
    const source=models[asset];if(!source)throw Error(`Vehicle model “${asset}” is missing. Rebuild the game asset pack.`);
    const json=(source as {object?:unknown}).object??source;
    const parsed=new T.ObjectLoader().parse(json);templates.set(asset,parsed);
   }
   return templates.get(asset);
  }
  function update(snapshot:LWArmoredRuntime.Snapshot,catalog:LWArmoredData.Catalog,alpha:number,seconds:number){
   const visibleDepots=new Set<string>();
   for(const depot of snapshot.depots??[]){if(depot.faction!==snapshot.playerFaction)continue;visibleDepots.add(depot.id);if(!depots.has(depot.id))depots.set(depot.id,servicePad(depot));}
   depots.forEach((pad,id)=>{pad.visible=visibleDepots.has(id);});
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
   texture.dispose();detail.dispose();scene.remove(world);templates.clear();vehicles.clear();obstacles.clear();depots.clear();geometry.clear();materials.clear();
  }};
 }
 root.LWArmoredWorld={create};
})(typeof globalThis!=='undefined'?globalThis:this);
