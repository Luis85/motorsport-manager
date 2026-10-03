/** Detached authored stage data and drawing-only ports shared by Canvas and 3D. */
declare namespace LWEnvironmentPorts {
 interface Point {x:number;y:number;}
 interface Camera {center:readonly [number,number];zoom:number;}
 interface Environment {mode:'indoor';background:string;floor:string;alternateFloor:string;wall:string;trim:string;camera?:Camera;}
 interface Profile {environment?:Environment;}
 interface RoleState {scenarioWorkflow?:{roles?:readonly {id:string;label:string;actorId:string|null}[];deals?:readonly {questId:string;salesRole:string;venueBuildingId:string|null}[]};}
 interface Art {
  poly(c:CanvasRenderingContext2D,points:readonly (readonly [number,number])[],color:string):void;
  diamond(c:CanvasRenderingContext2D,x:number,y:number,width:number,height:number,color:string):void;
 }
 interface Kit {
  box(parent:unknown,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,rotation?:number):unknown;
  piece(parent:unknown,kind:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string):unknown;
 }
 interface Api {
  read(profile?:Profile):Environment|null;
  key():string;
  role(state:RoleState,actorId:string):string;
  onsite(state:RoleState,actor:{id:string;activeQuest?:unknown}):boolean;
  populate3D(kit:Kit,parent:unknown,environment:Environment,origins:readonly Point[],size?:number):void;
  groundCanvas(c:CanvasRenderingContext2D,art:Art,environment:Environment,size:number,tileWidth:number,tileHeight:number):void;
  backdropCanvas(c:CanvasRenderingContext2D,width:number,height:number,environment:Environment):void;
 }
}
