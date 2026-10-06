/// <reference path="./interaction-ui-contracts.d.ts" />
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void){try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack??error.message:String(error)});}}
function fixture(){
 const commands:LittlewildDeveloper.Command[]=[],view:LWInteractionPresentation.View={active:[],history:[],seeks:[]};let redraws=0;
 const engine:LWInteractionPresentation.Engine={selected:{id:'c2'},creatures:[{id:'c1',name:'Pip'},{id:'c2',name:'Fern'}],s:{simTime:10,buildings:[{id:'b1',kind:'shelter',x:1,y:2}],nodes:[{id:'n1',kind:'oak',x:3,y:4}]},
  interactionOptions:(source,target)=>[{id:'friendly-duel',label:'Friendly duel',description:'A friendly contest.',available:source!=='player',reason:'Choose a companion initiator.'}],
  interactionState:()=>structuredClone(view),dispatchCommand:command=>{commands.push(command);return {ok:true};}};
 const context:{document:{getElementById():null};LWWorldContent:{building():{name:string};node():{name:string}};LWInteractions:{all():LWInteractionPresentation.Definition[]};LWInteractionUI?:LWInteractionPresentation.Factory}={document:{getElementById:()=>null},LWWorldContent:{building:()=>({name:'Home'}),node:()=>({name:'Oak'})},LWInteractions:{all:()=>[{id:'friendly-duel',label:'Friendly duel',executor:'duel'}]}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'interaction-ui.js'),'utf8'),context);
 assert(context.LWInteractionUI);
 const ui=context.LWInteractionUI.create({engine:()=>engine,esc:value=>String(value??'').replaceAll('<','&lt;'),modal:()=>null,open:()=>{},redraw:()=>redraws++,result:()=>{}});
 return{commands,view,engine,ui,get redraws(){return redraws;}};
}
const record=():LWInteractionPresentation.Record=>({id:'interaction-1',definitionId:'friendly-duel',sourceId:'c1',target:{scope:'creature',id:'c2'},status:'requested',nextRoundAt:0,reason:null,winnerId:null,round:0,scores:[0,0],rounds:[]});

