/* Generic primitive-scene renderer for declarative Littlewild assets. */
(function(root){'use strict';
 const A=root.LWAssets;
 function material(asset,key,overrides){
  const chosen=overrides?.[key]??asset.materials[key]??key;
  if(typeof chosen==='string')return{color:chosen,extra:{}};
  return{color:chosen.color,extra:Object.fromEntries(Object.entries(chosen).filter(([k])=>k!=='color'))};
 }
 function makeNode(kit,parent,asset,node,options,handles){
  let o;
  if(node.primitive==='group')o=kit.group(parent);
  else{const m=material(asset,node.material,options.materials);const p=node.position||[0,0,0],s=node.scale||[1,1,1];o=kit.piece(parent,node.primitive,p[0],p[1],p[2],s[0],s[1],s[2],m.color,0,{...m.extra,...(node.materialProps||{})});}
  if(node.primitive==='group'){const p=node.position||[0,0,0],s=node.scale||[1,1,1];o.position.set(p[0],p[1],p[2]);o.scale.set(s[0],s[1],s[2]);}
  const r=node.rotation||[0,0,0];o.rotation.set(r[0],r[1],r[2]);
  if(node.visible===false)o.visible=false;
  if(node.castShadow===false)o.castShadow=false;
  if(node.receiveShadow===false)o.receiveShadow=false;
  if(node.id)handles.set(node.id,o);
  for(const child of node.children||[])makeNode(kit,o,asset,child,options,handles);
  return o;
 }
 function create(kit,parent,category,id,modelName='world',options={}){
  const asset=A.get(category,id);if(!asset)throw Error('Missing 3D asset '+category+':'+id);
  return createFromDefinition(kit,parent,asset,modelName,options);
 }
 function createFromDefinition(kit,parent,input,modelName='world',options={}){
  const asset=A.validate(input),category=asset.category,id=asset.id;
  const model=asset.models[modelName];if(!model)throw Error('Missing 3D model '+category+':'+id+'/'+modelName);
  const rootGroup=kit.group(parent),handles=new Map(),p=options.position||[0,0,0],r=options.rotation||[0,0,0],s=options.scale||[1,1,1];
  rootGroup.position.set(p[0],p[1],p[2]);rootGroup.rotation.set(r[0],r[1],r[2]);rootGroup.scale.set(s[0],s[1],s[2]);rootGroup.userData.asset=category+':'+id;rootGroup.userData.radius=asset.metadata?.radius||1;
  for(const n of model.nodes)makeNode(kit,rootGroup,asset,n,options,handles);
  return{asset,model:modelName,root:rootGroup,handles};
 }
 function doorAngle(b){const d=b.door||{dx:0,dy:1};return d.dx===1?Math.PI/2:d.dx===-1?-Math.PI/2:d.dy===-1?Math.PI:0;}
 function createBuilding(kit,parent,b,doors,rotors){
  const a=A.building(b.kind);if(!a)throw Error('Missing building asset '+b.kind);
  const rotation=a.metadata?.orientation==='door'?[0,doorAngle(b),0]:[0,0,0];
  const instance=create(kit,parent,'building',b.kind,'world',{position:[b.x,0,b.y],rotation});
  const behavior=a.behaviors||{};
  if(behavior.door){const hinge=instance.handles.get(behavior.door.node);if(!hinge)throw Error('Missing door handle '+b.kind);doors.set(b.id,{group:hinge,root:instance.root,b,openDelta:behavior.door.openDelta});}
  for(const rotor of behavior.rotors||[]){const g=instance.handles.get(rotor.node);if(!g)throw Error('Missing rotor handle '+b.kind);rotors.push({group:g,axis:rotor.axis,speed:rotor.speed});}
  return{...instance,smoke:behavior.smoke||null};
 }
 function createItem(kit,parent,id,model='carry',options={}){return create(kit,parent,'item',id,model,options);}
 function createActor(kit,parent,id,model='world',options={}){if(!id)throw Error('Actor asset ID is required');return create(kit,parent,'actor',id,model,options);}
 root.LWAssetRenderer=Object.freeze({create,createFromDefinition,createBuilding,createItem,createActor});
 if(typeof module!=='undefined'&&module.exports)module.exports=root.LWAssetRenderer;
})(typeof globalThis!=='undefined'?globalThis:this);
