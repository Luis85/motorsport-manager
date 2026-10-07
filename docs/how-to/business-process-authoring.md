# Author and simulate a business process

Use the checked-in `bin/wildlands` and `bin/scene-forge` with Node.js 22+.
No build or dependencies are needed to run these tools. The
[process contract](../reference/business-process-engine.md) defines the supported
semantics and limits. This workflow starts with definitions and then builds scenes.

## Create a process incrementally

Run from the repository root and choose a new output directory:

```sh
mkdir -p /tmp/process-work
bin/wildlands process discover
bin/wildlands process schema --kind definition
bin/wildlands process schema --kind recipe
bin/wildlands process create --id my-process --name "My process" --output /tmp/process-work/process.json
bin/wildlands process inspect --input /tmp/process-work/process.json
```

`inspect` returns the current revision and fingerprint. The fingerprint covers
all definition values and ignores object key order. Preserve both in every edit
recipe. It is a change guard, not a cryptographic signature.

Write `/tmp/process-work/edit.json`, using the fingerprint you just read:

```json
{
  "expectedRevision": 0,
  "expectedFingerprint": "REPLACE_WITH_INSPECT_FINGERPRINT",
  "operations": [
    {"op": "putResource", "value": {"id": "analyst", "name": "Analyst", "capacity": 1, "costPerMinute": 2}},
    {"op": "putStep", "value": {
      "id": "work", "name": "Review request", "kind": "task",
      "duration": 12, "resources": {"analyst": 1},
      "scene": {"id": "scene-work", "position": [12, 0], "color": "#ffbb73"}
    }},
    {"op": "setArrivals", "value": [{"at": 0, "count": 3, "interval": 4, "data": {}}]}
  ]
}
```

```sh
bin/wildlands process edit --input /tmp/process-work/process.json --recipe /tmp/process-work/edit.json --dry-run
bin/wildlands process edit --input /tmp/process-work/process.json --recipe /tmp/process-work/edit.json --output /tmp/process-work/review.json
bin/wildlands process validate --input /tmp/process-work/review.json
bin/wildlands process inspect --input /tmp/process-work/review.json
```

