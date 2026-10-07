/** Authored scene topology. Bound scenes reference native authorities; checkpoints never tick. */
declare namespace LWSceneGraph {
 type Kind='level'|'island'|'interior'|'dungeon';
 interface Bounds {x:number;y:number;width:number;height:number;}
 type Requirement={type:'player-level';minimum:number}|{type:'quest-complete';questId:string}|{type:'item';itemId:string;quantity:number}|{type:'building';kind:string};
 type Event={type:'message';text:string}|{type:'pause';paused:boolean}|{type:'play-cutscene';cutsceneId:string;once?:boolean}|{type:'scene-switch';connectionId:string};
 interface Connection {id:string;targetSceneId:string;label:string;requirements?:Requirement[];events?:Event[];}
 type Binding={type:'island';sourceSceneId:string;ix:number;iy:number}|{type:'interior';sourceSceneId:string;buildingId:string;floorId:string};
 interface Prop {id:string;name:string;category:'building'|'item';assetId:string;model:string;x:number;y:number;}
 interface Embed {id:string;sceneId:string;role:'minimap'|'panel';bounds?:{anchor:'top-left'|'top-right'|'bottom-left'|'bottom-right';width:number;height:number};}
 interface Rendering {dimension:'2d'|'3d';rendererId:string;embeds?:Embed[];}
 interface Trigger {id:string;requirements:Requirement[];events:Event[];once?:boolean;}
 interface Metadata {triggers?:Trigger[];rendering?:Rendering;props?:Prop[];kind:Kind;parentId?:string;bounds?:Bounds;connections?:Connection[];requirements?:Requirement[];events?:Event[];binding?:Binding;}
 interface StoryProgress {version:1;once:string[];triggers:string[];completed:string[];}
 interface Journey {storytelling?:StoryProgress;pack:LWContentPorts.ScenarioPack;checkpoints:Record<string,Record<string,unknown>>;visited:string[];}
 type BindingTarget={type:'island';ix:number;iy:number}|{type:'interior';buildingId:string;floorId:string};
 interface Entity {id:string;name:string;kind:string;x:number;y:number;category:'creatures'|'buildings'|'nodes'|'props';data:Record<string,unknown>;}
 interface Api {validate(pack:LWContentPorts.ScenarioPack):void;owner(pack:LWContentPorts.ScenarioPack,id:string):LWContentPorts.Scene;bounds(pack:LWContentPorts.ScenarioPack,id:string):Bounds|undefined;entities(pack:LWContentPorts.ScenarioPack,id:string):Entity[];entryIssue(requirements:Requirement[]|undefined,state:Record<string,unknown>):string|null;}
}
