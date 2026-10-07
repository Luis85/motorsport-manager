/// <reference path="./external-editor-canvas-contracts.d.ts" />
/* Worlds, nested scenes and directed connections in actual JSON Canvas data. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWCanvasEditorData:LWCanvasEditors.DataApi;LWCanvasAuthoring:LWCanvasAuthoring.Api;LWCanvasStoryEditor:LWCanvasEditors.StoryApi;LWExternalCanvas?:LWExternalEditors.Codec;LWExternalAdvancedCanvas?:LWExternalEditors.Codec};
 const node=typeof module!=='undefined'&&module.exports;
 const C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 const D=(node?require('./external-editor-canvas-data.js'):root.LWCanvasEditorData) as LWCanvasEditors.DataApi;
 const A=(node?require('./canvas-authoring.js'):root.LWCanvasAuthoring) as LWCanvasAuthoring.Api;
 const S=(node?require('./external-editor-canvas-story.js'):root.LWCanvasStoryEditor) as LWCanvasEditors.StoryApi;
 type Data=LWCanvasEditors.Data;
 type Config=LWCanvasEditors.Config;
 const copy=<T>(value:T):T=>structuredClone(value);
 const key=D.key;
 function payload(value:Data,prefix:string):Data|undefined{
  if(value.type!=='text'||typeof value.text!=='string'||!value.text.startsWith(prefix+'\n'))return undefined;
  return C.parse(value.text.slice(prefix.length+1));
 }
 function jsonNode(id:string,title:string,data:unknown,x:number,y:number,width=460,height=220):Data{return {id,type:'text',x,y,width,height,text:title+'\n'+JSON.stringify(data,null,2)};}
 function layout(pack:LWContentPorts.ScenarioPack):Data[]{
  const result:Data[]=[];
  const sizes=new Map<string,{width:number;height:number}>();
  function measure(scene:LWContentPorts.Scene):{width:number;height:number}{
   const children=pack.scenes.filter(s=>s.graph?.parentId===scene.id).map(measure);
   const header=300+(scene.graph?.connections?.filter(c=>c.requirements||c.events).length??0)*160;
   const size={width:Math.max(540,...children.map(c=>c.width+80)),height:header+children.reduce((n,c)=>n+c.height+40,0)};sizes.set(scene.id,size);return size;
  }
  function branch(scene:LWContentPorts.Scene,x:number,y:number):{width:number;height:number}{
   const size=sizes.get(scene.id)??measure(scene);
   result.push({id:key('scene',scene.id),type:'group',label:scene.name,x,y,...size});
   const graph=scene.graph?copy(scene.graph):undefined;if(graph){delete graph.parentId;delete graph.connections;}
   const properties:Data={description:scene.description};if(graph)properties.graph=graph;if(scene.initialState.settings!==undefined)properties.settings=copy(scene.initialState.settings);
   result.push(jsonNode(key('scene-config',scene.id),'Littlewild scene',{groupId:key('scene',scene.id),id:scene.id,properties},x+40,y+50));
   let childY=y+300+(scene.graph?.connections?.filter(c=>c.requirements||c.events).length??0)*160;
   for(const child of pack.scenes.filter(s=>s.graph?.parentId===scene.id)){const childSize=branch(child,x+40,childY);childY+=childSize.height+40;}
   return size;
  }
  let worldX=0;
  for(const world of pack.worlds){
   const roots=pack.scenes.filter(s=>s.worldId===world.id&&!s.graph?.parentId);let worldY=300,maxWidth=540;
   for(const scene of roots){const size=branch(scene,worldX+40,worldY);worldY+=size.height+40;maxWidth=Math.max(maxWidth,size.width+80);}
   result.push({id:key('world',world.id),type:'group',label:world.name,x:worldX,y:0,width:maxWidth+80,height:Math.max(640,worldY+40)});
   const properties=copy(world) as unknown as Data;delete properties.id;delete properties.name;
   result.push(jsonNode(key('world-config',world.id),'Littlewild world',{groupId:key('world',world.id),id:world.id,properties},worldX+40,50));
   worldX+=maxWidth+240;
  }
  return result.sort((a,b)=>a.type==='group'&&b.type!=='group'?-1:a.type!=='group'&&b.type==='group'?1:Number(b.width)*Number(b.height)-Number(a.width)*Number(a.height));
 }
 function write(exchange:LWExternalEditors.Exchange,advanced:boolean):Data{
  if(!exchange.metadata)throw Error('Canvas export requires canonical exchange metadata.');
  const {pack,sceneId}=exchange.metadata;A.validate(pack);
  const nodes=[...layout(pack),...S.write(pack)],edges:Data[]=[],saved=pack.canvasAuthoring;
  const metadataText=JSON.stringify(exchange.metadata),parts=Math.ceil(metadataText.length/8000);
  if(parts>200)throw Error('Canvas metadata exceeds 200 standard text chunks.');
  nodes.push(jsonNode('exchange','Littlewild exchange',{version:1,parts},-640,0,560,260));
  for(let i=0;i<parts;i++)nodes.push({id:'exchange-part:'+i,type:'text',x:-640,y:300+i*160,width:560,height:120,text:'Littlewild exchange part '+i+'\n'+metadataText.slice(i*8000,(i+1)*8000)});
  for(const scene of pack.scenes){let configIndex=0;for(const connection of scene.graph?.connections??[]){
   const id=key('connection',scene.id+':'+connection.id);
   edges.push({id,fromNode:key('scene',scene.id),toNode:key('scene',connection.targetSceneId),fromSide:'right',toSide:'left',toEnd:'arrow',label:connection.label,...copy(saved?.edges[id]??{})});
   if(connection.requirements||connection.events){const group=nodes.find(n=>n.id===key('scene',scene.id))!;
    nodes.push(jsonNode(key('connection-config',scene.id+':'+connection.id),'Littlewild connection',{edgeId:id,...(connection.requirements?{requirements:connection.requirements}:{}),...(connection.events?{events:connection.events}:{})},Number(group.x)+40,Number(group.y)+300+configIndex++*160,460,120));
   }
  }
  }
  const generated=new Map(nodes.map(n=>[String(n.id),D.geometry(n)]));
  for(const value of nodes)Object.assign(value,copy(saved?.nodes[String(value.id)]??{}));
  let topologyMatches=true;
  try{const groups=nodes.filter(n=>n.type==='group');
   for(const world of pack.worlds)if(D.parent(nodes.find(n=>n.id===key('world',world.id))!,groups))topologyMatches=false;
   for(const scene of pack.scenes){const p=D.parent(nodes.find(n=>n.id===key('scene',scene.id))!,groups);if(p?.id!==key(scene.graph?.parentId?'scene':'world',scene.graph?.parentId??scene.worldId))topologyMatches=false;}
  }catch{topologyMatches=false;}
  if(!topologyMatches){for(const value of nodes)Object.assign(value,generated.get(String(value.id))!);
   nodes.push(jsonNode('layout-notice','Canvas authoring notice',{message:'Native hierarchy changed; graph layout regenerated while retaining node styles.'},-1280,0));
  }
  const exchanged:Data={nodes,edges};
  if(advanced)exchanged.metadata=copy(saved?.metadata??{version:'1.0-1.0',frontmatter:{}});
  // Scene selection stays in a standard text node, independent of plugin extras.
  if(!pack.scenes.some(s=>s.id===sceneId))throw Error('Canvas export scene is missing.');
  return exchanged;
 }
 function configs(nodes:Data[],pack:LWContentPorts.ScenarioPack,options:LWExternalEditors.Options|undefined,metadata:boolean,warnings:string[]):Config[]{
  const result:Config[]=[],used=new Set<string>();
  for(const value of nodes)for(const kind of ['world','scene'] as const){
   const p=payload(value,'Littlewild '+kind);if(!p)continue;
   const nodeId=D.text(p.groupId,'Canonical Canvas group ID'),id=D.text(p.id,'Canonical '+kind+' ID',64);
   if(used.has(nodeId))throw Error('Duplicate Canvas group configuration.');used.add(nodeId);
   const group=nodes.find(n=>n.id===nodeId);if(!group||group.type!=='group')throw Error('Canvas configuration references a missing group.');
   if(Object.keys(p).some(k=>!['groupId','id','templateId','properties'].includes(k)))throw Error('Unknown canonical Canvas config field.');
   const properties=copy(C.record(p.properties));if(p.templateId!==undefined)properties.templateId=D.text(p.templateId,'Canvas template ID',64);
   result.push({kind,id,nodeId,properties});
  }
  const mappingIds=new Set<string>();
  for(const mapping of options?.canvasMappings??[]){
   if(!mapping||!['world','scene'].includes(mapping.kind)||mappingIds.has(mapping.nodeId)||!!mapping.entityId===!!mapping.templateId)throw Error('Canvas mappings require unique node IDs and exactly one canonical entityId or templateId.');
   mappingIds.add(mapping.nodeId);
   if(used.has(mapping.nodeId))throw Error('Canvas mapping duplicates a configured group.');
   const external=nodes.find(n=>n.id===mapping.nodeId);if(!external)throw Error('Canvas mapping references a missing node.');
   const id=D.text(mapping.entityId??mapping.id??mapping.nodeId,'Mapped canonical ID',64),properties:Data={};
   if(mapping.templateId)properties.templateId=D.text(mapping.templateId,'Canvas template ID',64);
   result.push({kind:mapping.kind,id,nodeId:mapping.nodeId,properties});used.add(mapping.nodeId);
  }
  if(!metadata&&!options?.canvasMappings?.length)throw Error('Generic Canvas imports require explicit world/scene entity or template mappings.');
  for(const value of nodes){if(value.type==='group'&&!used.has(String(value.id)))throw Error('Unmapped Canvas group; provide an explicit canonical world or scene mapping.');
   if(value.type==='text'&&!used.has(String(value.id))&&!['Littlewild exchange','Littlewild world','Littlewild scene','Littlewild connection'].some(p=>typeof value.text==='string'&&(value.text.startsWith(p+'\n')||p==='Littlewild exchange'&&value.text.startsWith('Littlewild exchange part ')||value.text.startsWith('Littlewild storytelling'))))warnings.push('Canvas annotation '+String(value.id)+' omitted; map it explicitly to create a scene.');
  }
  for(const kind of ['world','scene'] as const){const ids=result.filter(c=>c.kind===kind).map(c=>c.id);if(new Set(ids).size!==ids.length)throw Error('Duplicate canonical Canvas '+kind+' identity.');}
  if(!result.some(c=>c.kind==='scene'))throw Error('Canvas requires at least one mapped scene.');
  return result;
 }
 function applyConfig(pack:LWContentPorts.ScenarioPack,config:Config,value:Data):void{
  const {kind,id,properties}=config,templateId=properties.templateId;
  const existing=kind==='world'?pack.worlds.find(w=>w.id===id):pack.scenes.find(s=>s.id===id);
  const template=kind==='world'?pack.worlds.find(w=>w.id===templateId):pack.scenes.find(s=>s.id===templateId);
  if(templateId!==undefined&&!template)throw Error('Canvas config references an unknown template.');
  if(!existing&&!template)throw Error('New Canvas '+kind+' requires an explicit canonical templateId.');
  const target=copy(existing??template!) as unknown as Data;
  if(kind==='scene'&&target.graph){const graph=C.record(target.graph);delete graph.parentId;delete graph.connections;}
  target.id=id;target.name=D.text(value.type==='group'?value.label:value.text,'Canvas '+kind+' name',80);
  const allowed=kind==='world'?['description','terrain','biomeNames','resourceCounts','fixedSites','groundColors','materialColors','placementPolicy','nodePolicy','environment','templateId']:['description','graph','settings','templateId'];
  if(Object.keys(properties).some(k=>!allowed.includes(k)))throw Error('Unknown canonical Canvas '+kind+' property.');
  for(const [field,entry] of Object.entries(properties))if(field!=='templateId'&&field!=='settings')target[field]=copy(entry);
  if(kind==='scene'){
   const graph=C.record(target.graph);if(Object.keys(graph).some(k=>['parentId','connections'].includes(k)))throw Error('Canvas scene parent and connections must be edited through visual groups and edges.');
   if(graph.binding)target.initialState={};
   if(properties.settings!==undefined){const state=C.record(target.initialState);if(!Object.keys(state).length)throw Error('Bound Canvas scenes cannot edit owner settings.');state.settings=copy(properties.settings);}
   const scene=target as unknown as LWContentPorts.Scene;if(existing)pack.scenes[pack.scenes.indexOf(existing as LWContentPorts.Scene)]=scene;else pack.scenes.push(scene);
  }else{const world=target as unknown as LWContentPorts.WorldProfile;if(existing)pack.worlds[pack.worlds.indexOf(existing as LWContentPorts.WorldProfile)]=world;else pack.worlds.push(world);}
 }
 function read(exchanged:Data,options:LWExternalEditors.Options|undefined,advanced:boolean):LWExternalEditors.Exchange{
  const {nodes,edges,warnings}=D.inspect(exchanged,advanced),envelopes=nodes.map(n=>payload(n,'Littlewild exchange')).filter((p):p is Data=>p!==undefined);
  if(envelopes.length>1)throw Error('Duplicate Littlewild Canvas metadata text node.');
  let metadata:LWExternalEditors.Metadata|undefined;
  if(envelopes.length){const descriptor=envelopes[0]!,count=descriptor.parts;
   if(descriptor.version!==1||typeof count!=='number'||!Number.isInteger(count)||count<1||count>200||Object.keys(descriptor).some(k=>!['version','parts'].includes(k)))throw Error('Invalid Canvas metadata chunk descriptor.');
   const parts=new Map<number,string>();
   for(const value of nodes){if(typeof value.text!=='string')continue;const match=/^Littlewild exchange part (\d+)\n/.exec(value.text);if(!match)continue;
    const index=Number(match[1]),part=value.text.slice(match[0].length);if(index>=count||parts.has(index)||part.length>8000)throw Error('Invalid or duplicate Canvas metadata chunk.');parts.set(index,part);
   }
   let text='';for(let i=0;i<count;i++){if(!parts.has(i))throw Error('Missing Canvas metadata chunk.');text+=parts.get(i)!;}metadata=C.metadata(C.parse(text));
  }
  const context=metadata??options;if(!context)throw Error('Generic Canvas requires canonical pack, scene and explicit mappings.');
  const pack=copy(C.prepare(context.pack,context.sceneId).metadata!.pack),configured=configs(nodes,pack,options,!!metadata,warnings);
  const storyNodes=S.read(nodes,pack);
  for(const config of configured)applyConfig(pack,config,nodes.find(n=>n.id===config.nodeId)!);
  if(metadata){pack.worlds=pack.worlds.filter(w=>configured.some(c=>c.kind==='world'&&c.id===w.id));pack.scenes=pack.scenes.filter(s=>configured.some(c=>c.kind==='scene'&&c.id===s.id));}
  const groups=nodes.filter(n=>n.type==='group'),aliases=new Map<string,string>(),authoring:LWCanvasEditors.Authoring={version:1,nodes:{},edges:{}};
  for(const config of configured){
   const value=nodes.find(n=>n.id===config.nodeId)!,canonicalKey=key(config.kind,config.id);aliases.set(config.nodeId,canonicalKey);
   authoring.nodes[canonicalKey]=D.visual(value,false,advanced,warnings);
   const parent=D.parent(value,groups),owner=parent?configured.find(c=>c.nodeId===parent.id):undefined;
   if(config.kind==='world'){if(parent)throw Error('Canvas world groups cannot be nested.');continue;}
   const scene=pack.scenes.find(s=>s.id===config.id)!;
   if(owner?.kind==='scene'){
    scene.graph??={kind:'level'};scene.graph.parentId=owner.id;
    let ancestor:Config|undefined=owner;const visited=new Set<string>([config.id]);
    while(ancestor?.kind==='scene'){if(visited.has(ancestor.id))throw Error('Canvas hierarchy cycle.');visited.add(ancestor.id);const p=D.parent(nodes.find(n=>n.id===ancestor!.nodeId)!,groups);ancestor=p?configured.find(c=>c.nodeId===p.id):undefined;}
    if(ancestor?.kind!=='world')throw Error('Canvas scene hierarchy requires an enclosing world group.');scene.worldId=ancestor.id;
   }else if(owner?.kind==='world'){scene.worldId=owner.id;if(scene.graph)delete scene.graph.parentId;}
   else if(metadata)throw Error('Canvas scenes must belong to a world group.');
   if(scene.graph?.connections)scene.graph.connections=[];
  }
  const connectionConfigs=new Map<string,Data>();
  for(const value of nodes){
   const config=payload(value,'Littlewild connection');if(!config)continue;
   if(Object.keys(config).some(k=>!['edgeId','requirements','events'].includes(k)))throw Error('Unknown Canvas connection config field.');
   const id=D.text(config.edgeId,'Canvas connection edge ID');if(connectionConfigs.has(id))throw Error('Duplicate Canvas connection config.');connectionConfigs.set(id,config);
  }
  for(const edge of edges){
   const fromArrow=edge.fromEnd==='arrow',toArrow=edge.toEnd===undefined||edge.toEnd==='arrow';
   if(fromArrow===toArrow)throw Error('Canvas connections require exactly one arrow endpoint.');
   const from=configured.find(c=>c.nodeId===(fromArrow?edge.toNode:edge.fromNode)),to=configured.find(c=>c.nodeId===(fromArrow?edge.fromNode:edge.toNode));
   if(from?.kind!=='scene'||to?.kind!=='scene')throw Error('Canvas connections must join mapped scenes.');
   const rawId=String(edge.id),identity=/^connection:([a-z][a-z0-9-]{0,63}):([a-z][a-z0-9-]{0,63})$/.exec(rawId);
   let id=identity?.[2]??rawId;
   if(!/^[a-z][a-z0-9-]{0,63}$/.test(id)){let hash=14695981039346656037n;for(const byte of new TextEncoder().encode(rawId)){hash^=BigInt(byte);hash=BigInt.asUintN(64,hash*1099511628211n);}id='canvas-'+hash.toString(16);}
   const original=context.pack.scenes.find(s=>s.id===(identity?.[1]??from.id))?.graph?.connections?.find(c=>c.id===id);
   const config=connectionConfigs.get(String(edge.id));
   const connection:LWSceneGraph.Connection={id,targetSceneId:to.id,label:D.text(edge.label??original?.label??id,'Canvas connection label',160)};
   for(const field of ['requirements','events'] as const){const entry=config?.[field]??original?.[field];if(entry!==undefined)(connection as unknown as Data)[field]=copy(entry);}
   const source=pack.scenes.find(s=>s.id===from.id)!;source.graph??={kind:'level'};source.graph.connections??=[];source.graph.connections.push(connection);
   const canonicalKey=key('connection',from.id+':'+id);aliases.set(String(edge.id),canonicalKey);const style=D.visual(edge,true,advanced,warnings);
   if(fromArrow){style.fromEnd='none';style.toEnd='arrow';for(const [a,b] of [['fromSide','toSide'],['fromFloating','toFloating']] as const){const first=style[a],second=style[b];delete style[a];delete style[b];if(second!==undefined)style[a]=second;if(first!==undefined)style[b]=first;}}
   authoring.edges[canonicalKey]=style;
  }
  for(const [id] of connectionConfigs)if(!edges.some(e=>e.id===id))throw Error('Dangling Canvas connection configuration.');
  for(const value of nodes){
   const world=payload(value,'Littlewild world'),scene=payload(value,'Littlewild scene'),connection=payload(value,'Littlewild connection'),exchange=payload(value,'Littlewild exchange');
   const part=typeof value.text==='string'?/^Littlewild exchange part (\d+)\n/.exec(value.text):null;
   const canonicalKey=storyNodes.has(String(value.id))&&!String(value.text).startsWith('Littlewild storytelling part ')?'storytelling':part?undefined:world?key('world-config',String(world.id)):scene?key('scene-config',String(scene.id)):connection?String(aliases.get(String(connection.edgeId))).replace('connection:','connection-config:'):exchange?'exchange':undefined;
   if(canonicalKey){aliases.set(String(value.id),canonicalKey);authoring.nodes[canonicalKey]=D.visual(value,false,advanced,warnings);}
  }
  if(advanced){
   const m=C.record(exchanged.metadata),metadataCopy:Data={version:'1.0-1.0',frontmatter:copy(m.frontmatter??{})};
   if(m.startNode!==undefined){const start=aliases.get(String(m.startNode));if(!start)throw Error('Advanced Canvas startNode must reference a mapped node.');metadataCopy.startNode=start;}
   for(const k of Object.keys(m))if(!['version','frontmatter','startNode'].includes(k))warnings.push('Unsupported Advanced Canvas metadata field '+k+' omitted.');
   authoring.metadata=metadataCopy;
  }
  pack.canvasAuthoring=authoring;A.validate(pack);
  return {convertedPack:pack,convertedSceneId:context.sceneId,placements:[],tiles:[],warnings:[...new Set(warnings)]};
 }
 const canvas:LWExternalEditors.Codec={read:(doc,options)=>read(doc,options,false),write:exchange=>write(exchange,false)};
 const advancedCanvas:LWExternalEditors.Codec={read:(doc,options)=>read(doc,options,true),write:exchange=>write(exchange,true)};
 root.LWExternalCanvas=canvas;root.LWExternalAdvancedCanvas=advancedCanvas;if(node)module.exports={canvas,advancedCanvas};
})(globalThis);
