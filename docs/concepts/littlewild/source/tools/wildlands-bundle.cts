/** Build-only trusted executable inventory for the desktop Godot adapter. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

interface RuntimeFile {path:string;encoding:'utf8';content:string;}
export interface RuntimeLoader {encoding:'gzip-base64';decodedBytes:number;sha256:string;data:string;}
function walk(directory:string):string[]{
 return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
 });
}
export function writeWildlandsBundle(source:string,generated:string):void{
 const files:RuntimeFile[]=walk(generated).flatMap(file=>{
  const relative=path.relative(generated,file).replaceAll(path.sep,'/');
  if(!/\.(?:js|cjs|json)$/.test(relative)||relative.startsWith('verification/')||relative.startsWith('architecture/')||relative.startsWith('fixtures/')||
   /(^|\/)test[^/]*\.|-results\.json$/.test(relative)||relative==='engine-source-loader.json'||relative.startsWith('wildlands-runtime-bundle')||relative==='wildlands-runtime-loader.json'||relative==='wildlands-godot-templates.json'||relative==='build.js')return [];
  if(relative.startsWith('tools/')&&!['tools/wildlands-runtime.cjs','tools/cli-io.cjs'].includes(relative))return [];
  return [{path:'runtime/'+relative,encoding:'utf8',content:fs.readFileSync(file,'utf8')}];
 });
 if(!files.some(file=>file.path==='runtime/tools/wildlands-runtime.cjs'))throw Error('Wildlands runtime entry was not compiled.');
 const bundle={format:'wildlands-runtime-bundle',schemaVersion:1,files};
 const text=JSON.stringify(bundle);
 // Browser already contains the inert source loader: share it rather than duplicate it.
 const browserBundle={...bundle,sharedEngineSources:true,files:files.filter(file=>file.path!=='runtime/engine-source-bundle.json')};
 const bytes=Buffer.from(JSON.stringify(browserBundle));
 if(bytes.length>64*1024*1024||Buffer.byteLength(text)>64*1024*1024)throw Error('Wildlands runtime exceeds64MiB.');
 const loader:RuntimeLoader={encoding:'gzip-base64',decodedBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),data:gzipSync(bytes,{level:9}).toString('base64')};
 fs.writeFileSync(path.join(generated,'wildlands-runtime-bundle.json'),text);
 fs.writeFileSync(path.join(generated,'wildlands-runtime-loader.json'),JSON.stringify(loader));
 const templateRoot=path.join(source,'wildlands-godot');
 const templates=Object.fromEntries(fs.readdirSync(templateRoot).filter(name=>name.endsWith('.gd')&&!name.startsWith('test-')).sort().map(name=>[name,fs.readFileSync(path.join(templateRoot,name),'utf8')]));
 fs.writeFileSync(path.join(generated,'wildlands-godot-templates.json'),JSON.stringify(templates));
}
