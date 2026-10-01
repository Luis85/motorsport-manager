/* The only place that establishes simulation feature order. */
(function(root){
 'use strict';
 const L=root.LW,C=L.EngineComposition;
 if(!C)throw Error('Engine composition runtime missing.');
 C.finalize(['systems','colony','world-simulation','village','planner','cartography']);
 if(!root.LWSimulationProfile)throw Error('Simulation profile runtime missing.');
 root.LWSimulationProfile.assertRuntime();
 if(!root.LWCommandRouter)throw Error('Command router missing.');
 root.LWCommandRouter.install(L.Engine);
 if(typeof module!=='undefined'&&module.exports)module.exports=L;
})(typeof globalThis!=='undefined'?globalThis:this);
