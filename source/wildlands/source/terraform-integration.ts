/// <reference path="./terraform-contracts.d.ts" />
/* Add observational queries and explicit edits without adding simulation phases. */
(function(inputRoot:unknown){
 'use strict';
 interface Constructor extends Function {prototype:Record<string,unknown>;import(input:unknown):unknown;}
 const root=inputRoot as {LWGeography:LWTerraform.Geography;LWTerraformState:LWTerraform.StateApi;LWTerraformRuntime:LWTerraform.RuntimeApi;LWConstructionGeometry:LWConstruction.GeometryApi;LWContent:{parse(input:unknown,limit:number):unknown};LWScenarioResources:{withResources<T>(resources:LWContentPorts.Resources,work:()=>T):T};LWTerraformIntegration?:{install(engine:Constructor):void}};
 function install(Engine:Constructor):void{
  Object.assign(Engine.prototype,{
   terrainAt(this:LWTerraform.Engine,x:number,y:number){return root.LWGeography.terrainAt(this.s,x,y);},
   terrainHeight(this:LWTerraform.Engine,x:number,y:number){return root.LWGeography.heightAt(this.s,x,y);},
   terraformSnapshot(this:LWTerraform.Engine){return root.LWTerraformRuntime.snapshot(this);},
   previewTerraform(this:LWTerraform.Engine,input:unknown){return root.LWTerraformRuntime.preview(this,input);},
   applyTerraform(this:LWTerraform.Engine,input:unknown){return root.LWTerraformRuntime.apply(this,input);}
  });
  const importer=Engine.import;
  Engine.import=function(input:unknown):unknown{
   const doc=root.LWContent.parse(input,12*1024*1024) as {state?:LWTerraform.World & {scenarioResources?:LWContentPorts.Resources}};
   const validate=():LWTerraform.Engine=>{
    if(doc.state)root.LWTerraformState.validate(doc.state.terraform,doc.state);
    const result=Reflect.apply(importer,this,[doc]) as LWTerraform.Engine;
    root.LWTerraformState.validate(result.s.terraform,result.s);
    if(result.s.terraform){const issue=root.LWConstructionGeometry.topologyIssue(result.s)||root.LWTerraformRuntime.routeIssue(result.s);if(issue)throw Error('Terraform save: '+issue);}
    return result;
   };
   // Keep all pre/post checks inside the same reversible resource scope as import.
   // withResources restores the original catalog objects, including their revisions.
   return doc.state?.scenarioResources?root.LWScenarioResources.withResources(doc.state.scenarioResources,validate):validate();
  };
 }
 root.LWTerraformIntegration=Object.freeze({install});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWTerraformIntegration;
})(globalThis);
