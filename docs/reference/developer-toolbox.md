# Developer toolbox

The toolbox runs real game operations from GDScript, Python or versioned JSON.
It assembles validated content and application-owned sessions without launching
`App`, opening a pitwall or writing player saves. Inspect the live discovery
catalog before composing a recipe; domain owners still decide whether an action
is valid in the current phase.

The [adoption study](../explanation/developer-toolbox-adoption.md) explains the product
model, state-space graph and concrete Excalibur source/tests studied. The
[architecture map](../explanation/architecture.md) defines the underlying ownership.

## Ownership and lifecycle

`GameToolbox` is an application facade over typed `weekends`, `campaigns` and
`tracks` facets. `GameToolboxFactory` supplies a sealed catalog from ordered core
and optional addon packs. The JSON runner and Python SDK call those same facets.
Operations use explicit allowlists; JSON cannot supply a method name for arbitrary
reflection, inject executable mechanics or receive live aggregate objects.

Session IDs identify tool lifetimes, not content, sporting entrants or saved
careers. Each facet accepts at most 32 process-local sessions. IDs use 1–64 ASCII
letters, digits, `_`, `.`, or `-`, beginning with a letter or digit. Use a new ID
after closing a session. Close owned sessions and dispose the client when done.
Failed creation or restoration retains any existing authority intact.

Tool sessions remain in memory. A snapshot exports the existing production save
value; saving that value to a chosen file is an explicit caller operation.
Campaigns publish one complete checkpoint after successful transactions.
Departure attaches an actual tool-owned weekend; settlement consumes its own
finished recording and the exact frozen manifest. Restoring a race checkpoint
does not fabricate its prior recording or historical event stream.

Keep the complete `campaigns.snapshot` result for active careers: its
`active_weekend` continuation carries the owned recording and weekend handle.
Pass that complete result to `campaigns.restore` to resume the same event in a
fresh toolbox. An inactive raw campaign checkpoint remains supported; a raw
active checkpoint is rejected because it would strand the pending weekend.
An already-used continuation weekend ID conflicts rather than replacing another
authority; use a fresh toolbox or explicitly choose a fresh continuation ID.
Track snapshots contain document/revision and history depths; undo/redo history
remains session-local. Open an exported track document through `tracks.create`
with `configuration.document` to start an independent editor lifetime.

## Discover operations

`toolbox.discover` returns descriptors for the implemented operations. Each has an
`operation`, native `method`, description, argument JSON schema, `clock`,
`persistence` and examples. Facet discovery also describes supported query views
and planning actions where provided. Schemas describe transport structure;
production validators retain semantic acceptance authority.

Global content discovery and inspection use `content.list`, `content.inspect`
and `content.schemas`; `mechanics.list` describes registered code providers.
Content pack order, dependency versions and explicit overrides retain the
[existing content contract](content/README.md). For file authoring, continue using
`scripts/content.py`; for provider authoring use
[the mechanics guide](../how-to/developing-mechanics.md).

## Named native methods

Composition may inject an already sealed catalog with
`GameToolbox.new(catalog, metadata)`. Standalone native tooling can instead use
`GameToolboxFactory.create(pack_roots, metadata)`, which returns
`{ok: true, toolbox: GameToolbox}` or a structured failure. `pack_roots` is an
ordered array of addon directories; the factory loads core content first. The
factory result intentionally contains the facade for composition, while operation
results contain detached values only.

`GameToolbox.execute(request)` handles a protocol request, `describe()` returns
operation descriptors, and `close()` releases all facet sessions. Native composition
may pass a third constructor argument to impose a smaller response budget, bounded
to 4 KiB–64 MiB; an out-of-range value selects the default 64 MiB. Discovery
reports that instance's actual limit. Native metadata identities longer than
128 characters become empty (unknown), preserving valid source hashes whole. The factory is
a service composition boundary; it does not supply time from `App`.

The table is an orientation to the public facets. Discovery is the executable
capability inventory, including each action/view's exact arguments.

