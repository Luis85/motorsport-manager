# Balancing configuration

The shipped `config/` catalog makes selected game parameters editable as
versioned JSON. The baseline values are unchanged. The content loader validates
selected definitions and circuits, while the balancing CLI also checks all
scenario collections and the complete JSON inventory. The resulting race tuning
or campaign policy is frozen into its runtime/save. Editing a file therefore
affects later selections and new runs; it does not retune an existing save.

## What can be tuned

`config/race_tuning/default.json` contains the path-race model and may include an
optional `balance` object with `model: "game-balance-v1"`. Its named groups
cover `tyre_incidents`, `procedure`, `courtesy`, `pit_motion`, `motion`,
`practice`, `strategy_defaults`, `tactical_policy`, `forecast` and
`presentation`. Together these groups expose 126 numeric tuning fields. Each
leaf has a published description, unit and accepted minimum/maximum in the
generated
[`race_tuning` schema](../../content/schemas/v1/race_tuning.schema.json). Inspect
the field metadata before choosing a value; many coefficients are rates or
multipliers, not percentages. The model string and group names are versioned
contract values.

When `balance` is absent, the game retains the legacy frozen behavior. This is
intentional for compatibility with existing records; add the complete optional
model through an authored configuration when you want those policies active.
Other race tuning groups and their physical constraints are documented in
[`race-tuning-fields.md`](../reference/content/race-tuning-fields.md),
[`reliability-and-control.md`](../reference/content/reliability-and-control.md),
[`weather-and-surface.md`](../reference/content/weather-and-surface.md), and
[`competition-and-ai.md`](../reference/content/competition-and-ai.md).

`config/campaigns/` includes explicit finance policy under
`tuning.finance`: `distress_forecast_days` defaults to `30`,
`bridge_maturity_days` defaults to `30`, and `bridge_fee_bps` defaults to
`1000` basis points. The two day values accept integers from `1` through
`3660`; the fee accepts `0` through `10000` basis points.
See the generated
[`campaign` schema](../../content/schemas/v1/campaign.schema.json) for accepted
values and [campaign content](../reference/content/campaigns.md) for policy fields.
The [campaign finance guide](../reference/campaign/finance-commitments-forecast.md) explains
how forecasts and binding bridge commitments behave. These values do not bypass
the campaign's cash, due-date or transaction rules. Existing bridge agreements keep their originally agreed
repayment when tuning changes; the default fee preserves the prior rounding
behavior.

## Inspect, edit and validate

The Python CLI uses `scripts/balance.py`. Pass the pinned Godot binary explicitly
for validation and edits. `--config-dir` selects a configuration catalog;
without it the repository's `config/` is used. Select the engine with `--godot`,
`GODOT_BINARY` or `VERIFICATION_TEST_GODOT`; native commands require the exact
pinned Godot 4.7.2 build and do not select an arbitrary engine from `PATH`.

```sh
python3 scripts/balance.py --godot /path/to/pinned/godot list --kind race_tuning
python3 scripts/balance.py inspect race_tuning/default.json /balance/forecast
python3 scripts/balance.py inspect campaigns/team-principal.json /tuning/finance
python3 scripts/balance.py validate --godot /path/to/pinned/godot
```

`list` and `inspect` are read-only. Without Godot they use the generated
published schemas and report `engine_executed: false`; they do not validate the
whole catalog or establish that the current native loader accepts it. Native
catalog validation and all writes require the pinned engine. Commands emit
machine-readable JSON on stdout; success exits `0`, a rejected operation exits
`1`. Check `ok` and `engine_executed` in the returned object.

Use JSON Pointer paths (for example `/balance/forecast/field`) to target an
existing scalar. `JSON_VALUE` is a JSON value, so quote it as one shell
argument. The editor rejects unknown paths, structural changes, identity or
metadata edits, and values outside the schema's limits.

