/// <reference path="../engine-export-contracts.d.ts" />
/** Trusted build-only inventory. Source strings are never evaluated by the exporter. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {INSERTS} from './build-inserts.cjs';
import {BUNDLED_GAMES, gameDirectory, loadGame} from './game-folder.cjs';
import {sourceLoader} from './engine-sources.cjs';
export {inlineVendorScripts} from './engine-sources.cjs';
const compare=(a:string,b:string):number=>a<b?-1:a>b?1:0;
const digest=(text:string|Uint8Array):string=>createHash('sha256').update(text).digest('hex');
function walk(directory:string):string[]{return fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>compare(a.name,b.name)).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):entry.isFile()?[path.join(directory,entry.name)]:[]);}
function dependencies(text:string,file:string):string[]{
 if(!/\.[cm]?tsx?$/.test(file))return [];
 const out=new Set<string>(),tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
 function visit(node:ts.Node):void{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))out.add(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='require'&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))out.add(node.arguments[0].text);
  ts.forEachChild(node,visit);
 }
 visit(tree);for(const reference of tree.referencedFiles)out.add(reference.fileName);return [...out].sort();
}
/** Installed compiler packages copied as the rebuild toolchain; everything else stays locked metadata. */
const TOOLCHAIN=['typescript','@types/node','undici-types'] as const;
/** The compiler API module: `executeCommandLine` from it is tsc, so the duplicate `_tsc.js` command bundle is not needed. */
const COMPILER='typescript/lib/typescript.js';
/**
 * Declarations the project's own compiler configurations load: every tsconfig*.json is opened with
 * a virtual root that imports the compiler API (as the build tools do), so the result is exactly its
 * lib.*.d.ts closure, the configured `types` and the compiler declarations. Localized diagnostics,
 * unused libraries, tsserver/typings installers and typesVersions fallbacks are never loaded.
 */
