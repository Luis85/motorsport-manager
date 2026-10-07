/** Runnable typed headless example: scene -> command -> deterministic steps -> portable checkpoint. */
import {toolbox} from '../developer-sdk.cjs';
import {emit,writeJsonFile} from './cli-io.cjs';
const usage='npm run toolbox -- [--scenario littlewild|emberworks] [--scene scene-id] [--seconds 5] [--story-output /tmp/story.json]';
function options(args:readonly string[]):{scenarioId:string;sceneId?:string;seconds:number;output?:string} {
 const values=new Map<string,string>();
 for(let index=0;index<args.length;index++){
  const flag=args[index];
  if(!flag||!['--scenario','--scene','--seconds','--story-output'].includes(flag))throw Error('Unknown option. '+usage);
  if(values.has(flag))throw Error('Duplicate option: '+flag);
  const value=args[++index];if(!value||value.startsWith('--'))throw Error('Missing value for '+flag);
  values.set(flag,value);
 }
 const seconds=Number(values.get('--seconds')??5);
 if(!Number.isFinite(seconds)||seconds<0||seconds>3600||Math.abs(seconds*10-Math.round(seconds*10))>1e-9)throw Error('Seconds must be a multiple of 0.1 from 0 to 3600.');
 const out:{scenarioId:string;sceneId?:string;seconds:number;output?:string}={scenarioId:values.get('--scenario')??'littlewild',seconds};
 const scene=values.get('--scene'),output=values.get('--story-output');
 if(scene!==undefined)out.sceneId=scene;if(output!==undefined)out.output=output;
 return out;
}
try {
 const args=process.argv.slice(2);
 if(args.length===1&&['--help','-h'].includes(args[0]!))emit({ok:true,usage});
 else {
  const config=options(args),create=config.sceneId===undefined?{scenarioId:config.scenarioId}:{scenarioId:config.scenarioId,sceneId:config.sceneId};
  const session=toolbox.create(create);
  try {
   const actor=session.inspect().actors[0];if(!actor)throw Error('This scene has no creature.');
   const command=session.command({id:'set-stock-target',actorId:actor.id,args:['berries',4]});
   if(!command.ok)throw Error(command.reason??'The stock-target command was rejected.');
   session.start();const step=session.advance(config.seconds),snapshot=session.inspect();
   if(config.output)writeJsonFile(config.output,session.story());
   emit({ok:true,scenarioId:snapshot.scenarioId,sceneId:snapshot.sceneId,step,actors:snapshot.actors,storyOutput:config.output??null});
  }finally{session.dispose();}
 }
}catch(error){emit({ok:false,errors:[error instanceof Error?error.message:String(error)]});process.exitCode=1;}
