import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
type Data=Record<string,any>;
type Run=(args:string[])=>{status:number|null;out:Record<string,unknown>};
type Test=(name:string,work:()=>void)=>void;
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64');
const sha=(value:Buffer)=>createHash('sha256').update(value).digest('hex');

/** Exercise the public executable protocol; fixture files remain external authored inputs. */
export function storyboardChecks(test:Test,run:Run,directory:string,project:string):void {
 const root=path.join(directory,'storyboards');fs.mkdirSync(root);
 const file=(name:string)=>path.join(root,name);
 const json=(name:string,value:unknown)=>{const target=file(name);fs.writeFileSync(target,JSON.stringify(value));return target;};
 const base=():Data=>({format:'wildlands-storyboard',schemaVersion:1,title:'Character delivery',intent:'Keep authored intent separate from evidence.',sections:[{id:'overview',title:'Built assets',cards:[{id:'project',title:'Native project',source:'project.json',intent:'Provide a home for this companion.'}]}]});
 const build=(input:string,out?:string)=>run(['storyboard','build','--input',input,...out?['--output',out]:['--dry-run']]);
 const successful=(result:ReturnType<Run>):Data=>{assert.equal(result.status,0,JSON.stringify(result));assert.equal(result.out.ok,true);return result.out.receipt as Data;};
 fs.copyFileSync(project,file('project.json'));

 test('Storyboard CLI deterministically composes native, Studio and Forge facts separately from declared intent',()=>{
  assert.equal(run(['storyboard','discover']).status,0);assert.equal(run(['storyboard','schema']).status,0);
  const native=JSON.parse(fs.readFileSync(project,'utf8')) as Data;
  json('character.json',{format:'littlewild-character',schemaVersion:1,id:'moss',identity:{name:'Moss',pronouns:'they/them',gender:'',voice:'Soft'},appearance:{preset:'pip',body:'balanced',ears:'round',coat:'#caa273',belly:'#eed8b4',inner:'#c98f79',tail:'short',headSize:1,earSize:1,eyeSize:1,eyeColor:'#303f37'},personality:'curious',skills:{},outfits:{head:null,body:null,back:null,feet:null,tool:null,charm:null},locks:[],status:'draft'});
  json('scene.json',{schemaVersion:1,kind:'scene',id:'garden',name:'Garden',materials:{coat:{color:'#caa273'}},geometries:{body:{type:'sphere',radius:1}},nodes:[{id:'body',type:'mesh',geometry:'body',material:'coat'}]});
  const plan=base();plan.sections[0].cards.push({id:'character',title:'Companion recipe',source:'character.json',intent:'A gentle woodland friend.'},{id:'scene',title:'Refined model scene',source:'scene.json'});
  const before=fs.readFileSync(project);
  const hashes=new Set<string>();
  for(const layout of ['grid','sequence','comparison']) {
   plan.layout=layout;const input=json('plan.json',plan),first=file(layout+'.html'),second=file(layout+'-again.html');
   const receipt=successful(build(input,first));successful(build(input,second));
   assert.deepEqual(fs.readFileSync(first),fs.readFileSync(second));assert.equal(receipt.html.sha256,sha(fs.readFileSync(first)));assert.equal(receipt.html.bytes,fs.statSync(first).size);
   assert.equal(receipt.layout,layout);assert.equal(receipt.sectionCount,1);assert.equal(receipt.cardCount,3);assert.equal(receipt.cards.length,3);assert.equal(receipt.validation,'presentation-only');
   for(const card of receipt.cards){assert(card.sourceKind);assert(Array.isArray(card.facts)&&card.facts.length>0);assert(!JSON.stringify(card.facts).includes('A gentle woodland friend.'));}
   assert(JSON.stringify(receipt.cards[0].facts).includes(native.id));assert(JSON.stringify(receipt.cards[1].facts).includes('Moss'));assert(JSON.stringify(receipt.cards[2].facts).includes('garden'));
   const nativeFacts=new Map(receipt.cards[0].facts.map((fact:Data)=>[fact.label,fact.value]));
   assert.equal(nativeFacts.get('Scenes'),String(native.pack.scenes.length));assert.equal(nativeFacts.get('Worlds'),String(native.pack.worlds.length));
   assert.equal(nativeFacts.get('Archetypes'),String((native.pack.resources?.creatures??native.game.profile.creatures).definitions.length));assert.equal(nativeFacts.get('Project scene'),native.sceneId);
   const html=fs.readFileSync(first,'utf8');assert.match(html,/Intent/);assert.match(html,/Source facts/);assert.match(html,/No capture supplied/);assert.match(html,/A gentle woodland friend\./);hashes.add(receipt.html.sha256);
  }
  assert.equal(hashes.size,3);assert.deepEqual(fs.readFileSync(project),before);
  const legacy=structuredClone(native);legacy.schemaVersion=1;delete legacy.game;delete legacy.pack.resources;
  json('legacy.json',legacy);const legacyPlan=base();legacyPlan.sections[0].cards[0].source='legacy.json';
  const legacyReceipt=successful(build(json('legacy-plan.json',legacyPlan)));assert(!legacyReceipt.cards[0].facts.some((fact:Data)=>fact.label==='Archetypes'),'Missing catalog data must not be reported as zero.');
 });

 test('Storyboard CLI embeds verified review images and escapes untrusted text without executable HTML',()=>{
  fs.mkdirSync(file('review'));fs.writeFileSync(file('review/front.png'),png);
  json('review/manifest.json',{format:'character-studio-review',schemaVersion:1,characterId:'moss',recipeHash:'a'.repeat(64),contactSheet:{file:'front.png',sha256:sha(png)},frames:[{id:'front',file:'front.png',sha256:sha(png)}]});
  const malicious='</script><script>alert("owned")</script><img src=x onerror=alert(1)>';
  json('details.json',{description:malicious});
  const plan=base();plan.title=malicious;plan.intent=malicious;plan.sections[0].cards=[{id:'look',title:malicious,source:'review/manifest.json',caption:malicious},{id:'details',title:'Supplied details',source:'details.json'}];
  const input=json('images.json',plan),output=file('images.html'),receipt=successful(build(input,output));
  const html=fs.readFileSync(output,'utf8');assert(html.includes('data:image/png;base64,'+png.toString('base64')));assert(!html.includes(malicious));assert.match(html,/&lt;script&gt;/);assert(!/<script\b|<iframe\b|\bonerror\s*=/i.test(html.replace(/&lt;[^\n]*?&gt;/g,'')));assert(!/<(?:img|link)\b[^>]*(?:src|href)=["']https?:/i.test(html));
  assert(receipt.cards[0].images.length>0);assert(receipt.cards[0].images.every((image:Data)=>image.hashVerified===true&&image.sha256===sha(png)));
  const review=JSON.parse(fs.readFileSync(file('review/manifest.json'),'utf8'));review.frames[0].sha256='0'.repeat(64);json('review/manifest.json',review);
  const rejected=build(input,file('tampered.html'));assert.equal(rejected.status,2);assert.match(JSON.stringify(rejected.out),/hash|sha-?256/i);assert(!fs.existsSync(file('tampered.html')));
 });

 test('Storyboard CLI rejects invalid schema, escaping references and oversized inputs with structured diagnostics',()=>{
  const invalid:unknown[]=[null,{}, {...base(),extra:true},{...base(),schemaVersion:2},{...base(),title:''},{...base(),layout:'arbitrary'}, {...base(),sections:[]},{...base(),sections:Array.from({length:13},(_,i)=>({id:'section-'+i,title:'Section',cards:[{id:'card-'+i,title:'Card',intent:'Intent'}]}))}];
  const duplicate=base();duplicate.sections[0].cards.push({...duplicate.sections[0].cards[0]});invalid.push(duplicate);
  const empty=base();empty.sections[0].cards=[{id:'empty',title:'Empty'}];invalid.push(empty);
  const nestedUnknown=base();nestedUnknown.sections[0].cards[0].execute='alert(1)';invalid.push(nestedUnknown);
  const tooMany=base();tooMany.sections[0].cards=Array.from({length:49},(_,i)=>({id:'card-'+i,title:'Card',intent:'Intent'}));invalid.push(tooMany);
  for(const [index,value] of invalid.entries()) {const result=build(json('invalid-'+index+'.json',value),file('invalid-'+index+'.html'));assert.equal(result.status,2,JSON.stringify(value));assert.equal(result.out.code,'storyboard-operation-failed');assert(Array.isArray(result.out.errors));assert(!fs.existsSync(file('invalid-'+index+'.html')));}
  fs.symlinkSync(project,file('outside.json'));
  for(const reference of ['../project.json',project,'outside.json','https://example.test/source.json']) {const plan=base();plan.sections[0].cards[0].source=reference;assert.equal(build(json('path.json',plan)).status,2,reference);}
  fs.writeFileSync(file('oversized.json'),' '.repeat(1024*1024+1));assert.equal(build(file('oversized.json')).status,2);
  fs.writeFileSync(file('large-source.json'),' '.repeat(10*1024*1024+1));const large=base();large.sections[0].cards[0].source='large-source.json';assert.equal(build(json('large-plan.json',large)).status,2);
  fs.writeFileSync(file('fake.png'),'<svg onload="alert(1)"></svg>');const image=base();image.sections[0].cards[0].image='fake.png';assert.equal(build(json('invalid-image.json',image)).status,2);
  fs.writeFileSync(file('fake.png'),png.subarray(0,33));assert.equal(build(file('invalid-image.json')).status,2,'A PNG header alone is not a complete capture.');
  fs.writeFileSync(file('fake.png'),Buffer.alloc(8*1024*1024+1));assert.equal(build(file('invalid-image.json')).status,2);
  assert.equal(run(['storyboard','build','--unknown','yes']).status,2);
 });

 test('Storyboard CLI dry runs and new-only atomic publication preserve inputs and existing outputs',()=>{
  const input=json('publish.json',base()),before=fs.readFileSync(input),native=fs.readFileSync(project),output=file('published.html');
  const dry=build(input);const dryReceipt=successful(dry);assert.equal(dry.out.dryRun,true);assert.equal(dry.out.output,null);assert(!fs.existsSync(output));
  const published=build(input,output);const receipt=successful(published);assert.equal(receipt.html.sha256,dryReceipt.html.sha256);const original=fs.readFileSync(output);
  assert.equal(build(input,output).status,2);assert.deepEqual(fs.readFileSync(output),original);
  const alias=file('input-alias.html');fs.linkSync(input,alias);assert.equal(build(input,alias).status,2);assert.deepEqual(fs.readFileSync(input),before);
  assert.equal(run(['storyboard','build','--input',input,'--dry-run','--output',output]).status,2);
  assert.equal(run(['storyboard','build','--input',input,'--project',project,'--dry-run']).status,2);
  const auto=file('project-overview.html');successful(run(['storyboard','build','--project',project,'--output',auto]));assert.match(fs.readFileSync(auto,'utf8'),/No capture supplied/);assert.deepEqual(fs.readFileSync(project),native);
  const fresh=successful(run(['storyboard','build','--project',project,'--dry-run']));assert.equal(fresh.html.sha256,sha(fs.readFileSync(auto)));
  assert(!fs.readdirSync(root).some(name=>/\.(pending|tmp)$/.test(name)));
 });
}
