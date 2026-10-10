# Current native project status

**Current scope:** Native project after merged PR #30 (`dc2acaa`), with application version **0.19.0**. This page is the current capability inventory; detailed contracts live in the linked guides. Historical release handoffs and review ledgers describe their own source revisions and do not establish verification of the current checkout.

The separate [Wildlands prototype builder](../../source/wildlands/DOCUMENTATION.md)
retains its own TypeScript runtime, browser workspace, terminal tools and
source-bound evidence. Littlewild is its default showcase; its
[Godot desktop compiler](../../source/wildlands/WILDLANDS.md#runnable-godot-compiler)
uses a local Node subprocess for gameplay. Those capabilities and prerequisites
are outside this native Motorsport Manager inventory.

The standalone [Character Studio](character-studio-cli.md) adds a dedicated
Littlewild companion editor and guarded agent CLI/API. It exports existing engine
creature packages and Scene Forge visuals; it does not mutate live game saves.
Its smooth character compiler, physical materials and reproducible multi-view
reviews share authored data with both tools. The [complete agent workflow](../how-to/character-agent-workflow.md)
now uses guarded CLI commands for engine creature installation, companion edits
and Scene Forge visual updates into new immutable project versions.
Revision-4 character shapes add recessed eyes, a shaped jaw, distinct legs and
fitted garments while preserving exact revision 1–3 Studio export imports. Deterministic fur, cloth and leather surface maps and
authored mesh UVs travel through browser rendering, Scene Forge GLB and native
engine export. Scene Forge adds bounded organic profile stations for authored silhouettes, and
engine creature inspection can return compact material/geometry facts for agents.
Versioned surface recipes retain earlier texture bytes; explicit version 2 adds
finer directional coat detail. Agent captures expose repeatable three-quarter
views, orbit, zoom and animation phase.
Surface detail does not replace silhouette authoring or visual review.
The engine's `storyboard` CLI composes supplied artifact facts, explicit intent
and captured images into deterministic, self-contained HTML. Grid, sequence and
comparison layouts preserve authored order; review images retain verified hashes.
Storyboards present evidence without running a simulation or inventing intent.

## Shipping player experience

- **Native Godot 4.7.2, local-first, standalone desktop application.** The player-facing race interface defaults to **Minimal**. Settings can instead select **Advanced**, starting either in Race Director or directly in Engineering.
- **Weekend:** choose a circuit/configuration or a validated authored scenario; review before replacing an existing entry; practice (real measured runs) → qualifying → physical formation → start lights → race → factual end screen. Session transitions require explicit approval. Existing recorded commands, tyre ownership and saved weekends remain authoritative.
- **Minimal race screen:** timing tower, illustrated circuit with flat dot cars, five core driver actions (Send out, Box this lap, Push, Calm and engine mode), time controls, read-only instruments for both controlled drivers, and an on-demand read-only strategy comparison for the selected running driver. The comparison is an explicit snapshot or refresh of the existing current-condition forecaster; it issues no command, does not pause or change speed, and consumes no gameplay randomness.
- **Advanced race interface:** the retained Race Director and Engineering workspaces expose the broader strategy, telemetry, weather, racecraft, review and specialist toolset over the same live weekend. Race Director is the approachable advanced starting surface; Engineering opens the technical workspace directly. Choosing or reopening an interface does not clone the race, alter playback, issue commands or consume gameplay randomness.
- **Team Principal Campaign:** start or continue a local four-event management career from the main menu. New careers are compiled from the validated default `campaign` content definition, its authored weekend, and its per-event circuit references rather than from an in-code starter table or library index. The native Director Desk shows current cash, committed minimum cash, next-event timing, principal energy, team standing, at most three priorities, organization work, rival activity, resumable onboarding and factual post-race debriefs. Explicit advance/departure actions reuse the existing campaign clock, readiness rules and Minimal race weekend; campaign state is saved independently from the active weekend checkpoint.
- **Circuit Atelier:** edit/save native circuits with Bézier geometry, elevation/banking, pit routes, scenery, reference-image calibration, layer locks, transactional history, validation and test-weekend snapshots. Editor placement presets and contextual guide *copy* may be authored; rendering kinds and guide actions stay code-owned.
- **Content:** validated, strict external JSON packs with stable IDs, generated schemas, ordered dependencies, hash-pinned overrides, atomic catalog activation and frozen weekend/replay/campaign definitions. Supported families include vehicles, teams, drivers, rosters, tyre compounds/allocations/operating profiles, setups, shared tuning, weekends, circuits/styles, scenario briefs, mechanic profiles, editor profiles and Team Principal campaign profiles. Campaign content owns start identity/date/resources, starter series/calendar, contracts, facilities, rivals, event finance and numerical rival/people/supply tuning; algorithms, safety ceilings and registered executable providers remain code-owned. A provider profile selects **registered code**; external packs cannot inject executable mechanics or arbitrary editor actions. The authoring CLI supports init, clone, validate, list, inspect, schemas, non-overwriting export, diff, bounded scenario test and ordered multi-pack workflows.

## Wildlands maker RTS foundation

The separate TypeScript [Wildlands maker](../../source/wildlands/README.md), built
on the PR 25 foundation, also supports a switchable isometric RTS demonstration.
Validated JSON catalogs define resources, factions, worker/combat/vehicle/naval/
aircraft/creature archetypes, buildings, items, technologies, abilities, terrain
and missions. The shared ECS hosts navigation, worker economy, construction,
production/research, combat, fog, AI and objectives; application sessions own
commands, clocks and checkpoints. Detached tools support complete catalog
validation, mission inspection and bounded headless command recipes.

The graphical [RTS mission editor](../how-to/rts-mission-editor.md) authors terrain,
spawn groups, resource deposits, item drops, objectives and mission metadata over
a separate validated catalog draft. Revision-checked commands and bounded undo/
redo own publication; JSON import/export retains the full catalog. Explicitly
playing the selected draft replaces the RTS match with a fresh paused session.
Editing or returning without playing preserves the running match.

The maker engine also supports [player and creature skill trees](skill-trees.md) with captured definitions, XP-earned points, prerequisites, ranks, exclusive branches and saved progression. Littlewild attaches a growth tree to each starting companion and provides a **Learn → Skill trees** view. The Node-backed native runtime retains the same commands and checkpoints; a dedicated Godot tree screen is not implemented.

A third switchable context, [Pocket Pet](pet-engine.md), is an original virtual-pet
demonstration. A validated catalog drives needs, digestion, sleep, sickness, care
mistakes, growth and two adult forms through ECS systems; its application owns a
separate fixed clock and checkpoints, and a WebGL room renders Scene Forge
authored models. Scene Forge's `littlewild` commands export, check and import those
definitions; the asset grammar gained a bounded baked-mesh primitive and a `pet`
category. Owner-scoped wardrobes add coin-bought skins and socketed accessories, while premium
offers unlock only through entitlements reported by a replaceable store adapter;
the bundled store is simulated and processes no payment. Bounded caretaker scripts exercise the rules; there is no Godot export
or human balance validation. See the [tutorial](../tutorials/pocket-pet-demo.md).

This is a maker game context, separate from the shipping native race/campaign
application. It does not establish native RTS export parity, multiplayer, broad
balance or human validation. See the [canonical RTS contract](rts-engine.md) and
[demo tutorial](../tutorials/rts-demo.md) for source-backed scope and limits.

## Standalone command-line tools

Four separate TypeScript projects ship checked-in, self-contained command-line
bundles under `bin/`. Each needs only Node.js 22 or newer and runs from a fresh
clone without `npm ci` or `node_modules`:

- [`bin/wildlands`](wildlands-cli.md) is the Wildlands engine from
  `source/wildlands/` without any game content. It validates, inspects and builds
  game folders (`docs/concepts/<id>/`) into self-contained HTML files, and
  creates, validates, inspects, plays, edits and compiles portable projects,
  which embed their game, into Godot desktop projects. Running a compiled or
  exported Godot project requires Godot. Native story saving uses the runtime's
  `story.export` JSON string verbatim, preserving authored floating point values
  and their validated fingerprints across save/load.
- [`bin/scene-forge`](scene-forge-cli.md) authors, validates and exports
  declarative 3D projects, model registries and composed scenes from
  `source/scene-forge/`. Its `screenshot` and `review` capture commands
  additionally need Playwright and Chromium; `doctor` reports their availability.
- [`bin/model-forge`](model-forge-cli.md) is the agent-first, standalone editor
  for exactly one model document (`model` or `model-bundle`) from
  `source/model-forge/`. It owns the model asset contract and the shared model
  recipe kernel that Scene Forge imports, applies revision-guarded edits with
  history, and exports model bundles for Scene Forge's `model import`,
  Littlewild definitions for `wildlands creature attach-visual` and game
  folders, and GLB/glTF/OBJ/STL/Three.js JSON. Littlewild export follows one
  lossless contract shared with Scene Forge's `littlewild export` and `sync`: an
  unedited import re-exports byte-identically through either tool across the
  concept-game corpus, an edit changes only the edited fields, and both tools
  write identical bytes for the same model. It never writes
  inside a Scene Forge project and never replaces an existing output without
  `--overwrite`. Its `review` needs Playwright and Chromium.
- [`bin/character-studio`](character-studio-cli.md) edits Littlewild companions
  through a local browser editor, JSON CLI and HTTP API from
  `source/character-studio/`.

The bundles are generated from their source projects and checked by each
project's `npm run check:cli`.

Wildlands verification has a fast tier (`npm test`: typecheck, build and the
quick Node suites, partial evidence) and the complete registered gate
(`npm run verify`: 104 suites, 1,869 reviewed named checks) on a parallel
runner. `source/wildlands/source/verification/suites.json` and
`gate-expectations.json` are the authority for suites and check names; CI runs
the fast tier first, then the complete gate with `--jobs 3 --browser-jobs 2`.
Passing suites are automated evidence, not human playtesting or balance
validation.

## Ready-to-play Wildlands demos

The repository's [`demos/`](../../demos/README.md) directory holds six
ready-to-play HTML files, one per [game folder](../concepts/README.md), each
built by `bin/wildlands build-game` and opened directly from disk in a desktop
browser (offline, no network requests, no install or build step): Littlewild,
Emberworks and Office (`colony` template), RTS Frontier (`rts`), Pocket Pet
(`pet`, WebGL 2) and the Agency delivery lab (`process`). Each file carries only its own game and stores saves under its
own namespace (`littlewild` keeps its legacy keys; the others use
`wildlands.<id>`). Every demo stays within its folder's play budget and is
byte-checked against a fresh build by `npm run check:demos` in
`source/wildlands`; it records its folder digest (every folder file except
`README.md` documentation) and the engine identity, so any engine or game-data
change needs rebuilt demos while a README-only edit does not. Editors and export tools are not published; `build-game
--profile studio` builds them on demand. A browser boot check of each file is
automated evidence only, not human playtesting or balance validation. Like the Wildlands maker above, they are outside
the native Motorsport Manager race/campaign inventory and do not read or write
its saves or race/campaign state.

## Wildlands business processes

The Wildlands process extension (`template: process`) adds a versioned JSON
process definition simulated as case tokens in the shared ECS: capacity-limited
people, machine and system pools, typed decisions with chance routes and
`all`/`any`/`not` conditions, parallel and inclusive forks with their joins,
bounded rework loops, timers, counters, needs and backlogs, multi-instance work,
boundary deadlines (interrupting or escalating), seeded random timing, outcomes
and arrival streams, and customer and user journeys with touchpoints, outcomes,
conversion and tracked measures. The studio shows one detached run in 2D, Three.js
3D and a SIPOC or journey lens, with an Activity modal, a Definition editor, a step
editor, a **Present** mode (the slide deck of the active definition beside the studio's
own 2D map, on a phone from the **⋯** menu) and offline HTML downloads; it has a dark
theme only. Navigation, dialogs, lenses and Present mode never tick the clock; entering
Present pauses a running simulation with a command.

The [agency delivery lab](../concepts/agency-delivery/README.md) holds seven
synthetic processes behind a **Process** switch (an agency pipeline, an agile
vendor project, an order fulfilment line, a customer journey, a user journey,
a loan application converted from BPMN 2.0/BPSim and a product team's weekly
delivery cadence and release train from a 0.1.0 skeleton to a 1.0.0 MVP); all
values are illustrative assumptions.

BPMN 2.0 interchange covers a broad but explicit subset. Export writes BPMN with
diagram layout and the exact Wildlands values in a namespaced extension, optionally
with a BPSim scenario, and re-imports to the same fingerprint. Import of foreign
BPMN maps tasks and their types, lanes (as pools), exclusive, parallel and
inclusive gateways, event-based gateways (as a race by chance), multi-instance and
standard loops, embedded sub-processes and call activities (both inlined), timer
catch events and timer boundary events (as deadlines) with ISO-8601 durations, and
reads BPSim times, distributions, probabilities, arrivals, capacities and costs. It
reports every mapping and warning, and rejects unsupported constructs with their
element ids or, in drop mode, removes or approximates them with a warning each. The
CLI and the studio's **Import BPMN** dialog (options, live preview, Cancel-first
replacement confirmation) share this importer. A built-in BPMN 2.0 / BPSim 1.0
conformance validator (rule tables restated as Wildlands data, no schema files;
structural, type and reference rules only) backs `process validate-bpmn` and the
dialog's informational Standards check, and the registered gate checks every demo and
example export with it; an earlier one-off run used the OMG schema files
([record](../_archive/verification/bpmn-schema-conformance-2026-10-08.md)).
`process slides` explains an admitted definition as a deterministic plain-text slide
deck (JSON or Markdown; optional read-only facts from one bounded seeded run) built by
the pure `LWProcessSlides` model, `process diff` compares two definitions, and guarded
recipe operations set or remove the description, seed, genre, SIPOC parties and tracked
fields without changing the definition schema. `npm run process:shots` (in
`source/wildlands`) captures one process of a game at a chosen minute in desktop and phone
layouts, including Present mode and the DejaVu Sans fallback font, and reports horizontal
overflow and console errors; it is a review aid, not usability validation.

