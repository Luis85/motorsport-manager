/** Behavior-free RTS content. Systems interpret these records on the shared ECS. */
declare namespace LWRTSData {
 type Cost = Readonly<Record<string, number>>;
 type Movement = 'land' | 'water' | 'air';
 interface Named { id:string; name:string; description:string; }
 interface Resource extends Named { color:string; gatherRate:number; }
 interface Attack { damage:number; range:number; cooldown:number; projectileSpeed:number; splash:number; targets:readonly Movement[]; }
 interface Unit extends Named {
  role:'worker'|'infantry'|'ranged'|'cavalry'|'siege'|'vehicle'|'naval'|'aircraft'|'creature';
  movement:Movement; speed:number; hp:number; armor:number; sight:number; radius:number;
  population:number; buildTime:number; cost:Cost; prerequisites:readonly string[]; attack:Attack|null; abilities:readonly string[];
  color:string; shape:'person'|'horse'|'tank'|'boat'|'plane'|'animal';
  gatherRate:number; carryCapacity:number; buildRate:number;
 }
 interface Building extends Named {
  hp:number; armor:number; sight:number; footprint:Readonly<{width:number;height:number}>;
  buildTime:number; cost:Cost; produces:readonly string[]; researches:readonly string[];
  storage:readonly string[]; population:number; power:number; attack:Attack|null; color:string;
 }
 interface Faction extends Named {
  color:string; units:readonly string[]; buildings:readonly string[]; technologies:readonly string[];
  startingResources:Cost; ai:Readonly<{enabled:boolean;attackInterval:number;preferredUnit:string}>;
 }
 interface Item extends Named { cost:Cost; ability:string; charges:number; }
 interface Effect { stat:'damage'|'armor'|'speed'|'sight'|'gatherRate'|'maxHp'; factor:number; roles:readonly Unit['role'][]; }
 interface Technology extends Named { cost:Cost; researchTime:number; prerequisites:readonly string[]; effects:readonly Effect[]; }
 interface Ability extends Named {
  effect:'heal'|'damage'|'repair'|'reveal'; amount:number; radius:number; range:number; cooldown:number; duration:number; cost:Cost;
 }
 interface Terrain extends Named { color:string; passable:readonly Movement[]; speedFactor:number; cover:number; }
 interface Spawn { archetype:string; faction:string; x:number; y:number; count:number; }
 interface Deposit { resource:string; x:number; y:number; amount:number; }
 interface ItemDrop { item:string; x:number; y:number; }
 interface TerrainPatch { terrain:string; x:number; y:number; width:number; height:number; }
 interface Objective extends Named { type:'eliminate'|'stockpile'|'survive'; target:string; amount:number; }
 interface Mission extends Named {
  width:number; height:number; playerFaction:string; defaultTerrain:string;
  spawns:readonly Spawn[]; deposits:readonly Deposit[]; items:readonly ItemDrop[]; terrain:readonly TerrainPatch[];
  objectives:readonly Objective[]; fog:boolean; seed:number;
 }
 interface Catalog {
  format:'wildlands-rts'; schemaVersion:1; id:string; name:string;
  resources:readonly Resource[]; factions:readonly Faction[]; units:readonly Unit[];
  buildings:readonly Building[]; items:readonly Item[]; technologies:readonly Technology[];
  abilities:readonly Ability[]; terrain:readonly Terrain[]; missions:readonly Mission[];
 }
 type Kind = 'resources'|'factions'|'units'|'buildings'|'items'|'technologies'|'abilities'|'terrain'|'missions';
 type Entry<K extends Kind> = Catalog[K][number];
 interface CatalogApi {
  readonly data:Catalog; readonly defaults:Catalog;
  validate(input:unknown):Catalog;
  get<K extends Kind>(kind:K,id:string):Entry<K>|null;
  all<K extends Kind>(kind:K):Catalog[K];
  clone():Catalog;
 }
}
