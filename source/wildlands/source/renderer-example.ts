/// <reference path="./renderer-contracts.d.ts" />
/* A complete small custom renderer. Register explicitly: LWRendererExample.register(). */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWRendererExample?:unknown;};
 function record(value:unknown):Readonly<Record<string,unknown>>|null {return value&&typeof value==='object'&&!Array.isArray(value)?value as Readonly<Record<string,unknown>>:null;}
 function register():()=>void {
  return LWRenderers.register({id:'field-map',name:'Field map',description:'A compact top-down canvas map.',capabilities:['camera','hit-test','terrain-preview','interiors']},context=>{
   const c=context.canvas.getContext('2d');if(!c)throw Error('Canvas 2D is unavailable.');
   let disposed=false;
   const project=(tile:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame)=>({x:frame.viewport.width/2+(tile.x-9)*24*frame.camera.z+frame.camera.x,y:frame.viewport.height/2+(tile.y-9)*24*frame.camera.z+frame.camera.y});
   const toTile=(point:LittlewildRenderer.Point,frame:LittlewildRenderer.Frame)=>({x:Math.round((point.x-frame.viewport.width/2-frame.camera.x)/(24*frame.camera.z)+9),y:Math.round((point.y-frame.viewport.height/2-frame.camera.y)/(24*frame.camera.z)+9)});
   return {
    mount(){},resize(){},dispose(){disposed=true;},project,toTile,
    hitTest(point,frame){for(const actor of frame.actors.filter(actor=>!actor.away)){const p=project(actor,frame);if(Math.hypot(p.x-point.x,p.y-point.y)<16)return{x:Math.round(actor.x),y:Math.round(actor.y),actorId:actor.id,objectType:'pip'};}for(const object of [...frame.buildings,...frame.nodes]){const p=project(object,frame);if(Math.hypot(p.x-point.x,p.y-point.y)<12)return{x:object.x,y:object.y,objectId:object.id,objectType:object.kind};}return toTile(point,frame);},
    draw(frame){
     if(disposed)return;c.fillStyle='#e7eadc';c.fillRect(0,0,frame.viewport.width,frame.viewport.height);
     const room=frame.room,floor=room?.floors.find(floor=>floor.id===frame.interiorView?.floorId);
     if(room&&floor){
      const surface=frame.interiorView?.surface||{x:24,y:260,width:Math.max(120,frame.viewport.width-400),height:Math.max(170,frame.viewport.height-380)};
      const unit=Math.max(8,Math.min((surface.width-64)/floor.width,(surface.height-80)/floor.height)),left=surface.x+(surface.width-floor.width*unit)/2,top=surface.y+(surface.height-floor.height*unit)/2;
      c.strokeStyle='#b8c7cf';c.lineWidth=1;
      c.fillStyle='#e7eadc';c.fillRect(left-8,top-30,floor.width*unit+16,floor.height*unit+50);c.fillStyle='#294336';c.textAlign='left';c.font='14px sans-serif';c.fillText(room.buildingName+' · '+floor.label,left,top-10);
      const cells=floor.cells||Array.from({length:floor.width*floor.height},(_,index)=>({x:index%floor.width,y:Math.floor(index/floor.width)}));
      c.fillStyle='#d6dadd';for(const cell of cells)c.fillRect(left+cell.x*unit,top+cell.y*unit,unit-1,unit-1);
      c.fillStyle='#aa9269';for(const station of floor.stations)c.fillRect(left+station.x*unit+2,top+station.y*unit+2,unit-5,unit-5);
      if(room.sceneProps?.floorId===floor.id)for(const prop of room.sceneProps.props){c.fillStyle=prop.category==='building'?'#aa9269':'#d0b768';c.fillRect(left+(prop.x+.15)*unit,top+(prop.y+.15)*unit,unit*.7,unit*.7);c.fillStyle='#294336';c.font='12px sans-serif';c.fillText(prop.name,left+prop.x*unit,top+prop.y*unit-2);}
      for(const actor of room.actors.filter(actor=>actor.floorId===floor.id)){c.fillStyle='#577588';c.beginPath();c.arc(left+(actor.x+.5)*unit,top+(actor.y+.5)*unit,Math.max(6,unit*.12),0,Math.PI*2);c.fill();c.fillStyle='#294336';c.fillText(actor.name+' · '+actor.action,left,top+floor.height*unit+16);}
      context.canvas.dataset.interiorFloor=floor.id;context.canvas.dataset.interiorActors=String(room.actors.filter(actor=>actor.floorId===floor.id).length);context.canvas.dataset.scene='interior';return;
     }else{delete context.canvas.dataset.interiorFloor;delete context.canvas.dataset.interiorActors;context.canvas.dataset.scene='world';}
     const size=24*frame.camera.z;c.strokeStyle='#c0cbb6';c.lineWidth=1;
     for(const tile of frame.tiles){const p=project(tile,frame);c.fillStyle=tile.ground==='water'?'#a2c4c5':'#9cb681';c.fillRect(p.x-size/2,p.y-size/2,size,size);c.strokeRect(p.x-size/2,p.y-size/2,size,size);}
     for(const object of frame.nodes){const p=project(object,frame);c.fillStyle=object.kind==='water'?'#577588':'#526f57';c.beginPath();c.arc(p.x,p.y,7*frame.camera.z,0,Math.PI*2);c.fill();}
     for(const object of frame.buildings){const p=project(object,frame);c.fillStyle='#aa9269';c.fillRect(p.x-size*.4,p.y-size*.4,size*.8,size*.8);}
     for(const prop of frame.props){const p=project(prop,frame);c.fillStyle=prop.category==='building'?'#aa9269':'#d0b768';c.fillRect(p.x-size*.3,p.y-size*.3,size*.6,size*.6);c.fillStyle='#294336';c.font='12px sans-serif';c.textAlign='center';c.fillText(prop.name,p.x,p.y-size*.4);}
     const preview=record(frame.presentation.terraformPreview);
     if(Array.isArray(preview?.tiles))for(const value of preview.tiles as unknown[]){const tile=record(value);if(!tile||typeof tile.x!=='number'||typeof tile.y!=='number')continue;const p=project({x:tile.x,y:tile.y},frame);c.strokeStyle='#f4e4a9';c.lineWidth=3;c.strokeRect(p.x-size/2,p.y-size/2,size,size);}
     for(const actor of frame.actors.filter(actor=>!actor.away)){const p=project(actor,frame);c.fillStyle=actor.selected?'#f4e4a9':'#577588';c.beginPath();c.arc(p.x,p.y,10,0,Math.PI*2);c.fill();c.fillStyle='#294336';c.font='14px sans-serif';c.textAlign='center';c.fillText(actor.name,p.x,p.y-16);}
     c.fillStyle='#294336';c.textAlign='left';c.font='18px sans-serif';c.fillText('Field map',20,32);
    }
   };
  });
 }
 function activate(){register();return LWRendererHost.player().selectRenderer('field-map');}
 root.LWRendererExample={register,activate};if(typeof module!=='undefined'&&module.exports)module.exports={register};
})(globalThis);
