/* V13 art direction: sculpted toy-like companions and readable small-world details.
 * All variation is a pure function of identity/location, not gameplay randomness.
 * Primitive geometry/materials are shared with World and the software renderer. */
(function(root){
 'use strict';
 let definitionRef=null,definitionRevision=0;
 function revision(){const c=root.LWAdventure?.content;if(c!==definitionRef){definitionRef=c;definitionRevision++;}return definitionRevision;}
 const swatches=[
  {fur:'#caa273',light:'#eed8b4',inner:'#c98f79',nose:'#79503e'},
  {fur:'#a4ba99',light:'#e3e7c5',inner:'#bfab99',nose:'#696b56'},
  {fur:'#e0cbb0',light:'#fbecd1',inner:'#dca08e',nose:'#a46d63'},
  {fur:'#b99ba8',light:'#ead5cd',inner:'#c08e9b',nose:'#725363'},
  {fur:'#9fb5b0',light:'#d7e5d9',inner:'#c8aaa6',nose:'#596f72'},
  {fur:'#c7b779',light:'#f0e3b6',inner:'#be9681',nose:'#847048'}
 ];
 function mood(c){if(c.task?.kind==='rest')return 'rest';if((c.feelings?.anger||0)>=45)return 'angry';if((c.needs?.energy??100)<30)return 'tired';if((c.needs?.food??100)<25||(c.needs?.water??100)<25)return 'concerned';if((c.needs?.joy??60)>72)return 'happy';return 'content';}
 function create(kit,parent,c){
  const {T,group,box,piece,mat}=kit;
  const soft=(p,x,y,z,sx,sy,sz,color)=>piece(p,Math.max(sx,sy,sz)<.15?'tiny':'soft',x,y,z,sx,sy,sz,color,0,{flatShading:false});
  const index=(Math.max(1,+String(c.id).replace(/\D/g,''))-1)%6,pal=swatches[index],shape=index%3;
  const g=group(parent);g.userData.fidelity='companion';g.userData.radius=1.4;
  const shadow=piece(g,'cylinder',0,.055,0,.27,.005,.21,'#455f52',0,{transparent:true,opacity:.16,depthWrite:false});shadow.castShadow=false;
  const body=group(g),torso=soft(body,0,.32,0,.225,.28,.20,pal.fur);
  const bib=soft(body,0,.32,.13,.163,.205,.10,pal.light);
  const head=group(body,0,.64,.045);head.name='head';
  soft(head,0,0,0,.278,.249,.234,pal.fur);
  soft(head,-.085,-.095,.183,.12,.092,.085,pal.light);soft(head,.085,-.095,.183,.12,.092,.085,pal.light);
  const ears=[];
  for(const side of[-1,1]){const ear=group(head,side*.19,.175,-.007);ear.name='ear';
   if(shape===0){soft(ear,0,.042,0,.089,.105,.068,pal.fur);soft(ear,0,.046,.053,.048,.061,.012,pal.inner);}
   else if(shape===1){soft(ear,0,.115,0,.068,.232,.061,pal.fur);soft(ear,0,.138,.050,.032,.14,.012,pal.inner);}
   else{piece(ear,'cone',0,.077,0,.090,.236,.075,pal.fur);piece(ear,'cone',0,.077,.046,.046,.15,.016,pal.inner);}
   ear.rotation.z=side*(shape===1?-.12:-.20);ears.push(ear);
  }
  const eyes=[],brows=[],glints=[];
  for(const side of[-1,1]){
   const eye=group(head,side*.097,.024,.206);eye.name='eye';
   soft(eye,0,0,0,.041,.052,.028,'#faf6de');soft(eye,0,-.003,.020,.029,.043,.015,'#303f37');
   const glint=soft(eye,-.009,.015,.033,.009,.012,.006,'#ffffff');glints.push(glint);eyes.push(eye);
   const brow=box(head,side*.097,.099,.210,.085,.014,.019,pal.nose);brow.rotation.z=side*-.04;brows.push(brow);
   soft(head,side*.174,-.080,.192,.043,.026,.020,pal.inner);
  }
  soft(head,0,-.066,.258,.036,.026,.025,pal.nose);
  const mouth=group(head,0,-.137,.254);
  for(const side of[-1,1]){const m=box(mouth,side*.024,0,0,.045,.010,.012,pal.nose);m.rotation.z=side*.22;}
  const feet=[soft(body,-.118,.083,.045,.104,.082,.146,pal.fur),soft(body,.118,.083,.045,.104,.082,.146,pal.fur)];
  const arms=[];
  for(const side of[-1,1]){const arm=group(body,side*.235,.405,.014);soft(arm,0,-.06,0,.067,.133,.067,pal.fur);soft(arm,0,-.151,.008,.07,.064,.07,pal.light);arms.push(arm);}
  const tail=group(body,0,.225,-.195);soft(tail,0,shape===2?.03:0,-.025,shape===2?.075:.101,shape===2?.21:.094,shape===2?.079:.097,pal.light);tail.rotation.x=-.4;
  // Use the actual externally-authored visual/color, not just the slot's presence.
  const defs=root.LWAdventure?.content?.equipment||root.LWDefaultAdventure?.equipment||[];
  const equip=(slot)=>defs.find(d=>d.id===c.equipment?.[slot]);
  const eqHead=equip('head'),eqBody=equip('body'),eqBack=equip('back'),eqFeet=equip('feet'),eqTool=equip('tool'),eqCharm=equip('charm');
  if(eqBody){const coat=piece(body,'cylinder',0,.328,0,.237,.245,.215,eqBody.color);bib.visible=false;
   if(eqBody.visual==='cape'){const cloak=soft(body,0,.37,-.15,.258,.218,.095,eqBody.color);cloak.rotation.x=-.20;}
   else for(const side of[-1,1])box(body,side*.07,.35,.207,.016,.20,.015,pal.light);
   const collar=piece(body,'ring',0,.455,0,.197,.17,.18,pal.light);collar.rotation.x=Math.PI/2;
   for(let j=0;j<2;j++)soft(body,0,.38-j*.075,.219,.015,.015,.009,'#dfbf70');
  }
  if(eqHead){const h=group(head,0,.172,-.01);h.name='headgear';
   piece(h,'cylinder',0,0,0,.31,.029,.264,eqHead.color);
   if(eqHead.visual==='wizard'){const cone=piece(h,'cone',0,.175,-.02,.19,.4,.18,eqHead.color);cone.rotation.z=-.13;soft(h,.12,.32,0,.021,.032,.015,'#efcc7f');}
   else{soft(h,0,.065,-.012,.224,.11,.184,eqHead.color);box(h,0,.033,.168,.28,.045,.12,eqHead.color);}
   box(h,0,.035,.226,.075,.055,.015,'#d9c086');
  }
  if(eqBack){const pack=group(body,0,.351,-.245);soft(pack,0,0,0,.177,.211,.103,eqBack.color);box(pack,0,-.019,-.105,.23,.032,.025,'#dfc08c');box(pack,0,-.016,-.123,.042,.059,.012,'#b2955f');for(const side of[-1,1]){box(body,side*.16,.39,.165,.038,.23,.038,eqBack.color);soft(pack,side*.16,-.02,0,.048,.10,.07,eqBack.color);}}
  if(eqFeet)feet.forEach((f,i)=>{f.material=mat(eqFeet.color,{flatShading:false});box(body,(i?1:-1)*.118,.13,.148,.068,.014,.03,'#dac6a1');});
  if(eqCharm){const chain=piece(body,'ring',0,.427,.209,.068,.087,.04,'#d6b783');soft(body,0,.335,.235,.043,.050,.027,eqCharm.color);}
  const tool=group(arms[1],.02,-.075,.09);tool.name='equipped-tool';tool.visible=!!eqTool;
  if(eqTool){const color=eqTool.color;
   if(eqTool.visual==='lantern'){box(tool,0,.03,0,.15,.20,.14,'#6c7962');piece(tool,'box',0,.036,.074,.10,.13,.012,color,0,{emissive:color,emissiveIntensity:.35});piece(tool,'ring',0,.18,0,.055,.07,.02,'#99805b');}
   else{piece(tool,'cylinder',0,-.08,0,.022,eqTool.visual==='staff'?.65:.44,.022,'#8f6944');if(eqTool.visual==='staff'){soft(tool,.01,.267,0,.045,.06,.046,color);}
    else if(eqTool.visual==='axe'){box(tool,.055,.16,0,.21,.16,.055,color);box(tool,.15,.14,0,.025,.18,.06,'#d0d9cb');}
    else box(tool,0,.16,0,.26,.13,.10,color);}
  }
  const carry=group(body,0,.245,.325);carry.name='carried-goods';
  const cargo={};
  cargo.crate=group(carry);kit.crate(cargo.crate,0,0,0,.27);
  cargo.wood=group(carry);for(let i=0;i<3;i++){const log=piece(cargo.wood,'cylinder',0,.08+(i===2?.115:0),(i-1)*.083,.054,.39,.054,'#986c45');log.rotation.z=Math.PI/2;const end=piece(cargo.wood,'cylinder',.201,.08+(i===2?.115:0),(i-1)*.083,.040,.006,.040,'#dfb681');end.rotation.z=Math.PI/2;}
  cargo.water=group(carry);piece(cargo.water,'cylinder',0,.13,0,.102,.245,.102,'#849e9c');piece(cargo.water,'ring',0,.288,0,.086,.078,.018,'#637674');
  cargo.food=group(carry);piece(cargo.food,'cylinder',0,.09,0,.13,.15,.12,'#b49365');for(let i=0;i<3;i++)soft(cargo.food,(i-1)*.073,.19,0,.047,.040,.04,'#c47f6c');
  const care=group(body,0,.51,.34);care.name='care-prop';const snack=soft(care,0,0,0,.055,.045,.052,'#bd7165'),cup=piece(care,'cylinder',0,0,0,.046,.12,.046,'#7e9b97');care.visible=false;
  const rig={care,snack,cup,root:g,body,torso,head,ears,tail,feet,arms,eyes,brows,mouth,carry,cargo,tool,palette:pal,shape,gait:0,initialized:false,key:JSON.stringify([c.equipment,root.LWFidelity.revision()]),lastInside:null,transition:null,expression:'content'};
  setPose(rig,c,{time:0,animate:false,walking:false,working:false,distance:0});return rig;
 }
 function setPose(v,c,p){
  const moodName=mood(c),rest=moodName==='rest',tired=moodName==='tired',angry=moodName==='angry';v.expression=moodName;
  const phase=p.time,move=p.animate&&p.walking,work=p.animate&&p.working,seed=(+String(c.id).replace(/\D/g,'')||1)*1.71;
  if(move)v.gait+=Math.min(p.distance||0,.45)*14;
  const bob=move?Math.abs(Math.sin(v.gait))*.032:0;
  v.body.position.y=bob;
  v.head.rotation.x=rest?.19:tired?.10:work?.09:0;
  v.head.rotation.y=p.animate&&!move&&!work?Math.sin(phase*.53+seed)*.055:0;
  v.head.rotation.z=p.animate&&!move&&!work?Math.sin(phase*.41+seed)*.028:0;
  // Breathing is tiny; reduced motion removes it without changing the current pose.
  v.torso.scale.y=.28+(p.animate&&!rest?Math.sin(phase*2+seed)*.004:0);
  v.ears.forEach((e,i)=>{const side=i?1:-1;e.rotation.z=side*(v.shape===1?-.12:-.20)+side*(angry?-.17:tired||rest?.21:0)+(p.animate?Math.sin(phase*1.7+seed+i)*.022:0);});
  const blink=p.animate&&Math.sin(phase*.83+seed)>.996;
  v.eyes.forEach(e=>{e.scale.y=rest||blink?.10:tired?.6:1;});
  v.brows.forEach((b,i)=>{b.rotation.z=(i?1:-1)*(angry?.30:moodName==='concerned'?-.23:tired?-.13:-.04);});
  v.mouth.children.forEach((m,i)=>m.rotation.z=(i?1:-1)*(moodName==='happy'?.40:angry||tired?-.25:.15));
  v.tail.rotation.y=p.animate?Math.sin(phase*(move?4:1.9)+seed)*.12:0;
  v.feet.forEach((f,i)=>{f.position.y=.083+(move?Math.max(0,Math.sin(v.gait+i*Math.PI))*.068:0);f.position.z=.045+(move?Math.sin(v.gait+i*Math.PI)*.075:0);});
  v.arms.forEach((a,i)=>{a.rotation.x=work?-.36+Math.sin(phase*5.6+i)*.43:move?Math.sin(v.gait+i*Math.PI)*.28:0;});
  const t=c.task,transfer=['deposit','withdraw','stockbuilding','collectbuilding','market-deliver','market-pickup'].includes(t?.kind);
  const carried=Object.entries(c.inventory||{}).filter(([,n])=>n>0);
  v.carry.visible=carried.length>0&&(p.walking||transfer)&&!rest;
  const res=t?.resource||t?.item||t?.res||'';
  const main=carried.find(([id])=>id===res)?.[0]||carried.filter(([id])=>['wood','water','berries','bread','meals','stone','planks'].includes(id)).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const kind=main==='wood'?'wood':main==='water'?'water':['berries','bread','meals'].includes(main)?'food':'crate';
  Object.entries(v.cargo).forEach(([k,o])=>{o.visible=k===kind;});
  if(v.carry.visible){v.arms.forEach(a=>a.rotation.x=-.85);v.tool.visible=false;}else v.tool.visible=!!c.equipment?.tool;
  const elapsed=(p.simTime??Infinity)-(c.careVisual?.time??-Infinity),care=elapsed>=0&&elapsed<2?c.careVisual.kind:'';
  v.care.visible=!!care&&['feed','water'].includes(care)&&!p.walking;v.snack.visible=care==='feed';v.cup.visible=care==='water';
  if(v.care.visible){v.arms.forEach(a=>a.rotation.x=-1.15);v.carry.visible=false;v.tool.visible=false;v.head.rotation.x=.12+(p.animate?Math.sin(elapsed*6)*.035:0);}
  if(['bond','praise','soothe'].includes(care)&&!p.walking&&p.animate){v.arms[0].rotation.x=-.8;v.arms[0].rotation.z=-.16+Math.sin(elapsed*6)*.12;}else v.arms[0].rotation.z=0;
 }
 function details(kit,g,b){const {piece,box,ball,group}=kit,k=b.kind;
  if(['garden','grainplot','orchard'].includes(k))return;
  if(['fire','waterwheel','well'].includes(k))return;
  const t=group(g,b.x,0,b.y),d=b.door||{dx:0,dy:1};t.rotation.y=d.dx===1?Math.PI/2:d.dx===-1?-Math.PI/2:d.dy===-1?Math.PI:0;
  if(root.LW.Village.indoor.has(k)){
   const h=k==='shelter'?.70:k==='observatory'?1.08:.90,w=k==='cottage'?1.20:1.06;
   // Timber frames, floor trim, shutters, and small flower boxes read at a glance.
   box(t,0,.14,.47,w,.055,.04,'#a1845d');box(t,0,h-.04,.48,w+.08,.06,.055,'#907553');
   for(const side of[-1,1]){const brace=box(t,side*.39,h-.20,.48,.04,.32,.045,'#aa8a60');brace.rotation.z=side*-.57;
    const x=side*(w/2+.095);box(t,x,h*.56,-.252,.025,.33,.085,'#65867a');box(t,x,h*.56,.173,.025,.33,.085,'#65867a');
    box(t,side*(w/2+.13),h*.29,-.045,.16,.095,.44,'#a08355');
    for(let j=0;j<3;j++){ball(t,side*(w/2+.14),h*.29+.10,-.19+j*.15,.075,.065,.065,'#6b9462');ball(t,side*(w/2+.17),h*.29+.15,-.19+j*.15,.035,.027,.035,j%2?'#dfaa93':'#f0e3b5');}
   }
   for(let n=0;n<4;n++)box(t,-.40+n*.24,.038,.87,.17,.021,.12,'#c5b58e');
   // Cloth sign marks purpose without generating labels that suggest a new building.
   box(t,-.36,.66,.55,.025,.11,.17,'#916f50');box(t,-.36,.55,.62,.16,.16,.02,['workshop','bench'].includes(k)?'#9eab92':k==='bakery'?'#d1a87c':'#c7b985');
  }
  if(k==='bench'||k==='workshop'){for(let n=0;n<3;n++){const log=piece(t,'cylinder',-.65,.085+n*.09,-.22,.052,.42,.052,'#966b45');log.rotation.x=Math.PI/2;}box(t,.58,.14,.08,.14,.05,.44,'#ba9465');}
  if(k==='kiln'||k==='smelter'){for(let n=0;n<3;n++)box(t,-.48,.06+n*.07,.13,.22,.061,.14,'#c79875');}
  if(k==='storehouse'||k==='market'){const barrel=group(t,.70,.22,.32);piece(barrel,'cylinder',0,0,0,.13,.38,.13,'#b4946b');for(const y of[-.11,.11]){const ring=piece(barrel,'ring',0,y,0,.138,.138,.13,'#787c66');ring.rotation.x=Math.PI/2;}}
 }
 function flower(kit,g,x,z,seed){const {piece,ball}=kit;piece(g,'cylinder',x,.115,z,.010,.22,.010,'#799665');for(let j=0;j<4;j++)ball(g,x+Math.cos(j*Math.PI/2)*.036,.224,z+Math.sin(j*Math.PI/2)*.036,.036,.019,.036,seed>.6?'#dec5a7':'#efe8c9');ball(g,x,.239,z,.02,.014,.020,'#d9b65e');}
 root.LWFidelity={create,setPose,mood,details,flower,revision};
})(typeof globalThis!=='undefined'?globalThis:this);
