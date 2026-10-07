/// <reference path="./developer-contracts.d.ts" preserve="true" />
/// <reference path="./renderer-contracts.d.ts" preserve="true" />
/** Node composition entry: the same toolbox and validated bundled data used by the browser. */
// Transitional: without an installed game the SDK installs the bundled Littlewild profile.
require('./content-provider.js');
(require('./content-installers/littlewild-game.cjs') as {installLittlewild():unknown}).installLittlewild();
require('./renderer-catalog.js');
require('./animation-catalog.js');
require('./balancing-rules.js');
require('./content-runtime.js');
require('./creature-balancing.js');
require('./creature-catalog.js');
require('./asset-catalog.js');
require('./scenario-story.js');
require('./renderer-registry.js');
require('./renderer-scene-2d.js');
require('./renderer-pixi.js');
require('./renderer-excalibur.js');
require('./developer-data.js');
require('./renderer-animations.js');
require('./developer-commands.js');
require('./scene-editor.js');
require('./storytelling.js');
require('./storytelling-editor.js');
require('./developer-storytelling.js');
require('./external-editors.js');
require('./scene-props.js');
require('./creature-editor-fields.js');
require('./creature-editor.js');
require('./balancing-tools.js');
require('./balancing-probes.js');
require('./engine-export.js');
require('./developer-creatures.js');
require('./developer-scenes.js');
require('./developer-session.js');
export const toolbox=require('./developer-toolbox.js') as LittlewildDeveloper.Toolbox;
export type Session=LittlewildDeveloper.Session;
export type Command=LittlewildDeveloper.Command;
export type Snapshot=LittlewildDeveloper.Snapshot;
export type StoryReview=LittlewildDeveloper.StoryReview;
export type DeveloperError=LittlewildDeveloper.DeveloperError;
export type CreateOptions=LittlewildDeveloper.CreateOptions;
export type Validation=LittlewildDeveloper.Validation;
export type Toolbox=LittlewildDeveloper.Toolbox;
export type CommandResult=LittlewildDeveloper.CommandResult;
export type CommandId=LittlewildDeveloper.CommandId;
export type ErrorCode=LittlewildDeveloper.ErrorCode;
export type Json=LittlewildDeveloper.Json;
export type Document=LittlewildDeveloper.Document;
export type ActorSnapshot=LittlewildDeveloper.ActorSnapshot;
export type AssetCategory=LittlewildDeveloper.AssetCategory;

export type InteractionTarget=LittlewildDeveloper.InteractionTarget;
export type InteractionOption=LittlewildDeveloper.InteractionOption;
export type GameSettings=LittlewildDeveloper.GameSettings;

export type InteriorLayout=LittlewildDeveloper.InteriorLayout;
export type BuildingInteriorSnapshot=LittlewildDeveloper.BuildingInteriorSnapshot;
export type BuildingDesignDraft=LittlewildDeveloper.BuildingDesignDraft;
export type BuildingDesign=LittlewildDeveloper.BuildingDesign;
export type BuildingDesignPreview=LittlewildDeveloper.BuildingDesignPreview;
export type ConstructionOptions=LittlewildDeveloper.ConstructionOptions;

export const renderers=toolbox.renderers;
export const failureCodes=toolbox.failureCodes;
export type TerraformEdit=LittlewildDeveloper.TerraformEdit;
export type TerraformSnapshot=LittlewildDeveloper.TerraformSnapshot;
export type TerraformPreview=LittlewildDeveloper.TerraformPreview;
export type RendererMetadata=LittlewildDeveloper.RendererMetadata;
export type FailureCode=LWRuntime.FailureCode;

export type SceneEditor=LittlewildDeveloper.SceneEditor;
export type SceneReview=LittlewildDeveloper.SceneReview;
export type SceneConnection=LittlewildDeveloper.SceneConnection;
export type SceneTarget=LittlewildDeveloper.SceneTarget;
export type SceneProp=LittlewildDeveloper.SceneProp;
export type SceneMetadata=LittlewildDeveloper.SceneMetadata;
export type SceneRendering=LittlewildDeveloper.SceneRendering;
export const externalEditors=toolbox.externalEditors;
export type ExternalEditorFormat=LWExternalEditors.Format;
export type ExternalEditorOptions=LWExternalEditors.Options;
export type ExternalEditorExport=LWExternalEditors.Export;
export type ExternalEditorImport=LWExternalEditors.Import;

export type CreatureEditor=LWCreatureEditor.Session;
export type CreatureEditorSelection=LWCreatureEditor.Selection;
export type CreaturePackage=LWCreatureEditor.Package;
export type CreaturePackageValidation=LWCreatureEditor.Validation;

export const storytelling=toolbox.storytelling;
export type Storytelling=LittlewildDeveloper.Storytelling;
export type Cutscene=LittlewildDeveloper.Cutscene;
export type Storyboard=LittlewildDeveloper.Storyboard;
export type StorytellingEditor=LittlewildDeveloper.StorytellingEditor;
export type CutscenePlayback=LittlewildDeveloper.CutscenePlayback;

export const engineExport=toolbox.engineExport;
export type EngineExport=LWEngineExport.Document;
export type EngineSourceBundle=LWEngineExport.SourceBundle;
export type EngineExportValidation=LWEngineExport.Validation;
export const balancing=toolbox.balancing;
export type BalancingDocument=LWBalancing.Document;
export type BalancingReview=LWBalancing.Review;
export type BalancingProbeOptions=LWBalancing.ProbeOptions;
export type BalancingProbe=LWBalancing.Probe;
export type BalancingSweepOptions=LWBalancing.SweepOptions;
export type BalancingSweepRow=LWBalancing.SweepRow;

export const animations=toolbox.animations;
export type AnimationHost=Pick<LittlewildRenderer.Host,'setAnimations'|'snapshot'|'project'>;
export type AnimationDescriptor=LWAnimations.Descriptor;
export type AnimationMetadata=LWAnimations.Metadata;
export type AnimationValidation=LittlewildDeveloper.AnimationValidation;
