/* Active-scene scenery projects authored catalog references. It owns no native resources. */
(function(inputRoot:unknown){
 'use strict';
 interface Root {LWSceneProps?:{read(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Prop[];exterior(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Prop[];room(engine:LWContentPorts.ScenarioEngine,buildingId:string):{floorId:string;props:LWSceneGraph.Prop[]}|null};}
 const root=inputRoot as Root;
 function read(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Prop[] {
  const context=engine.scenarioContext;
  const props=context?.journey?.pack.scenes.find(scene=>scene.id===context.sceneId)?.graph?.props??[];
  return props.map(prop=>({...prop}));
 }
 function room(engine:LWContentPorts.ScenarioEngine,buildingId:string):{floorId:string;props:LWSceneGraph.Prop[]}|null{const context=engine.scenarioContext;const binding=context?.journey?.pack.scenes.find(scene=>scene.id===context.sceneId)?.graph?.binding;return binding?.type==='interior'&&binding.buildingId===buildingId?{floorId:binding.floorId,props:read(engine)}:null;}
 function exterior(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Prop[]{const context=engine.scenarioContext;const binding=context?.journey?.pack.scenes.find(scene=>scene.id===context.sceneId)?.graph?.binding;return binding?.type==='interior'?[]:read(engine);}
 const api={read,exterior,room};root.LWSceneProps=api;
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(globalThis);
