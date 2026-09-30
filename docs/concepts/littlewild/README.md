# Littlewild v15 — Worlds of Possibility

An offline autonomous-creature simulation showcase with compact world-facing UI and reusable JSON scenario packs. The browser prototype is isolated from the native Motorsport Manager game.

The incremental ECS migration now covers actor dynamics plus task movement and elapsed-work progression. Save formats and authored content contracts remain unchanged; see `ECS-ARCHITECTURE.md`.

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

- `CONFIGURATION.md`: supported world/scene authoring and current engine boundaries.
- `UI-RESEARCH.md` and `UI-REVIEW.html`: research, observed baseline and actual captures.
- `VERIFICATION.md`: this build's executed checks and limitations.
- `CHANGELOG.md` and `CODE-REVIEW.md`: changes, module ownership and remaining coupling.
- `CONTENT-INTEGRATION.md`: existing Base/Adventure/World/Growth library contracts.

This is not yet an unrestricted game engine. Stable mechanic roles, handlers, island dimensions, creature rigs and some legacy wording remain code. Littlewild and Emberworks demonstrate what is configurable now, not unsupported settings or new mechanics.

## ECS refactor on PR #25

The first compatibility-preserving ECS migration and the next-stage architecture are documented in `ECS-ARCHITECTURE.md`. Its data-only actor rule manifest is `source/content/actor-rules.json`. The normal verification gate now includes standalone ECS tests and full-engine save/resume integration tests. This is an incremental simulation refactor, not a claim that the entire prototype already uses ECS.
