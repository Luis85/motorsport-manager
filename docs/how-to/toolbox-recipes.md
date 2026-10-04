# Run bounded toolbox experiments

Use these recipes with the [developer toolbox](../reference/developer-toolbox.md). They use
application-owned isolated sessions; explicit approvals and domain validators
remain authoritative. Queries do not advance time, and snapshots are detached.
Run from the repository root with the pinned Godot 4.7.2 Standard binary.

## Native quickstart

Run this from native developer composition with the factory available. The first
step request deliberately stops at briefing. Starting optional practice and
resuming if paused then permits twenty physical ticks, without issuing a
managed-driver run or approving qualifying.

```gdscript
var loaded = GameToolboxFactory.create()
assert(loaded.ok)
var toolbox: GameToolbox = loaded.toolbox
var created = toolbox.weekends.create("weekend-a", {
    "circuit_id": "core.circuit.hillside",
    "weekend_id": "core.weekend.quick"
})
assert(created.ok)
assert(created.result.phase == "briefing")
var blocked = toolbox.weekends.step_ticks("weekend-a", 20)
assert(blocked.ok and blocked.result.completed == 0)
assert(toolbox.weekends.command("weekend-a", "practice_start").ok)
var state = toolbox.weekends.query("weekend-a")
assert(state.ok)
if state.result.paused:
    assert(toolbox.weekends.command("weekend-a", "pause").ok)
var advanced = toolbox.weekends.step_ticks("weekend-a", 20)
assert(advanced.ok and advanced.result.completed == 20)
var saved = toolbox.weekends.snapshot("weekend-a")
assert(saved.ok)
print(saved.result.fingerprint)
toolbox.close()
```

This checks bounded clock behavior. It does not claim a measured practice run or
completed weekend. For a standalone headless script, put its body in a
`MainLoop._initialize()` override and return `true` from `_process(delta)` after
it completes. This follows the production toolbox runner and avoids `SceneTree`
autoloads, including `App`. Existing native application composition can call the
API directly without creating a second loop.

## Python quickstart

Put `scripts/` on the Python module path, for example
`PYTHONPATH=scripts python3 your_recipe.py`. Select the pinned engine explicitly
or use `GODOT_BINARY`/`godot` on PATH. The SDK imports an isolated project and owns
one persistent native process for the context:

```python
from toolbox import ToolboxClient

with ToolboxClient(godot="/path/to/godot") as toolbox:
    created = toolbox.weekends.create("weekend-a", {
        "circuit_id": "core.circuit.hillside",
        "weekend_id": "core.weekend.quick",
    })
    assert created["phase"] == "briefing"
    assert toolbox.weekends.step_ticks("weekend-a", 20)["completed"] == 0
    toolbox.weekends.command("weekend-a", "practice_start")
    if toolbox.weekends.query("weekend-a")["paused"]:
        toolbox.weekends.command("weekend-a", "pause")
    advanced = toolbox.weekends.step_ticks("weekend-a", 20)
    assert advanced["completed"] == 20
    saved = toolbox.weekends.snapshot("weekend-a")
    print(saved["fingerprint"])
```

Named SDK methods and `call(operation, session, arguments)` return the unwrapped
detached `result`, raising `ToolboxDomainError` for native rejection.
`request(full_envelope)` retains the complete success/error envelope and execution
metadata. `ToolboxError` represents transport/protocol failures. Request IDs are
unique within a client context. Set a finite positive `timeout` when constructing
the client; use `packs=[...]` for addon directories in dependency order.

`file_mode=True` accepts one request or ordered batch per context. Use normal
stdio mode for incremental session operations. Separate CLI invocations start
separate contexts; a session created by one invocation does not survive into
another.

## Recipes: practice, campaign and track

For a real managed-driver practice run, obtain the approval assumptions from the
production preview. Run this inside an open client. The recipe uses a newly
created driver's actual set ID, requests at most 15,000 ticks, and checks measured
evidence rather than inferring a lap from elapsed time:

```python
created = toolbox.weekends.create("practice-a", {
    "circuit_id": "core.circuit.hillside",
    "weekend_id": "core.weekend.quick",
})
driver_id = created["player_ids"][0]
car = toolbox.weekends.query("practice-a", "car", {"id": driver_id})
plan = {
    "objective": "tyre_life", "set_id": car["tyre_sets"][0]["id"],
    "laps": 1, "baseline": "balanced",
}
toolbox.weekends.command("practice-a", "practice_start")
preview = toolbox.weekends.query("practice-a", "practice_preview", {
    "id": driver_id, "plan": plan,
})
assert preview["available"], preview["reason"]
toolbox.weekends.command("practice-a", "practice_run", {
    "id": driver_id, "plan": plan, "revision": preview["revision"],
    "key": preview["key"], "time": preview["time"],
})
advanced = toolbox.weekends.step_ticks("practice-a", 15000)
evidence = toolbox.weekends.query("practice-a", "practice", {"id": driver_id})
assert evidence["driver"]["runs"][0]["samples"]
```

Check the returned tick count and current phase before any subsequent request.
This records one bounded practice sample; it does not complete the weekend or
prove that this setup or tyre choice is optimal.

Within an open client, this campaign recipe creates the authored starter career,
inspects its current state, advances through the existing Director transaction,
and inspects readiness. It does not run or settle a weekend:

```python
toolbox.campaigns.create("career-a", "core.campaign.team-principal")
before = toolbox.campaigns.query("career-a", "overview")
toolbox.campaigns.advance("career-a")
readiness = toolbox.campaigns.query("career-a", "readiness")
print(readiness)
checkpoint = toolbox.campaigns.snapshot("career-a")["checkpoint"]
```

When readiness permits, `campaigns.depart("career-a", "event-a")` creates the
owned weekend. Operate on `weekends` with session `event-a`, perform the explicit
approvals and physical running, then call `campaigns.settle("career-a", "event-a")`
only after results. Settlement does not accept an arbitrary caller-supplied
receipt as a shortcut.

This editor recipe works on a detached document and commits with the observed
revision. Undo/redo use the same canonical editor owner:

```python
opened = toolbox.tracks.create("track-a", {
    "circuit_id": "core.circuit.hillside",
})
draft = opened["document"]
draft["name"] = "Toolbox study circuit"
committed = toolbox.tracks.commit("track-a", draft, opened["revision"])
assert committed["revision"] > opened["revision"]
assert toolbox.tracks.undo("track-a")["document"]["name"] != draft["name"]
assert toolbox.tracks.redo("track-a")["document"]["name"] == draft["name"]
publication = toolbox.tracks.validate("track-a", publication=True)
print(publication["valid"], publication["errors"])
```

`validate` succeeding means the check executed; its `valid` field indicates
whether the document satisfies that policy. A safe unfinished draft may fail
publication checks. `compile` returns detached runtime/diagnostics values and
does not save a circuit file. Neither recipe changes the source content pack.

## Report and close the experiment

Report actual completed ticks, source/engine identity, observed facts and rejected
actions. Preserve the full active campaign continuation when exporting a career.
Close native sessions and use the Python client context manager to release its
process. A bounded recipe does not establish balance or human usability.
