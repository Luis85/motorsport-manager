/// <reference path="./armored-presentation-contracts.d.ts" />
/** Perspective battle presentation; no game rules, authoritative clocks, or live ECS references. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {THREE:any;LWArmoredWorld:any;LWArmoredRenderer?:unknown};
 function create(canvas:HTMLCanvasElement,catalog:LWArmoredData.Catalog,mission:LWArmoredData.Mission,models:LWArmoredPresentation.Models,settings:LWArmoredPresentation.Camera,onLost:()=>void):LWArmoredPresentation.Surface {
  const T=root.THREE,renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  if(T.ACESFilmicToneMapping)renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.05;
  if(T.SRGBColorSpace)renderer.outputColorSpace=T.SRGBColorSpace;
  else if(T.sRGBEncoding)renderer.outputEncoding=T.sRGBEncoding;
  const scene=new T.Scene();scene.background=new T.Color('#b8c0b2');scene.fog=new T.Fog('#b8c0b2',180,700);
  const camera=new T.PerspectiveCamera(settings.fov,1,.12,1400);
  scene.add(new T.HemisphereLight('#e8eee0','#645e44',1.9));
  const sun=new T.DirectionalLight('#fff0cc',2.8);sun.position.set(-70,120,-45);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-90;sun.shadow.camera.right=90;sun.shadow.camera.top=90;sun.shadow.camera.bottom=-90;sun.shadow.camera.near=1;sun.shadow.camera.far=350;sun.shadow.bias=-.0005;
  scene.add(sun);scene.add(sun.target);
  const world=root.LWArmoredWorld.create(scene,mission,models),ray=new T.Raycaster(),from=new T.Vector3(),wanted=new T.Vector3(),target=new T.Vector3();
  let lastTick=-1,debt=0,initialized=false,destroyed=false,lastMode=settings.mode;
  const lifecycle=new AbortController();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();onLost();},{signal:lifecycle.signal});
  canvas.addEventListener('webglcontextrestored',()=>{onLost();},{signal:lifecycle.signal});
  const resize=()=>{const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  return {render(snapshot,seconds){
   if(destroyed)return;
   if(snapshot.tick!==lastTick){lastTick=snapshot.tick;debt=0;}else debt+=seconds;
   world.update(snapshot,catalog,Math.min(1,.5+debt*60),seconds);
   const vehicle=snapshot.vehicles.find(v=>v.id===snapshot.controlled)??snapshot.vehicles[0];if(!vehicle)return;
   const position=vehicle.transform.position,definition=catalog.vehicles.find(v=>v.id===vehicle.definition)!;
   from.set(position.x,position.y+definition.height*.95,position.z);
   const yaw=settings.yaw,pitch=settings.pitch,dx=Math.sin(yaw)*Math.cos(pitch),dz=Math.cos(yaw)*Math.cos(pitch),dy=Math.sin(pitch);
   const fov=settings.mode==='gunner'?25:settings.mode==='binocular'?14:settings.fov;
   if(camera.fov!==fov){camera.fov=fov;camera.updateProjectionMatrix();}
   const controlled=world.vehicles.get(vehicle.id);
   if(controlled)controlled.model.visible=settings.mode==='chase';
   if(settings.mode==='chase'){
    wanted.set(from.x-dx*11.8,from.y+4.2-dy*8,from.z-dz*11.8);
    wanted.y=Math.max(wanted.y,world.height(wanted.x,wanted.z)+1.4);
    const direction=wanted.clone().sub(from),distance=direction.length();ray.set(from,direction.normalize());ray.far=distance;
    const hit=ray.intersectObjects([...world.obstacles.values()],true)[0];if(hit&&hit.distance<distance)wanted.copy(from).addScaledVector(direction,Math.max(1,hit.distance-.6));
    target.set(from.x+dx*14,from.y+dy*14-.7,from.z+dz*14);
   }else{
    wanted.copy(from);wanted.y=position.y+(settings.mode==='binocular'?definition.height+1:definition.muzzleHeight);
    target.set(wanted.x+dx*100,wanted.y+dy*100,wanted.z+dz*100);
   }
   if(!initialized||lastMode!==settings.mode){camera.position.copy(wanted);initialized=true;lastMode=settings.mode;}else camera.position.lerp(wanted,1-Math.exp(-seconds*9));
   if(settings.shake>0&&vehicle.weapon.recoil>0)camera.position.y+=Math.sin(snapshot.seconds*90)*vehicle.weapon.recoil*.07*settings.shake;
   camera.lookAt(target);sun.position.set(position.x-70,120,position.z-45);sun.target.position.set(position.x,0,position.z);
   renderer.render(scene,camera);
  },destroy(){destroyed=true;lifecycle.abort();observer.disconnect();world.dispose();renderer.dispose();}};
 }
 root.LWArmoredRenderer={create};
})(typeof globalThis!=='undefined'?globalThis:this);
