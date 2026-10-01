# Littlewild v15 — Worlds of Possibility

An offline autonomous-creature simulation showcase with compact world-facing UI and reusable JSON scenario packs. The browser prototype is isolated from the native Motorsport Manager game.

The incremental ECS migration now covers actor dynamics, task movement, physical world logistics, production settlement, atomic economy/progression settlement, explicit engine composition, command boundaries, and versioned simulation profiles. Native state remains format 8. Scenario-aware saves now use envelope 10; envelope 9 migrates explicitly to the compatibility profile. See `ECS-ARCHITECTURE.md`.

## Play

Open `littlewild.html` in a full desktop browser. No server, network, account, API key or asset download is needed. Choose the first scene for earned progression or **A charted home** for the existing multi-creature demonstration. Under **More → Worlds & scenarios**, switch to Emberworks or import your own pack. Starting a scene replaces the active story only after review and confirmation; export a backup first.

**Build** opens a non-modal catalog beside the world. Search a researched blueprint, choose a builder and approach, then choose a location. Drag/zoom the world normally. **F6** switches focus between the world and an open panel. **Escape** closes the panel or cancels placement. **Guide** opens a compact, resumable tutorial; Show me links to the relevant existing controls without completing tasks.

The existing **Pause when opening panels** device preference also covers these panels. Manual pause wins. Replacement reviews remain safety pauses even with automatic pausing disabled.

## Build and verify

```sh
python source/build.py
# A separate, single-pack HTML using the very same runtime:
python source/build.py --pack source/content/emberworks.pack.json --output emberworks.html

python -m pip install -r requirements-test.txt
python verify-v15.py
```

The normal build uses Python's standard library. External-pack builds additionally use Node.js for semantic validation. Verification uses Node.js, Python/jsonschema, and Playwright with `/usr/bin/chromium`; adjust that executable path for another development environment. `--no-browser` produces an explicitly partial result, not a full release pass.

## Documentation

- `CONFIGURATION.md`: scenario-schema 2, simulation-profile authoring, world/scene configuration, migrations and engine boundaries.
- `UI-RESEARCH.md` and `UI-REVIEW.html`: research, observed baseline and actual captures.
- `VERIFICATION.md`: this build's executed checks and limitations.
- `CHANGELOG.md` and `CODE-REVIEW.md`: changes, module ownership and remaining coupling.
- `CONTENT-INTEGRATION.md`: existing Base/Adventure/World/Growth library contracts.

This is not yet an unrestricted game engine. Stable mechanic roles, handlers, island dimensions, creature rigs and some legacy wording remain code. Littlewild and Emberworks demonstrate what is configurable now, not unsupported settings or new mechanics.

## ECS refactor on PR #25

The compatibility-preserving M1–M6 plan is implemented and documented in `ECS-ARCHITECTURE.md`. The canonical `source/content/simulation-profile.json` combines validated actor/economy rule data with the exact compiled `living-world-v1` composition archetype. Schema-2 packs may tune bounded actor/economy values but cannot insert or reorder systems. The normal verification gate includes isolated ECS/profile suites plus real-engine migration, deterministic resume, logistics, quest, market, progression, schema/CLI, release, and browser compatibility checks. Mature domain methods remain compatibility adapters on one stable facade, so this is not a claim that every mechanic is an isolated ECS system.

- [`ECS-M6-REVIEW-AND-POLISH.md`](ECS-M6-REVIEW-AND-POLISH.md) — final architecture review and polishing evidence.
