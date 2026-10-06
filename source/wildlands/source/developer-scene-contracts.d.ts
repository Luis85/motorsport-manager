/// <reference path="./scene-editor-contracts.d.ts" />
/** Detached scene authoring and reviewed ownership transitions. */
declare namespace LittlewildDeveloper {
 type SceneEditor=LWSceneEditor.Session;
 type SceneTarget=LWSceneGraph.BindingTarget;
 type SceneProp=LWSceneGraph.Prop;
 type SceneMetadata=LWSceneGraph.Metadata;
 type SceneRendering=LWSceneGraph.Rendering;
 interface SceneConnection {readonly id:string;readonly label:string;readonly targetSceneId:string;readonly available:boolean;readonly reason:string|null;}
 interface SceneReview {readonly format:'littlewild-scene-review';readonly version:1;readonly connectionId:string;readonly sourceSceneId:string;readonly sceneId:string;readonly sceneName:string;readonly target:Readonly<SceneTarget>|null;readonly messages:readonly string[];}
}
