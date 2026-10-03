/** Bounded source audit: each declared tuner must have a real documented domain consumer. */
import fs from 'node:fs';
import path from 'node:path';
interface Entry {path:string;source:string;consumer:string;occurrences:number;}
export function auditBalancing(sourceRoot:string):string[]{
 const issues:string[]=[],balance=JSON.parse(fs.readFileSync(path.join(sourceRoot,'content/balancing.json'),'utf8')) as {simulation:{rules:{gameplay:Record<string,Record<string,number>>}}};
 const inventory=JSON.parse(fs.readFileSync(path.join(sourceRoot,'content/balancing-inventory.json'),'utf8')) as {tuners:Entry[]};
 const declared=new Set(Object.entries(balance.simulation.rules.gameplay).flatMap(([group,keys])=>Object.keys(keys).map(key=>'/simulation/rules/gameplay/'+group+'/'+key)));
 const seen=new Set<string>(),files=fs.readdirSync(sourceRoot).filter(file=>file.endsWith('.ts')&&!file.startsWith('test-')&&!file.endsWith('.d.ts'));
 for(const file of files){
  const source=fs.readFileSync(path.join(sourceRoot,file),'utf8');if(Buffer.byteLength(source)>256*1024)throw Error('Balance audit source budget exceeded.');
  for(const match of source.matchAll(/B\.forEngine\((?:this|engine)\)\.([a-zA-Z]+)\.([a-zA-Z]+)/g)){
   const consumer=match[0],location='/simulation/rules/gameplay/'+match[1]+'/'+match[2];seen.add(location);
   if(!declared.has(location))issues.push(file+': undeclared gameplay consumer '+location);
   if(!inventory.tuners.some(row=>row.path===location&&row.source===file&&row.consumer===consumer))issues.push(file+': undocumented gameplay consumer '+location);
  }
 }
 for(const location of declared)if(!seen.has(location))issues.push('Declared tuner has no runtime consumer: '+location);
 for(const row of inventory.tuners){
  if(!files.includes(row.source)){issues.push('Inventory source is not an authoritative module: '+row.source);continue;}
  const source=fs.readFileSync(path.join(sourceRoot,row.source),'utf8'),count=source.split(row.consumer).length-1;
  if(count!==row.occurrences)issues.push(row.source+': consumer occurrence inventory changed for '+row.path+' ('+count+' != '+row.occurrences+')');
 }
 return [...new Set(issues)];
}
if(require.main===module){const issues=auditBalancing(path.resolve(__dirname,'../../source'));console.log(JSON.stringify({ok:issues.length===0,errors:issues},null,2));if(issues.length)process.exitCode=1;}
