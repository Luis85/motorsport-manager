# Developer toolbox

Littlewild's toolbox is a typed programmatic interface for tools, scripts, test
harnesses and coding agents. It owns session lifecycle and routes intent through
the existing compiled command boundary. It uses the existing simulation, current
scenario schema 2 and portable story envelope 10.

## Start in Node

Run from `source/wildlands`:

```sh
npm ci
npm run typecheck
npm run build
npm run toolbox -- --scenario littlewild --scene charted-home --seconds 5
npm run toolbox -- --scenario emberworks --seconds 2 --story-output /tmp/workshop.story.json
npm run toolbox -- --scenario office --scene operations-shift --seconds 120
```

The example is authored in `source/tools/developer-example.cts` and compiled by
the normal build. It submits a pantry target through a typed command, starts the
session, advances exact fixed steps, prints detached actor state and optionally
writes a portable checkpoint. `--help` lists the flags; unknown/duplicate flags
and invalid seconds fail with JSON diagnostics.

Import the generated entry from your script; the build emits its `.d.cts`
declaration and public data contracts alongside it:

```ts
import {toolbox, type Command} from './.generated/developer-sdk.cjs';

console.log(toolbox.scenarios()); // Discover IDs and available scene IDs first.
const game = toolbox.create({scenarioId: 'littlewild', sceneId: 'charted-home'});
try {
  const actor = game.inspect().actors[0];
  if (!actor) throw new Error('Scene has no creature.');
  const intent: Command = {
    id: 'set-stock-target', actorId: actor.id, args: ['berries', 4]
  };
  const result = game.command(intent);
  if (!result.ok) throw new Error(result.reason ?? 'Command rejected.');
  game.start();
  game.step(50); // Fifty accepted 0.1-second simulation steps.
  console.log(game.inspect());
  const checkpoint = game.story();
  // Caller owns writing this detached JSON document to a file or storage port.
} finally {
  game.dispose();
}
```

The SDK exports `Toolbox`, `Session`, `Command`, `CommandId`, `CommandResult`,
`CreateOptions`, `Snapshot`, `ActorSnapshot`, `StoryReview`, `Validation`,
`DeveloperError`, `ErrorCode`, `AssetCategory`, `Json` and `Document` types.
Command IDs form a discriminated union: each ID determines its tuple of arguments
and whether `actorId` is required. Use stable actor IDs from `inspect()`.

## Session and time contract

The current engine has process-global content registries. One developer session
can be active in a process or browser realm. Save and dispose it before opening
another; concurrent simulation contexts require separate processes or browser
realms. Every operation checks the installed registry fingerprints. A legacy API
that changes the context makes the retained developer session fail visibly.

`create()` preserves the authored scene's initial `started`/`paused` flags.
`start()` marks it started and resumes it; `pause()` holds simulation;
`resume()` clears pause without starting an unstarted scene. `step(count = 1)`
requests 0–36000 whole steps; `advance(seconds)` accepts 0–3600 seconds in exact
multiples of 0.1. Both preserve the native pause/start gates. Their `steps` field
is the number requested, while `advancedSeconds` reports actual simulation time
advanced. Floating-point readouts can contain normal representation error.
There is no wall clock, timer, frame-rate policy or automatic catch-up in this API.

Equal commands and accepted fixed steps with the same scene/profile produce the
same native continuation. `dispose()` is idempotent, releases the captured engine
and makes all retained operation handles reject with `session-disposed`.

## Queries, checkpoints and reviewed documents

