/* The only place that establishes simulation feature order. */
(function(inputRoot: unknown){
 'use strict';

 interface EngineCompositionApi { finalize(layers: readonly string[]): void; }
 interface SimulationProfileApi { assertRuntime(): void; }
 interface CommandRouterApi { install(engine: Function): unknown; }
 interface LittlewildFacade { EngineComposition?: EngineCompositionApi; Engine: Function; }
 interface LittlewildRoot {
  LW?: LittlewildFacade;
  LWSimulationProfile?: SimulationProfileApi;
  LWCommandRouter?: CommandRouterApi;
  LWScenarioWorkflow?: {install(engine:Function):void};
  LWScenarioResources?: {install(engine:Function):void};
  LWGameSettings?: {install(engine:Function):void};
  LWInteractionIntegration?: {install(engine:Function):void};
 }
  const root = inputRoot as LittlewildRoot;

 const L=root.LW;
 if(!L)throw Error('Littlewild facade missing.');
 const C=L.EngineComposition;
 if(!C)throw Error('Engine composition runtime missing.');
 C.finalize(['systems','colony','world-simulation','village','planner','cartography']);
 if(!root.LWSimulationProfile)throw Error('Simulation profile runtime missing.');
 root.LWSimulationProfile.assertRuntime();
 if(!root.LWCommandRouter)throw Error('Command router missing.');
 root.LWCommandRouter.install(L.Engine);
 if(!root.LWInteractionIntegration)throw Error('Interaction runtime missing.');
 root.LWInteractionIntegration.install(L.Engine);
 if(!root.LWGameSettings)throw Error('Game settings runtime missing.');
 root.LWGameSettings.install(L.Engine);
 if(!root.LWScenarioWorkflow||!root.LWScenarioResources)throw Error('Scenario resource/workflow runtime missing.');
 root.LWScenarioWorkflow.install(L.Engine);root.LWScenarioResources.install(L.Engine);
 if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(globalThis);
