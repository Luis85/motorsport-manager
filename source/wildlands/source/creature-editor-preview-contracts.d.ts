/// <reference path="./creature-editor-contracts.d.ts" />
declare namespace LWCreaturePreview {
 interface Vector {x:number;y:number;z:number;set(x:number,y:number,z:number):void;}
 interface Object3D {position:Vector;rotation:Vector;scale:Vector;visible:boolean;userData:Record<string,unknown>;add(...objects:Object3D[]):void;remove(object:Object3D):void;traverse(work:(object:Object3D)=>void):void;geometry?:{dispose():void};material?:{dispose():void};}
 interface Kit {group(parent:Object3D):Object3D;piece(parent:Object3D,kind:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,color:string,rotation:number,extra:Record<string,unknown>):Object3D;}
 interface Instance {root:Object3D;handles:Map<string,Object3D>;}
 interface Preview {update(value:LWCreatureEditor.Package,personality:string,pose:string):void;draw():void;dispose():void;readonly nodeCount:number;}
 interface Api {create(canvas:HTMLCanvasElement):Preview;}
}
