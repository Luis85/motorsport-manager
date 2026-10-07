/** Technology modifiers derive from frozen archetypes, preventing cumulative tick mutation. */
(function(input:unknown){
 'use strict';
 const root=input as {LWRTSStats?:unknown};
 function value(ctx:LWRTSRuntime.Context,id:string,stat:LWRTSData.Effect['stat'],base:number):number{
  if(stat==='armor'){const pos=ctx.world.get<LWRTSRuntime.Point>(id,'rts-position');if(pos)base+=ctx.catalog.get('terrain',ctx.map.tiles[Math.floor(pos.y)*ctx.map.width+Math.floor(pos.x)]||'')?.cover||0;}
  const owner=ctx.world.get<LWRTSRuntime.Owner>(id,'rts-owner'),unit=ctx.world.get<LWRTSRuntime.Unit>(id,'rts-unit');
  if(!owner||!unit)return base;
  const technologies=ctx.world.get<LWRTSRuntime.Faction>('faction:'+owner.faction,'rts-faction')?.technologies||[];
  let result=base;
  for(const technology of technologies)for(const effect of ctx.catalog.get('technologies',technology)?.effects||[])if(effect.stat===stat&&(!effect.roles.length||effect.roles.includes(unit.role as LWRTSData.Unit['role'])))result*=effect.factor;
  return result;
 }
 root.LWRTSStats=Object.freeze({value});if(typeof module!=='undefined'&&module.exports)module.exports=root.LWRTSStats;
})(globalThis);
