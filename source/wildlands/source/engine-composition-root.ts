/// <reference path="./content-provider-contracts.d.ts" />
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
  LWContentProvider?:LWContentProvider.Api;
 }
  const root = inputRoot as LittlewildRoot;

 const L=root.LW;
 if(!L)throw Error('Littlewild facade missing.');
 const C=L.EngineComposition;
 if(!C)throw Error('Engine composition runtime missing.');
 C.finalize(['systems','colony','world-simulation','village','planner','cartography']);
 if(!root.LWSimulationProfile)throw Error('Simulation profile runtime missing.');
 const profiles=root.LWSimulationProfile;
 if(!root.LWContentProvider)throw Error('Content provider missing.');
 // The game's default simulation profile must match this compiled composition, checked once installed.
 root.LWContentProvider.whenInstalled(()=>profiles.assertRuntime(),'balancing');
 if(!root.LWApplicationAdapters)throw Error('Application adapters missing.');
 root.LWApplicationAdapters.install(L.Engine);
 if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(globalThis);
