/// <reference path="./animation-data-contracts.d.ts" />
/// <reference path="./scene-graph-contracts.d.ts" />
/** Authored cinematic records only: no renderer, application or runtime ports. */
declare namespace LWStorytelling {
 type Property='x'|'y'|'height'|'rotation'|'scale'|'opacity'|'pose';
 type CameraProperty='x'|'y'|'zoom';
 interface Target {category:LWSceneGraph.Entity['category'];id:string;}
 interface Keyframe {time:number;value:number;easing?:'linear'|'step';}
 type Track={id:string;target:Target;property:Property;keyframes:Keyframe[]}|{id:string;target:{category:'camera'};property:CameraProperty;keyframes:Keyframe[]};
 interface Cue {id:string;time:number;event:LWSceneGraph.Event;}
 interface Animation {id:string;presetId:string;start:number;duration:number;x:number;y:number;radius:number;color:string;count:number;seed?:number;}
 interface Cutscene {animations?:Animation[];id:string;name:string;sceneId:string;duration:number;tracks:Track[];events?:Cue[];onFinish?:LWSceneGraph.Event[];skipPolicy:'finish'|'cancel';}
 interface Shot {id:string;name:string;sceneId:string;cutsceneId?:string;start?:number;end?:number;narrative:string;}
 interface Storyboard {id:string;name:string;shots:Shot[];}
 interface Data {progress?:LWSceneGraph.StoryProgress;version:1;cutscenes:Cutscene[];storyboards:Storyboard[];}
}
