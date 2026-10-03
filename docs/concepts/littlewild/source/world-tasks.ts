/// <reference path="./balancing-contracts.d.ts" />
/* Detached physical-task proposals. A proposal describes intent; transaction services
 * still preflight the active task, position, stock, skill and capacity before settlement. */
(function(inputRoot: unknown) {
  'use strict';
  interface Building { id: string; x: number; y: number; }
  interface Recipe { kind: string; output: string; time: number; }
  interface Job { id: string; duration: number; progress: number; }
  interface Names { item: string; building: string; }
  interface Task {
    kind: string; buildingId: string; resource: string; orderId: string | null;
    target: { x: number; y: number }; duration: number;
    label: string; reason: string; thought: string;
  }
  interface TransferTask extends Task { amount: number; }
  interface WorkTask extends Task { buffered: boolean; jobId: string | null; elapsed: number; }
  interface GatherTask {
    kind:string;resource:string;nodeId:string;orderId:string|null;
    target:{x:number;y:number};duration:number;label:string;reason:string;thought:string;worldGather:true;
  }
  const root = inputRoot as { LWWorldTasks?: typeof api };

  function transfer(kind: string, building: Building, resource: string, amount: number,
    orderId: string | null, names: Names, extra: Record<string, unknown> = {},duration=(globalThis as unknown as {LWBalanceRules:LWBalanceRules.Api}).LWBalanceRules.defaults.production.transferSeconds): TransferTask {
    const verb = kind === 'stockbuilding' ? 'Bringing ' : kind === 'emptybuilding' ? 'Reclaiming ' : 'Collecting ';
    return { kind, buildingId: building.id, resource, amount: Math.max(1, amount), orderId,
      target: { x: building.x, y: building.y }, duration,
      label: verb + names.item.toLowerCase() + (kind === 'stockbuilding' ? ' to ' : ' from ') + names.building.toLowerCase(),
      reason: 'Goods travel in a creature’s satchel. This transfer settles only at the building.',
      thought: kind === 'stockbuilding' ? 'A few supplies, exactly where they belong.' : 'I’ll carry these to where they can help.', ...extra };
  }
  function work(building: Building, recipe: Recipe, job: Job | null | undefined, orderId: string | null, names: Names): WorkTask {
    return { kind: recipe.kind, resource: recipe.output, buildingId: building.id, buffered: true,
      jobId: job?.id || null, orderId, target: { x: building.x, y: building.y },
      duration: job?.duration || recipe.time, elapsed: job?.progress || 0,
      label: (recipe.kind === 'produce' ? 'Tending ' : 'Making ') + names.item.toLowerCase() + ' · ' + names.building,
      reason: 'The ingredients are at this building. Finished goods wait in its output tray for collection.',
      thought: 'Supplies in. Patient work. Something useful out.' };
  }
  function gather(node:Building&{stock:number},rule:{id:string;resource:string;mode:string;seconds:number},names:{item:string},orderId:string|null=null):GatherTask {
    return {kind:rule.id==='hunt'?'hunt':'gather',resource:rule.resource,nodeId:node.id,orderId,
      target:{x:node.x,y:node.y},duration:rule.seconds,label:'Gathering '+names.item.toLowerCase(),
      reason:rule.mode==='finite'?'This deposit has '+node.stock+' units left. Gathering removes only what I carry away.':'A sustainable source. Each trip still takes time and carrying space.',
      thought:'A little from the land, a little closer to home.',worldGather:true};
  }
  const api = { transfer, work, gather };
  root.LWWorldTasks = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