| Facet | Methods | Existing authority |
|---|---|---|
| `weekends` | `create`, `restore`, `command`, `query`, `step_ticks`, `advance_elapsed`, `snapshot`, `recording`, `events`, `close` | `WeekendLaunch`, `PracticeRaceSim`, `RaceCommands`, `RaceSessionRunner`, detached queries and `RaceRecord` |
| `campaigns` | `create`, `restore`, `snapshot`, `query`, `command`, `advance`, `depart`, `settle`, `close` | Authored campaign creation, complete checkpoint readers and existing campaign transactions/queries |
| `tracks` | `create`, `read`, `snapshot`, `validate`, `commit`, `edit`, `undo`, `redo`, `cancel`, `compile`, `close` | `TrackEditorSession`, pure `TrackEdit`, draft/publication validation and compilation |

A weekend configuration selects `circuit_id` and `weekend_id`, with optional
supported `overrides`, or selects a `scenario_id` alone. These are validated
content IDs. Creation starts at the actual initial briefing phase; it does not
approve or complete sessions implicitly. Commands use the existing action name
and explicit payload. A pace or engine command targets an entrant ID returned by
the created session; a tool session ID is not an entrant ID.

Planning views expose the existing owner-produced drafts and previews.
`practice` supplies current driver/session evidence and supported objective and
baseline choices; `practice_preview` accepts an explicit `id` and `plan`.
`strategy_draft`/`strategy_forecast` and `tactical_draft`/`tactical_preview` expose
their respective planning boundaries. `team_orders`, `recovery`, `decisions` and
`setup` provide detached specialist read models. Consult each view's parameter
schema in discovery, check availability, and use the returned key, revision and
observation time in the corresponding existing approval command. Do not fabricate
approval tokens or treat a forecast as an accepted order.

Campaign `command` selects an explicitly supported planning action. Campaign
`advance` uses the Director transaction to reach the next registered departure
and settle existing due obligations. It does not expose bare clock mutation.
Readiness queries show blockers without spending cash, reserving resources or
advancing time. Active-weekend planning freezes remain enforced.

## Quickstarts and task recipes

See [Run bounded toolbox experiments](../how-to/toolbox-recipes.md) for native/Python
quickstarts, measured practice, campaign readiness and track-editing recipes.
The protocol and lifecycle contract below also applies to those workflows.

## Clocks, approvals and observations

The race step remains **0.05 seconds**. `step_ticks(session, count)` accepts an
integral count from 1 to 20,000 and requests exact physical ticks. It stops at
pause, completion or inactive approval boundaries, reporting actual progress.
Check the returned completed count and stop reason before assuming the full
request ran. Reading a query or sleeping in the calling process advances nothing.

`advance_elapsed(session, seconds)` supplies a finite value from 0 to 0.25 to the
production runner. Playback speed, accumulated residual and pause affect actual
steps. It is distinct from exact fixed-tick stepping; equal supplied elapsed
time alone is not a determinism guarantee. Campaign time uses separate dated
15-minute slots and never follows race ticks or the wall clock.

Practice, qualifying, grid/formation, start and results retain their explicit
player approvals and physical return requirements. An accepted pit request is
an intention; service and exit require physical running. The toolbox preserves
arithmetic, random draws, provider ordering and resource rules.

`events` drains bounded detached observations. Transport sequence numbers and
reported drops describe that observer queue, not a second sporting journal.
Draining events does not erase production history. Restore does not re-emit
historical observations. Use `snapshot` for durable state and `recording` for an
available production replay record; use the
[reproduction tools](../how-to/developing-mechanics.md) for retained divergence evidence.

## JSON protocol

CLI discovery and a stateless content inspection:

```sh
python3 scripts/toolbox.py discover --godot /path/to/godot
python3 scripts/toolbox.py call content.inspect --arguments '{"id":"core.weekend.quick"}' --godot /path/to/godot
```

Use `request path.json` for a full request envelope or `batch path.json` for an
ordered recipe. Either accepts `-` to read stdin. CLI stdout contains JSON;
diagnostics go to stderr. Exit status is 0 for native success, 1 for native
rejection and 2 for transport/protocol failure. Add `--pack` for each addon in
dependency order or `--file-mode` to use the one-invocation file transport.

Save the following array as `recipe.json`, then run
`python3 scripts/toolbox.py batch recipe.json --godot /path/to/godot`. All three
operations share the same native context. The quick preset starts unpaused;
this recipe starts optional practice and requests twenty ticks:

