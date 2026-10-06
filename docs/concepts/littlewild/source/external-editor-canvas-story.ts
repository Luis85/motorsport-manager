/// <reference path="./external-editor-canvas-contracts.d.ts" />
/* Portable cinematic config text; compiled storytelling still owns validation/playback. */
(function(inputRoot:unknown){
 'use strict';
 const root=inputRoot as {LWExternalEditorCore:LWExternalEditors.Core;LWCanvasStoryEditor?:LWCanvasEditors.StoryApi};
 const node=typeof module!=='undefined'&&module.exports;
 const C=(node?require('./external-editor-core.js'):root.LWExternalEditorCore) as LWExternalEditors.Core;
 type Data=LWCanvasEditors.Data;
 function row(id:string,text:string,y:number):Data{return {id,type:'text',x:-1280,y,width:560,height:260,text};}
 function write(pack:LWContentPorts.ScenarioPack):Data[]{
  if(!pack.storytelling)return [];
  const text=JSON.stringify(pack.storytelling,null,2);
  if(text.length<=8000)return [row('storytelling','Littlewild storytelling\n'+text,300)];
  const compact=JSON.stringify(pack.storytelling),parts=Math.ceil(compact.length/8000);
  if(parts>200)throw Error('Canvas storytelling config exceeds supported chunks.');
  const result=[row('storytelling','Littlewild storytelling chunks\n'+JSON.stringify({version:1,parts}),300)];
  for(let i=0;i<parts;i++)result.push(row('storytelling-part:'+i,'Littlewild storytelling part '+i+'\n'+compact.slice(i*8000,(i+1)*8000),600+i*300));
  return result;
 }
 function read(nodes:Data[],pack:LWContentPorts.ScenarioPack):Set<string>{
  const direct=nodes.filter(n=>n.type==='text'&&typeof n.text==='string'&&n.text.startsWith('Littlewild storytelling\n'));
  const chunked=nodes.filter(n=>n.type==='text'&&typeof n.text==='string'&&n.text.startsWith('Littlewild storytelling chunks\n'));
  const fragments=nodes.filter(n=>n.type==='text'&&typeof n.text==='string'&&n.text.startsWith('Littlewild storytelling part '));
  const used=new Set<string>();if(direct.length+chunked.length>1)throw Error('Duplicate Canvas storytelling configuration.');
  let text:string|undefined;
  if(direct.length){text=String(direct[0]!.text).slice('Littlewild storytelling\n'.length);used.add(String(direct[0]!.id));if(fragments.length)throw Error('Unexpected Canvas storytelling chunks.');}
  if(chunked.length){
   const control=chunked[0]!,config=C.parse(String(control.text).slice('Littlewild storytelling chunks\n'.length)),count=config.parts;
   used.add(String(control.id));if(config.version!==1||typeof count!=='number'||!Number.isInteger(count)||count<1||count>200||Object.keys(config).some(k=>!['version','parts'].includes(k)))throw Error('Invalid Canvas storytelling chunk descriptor.');
   const parts=new Map<number,string>();
   for(const value of fragments){const match=/^Littlewild storytelling part (\d+)\n/.exec(String(value.text));if(!match)throw Error('Invalid Canvas storytelling chunk header.');const index=Number(match[1]),part=String(value.text).slice(match[0].length);if(index>=count||parts.has(index)||part.length>8000)throw Error('Invalid or duplicate Canvas storytelling chunk.');parts.set(index,part);used.add(String(value.id));}
   text='';for(let i=0;i<count;i++){if(!parts.has(i))throw Error('Missing Canvas storytelling chunk.');text+=parts.get(i)!;}
  }else if(!direct.length&&fragments.length)throw Error('Canvas storytelling chunks require their descriptor.');
  if(text!==undefined)pack.storytelling=C.parse(text) as unknown as LWStorytelling.Data;
  return used;
 }
 const api:LWCanvasEditors.StoryApi={write,read};root.LWCanvasStoryEditor=api;if(node)module.exports=api;
})(globalThis);
