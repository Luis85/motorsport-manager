/** Armored v1: metres, seconds, kg; right handed, +Y up, local +Z forward; angles radians.
 * Forge authored Euler rotations use degrees and convert only at the import boundary. */
declare namespace LWArmoredData {
 interface Vec3 {x:number;y:number;z:number;}
 interface Surface {id:string;friction:number;rollingResistance:number;}
 interface Terrain {width:number;depth:number;cellSize:number;heights:number[];surface:string;}
 interface Obstacle {id:string;position:Vec3;size:Vec3;material:string;destructible:boolean;health:number;}
 interface Armor {front:number;side:number;rear:number;roof:number;}
 interface Vehicle {
  id:string;name:string;asset:string;mass:number;length:number;width:number;height:number;
  engineForce:number;brakeForce:number;maxSpeed:number;reverseSpeed:number;trackWidth:number;
  suspensionTravel:number;groundClearance:number;maxSlope:number;rollingResistance:number;
  turretSpeed:number;elevationSpeed:number;minElevation:number;maxElevation:number;
  muzzleHeight:number;barrelLength:number;reloadSeconds:number;ammunition:string[];ammoCapacity:number;
  repairKits:number;repairSeconds:number;repairRate:number;armor:Armor;componentHealth:number;sightRange:number;aimSeconds:number;accuracy:number;
 }
 interface Ammunition {id:string;name:string;kind:'AP'|'HE'|'SMOKE';velocity:number;mass:number;penetration:number;damage:number;drag:number;ricochetAngle:number;blastRadius:number;smokeSeconds:number;}
 interface Spawn {id:string;vehicle:string;faction:string;position:Vec3;yaw:number;player:boolean;}
 interface Objective {id:string;name:string;kind:'eliminate'|'reach'|'survive';target:string;position:Vec3;radius:number;required:number;}
 interface Mission {id:string;name:string;description:string;playerFaction:string;seed:number;terrain:Terrain;obstacles:Obstacle[];spawns:Spawn[];objectives:Objective[];timeLimit:number;}
 interface Catalog {format:'wildlands-armored-catalog';version:1;vehicles:Vehicle[];ammunition:Ammunition[];surfaces:Surface[];missions:Mission[];}
 interface CatalogApi {validate(input:unknown):Catalog;}
}
declare namespace LWArmoredRuntime {
 type Data=Record<string,unknown>;
 type Vec3=LWArmoredData.Vec3;
 interface World {
  readonly entities:ReadonlySet<string>;readonly running:boolean;readonly pendingStructural:number;
  create(id:string):string;destroy(id:string):boolean;get<T extends Data=Data>(id:string,type:string):T|undefined;
  set<T extends Data>(id:string,type:string,value:T):T;has(id:string,...types:string[]):boolean;query(types:readonly string[],except?:readonly string[]):string[];
  defer(operation:'create'|'destroy',id:string):void;defer(operation:'set',id:string,type:string,data:Data):void;defer(operation:'remove',id:string,type:string):void;
 }
 interface System {id:string;phase:'pre'|'simulate'|'post';order:number;query:readonly string[];update(world:World,id:string,dt:number,context:Data):void;}
 interface Scheduler {register(spec:System):Scheduler;step(world:World,dt:number,context?:Data):void;}
 interface Ecs {World:new()=>World;Scheduler:new()=>Scheduler;}
 /** Pitch is nose-up elevation; render Euler X is -pitch. Roll follows +Z right-hand rotation. */
 interface Transform extends Data {position:Vec3;yaw:number;pitch:number;roll:number;}
 interface Body extends Data {velocity:Vec3;yawVelocity:number;leftForce:number;rightForce:number;contacts:number;slip:number;grounded:boolean;}
 interface Motor extends Data {throttle:number;steer:number;brake:number;cruise:number;}
 interface Identity extends Data {definition:string;faction:string;}
 interface Weapon extends Data {turretYaw:number;elevation:number;aimYaw:number;aimElevation:number;reload:number;ammo:string;reserves:Record<string,number>;trigger:boolean;recoil:number;}
 interface Damage extends Data {status:'operational'|'impaired'|'immobilized'|'disabled'|'destroyed';components:Record<string,number>;crew:Record<string,number>;fire:number;repair:number;}
 interface Order extends Data {kind:'hold'|'follow'|'charge'|'secure';targetId:string;position:Vec3;}
 interface Perception extends Data {targetId:string;acquired:number;contacts:{id:string;position:Vec3;tick:number}[];}
 interface Projectile extends Data {source:string;faction:string;ammo:string;position:Vec3;previous:Vec3;velocity:Vec3;age:number;}
 interface State extends Data {tick:number;sequence:number;serial:number;rng:number;mission:string;controlled:string;status:'running'|'victory'|'defeat';terrainRevision:number;objectives:Record<string,number>;}
 interface Event extends Data {kind:string;tick?:number;sequence?:number;}
 interface Command extends Data {kind:string;sequence?:number;entityId?:string;entityIds?:string[];faction?:string;throttle?:number;steer?:number;brake?:number;cruise?:number;yaw?:number;elevation?:number;pressed?:boolean;ammo?:string;order?:string;targetId?:string;position?:Vec3;}
 interface Result {ok:boolean;message:string;sequence?:number;}
 interface Context {world:World;catalog:LWArmoredData.Catalog;mission:LWArmoredData.Mission;state:State;emit(event:Event):void;random():number;}
 interface VehicleView {id:string;definition:string;faction:string;transform:Transform;previous:Transform;body:Body;motor:Motor;weapon:Weapon;damage:Damage;order:Order;}
 interface ObstacleView extends LWArmoredData.Obstacle {destroyed:boolean;}
 interface Snapshot {obstacles:ObstacleView[];smoke:{id:string;position:Vec3;radius:number;remaining:number}[];format:'wildlands-armored-snapshot';version:1;tick:number;seconds:number;status:string;controlled:string;missionId:string;playerFaction:string;vehicles:VehicleView[];projectiles:(Projectile&{id:string})[];events:Event[];objectives:Record<string,number>;terrainRevision:number;}
 interface Checkpoint {format:'wildlands-armored-checkpoint';version:1;solver:'tracked-force-v1';fixedStep:number;catalog:LWArmoredData.Catalog;missionId:string;entities:{id:string;components:Data}[];events:Event[];}
 interface Session {command(input:Command):Result;query(faction?:string):Snapshot;step(ticks?:number):void;checkpoint():Checkpoint;}
 interface SessionApi {create(catalog:LWArmoredData.Catalog,missionId?:string,checkpoint?:Checkpoint):Session;restore(value:unknown):Session;}
 interface Extension {register(scheduler:Scheduler,context:Context):void;command?(context:Context,input:Command):Result|null;}
 interface Physics extends Extension {height(terrain:LWArmoredData.Terrain,x:number,z:number):number;}
 interface ApplicationView {query():Snapshot;command(input:Command):Result;checkpoint():Checkpoint;status():{active:boolean;paused:boolean;mission:string};control(action:'pause'|'resume'|'restart'):void;replace(value:unknown):void;}
 interface Application {view:ApplicationView;enter():void;exit():void;advance(seconds:number):void;}
}