`putStep`, `putFlow`, and `putResource` replace complete definitions. Keep fields
you intend to retain. A recipe is one transaction: every operation succeeds and
the resulting definition passes admission, or nothing is written. References
may point to definitions added later in the same recipe. Unknown operations and
fields fail. Output cannot overwrite input, including hard-link/symlink aliases. Argument errors
(missing, duplicate or unknown options, non-numeric `--minutes` or
`--expected-revision`, `--dry-run` with `--output`) exit 2 before any work; see the
[option tables](../reference/wildlands-cli.md#business-processes).

For a longer graph, use `edit --draft` while adding unconnected steps and flows.
Drafts still pass structural and asset validation; their graph diagnostics are
returned explicitly. `inspect` can inspect them and returns `runnable: false`
and `snapshot: null`. Resolve every diagnostic before `run` or `build`; `forge` and `attach` require an admitted definition.
Use `--dry-run --draft` to preview an intermediate edit without writing.
On a stale guard, inspect again and reconcile the intended change; do not retry
with a guessed revision. `removeStep`, `removeFlow`, `removeResource`, `setStart`
and `rename` complete the supported edit vocabulary.

## Add branching and parallel work

- Give a decision at least two outgoing flows, exactly one without `when` as the
  fallback. Conditional flows compare a scalar case field. The first matching
  condition in definition order wins; the fallback is evaluated last.
- Give a fork a `join` step ID. Its branches must be disjoint task chains ending
  at that join. Each branch may write different case fields using task `set`.
- For rework, route a decision back to a task outside a parallel region. The task
  can clear a boolean such as `needsRework` before the next decision.
- Resource demands are simultaneous. A task needing designer and developer
  waits until both are available. There is no hidden staff capacity.

The complete [agency example](../concepts/agency-delivery/README.md) demonstrates
all of these rules in its [JSON definition](../concepts/agency-delivery/content/agency.process.json).

## Author each step scene with Scene Forge

```sh
bin/wildlands process forge --input /tmp/process-work/review.json --output /tmp/process-work/forge
bin/scene-forge -p /tmp/process-work/forge catalog
bin/scene-forge -p /tmp/process-work/forge inspect --source
bin/scene-forge -p /tmp/process-work/forge validate
bin/scene-forge -p /tmp/process-work/forge littlewild sync --file /tmp/process-work/forge/littlewild.export.json
```

`forge` needs an existing parent directory and a directory that does not yet exist.
The new project has one scene and one editable starter model for every process
step, an export manifest, and a process-to-scene map. Use Scene Forge's guarded
batch operations to add props, character models and other geometry. Follow its
[agent protocol](../../source/scene-forge/AGENTS.md). The scaffold does not
convert existing attachments: these are retained verbatim in `existing-assets`
and can be brought into Scene Forge with `littlewild import` for exact editing.

Attach an exported model to the process step. Read fresh guards from `inspect`:

```sh
bin/wildlands process attach --input /tmp/process-work/review.json --step work --asset /tmp/process-work/forge/exports/items/scene-work/definition.json --expected-revision 1 --expected-fingerprint REPLACE_WITH_INSPECT_FINGERPRINT --dry-run
bin/wildlands process attach --input /tmp/process-work/review.json --step work --asset /tmp/process-work/forge/exports/items/scene-work/definition.json --expected-revision 1 --expected-fingerprint REPLACE_WITH_INSPECT_FINGERPRINT --output /tmp/process-work/visual.json
```

The `visual` facet becomes `step.scene.asset`; a bare `littlewild-3d-asset` is
also accepted. It must have a `world` model. The existing engine asset validator
and renderer handle supported primitives and bounded baked meshes. Exported
assets carry meters, Y-up and radians; Scene Forge recipes use degrees and the
exporter converts them. Materials/meshes travel inside the process JSON.
The [agency Scene Forge project](../../source/scene-forge/examples/agency-delivery/forge.project.json)
is the editable source of the demo's attached scene geometry.

## Run and build

```sh
bin/wildlands process run --input /tmp/process-work/review.json --minutes 100 --output /tmp/process-work/report.json
bin/wildlands process build --input /tmp/process-work/review.json --output /tmp/process-work/process.html
bin/wildlands validate-game --game docs/concepts/agency-delivery
bin/wildlands build-game --game docs/concepts/agency-delivery --output /tmp/process-work/agency.html
```

The report binds the complete definition and its fingerprint to the observed
snapshot. It includes business-minute time, resource utilization, queues, cost,
cycle time, completed and failed cases. The event tail retains the latest 128
events; aggregate metrics retain the complete run. A run may finish earlier than
the requested horizon when all scheduled cases have ended. It does not execute
real services or update external systems.

Open the HTML directly. Use **Run simulation**, **Pause**, **Step 1 min**,
**Advance 30 min**, and **Reset run**. **2D** and **3D** show one simulation;
**Step scenes** and **Whole process** change the view without advancing time.
**Definition editor** offers validation before **Apply draft & reset run**.
Unapplied edits stay in the draft when you switch to Activity. **Export draft**
saves that text exactly, including unfinished JSON. **Export JSON** and
**Download HTML** continue to use the active definition until you apply a valid
draft. Editing clears the previous validation result; validate again before applying.
A rejected import retains the previous definition and run.
Use **Inputs & outputs** beneath either view to select a case. **Whole process**
shows its arrival fields and, after completion, final outputs. Select a task to
compare its captured inputs with completed outputs; **Visit** lets you inspect
retained rework visits. Until completion, authored effects are labeled
**Expected changes**. Waiting work has no captured task inputs yet. Reports
retain the latest 128 task completions, with an explicit omitted-record count.

In 3D, active work appears as desk actors typing and reviewing screens while
playback runs. Pause freezes their motion; reduced-motion preferences disable
it. Additional work uses bounded markers, with counts preserving total activity.
Focus the canvas to orbit with arrow keys, pan with Shift+arrows or WASD (or right-drag), zoom with +/−, or frame with F. In 2D, drag to pan, scroll or pinch to zoom, and press 0 to reset. Use **Run until** in the toolbar to choose a run length or Unlimited, and the **Tune values** form in the Definition editor to fine-tune an agent-built process before applying it.

**Export run report** downloads observed results, including retained task I/O. **Download HTML** embeds the
active definition and starts a fresh paused run when reopened. There is no
checkpoint import or automatic browser persistence in v1.

For reusable game folders, copy the agency `game.json` shape, choose an ID equal
to the folder name, set `template: process`, and point `content.definition` at
the process JSON. Set matching storage/output IDs. Keep the folder data-only.
The build has no external scripts, fonts, asset requests or account dependency.

## Agent completion checklist

1. Inspect and retain exact edit guards.
2. Dry-run complete transactions; review diagnostics and changed definitions.
3. Validate the complete graph and scene assets.
4. Run bounded cases covering each decision outcome, contention and rework.
5. Review actual Scene Forge views and both process projections where a browser
   is available; a headless simulation result does not certify visual quality.
6. Build the HTML and reopen it offline, then export/reimport JSON and HTML.
7. Report the source identity, executed tests, assumptions and unsupported rules.
