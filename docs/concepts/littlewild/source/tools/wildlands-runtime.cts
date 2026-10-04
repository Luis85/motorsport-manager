import {once} from 'node:events';
import {WildlandsRuntime,MAX_REQUEST_BYTES,MAX_RESPONSE_BYTES,type RuntimeOptions,type RuntimeResponse} from '../wildlands-runtime.cjs';
import {readJsonFile} from './cli-io.cjs';

const usage='node runtime/tools/wildlands-runtime.cjs [--project file | --pack file | --scenario id] [--scene id] [--stdio]';
function options(args:readonly string[]):RuntimeOptions {
 const values=new Map<string,string>();
 for(let index=0;index<args.length;index++){
  const flag=args[index]!;
  if(flag==='--stdio')continue;
  if(!['--project','--pack','--scenario','--scene'].includes(flag)||values.has(flag))throw Error('Unknown or duplicate option: '+flag);
  const value=args[++index];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);values.set(flag,value);
 }
 if(['--project','--pack','--scenario'].filter(flag=>values.has(flag)).length>1)throw Error('Choose exactly one of --project, --pack or --scenario.');
 if(values.has('--project')&&values.has('--scene'))throw Error('--project retains its own scene; use session.create to select another.');
 const result:RuntimeOptions={};
 if(values.has('--project'))result.project=readJsonFile(values.get('--project')!,MAX_REQUEST_BYTES);
 if(values.has('--pack'))result.pack=readJsonFile(values.get('--pack')!,MAX_REQUEST_BYTES);
 if(values.has('--scenario'))result.scenarioId=values.get('--scenario')!;
 if(values.has('--scene'))result.sceneId=values.get('--scene')!;
 return result;
}
function failure(message:string,code='invalid-input'):RuntimeResponse {return {id:null,ok:false,error:{code,message}};}
async function write(response:RuntimeResponse):Promise<void> {
 let line=JSON.stringify(response)+'\n';
 if(Buffer.byteLength(line)>MAX_RESPONSE_BYTES)line=JSON.stringify({id:response.id,ok:false,error:{code:'response-too-large',message:'Response exceeds 64 MiB. Use a narrower query.'}})+'\n';
 if(!process.stdout.write(line))await once(process.stdout,'drain');
}
async function run(runtime:WildlandsRuntime):Promise<void> {
 let parts:Buffer[]=[],size=0,oversized=false;
 const accept=async():Promise<void>=>{
  if(oversized)await write(failure('Request exceeds 64 MiB.','request-too-large'));
  else if(size){
   try {const line=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts,size));await write(await runtime.execute(line));}
   catch(error){await write(failure(error instanceof Error?error.message:String(error)));}
  }
  parts=[];size=0;oversized=false;
 };
 // Consume one stream chunk at a time; bounded line accumulation and stdout backpressure
 // prevent either peer from growing an unbounded request/response queue.
 for await(const value of process.stdin){
  const chunk=Buffer.isBuffer(value)?value:Buffer.from(value as string);let cursor=0;
  while(cursor<chunk.length){
   const newline=chunk.indexOf(10,cursor),end=newline===-1?chunk.length:newline;
   const length=end-cursor;
   if(!oversized){
    if(size+length>MAX_REQUEST_BYTES){parts=[];size=0;oversized=true;}
    else if(length){parts.push(chunk.subarray(cursor,end));size+=length;}
   }
   if(newline===-1)break;
   await accept();if(runtime.stopped)return;cursor=end+1;
  }
 }
 if(size||oversized)await accept();
}
async function main():Promise<void> {
 let runtime:WildlandsRuntime|undefined;
 try {
  const args=process.argv.slice(2);
  if(args.length===1&&['--help','-h'].includes(args[0]!)){process.stdout.write(JSON.stringify({ok:true,usage,protocol:{request:{id:1,method:'discover',params:{}},response:{id:1,ok:true,result:{}}}})+'\n');return;}
  if(Number(process.versions.node.split('.')[0])<22)throw Error('Wildlands runtime requires Node.js 22 or later.');
  runtime=new WildlandsRuntime(options(args));await run(runtime);
 }catch(error){process.stderr.write('Wildlands runtime failed: '+(error instanceof Error?error.message:String(error))+'\n');process.exitCode=1;}
 finally{runtime?.dispose();}
}
process.stdout.on('error',error=>{if((error as NodeJS.ErrnoException).code==='EPIPE')process.exit(0);});
void main();
