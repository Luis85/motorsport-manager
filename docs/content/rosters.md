# Teams, drivers and event rosters

Teams and drivers are definitions, not saved race instances. A roster selects an
ordered entry list, a controlled team and explicit service positions. Each
new weekend freezes the roster and exactly its referenced team/driver records.
Loading a save never consults the current pack for those definitions.

## Authoring

Create `team`, `driver` and `roster` records using the generated schemas in
`content/schemas/v1`. Add each relative path to the pack's `files` array. Keep
stable dotted IDs when changing names. `name` is presentation, not ownership.
Driver `short` is an up-to-eight-character timing label. Existing four ratings
are integers from 0 to 100; they retain the existing simulation meanings.

A roster's `entries` determines the initial entry/grid order. Every entry names
`driver_id`, `team_id`, a unique positive `number` and its six-digit RGB `color`.
`player_team_id` grants control to that team's two entries. Team records also
carry an identity color; entry colors can distinguish the two cars. Identical
team display names do not merge authority or pit boxes.

`pit_boxes` contains one `team_id` and `fraction` per entered team. Fractions are
positions along the physical pit route, not percentages of the circuit. They must
be distinct and between 0.1 and 0.9. Launch additionally requires eight metres
between service positions. The circuit's authored `grid.count` must fit the field;
the Track inspector exposes **Grid places** and **Grid spacing m** through normal
revision-checked edits. A grid cannot occupy more than 40% of circuit length.
These are game geometry limits, not real-world circuit safety certification.

The current supported field is 2–24 cars, at most two per team, and exactly two
controlled cars. A track may describe 1–64 grid places. Larger capacity does not
increase the engine's 24-car limit. A different cars-per-team interface requires a
separate implemented contract rather than a permissive JSON field.

## Examples

`core.roster.default` preserves the original six teams, twelve drivers, colors,
ratings and entry order. Its existing player slots are 3 and 6, but those integers
are consequences of this entry list, not global identities.

`content/examples/club-racing` adds a seventh team and two drivers. Select
`local.club.roster.expanded` to manage the original team in a fourteen-car field,
or `local.club.roster.privateer` to manage the added drivers in slots 12 and 13.
The **FIELD** selector appears in weekend setup when multiple rosters are loaded.
Use a suitable circuit or increase the example hillside circuit's twelve-place
grid to fourteen in the editor before choosing the expanded field.

```sh
python3 scripts/content.py validate content/examples/club-racing --godot /path/to/godot
python3 scripts/content.py inspect content/examples/club-racing --id local.club.roster.privateer --godot /path/to/godot
```

## Persistence and boundaries

RaceCar remains a 91-field serialized entity. A nonserialized frozen entrant
reference resolves runtime slot IDs to stable driver/team IDs. The checkpoint
owns the versioned roster closure; restore validates each car against it before
binding the reference. Tyre stock and live condition stay with the entrant, not
with the shared definition. Results, notebook facts, weather/control arrays,
forecasts, journals, charts, pit authority and both shipping/diagnostic controls
use the actual entry. Legacy checkpoints and legacy scenario recipes retain the
immutable original roster adapter; they do not adopt an edited current core pack.

Named historical scenario goals such as `mer_top_six` continue to refer to the
named core driver, not whichever new driver occupies slot 3. They are unavailable
when the named person is not in the controlled team. Generic two-car goals follow
the selected team. Adding arbitrary executable goal types is not supported here.

## Verification

`content_roster_tests` runs a physical fourteen-car practice, qualifying,
formation and race, validates the complete result/notebook, then verifies a full
replay to its endpoint. It also checks default sporting parity, two-car minimum
fields, rejected references, grid limits, authority, tampered saves and detached
queries. `content_roster_ui_tests` operates native controls for the added team at
1440×900 and 1100×720 with 130% text, including diagnostic workspace navigation.
Its captures show a real launched practice state, not synthetic finish evidence.
The normal verifier rejects engine errors even when a test's own report passes.
