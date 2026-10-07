# Explore the RTS demonstration

This tutorial uses the TypeScript Wildlands maker extended from PR 25. It leaves
native race and campaign saves under their own existing authorities. The demo is
an original isometric RTS scenario showcasing the engine's data-driven ECS
mechanics. See the [RTS reference](../reference/rts-engine.md) for ownership,
content contracts and tool budgets. The shipped catalog lives in the
[RTS Frontier game folder](../concepts/rts-frontier/README.md).

## Build and open the maker

From the repository root:

```sh
cd source/wildlands
npm ci
npm run typecheck
npm run build
```

Open the generated maker HTML using the existing
[maker instructions](../../source/wildlands/README.md). Click **RTS demo** in the maker toolbar. The demo map should display an isometric battlefield,
units, buildings and resource deposits. Inspect the selected faction's resources
and population before issuing an order.

Use selection and contextual orders to move units, send workers to resource
deposits, construct buildings and train units. Observe progress rather than
assuming an accepted order completes the work immediately. Explore research and
abilities, then combat and objectives. Right-click a target to give a contextual
order, or choose **Move**, **Attack move**, **Attack**, **Gather**, **Repair / build**
or **Stop** and tap its target. **Export checkpoint** saves the match, **Export game
data** exports the editable catalog, and **Open JSON** imports the selected game
data or checkpoint. Imports are admitted before replacement and open paused. Select one unit to
inspect **Buy supplies**; purchasing an item spends the shown resources and adds
its charges to inventory. Move next to an authored pickup and collect it, then
use its ability on an allowed target. Research unlocks prerequisite-gated units;
observe the training refusal before unlocking the required technology. The same catalog defines the visible
archetypes and their runtime costs, rates and effects.

For keyboard orders, open **Units & visible targets**, select your own unit, and
choose an order, a structure under **Construct**, or an **Abilities** action.
Choose **Visible target** for gathering, targeted attacks, repairs, pickups, or
abilities. This fills the target position without changing your unit selection.
For movement or construction, choose **Terrain / position** and enter **Tile X**
and **Tile Y**. Press **Apply selected order** and read the accepted or rejected
feedback. The application validates targets, placement, resources, and abilities.

Pause before inspecting a selected entity. Selection, camera changes and display
refresh do not advance its simulation clock. Resume to observe the accepted order
progressing. Click **Return to colony** in the RTS header; it remains a distinct
game context.

To author your own starting arrangement, open **Mission editor** in the RTS
toolbar and follow [mission authoring](../how-to/rts-mission-editor.md). Its draft
is separate from the match; only explicitly playing the draft replaces the match
with a fresh paused session.

## Inspect the exact data

The CLI emits JSON. Discovery and content inspection create no running match:

```sh
node .generated/tools/rts-cli.cjs discover
node .generated/tools/rts-cli.cjs catalog rts-catalog.json
node .generated/tools/rts-cli.cjs validate rts-catalog.json
node .generated/tools/rts-cli.cjs inspect
```

Validation should report `ok: true`. Inspection names the mission, counts each
catalog family and reports starting entities and deposits. Edit a copy of the
exported catalog, validate it again, and supply that file as the optional catalog
to `run`. A live match retains the content supplied at its creation.

## Run and resume a bounded experiment

Create `rts-recipe.json` with this JSON:

```json
{"ticks":100,"commands":[],"stopOnError":true}
```

Then run:

```sh
node .generated/tools/rts-cli.cjs run rts-recipe.json rts-save.json
node .generated/tools/rts-cli.cjs restore rts-save.json rts-recipe.json rts-resumed.json
```

Read `startTick`, `endTick`, `completedTicks` and `stopReason` in the output. If
the mission ends early, fewer ticks may complete. The second run begins at the
saved tick rather than recreating the initial mission. It writes a distinct file;
an output cannot overwrite one of that command's inputs.

For a scheduled command, use an entity and faction ID from the returned snapshot,
then add `{ "atTick": 0, "command": { ... } }` to the recipe's `commands` array.
Use an action supported by the current command contract. Check its receipt's
`ok` and `message`; an invalid target should be reported as rejected, and the
default run should stop with `stopReason: "command-rejected"`. No command may
bypass construction, resource, faction or targeting rules.

This route confirms the executed bounded sequence and save continuation. It does
not establish RTS balance, native export parity or human usability; those require
separate evidence against the final source.
