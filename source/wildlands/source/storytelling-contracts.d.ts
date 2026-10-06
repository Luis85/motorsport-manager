/// <reference path="./content-contracts.d.ts" />
/// <reference path="./storytelling-data-contracts.d.ts" />
/// <reference path="./scene-navigation-contracts.d.ts" />
/// <reference path="./scene-editor-contracts.d.ts" />
/** Versioned, data-only cinematic presentation. Time is supplied by an application host. */
declare namespace LWStorytelling {
 interface Pose {target:Target;values:Partial<Record<Property,number>>;}
 interface Sample {animations:Animation[];cutsceneId:string;sceneId:string;time:number;duration:number;poses:Pose[];camera:Partial<Record<CameraProperty,number>>;}
 type State='ready'|'playing'|'paused'|'stopped'|'finished'|'disposed';
 interface Status {cutsceneId:string;sceneId:string;state:State;time:number;duration:number;completion:number;generation:number;}
 interface Playback {
  status():Status;sample():Sample;play():void;pause():void;resume():void;stop():void;replay():void;
  seek(seconds:number):void;skip():void;dispose():void;
  /** Composition-only elapsed port; never supplied by the presentation UI. */
  advance(seconds:number):void;drainEvents():LWSceneGraph.Event[];
 }
 interface Authoring {
  readonly revision:number;list():Data;setCutscene(input:Cutscene,expectedRevision?:number):void;
  removeCutscene(id:string,expectedRevision?:number):void;setStoryboard(input:Storyboard,expectedRevision?:number):void;
  removeStoryboard(id:string,expectedRevision?:number):void;setEvents(sceneId:string,events:LWSceneGraph.Event[],expectedRevision?:number):void;
 }
 interface Api {validate(pack:LWContentPorts.ScenarioPack):void;sample(pack:LWContentPorts.ScenarioPack,id:string,time:number):Sample;create(pack:LWContentPorts.ScenarioPack,id:string):Playback;}
 interface EventReview {id:number;connectionId:string;sourceSceneId:string;sceneId:string;sceneName:string;messages:string[];}
 interface EventPorts {
  engine():LWContentPorts.ScenarioEngine;
  /** Atomically adopt a committed engine; caller owns save/rollback and camera intent. */
  transition(preview:LWSceneNavigation.TransitionPreview):void;
  presentation(playback:Playback|null):void;message(text:string):void;pause?(paused:boolean):void;
 }
 interface Director {
  enter(events?:LWSceneGraph.Event[]):void;advance(seconds:number):void;status():Status|null;
  play(id:string):void;pause():void;resume():void;stop():void;skip():void;replay():void;
  review():EventReview|null;accept(review:EventReview):void;cancel(review:EventReview):void;
  dispose():void;
 }
 interface DirectorApi {create(ports:EventPorts):Director;}
}
declare namespace LittlewildDeveloper {type Storytelling=LWStorytelling.Data;type Cutscene=LWStorytelling.Cutscene;type Storyboard=LWStorytelling.Storyboard;type StorytellingEditor=LWStorytelling.Authoring;type CutscenePlayback=Pick<LWStorytelling.Playback,'status'|'sample'|'play'|'pause'|'resume'|'stop'|'replay'|'seek'|'skip'|'dispose'>;}