function loadedDeclarations(project:string):Set<string>{
 const loaded=new Set<string>(),cache=new Map<string,ts.SourceFile|undefined>(),probe=path.join(project,'source','__toolchain-probe__.cts');
 for(const name of fs.readdirSync(project).filter(entry=>/^tsconfig[^/]*\.json$/.test(entry)).sort()){
  const config=ts.readConfigFile(path.join(project,name),ts.sys.readFile);
  if(config.error)throw Error('Unreadable compiler configuration '+name+'.');
  const options={...ts.parseJsonConfigFileContent(config.config,ts.sys,project,undefined,name).options,noEmit:true},host=ts.createCompilerHost(options),read=host.getSourceFile.bind(host);
  host.getSourceFile=(file,language)=>{
   if(file===probe)return ts.createSourceFile(file,"import 'typescript';\n",language);
   const key=file+'\0'+JSON.stringify(language);if(!cache.has(key))cache.set(key,read(file,language));return cache.get(key);
  };
  for(const file of ts.createProgram({rootNames:[probe],options,host}).getSourceFiles())if(file.fileName!==probe)loaded.add(path.resolve(file.fileName));
 }
 return loaded;
}
function role(file:string):LWEngineExport.SourceFile['role']{if(/\.(zip|tgz|gz)$/i.test(file))return 'source-archive';if(/LICENSE|COPYING/i.test(file))return 'license';if(file.startsWith('toolchain/'))return 'toolchain';if(file.startsWith('vendor/'))return 'vendor';if(file.endsWith('.d.ts'))return 'contract';if(file.includes('.schema.json')||file.includes('/schemas/'))return 'schema';if(file.endsWith('.json'))return file.startsWith('source/')||file.startsWith('games/')?'data':'configuration';if(file.endsWith('.md'))return 'documentation';return 'source';}
export function createSourceBundle(project:string):LWEngineExport.SourceBundle{
 const candidates:{file:string;relative:string}[]=[],excluded:string[]=['*.md outside source/vendor/games (manuals and release evidence distributed separately)','generated artifacts and suite-result evidence, credentials and repository internals'];
 for(const file of walk(path.join(project,'source'))){
  const relative=path.relative(project,file).replaceAll(path.sep,'/');
  // Match the gate's ignored suite outputs; their presence cannot change an artifact.
  if(/^source\/[^/]+-results\.json$/.test(relative))continue;
  if(/(^|\/)test[^/]*\.|\/verification\//.test(relative)){excluded.push(relative);continue;}
  candidates.push({file,relative});
 }
 for(const file of walk(path.join(project,'vendor')))candidates.push({file,relative:path.relative(project,file).replaceAll(path.sep,'/')});
 // Bundled game folders the build composes (data only, closed inventory) at games/<id>/; rebuild with WILDLANDS_GAMES_DIR=<extracted>/games.
 for(const id of BUNDLED_GAMES){const game=loadGame(gameDirectory(id));for(const entry of game.files)candidates.push({file:path.join(game.root,entry.path),relative:'games/'+id+'/'+entry.path});}
 for(const name of fs.readdirSync(project).sort()){if(/^(package(-lock)?\.json|tsconfig[^/]*\.json)$/.test(name))candidates.push({file:path.join(project,name),relative:name});}
 const repositoryLicense=path.resolve(project,'../..','LICENSE');if(fs.existsSync(repositoryLicense)&&fs.readFileSync(repositoryLicense,'utf8')!==fs.readFileSync(path.join(project,'source/ENGINE-LICENSE.txt'),'utf8'))throw Error('Update the gate-covered engine license copy before rebuilding.');
 const loaded=loadedDeclarations(project);
 for(const name of TOOLCHAIN){const directory=path.join(project,'node_modules',name);for(const file of walk(directory)){
  const relative=path.relative(directory,file).replaceAll(path.sep,'/'),published='toolchain/'+name+'/'+relative;
  if(loaded.has(path.resolve(file))||relative==='package.json'||/LICENSE|NOTICE/i.test(relative)||name+'/'+relative===COMPILER)candidates.push({file,relative:published});
  // Recorded individually so the trimmed toolchain stays an explicit, reviewable inventory.
  else if(/\.(js|d\.ts|json)$/i.test(relative))excluded.push(published);
 }}
 const files=candidates.sort((a,b)=>compare(a.relative,b.relative)).map(({file,relative})=>{const raw=fs.readFileSync(file),encoding:LWEngineExport.SourceFile['encoding']=/\.(zip|tgz|gz|png|jpg|webp|wasm|bin)$/i.test(relative)?'base64':'utf8',text=encoding==='base64'?raw.toString('base64'):new TextDecoder('utf-8',{fatal:true}).decode(raw);return {path:relative,encoding,role:role(relative),bytes:raw.byteLength,sha256:digest(raw),text,dependencies:encoding==='utf8'?dependencies(text,relative):[]};});
 const source=(name:string)=>files.find(file=>file.path===name)?.text??'';
 const architecture:Record<string,unknown>={projectLicense:{spdx:'MIT',copyright:'Copyright (c) 2026 Luis Mendez',source:'source/ENGINE-LICENSE.txt',provenance:'../../LICENSE; build verifies matching text when repository root is present'}};for(const file of files.filter(file=>file.path.startsWith('source/architecture/')&&file.path.endsWith('.json')))architecture[path.basename(file.path,'.json')]=JSON.parse(file.text) as unknown;
 const browserOrder=INSERTS.filter(insert=>insert[2]==='script').map(insert=>insert[1]);
 const packageData=JSON.parse(source('package.json')) as {dependencies?:Record<string,unknown>;devDependencies?:Record<string,unknown>};
 return {format:'littlewild-engine-sources',schemaVersion:1,identity:digest(files.map(file=>file.path+'\0'+file.sha256+'\n').join('')),files,inventory:{included:files.map(file=>file.path),excluded:excluded.sort(),policy:'All authoritative source, contracts, data, schemas, build tools, the bundled game folders (games/<id>, rebuilt with WILDLANDS_GAMES_DIR), offline vendors, gate-covered source/vendor documentation and a trimmed installed toolchain: the TypeScript compiler API module (its executeCommandLine is tsc) with exactly the library, Node and Undici declarations the project tsconfig files load, plus package manifests and licenses; other build dependencies remain exact locked metadata; excludes tests, generated suite results and browser verification evidence, generated artifacts, unloaded toolchain files (localized diagnostics, unused libraries, tsserver, the duplicate _tsc.js command bundle, typesVersions fallbacks), node_modules outside the named toolchain, credentials and repository internals.'},architecture,build:{browserOrder,compiler:'toolchain/'+COMPILER,dependencies:{...packageData.dependencies,...packageData.devDependencies}}};
}
export function writeSourceBundle(project:string,generated:string):LWEngineExport.SourceLoader{
 const bundle=createSourceBundle(project),text=JSON.stringify(bundle),loader=sourceLoader(bundle);
 if(Buffer.byteLength(text)>64*1024*1024)throw Error('Engine source bundle exceeds64MiB.');
 fs.mkdirSync(generated,{recursive:true});fs.writeFileSync(path.join(generated,'engine-source-bundle.json'),text);fs.writeFileSync(path.join(generated,'engine-source-loader.json'),JSON.stringify(loader)+'\n');return loader;
}
