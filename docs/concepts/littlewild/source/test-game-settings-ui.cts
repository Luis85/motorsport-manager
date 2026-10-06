/* Settings presentation and native change events query the engine and submit independent intents. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

interface Settings {duels:boolean;quests:boolean;}
interface Failure {ok:false;reason:string;}
type IntentResult={ok:true}|Failure;
interface CheckboxTarget {id:string;checked:boolean;hasAttribute(name:string):boolean;}
interface CheckboxEvent {target:CheckboxTarget;}
type CheckboxListener=(event:CheckboxEvent)=>void;
interface EventRegistration {type:string;listener:CheckboxListener;capture:boolean;}
interface Modal {className:string;classList:{add(...names:string[]):void};innerHTML:string;}
interface EventSink {addEventListener(type:string,listener:CheckboxListener):void;}
interface Elements {modal:Modal;'import-file':EventSink;overlay:EventSink;}
interface FixtureEngine {
 s:{name:string;settings:Readonly<Settings&{sound:boolean;follow:boolean;reducedMotion:boolean;highContrast:boolean}>};selected:null;
 gameSettings():Settings;setGameSettings(patch:Partial<Settings>):IntentResult;interactionIssue():null;
}
interface FixtureShell {
 $<K extends keyof Elements>(id:K):Elements[K];engine:FixtureEngine;ui:{modal:'settings'};saveAvailable:boolean;
 extraModalMarkup():string;modalHead():string;modalFooter():string;pauseToggleMarkup():string;esc(value:unknown):string;icon():string;
 colonyUI:{paint():void};progressionUI:{afterRender():void;input(target:CheckboxTarget):boolean;change(target:CheckboxTarget):boolean};
 contentUI:{input(target:CheckboxTarget):boolean;change(target:CheckboxTarget):boolean};
 updateUI(force:boolean):void;save():void;toast(message:string,error:boolean):void;
}
interface FixtureContext {
 LWAdventure:{content:{rules:{abortEnergy:number}}};
 document:{activeElement:null;addEventListener(type:string,listener:CheckboxListener,capture?:boolean):void};window:EventSink;
 LWInterfaceModalContent?:{create(shell:FixtureShell):{renderModal():void}};
 LWInterfaceInput?:{install(shell:FixtureShell):void};
}
const results:{name:string;passed:boolean;error?:string}[]=[];
function test(name:string,work:()=>void):void{try{work();results.push({name,passed:true});}catch(error){results.push({name,passed:false,error:error instanceof Error?error.stack||error.message:String(error)});}}
function fixture(initial:Partial<Settings>={}){
 const value:Settings={duels:initial.duels!==false,quests:initial.quests!==false};
 const commands:Partial<Settings>[]=[],feedback:{message:string;error:boolean}[]=[],updates:boolean[]=[],events:EventRegistration[]=[],trace:string[]=[];
 let saves=0,rejection:Failure|null=null;
 const modal:Modal={className:'',classList:{add(){}},innerHTML:''};
 const elements:Elements={modal,'import-file':{addEventListener(){}},overlay:{addEventListener(){}}};
 const engine:FixtureEngine={s:{name:'Pip',settings:Object.freeze({duels:false,quests:false,sound:false,follow:false,reducedMotion:false,highContrast:false})},selected:null,
  gameSettings:()=>({...value}),setGameSettings:patch=>{trace.push('intent');commands.push({...patch});if(rejection)return rejection;Object.assign(value,patch);return{ok:true};},interactionIssue:()=>null};
 const context:FixtureContext={LWAdventure:{content:{rules:{abortEnergy:7}}},document:{activeElement:null,addEventListener:(type,listener,capture=false)=>events.push({type,listener,capture})},window:{addEventListener(){}}};
 vm.createContext(context);
 for(const file of['ui-modal-content.js','ui-input.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),context);
 const shell:FixtureShell={$:id=>elements[id],engine,ui:{modal:'settings'},saveAvailable:true,
  extraModalMarkup:()=>'',modalHead:()=>'<h2>Settings & your story</h2>',modalFooter:()=>'',pauseToggleMarkup:()=>'',esc:String,icon:()=>'',
  colonyUI:{paint(){}},progressionUI:{afterRender(){},input:()=>false,change:()=>false},contentUI:{input:()=>false,change:()=>false},
  updateUI:force=>{trace.push('refresh');updates.push(force);},save:()=>{trace.push('save');saves++;},toast:(message,error)=>feedback.push({message,error})};
 assert(context.LWInterfaceModalContent);assert(context.LWInterfaceInput);
 const renderer=context.LWInterfaceModalContent.create(shell);context.LWInterfaceInput.install(shell);
 function change(id:string,checked:boolean):CheckboxTarget{
  const target:CheckboxTarget={id,checked,hasAttribute:()=>false},event=events.find(e=>e.type==='change'&&!e.capture);
  assert(event,'Missing bubbling change listener');event.listener({target});return target;
 }
 return{engine,value,commands,feedback,updates,trace,rules:context.LWAdventure.content.rules,change,render:()=>{renderer.renderModal();return modal.innerHTML;},reject:(result:Failure)=>rejection=result,get saves(){return saves;}};
}
function checkbox(markup:string,id:string):string{const match=markup.match(new RegExp('<input id="'+id+'"[^>]*>'));assert(match,'Missing '+id);return match[0];}

test('Rendering follows the detached query rather than activity flags on the state object',()=>{
 const f=fixture(),before=JSON.stringify(f.engine.s),markup=f.render();
 assert.match(checkbox(markup,'duels-setting'),/type="checkbox" checked/);
 assert.match(checkbox(markup,'quests-setting'),/type="checkbox" checked/);
 assert.match(markup,/<label class="settings-row" for="duels-setting"><div><h4>Friendly duels<\/h4>/);
 assert.match(markup,/<label class="settings-row" for="quests-setting"><div><h4>Quests<\/h4>/);
 assert.match(markup,/ends current paired duels and frees companions/);
 assert.match(markup,/usual timed return, using 7 energy\. Spent provisions stay spent; finds are kept/);
 f.rules.abortEnergy=11;assert.match(f.render(),/usual timed return, using 11 energy\./);
 assert.equal(JSON.stringify(f.engine.s),before);assert.equal(f.commands.length,0);assert.equal(f.saves,0);
});
for(const duels of[true,false])for(const quests of[true,false])test('Independent query states render duels='+duels+' quests='+quests,()=>{
 const f=fixture({duels,quests}),markup=f.render();
 assert.equal(/ checked/.test(checkbox(markup,'duels-setting')),duels);
 assert.equal(/ checked/.test(checkbox(markup,'quests-setting')),quests);
});
for(const setting of['duels','quests'] as const)test(setting+' checkbox submits only its own engine intent and refreshes/saves after success',()=>{
 const f=fixture(),other=setting==='duels'?'quests':'duels',before=JSON.stringify(f.engine.s);
 f.change(setting+'-setting',false);assert.deepEqual(f.commands,[{[setting]:false}]);
 assert.equal(f.value[setting],false);assert.equal(f.value[other],true);assert.deepEqual(f.updates,[true]);assert.equal(f.saves,1);
 assert.deepEqual(f.trace,['intent','refresh','save']);
 f.change(setting+'-setting',true);assert.deepEqual(f.commands,[{[setting]:false},{[setting]:true}]);
 assert.equal(f.value[setting],true);assert.equal(f.value[other],true);assert.equal(f.saves,2);assert.equal(f.feedback.length,0);
 assert.equal(JSON.stringify(f.engine.s),before);
});
for(const setting of['duels','quests'] as const)for(const initial of[true,false])test(setting+' rejection restores current '+initial+' query state and does not save or refresh',()=>{
 const f=fixture({[setting]:initial}),before=JSON.stringify(f.engine.s);f.reject({ok:false,reason:'Review the current story first.'});
 const target=f.change(setting+'-setting',!initial);
 assert.equal(target.checked,initial);assert.deepEqual(f.feedback,[{message:'Review the current story first.',error:true}]);
 assert.deepEqual(f.commands,[{[setting]:!initial}]);assert.equal(f.saves,0);assert.equal(f.updates.length,0);assert.equal(JSON.stringify(f.engine.s),before);
 assert.deepEqual(f.trace,['intent']);
});
test('Rejected intent re-queries the latest engine state before restoring the control',()=>{
 const f=fixture();f.engine.setGameSettings=()=>{f.value.duels=false;return{ok:false,reason:'This story changed.'};};
 const target=f.change('duels-setting',true);assert.equal(target.checked,false);assert.equal(f.saves,0);assert.equal(f.value.quests,true);
});

const passed=results.filter(result=>result.passed).length;
fs.writeFileSync(path.join(__dirname,'game-settings-ui-results.json'),JSON.stringify({passed,total:results.length,results},null,2)+'\n');
console.log(`Game settings UI: ${passed}/${results.length} passed.`);
if(passed!==results.length){for(const result of results.filter(result=>!result.passed))console.error(result.name,result.error);process.exitCode=1;}
