/* Actor animation and expression layer. Geometry, appearance, sockets and motion tuning are asset data. */
(function(root){
 'use strict';
 let definitionRef=null,definitionRevision=0;
 function revision(){const c=root.LWAdventure?.content;if(c!==definitionRef){definitionRef=c;definitionRevision++;}return definitionRevision+(root.LWAssets?.revision||0)+(root.LWCreatures?.revision||0);}
 function mood(c){if(c.task?.kind==='rest')return 'rest';if((c.feelings?.anger||0)>=45)return 'angry';if((c.needs?.energy??100)<30)return 'tired';if((c.needs?.food??100)<25||(c.needs?.water??100)<25)return 'concerned';if((c.needs?.joy??60)>72)return 'happy';return 'content';}
 function handles(instance,ref){const value=instance.asset.rig?.[ref];if(Array.isArray(value))return value.map(id=>instance.handles.get(id));return instance.handles.get(value);}
 function equipmentDefs(){return root.LWAdventure?.content?.equipment||root.LWDefaultAdventure?.equipment||[];}
 function create(kit,parent,c){
  const definition=root.LWCreatures?.forPersonality(c.personality);if(!definition)throw Error('No creature definition for personality '+c.personality);
  const asset=root.LWAssets.actor(definition.id),appearance=asset?.behaviors?.appearances?.[c.personality],animation=asset?.behaviors?.animation;
  if(!asset||!appearance||!animation)throw Error('No actor appearance for '+definition.id+'/'+c.personality);
  const instance=root.LWAssetRenderer.createActor(kit,parent,definition.id,appearance.model,{materials:appearance.materials,scale:appearance.scale}),g=instance.root;
  g.userData.fidelity='creature:'+definition.id;g.userData.radius=instance.asset.metadata?.radius||1.4;
  const body=handles(instance,'body'),torso=handles(instance,'torso'),bib=handles(instance,'bib'),head=handles(instance,'head'),ears=handles(instance,'ears'),tail=handles(instance,'tail'),feet=handles(instance,'feet'),arms=handles(instance,'arms'),eyes=handles(instance,'eyes'),brows=handles(instance,'brows'),mouth=handles(instance,'mouth'),carry=handles(instance,'carry'),care=handles(instance,'care'),snack=handles(instance,'snack'),cup=handles(instance,'cup');
  const defs=equipmentDefs(),equip=slot=>defs.find(d=>d.id===c.equipment?.[slot]),attachments=[];
  function attach(slot,parentHandle){const def=equip(slot);if(!def||!root.LWAssets.item(def.id)?.models?.equipped)return null;const parents=Array.isArray(parentHandle)?parentHandle:[parentHandle],made=parents.filter(Boolean).map(p=>root.LWAssetRenderer.createItem(kit,p,def.id,'equipped',{materials:{primary:def.color}}).root);attachments.push(...made);return made[0]||null;}
  const sockets=instance.asset.behaviors?.sockets||{},byId=id=>instance.handles.get(id);
  attach('head',byId(sockets.head));const bodyGear=attach('body',byId(sockets.body));attach('back',byId(sockets.back));attach('charm',byId(sockets.charm));attach('feet',(sockets.feet||[]).map(byId));const tool=attach('tool',byId(sockets.tool))||kit.group(byId(sockets.tool));
  if(bodyGear)bib.visible=false;care.visible=false;snack.visible=false;cup.visible=false;
  const rig={kit,instance,care,snack,cup,root:g,body,torso,head,ears,earBases:ears.map(e=>e.rotation.z),tail,feet,arms,eyes,brows,mouth,carry,tool,animation,labelHeight:appearance.labelHeight,contextHeight:appearance.contextHeight,bubbleHeight:appearance.bubbleHeight,gait:0,initialized:false,key:JSON.stringify([c.personality,c.equipment,revision()]),lastInside:null,transition:null,expression:'content',cargoInstance:null,cargoId:null};
  setPose(rig,c,{time:0,animate:false,walking:false,working:false,distance:0});return rig;
 }
 function ensureCargo(v,id){if(v.cargoId===id)return;if(v.cargoInstance){v.carry.remove(v.cargoInstance.root);v.cargoInstance=null;}const wanted=root.LWAssets.item(id)?.models?.carry?id:(root.LWAssets.item('wood')?.models?.carry?'wood':null);if(wanted)v.cargoInstance=root.LWAssetRenderer.createItem(v.kit,v.carry,wanted,'carry');v.cargoId=id;}
 function setPose(v,c,p){
  const moodName=mood(c),rest=moodName==='rest',tired=moodName==='tired',angry=moodName==='angry',a=v.animation;v.expression=moodName;
  const phase=p.time,move=p.animate&&p.walking,work=p.animate&&p.working,seed=(+String(c.id).replace(/\D/g,'')||1)*1.71;if(move)v.gait+=Math.min(p.distance||0,.45)*14;
  v.body.position.y=move?Math.abs(Math.sin(v.gait))*a.bodyBob:0;
  v.head.rotation.x=rest?.19:tired?.10:work?.09:0;v.head.rotation.y=p.animate&&!move&&!work?Math.sin(phase*.53+seed)*a.idleHeadYaw:0;v.head.rotation.z=p.animate&&!move&&!work?Math.sin(phase*.41+seed)*a.idleHeadRoll:0;
  v.torso.scale.y=.28+(p.animate&&!rest?Math.sin(phase*2+seed)*a.breath:0);
  v.ears.forEach((ear,i)=>{const side=i?1:-1,base=v.earBases[i]||0;ear.rotation.z=base+side*(angry?-.17:tired||rest?.21:0)+(p.animate?Math.sin(phase*1.7+seed+i)*a.earSway:0);});
  const blink=p.animate&&Math.sin(phase*.83+seed)>a.blinkThreshold;v.eyes.forEach(eye=>{eye.scale.y=rest||blink?.10:tired?.6:1;});
  v.brows.forEach((b,i)=>{b.rotation.z=(i?1:-1)*(angry?.30:moodName==='concerned'?-.23:tired?-.13:-.04);});
  v.mouth.children.forEach((m,i)=>m.rotation.z=(i?1:-1)*(moodName==='happy'?.40:angry||tired?-.25:.15));
  v.tail.rotation.y=p.animate?Math.sin(phase*(move?4:1.9)+seed)*a.tailSway:0;
  v.feet.forEach((f,i)=>{f.position.y=.083+(move?Math.max(0,Math.sin(v.gait+i*Math.PI))*a.footLift:0);f.position.z=.045+(move?Math.sin(v.gait+i*Math.PI)*a.footStride:0);});
  v.arms.forEach((arm,i)=>{arm.rotation.x=work?a.workArmBase+Math.sin(phase*5.6+i)*a.workArmSwing:move?Math.sin(v.gait+i*Math.PI)*a.walkArmSwing:0;});
  const t=c.task,transfer=['deposit','withdraw','stockbuilding','collectbuilding','market-deliver','market-pickup'].includes(t?.kind),carried=Object.entries(c.inventory||{}).filter(([,n])=>n>0),res=t?.resource||t?.item||t?.res||'',main=carried.find(([id])=>id===res)?.[0]||carried.filter(([id])=>root.LWAssets.item(id)?.models?.carry).sort((x,y)=>y[1]-x[1])[0]?.[0]||'wood';
  ensureCargo(v,main);v.carry.visible=carried.length>0&&(p.walking||transfer)&&!rest;if(v.carry.visible){v.arms.forEach(arm=>arm.rotation.x=-.85);v.tool.visible=false;}else v.tool.visible=!!c.equipment?.tool;
  const elapsed=(p.simTime??Infinity)-(c.careVisual?.time??-Infinity),care=elapsed>=0&&elapsed<2?c.careVisual.kind:'';v.care.visible=!!care&&['feed','water'].includes(care)&&!p.walking;v.snack.visible=care==='feed';v.cup.visible=care==='water';
  if(v.care.visible){v.arms.forEach(arm=>arm.rotation.x=-1.15);v.carry.visible=false;v.tool.visible=false;v.head.rotation.x=.12+(p.animate?Math.sin(elapsed*6)*.035:0);}
  if(['bond','praise','soothe'].includes(care)&&!p.walking&&p.animate){v.arms[0].rotation.x=-.8;v.arms[0].rotation.z=-.16+Math.sin(elapsed*6)*.12;}else v.arms[0].rotation.z=0;
 }
 root.LWFidelity={create,setPose,mood,revision};
})(typeof globalThis!=='undefined'?globalThis:this);
