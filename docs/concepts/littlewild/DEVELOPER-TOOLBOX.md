# Developer toolbox

Littlewild's toolbox is a typed programmatic interface for tools, scripts, test
harnesses and coding agents. It owns session lifecycle and routes intent through
the existing compiled command boundary. It uses the existing simulation, current
scenario schema 2 and portable story envelope 10.

## Start in Node

Run from `docs/concepts/littlewild`:

```sh
npm ci
npm run typecheck
npm run build
npm run toolbox -- --scenario littlewild --scene charted-home --seconds 5
npm run toolbox -- --scenario emberworks --seconds 2 --story-output /tmp/workshop.story.json
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
edit the authored `source/assets/creatures/<archetype>/creature.json`, choose a
validated asset ID discovered from `assets.list('actor')`, and run typecheck/build
and the registered asset/creature verification suites. Asset definitions live in
`source/assets/<family>/<id>/asset.json`; adding a folder follows the documented
build discovery contract. `assets.validate()` validates the asset's own model/rig
contract; the build also validates cross-catalog references. There is no arbitrary
runtime code loader or mutable renderer registration API.

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
returns `{ok:false, reason, data}` from `command()`; it is distinct from an invalid
API envelope. A successful void native command is reported as `{ok:true,data:null}`.
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
