import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readBytesFile} from './cli-io.cjs';
import {limits} from './storyboard-schema.cjs';
export const sha256=(value:Uint8Array|string):string=>createHash('sha256').update(value).digest('hex');
export interface InputReceipt {path:string;kind:string;sha256:string;bytes:number;}
export interface ImageEvidence {path:string;sha256:string;hashVerified:boolean;data:string;width:number;height:number;}
/** The root is the real manifest directory. Reviewed files cannot escape through symlinks. */
export class StoryboardFiles {
 readonly root:string;readonly inputs:InputReceipt[]=[];private total=0;private images=0;
 private readonly cache=new Map<string,Uint8Array>();
 constructor(inputFile:string){this.root=fs.realpathSync(path.dirname(path.resolve(inputFile)));}
 relative(file:string):string{return path.relative(this.root,file).split(path.sep).join('/');}
 resolve(reference:string,base=this.root):string {
  if(!reference||reference.includes('\0')||reference.includes('\\')||path.isAbsolute(reference)||/^[a-z][a-z0-9+.-]*:/i.test(reference)||reference.split('/').includes('..'))throw Error('Use a relative local path without parent traversal: '+reference);
  const lexical=path.resolve(base,reference),real=fs.realpathSync(lexical);
  if(real!==this.root&&!real.startsWith(this.root+path.sep))throw Error('Referenced file escapes storyboard directory: '+reference);
  return real;
 }
 read(file:string,kind:string,maxBytes:number):Uint8Array {
  const cached=this.cache.get(file);if(cached){if(cached.length>maxBytes)throw Error('Input exceeds '+maxBytes+' bytes: '+this.relative(file));return cached;}
  const bytes=readBytesFile(file,maxBytes);this.total+=bytes.length;if(this.total>limits.totalBytes)throw Error('Storyboard inputs exceed the 24 MiB total byte limit.');
  this.cache.set(file,bytes);this.inputs.push({path:this.relative(file),kind,sha256:sha256(bytes),bytes:bytes.length});return bytes;
 }
 json(file:string,kind='json',maxBytes=limits.jsonBytes):unknown {
  const text=new TextDecoder('utf-8',{fatal:true}).decode(this.read(file,kind,maxBytes));
  let value:unknown;try{value=JSON.parse(text.replace(/^\uFEFF/,''));}catch{throw Error('Malformed JSON: '+this.relative(file));}
  let count=0;const visit=(row:unknown,depth:number):void=>{if(++count>500000||depth>64)throw Error('JSON exceeds storyboard structural limits: '+this.relative(file));if(typeof row==='number'&&!Number.isFinite(row))throw Error('Nonfinite JSON number: '+this.relative(file));if(row&&typeof row==='object')for(const child of Object.values(row))visit(child,depth+1);};visit(value,0);return value;
 }
 image(reference:string,base=this.root,expected?:unknown):ImageEvidence {
  if(++this.images>limits.images)throw Error('Storyboards support at most 96 images.');
  const file=this.resolve(reference,base),bytes=this.read(file,'image',limits.imageBytes),buffer=Buffer.from(bytes),digest=sha256(bytes);
  if(expected!==undefined&&(typeof expected!=='string'||!/^[a-f0-9]{64}$/.test(expected)||expected!==digest))throw Error('Review image SHA-256 mismatch: '+this.relative(file));
  let width=0,height=0,mime='';
  if(buffer.length>=33&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&buffer.toString('ascii',12,16)==='IHDR') {
   let offset=8,hasData=false,ended=false;
   while(offset+12<=buffer.length){const length=buffer.readUInt32BE(offset),kind=buffer.toString('ascii',offset+4,offset+8);if(length>buffer.length-offset-12)break;if(offset===8&&length!==13)break;if(kind==='IDAT'&&length>0)hasData=true;offset+=length+12;if(kind==='IEND'){ended=length===0&&offset===buffer.length;break;}}
   if(!hasData||!ended)throw Error('Truncated or incomplete PNG: '+this.relative(file));
   mime='image/png';width=buffer.readUInt32BE(16);height=buffer.readUInt32BE(20);
  }
  else if(buffer.length>4&&buffer[0]===255&&buffer[1]===216) {
   if(buffer[buffer.length-2]!==255||buffer[buffer.length-1]!==217)throw Error('Truncated JPEG: '+this.relative(file));
   mime='image/jpeg';let offset=2;
   while(offset+4<buffer.length){if(buffer[offset]!==255)break;const marker=buffer[offset+1]!;if(marker===255){offset++;continue;}if(marker===217||marker===218)break;const size=buffer.readUInt16BE(offset+2);if(size<2||offset+2+size>buffer.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&size>=8){height=buffer.readUInt16BE(offset+5);width=buffer.readUInt16BE(offset+7);break;}offset+=size+2;}
  }
  if(!mime||!width||!height||width>8192||height>8192||width*height>limits.imagePixels)throw Error('Use a PNG or JPEG with dimensions up to 8192 and at most 32 megapixels: '+this.relative(file));
  return {path:this.relative(file),sha256:digest,hashVerified:expected!==undefined,data:'data:'+mime+';base64,'+buffer.toString('base64'),width,height};
 }
}
