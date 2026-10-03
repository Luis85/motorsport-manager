/// <reference path="./construction-contracts.d.ts" />
/* Adapt authored designs onto the existing staged construction authority. */
(function(inputRoot:unknown){
 'use strict';
 interface Constructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 interface Runtime {preview(input:unknown,engine?:LWBalanceRules.Owner):LWConstruction.Preview;previewImprovement(e:LWConstruction.Engine,input:unknown,id:unknown):LWConstruction.Preview;buildingDesign(e:LWConstruction.Engine,id:unknown):LWConstruction.Draft|null;busy(e:LWConstruction.Engine,b:LWConstruction.Building):boolean;construct(e:LWConstruction.Engine,input:unknown,x:unknown,y:unknown):LWPhysicalPorts.ActionResult;improve(e:LWConstruction.Engine,id:unknown,input:unknown):LWPhysicalPorts.ActionResult;options(e:LWConstruction.Engine):LWConstruction.Options;}
 const root=inputRoot as {LW:{APPROACHES:Record<string,{time:number}>};LWConstructionDesigns:LWConstruction.DesignsApi;LWConstructionGeometry:LWConstruction.GeometryApi;LWConstructionRuntime:Runtime;LWConstructionState:{validate(input:unknown,world:LWConstruction.World):LWConstruction.State|undefined};LWContent:{parse(input:unknown,limit:number):unknown};LWScenarioResources:{withResources<T>(resources:LWContentPorts.Resources,work:()=>T):T};LWConstructionIntegration?:unknown};
 const R=root.LWConstructionRuntime,D=root.LWConstructionDesigns,G=root.LWConstructionGeometry;
 function install(Engine:Constructor):void{
  const p=Engine.prototype,total=p.totalCost as LWConstruction.Engine['totalCost'],phases=p.constructionPhases as LWConstruction.Engine['constructionPhases'],finish=p.finishTask as LWConstruction.Engine['finishTask'],placement=p.placementIssue as LWConstruction.Engine['placementIssue'];
  Object.assign(p,{
   constructionOptions(this:LWConstruction.Engine){return R.options(this);},
   previewBuildingDesign(this:LWConstruction.Engine,input:unknown,buildingId?:string){return buildingId?R.previewImprovement(this,input,buildingId):R.preview(input,this);},
   buildingDesign(this:LWConstruction.Engine,id:unknown){return R.buildingDesign(this,id);},
   constructBuildingDesign(this:LWConstruction.Engine,input:unknown,x:unknown,y:unknown){return R.construct(this,input,x,y);},
   improveBuildingDesign(this:LWConstruction.Engine,id:unknown,input:unknown){return R.improve(this,id,input);},
   placementIssue(this:LWConstruction.Engine,kind:string,x:number,y:number){if(G.blockers(this.s).some(t=>t.x===x&&t.y===y))return 'This tile belongs to a building or a reserved footprint.';return placement.call(this,kind,x,y);},
   totalCost(this:LWConstruction.Engine,o:LWConstruction.Order){const d=o.designId?this.s.construction?.designs[o.designId]:undefined;if(!d)return total.call(this,o);
    const previous=o.type==='upgrade'?R.buildingDesign(this,o.buildingId):null;return previous?D.improvementCost(D.validate(previous),d,this):D.cost(d,this);
   },
   constructionPhases(this:LWConstruction.Engine,o:LWConstruction.Order){const d=o.designId?this.s.construction?.designs[o.designId]:undefined;if(!d)return phases.call(this,o);
    const rows=D.phases(d,this).map(row=>({...row,cost:{} as Record<string,number>,time:row.time*(root.LW.APPROACHES[o.approach||'balanced']?.time||1)}));
    for(const [id,n]of Object.entries(this.totalCost(o)))rows[['stone','clay','bricks'].includes(id)?0:['wood','planks','beams','iron','rope'].includes(id)?1:2]!.cost[id]=n;return rows;
   },
   finishTask(this:LWConstruction.Engine,t:LWApplication.Task){const order=this.actor.orders.find(o=>o.id===t.orderId),d=order?.designId?this.s.construction?.designs[order.designId]:undefined;
    if(d&&order?.type==='upgrade'&&order.stage===2){const building=this.s.buildings.find(b=>b.id===order.buildingId);if(building&&R.busy(this,building)){this.actor.task=null;this.log('The completed improvement waits for this building to be vacant.','plan');return;}}
    finish.call(this,t);
    if(d&&order&&!this.actor.orders.some(o=>o.id===order.id)){const b=this.s.buildings.find(b=>b.kind===order.kind&&b.x===order.x&&b.y===order.y);if(b){b.designId=d.id;b.door={dx:0,dy:1};}}
   }
  });
  const importer=Engine.import;
  Engine.import=function(input:unknown):unknown{
   const nativeDoc=root.LWContent.parse(input,12*1024*1024) as {state?:LWConstruction.World & {scenarioResources?:LWContentPorts.Resources}};
   const validate=():LWConstruction.Engine=>{
    if(nativeDoc.state)root.LWConstructionState.validate(nativeDoc.state.construction,nativeDoc.state);
    const result=Reflect.apply(importer,this,[nativeDoc]) as LWConstruction.Engine;root.LWConstructionState.validate(result.s.construction,result.s);
    if(result.s.construction){const issue=G.topologyIssue(result.s);if(issue)throw Error('Construction save: '+issue);}return result;
   };
   return nativeDoc.state?.scenarioResources?root.LWScenarioResources.withResources(nativeDoc.state.scenarioResources,validate):validate();
  };
 }
 root.LWConstructionIntegration=Object.freeze({install});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWConstructionIntegration;
})(globalThis);