test('Interaction UI queries preserve authoritative state and expose disabled reasons',()=>{
 const f=fixture(),before=JSON.stringify(f.engine);f.ui.prepare();
 assert.equal(f.ui.state.targetId,'c2');assert.equal(f.ui.state.sourceId,'player');
 const markup=f.ui.render();assert.match(markup,/disabled.*aria-describedby="ci-reason-0"/);assert.match(markup,/Choose a companion initiator/);
 assert.equal(JSON.stringify(f.engine),before);assert.equal(f.commands.length,0);
});
test('Interaction UI routes all scopes through the same request command',()=>{
 const f=fixture();f.ui.prepare();f.ui.change({id:'ci-source',value:'c1'});assert.equal(f.redraws,1);
 for(const[scope,id]of [['creature','c2'],['building','b1'],['node','n1']] as const){
  f.ui.change({id:'ci-scope',value:scope});f.ui.render();f.ui.action('ci-request','friendly-duel');
  assert.equal(JSON.stringify(f.commands.at(-1)),JSON.stringify({id:'request-interaction',args:['friendly-duel','c1',{scope,id}]}));
 }
});
test('Pending response and cancellation controls dispatch the target actor identity',()=>{
 const f=fixture();f.view.active=[record()];assert.match(f.ui.render(),/Answer as Fern/);assert.match(f.ui.render(),/Cancel request/);assert.doesNotMatch(f.ui.render(),/End duel/);
 f.ui.action('ci-accept','interaction-1');f.ui.action('ci-decline','interaction-1');f.ui.action('ci-cancel','interaction-1');
 assert.equal(JSON.stringify(f.commands),JSON.stringify([
  {id:'respond-interaction',actorId:'c2',args:['interaction-1',true]},
  {id:'respond-interaction',actorId:'c2',args:['interaction-1',false]},
  {id:'cancel-interaction',args:['interaction-1']} ]));
 f.view.active=[];f.ui.action('ci-accept','interaction-1');assert.equal(f.commands.length,3);assert.match(f.ui.state.feedback,/no longer waiting/);
});
test('Duel status and receipts show scores, world time and winners without advancing',()=>{
 const f=fixture(),duel:LWInteractionPresentation.Record={...record(),status:'active',round:1,scores:[1,0],nextRoundAt:13,rounds:[{number:1,sourceRoll:{total:9,target:14,margin:5,success:true},targetRoll:{total:6,target:10,margin:4,success:true},winnerId:'c1'}]};
 f.view.active=[duel];let markup=f.ui.render();assert.match(markup,/Next round in 3s/);assert.match(markup,/Pip 1 : 0 Fern/);assert.match(markup,/Pip rolled 9 against 14 · success · margin \+5/);assert.match(markup,/Fern rolled 6 against 10 · success · margin \+4/);assert.match(markup,/larger margin wins/);assert.match(markup,/End duel/);assert.doesNotMatch(markup,/Cancel request/);assert.doesNotMatch(markup,/Answer as Fern/);
 f.view.active=[];f.view.history=[{...duel,status:'completed',winnerId:'c1'}];markup=f.ui.render();assert.match(markup,/Winner: Pip/);assert.doesNotMatch(markup,/Cancel request/);assert.equal(f.engine.s.simTime,10);assert.equal(f.commands.length,0);
 f.ui.reset();assert.equal(f.ui.state.sourceId,'player');assert.equal(f.ui.state.targetId,'');
});
test('Authored margin scoring receipts explain comparisons between missed rolls',()=>{
 const f=fixture();f.engine.interactionDefinitions=()=>({definitions:[{id:'friendly-duel',label:'Margin sparring',executor:'duel',duel:{scoring:'margin'}}]});
 f.view.history=[{...record(),status:'completed',round:1,scores:[1,0],winnerId:'c1',rounds:[{number:1,sourceRoll:{total:12,target:10,margin:-2,success:false},targetRoll:{total:13,target:9,margin:-4,success:false},winnerId:'c1'}]}];
 const markup=f.ui.render();assert.match(markup,/including when both creatures miss/);assert.match(markup,/Equal margins draw/);assert.match(markup,/Pip rolled 12 against 10 · miss · margin -2/);assert.equal(f.commands.length,0);
});
test('Recent moments show the newest eight records in runtime order',()=>{
 const f=fixture();f.view.history=Array.from({length:10},(_,index)=>({...record(),id:'interaction-'+(10-index),status:'completed',reason:'Receipt '+(10-index)}));
 const markup=f.ui.render();assert.match(markup,/Receipt 10/);assert.match(markup,/Receipt 3/);assert.doesNotMatch(markup,/Receipt [12]</);
 assert(markup.indexOf('Receipt 10')<markup.indexOf('Receipt 9'));assert(markup.indexOf('Receipt 4')<markup.indexOf('Receipt 3'));
 assert.equal(f.view.history[0]!.id,'interaction-10');assert.equal(f.view.history.length,10);
});
test('Status and history labels follow the installed interaction library',()=>{
 const f=fixture();f.engine.interactionDefinitions=()=>({definitions:[{id:'friendly-duel',label:'Village sparring match',executor:'duel'}]});
 f.view.active=[record()];f.view.history=[{...record(),status:'completed'}];
 const markup=f.ui.render();assert.equal((markup.match(/<h4>Village sparring match<\/h4>/g)||[]).length,2);
 assert.doesNotMatch(markup.slice(markup.indexOf('<div id="ci-status">')),/<h4>Friendly duel<\/h4>/);
});
test('Player duel encouragement and exact-pair staging route commands without forcing consent',()=>{
 const f=fixture();f.engine.interactionDefinitions=()=>({definitions:[{id:'garden-sparring',label:'Garden sparring',executor:'duel'},{id:'cheer',label:'Cheer',executor:'effects'}]});
 f.engine.interactionOptions=()=>[{id:'garden-sparring',label:'Garden sparring',description:'Garden contest.',available:true,reason:null}];f.ui.prepare();f.ui.change({id:'ci-source',value:'c1'});
 const before=JSON.stringify(f.engine),markup=f.ui.render();assert.match(markup,/Duel style/);assert.match(markup,/Garden sparring/);assert.match(markup,/Encourage Pip to find a duel/);assert.match(markup,/Stage this duel/);assert.match(markup,/does not force acceptance/);assert.match(markup,/invited companion decides/);
 f.ui.action('ci-seek-duel','garden-sparring');f.ui.action('ci-stage-duel','garden-sparring');f.ui.action('ci-cancel-duel-seek','c1');
 assert.equal(JSON.stringify(f.commands),JSON.stringify([{id:'seek-duel',args:['c1','garden-sparring']},{id:'stage-duel',args:['garden-sparring','c1','c2']},{id:'cancel-duel-seek',args:['c1']}]));
 assert.equal(JSON.stringify(f.engine),before);assert.equal(f.engine.s.simTime,10);assert.equal(f.commands.some(c=>c.id==='respond-interaction'),false);
});
test('Duel staging uses authoritative disabled reasons while seeking can wait around work',()=>{
 const f=fixture();f.engine.creatures[0]!.task={kind:'gather'};f.engine.interactionOptions=()=>[{id:'friendly-duel',label:'Friendly duel',description:'A friendly contest.',available:false,reason:'Pip is busy with another task.'}];
 f.ui.prepare();f.ui.change({id:'ci-source',value:'c1'});let markup=f.ui.render();
 assert.match(markup,/data-act="ci-stage-duel"[^>]*disabled[^>]*aria-describedby="ci-stage-reason"/);assert.match(markup,/id="ci-stage-reason"[^>]*>Pip is busy/);
 assert.doesNotMatch(markup,/data-act="ci-seek-duel"[^>]*disabled/);assert.match(markup,/waiting for an opportunity around their ordinary work/);
 f.view.active=[record()];markup=f.ui.render();assert.match(markup,/data-act="ci-seek-duel"[^>]*disabled[^>]*aria-describedby="ci-seek-reason"/);
});
test('Pending duel searches show detached expiry, chosen style and cancellation by actor',()=>{
 const f=fixture();f.view.seeks=[{actorId:'c1',definitionId:'friendly-duel',ruleId:null,created:5,expires:40,nextSearchAt:12}];
 const before=JSON.stringify(f.view),markup=f.ui.render();assert.match(markup,/Pip is looking for a partner/);assert.match(markup,/Friendly duel · Waiting/);assert.match(markup,/Search ends in 30s of world time/);assert.match(markup,/Work and consent still take priority/);assert.match(markup,/data-act="ci-cancel-duel-seek" data-id="c1"/);
 assert.equal(JSON.stringify(f.view),before);assert.equal(f.commands.length,0);
});
test('Settings-disabled duels expose the reason on seek encouragement',()=>{
 const f=fixture();f.engine.gameSettings=()=>({duels:false});f.ui.prepare();f.ui.change({id:'ci-source',value:'c1'});const markup=f.ui.render();
 assert.match(markup,/data-act="ci-seek-duel"[^>]*disabled[^>]*aria-describedby="ci-seek-reason"/);assert.match(markup,/Duels are disabled in Settings\./);assert.equal(f.commands.length,0);
});
test('Delegated physical interactions report a task start instead of premature completion',()=>{
 const f=fixture();f.engine.dispatchCommand=command=>{f.commands.push(command);return {ok:true,taskStarted:true};};f.ui.prepare();f.ui.action('ci-request','gather');
 assert.equal(f.ui.state.feedback,'The creature will begin this task.');f.view.history=[{...record(),status:'delegated'}];assert.match(f.ui.render(),/Task started/);assert.doesNotMatch(f.ui.state.feedback,/completed/);
});
const passed=results.filter(result=>result.passed).length;
fs.writeFileSync(path.join(__dirname,'interaction-ui-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(`Interaction UI: ${passed}/${results.length} passed.`);
if(passed!==results.length){for(const result of results.filter(result=>!result.passed))console.error(result.name,result.error);process.exitCode=1;}
