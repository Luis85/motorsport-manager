/// <reference path="./animation-data-contracts.d.ts" />
/// <reference path="./renderer-contracts.d.ts" />
/** Trusted p5 drawing callbacks are compiled code. Imported data only selects bounded descriptors. */
declare namespace LWAnimations {
 interface Drawing {fill(color:string):void;noFill():void;stroke(color:string):void;noStroke():void;strokeWeight(width:number):void;circle(x:number,y:number,diameter:number):void;ellipse(x:number,y:number,width:number,height:number):void;line(x1:number,y1:number,x2:number,y2:number):void;rect(x:number,y:number,width:number,height:number):void;push():void;pop():void;}
 interface Input {readonly p5:Drawing;readonly time:number;readonly phase:number;readonly seed:number;readonly center:LittlewildRenderer.Point;readonly radius:number;readonly color:string;readonly count:number;readonly viewport:LittlewildRenderer.Viewport;}
 type Preset=(input:Input)=>void;
 interface Layer {readonly ready:Promise<LittlewildRenderer.SwitchResult>;readonly looping:boolean;draw(frame:LittlewildRenderer.Frame,descriptors:readonly Descriptor[],time:number,project:(point:LittlewildRenderer.Point)=>LittlewildRenderer.Point):void;dispose():void;}
 interface Api {readonly version:1;list():readonly Metadata[];register(metadata:Metadata,preset:Preset):()=>void;validate(input:unknown):readonly Descriptor[];create(canvas:HTMLCanvasElement):Layer;}
}
declare var LWAnimations:LWAnimations.Api;