```sh
# Preview: native validation runs against the full catalog; nothing is written.
python3 scripts/balance.py --godot /path/to/pinned/godot set \
  race_tuning/default.json /balance/procedure/lights_seconds 6.5 --dry-run

# Apply the same edit atomically, after the same validation.
python3 scripts/balance.py --godot /path/to/pinned/godot set \
  race_tuning/default.json /balance/procedure/lights_seconds 6.5

# Revalidate after a batch of reviewed edits.
python3 scripts/balance.py --godot /path/to/pinned/godot validate
```

The lights example demonstrates syntax only; it is not a recommended tune.
Choose fields and values from `inspect`. Dry-run output includes the
proposed change, published field bounds and description, and
`published: false`. A successful `set` validates the entire catalog before an
atomic file replacement, so a locally valid number cannot leave the catalog in
a globally invalid state.

## Compare controlled variants

Keep the baseline and experiments in separate copied config directories. Apply
the same authored edit and validate each copy before running the game with it.
`diff` compares JSON values and is read-only; it works offline and returns
`engine_executed: false`.

```sh
cp -a config /tmp/balance-a
cp -a config /tmp/balance-b

python3 scripts/balance.py --config-dir /tmp/balance-b --godot /path/to/pinned/godot \
  set race_tuning/default.json /balance/procedure/lights_seconds 6.5
python3 scripts/balance.py --config-dir /tmp/balance-a --godot /path/to/pinned/godot validate
python3 scripts/balance.py --config-dir /tmp/balance-b --godot /path/to/pinned/godot validate
python3 scripts/balance.py --config-dir /tmp/balance-a diff /tmp/balance-b
```

Use the same game build, roster, circuit, scenario, seed and player command
sequence for both runs, and retain both config copies with the run evidence.
The comparison command only describes file differences; it does not run a
simulation or decide whether a change improves play. `--config-dir` selects the
catalog for this CLI only; the game loads `res://config`. To execute each
variant, put its complete copied catalog in `config/` inside an isolated project
copy, then run the same game or toolbox recipe from each copy with the same
pinned engine. From the project root, the setup is:

```sh
cp -a . /tmp/balance-project-a
cp -a . /tmp/balance-project-b
cp -a /tmp/balance-a/. /tmp/balance-project-a/config/
cp -a /tmp/balance-b/. /tmp/balance-project-b/config/
```

Run your existing native game or toolbox recipe against each project copy; the
toolbox guide documents native, JSON and Python entry points. The configuration
root is sealed by project composition, so the copied project determines which
catalog a run selects.

## Inspecting actual game behavior

The native toolbox, its JSON protocol, and Python client are for inspecting and
running supported game operations. They do not provide an SDK shortcut for
configuration changes or live game-state mutation. Use `scripts/balance.py`
for configuration changes, then use `GameToolboxFactory.create` in native code,
`content.inspect` over the JSON protocol, or `ToolboxClient` in Python with the
supported discovery and queries documented in the
[developer toolbox guide](../reference/developer-toolbox.md). Those inspect actual content
and operations; they do not edit the config catalog. Keep the exact catalog
with experiment records: a run's frozen tuning cannot be changed through later
file edits.

## Runtime and safety boundaries

Configuration controls existing policies and coefficients. It cannot change
code-owned serialization versions, fixed-step clocks, work caps, command
allowlists, save migration rules or validation invariants. The validator also
checks cross-field and physical limits that a per-field range cannot express.
Keep those invariants intact when authoring a variant.

At the native boundary, `RaceTuningDefinition` validates and freezes selected
race tuning; `RacePhysicsBalance` owns physical balance fields and their bounds,
`RacePlanningBalance` owns practice, strategy, forecast and tactical-policy
inputs, `RacePresentationBalance` owns display/check-in thresholds, and
`CampaignFinanceBalance` supplies frozen finance defaults and repayment policy.
The generated JSON schemas expose their supported data contract to authoring
tools. These APIs do not turn safety floors, serialization rules, or fixed-step
simulation contracts into balance knobs.

Use validated copied catalogs for experiments and keep a record of the exact
configuration, engine identity, seed and executed actions. Native/schema tests
show that files satisfy defined contracts; bounded simulations check only the
steps actually run. Neither proves good game balance, a completed race, or
human accessibility. Those need separate play and user evaluation.
