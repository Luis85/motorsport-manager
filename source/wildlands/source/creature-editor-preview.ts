/// <reference path="./creature-editor-preview-contracts.d.ts" />
/* An actual Three.js primitive scene. Its frame is supplied by the host's existing RAF. */
(function(inputRoot:unknown){
 'use strict';
 type Object3D=LWCreaturePreview.Object3D;
 interface Geometry {dispose():void;setAttribute(name:string,value:unknown):void;setIndex(values:number[]):void;computeVertexNormals():void;translate(x:number,y:number,z:number):void;}
 interface Material {dispose():void;}
 interface Camera extends Object3D {left:number;right:number;top:number;bottom:number;lookAt(x:number,y:number,z:number):void;updateProjectionMatrix():void;}
 interface Scene extends Object3D {background:unknown;}
 interface Renderer {setSize(width:number,height:number,style?:boolean):void;render(scene:Scene,camera?:Camera):void;dispose():void;forceContextLoss?():void;}
 interface Three {Group:new()=>Object3D;Scene:new()=>Scene;Color:new(value:string)=>unknown;Mesh:new(geometry:Geometry,material:Material)=>Object3D;MeshStandardMaterial:new(options:Record<string,unknown>)=>Material;BoxGeometry:new(x:number,y:number,z:number)=>Geometry;IcosahedronGeometry:new(radius:number,detail:number)=>Geometry;SphereGeometry:new(radius:number,width:number,height:number)=>Geometry;ConeGeometry:new(radius:number,height:number,segments:number)=>Geometry;CylinderGeometry:new(top:number,bottom:number,height:number,segments:number)=>Geometry;TorusGeometry:new(radius:number,tube:number,radial:number,tubular:number)=>Geometry;BufferGeometry:new()=>Geometry;Float32BufferAttribute:new(values:number[],size:number)=>unknown;Shape:new()=>{moveTo(x:number,y:number):void;lineTo(x:number,y:number):void;closePath():void};ExtrudeGeometry:new(shape:unknown,options:Record<string,unknown>)=>Geometry;OrthographicCamera:new(left:number,right:number,top:number,bottom:number,near:number,far:number)=>Camera;HemisphereLight:new(sky:string,ground:string,intensity:number)=>Object3D;DirectionalLight:new(color:string,intensity:number)=>Object3D;WebGLRenderer:new(options:Record<string,unknown>)=>Renderer;}
 interface Root {THREE:Three;LWAssetRenderer:{createMaterial(T:Three,color:string,extra:Record<string,unknown>):Material;disposeKit(kit:unknown):void;createFromDefinition(kit:LWCreaturePreview.Kit,parent:Object3D,input:unknown,model:string,options:Record<string,unknown>):LWCreaturePreview.Instance};LWSoftware3D:new(canvas:HTMLCanvasElement,owner:unknown)=>Renderer;LWCreaturePreview?:LWCreaturePreview.Api;}
 const root=inputRoot as Root,T=root.THREE,record=(value:unknown):Record<string,unknown>=>value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
 function create(canvas:HTMLCanvasElement):LWCreaturePreview.Preview {
  const lifecycle=new AbortController(),scene=new T.Scene(),camera=new T.OrthographicCamera(-1.3,1.3,1.1,-1.1,.01,100),geometries=new Map<string,Geometry>(),materials:Material[]=[];
  let disposed=false,dirty=true,figure:LWCreaturePreview.Instance|null=null,yaw=.45,pitch=0,zoom=1,nodeCount=0,stamp='',drag:{x:number;y:number}|null=null;
  let webgl=false,renderer:Renderer;
  const background=getComputedStyle(canvas).getPropertyValue('--experience-paper').trim()||'#f6f5ee';
  const owner={camera:{x:0,y:0,z:5},environment:{background}};
  try{const context=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});if(!context)throw Error('Software projection');renderer=new T.WebGLRenderer({canvas,context,antialias:true,alpha:false,preserveDrawingBuffer:true});webgl=true;}catch{renderer=new root.LWSoftware3D(canvas,owner);}
  scene.background=new T.Color(background);camera.position.set(2,1.7,3);camera.lookAt(0,.52,0);
  scene.add(new T.HemisphereLight('#fff2d4','#75968a',2));const light=new T.DirectionalLight('#ffe3b0',2.7);light.position.set(-3,5,5);scene.add(light);
  function geometry(kind:string):Geometry {
   const cached=geometries.get(kind);if(cached)return cached;let made:Geometry;
   if(kind==='box')made=new T.BoxGeometry(1,1,1);else if(kind==='ball')made=new T.IcosahedronGeometry(1,0);else if(kind==='soft'||kind==='tiny')made=new T.SphereGeometry(1,kind==='tiny'?6:10,kind==='tiny'?4:7);else if(kind==='cone')made=new T.ConeGeometry(1,1,7);else if(kind==='cylinder')made=new T.CylinderGeometry(1,1,1,8);else if(kind==='ring')made=new T.TorusGeometry(1,.07,4,16);else if(kind==='roof'){const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,.62);shape.closePath();made=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});made.translate(0,0,-.5);}else if(kind==='ground'){made=new T.BufferGeometry();made.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5,-.5,0,.5,.5,0,.5,.5,0,-.5],3));made.setIndex([0,1,2,0,2,3]);made.computeVertexNormals();}else throw Error('Unsupported preview primitive '+kind);geometries.set(kind,made);return made;
  }
  function mat(color:string,extra:Record<string,unknown>={}):Material {const material=root.LWAssetRenderer.createMaterial(T,color,extra);materials.push(material);return material;}
  const kit:LWCreaturePreview.Kit&{T:Three;mat:typeof mat}={T,mat,group(parent){const group=new T.Group();parent.add(group);return group;},piece(parent,kind,x,y,z,sx,sy,sz,color,rotation,extra){const mesh=new T.Mesh(geometry(kind),mat(color,extra));mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.rotation.y=rotation;parent.add(mesh);return mesh;}};
  function clear():void {if(figure)scene.remove(figure.root);figure=null;root.LWAssetRenderer.disposeKit(kit);for(const material of materials)material.dispose();materials.length=0;}
  function update(value:LWCreatureEditor.Package,personality:string,pose:string):void {
   if(disposed)return;const next=JSON.stringify([value.appearanceManifest,personality,pose]);if(next===stamp)return;
   clear();stamp=next;const appearance=record(record(value.appearanceManifest.behaviors.appearances)[personality]);
   try{figure=root.LWAssetRenderer.createFromDefinition(kit,scene,value.appearanceManifest,String(appearance.model),{materials:record(appearance.materials),scale:appearance.scale});nodeCount=0;figure.root.traverse(()=>nodeCount++);
    for(const ref of ['care','carry']){const id=value.appearanceManifest.rig[ref];if(typeof id==='string'){const handle=figure.handles.get(id);if(handle)handle.visible=false;}}
    const head=figure.handles.get(String(value.appearanceManifest.rig.head));if(head){head.rotation.x=pose==='rest'?.22:pose==='curious'?-.12:0;head.rotation.y=pose==='curious'?.3:0;}
    const arms=value.appearanceManifest.rig.arms;if(Array.isArray(arms))arms.forEach((id,index)=>{const arm=figure?.handles.get(String(id));if(arm)arm.rotation.x=pose==='wave'&&index===0?-1.5:pose==='rest'?.12:0;});
    dirty=true;
   }catch(error){clear();stamp='';throw error;}
  }
  function draw():void {if(disposed||!canvas.isConnected||!figure)return;const bounds=canvas.getBoundingClientRect(),width=Math.round(bounds.width),height=Math.round(bounds.height);if(!width||!height)return;if(canvas.width!==width||canvas.height!==height){renderer.setSize(width,height,false);dirty=true;}if(!dirty)return;dirty=false;figure.root.rotation.set(pitch,yaw,0);figure.root.position.set(webgl?0:9,0,webgl?0:9);owner.camera.z=5*zoom;owner.camera.y=height*.04;camera.left=-1.3*width/height/zoom;camera.right=-camera.left;camera.top=1.1/zoom;camera.bottom=-camera.top;camera.updateProjectionMatrix();renderer.render(scene,camera);}
  canvas.addEventListener('pointerdown',event=>{drag={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);},{signal:lifecycle.signal});
  canvas.addEventListener('pointermove',event=>{if(!drag)return;yaw+=(event.clientX-drag.x)*.01;pitch=Math.max(-.65,Math.min(.65,pitch+(event.clientY-drag.y)*.005));drag={x:event.clientX,y:event.clientY};dirty=true;},{signal:lifecycle.signal});
  canvas.addEventListener('pointerup',()=>{drag=null;},{signal:lifecycle.signal});
  canvas.addEventListener('wheel',event=>{event.preventDefault();zoom=Math.max(.5,Math.min(2.5,zoom-event.deltaY*.002));dirty=true;},{passive:false,signal:lifecycle.signal});
  canvas.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','Home'].includes(event.key))return;event.preventDefault();if(event.key==='ArrowLeft')yaw-=.15;if(event.key==='ArrowRight')yaw+=.15;if(event.key==='ArrowUp')pitch=Math.max(-.65,pitch-.1);if(event.key==='ArrowDown')pitch=Math.min(.65,pitch+.1);if(event.key==='+')zoom=Math.min(2.5,zoom+.1);if(event.key==='-')zoom=Math.max(.5,zoom-.1);if(event.key==='Home'){yaw=.45;pitch=0;zoom=1;}dirty=true;},{signal:lifecycle.signal});
  return {update,draw,get nodeCount(){return nodeCount;},dispose(){if(disposed)return;disposed=true;lifecycle.abort();clear();for(const geometry of geometries.values())geometry.dispose();geometries.clear();renderer.dispose();renderer.forceContextLoss?.();}};
 }
 root.LWCreaturePreview={create};
})(globalThis);
