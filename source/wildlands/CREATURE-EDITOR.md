# Littlewild 3D Creature Editor

Open **Worlds & scenarios → Open 3D Creature Editor**. The editor captures the
current native scene, including paid work, inventories and deterministic state.
It authors a detached complete scenario draft. The current story remains owned
by its engine until **Review & apply → Start this scene** uses the existing
backup and replacement boundary. Cancel returns to the same revision.

Select an archetype to edit its definition, or an existing companion to edit its
actual values alongside that archetype. The two kinds of values have separate
labels. `state.defaults` affects future creation. Movement and physiology belong
to the archetype and tune every matching companion after scenario application.
Attributes, skills, needs, inventory, equipment, traits and extra declared ECS
component data belong to the selected companion. No edit clears its task, order
queue, paid work, RPG seed or inventory implicitly. Incompatible values fail
rather than being normalized or discarded.

The preview builds an actual Three.js primitive scene through the same canonical
asset interpreter as the game. It accepts a validated draft asset directly;
it never temporarily replaces the active global catalog. WebGL renders when
available; the existing software renderer projects the same Three.js geometry
otherwise. Drag or use arrow keys to orbit; scroll or use +/− to zoom; Home resets.
Pose controls change only the preview. Appearance profiles select models and
material roles. Body-part controls edit position, scale and rotation within the
existing primitive grammar. Advanced JSON exposes the complete rig, material,
model and gameplay definition for supported data edits. External arbitrary mesh
formats and executable animation programs are outside this authoring grammar.

**Create from this archetype** copies the gameplay and visual manifests to a new
stable ID. Existing gameplay and actor-asset IDs cannot be overwritten this way.
The scenario catalog and compiled factory admit the new definition after review;
existing companions keep their saved identities. Select a different companion
without leaving the complete draft, and undo/redo through accepted changes.
History retains twenty accepted revisions. Rejected edits and imports retain the
current draft, revision, history, live story and catalog revisions.

## Creature package

**Export creature JSON** writes `littlewild-creature-package`, schema version 1:

- `gameplayDefinition`: the complete co-located `creature.json` contract;
- `appearanceManifest`: the complete actor `asset.json` contract;
- `assetReferences`: canonical item assets for equipment and carried-item visuals;
- `selectedInstance`: the complete actual actor value, when one is selected.

The package is JSON data. Import/export retains all package fields exactly.
An instance-bearing import must target the same companion ID in a captured scene
context. Importing an archetype-only package adds or edits its gameplay and
visual resources without replacing existing companions. The editor selection
then follows that imported archetype. **Export full scenario** includes those
resources, all worlds, scenes, settings, libraries and native initial state.

Validation reuses the creature and asset catalogs, complete scenario validation,
and native scene reconstruction. Current actor data is projected through the
compiled creature component validator; its reconstructed native values must
match exactly. Unknown fields, executable-shaped keys, unsupported primitives,
missing rig handles, invalid component values and incompatible actor state are
rejected before a revision changes. No authored label or input range can bypass
those domain constraints.

## Extending the field surface

The game folder's `assets/creatures/editor-fields.json` (Littlewild: `docs/concepts/littlewild/assets/creatures/editor-fields.json`) owns section labels and selected
paths. `creature-editor-fields.ts` validates its closed grammar and compiles only
number, text, boolean and JSON controls. Current map keys generate controls from
the actual validated companion data. Extra ECS component fields are discovered
from the selected archetype's authored component bindings. The catalog cannot
supply DOM selectors, callbacks, arbitrary input components or live engine paths.
Add a section or label there, then run the registered strict, architecture,
creature editor and browser checks. New simulation or renderer capabilities
still require compiled implementation and domain regressions.

The typed toolbox exposes `createCreatureEditor(pack, selection)` and
`validateCreaturePackage(input, context?)` through the same core authority. A
session returns detached package/scenario values and intent methods; it exposes
no live engine or application clock. Browser preview frames come from the
existing presentation RAF. Closing, reviewing, importing, resetting the story
or disposing the UI releases preview graphics and canvas input handlers.

Verification sources: `source/test-creature-editor.cts` and
`source/verification/creature-editor-browser.ts`. Integrated artifacts, source
identity, executed check counts and capture paths are recorded by the final PR
verification run; this guide does not claim manual usability validation.

## Runnable SDK example

After `npm run build`, run this CommonJS example from the Littlewild folder.
It uses detached SDK values; no renderer, engine aggregate or live registry is
exposed to the caller.

```js
const fs = require('node:fs');
const {toolbox} = require('./.generated/developer-sdk.cjs');
const game = toolbox.create({scenarioId: 'office'});
try {
  game.advance(36); // Explicit application intent, before the detached capture.
  const pack = game.captureScenario();
  const scene = pack.scenes.find(row => row.id === 'operations-shift');
  const actor = scene.initialState.colony.creatures[0];
  const selection = {
    sceneId: scene.id, archetypeId: actor.archetype, instanceId: actor.id
  };
  const editor = toolbox.createCreatureEditor(pack, selection);
  console.log(editor.fields().map(field => [field.id, field.group, field.type]));
  editor.setField('instance:name', 'Angela revised');
  editor.setField('instance:rpg.attributes.IQ', 12);
  const visual = editor.snapshot().appearanceManifest;
  visual.behaviors.appearances[actor.personality].materials.fur = '#426a54';
  editor.updateAppearance({behaviors: visual.behaviors});
  const creature = editor.exportPackage();
  const scenario = editor.exportScenario();
  const check = toolbox.validateCreaturePackage(creature, {pack, selection});
  if (!check.ok) throw Error(check.errors.join('\n'));
  const scenarioCheck = toolbox.validateScenario(scenario);
  if (!scenarioCheck.ok) throw Error(scenarioCheck.errors.join('\n'));
  fs.writeFileSync('edited.creature.json', JSON.stringify(creature, null, 2));
  fs.writeFileSync('edited.pack.json', JSON.stringify(scenario, null, 2));
  // Review these detached exports before choosing to activate them.
  // Browser application: import creature/pack → Review & apply → Start this scene.
  // The SDK permits one active session. Back up and dispose before activation.
  fs.writeFileSync('original.story.json', JSON.stringify(game.story(), null, 2));
  game.dispose();
  const authoredGame = toolbox.createScenario(scenario, selection.sceneId);
  try { console.log(authoredGame.inspect()); } finally { authoredGame.dispose(); }
  // The original story remains unchanged in its backup; activation is explicit.
} finally { game.dispose(); }
```
