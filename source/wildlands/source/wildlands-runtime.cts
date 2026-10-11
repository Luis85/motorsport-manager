import {toolbox,type Session,type Command} from './developer-sdk.cjs';
import {projects} from './wildlands-project-sdk.cjs';
import {AuthoringHandles,record,text,invoke} from './wildlands-runtime-authoring.cjs';

const content=require('./content-runtime.js') as LWContentPorts.ContentApi;
const decoder=require('./engine-export-data.js') as LWEngineExport.Decoder;
const scenarios=require('./scenario-runtime.js') as LWContentPorts.ScenarioApi;

export const MAX_REQUEST_BYTES=64*1024*1024;
export const MAX_RESPONSE_BYTES=64*1024*1024;
export interface RuntimeOptions {scenarioId?:string;sceneId?:string;pack?:unknown;project?:unknown;}
export interface RuntimeResponse {id:string|number|null;ok:boolean;result?:unknown;error?:{code:string;message:string};}
const queries={inspect:[0,0],terraform:[0,0],terrain:[2,2],previewTerraform:[1,1],buildingInterior:[1,1],constructionOptions:[0,0],previewBuildingDesign:[1,2],buildingDesign:[1,1],interactionOptions:[2,2],interactions:[0,0],interactionDefinitions:[0,0],settings:[0,0],sceneConnections:[0,0],sceneTarget:[0,0],sceneProps:[0,0],save:[0,0],story:[0,0],captureScenario:[0,0]} as const;
const facets={
 toolbox:{scenarios:[0,0],commands:[0,0],failureCodes:[0,0],validateScenario:[1,1],creatures:[0,0],validateCreature:[1,1],interiors:[0,0],validateInteriorCatalog:[1,1],validateBuildingDesign:[1,1],interactions:[0,0],validateInteraction:[1,1],validateInteractionLibrary:[1,1],validateCreaturePackage:[1,2]},
 assets:{list:[0,1],get:[2,2],validate:[1,1]},renderers:{list:[0,0],validate:[1,1]},animations:{list:[0,0],validate:[1,1]},
 externalEditors:{formats:[0,0],detect:[1,1],export:[3,3],import:[1,2]},
 storytelling:{inspect:[1,1],sample:[3,3]},
 balancing:{defaults:[0,0],startingPack:[1,2],capture:[1,2],validate:[1,2],diff:[2,2],probe:[3,3],sweep:[3,3]},
 engineExport:{export:[2,2],validate:[1,1]}
} as const;
const operations=[
 ['discover',{},'none'],['inspect',{},'none'],['start',{},'control'],['pause',{},'control'],['resume',{},'control'],
 ['step',{count:'integer 0..36000 (default 1)'},'fixed'],['advance',{seconds:'multiple of 0.1, 0..3600'},'fixed'],
 ['command',{command:'SDK command envelope; discover.commands describes scope and argument ceiling'},'none'],
 ['query',{name:'discover.queries key',args:'array, positional SDK arguments'},'none'],
 ['save',{},'none'],['story',{},'none'],['story.export',{},'none'],['session.capture',{},'none'],
 ['session.create',{scenarioId:'built-in ID (default littlewild)',pack:'optional complete scenario pack',sceneId:'optional scene ID'},'none'],
 ['session.openStory',{story:'original story.export JSON text (preferred) or portable story envelope 10'},'none'],['session.close',{},'none'],
 ['scene.review',{connectionId:'discoverable connection ID'},'none'],['scene.enter',{connectionId:'discoverable connection ID'},'none'],
 ['storytelling.inspect',{},'none'],['storytelling.sample',{id:'cutscene ID',time:'finite clip seconds'},'none'],
 ['tools.call',{facet:'discover.facets key',method:'allowed SDK method',args:'positional arguments'},'none'],
 ['authoring.create',{kind:'scene | creature | storytelling | playback',pack:'complete scenario pack',selection:'creature selection',cutsceneId:'playback cutscene'},'none'],
 ['authoring.call',{editorId:'retained handle',method:'discover.authoring allowed method',args:'positional SDK arguments'},'none'],
 ['authoring.close',{editorId:'retained handle'},'none'],
 ['balancing.review',{pack:'scenario pack',input:'balancing document'},'none'],['balancing.apply',{pack:'scenario pack',reviewId:'retained balancing review ID'},'none'],
 ['shutdown',{},'none']
] as const;

