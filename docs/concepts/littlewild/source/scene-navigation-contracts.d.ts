/// <reference path="./content-contracts.d.ts" />
/** Application admission capabilities; public SDK reviews expose detached values only. */
declare namespace LWSceneNavigation {
 interface NavigationApi {connectionIssue(engine:LWContentPorts.ScenarioEngine,connectionId:string):string|null;}
 interface TransitionPreview {connectionId:string;sourceSceneId:string;sceneId:string;sceneName:string;target:LWSceneGraph.BindingTarget|null;messages:string[];scene:LWContentPorts.ScenePreview;}
 interface NavigationApi {start(engine:LWContentPorts.ScenarioEngine,pack:LWContentPorts.ScenarioPack,id:string):void;check(input:unknown,context:LWContentPorts.ExperienceContext):LWSceneGraph.Journey;checkpoint(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.Journey;normalizeState(state:Record<string,unknown>):Record<string,unknown>;capture(engine:LWContentPorts.ScenarioEngine):LWContentPorts.ScenarioPack|null;target(engine:LWContentPorts.ScenarioEngine):LWSceneGraph.BindingTarget|null;prepare(engine:LWContentPorts.ScenarioEngine,connectionId:string):TransitionPreview;commit(engine:LWContentPorts.ScenarioEngine,preview:TransitionPreview):LWContentPorts.ScenarioEngine;}
}
