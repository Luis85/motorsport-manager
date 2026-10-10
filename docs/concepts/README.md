# Game folders

Each directory under `docs/concepts/` is the complete source of one game or
scenario built with the Wildlands engine (`source/wildlands/`). A game folder is
data, not documentation in the Diátaxis sense and not code:

- `game.json`, the manifest validated against the engine-owned
  [game manifest schema](../../source/wildlands/source/schemas/game.schema.json)
  (format `wildlands-game`, schemaVersion 1): id, name, version, engine template
  (`colony`, `rts`, `pet` or `process`), engine API, optional engine features, content
  paths, presentation, storage namespace and build targets;
- the JSON documents and asset definition folders the manifest names;
- `README.md` (what the game is, how to build and play it, provenance) and,
  where needed, `PROVENANCE.md` and `LICENSE*` files.

Nothing in a game folder is executed. The engine tooling
(`source/wildlands/source/tools/game-folder.cts`) rejects any file the manifest
does not name, code or markup files, executable modes, symbolic links and
oversized trees, then validates every document with the engine's own
validators. Engine schemas stay in the engine; a game folder never copies them.

## Games

| Game | Template | Folder | Play |
|---|---|---|---|
| Littlewild | colony | [littlewild](littlewild/README.md) | [`demos/littlewild.html`](../../demos/littlewild.html) |
| Emberworks | colony | [emberworks](emberworks/README.md) | [`demos/emberworks.html`](../../demos/emberworks.html) |
| Office | colony | [office](office/README.md) | [`demos/office.html`](../../demos/office.html) |
| RTS Frontier | rts | [rts-frontier](rts-frontier/README.md) | [`demos/rts-frontier.html`](../../demos/rts-frontier.html) |
| Pocket Pet | pet | [pocket-pet](pocket-pet/README.md) | [`demos/pocket-pet.html`](../../demos/pocket-pet.html) |
| Agency delivery lab | process | [agency-delivery](agency-delivery/README.md) | [`demos/agency-delivery.html`](../../demos/agency-delivery.html) |

No game data remains under `source/wildlands/source/`: the engine keeps only
its schemas and engine metadata there, and its architecture check rejects any
game file that is not in a game folder. Each folder is self-contained;
Emberworks and Office carry their own copies of the Littlewild balancing and
asset documents they were authored against.

## Play a game

Every folder is published as one ready-to-play HTML file in the repository's
[`demos/`](../../demos/README.md) directory. Open `demos/<id>.html` in a
current desktop browser: it runs offline from `file://` with no network access,
install or build step, carries only its own game and keeps its saves under its
own storage namespace (Littlewild keeps its legacy keys).

## Build a game

The engine CLI [`bin/wildlands`](../../bin/README.md) needs only Node.js 22 and
carries no game; it reads a folder and writes one self-contained file:

```sh
bin/wildlands validate-game --game docs/concepts/<id>
bin/wildlands build-game --game docs/concepts/<id> --output demos/<id>.html
```

`build-game` refuses a play artifact over the folder's
`targets.html.budgetBytes`. To refresh every published demo after changing a
folder (every file except `README.md` files is part of the folder digest the demo
records; `PROVENANCE.md` and `LICENSE*` are included because they are
licence-relevant, while a README edit leaves the digest and the demo unchanged), run `npm run build:demos` in `source/wildlands`; `npm run check:demos`
fails when `demos/` differs from a fresh build. The
[Wildlands CLI handbook](../reference/wildlands-cli.md) documents every command.

## Working with a folder

Build tools look for game folders here, or in the directory named by the
`WILDLANDS_GAMES_DIR` environment variable (used by isolated rebuilds and the
engine-source export, which carries bundled games under `games/<id>/`). The
engine's own `npm run build` still composes every folder into its test fixtures
under `source/wildlands/.generated/artifacts/` (the composite
`showcase.html` is a test fixture, not a published file). See
[maintaining documentation](../how-to/maintaining-documentation.md#game-folders)
for the placement rule and the Wildlands
[runtime contracts](../../source/wildlands/RUNTIME-CONTRACTS.md) for how a
folder becomes an installed content profile.

- [Agency delivery lab](agency-delivery/README.md) — seven synthetic processes with a process switch: an in-house agency pipeline (shared resources, parallel product and technical design, a pull backlog, step needs, QA rework), an agile vendor project (milestones, releases, iterations, bounded fix loop, CI/CD as automated system steps), an order fulfilment line (robots and software systems on their own pools, a human spot-check, a repack loop), a customer journey through an online shop (phases, emotions, drop-off and conversion), a user journey through app onboarding (system steps, timers, a sessions counter), a loan application converted from a BPMN 2.0/BPSim example (a multi-instance task in an inlined sub-process, an inlined call activity, an inclusive gateway, a non-interrupting SLA deadline, and the applicant as the case through pool-free touchpoints with goal and lost outcomes) and a product team's weekly delivery and release train (refinement, planning, daily stand-ups, review and retro feeding weekly 0.x.0 releases from a 0.1.0 skeleton to a 1.0.0 MVP, with parallel and sequential multi-instance work, an escalating deadline, a random-share feedback decision and an inclusive release gateway); the journeys, the loan application and the delivery train are synthetic scenario models. The studio runs each one in 2D, 3D, a SIPOC or journey lens and a Dashboard of metrics and charts, presents it as slides beside the map, and can add steps or new processes into an unapplied draft.
