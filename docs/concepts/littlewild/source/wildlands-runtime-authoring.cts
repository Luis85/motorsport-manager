import {toolbox} from './developer-sdk.cjs';

/** Transport handles hold SDK drafts, never live engine aggregates or executable input. */
const sceneMethods = {snapshot:[0,0],export:[0,0],validate:[0,0],replace:[1,1],updateScene:[2,2],updateWorld:[2,2],addWorld:[3,3],addScene:[3,4],removeScene:[1,1],removeWorld:[1,1],entities:[1,1],place:[5,5],setEntity:[4,4],addProp:[2,2],addEntity:[4,6],removeEntity:[3,3],undo:[0,0],redo:[0,0]} as const;
const creatureMethods = {snapshot:[0,0],fields:[0,0],exportPackage:[0,0],exportScenario:[0,0],select:[1,1],setField:[2,2],updateDefinition:[1,1],updateAppearance:[1,1],updateInstance:[1,1],importPackage:[1,1],duplicateArchetype:[2,2],undo:[0,0],redo:[0,0]} as const;
const storyMethods = {list:[0,0],setCutscene:[1,2],removeCutscene:[1,2],setStoryboard:[1,2],removeStoryboard:[1,2],setEvents:[2,3]} as const;
const playbackMethods = {status:[0,0],sample:[0,0],play:[0,0],pause:[0,0],resume:[0,0],stop:[0,0],replay:[0,0],seek:[1,1],skip:[0,0]} as const;
type Methods = Readonly<Record<string,readonly [number,number]>>;
interface Handle {kind:string;target:object;methods:Methods;dispose?:()=>void;}

export function record(value:unknown,label='Parameters'):Record<string,unknown> {
 if(value===null||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');
 return value as Record<string,unknown>;
}
export function text(value:unknown,label:string):string {
 if(typeof value!=='string'||!value.length||value.length>256)throw Error(label+' must be a nonempty string of at most 256 characters.');
 return value;
}
export function invoke(target:object,methods:Methods,name:unknown,input:unknown):unknown {
 const method=text(name,'Method');
 if(!Object.hasOwn(methods,method))throw Error('Unknown method. Use discover.');
 const bounds=methods[method]!;
 const args=input===undefined?[]:input;
 if(!Array.isArray(args)||args.length<bounds[0]||args.length>bounds[1])throw Error('Invalid argument count for '+method+'.');
 const callable=(target as Record<string,unknown>)[method];
 if(typeof callable!=='function')throw Error('Supported SDK operation is unavailable.');
 return (callable as (...args:unknown[])=>unknown).apply(target,args)??null;
}

export class AuthoringHandles {
 private readonly handles=new Map<string,Handle>();
 private sequence=0;
 discover():unknown {return {maxHandles:32,kinds:{scene:sceneMethods,creature:creatureMethods,storytelling:storyMethods,playback:playbackMethods}};}
 create(params:Record<string,unknown>):unknown {
  const kind=text(params.kind,'Editor kind');
  const slots=kind==='storytelling'?2:1;
  if(this.handles.size+slots>32)throw Error('Close authoring handles before creating more (maximum 32).');
  const pack=params.pack;
  const add=(handle:Handle):string=>{const id='editor-'+ ++this.sequence;this.handles.set(id,handle);return id;};
  if(kind==='scene')return {editorId:add({kind,target:toolbox.createSceneEditor(pack),methods:sceneMethods})};
  if(kind==='creature')return {editorId:add({kind,target:toolbox.createCreatureEditor(pack,record(params.selection) as unknown as LWCreatureEditor.Selection),methods:creatureMethods})};
  if(kind==='storytelling'){
   const editor=toolbox.storytelling.createEditor(pack);
   return {editorId:add({kind,target:editor.storytelling,methods:storyMethods}),sceneEditorId:add({kind:'scene',target:editor.scene,methods:sceneMethods})};
  }
  if(kind==='playback'){
   const playback=toolbox.storytelling.createPlayback(pack,text(params.cutsceneId,'Cutscene ID'));
   return {editorId:add({kind,target:playback,methods:playbackMethods,dispose:()=>playback.dispose()})};
  }
  throw Error('Unknown authoring kind. Use discover.');
 }
 call(params:Record<string,unknown>):unknown {
  const handle=this.get(params.editorId);
  const result=invoke(handle.target,handle.methods,params.method,params.args);
  return {result,revision:(handle.target as {revision?:number}).revision??null,canUndo:(handle.target as {canUndo?:boolean}).canUndo??false,canRedo:(handle.target as {canRedo?:boolean}).canRedo??false};
 }
 close(value:unknown):void {
  const id=text(value,'Editor ID'),handle=this.get(id);handle.dispose?.();this.handles.delete(id);
 }
 dispose():void {for(const handle of this.handles.values())handle.dispose?.();this.handles.clear();}
 private get(value:unknown):Handle {return this.handles.get(text(value,'Editor ID'))??(()=>{throw Error('Unknown authoring handle.');})();}
}