Not implemented: BPMN execution, external service execution, calendars or working
hours for timers, event-driven gateway semantics, complex gateways beyond the drop
approximation, compensation, nested gateways inside a fork region, process
checkpoints or saved-run restoration, light theme and Godot process export. A
mapped BPMN model, a seeded run and the passing process suites are automated
scenario evidence, not a validated process model, forecast or human usability
review. See the [contract](business-process-engine.md) and
[authoring workflow](../how-to/business-process-authoring.md).

## Interface selection and retained specialist tools

Settings stages a **Minimal / Advanced** preference and saves it only on Apply. Minimal remains the safe default. Advanced remembers whether it should begin in Race Director or Engineering. The selection applies when a weekend screen next opens; it is presentation configuration, not race state. Existing `director` and `engineering` saved preferences remain valid, and the public `advanced` alias normalizes to Race Director. Explicit launch overrides remain available for development and automation.

The Advanced interface makes the retained strategy/rival, weather/recovery, racecraft/team-order, debrief/journal and telemetry workspaces player-selectable. Replay/sandbox, authored scenario, notebook and other specialist utilities retain their existing entry points and evidence boundaries. **Existence in source still does not establish human usability, accessibility completeness or calibration.** Minimal deliberately does not instantiate the advanced panel tree.

Bundled diagnostic scenario collections are trusted file-backed verification resources, not external executable scenario packs. Public authored complete-weekend scenarios can stage existing implemented weekend behavior, but do not add a campaign or arbitrary goal code.