```json
[
  {
    "protocol": "motorsport-manager-toolbox", "version": 1,
    "request_id": "create-1", "operation": "weekend.create",
    "session": "weekend-a",
    "arguments": {"configuration": {
      "circuit_id": "core.circuit.hillside",
      "weekend_id": "core.weekend.quick"
    }}
  },
  {
    "protocol": "motorsport-manager-toolbox", "version": 1,
    "request_id": "start-1", "operation": "weekend.command",
    "session": "weekend-a", "arguments": {"action": "practice_start"}
  },
  {
    "protocol": "motorsport-manager-toolbox", "version": 1,
    "request_id": "step-1", "operation": "weekend.step_ticks",
    "session": "weekend-a", "arguments": {"count": 20}
  }
]
```

A request names protocol version, request ID, operation, optional session and
arguments. For example, this global inspection advances no clock:

```json
{
  "protocol": "motorsport-manager-toolbox",
  "version": 1,
  "request_id": "inspect-1",
  "operation": "toolbox.discover",
  "arguments": {}
}
```

Responses preserve the request identity and contain either
`{"ok": true, "result": ...}` or
`{"ok": false, "error": {"code": ..., "message": ..., "details": ...}}`.
Execution metadata reports `engine_executed`, actual engine identity and known
source revision/digest. Native facet calls return the same result/error shape
without the transport envelope. Check `ok` before reading `result`; retain the
production owner's error message when reporting rejection.

`toolbox.batch` accepts at most 128 full requests under `arguments.requests`,
with `stop_on_error`. It runs in order. Successful prefix operations remain
applied; failed and skipped outcomes are explicit. A batch is not atomic.
The outer batch result confirms batch execution; inspect each entry of
`result.responses` for its own `ok` value. An outer success and CLI exit 0 do not
mean every nested operation succeeded. Requests are bounded to 8 MiB; compact
UTF-8 JSON responses are bounded to 64 MiB, including the complete response
envelope. Discovery publishes `limits.response_bytes`; the native default is
`GameToolbox.MAX_RESPONSE_BYTES`. Request IDs use the same 64-character identifier
syntax as session IDs.

If a response cannot fit, its correlated receipt reports `RESPONSE_LIMIT` with
`error.details.executed`, `limit_bytes` and `required_bytes`. `executed: true`
means the operation was dispatched; its effects may already have applied even
though its complete result could not be returned. Actual values are never
partially truncated. For a batch, space is reserved for every remaining receipt
before execution. Accepted prefix receipts stay complete, the overflowing current
receipt reports `RESPONSE_LIMIT`, and all later receipts report `SKIPPED` with
`executed: false`, regardless of `stop_on_error`. The batch then reports
`stopped: true` and remains non-atomic. If even the reserved batch envelope cannot
fit, no child operation executes and the outer failure reports `executed: false`.
For batch failures, `required_bytes` includes the envelope and reserved future
receipts. The persistent client remains usable after a bounded limit response.

The production runner is `res://scripts/services/toolbox/cli.gd`. Persistent
stdio mode emits one `TOOLBOX_READY` JSON marker after startup, then one
`TOOLBOX_RESULT` response per newline request. File mode uses explicit
`--toolbox-request` and `--toolbox-response` paths. The SDK manages import,
isolated user/cache directories, framing, timeout and process cleanup; direct
runner callers must handle those lifecycle responsibilities themselves.

## Errors and reproducible experiments

Unknown operations, unsupported views, invalid arguments and domain rejection
return explicit failures. Reads or mutations requiring an available session reject
a closed handle; facet close can be repeated safely. `DOMAIN_REJECTED` carries the owner's
message without classifying game errors by their prose. A protocol/result success
marker cannot override a Godot script error or failed engine startup. Missing
execution is never reported as validated gameplay.

Use a known source, validated configuration, seed, accepted command schedule and
completed tick counts when comparing runs. Read values are detached; editing a
returned snapshot does not mutate its session. Rejected commands may update
feedback but cannot change sporting state, resources, random state or accepted
input journals. Failed track commits preserve canonical revision/history;
failed campaign transactions publish no partial consequences.

Treat a bounded experiment as evidence for its executed sequence. It cannot
establish full-weekend completion, balance, human usability or hardware
performance without those separate checks. Required registered verification and
the existing save-compatibility/sporting corpus remain mandatory.
