/* Actor animation and expression layer. Geometry, materials, sockets and equipment meshes are asset data. */
(function(root){
 'use strict';
 let definitionRef=null,definitionRevision=0;
 function revision(){const c=root.LWAdventure?.content;if(c!==definitionRef){definitionRef=c;definitionRevision++;}return definitionRevision+(root.LWAssets?.revision||0);}
 const swatches=[
  {fur:'#caa273',light:'#eed8b4',inner:'#c98f79',nose:'#79503e'},
  {fur:'#a4ba99',light:'#e3e7c5',inner:'#bfab99',nose:'#696b56'},
  {fur:'#e0cbb0',light:'#fbecd1',inner:'#dca08e',nose:'#a46d63'},
  {fur:'#b99ba8',light:'#ead5cd',inner:'#c08e9b',nose:'#725363'},
  {fur:'#9fb5b0',light:'#d7e5d9',inner:'#c8aaa6',nose:'#596f72'},
  {fur:'#c7b779',light:'#f0e3b6',inner:'#be9681',nose:'#847048'}
 ];
 function mood(c){if(c.task?.kind==='rest')return 'rest';if((c.feelings?.anger||0)>=45)return 'angry';if((c.needs?.energy??100)<30)return 'tired';if((c.needs?.food??100)<25||(c.needs?.water??100)<25)return 'concerned';if((c.needs?.joy??60)>72)return 'happy';return 'content';}
 function handles(instance,ref){const value=instance.asset.rig?.[ref];if(Array.isArray(value))return value.map(id=>instance.handles.get(id));return instance.handles.get(value);}
 function equipmentDefs(){return root.LWAdventure?.content?.equipment||root.LWDefaultAdventure?.equipment||[];}
 function create(kit,parent,c){
  const index=(Math.max(1,+String(c.id).replace(/\D/g,''))-1)%6,pal=swatches[index],shape=index%3;
  const instance=root.LWAssetRenderer.createActor(kit,parent,'sproutling','world',{materials:pal}),g=instance.root;
  g.userData.fidelity='companion';g.userData.radius=instance.asset.metadata?.radius||1.4;
  const body=handles(instance,'body'),torso=handles(instance,'torso'),bib=handles(instance,'bib'),head=handles(instance,'head'),ears=handles(instance,'ears'),tail=handles(instance,'tail'),feet=handles(instance,'feet'),arms=handles(instance,'arms'),eyes=handles(instance,'eyes'),brows=handles(instance,'brows'),mouth=handles(instance,'mouth'),carry=handles(instance,'carry'),care=handles(instance,'care'),snack=handles(instance,'snack'),cup=handles(instance,'cup');
  if(shape===1)ears.forEach(e=>e.scale.y*=1.20);if(shape===2)ears.forEach(e=>{e.scale.x*=.88;e.rotation.z*=1.3;});
  const defs=equipmentDefs(),equip=slot=>defs.find(d=>d.id===c.equipment?.[slot]),attachments=[];
  function attach(slot,parentHandle){
   const def=equip(slot);if(!def||!root.LWAssets.item(def.id)?.models?.equipped)return null;
   const parents=Array.isArray(parentHandle)?parentHandle:[parentHandle],made=parents.filter(Boolean).map(p=>root.LWAssetRenderer.createItem(kit,p,def.id,'equipped',{materials:{primary:def.color}}).root);attachments.push(...made);return made[0]||null;
  }
  const sockets=instance.asset.behaviors?.sockets||{},byId=id=>instance.handles.get(id);
  attach('head',byId(sockets.head));const bodyGear=attach('body',byId(sockets.body));attach('back',byId(sockets.back));attach('charm',byId(sockets.charm));attach('feet',(sockets.feet||[]).map(byId));const tool=attach('tool',byId(sockets.tool))||kit.group(byId(sockets.tool));
  if(bodyGear)bib.visible=false;
  care.visible=false;snack.visible=false;cup.visible=false;
  const rig={kit,instance,care,snack,cup,root:g,body,torso,head,ears,tail,feet,arms,eyes,brows,mouth,carry,tool,palette:pal,shape,gait:0,initialized:false,key:JSON.stringify([c.equipment,revision()]),lastInside:null,transition:null,expression:'content',cargoInstance:null,cargoId:null};
  setPose(rig,c,{time:0,animate:false,walking:false,working:false,distance:0});return rig;
 }
 function ensureCargo(v,id){
  if(v.cargoId===id)return;
  if(v.cargoInstance){v.carry.remove(v.cargoInstance.root);v.cargoInstance=null;}
  const wanted=root.LWAssets.item(id)?.models?.carry?id:(root.LWAssets.item('wood')?.models?.carry?'wood':null);
  if(wanted)v.cargoInstance=root.LWAssetRenderer.createItem(v.kit,v.carry,wanted,'carry');
  v.cargoId=id;
 }
 function setPose(v,c,p){
  const moodName=mood(c),rest=moodName==='rest',tired=moodName==='tired',angry=moodName==='angry';v.expression=moodName;
  const phase=p.time,move=p.animate&&p.walking,work=p.animate&&p.working,seed=(+String(c.id).replace(/\D/g,'')||1)*1.71;
  if(move)v.gait+=Math.min(p.distance||0,.45)*14;
  const bob=move?Math.abs(Math.sin(v.gait))*.032:0;v.body.position.y=bob;
  v.head.rotation.x=rest?.19:tired?.10:work?.09:0;v.head.rotation.y=p.animate&&!move&&!work?Math.sin(phase*.53+seed)*.055:0;v.head.rotation.z=p.animate&&!move&&!work?Math.sin(phase*.41+seed)*.028:0;
  v.torso.scale.y=.28+(p.animate&&!rest?Math.sin(phase*2+seed)*.004:0);
  v.ears.forEach((e,i)=>{const side=i?1:-1;e.rotation.z=side*(v.shape===1?-.12:-.20)+side*(angry?-.17:tired||rest?.21:0)+(p.animate?Math.sin(phase*1.7+seed+i)*.022:0);});
  const blink=p.animate&&Math.sin(phase*.83+seed)>.996;v.eyes.forEach(e=>{e.scale.y=rest||blink?.10:tired?.6:1;});
  v.brows.forEach((b,i)=>{b.rotation.z=(i?1:-1)*(angry?.30:moodName==='concerned'?-.23:tired?-.13:-.04);});
  v.mouth.children.forEach((m,i)=>m.rotation.z=(i?1:-1)*(moodName==='happy'?.40:angry||tired?-.25:.15));
  v.tail.rotation.y=p.animate?Math.sin(phase*(move?4:1.9)+seed)*.12:0;
  v.feet.forEach((f,i)=>{f.position.y=.083+(move?Math.max(0,Math.sin(v.gait+i*Math.PI))*.068:0);f.position.z=.045+(move?Math.sin(v.gait+i*Math.PI)*.075:0);});
  v.arms.forEach((a,i)=>{a.rotation.x=work?-.36+Math.sin(phase*5.6+i)*.43:move?Math.sin(v.gait+i*Math.PI)*.28:0;});
  const t=c.task,transfer=['deposit','withdraw','stockbuilding','collectbuilding','market-deliver','market-pickup'].includes(t?.kind),carried=Object.entries(c.inventory||{}).filter(([,n])=>n>0),res=t?.resource||t?.item||t?.res||'';
  const main=carried.find(([id])=>id===res)?.[0]||carried.filter(([id])=>root.LWAssets.item(id)?.models?.carry).sort((a,b)=>b[1]-a[1])[0]?.[0]||'wood';
  ensureCargo(v,main);v.carry.visible=carried.length>0&&(p.walking||transfer)&&!rest;
  if(v.carry.visible){v.arms.forEach(a=>a.rotation.x=-.85);v.tool.visible=false;}else v.tool.visible=!!c.equipment?.tool;
  const elapsed=(p.simTime??Infinity)-(c.careVisual?.time??-Infinity),care=elapsed>=0&&elapsed<2?c.careVisual.kind:'';
  v.care.visible=!!care&&['feed','water'].includes(care)&&!p.walking;v.snack.visible=care==='feed';v.cup.visible=care==='water';
  if(v.care.visible){v.arms.forEach(a=>a.rotation.x=-1.15);v.carry.visible=false;v.tool.visible=false;v.head.rotation.x=.12+(p.animate?Math.sin(elapsed*6)*.035:0);}
  if(['bond','praise','soothe'].includes(care)&&!p.walking&&p.animate){v.arms[0].rotation.x=-.8;v.arms[0].rotation.z=-.16+Math.sin(elapsed*6)*.12;}else v.arms[0].rotation.z=0;
 }
 root.LWFidelity={create,setPose,mood,revision};
})(typeof globalThis!=='undefined'?globalThis:this);