## Implemented campaign authorities

The four-event Team Principal career is the player-facing first slice. The wider
campaign implementation persists domain/application authorities; existence of an
authority does not mean it has a dedicated management screen. The former TM-01
through TM-16 roadmap and final-result correction are implemented.

| Responsibility | Canonical contract |
|---|---|
| Authored starter and frozen content closure | [Campaign index](campaign/README.md), [content compatibility](content/version-compatibility.md) |
| Dated clock, principal energy, accepted history and checkpoint v6 | [State, clock and storage](campaign/state-clock-storage.md) |
| Frozen entrant mappings and factual receipt | [Weekend boundary](campaign/weekend-boundary.md) |
| Atomic return: time, awards, resources, due cash and receipt | [Weekend consequences](campaign/weekend-consequence-transaction.md) |
| Calendar, accepted field, countback and controlled season lifecycle | [Season lifecycle](campaign/season-lifecycle.md) |
| Integer cash, binding commitments, reserves and detached forecasts | [Finance](campaign/finance-commitments-forecast.md) |
| Employment, payroll, roles and exclusive availability | [Personnel](campaign/people-contracts-availability.md) |
| Finite facilities, staff/capacity reservations and rented services | [Operations](campaign/facilities-capacity-services.md) |
| Work-backed gates, designs, unique physical parts and frozen race profiles | [Engineering](campaign/engineering-parts-race-profile.md) |
| Exact next-event readiness and atomic departure | [Readiness and departure](campaign/event-readiness-departure.md) |
| Guaranteed sponsor receipts, evidenced bonuses and appearance obligations | [Commercial](campaign/sponsorship-commercial.md) |
| Bounded delegated finance and immutable decision evidence | [Mandates](campaign/delegation-mandates.md) |
| Finite rival organizations and dated public-information reviews | [Rivals](campaign/rival-organizations.md) |
| Native desk, explicit advance/departure and factual debrief | [Director Desk loop](campaign/director-desk-first-loop.md) |
| Reviewed replacement of final-result consequences | [Result correction](campaign/result-corrections.md) |
| Persistent candidates, bounded negotiation, development and promises | [People development](campaign/people-development-recruitment.md) |
| Plans, evidenced prizes and explicit promotion/next-season transactions | [Multi-season progression](campaign/multi-season-progression.md) |
| Conserved materials, persistent uncertainty, part life and financial pressure | [Operational depth](campaign/operational-depth.md) |
| Shared parent-business capacity, conserved transfers, academy and succession | [Group and dynasty](campaign/group-era-dynasty.md) |

