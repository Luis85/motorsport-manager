# Office: a complete portable scenario

Choose **More → Worlds & scenarios → Office → Angela, Phil and Marty → Review & start**. The scene replaces the active setting with an indoor office and fulfillment floor, its guide, furniture, creature definitions, libraries, rules, saved activity settings and autonomous work assignments. Export the current story before replacing a running world.

The authored pack is [`source/content/office.pack.json`](source/content/office.pack.json). Its `resources.assets` list owns each Office furniture definition once, alongside the complete creature catalog. Edit that list or use the scenario editor; separate unused furniture mirrors have been removed. Recipients do not need a source directory or a previously installed Office pack. Supported assets use the existing primitive, material, rig and animation grammars. A pack cannot load JavaScript, shaders, URLs or new executable handlers.

## The working shift

| Teammate | Authored role | Actual work |
| --- | --- | --- |
| Angela, `c1` | Operations Specialist | Withdraws inbound blanks, carries them into the packing bench, completes reserved production batches, deposits cartons, then picks up, delivers and dispatches customer orders. |
| Phil, `c2` | Sales Rep | Walks to the Sales desk before a customer call. The existing quest checks resolve the conversation. A successful completed call creates a customer order for Angela. |
| Marty, `c3` | Warehouse Specialist | Collects blanks from the finite receiving rack and carries them to the shared warehouse. |

The starting warehouse has staff snacks and drinking water, but no blanks or cartons. Angela's sourcing preference is `gather`, so she waits for the warehouse supply chain rather than buying substitute blanks. Their needs still take priority over work. Default friendly duels are disabled; quests are enabled. Turning Quests off stops new calls and recalls an ongoing call through the existing timed return; previously won orders can still ship.

Orders progress through `waiting-stock → fulfilling → shipped`. A waiting order reserves no imaginary stock. Once deposited cartons are available, the workflow asks the existing market authority to create an assigned delivery. Goods move through Angela's satchel and Dispatch inventory. The physical sale credits coins and produces a shipment receipt. Cancelling a delivery uses the existing cargo reclamation authority. A missing or exhausted receiving rack leaves work blocked, with its physical inventories and paid batches intact.

The shipping game reuses stable mechanic IDs: `wood` means inbound blanks, `planks` means packed orders, `bench` means the packing bench and `market` means Dispatch. Their names, recipes and visual models are authored data. Simulation decisions use capability and role references rather than Angela, Phil, Marty or the `office` pack ID.

## Export, edit and import

**Export this pack** exports the selected authored starts. **Capture current scene** exports the current simulation as a new editable start, including current work, customer orders, receipts, settings and complete catalogs. **Export story** preserves a portable continuation with the same libraries, simulation profile, environment and catalogs. Importing a pack requires reviewing and starting one of its scenes; validating a file does not change the playing world.

With the Node SDK:

```ts
import fs from 'node:fs';
import {toolbox} from './.generated/developer-sdk.cjs';

const game = toolbox.create({scenarioId: 'office', sceneId: 'operations-shift'});
try {
  game.advance(120);
  fs.writeFileSync('/tmp/office.pack.json', JSON.stringify(game.captureScenario(), null, 2));
  fs.writeFileSync('/tmp/office.story.json', JSON.stringify(game.story(), null, 2));
} finally {
  game.dispose();
}

const pack = JSON.parse(fs.readFileSync('/tmp/office.pack.json', 'utf8'));
const checked = toolbox.validateScenario(pack);
if (!checked.ok) throw Error(checked.errors.join('\n'));
const restored = toolbox.createScenario(pack, 'operations-shift');
try {
  restored.advance(30);
  console.log(restored.inspect());
} finally {
  restored.dispose();
}
```

CLI export and capture use the same authority:

```sh
node .generated/tools/scenario-cli.cjs export office /tmp/office.pack.json
node .generated/tools/scenario-cli.cjs validate /tmp/office.pack.json
node .generated/tools/scenario-cli.cjs capture /tmp/office.story.json /tmp/continued-office.pack.json
```

Edit `scenes[].initialState.colony.creatures[].name` to rename a teammate. Edit `scenarioWorkflow.roles[].label` and `actorId` to change a role's display name or assignment. Actor IDs remain stable; role labels never select behavior. Skills, physical workstation availability and research gates still apply to the actor you assign.

`scenarioWorkflow.deals` selects a quest, sales role, fulfillment role, item, quantity, cooldown and optional `venueBuildingId`. An onsite venue uses normal pathfinding before departure and retains the actor's physical position during the quest and return. A null venue retains ordinary offsite quests. `scenarioWorkflow.supply` selects role-owned gather/craft stock targets. Its bounded `activities` dictionary supplies task vocabulary without executing code. Pending demand counts as committed work when reviewing mechanical library changes.

Change `resources.assets` or `resources.creatures` to edit visuals or creature physiology. If the scene includes `initialState.scenarioResources`, update it to the same complete snapshot. Portable story imports similarly require their native resource snapshot to agree with the experience context. Creature definitions must retain the supported personal-field persistence contract, required ECS components and validated rig/profile references. New arbitrary runtime behavior remains unsupported.

`worlds[].environment` selects an indoor room and its background, floor, alternate floor, wall, trim and optional camera center/zoom. `nodePolicy: "profile-only"` keeps the authored terrain/count/site/node context without legacy resource augmentation. Office has exactly three initial nodes: receiving blanks, the water cooler and the staff snack cabinet. Graphics caches observe the world and asset revisions when switching settings.

## Persistence and verification

Pack schema 2 and portable story envelope 10 remain current. Native engine state 8 persists customer workflow, catalogs, settings and physical task/resource authority; native reconstruction is tested in its active definition/profile context. Use a portable story or full scenario when moving between independently configured contexts. Those formats additionally carry all four content libraries and the presentation/simulation context.

The registered `office-scenario` suite checks real customer calls, physical receiving/packing/dispatch, stock conservation, disabled quest behavior, native/story/capture continuation, a nonbundled visual binding, edited actors and roles, atomic invalid-import rejection, stale review rejection, bounded markers and shipment retention. A long normal shift crosses the market retention boundary. `office-browser` checks desktop/mobile indoor presentation, onsite sales calls, role labels, data-authored guidance, Canvas asset rendering and return to the default outdoor setting. These automated checks do not establish human comprehension or balance.
