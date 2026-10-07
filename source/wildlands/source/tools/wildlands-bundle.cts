/**
 * Build-only trusted executable inventory for the desktop Godot adapter.
 *
 * The bundle is the static require closure of the gameplay entry points the native bridge runs,
 * not every compiled file: browser presentation modules, other templates' runtimes, test
 * fixtures and generated evidence are never reachable from it. Every closure file must be an
 * authored output or a known generated data file, every require must be a literal path, and no
 * closure module may read sibling files by path, so the inventory cannot silently miss a file.
 * The inert engine-source bundle is a declared optional payload (engine export reports it as
 * unavailable when absent); Godot projects include it only on explicit request.
 */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';

// pako ships no declarations; the pinned pure-JS encoder keeps payload bytes independent of Node's zlib.
const pako=require('pako') as {gzip(data:Uint8Array,options:{level:number}):Uint8Array};

interface RuntimeFile {path:string;encoding:'utf8';content:string;}
export interface RuntimeLoader {encoding:'gzip-base64';decodedBytes:number;sha256:string;data:string;}
/** Entry points compile() requires: the bridge subprocess and the SDK it composes. */
export const RUNTIME_ROOTS=['tools/wildlands-runtime.cjs','developer-sdk.cjs'] as const;
/** Opt-in payloads that closure modules require only behind a declared capability check. */
export const OPTIONAL_PAYLOADS=['engine-source-bundle.json'] as const;
function walk(directory:string):string[]{
 return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en')).flatMap(entry=>{
  const file=path.join(directory,entry.name);
  return entry.isDirectory()?walk(file):entry.isFile()?[file]:[];
 });
}
// Root JSON outputs written by build.ts rather than compiled or copied from an authored path.
const generatedData=new Set(['interaction-library.json','creature-definitions.json','creature-editor-fields.json','creature-config.json','asset-definitions.json']);
function ownedRuntimeFile(source:string,relative:string):boolean{
 const authored=(name:string):boolean=>{const file=path.join(source,name);return fs.existsSync(file)&&fs.statSync(file).isFile();};
 if(relative.endsWith('.json'))return generatedData.has(relative)||authored(relative);
 const author=relative.replace(/\.js$/,'.ts').replace(/\.cjs$/,'.cts');
 return authored(relative)||author!==relative&&authored(author);
}
/** Literal relative requires of one compiled module; anything that could load an unlisted file rejects. */
function requires(relative:string,text:string):string[]{
 const tree=ts.createSourceFile(relative,text,ts.ScriptTarget.Latest,false,ts.ScriptKind.JS),found:string[]=[],problems:string[]=[];
 function visit(node:ts.Node):void{
  if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)problems.push('dynamic import()');
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='require'){
   const target=node.arguments[0];
   if(node.arguments.length!==1||!target||!ts.isStringLiteralLike(target))problems.push('non-literal require');
   else if(target.text.startsWith('.'))found.push(target.text);
  }
  if(ts.isIdentifier(node)&&['__dirname','__filename'].includes(node.text))problems.push(node.text);
  ts.forEachChild(node,visit);
 }
 visit(tree);
 if(problems.length)throw Error(`Godot runtime module ${relative} may load files outside its static require graph (${[...new Set(problems)].join(', ')}).`);
 return found;
}
/** Static require closure of the runtime roots, relative to the generated directory. */
export function runtimeClosure(source:string,generated:string):Set<string>{
 const closure=new Set<string>(),pending:string[]=[...RUNTIME_ROOTS];
 while(pending.length){
  const relative=pending.pop()!;
  if(closure.has(relative))continue;
  const file=path.join(generated,relative);
  if(!fs.existsSync(file)||!ownedRuntimeFile(source,relative))throw Error(`Godot runtime requires ${relative}, which is not an authored or generated runtime file. Rebuild Wildlands.`);
  closure.add(relative);
  if(!/\.c?js$/.test(relative))continue;
  for(const specifier of requires(relative,fs.readFileSync(file,'utf8'))){
   const target=path.posix.normalize(path.posix.join(path.posix.dirname(relative),specifier));
   if(target.startsWith('../')||path.posix.isAbsolute(target))throw Error(`Godot runtime module ${relative} requires ${specifier} outside the runtime.`);
   if((OPTIONAL_PAYLOADS as readonly string[]).includes(target))continue;
   pending.push(target);
  }
 }
 return closure;
}
export function writeWildlandsBundle(source:string,generated:string):void{
 const closure=runtimeClosure(source,generated);
 const files:RuntimeFile[]=walk(generated).flatMap(file=>{
  const relative=path.relative(generated,file).replaceAll(path.sep,'/');
  return closure.has(relative)?[{path:'runtime/'+relative,encoding:'utf8' as const,content:fs.readFileSync(file,'utf8')}]:[];
 });
 if(files.length!==closure.size)throw Error('Godot runtime closure contains a path that is not a generated file.');
 const bundle={format:'wildlands-runtime-bundle',schemaVersion:1,files};
 const text=JSON.stringify(bundle),bytes=Buffer.from(text);
 if(bytes.length>64*1024*1024)throw Error('Wildlands runtime exceeds64MiB.');
 const loader:RuntimeLoader={encoding:'gzip-base64',decodedBytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),data:Buffer.from(pako.gzip(bytes,{level:9})).toString('base64')};
 fs.writeFileSync(path.join(generated,'wildlands-runtime-bundle.json'),text);
 fs.writeFileSync(path.join(generated,'wildlands-runtime-loader.json'),JSON.stringify(loader));
 const templateRoot=path.join(source,'wildlands-godot');
 const templates=Object.fromEntries(fs.readdirSync(templateRoot).filter(name=>name.endsWith('.gd')&&!name.startsWith('test-')).sort().map(name=>[name,fs.readFileSync(path.join(templateRoot,name),'utf8')]));
 fs.writeFileSync(path.join(generated,'wildlands-godot-templates.json'),JSON.stringify(templates));
}
