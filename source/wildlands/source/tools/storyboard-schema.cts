/** Versioned presentation contract: authored intent is separate from observed artifact facts. */
export interface StoryboardCard {id:string;title:string;intent?:string;source?:string;image?:string;caption?:string;}
export interface StoryboardSection {id:string;title:string;intent?:string;cards:StoryboardCard[];}
export interface Storyboard {format:'wildlands-storyboard';schemaVersion:1;title:string;intent?:string;layout?:'grid'|'sequence'|'comparison';sections:StoryboardSection[];}
export const limits = {manifestBytes:1048576,jsonBytes:10485760,imageBytes:8388608,totalBytes:25165824,htmlBytes:50331648,sections:12,cards:48,images:96,imagePixels:33554432};
const id={type:'string',pattern:'^[a-z][a-z0-9_-]{0,63}$'},title={type:'string',minLength:1,maxLength:240},text={type:'string',minLength:1,maxLength:4000},file={type:'string',minLength:1,maxLength:512,description:'Relative local path beneath the manifest directory; no parent segments, absolute paths or URLs.'};
export function schema():Record<string,unknown> {
 return {$schema:'https://json-schema.org/draft/2020-12/schema',title:'Wildlands storyboard',type:'object',additionalProperties:false,required:['format','schemaVersion','title','sections'],properties:{
  format:{const:'wildlands-storyboard'},schemaVersion:{const:1},title,intent:text,layout:{enum:['grid','sequence','comparison'],default:'grid'},sections:{type:'array',minItems:1,maxItems:limits.sections,items:{type:'object',additionalProperties:false,required:['id','title','cards'],properties:{id,title,intent:text,cards:{type:'array',minItems:1,maxItems:limits.cards,items:{type:'object',additionalProperties:false,required:['id','title'],anyOf:[{required:['intent']},{required:['source']},{required:['image']},{required:['caption']}],properties:{id,title,intent:text,source:file,image:file,caption:text}}}}}},},
  $comment:'Section and card IDs must be globally unique. At most 48 cards total. Every source is a bounded JSON document; no referenced file is executed.',
 };
}
function object(value:unknown,label:string):Record<string,unknown> {if(!value||typeof value!=='object'||Array.isArray(value))throw Error(label+' must be an object.');return value as Record<string,unknown>;}
function exact(value:Record<string,unknown>,allowed:string[],required:string[],label:string):void {for(const key of Object.keys(value))if(!allowed.includes(key))throw Error(label+' has unknown field '+key+'.');for(const key of required)if(!Object.hasOwn(value,key))throw Error(label+' needs '+key+'.');}
function string(value:unknown,max:number,label:string):void {if(typeof value!=='string'||!value.trim()||value.length>max)throw Error(label+' must contain 1–'+max+' characters.');}
export function admit(input:unknown):Storyboard {
 const value=object(input,'Storyboard');exact(value,['format','schemaVersion','title','intent','layout','sections'],['format','schemaVersion','title','sections'],'Storyboard');
 if(value.format!=='wildlands-storyboard'||value.schemaVersion!==1)throw Error('Use wildlands-storyboard schemaVersion 1; see storyboard schema.');
 string(value.title,240,'title');if(value.intent!==undefined)string(value.intent,4000,'intent');
 if(value.layout!==undefined&&!['grid','sequence','comparison'].includes(String(value.layout)))throw Error('layout must be grid, sequence or comparison.');
 if(!Array.isArray(value.sections)||!value.sections.length||value.sections.length>limits.sections)throw Error('Use 1–12 sections.');
 const ids=new Set<string>();let count=0;
 const identity=(item:Record<string,unknown>,label:string):void=>{string(item.title,240,label+' title');if(typeof item.id!=='string'||!/^[a-z][a-z0-9_-]{0,63}$/.test(item.id)||ids.has(item.id))throw Error(label+' needs a unique safe id.');ids.add(item.id);if(item.intent!==undefined)string(item.intent,4000,label+' intent');};
 for(const [index,item] of value.sections.entries()) {
  const section=object(item,'Section '+index);exact(section,['id','title','intent','cards'],['id','title','cards'],'Section '+index);identity(section,'Section '+index);
  if(!Array.isArray(section.cards)||!section.cards.length)throw Error('Every section needs cards.');
  count+=section.cards.length;if(count>limits.cards)throw Error('Use at most 48 cards total.');
  for(const [cardIndex,entry] of section.cards.entries()) {
   const label='Section '+index+' card '+cardIndex,card=object(entry,label);
   exact(card,['id','title','intent','source','image','caption'],['id','title'],label);identity(card,label);
   if(!['intent','source','image','caption'].some(key=>Object.hasOwn(card,key)))throw Error(label+' needs intent, source, image or caption.');
   for(const field of ['source','image'])if(card[field]!==undefined)string(card[field],512,label+' '+field);
   if(card.caption!==undefined)string(card.caption,4000,label+' caption');
  }
 }
 return value as unknown as Storyboard;
}