| Operation | Result / responsibility |
| --- | --- |
| `toolbox.scenarios()` | Detached built-in IDs, names and scenes. |
| `toolbox.commands()` | Compiled command IDs, scopes, argument ceilings and away permission. |
| `toolbox.externalEditors` | Discover Tiled, LDtk, glTF/GLB and both Canvas formats; exchange detached scene packs with conversion diagnostics. |
| `toolbox.createCreatureEditor(pack, selection)` | Detached archetype, appearance and current-instance draft; package exchange and undo/redo. |
| `toolbox.validateCreaturePackage(input, context?)` | Validate a package independently or against its complete scenario and selection. |
| `toolbox.createSceneEditor(pack)` | Detached typed pack draft, bounded undo/redo and canonical entity editing. |
| `game.sceneConnections()` | Authored links and current admission reasons through the scene authority. |
| `game.reviewScene(id)` / `game.enterScene(review)` | Observational review followed by trusted replacement within the same session lease. |
| `game.sceneTarget()` / `game.sceneProps()` | Detached canonical island/floor target and current scene scenery. |
| `game.inspect()` | Detached time/control flags, actors, positions, needs, tasks, inventories, buildings, nodes and player values. |
| `game.save()` | Detached native engine state (format 8), for comparison or a native integration. |
| `game.story()` | Detached portable story (envelope 10), including libraries/context and fingerprints. |
| `game.captureScenario()` | Detached editable scenario captured by the existing scenario authority. |
| `toolbox.validateScenario(data)` | `{ok, errors, data}`; the existing whole-pack validator stages and restores registries. |
| `toolbox.createScenario(data, sceneId)` | Validate/review/commit through the existing scenario boundary, then own the session. |
| `toolbox.reviewStory(dataOrJson)` | Opaque frozen review token; inspection validates a current story and stages/restores its context. |
| `toolbox.openStory(review)` | Commit that original token into a new session. An active session/host blocks opening. A successful token is consumed once. |

A copied or forged review token is rejected. The prepared engine and imported
libraries stay private. Editing the original story after review cannot modify
what was reviewed; review the edited story again to open that version.

```ts
const game = toolbox.create({scenarioId: 'littlewild'});
game.start();
game.advance(5);
const checkpoint = game.story();
const review = toolbox.reviewStory(checkpoint);
game.dispose();
const restored = toolbox.openStory(review);
try {
  restored.advance(3);
  console.log(restored.save());
} finally {
  restored.dispose();
}
```

Snapshots/checkpoints/catalog results can be edited as drafts. Those changes do
not mutate a running engine. To apply an authored scene draft, use whole-pack
validation followed by `createScenario()` after disposing the prior session.

## Catalogs and asset authoring

`toolbox.assets.list(category?)` returns detached asset identities/model names.
`assets.get('actor'|'building'|'item', id)` returns the full detached JSON definition
or `null`. `assets.validate(data)` uses the existing complete catalog validator and
returns `{ok, errors, data}` without registering or replacing a live asset.
`toolbox.creatures()` and `validateCreature(data)` do the same for archetype data.
Validation accepts data only: imported callbacks, functions, accessors, class
instances, symbol fields, cycles and non-finite values are rejected.

A creature's `visualAsset` selects an existing bundled actor asset. To change it,
edit the authored `source/assets/creatures/<archetype>/definition.json (`creature` facet)`, choose a
validated asset ID discovered from `assets.list('actor')`, and run typecheck/build
and the registered asset/creature verification suites. Asset definitions live in
`source/assets/<family>/<id>/definition.json (`visual` facet)`; adding a folder follows the documented
build discovery contract. `assets.validate()` validates the asset's own model/rig
contract; the build also validates cross-catalog references. Complete scenarios can instead carry their own validated visual and creature catalogs under `resources`, using the same model/rig grammar. Activation installs an isolated snapshot atomically and the session detects external catalog drift. Imported data cannot install executable code. Trusted developer scripts can register a browser renderer through the separate [renderer interface](RENDERERS.md). See [Office scenario authoring](OFFICE-SCENARIO.md) for editable roles, indoor presentation and full export/import examples.

```ts
const actorAssets = toolbox.assets.list('actor');
const first = actorAssets[0];
if (first) {
  const draft = toolbox.assets.get('actor', first.id);
  console.log(toolbox.assets.validate(draft));
}
```

## Browser embedding and the player host

The bundle exposes the same `LWDeveloper` API. Pure discovery and validation are
available in the shipping player document. Its UI claims a host lease before
creating its engine, so developer `create`, `createScenario` and `openStory`
reject there with instructions to use Node or an isolated browser host. Opening
a developer session must never silently change the playing world's registries.

For a dedicated browser host, load the build's data and simulation/scenario/
asset/toolbox modules in their registered order, omit the player UI bootstrap,
then use `LWDeveloper.create(...)`. `LWDeveloperSession.claimHost()` is the small
composition port for an external player host: retain its lease for the complete
host lifetime and call `lease.dispose()` only after its engine/scheduler have
been discarded. SDK sessions and host leases reject each other's acquisition.
The registered browser-global integration test demonstrates this composition
without DOM/player-UI mutation or CommonJS. For a standalone runnable headless
integration, prefer the Node entry above.