All campaign changes stage detached values and publish one complete checkpoint.
Campaign time never reuses race ticks or the wall clock. `CampaignManagement` v2
freezes authored campaign, scheduled circuits and effective race definitions;
existing careers do not reread live packs. Legacy checkpoints preserve recorded
facts and obligations without inventing missing people, calendars, facilities,
projects or consequence history. [State and storage](campaign/state-clock-storage.md)
is the canonical checkpoint/migration reference.

## Not implemented or not established

- **Campaign presentation is still bounded:** the Team Principal route is playable as a four-event first slice, but recruitment, engineering portfolio, facilities, commercial, finance, academy, multi-season and dynasty authorities do not yet have dedicated player-facing specialist screens beyond Director Desk summaries.
- **People depth remains intentionally bounded:** persistent candidates, bounded negotiation, attributes, development, workload evidence, morale/trust and promises now exist, but there is no rich scouting uncertainty model, chemistry/fatigue simulation, department headcount model, automatic race-entry staffing or direct hidden race-pace bonus from role quality.
- **Finance remains intentionally bounded:** payroll, event operations, sponsor value, supplier orders, prizes, owner transfers and financing use explicit dated commitments; a game-defined operating/position view and bridge financing exist. There is still no full accrual accounting, tax, depreciation, lending market, insolvency proceeding or real-world financial-reporting claim. Forecast assumptions remain analysis inputs, not spendable money.
- **Not a comprehensive vehicle-physics or licensed-regulations simulator.** Race damage remains aggregate; additional vehicle presets are not full competition formats. Editor bridge/tunnel annotations do not certify 3D clearances.
- **Human playtesting, comprehensive accessibility, broad device/hardware calibration, wet/endurance balance and same-host comparative performance remain separate validation gates.** Successful automated checks do not establish them. Making Advanced selectable is not a human-usefulness sign-off for every retained workspace.