/** One explicit-clock SDK session per process, shared by terminal agents and native Godot. */
export class WildlandsRuntime {
 private session:Session|null=null;
 private authoredPack:LWContentPorts.ScenarioPack|null=null;
 private readonly editors=new AuthoringHandles();
 private readonly reviews=new Map<string,LWBalancing.Review>();
 private reviewSequence=0;
 private closed=false;
 constructor(options:RuntimeOptions={}) {
  if(options.project!==undefined){
   const checked=projects.validate(options.project);if(!checked.ok)throw Error(checked.errors.join('\n'));
   const project=checked.project;
   this.create({scenarioId:project.scenarioId,sceneId:project.sceneId,pack:project.pack});
  }else this.create(options as unknown as Record<string,unknown>);
 }
 get stopped():boolean {return this.closed;}
 async execute(input:unknown):Promise<RuntimeResponse> {
  let id:string|number|null=null;
  try {
   const request=record(decoder.parse(typeof input==='string'?input.replace(/^\uFEFF/,''):input),'Request');
   if((typeof request.id==='string'&&request.id.length>0&&request.id.length<=128)||(typeof request.id==='number'&&Number.isSafeInteger(request.id)))id=request.id;
   else throw Error('Request ID must be a string of 1..128 characters or a safe integer.');
   if(Object.keys(request).some(key=>!['id','method','params'].includes(key)))throw Error('Unknown request field.');
   const method=text(request.method,'Request method');
   const params=request.params===undefined?{}:record(request.params);
   if(this.closed)throw Error('Runtime is shut down.');
   return {id,ok:true,result:await this.dispatch(method,params)??null};
  }catch(error){
   const known=error as {code?:unknown};
   return {id,ok:false,error:{code:typeof known?.code==='string'?known.code:'invalid-input',message:error instanceof Error?error.message:String(error)}};
  }
 }
 dispose():void {this.session?.dispose();this.session=null;this.authoredPack=null;this.editors.dispose();this.reviews.clear();this.closed=true;}
 private owned():Session {if(!this.session)throw Error('No active session. Use session.create or session.openStory.');return this.session;}
 private view():unknown {
  const session=this.owned(),story=session.story(),experience=story.experience===undefined?{}:record(story.experience),target=session.sceneTarget();
  const assets=toolbox.assets.list().map(asset=>toolbox.assets.get(asset.category,asset.id));
  return {snapshot:session.inspect(),state:session.save().state,terraform:session.terraform(),props:session.sceneProps(),connections:session.sceneConnections(),target,
   interior:target?.type==='interior'?session.buildingInterior(target.buildingId):null,worldProfile:experience.world??null,
   settings:session.settings(),interactions:session.interactions(),creatures:toolbox.creatures(),assets};
 }
 private replace(create:()=>Session):void {
  // Existing process-global registries require release before commit. A rejected replacement
  // restores the exact production story, including RNG, libraries and journey checkpoints.
  const retained=this.session?.story();this.session?.dispose();this.session=null;
  try {this.session=create();}
  catch(error){if(retained)this.session=toolbox.openStory(toolbox.reviewStory(retained));throw error;}
 }
 private capture():LWContentPorts.ScenarioPack {
  const captured=this.owned().captureScenario() as unknown as LWContentPorts.ScenarioPack;
  if(!this.authoredPack||captured.scenes.some(scene=>scene.graph))return captured;
  const sceneId=this.owned().inspect().sceneId;
  if(!sceneId||!this.authoredPack.scenes.some(scene=>scene.id===sceneId))return captured;
  // Shared project admission preserves all unobserved scenes, art and timelines.
  return projects.capture(projects.create({pack:this.authoredPack,sceneId}),captured,sceneId).pack;
 }
 private create(params:Record<string,unknown>):void {
  const pack=params.pack;
  if(pack!==undefined){
   const validation=toolbox.validateScenario(content.parse(pack,MAX_REQUEST_BYTES));
   if(!validation.ok)throw Error(validation.errors.join('\n'));
   const scenes=record(validation.data).scenes;
   const first=Array.isArray(scenes)?record(scenes[0],'First scene').id:undefined;
   const sceneId=text(params.sceneId??first,'Scene ID');
   this.replace(()=>toolbox.createScenario(validation.data,sceneId));
   this.authoredPack=validation.data as unknown as LWContentPorts.ScenarioPack;
  }else {
   const scenarioId=text(params.scenarioId??scenarios.defaultId(),'Scenario ID');
   const sceneId=params.sceneId===undefined?undefined:text(params.sceneId,'Scene ID');
   const project=projects.create(sceneId===undefined?{scenarioId}:{scenarioId,sceneId});
   this.replace(()=>toolbox.createScenario(project.pack,project.sceneId));this.authoredPack=project.pack;
  }
 }
 private dispatch(method:string,params:Record<string,unknown>):unknown {
  switch(method){
   case 'discover':return {format:'wildlands-runtime',schemaVersion:1,nodeMajor:22,fixedStep:toolbox.fixedStep,maxSteps:toolbox.maxSteps,maxRequestBytes:MAX_REQUEST_BYTES,maxResponseBytes:MAX_RESPONSE_BYTES,
    operations:operations.map(([method,parameters,clock])=>({method,parameters,clock,...method==='story.export'?{result:'Engine-serialized JSON string. Save verbatim and pass the original text to session.openStory; parsing and reserializing in another runtime can change numeric fingerprints.'}:{}})),scenarios:toolbox.scenarios(),commands:toolbox.commands(),failureCodes:toolbox.failureCodes(),queries,facets,authoring:this.editors.discover()};
   case 'inspect':return this.view();
   case 'start':this.owned().start();return this.view();
   case 'pause':this.owned().pause();return this.view();
   case 'resume':this.owned().resume();return this.view();
   case 'step':return {step:this.owned().step(params.count===undefined?1:params.count as number),view:this.view()};
   case 'advance':return {step:this.owned().advance(params.seconds as number),view:this.view()};
   case 'command':return this.owned().command(params.command as Command);
   case 'query':return invoke(this.owned(),queries,params.name,params.args);
   case 'save':return this.owned().save();
   case 'story':return this.owned().story();
   case 'story.export':return JSON.stringify(this.owned().story());
   case 'session.capture':return this.capture();
   case 'session.create':this.create(params);return this.view();
   case 'session.openStory':{
    const review=toolbox.reviewStory(params.story);this.replace(()=>toolbox.openStory(review));
    const snapshot=this.owned().inspect();
    if(this.authoredPack?.id!==snapshot.scenarioId||!this.authoredPack?.scenes.some(scene=>scene.id===snapshot.sceneId))this.authoredPack=null;
    return this.view();
   }
   case 'session.close':this.session?.dispose();this.session=null;return {closed:true};
   case 'scene.review':return this.owned().reviewScene(text(params.connectionId,'Connection ID'));
   case 'scene.enter':{
    const session=this.owned(),review=session.reviewScene(text(params.connectionId,'Connection ID'));session.enterScene(review);return this.view();
   }
   case 'storytelling.inspect':return toolbox.storytelling.inspect(this.capture());
   case 'storytelling.sample':return toolbox.storytelling.sample(this.capture(),text(params.id,'Cutscene ID'),params.time as number);
   case 'tools.call':{
    const facet=text(params.facet,'Tool facet');
    if(!Object.hasOwn(facets,facet))throw Error('Unknown tool facet. Use discover.');
    const name=facet as keyof typeof facets;
    const target=name==='toolbox'?toolbox:toolbox[name];
    return invoke(target,facets[name],params.method,params.args);
   }
   case 'authoring.create':return this.editors.create(params);
   case 'authoring.call':return this.editors.call(params);
   case 'authoring.close':this.editors.close(params.editorId);return {closed:true};
   case 'balancing.review':{
    if(this.reviews.size>=32)throw Error('At most 32 pending balancing reviews. Apply one or restart.');
    const review=toolbox.balancing.review(params.pack,params.input),reviewId='review-'+ ++this.reviewSequence;this.reviews.set(reviewId,review);return {reviewId,review};
   }
   case 'balancing.apply':{
    const id=text(params.reviewId,'Review ID'),review=this.reviews.get(id);if(!review)throw Error('Unknown retained balancing review.');
    const pack=toolbox.balancing.apply(params.pack,review);this.reviews.delete(id);return pack;
   }
   case 'shutdown':this.dispose();return {closed:true};
   default:throw Error('Unknown operation. Use discover.');
  }
 }
}