## Errors and coding-agent workflow

Malformed SDK input throws `LittlewildDeveloperError` with `code` and an
actionable `message`. Codes are `invalid-input`, `session-active`,
`session-disposed`, `review-invalid` and `operation-failed`. Gameplay rejection
returns `{ok:false, reason, data, code?}` from `command()`; it is distinct from an invalid
API envelope. `toolbox.failureCodes()` discovers the shared gameplay failure codes,
also exported as the SDK's `FailureCode` type. Route validation and gameplay
authorities retain their original reasons and payloads. A successful void native command is reported as `{ok:true,data:null}`.
Multi-command scripts are sequential; they have no implicit rollback transaction.

1. Discover capabilities and scene/actor/catalog IDs before constructing intent.
2. Create one session, use explicit actor IDs, and check every command result.
3. Advance exact bounded steps; inspect detached readouts to evaluate behavior.
4. Preserve a portable `story()` before switching contexts. Review, dispose,
   then open the original review token.
5. Make content edits in JSON, validate the full relevant document, and rebuild
   authored assets. Never edit generated JavaScript or access a raw engine.
6. Dispose in `finally`, including when a command, step or export fails.

Run `npm run typecheck`, `npm run architecture`, `npm run build` and the complete
`npm run verify` gate for a change. The `developer-toolbox` registered suite covers
ownership, host blocking, command validation, actual lesson cancellation,
fixed-step continuation, disposal, registry drift, detached projections,
scenario/story reviews and both Node/browser globals. The source review informing
these adaptations is [EXCALIBUR-TOOLBOX-REVIEW.md](EXCALIBUR-TOOLBOX-REVIEW.md).

## Creature interactions

Use `toolbox.interactions()` and `game.interactionDefinitions()` for detached
bundled/session discovery, `game.interactionOptions(sourceId,{scope,id})` for
availability, and `game.interactions()` for requests, duel rounds, rule clocks
and seek intents. Typed commands cover generic requests, consent, cancellation,
encouragement, exact-pair staging and validated library replacement.
`game.settings()` reads independent duel/quest flags; `set-game-settings`
updates a Boolean patch, including a state-pure empty patch.
See [Creature interactions and authoring](CREATURE-INTERACTIONS.md) for profiles,
declarative triggers, physical gathering, persistence and rules limits.

## Buildings, terrain and renderer extensions

Use `game.buildingInterior(id)` to inspect a detached floor/workstation view,
`constructionOptions()` to discover supported building types and saved designs,
and `buildingDesign(id)` to obtain an editable draft. Validate geometry with
`toolbox.validateBuildingDesign(draft)` and preview its physical requirements with
`game.previewBuildingDesign(draft, buildingId?)` before submitting
`construct-design` or `improve-design`. Production and visits use
`order-building-production` and `visit-building-floor`; their argument contracts
are documented in [BUILDING-INTERIORS.md](BUILDING-INTERIORS.md).

`game.terraform()` discovers the current revision and available source models;
`terrain(x,y)` returns detached ground and height values. Preview an edit with
`previewTerraform(edit)` and apply the same revision through `apply-terraform`.
Rejections preserve committed work and inventories. Full examples and bounds
are in [TERRAFORM.md](TERRAFORM.md).

`toolbox.renderers.list()` and `validate(metadata)` provide renderer discovery.
Browser plugins use the typed `LWRenderers` factory registry and
`LWRendererHost.player().selectRenderer(id)`. Read [RENDERERS.md](RENDERERS.md)
before implementing lifecycle methods, input handlers or resource cleanup.
Simulation steps and persistent state remain owned by the engine.

## World and scene authoring

`toolbox.createSceneEditor(pack)` creates a detached revision history without taking
an active-session lease. Its typed `snapshot`, `export`, `entities`, `place`,
`setEntity`, world/scene creation, `addProp`, `undo` and `redo` methods operate on the
complete scenario pack. `validate()` reports draft errors; `export()` requires a
valid pack. Entity edits use native creature, building and resource records.
Bound interior positions remain owned by authored building layouts and visits.
Props reference validated building/item asset models and add cosmetic scenery.

An owned session discovers authored connections and their current eligibility
with `game.sceneConnections()`. Review and enter through the same session:

```ts
const link = game.sceneConnections().find(link => link.available);
if (link) {
  const review = game.reviewScene(link.id);
  console.log(review.sceneName, review.messages, review.target);
  game.enterScene(review);
}
```

Review is observational. Enter requires the original review object, rejects stale
state and replaces the session's private engine only after admission succeeds.
The review exposes detached names, messages and a presentation target. No engine
or internal preview is returned. Other scenes retain dormant native checkpoints;
revisits and portable stories continue their saved RNG and physical work.
`sceneTarget()` returns the actual bound island or building floor;
`sceneProps()` returns detached active-scene scenery. Custom renderer frames expose
exterior `props` and bound room `sceneProps` through the existing frozen queries.

`toolbox.externalEditors.formats()` discovers the compiled interchange codecs.
`export(pack, sceneId, format)` returns a detached document and warnings;
`import(document, options?)` returns a validated pack or conversion errors.
Binary GLB input is accepted as a `Uint8Array`. Conversion preserves the active
session and its context. Apply an accepted conversion explicitly to a draft:

```ts
const exported = toolbox.externalEditors.export(draft.export(), sceneId, 'tiled');
const converted = toolbox.externalEditors.import(exported.document);
if (converted.ok) draft.replace(converted.pack);
else console.log(converted.errors);
```

Generic imports require a canonical pack/scene and explicit entity or template
mappings. Conversion warnings describe unsupported foreign features; downloaded
textures, scripts and new executable gameplay authorities are excluded.

Creature editing uses `toolbox.createCreatureEditor(pack, {sceneId, archetypeId, instanceId})`. Edit definition defaults with `updateDefinition`, visual data with `updateAppearance`, and current companion values with `updateInstance`. `exportPackage()` produces a standalone creature package; `exportScenario()` preserves the complete world for the ordinary reviewed scenario apply route. Drafts and validation do not replace an active session.

Central default tuning, the balancing workshop, CLI experiments and captured-value semantics are documented in [BALANCING.md](BALANCING.md).

`toolbox.storytelling.createEditor(pack)` shares the ordinary scene draft and its undo history with timeline/storyboard authoring. `createPlayback(pack, clipId)` exposes supplied-time playback controls and detached status/sample queries; only application composition advances time or dispatches events. See [STORYTELLING.md](STORYTELLING.md).

`toolbox.animations.list()` discovers compiled presets and provenance; `validate(descriptors)` checks bounded authored animation data. A trusted browser renderer can use the exported `AnimationHost` port from `LWRendererHost.player()` to call `setAnimations(descriptors)` or clear with `null`. Its `snapshot()` and `project(point)` observations are detached; it exposes no native engine. Rendering uses the existing host frame cadence. Node discovery initializes no canvas or simulation clock.

For a general animation in the running browser host:

```ts
const host = LWRendererHost.player();
host.setAnimations([{
  id: 'greeting', presetId: 'orbit', start: 0, duration: 2,
  x: 9, y: 9, radius: 55, color: '#33aaff', count: 7, seed: 9
}]);
// Call this when the feature is closed to release its p5 instance.
const disposeAnimation = () => host.setAnimations(null);
```

Start and duration use presentation seconds; x/y identify scene coordinates,
and radius uses canvas pixels. Setting animations starts a new presentation
interval on the existing host clock. To animate a cutscene, put the same
descriptor in its `animations` array. Built-in presets are `sparkles`, `orbit`
and `ripple`. Trusted compiled extensions use `LWAnimations.register(metadata,
preset)` and retain its unregister callback for disposal; imported JSON only
selects registered presets. See [p5 provenance and replacement instructions](vendor/P5-VENDOR.md).

`toolbox.engineExport.export(pack, sceneId)` asynchronously produces the complete inert engine/source mapping document; `validate(document)` verifies its archive admission and hashes. This format is separate from runnable scenario packs and never executes its source strings. See [ENGINE-EXPORT.md](ENGINE-EXPORT.md).

## Skill trees

Use `session.skillTrees(targetId)` for detached progress. Discovery includes `attach-skill-tree` and `unlock-skill-tree-node`, targeting `player` or a stable creature ID. The [skill-tree reference](../../docs/reference/skill-trees.md) describes definition validation, earned XP, rank costs, engine integration and saved-state compatibility.
