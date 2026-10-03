/* Cozy orthographic renderer. All resources, occupation and paths are read from the
 * simulation. Geometry and presentation never consume gameplay randomness. */
(function(root){'use strict';
 const T=root.THREE,G=root.LWGeography,L=root.LW,Old=root.LWArt.World;
 const PPU=42,SQ=Math.SQRT1_2,EL=1/Math.sqrt(6),UP=Math.sqrt(2/3),clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const palettes={Meadow:['#9cb681','#a0b984','#a5bd88'],Pinewood:['#87a591','#8cab95','#91af99'],'Amber grove':['#b4b079','#b9b57d','#beba82'],Stonegarden:['#9fad93','#a4b298','#aab79f']};
 const materialCache=new Map(),geometryCache=new Map();
 function mat(color,extra={}){color=root.LWWorldProfile.current.materialColors[color]||color;const k=color+JSON.stringify(extra);if(!materialCache.has(k))materialCache.set(k,new T.MeshStandardMaterial({color,roughness:.98,flatShading:true,...extra}));return materialCache.get(k);}
 function geo(kind){if(!geometryCache.has(kind))geometryCache.set(kind,kind==='box'?new T.BoxGeometry(1,1,1):kind==='ball'?new T.IcosahedronGeometry(1,0):kind==='tiny'?new T.SphereGeometry(1,6,4):kind==='soft'?new T.SphereGeometry(1,10,7):kind==='round'?new T.SphereGeometry(1,8,5):kind==='cone'?new T.ConeGeometry(1,1,7):kind==='cylinder'?new T.CylinderGeometry(1,1,1,8):kind==='roof'?roofGeometry():kind==='ground'?groundGeometry():new T.TorusGeometry(1,.07,4,16));return geometryCache.get(kind);}
 function groundGeometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.5,0,-.5,-.5,0,.5,.5,0,.5,.5,0,-.5],3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;}
 function roofGeometry(){const shape=new T.Shape();shape.moveTo(-.5,0);shape.lineTo(.5,0);shape.lineTo(0,.62);shape.closePath();const g=new T.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false});g.translate(0,0,-.5);return g;}
 function piece(g,kind,x,y,z,sx,sy,sz,color,rot=0,extra={}){const m=new T.Mesh(geo(kind),mat(color,extra));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.y=rot;m.castShadow=true;m.receiveShadow=true;g.add(m);return m;}
 function box(g,x,y,z,a,b,c,col,rot=0){return piece(g,'box',x,y,z,a,b,c,col,rot);}
 function ball(g,x,y,z,a,b,c,col){return piece(g,'ball',x,y,z,a,b,c,col);}
 function group(parent,x=0,y=0,z=0){const g=new T.Group();g.position.set(x,y,z);parent.add(g);return g;}
 function batch(staging){staging.updateMatrixWorld(true);const buckets=new Map();staging.traverse(o=>{if(!o.isMesh)return;const e=o.matrixWorld.elements;
  // Island-sized buckets retain useful culling bounds instead of a single world-sized batch.
  const key=Math.floor(e[12]/23)+','+Math.floor(e[14]/23)+':'+o.geometry.uuid+':'+o.material.uuid;
  if(!buckets.has(key))buckets.set(key,{geometry:o.geometry,material:o.material,list:[]});buckets.get(key).list.push(o.matrixWorld.clone());});
  const g=new T.Group();for(const v of buckets.values()){const m=new T.InstancedMesh(v.geometry,v.material,v.list.length);v.list.forEach((matrix,i)=>m.setMatrixAt(i,matrix));m.castShadow=true;m.receiveShadow=true;m.instanceMatrix.needsUpdate=true;m.computeBoundingSphere();m.matrixAutoUpdate=false;g.add(m);}g.updateMatrixWorld(true);g.matrixAutoUpdate=false;g.matrixWorldAutoUpdate=false;return g;
 }

 const artKit={T,group,box,ball,piece,mat};
 function creature(parent,c){return root.LWFidelity.create(artKit,parent,c);}
 class World {
  constructor(canvas,engine,handlers={}){
   this.canvas=canvas;this.engine=engine;this.handlers=handlers;this.camera={z:1,x:0,y:0};this.hover=null;this.selected=null;this.placement=null;this.manual=false;this.showPath=true;this.time=0;this.bubble=null;this.effects=[];this.particles=[];this.lastDrawAt=0;this.mode='WebGL · low-poly';this.actors=new Map();this.doors=new Map();this.rotors=[];this.geometryKey='';this.staticRevision=0;this.frameCount=0;this.skippedFrames=0;this.visualTime=0;this.running=false;this.quality='balanced';this.motion=new root.LWPresentation.MotionSamples();this.presentationAlpha=1;this.actorAnchors=new Map();
   try{const q=localStorage.getItem('littlewild.visual-quality');if(['eco','balanced','high'].includes(q))this.quality=q;}catch(_){}
   let context=null;try{context=canvas.getContext('webgl2',{antialias:true,alpha:false,powerPreference:'default'});}catch(error){}
   if(context)this.renderer=new T.WebGLRenderer({canvas,context,antialias:true,alpha:false});else{this.renderer=new root.LWSoftware3D(canvas,this);this.mode='Software 3D · compatibility';}

   this.renderer.setPixelRatio(1);this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFShadowMap;this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.02;
   this.scene=new T.Scene();this.scene.background=new T.Color('#d5e4df');this.scene.fog=new T.Fog('#d5e4df',105,195);
   this.cam=new T.OrthographicCamera(-20,20,15,-15,.1,250);this.cam.position.set(69,60,69);this.cam.lookAt(9,0,9);
   this.scene.add(new T.HemisphereLight('#fff2d4','#75968a',2.0));this.sun=new T.DirectionalLight('#ffe3b0',2.7);this.sun.position.set(-12,34,18);this.sun.target.position.set(9,0,9);this.scene.add(this.sun,this.sun.target);this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-25,right:25,top:25,bottom:-25,near:1,far:100});this.sun.shadow.bias=-.0015;this.sun.shadow.normalBias=.035;
   const sea=new T.Mesh(new T.PlaneGeometry(3000,3000),mat('#a2c4c5'));sea.rotation.x=-Math.PI/2;sea.position.y=-.52;sea.receiveShadow=true;this.scene.add(sea);
   this.waterMotions=[];this.smokeParticles=[];
   this.staticRoot=new T.Group();this.dynamicRoot=new T.Group();this.motionRoot=new T.Group();this.scene.add(this.staticRoot,this.dynamicRoot,this.motionRoot);
   this.marker=new T.Mesh(new T.RingGeometry(.40,.455,40),new T.MeshBasicMaterial({color:'#f4e4a9',side:T.DoubleSide,depthTest:true,depthWrite:false}));this.marker.rotation.x=-Math.PI/2;this.marker.position.y=.055;this.marker.renderOrder=1;this.marker.castShadow=false;this.marker.receiveShadow=false;this.scene.add(this.marker);
   this.tileCursor=new T.Group();for(const x of[-.5,.5])box(this.tileCursor,x,0,0,.025,.015,1.025,'#e7d79b');for(const z of[-.5,.5])box(this.tileCursor,0,0,z,1.025,.015,.025,'#e7d79b');this.pathDots=new T.Group();this.scene.add(this.pathDots);for(let i=0;i<64;i++){const d=piece(this.pathDots,'cylinder',0,.07,0,.12,.008,.12,'#f6e7aa');d.visible=false;}
   this.tileCursor.position.y=.10;this.tileCursor.visible=false;this.scene.add(this.tileCursor);
   this.atmosphere=document.createElement('div');this.atmosphere.className='v13-atmosphere';this.atmosphere.setAttribute('aria-hidden','true');canvas.parentElement.appendChild(this.atmosphere);
   this.labels=document.createElement('div');this.labels.className='v10-labels';canvas.parentElement.appendChild(this.labels);this.labelLayer=new root.LWPresentation.Labels(this.labels,id=>{const c=this.engine.creatures.find(c=>c.id===id&&!c.activeQuest);if(c)this.handlers.inspect?.({x:Math.round(c.creature.x),y:Math.round(c.creature.y),actorId:id,objectType:'pip'});});this.labelNodes=this.labelLayer.nodes;
   this.raycaster=new T.Raycaster();this.floor=new T.Plane(new T.Vector3(0,1,0),0);
   this.input=root.LWWorldInput.bind(this);this.setQuality(this.quality);this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();this.contextLost=true;this.contextWarning?.remove();this.contextWarning=document.createElement('div');this.contextWarning.className='v10-render-warning';this.contextWarning.setAttribute('role','status');this.contextWarning.textContent='Graphics interrupted. Your story and controls remain available. Waiting for graphics recovery; export a backup in Settings.';this.labels.appendChild(this.contextWarning);});
   canvas.addEventListener('webglcontextrestored',()=>{this.contextLost=false;this.geometryKey='';this.invalidate();this.contextWarning?.remove();this.contextWarning=null;});
  }
  invalidate(){this.forceDraw=true;this.lastDrawAt=0;}
  resetPresentation(){this.motion.reset();this.actorAnchors.clear();this.labelLayer.clear();this.input?.cancel();this.geometryKey='';this.renderKey='';this.planKey='';this.lastState=null;for(const a of this.actors.values())this.dynamicRoot.remove(a.root);this.actors.clear();for(const r of this.responses||[])r.el.remove();this.responses=[];this.effects=[];this.particles=[];this.menuTile=null;this.visualTime=0;this.invalidate();}
  setQuality(q){if(!['eco','balanced','high'].includes(q))return false;this.quality=q;this.renderer.setQuality?.(q);this.renderer.shadowMap.enabled=q!=='eco';this.sun?.shadow.mapSize.set(q==='high'?2048:1024,q==='high'?2048:1024);if(this.sun?.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}try{localStorage.setItem('littlewild.visual-quality',q);}catch(_){}this.invalidate();return true;}
  makeGround(){this.geometryKey='';this.invalidate();}
  resize(){const r=this.canvas.getBoundingClientRect();if(!r.width||!r.height)return;this.renderer.setSize(Math.round(r.width),Math.round(r.height),false);this.invalidate();if(!this.manual)this.home();this.syncCamera();}
  home(){const w=this.canvas.width,h=this.canvas.height;this.camera.z=clamp(Math.min((w-110)/1040,(h-190)/610),.38,1.2);this.camera.x=w>900?50:0;this.camera.y=30;this.manual=false;this.syncCamera();}
  focus(x,y){const p=this.toScreen(x,y);this.camera.x+=this.canvas.width/2-p.x;this.camera.y+=this.canvas.height*.49-p.y;this.manual=true;this.invalidate();this.syncCamera();}
  fit(){const a=this.engine.s.estate.islands;const xs=a.map(i=>i.ix*23),ys=a.map(i=>i.iy*23),loX=Math.min(...xs),hiX=Math.max(...xs)+18,loY=Math.min(...ys),hiY=Math.max(...ys)+18;this.camera.z=clamp(Math.min((this.canvas.width-140)/((hiX-loX+hiY-loY+4)*PPU*SQ),(this.canvas.height-210)/((hiX-loX+hiY-loY+4)*PPU*EL)),.16,1.2);this.camera.x=this.camera.y=0;this.focus((loX+hiX)/2,(loY+hiY)/2);}
  project(x,y){return {x:(x-y)*PPU*SQ,y:(x+y)*PPU*EL};}
  transform(){return{x:this.canvas.width/2+this.camera.x,y:this.canvas.height/2-18*PPU*EL*this.camera.z+this.camera.y,z:this.camera.z};}
  toScreen(x,y,height=0){const p=this.project(x,y),t=this.transform();return{x:p.x*t.z+t.x,y:(p.y-height*PPU*UP)*t.z+t.y};}
  toTile(x,y){const t=this.transform(),px=(x-t.x)/t.z/(PPU*SQ),py=(y-t.y)/t.z/(PPU*EL);return{x:Math.round((py+px)/2),y:Math.round((py-px)/2)};}
  syncCamera(){const w=this.canvas.width,h=this.canvas.height,k=PPU*this.camera.z;this.cam.left=(-w/2-this.camera.x)/k;this.cam.right=(w/2-this.camera.x)/k;this.cam.top=(h/2+this.camera.y)/k;this.cam.bottom=(-h/2+this.camera.y)/k;this.cam.updateProjectionMatrix();this.cam.updateMatrixWorld();}
  zoom(f){this.zoomAt(f,this.canvas.width/2,this.canvas.height/2);}
  zoomAt(f,x,y){const before=this.transform(),p={x:(x-before.x)/before.z,y:(y-before.y)/before.z};this.camera.z=clamp(this.camera.z*f,.16,2.6);const after=this.transform();this.camera.x+=x-(p.x*after.z+after.x);this.camera.y+=y-(p.y*after.z+after.y);this.manual=true;this.limitCamera();this.syncCamera();}
  limitCamera(){const a=this.engine.s.estate.islands;const max=Math.max(35,...a.map(i=>Math.max(Math.abs(i.ix),Math.abs(i.iy))*23+24))*PPU*this.camera.z;this.camera.x=clamp(this.camera.x,-max,max);this.camera.y=clamp(this.camera.y,-max,max);}
  hitTest(x,y){for(const c of this.engine.creatures.filter(c=>!c.activeQuest)){const v=this.actors.get(c.id),inside=v?.lastInside,b=inside&&this.engine.s.buildings.find(b=>b.id===inside),p=this.toScreen(b?.x??v?.root.position.x??c.creature.x,b?.y??v?.root.position.z??c.creature.y,inside?1.5:(v?.contextHeight??.67));if(Math.hypot(x-p.x,(y-p.y)*.85)<Math.max(16,this.camera.z*19))return {x:Math.round(c.creature.x),y:Math.round(c.creature.y),objectType:'pip',actorId:c.id};}
   const objects=[...this.engine.s.buildings.map(b=>({...b,h:root.LWAssets.building(b.kind)?.metadata?.hitHeight||1.1})),...this.engine.s.nodes.filter(n=>!this.engine.s.buildings.some(b=>b.x===n.x&&b.y===n.y)).map(n=>({...n,h:root.LWAssets.item(n.kind)?.metadata?.worldHitHeight||.2}))].sort((a,b)=>(b.x+b.y)-(a.x+a.y));
   for(const o of objects){const p=this.toScreen(o.x,o.y);if(Math.abs(x-p.x)<Math.max(9,20*this.camera.z)&&y>p.y-o.h*PPU*this.camera.z&&y<p.y+10*this.camera.z)return{x:o.x,y:o.y,objectType:o.kind,objectId:o.id};}return this.toTile(x,y);}
  say(text,type='heart',actorId=null){Old.prototype.say.call(this,text,type,actorId);}
  feedbackEvent(e){Old.prototype.feedbackEvent.call(this,e);
   if(!['interaction','roll','social'].includes(e.type)||!e.actorId)return;
   const c=this.engine.creatures.find(c=>c.id===e.actorId&&!c.activeQuest);if(!c)return;
   const effect=document.createElement('span');effect.className='v12-response'+(this.engine.s.settings.reducedMotion?' reduced':'');effect.setAttribute('aria-hidden','true');effect.textContent=e.type==='roll'?(e.roll?.success?'✧':'…'):e.type==='social'&&e.success===false?'…':'♡';effect.dataset.actor=c.id;this.labels.appendChild(effect);this.responses??=[];this.responses.push({el:effect,actorId:c.id,until:performance.now()+2100});while(this.responses.length>8)this.responses.shift().el.remove();this.invalidate();
  }
  expireResponses(){const now=performance.now();for(const r of this.responses||[])if(now>r.until||!this.engine.creatures.some(c=>c.id===r.actorId&&!c.activeQuest))r.el.remove();this.responses=(this.responses||[]).filter(r=>r.el.isConnected);}
  paintResponses(){for(const r of this.responses||[]){const c=this.engine.creatures.find(c=>c.id===r.actorId&&!c.activeQuest);if(!c||performance.now()>r.until){r.el.remove();continue;}const v=this.actors.get(c.id);const p=this.toScreen(v?.root.position.x??c.creature.x,v?.root.position.z??c.creature.y,1.05);r.el.style.left='0';r.el.style.top='0';r.el.style.transform=`translate3d(${p.x}px,${p.y-18}px,0)`;}this.responses=(this.responses||[]).filter(r=>r.el.isConnected);}
  
  rebuild(){for(const g of [...this.staticRoot.children]){this.staticRoot.remove(g);g.traverse(o=>{if(o.isInstancedMesh)o.dispose();});}for(const o of [...this.motionRoot.children])this.motionRoot.remove(o);this.doors.clear();this.rotors=[];this.waterMotions=[];this.smokeParticles=[];
   const staging=new T.Group(),s=this.engine.s,occupied=new Set(s.buildings.map(b=>b.x+','+b.y));
   for(const i of s.estate.islands){const ix=i.ix*23,iy=i.iy*23,pal=root.LWWorldProfile.current.groundColors[G.describe(i.ix,i.iy).biome]||palettes.Meadow;
    for(let x=0;x<19;x++)for(let y=0;y<19;y++){const terrain=G.islandTerrain(x,y),hash=G.hash(ix+x,iy+y)/4294967296;if(terrain==='water'){if(x>=13&&x<=16&&y>=3&&y<=7){box(staging,ix+x,-.12,iy+y,1,.14,1,'#87b4b0');if(hash>.6)root.LWAssetRenderer.createItem(artKit,staging,'water-lily','world',{position:[ix+x-.2,-.04,iy+y],rotation:[0,hash*Math.PI*2,0]});
      if(hash>.83){for(let j=0;j<2;j++){const wave=box(this.motionRoot,ix+x-.2,-.028,iy+y+j*.22,.34,.006,.022,'#b9d8cb');wave.castShadow=false;this.waterMotions.push({mesh:wave,x:wave.position.x,phase:x+y+j});}}
      }continue;}
     const shore=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>G.islandTerrain(x+dx,y+dy)==='water'),path=x===9||y===9,clear=x>=6&&x<=12&&y>=8&&y<=12;
     piece(staging,'ground',ix+x,.038,iy+y,1,1,1,shore?'#c3c49b':pal[Math.floor((Math.sin((ix+x)*.36)+Math.cos((iy+y)*.41)+2)*.7)%3]);
     // Hidden internal cube faces are omitted. Only actual coast edges have skirts.
     for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]])if(G.islandTerrain(x+dx,y+dy)==='water')box(staging,ix+x+dx*.48,-.30,iy+y+dy*.48,dx?.045:1,.66,dy?.045:1,'#b0ac8b');
     if(path){if(x===9)piece(staging,'ground',ix+x,.044,iy+y,.60,1,1.01,'#c3b48c');if(y===9)piece(staging,'ground',ix+x,.045,iy+y,1.01,1,.60,'#c3b48c');}
     if(shore&&hash>.64){for(let j=0;j<2;j++)root.LWAssetRenderer.createItem(artKit,staging,'reed','world',{position:[ix+x+.32-j*.12,0,iy+y-.24],rotation:[0,(hash+j*.27)*Math.PI*2,(hash-.5)*.25],scale:[.85,.9+hash*.22,.85]});}
     if(shore&&hash>.73){box(staging,ix+x+.10,-.46,iy+y-.05,.82,.13,.84,'#9aa597');}
     
     if(shore&&hash>.50)root.LWAssetRenderer.createItem(artKit,staging,'shore-rock','world',{position:[ix+x+.1,-.52,iy+y+.15],rotation:[0,hash*Math.PI*2,0],scale:[.9+hash*.16,.9+hash*.10,.9+hash*.16]});
     if(!path&&!clear&&hash>.60&&!occupied.has((ix+x)+','+(iy+y))){for(let n=0;n<3;n++){const a=ix+x-.29+n*.2,b=iy+y+Math.sin(n+x)*.28;root.LWAssetRenderer.createItem(artKit,staging,'wildflower',hash>.84?'world':'grass',{position:[a,0,b],rotation:[0,(hash+n*.1)*6.283,0],scale:[.9+(hash%1)*.2,.9+(hash%1)*.2,.9+(hash%1)*.2]});}}
    }
   }
   for(const b of G.bridges(s)){root.LWAssetRenderer.create(artKit,staging,'building','bridge','world',{position:[b.x,0,b.y],rotation:[0,b.dy?Math.PI/2:0,0]});}
   for(const n of s.nodes){if(occupied.has(n.x+','+n.y)||n.kind==='water')continue;const h=G.hash(n.x,n.y,19)/4294967296,biome=G.describe(Math.floor(n.x/23),Math.floor(n.y/23)).biome;
    let model='world',materials={},scale=[1,1,1],rotation=[0,h*Math.PI*2,0];
    if(n.kind==='wood'){model=biome==='Pinewood'||h>.55?'world-pine':biome==='Amber grove'?'world-amber':'world';scale=[.88+h*.20,.90+h*.24,.88+h*.20];}
    else if(['stone','ore','clay'].includes(n.kind)&&n.stock===0)model='depleted';
    if(root.LWAssets.item(n.kind)?.models?.[model])root.LWAssetRenderer.createItem(artKit,staging,n.kind,model,{position:[n.x,0,n.y],rotation,scale,materials});
   }
   // Buildings remain separate small groups so working doors animate independently.
   for(const b of s.buildings){const rendered=root.LWAssetRenderer.createBuilding(artKit,staging,b,this.doors,this.rotors);
    if(rendered.smoke){rendered.root.updateMatrixWorld(true);const origin=new T.Vector3(...rendered.smoke.position);rendered.root.localToWorld(origin);for(let j=0;j<3;j++){const smoke=piece(this.motionRoot,'ball',origin.x,origin.y+j*.18,origin.z,.08,.07,.08,'#edf0de',0,{transparent:true,opacity:.25,depthWrite:false});smoke.castShadow=false;this.smokeParticles.push({mesh:smoke,building:b,j,origin,always:!!rendered.smoke.always});}}
    piece(staging,'cylinder',b.x,.044,b.y,.74,.006,.66,'#526f57',0,{transparent:true,opacity:.16,depthWrite:false});
    if(this.engine.isIndoor(b)){const d=this.engine.doorway(b),route=G.grid(s).path({x:9,y:9},d,false)||[];
     for(let j=0;j<route.length;j++){const p=route[j];if(occupied.has(p.x+','+p.y))continue;box(staging,p.x,.047,p.y,.62,.008,.62,'#c2b48d');for(const q of[route[j-1],route[j+1]])if(q&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1)box(staging,(p.x+q.x)/2,.0475,(p.y+q.y)/2,p.x!==q.x?.53:.62,.008,p.y!==q.y?.53:.62,'#c2b48d');}
     const t=group(staging,b.x,0,b.y);t.rotation.y=b.door.dx===1?Math.PI/2:b.door.dx===-1?-Math.PI/2:b.door.dy===-1?Math.PI:0;
     for(const x of[-.75,.75]){box(t,x,.22,.65,.055,.42,.055,'#aa9269');box(t,x,.25,.35,.055,.05,.62,'#cab087');}
    }
   }
   for(const n of s.nodes)if(n.kind==='wood')piece(staging,'cylinder',n.x+.12,.043,n.y+.08,.65,.006,.48,'#526f57',0,{transparent:true,opacity:.16,depthWrite:false});
   staging.updateMatrixWorld(true);
   for(const d of this.doors.values()){this.motionRoot.attach(d.group);d.closedAngle=d.group.rotation.y;}
   for(const r of this.rotors){this.motionRoot.attach(r.group);r.startAngle=r.group.rotation[r.axis];}
   this.staticRoot.add(batch(staging));this.staticRevision++;this.invalidate();
   this.geometryKey=JSON.stringify([root.LWWorldProfile.hash,root.LWAssets.revision,s.estate.islands,s.buildings.map(b=>[b.id,b.kind,b.level,b.door]),s.nodes.filter(n=>['wood','ore','clay','stone'].includes(n.kind)).map(n=>[n.id,n.stock===0])]);this.marker.visible=false;
  }
  draw(time,dt){if(this.contextLost)return;const started=performance.now();this.time=time;this.expireResponses();const e=this.engine,s=e.s,reduced=s.settings.reducedMotion;
   if(this.lastState!==s){this.resetPresentation();this.lastState=s;}
   const frameKey=JSON.stringify([s.simTime,this.camera,this.canvas.width,this.canvas.height,this.quality,root.LWFidelity.revision(),this.showPath,this.resourceLens,this.keyboardTile,this.hover,this.menuTile,this.landSelected,this.placement,e.selected?.id,reduced,s.settings.follow,s.buildings.map(b=>[b.id,b.level]),s.nodes.filter(n=>['wood','stone','ore','clay'].includes(n.kind)).map(n=>[n.id,n.stock===0]),e.creatures.map(c=>[c.id,c.personality,c.equipment,c.activeQuest?.status,c.task?.kind,c.task?.phase,c.creature.x,c.creature.y,root.LWFidelity.mood(c),c.careVisual]),this.bubble&&[this.bubble.text,time<this.bubble.time],e.allOrders().filter(o=>o.type==='build').map(o=>[o.id,o.x,o.y,o.kind,o.stage])]);
   if(!this.running&&!this.forceDraw&&this.renderKey===frameKey){this.skippedFrames++;return;}
   this.forceDraw=false;this.renderKey=frameKey;if(this.running)this.visualTime+=Math.min(.10,Math.max(0,dt));const motion=this.visualTime;
   
   const key=JSON.stringify([root.LWWorldProfile.hash,root.LWAssets.revision,s.estate.islands,s.buildings.map(b=>[b.id,b.kind,b.level,b.door]),s.nodes.filter(n=>['wood','ore','clay','stone'].includes(n.kind)).map(n=>[n.id,n.stock===0])]);if(key!==this.geometryKey)this.rebuild();
   if(s.settings.follow&&e.selected&&!e.selected.activeQuest&&!this.contextChoosing){const sample=this.motion.sample(e.selected,s.simTime,this.presentationAlpha,this.running),p=this.toScreen(sample.x,sample.z),ease=reduced?1:1-Math.exp(-Math.max(0,dt)*3);this.camera.x+=(this.canvas.width/2-p.x)*ease;this.camera.y+=(this.canvas.height*.50-p.y)*ease;}
   this.syncCamera();const indoorCounts=new Map(),labelEntries=[];this.actorAnchors.clear();for(const c of e.creatures){let v=this.actors.get(c.id),eq=JSON.stringify([c.personality,c.equipment,root.LWFidelity.revision()]);if(!v||v.key!==eq){if(v)this.dynamicRoot.remove(v.root);v=creature(this.dynamicRoot,c);this.actors.set(c.id,v);}v.root.visible=!c.activeQuest;if(c.activeQuest)continue;
    const t=c.task,buildingId=t?.phase==='work'&&(t.insideBuildingId||(t.target&&s.buildings.find(b=>e.isIndoor(b)&&b.x===t.target.x&&b.y===t.target.y)?.id)),b=buildingId&&s.buildings.find(b=>b.id===buildingId),inside=b?b.id:null;
    if(!v.initialized){v.initialized=true;v.lastInside=inside;v.transition=null;}
    else if(inside!==v.lastInside){v.transition={from:v.lastInside,to:inside,start:motion};v.lastInside=inside;}
    const sampled=this.motion.sample(c,s.simTime,this.presentationAlpha,this.running);let x=sampled.x,z=sampled.z;if(!b){const peers=e.creatures.filter(o=>!o.activeQuest&&Math.hypot(o.creature.x-x,o.creature.y-z)<.42).sort((a,b)=>a.id.localeCompare(b.id));if(peers.length>1){const angle=peers.findIndex(o=>o.id===c.id)/peers.length*Math.PI*2;x+=Math.cos(angle)*.17;z+=Math.sin(angle)*.17;}}if(b)indoorCounts.set(b.id,(indoorCounts.get(b.id)||0)+1);
    const trans=v.transition,phase=trans?clamp((motion-trans.start)/.7,0,1):1;
    if(b){const d=b.door||{dx:0,dy:1};x=b.x+d.dx*(1-phase*.82);z=b.y+d.dy*(1-phase*.82);if(phase>=1)v.root.visible=false;v.body.rotation.y=Math.atan2(-d.dx,-d.dy);}
    else if(trans?.from&&phase<1){const previous=s.buildings.find(b=>b.id===trans.from);if(previous){const d=previous.door||{dx:0,dy:1};x=previous.x+d.dx*(.18+phase*.82);z=previous.y+d.dy*(.18+phase*.82);v.body.rotation.y=Math.atan2(d.dx,d.dy);}}
    else if(t?.phase==='walk'&&t.path?.length){const p=t.path[0];if(p)v.body.rotation.y=Math.atan2(p.x-x,p.y-z);}
    const distance=v.previousPosition?Math.hypot(x-v.previousPosition.x,z-v.previousPosition.z):0;
    v.previousPosition={x,z};v.root.position.set(x,0,z);
    root.LWFidelity.setPose(v,c,{simTime:s.simTime,time:motion,animate:this.running&&!reduced,walking:t?.phase==='walk',working:!b&&t?.phase==='work',distance});
    const height=b?1.88:v.labelHeight,p=this.toScreen(b?.x??x,b?.y??z,height);p.y-=7;
    const caption=c.name+(b?(phase<1?' · Entering ':' · Inside ')+L.BUILDINGS[b.kind].name:trans?.from&&phase<1?' · Stepping outside':'');
    this.actorAnchors.set(c.id,{id:c.id,x,z,head:p,ground:this.toScreen(x,z,.08),context:this.toScreen(b?.x??x,b?.y??z,b?1.58:v.contextHeight),bubbleHeight:v.bubbleHeight,inside:inside||null,visible:v.root.visible,phase,height});
    labelEntries.push({id:c.id,anchor:p,caption,title:t?.label||'Taking a moment',selected:e.selected?.id===c.id,accessible:c.name+(e.selected?.id===c.id?' · selected':'')+' · '+(b?'Inside '+L.BUILDINGS[b.kind].name:t?.label||'Taking a moment')+' · Open interactions'});
   }
   for(const c of e.creatures)if(c.activeQuest)labelEntries.push({id:c.id,caption:c.name,title:'Away on a quest',away:true,anchor:null});
   for(const[id,v]of this.actors)if(!e.creatures.some(c=>c.id===id)){this.dynamicRoot.remove(v.root);this.actors.delete(id);}
   for(const[id,d]of this.doors){const open=indoorCounts.has(id)||[...this.actors.values()].some(v=>v.transition&&(v.transition.from===id||v.transition.to===id)&&motion-v.transition.start<1.2);const target=d.closedAngle+(open?(d.openDelta??-Math.PI*.6):0);d.group.rotation.y=this.running&&!reduced?d.group.rotation.y+(target-d.group.rotation.y)*Math.min(1,dt*12):target;}
   for(const r of this.rotors)r.group.rotation[r.axis]=r.startAngle+(!reduced?motion*(r.speed??.32):0);
   for(const w of this.waterMotions)w.mesh.position.x=w.x+(!reduced?Math.sin(motion*.7+w.phase)*.10:0);
   for(const p of this.smokeParticles){const b=p.building,active=p.always||indoorCounts.has(b.id)||e.creatures.some(c=>c.task?.phase==='work'&&c.task.buildingId===b.id);p.mesh.visible=active&&!reduced;const v=(motion*.32+p.j/3)%1;p.mesh.position.set(p.origin.x+v*.10,p.origin.y+v*.62,p.origin.z-v*.06);p.mesh.scale.setScalar(.05+v*.10);}
   
   const selectedAnchor=this.actorAnchors.get(e.selected?.id);let point=this.placement&&this.hover?this.hover:selectedAnchor?.visible&&!(selectedAnchor.inside&&selectedAnchor.phase>.55)?{x:selectedAnchor.x,y:selectedAnchor.z}:null;if(this.landSelected)point=this.landSelected;this.marker.visible=!!point;if(point){const bridge=G.bridges(s).some(b=>Math.abs(point.x-b.x)<(b.dy?.52:2.7)&&Math.abs(point.y-b.y)<(b.dy?2.7:.52));this.marker.position.set(point.x,bridge?.113:.074,point.y);this.marker.material.color.set(this.placement&&e.placementIssue(this.placement,point.x,point.y)?'#d2927e':'#f7df9c');}
   const tile=this.menuTile||(!this.placement?this.keyboardTile||this.hover:null);this.tileCursor.visible=!!tile;
   if(tile)this.tileCursor.position.set(tile.x,.11,tile.y);
   const route=this.showPath&&!e.selected?.activeQuest?e.selected?.task?.path||[]:[];this.pathDots.children.forEach((dot,i)=>{dot.visible=i<route.length;if(dot.visible)dot.position.set(route[i].x,.065,route[i].y);});
   this.renderPlans();this.renderer.render(this.scene,this.cam);this.labelLayer.paint(labelEntries,this.canvas.width,this.canvas.height,this.camera.z);this.paintResponses();this.drawLens();this.drawFeedback();this.frameCount++;this.lastFrameMs=performance.now()-started;
  }
  renderPlans(){const sig=JSON.stringify([root.LWAssets.revision,this.engine.allOrders().filter(o=>o.type==='build').map(o=>[o.id,o.x,o.y,o.kind,o.stage])]);if(sig!==this.planKey){if(this.plans)this.scene.remove(this.plans);this.plans=new T.Group();this.scene.add(this.plans);for(const o of this.engine.allOrders().filter(o=>o.type==='build')){const asset=root.LWAssets.building(o.kind);if(!asset)continue;const color=o.stage>0?'#aeb29f':'#d8c596',opacity=o.stage>0?.32:.18,materials=Object.fromEntries(Object.keys(asset.materials).map(key=>[key,{color,transparent:true,opacity,depthWrite:false,roughness:1}]));root.LWAssetRenderer.create(artKit,this.plans,'building',o.kind,'world',{position:[o.x,.045,o.y],scale:[.96,.96,.96],materials});box(this.plans,o.x,.025,o.y,1.04,.018,1.04,'#d8c596');}this.planKey=sig;}}
  drawLens(){this.lens??=document.createElement('div');if(!this.lens.parentElement){this.lens.className='v10-lens';this.labels.appendChild(this.lens);}const wanted=root.LWWorldContent.building(this.placement)?.requiresNode;const active=this.resourceLens||!!this.placement;this.lens.hidden=!active;if(!active)return;const sig=JSON.stringify([this.camera,this.canvas.width,this.canvas.height,this.placement,this.engine.s.nodes.map(n=>[n.id,n.stock])]);if(sig===this.lensKey)return;this.lensKey=sig;this.lens.replaceChildren();for(const n of this.engine.s.nodes){if(wanted&&n.kind!==wanted)continue;const d=root.LWWorldContent.node(n.kind);if(!d)continue;const p=this.toScreen(n.x,n.y,root.LWAssets.item(n.kind)?.metadata?.worldHitHeight||.25);if(p.x<0||p.x>this.canvas.width||p.y<60||p.y>this.canvas.height-70)continue;const b=document.createElement('span');b.style.transform=`translate(${p.x}px,${p.y}px)`;b.textContent=wanted?'Build here':d.mode==='finite'?n.stock+' '+(d.name||n.kind):d.name+' ∞';this.lens.appendChild(b);}}
  drawFeedback(){this.feedback??=document.createElement('div');if(!this.feedback.parentElement){this.feedback.className='v10-world-feedback';this.labels.appendChild(this.feedback);}this.feedback.hidden=!this.bubble||this.bubble.time<this.time;if(!this.feedback.hidden){const a=this.engine.creatures.find(c=>c.id===this.bubble.actorId&&!c.activeQuest);if(!a){this.feedback.hidden=true;return;}const anchor=this.creatureAnchor(a.id);const p=this.toScreen(anchor?.x??a.creature.x,anchor?.z??a.creature.y,anchor?.bubbleHeight??1.55);this.feedback.style.transform=`translate(${p.x}px,${p.y-22}px) translate(-50%,-100%)`;this.feedback.textContent=this.bubble.text;}}
  creatureAnchor(id){return this.actorAnchors.get(id)||null;}
  diagnostics(){return{labels:this.labelLayer.diagnostics(),renderer:this.mode,quality:this.quality,renderedFrames:this.frameCount,skippedFrames:this.skippedFrames,lastFrameMs:+(this.lastFrameMs||0).toFixed(2),software:this.renderer.diagnostics?.(),drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,islands:this.engine.s.estate.islands.length};}
 }
 const portraits=new Map();
 root.LWArt.pip=function(ctx,x,y,scale=1,dir,mood,phase,task,reduced,c){
  c ||= {id:'c1',archetype:root.LWCreatures.defaultArchetype,personality:root.LWCreatures.defaultPersonality,equipment:{},inventory:{}};
  const key=JSON.stringify([c.id,c.archetype,c.personality,c.equipment,root.LWFidelity.revision(),root.LWFidelity.mood(c),c.careVisual]);let image=portraits.get(key);
  if(!image){image=document.createElement('canvas');image.width=80;image.height=94;const scene=new T.Scene(),figure=creature(scene,c);figure.root.position.set(9,0,9);figure.body.rotation.y=.55;figure.carry.visible=false;const owner={camera:{x:0,y:26,z:1.75}};const renderer=new root.LWSoftware3D(image,owner);renderer.last=-Infinity;renderer.render(scene);portraits.set(key,image);if(portraits.size>48)portraits.delete(portraits.keys().next().value);}
  ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(image,x-22*scale,y-48*scale,44*scale,52*scale);ctx.restore();
 };
 root.LWArt.World=World;root.LWArt.World2D=Old;
})(typeof globalThis!=='undefined'?globalThis:this);
