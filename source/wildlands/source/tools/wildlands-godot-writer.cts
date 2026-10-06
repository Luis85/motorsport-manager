/** Atomic directory publisher for trusted compiler output; never overlays a project. */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
interface File {path:string;encoding:'utf8'|'base64';content:string;}
interface Result {files:File[];manifest:Record<string,unknown>;}
export async function writeGodotProject(project:unknown,output:string):Promise<{output:string;files:number;manifest:Record<string,unknown>}>{
 if(typeof output!=='string'||!output.trim())throw Error('Godot output directory is required.');
 const destination=path.resolve(output),parent=path.dirname(destination);
 if(fs.existsSync(destination)||fs.realpathSync(parent)!==parent)throw Error('Godot output must be a new directory with a real parent and no symlink ancestors.');
 const P=require('../wildlands-project.js');
 const G=require('../wildlands-godot.js') as {compile(project:unknown,resources:{bundle:unknown;templates:Record<string,string>}):Promise<Result>};
 // Static requires of the trusted build outputs let tools/cli-bundle.cts embed them in bin/wildlands.
 const bundle=require('../wildlands-runtime-bundle.json') as unknown;
 const templates=require('../wildlands-godot-templates.json') as Record<string,string>;
 const compiled=await G.compile(project,{bundle,templates}),temporary=path.join(parent,'.'+path.basename(destination)+'.wildlands-'+randomUUID());
 // Exclusive directory claim closes the normal concurrent-publisher collision window.
 fs.mkdirSync(destination,{recursive:false});const claim=fs.lstatSync(destination);
 try{
  fs.mkdirSync(temporary,{recursive:false});
  for(const file of compiled.files){if(!file.path||file.path.startsWith('/')||file.path.includes('\\')||file.path.split('/').some(part=>!part||part==='.'||part==='..'))throw Error('Unsafe Godot output path.');
   const filename=path.join(temporary,file.path);fs.mkdirSync(path.dirname(filename),{recursive:true});fs.writeFileSync(filename,file.encoding==='base64'?Buffer.from(file.content,'base64'):file.content,{flag:'wx'});
  }
  const current=fs.lstatSync(destination);if(current.ino!==claim.ino||current.dev!==claim.dev||fs.readdirSync(destination).length)throw Error('Godot output claim was changed by another process.');fs.renameSync(temporary,destination);
 }catch(error){fs.rmSync(temporary,{recursive:true,force:true});try{const current=fs.lstatSync(destination);if(current.ino===claim.ino&&current.dev===claim.dev)fs.rmdirSync(destination);}catch{}throw error;}
 return {output:destination,files:compiled.files.length,manifest:compiled.manifest};
}
