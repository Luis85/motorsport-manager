/** Offline evidence boards are presentations of supplied artifacts, never executable source imports. */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {emit,writeTextFile} from './cli-io.cjs';
import {schema,limits} from './storyboard-schema.cjs';
import {buildStoryboard} from './storyboard-build.cjs';
export {schema};
export function discover():Record<string,unknown> {
 return {format:'wildlands-storyboard',schemaVersion:1,commands:[
  {command:'storyboard discover',description:'Discover deterministic offline evidence board authoring.'},
  {command:'storyboard schema',description:'Return the strict versioned manifest JSON Schema.'},
  {command:'storyboard build',description:'Compose supplied JSON and PNG/JPEG evidence into one standalone HTML file.',arguments:{'--input':'Storyboard manifest; exclusive with --project','--project':'Portable Wildlands project for an automatic factual overview; exclusive with --input','--output':'New .html destination; exclusive with --dry-run','--dry-run':'Boolean; inspect source identities and proposed HTML hash without writing'}},
 ],limits,layouts:['grid','sequence','comparison'],sourceFormats:['wildlands-project','littlewild-character','littlewild-creature-package','littlewild-definition','littlewild-3d-asset','scene','model','scene-bundle','model-bundle','character-studio-review','review-result','generic-json'],
  reviewEvidence:'Review source cards automatically embed contact sheet and frames relative to the review file, verifying each supplied SHA-256. Reported recipe/render hashes remain review claims, not independently established source bindings.',
  paths:'Every reference is relative to its owning manifest and must resolve beneath the storyboard manifest directory. No absolute paths, parent traversal, URLs or symlink escapes. All assets are embedded; no network or JavaScript.',
  validation:'Presentation only: source facts and authored intent are distinct. No native domain validation, simulation, synthesized screenshots or inferred intent.',
  example:{format:'wildlands-storyboard',schemaVersion:1,title:'Moss companion',intent:'A gentle woodland companion.',layout:'comparison',sections:[{id:'appearance',title:'Appearance',cards:[{id:'recipe',title:'Character intent',source:'moss.recipe.json',intent:'Soft proportions and a sage coat.'},{id:'review',title:'Built result',source:'review/manifest.json',caption:'Fixed camera review of the authored character.'}]}]},
 };
}
function options(args:readonly string[]):Map<string,string> {
 const values=new Map<string,string>();
 for(let index=0;index<args.length;index++){
  const flag=args[index]!;if(!['--input','--project','--output','--dry-run'].includes(flag))throw Error('Unknown storyboard option: '+flag);
  if(values.has(flag))throw Error('Duplicate storyboard option: '+flag);
  if(flag==='--dry-run'){values.set(flag,'true');continue;}
  const value=args[++index];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);values.set(flag,value);
 }
 return values;
}
/** Exclusive link publication preserves existing outputs, including symlink/hardlink aliases. */
function publish(file:string,html:string):string {
 const output=path.resolve(file),temporary=output+'.'+randomUUID()+'.pending';
 if(fs.existsSync(output))throw Error('Storyboard output already exists. Choose a new destination: '+output);
 try{writeTextFile(temporary,html);fs.linkSync(temporary,output);return output;}
 finally{fs.rmSync(temporary,{force:true});}
}
export function run(args:readonly string[]):void {
 try {
  const command=args[0]??'discover';
  if(['discover','--help','-h'].includes(command)){if(args.length>1)throw Error('storyboard discover takes no options.');emit({ok:true,protocolVersion:1,...discover()});return;}
  if(command==='schema'){if(args.length!==1)throw Error('storyboard schema takes no options.');emit({ok:true,protocolVersion:1,schema:schema()});return;}
  if(command!=='build')throw Error('Unknown storyboard command. Use storyboard discover.');
  const values=options(args.slice(1)),input=values.get('--input'),project=values.get('--project'),output=values.get('--output'),dryRun=values.has('--dry-run');
  if(Boolean(input)===Boolean(project))throw Error('Provide exactly one of --input MANIFEST.json or --project PROJECT.json.');
  if(dryRun===Boolean(output))throw Error('Provide exactly one of --dry-run or --output NEW.html.');
  if(output&&!output.toLowerCase().endsWith('.html'))throw Error('Storyboard output must end in .html.');
  if(output&&fs.existsSync(path.resolve(output)))throw Error('Storyboard output already exists. Choose a new destination: '+path.resolve(output));
  const built=buildStoryboard((input??project)!,project?'project':'manifest');
  emit({ok:true,protocolVersion:1,dryRun,output:dryRun?null:publish(output!,built.html),receipt:built.receipt});
 } catch(error){emit({ok:false,protocolVersion:1,code:'storyboard-operation-failed',errors:[error instanceof Error?error.message:String(error)]});process.exitCode=2;}
}
