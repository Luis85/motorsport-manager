# Central balancing and experiments

Default item prices, weights, recipes, equipment, resource nodes, buildings and
progression gates are edited in [one definition per thing](source/assets/README.md) inside the
game folder ([Littlewild](../../docs/concepts/littlewild/README.md): `docs/concepts/littlewild/assets/`).
The game's `content/balancing.json` retains shared rules and ordered catalog selectors;
`npm run build` assembles the complete public balancing document in
`.generated/content/balancing.json`. The public schema, workshop and CLI still
accept complete portable documents, never source selectors. Default scenario
libraries and creature tuners are generated from these same definitions.

Edit the relevant definition or shared rule, then build. Node, CLI and standalone browser startup consume the assembled balancing document. It contains the four complete gameplay libraries, actor/economy/gameplay simulation profiles, world generation, interaction and interior catalogs, generated creature seed tuners and starting scenes. Validated complete packs can explicitly override these defaults. Office and Emberworks retain their authored pack overrides.

Creature identity, names, visual bindings, ECS grammar and new archetypes remain authored in the game folder's `assets/creatures/<id>/definition.json`. The generated `creatures` section is a numeric/Boolean projection of those folder definitions; it cannot rename creatures, invent a field or replace executable grammar. Effective exported balancing documents and captured pack resources contain the complete validated merged creature catalog. The build discovers added asset folders. Existing captured catalog/profile values are immutable and continue independently of later default-file edits.

`startingScenes` surfaces initial player coins, research, inventories, needs, buildings, nodes and actor progression. Those are scenario seed data. Edit them before creating a new story with `startingPack`; ordinary balancing apply preserves an existing story's holdings and progression and rejects start edits. The document's `sceneId` selects the native owner whose interaction/interior catalogs are tuned; other owners retain their authored catalogs. Bound interior/island scenes keep their empty native state and use their native owner's capture. Libraries, simulation and effective creature resources are pack-wide; world tuning replaces the matching world ID.

## Tools and browser workflow

Open the world editor's **Balancing workshop**. Its draft exposes numeric groups and full JSON sections, imports/exports balancing JSON, shows a bounded change review, runs a seeded baseline/candidate comparison and exports a complete pack. Applying uses the scene editor's existing explicit review with Cancel focused. Invalid edits remain in the draft. Starting-template edits require the new-story CLI/API below.

The same typed capabilities are `toolbox.balancing.defaults`, `capture`, `validate`, `diff`, `review`, `apply`, `startingPack`, `probe` and `sweep`. `review` returns a private, single-use token tied to the exact source pack. Forged or stale tokens fail. Changed mechanical tuning is blocked while actors have committed tasks/quests/paid orders, buildings have production jobs, market sales are unsettled, or interactions are requested/active. Unchanged captures remain valid. Whole-pack domain validation completes before any apply; unknown groups, fields, nonfinite numbers, wrong types and executable/accessor shapes fail without changing live state.

After building:

```sh
node .generated/tools/balancing-cli.cjs defaults
node .generated/tools/balancing-cli.cjs capture pack.json charted-home
node .generated/tools/balancing-cli.cjs validate balance.json pack.json
node .generated/tools/balancing-cli.cjs review pack.json balance.json
node .generated/tools/balancing-cli.cjs apply pack.json balance.json tuned-pack.json
node .generated/tools/balancing-cli.cjs new-pack balance.json new-pack.json pack.json
node .generated/tools/balancing-cli.cjs probe pack.json balance.json probe.json
node .generated/tools/balancing-cli.cjs sweep pack.json balance.json sweep.json
```

Probe options are inert JSON such as `{"sceneId":"charted-home","seed":111,"steps":200,"commands":[]}`. Sweeps also require a declared gameplay path and a finite `values` array. Probes run real detached native engines with captured resources, libraries, world and profile; they never activate the live SDK session or acquire a player host lease. They reseed world, actor and interaction RNG streams deterministically. Output includes baseline, candidate and deltas for needs, inventory/warehouse/node resources, production/gathering, currency/research, quest completions, duel rounds and levels. Results describe the supplied start, commands, seed and horizon; they are not an automatic difficulty or long-term stability verdict.

Input is capped at 12 MiB; probes allow 0–36,000 fixed steps and at most 64 typed commands. Sweeps allow 1–16 values with at most 72,000 total baseline/candidate steps. Reviews show at most 256 leaf changes with exact total/truncation markers. No expressions, scripts, callbacks or `eval` are accepted. CLI errors, including failures loading bundled defaults, return exit1 and structured diagnostics; output paths cannot alias input files. No arguments, `--help` and `-h` return JSON usage without loading gameplay defaults.

## Coverage and fixed rules

`source/content/balancing-inventory.json` records each compiled gameplay tuner and its actual source consumers. `source/tools/balancing-audit.cts` checks the bounded source inventory against declared paths and occurrence counts. `balancing-rules.ts` declares supported field types/ranges independently of editable JSON values; changing the default file cannot expand validator grammar. `balancing.schema.json` describes the complete portable document shape; the whole-document validator delegates to actual library/profile/world/creature/interaction/interior and complete scenario validators. Bounds, phase sums and threshold ordering are checked before capture.

This inventory covers declared gameplay fields, not every numeric literal in the codebase. Mathematical GURPS 3d6 resolution and attribute costs, grams-per-kilogram conversion, 0–100 bounded need representation, format versions, grid/bridge topology, geometry bounds, flood/path algorithms, record limits and fixed-step scheduling guards remain compiled invariants with source explanations. Authored scenario snapshots are seed data, not mathematical invariants. Presentation animation rates and renderer implementation settings are outside game balancing. New mechanics require typed engine code and supported grammar; adding an arbitrary JSON number does not create a mechanic.

Former individual default library/profile/catalog JSON files remain historical/reference mirrors. Runtime default loaders consume the central document, except asset-folder creature identity and catalog grammar, which are merged through the validated tuning overlay. Pack-specific authored data remains explicit and snapshots preserve its exact effective values. Mechanical edits do not retroactively refill existing resource nodes, rewrite paid work, alter already captured stories, or simulate a new starting template.
