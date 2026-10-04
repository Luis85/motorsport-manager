# Campaign content reference

A `campaign` definition authors the starting Team Principal organization and its
numerical policies. The shipped record is
`config/campaigns/team-principal.json` (`core.campaign.team-principal`). It uses
`core.weekend.campaign-starter` and four explicitly referenced calendar circuits.
The generated [campaign schema](../../../content/schemas/v1/campaign.schema.json)
contains the complete field shapes, required keys, enumerations and bounds.

## Definition groups

| Group | Authored data |
|---|---|
| `default`, `weekend_id` | Default profile selection and the supported weekend definition |
| `career` | Stable career/organization/principal IDs, civil start date/slot, energy capacity, integer opening cash and reserve |
| `series` | Series/season IDs, name, cars per entrant and ordered points by position |
| `calendar` | Ordered event IDs, rounds, circuit references, departure/return day offsets and event revisions |
| `player` | Roster-team mapping, campaign entrant/team IDs, driver role/contract and operations lead |
| `facilities` | Named capacity resources, supported families, capacity units and availability days |
| `rivals` | Exact roster-team mappings, campaign identities, supported archetypes, cash/reserve, capability and review cadence |
| `rival_policy` | Cash preservation, plan spending and bounded capability gains |
| `people_policy` | Counter-offer ratio, productive load, development, morale and new-hire defaults |
| `supply_policy` | Initial confidence, observation gains, confidence ceiling and evidence spread |
| `event_finance` | Departure cost, participation payment and ordered position bonuses |
| `tuning.finance` | Distress forecast horizon, bridge maturity and bridge fee |

Money fields use integer minor units. Fields ending in `_bps` use integer basis
points: `10000` means 100%, while `1000` means 10%. Calendar day offsets are
relative to the authored career start and become dated campaign slots; they are
separate from the race's 0.05-second fixed steps.

The optional `tuning` block is complete when present. Omitting it preserves the
legacy finance defaults without injecting fields into old frozen records:

| Field under `tuning.finance` | Default | Bounds |
|---|---:|---:|
| `distress_forecast_days` | 30 | 1–3660 days |
| `bridge_maturity_days` | 30 | 1–3660 days |
| `bridge_fee_bps` | 1000 | 0–10000 basis points |

A bridge agreement freezes its repayment at creation. Later policy edits do not
reprice that commitment. See [finance and commitments](../campaign/finance-commitments-forecast.md)
for cash, binding obligations and forecast semantics.

## Cross-field and reference validation

The selected catalog requires exactly one `default: true` campaign. The native
Team Principal entry uses that default; an additional profile does not create a
campaign chooser. A custom pack can replace the default through the normal
whole-record, hash-pinned [override contract](pack-contract.md).

The referenced weekend must resolve to valid vehicle, roster, tyre, setup, tuning
and optional mechanic definitions. Its controlled roster team must match
`player.roster_team_id`. Player and rival mappings must cover the weekend roster
exactly once, and every team's car count must agree with `series.cars_per_entrant`.
Every calendar circuit must accommodate that roster's grid and pit boxes.

Native validation also checks valid civil dates, unique campaign identities,
sequential rounds starting at one, increasing departure offsets and return after
departure. Reserves cannot exceed opening cash. Contract duration must contain
complete payroll intervals within the installment bound, and the renewal window
must fit the duration. Points and position-bonus tables must cover the same
positions; points cannot increase for a lower position, and the winner must
receive points. Policy validators retain their own cross-field constraints.

## Inspect and edit

From the repository root, inspect the resolved default through the production
content compiler:

```sh
python3 scripts/content.py inspect --id core.campaign.team-principal \
  --format json --godot /path/to/pinned/godot
```

For a scalar change to the shipped catalog, follow the
[balancing workflow](../../how-to/balancing.md); it validates the entire catalog before
publishing the edit. For an external override, retain the definition ID, put its
file in the pack manifest and pin the prior resolved hash. Validate the complete
ordered pack selection before starting a new career.

## Runtime and saved-state ownership

`CampaignStarter` interprets this content through the existing competition,
economy, personnel, operations and rival domains. A new career freezes the campaign
record, calendar circuits and complete selected race-content closure into
`CampaignContentSnapshot` inside `CampaignManagement`. Departure and settlement
use that retained closure. Pack edits and removal affect future careers.

The definition cannot add algorithms, state machines, roles, facility families or
executable providers. It cannot bypass readiness, availability, cash, commitment,
receipt or atomic settlement rules. A facility's owned capacity does not grant a
race-performance bonus. Existing management version-1 saves use explicit legacy
policies; see [version compatibility](version-compatibility.md).
