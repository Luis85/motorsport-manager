/** Value-only progression contracts shared by engine, tools and presentation. */
declare namespace LWSkillTrees {
 type Effect = 'workSpeed' | 'learningSpeed';
 interface Node {
  id:string;name:string;description:string;cost:number;maxRank:number;minimumLevel:number;
  requires:{nodeId:string;rank:number}[];exclusiveGroup?:string;
  effects:Partial<Record<Effect,number>>;
 }
 interface Definition {version:1;id:string;name:string;description:string;xpPerPoint:number;nodes:Node[];}
 interface Progress {definition:Definition;xp:number;ranks:Record<string,number>;}
 interface NodeView extends Node {rank:number;reason:string|null;}
 interface View {id:string;name:string;description:string;xp:number;xpPerPoint:number;points:number;spent:number;nodes:NodeView[];}
 interface Api {
  validate(input:unknown):Definition;validateProgress(input:unknown,level?:number):Progress[];
  attach(input:unknown,definition:unknown):Progress[];award(input:unknown,amount:number):Progress[];
  unlock(input:unknown,treeId:string,nodeId:string,level:number):Progress[];
  inspect(input:unknown,level:number):View[];bonus(input:unknown,effect:Effect):number;
 }
}