## Verification boundary

The current verification procedure is [the verification guide](../how-to/verification.md).
`scripts/verification_suites.json` defines the complete registered Godot suite;
historical counts and green intermediate commits cannot substitute for checks of
the final source. This inventory does not assert a fresh hosted or local full-suite
pass for `dc2acaa`.

Current checkout entry points:

- `python3 scripts/verify.py --godot /path/to/pinned/Godot` — complete registered gate, including the required native UI environment.
- `python3 scripts/check_architecture.py` — dependency and authority contracts.
- `python3 scripts/check_docs.py` — local links, navigation and documentation layout.
- `python3 scripts/content.py schemas --check --godot /path/to/pinned/Godot` — generated-schema contracts.
- `python3 scripts/balance.py validate --godot /path/to/pinned/Godot` — shipped balance catalog validation; see [balancing](../how-to/balancing.md).
- `python3 -m unittest discover -s tests -p 'test_*.py'` — Python tooling/contracts.
- `python3 scripts/quality.py` — advisory lint, formatting, complexity and physical-line findings; source/test budgets remain 400/450.

[The historical data-driven review ledger](../_archive/maintenance/data-driven-code-review.md)
retains its source-pinned review evidence. Human playtesting, accessibility,
representative-device performance and platform validation require their own
relevant evidence.

## Maintenance priorities

1. Keep this inventory and the README synchronized when a capability becomes player-facing, optional, diagnostic or deferred.
2. Maintain one canonical contract per authority; link to it from status pages instead of copying schema and transaction detail.
3. Keep verification evidence tied to its exact source and distinguish contract correctness, human experience and performance.
4. Prioritize campaign balance, human validation and specialist management UI over parallel authorities.

## Where to read next

- [Architecture and ownership](../explanation/architecture.md), plus [contributor rules](../../AGENTS.md).
- [Shipping Minimal weekend](race-weekend/minimal.md) and [Advanced interface](race-weekend/advanced.md).
- [Campaign route and authority contracts](campaign/README.md).
- [Content contracts](content/README.md), [consumer inventory](content/consumer-inventory.md) and [compatibility](content/version-compatibility.md).
- [Documentation maintenance](../how-to/maintaining-documentation.md).
- [Historical handoffs and review ledgers](../_archive/README.md).

**Change discipline:** no content definition may bypass its production consumer/validation; no UI may own authoritative race or campaign state/ticking; changing an actual sporting rule, campaign rule, save schema, financial/personnel/operations authority or provider state requires explicit versioning, characterization and separate scope.
