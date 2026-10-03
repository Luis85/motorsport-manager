# Game configuration

`config/` is the shipped, data-driven game configuration catalog. Each file is
JSON and is loaded and checked as one catalog before a new run or campaign uses
it. Start with `pack.json` for the catalog manifest and
`race_tuning/default.json` for the simulation's reference parameter set.

| Directory | Contents |
|---|---|
| `race_tuning/` | Race model coefficients and optional `balance` policy |
| `vehicles/`, `drivers/`, `teams/`, `rosters/` | Vehicle, driver, team and entrant definitions |
| `tyres/`, `tyrethermals/`, `allocations/` | Tyre behavior, thermal rules and event allocations |
| `setups/`, `weekends/` | Setup definitions and weekend presets |
| `campaigns/` | Campaign profiles, including finance forecast and bridge policy |
| `mechanic_profiles/`, `editor_profiles/` | Workshop and editor defaults |
| `circuits/`, `scenarios/` | Track definitions and authored situations |

`content/schemas/v1/` contains generated schema documents and remains part of
the validation infrastructure. Addon packs and their examples remain under
`content/examples/`; they are not shipped game configuration.

For a supported field, use the balance CLI instead of editing by guesswork:

```sh
python3 scripts/balance.py list --kind race_tuning
python3 scripts/balance.py inspect race_tuning/default.json /balance/tyre_incidents
python3 scripts/balance.py validate --godot /path/to/pinned/godot
```

See [balancing workflow](../docs/balancing.md) for field units and bounds,
safe edits, dry runs, validation and A/B comparisons. The JSON-pointer editor
only changes existing scalar parameters; structural or identity changes need
the content-authoring workflow described in
[`docs/content/README.md`](../docs/content/README.md).
