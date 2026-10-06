/* The only place that establishes simulation feature order. */
(function(inputRoot: unknown){
 'use strict';

 interface EngineCompositionApi { finalize(layers: readonly string[]): void; }
 interface SimulationProfileApi { assertRuntime(): void; }
 interface LittlewildFacade { EngineComposition?: EngineCompositionApi; Engine: Function; }
 interface LittlewildRoot {
  LW?: LittlewildFacade;
  LWSimulationProfile?: SimulationProfileApi;
  LWApplicationAdapters?:{install(engine:Function):void};
 }
  const root = inputRoot as LittlewildRoot;

 const L=root.LW;
 if(!L)throw Error('Littlewild facade missing.');
 const C=L.EngineComposition;
 if(!C)throw Error('Engine composition runtime missing.');
 C.finalize(['systems','colony','world-simulation','village','planner','cartography']);
 if(!root.LWSimulationProfile)throw Error('Simulation profile runtime missing.');
 root.LWSimulationProfile.assertRuntime();
 if(!root.LWApplicationAdapters)throw Error('Application adapters missing.');
 root.LWApplicationAdapters.install(L.Engine);
 if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(globalThis);
