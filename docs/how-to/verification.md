# Verify a checkout and interpret acceptance

Run commands from the repository root with the pinned **Godot 4.7.2 Standard**
binary. `scripts/verification_suites.json` owns the complete suite registry;
`tests/fixtures/required_verification_suites.json` protects the established floor.
No fixed suite count or old PR pass certifies a later source tree.

## Run the complete native gate

```sh
python3 scripts/verify.py --godot /path/to/pinned/godot
```

Alternatively set `GODOT_BINARY` or put the pinned `godot` on PATH. Linux native
UI checks require a display or `xvfb-run` plus `xauth`. The verifier imports a fresh
project copy, isolates user data, runs domain and rendered native suites, checks
process exits/logs, and requires fresh passing reports. Script, parse and engine
errors fail even when a suite reports success. Evidence is copied to `reports/`.

On Linux Xvfb runs use `opengl3_es` through EGL, software Mesa and Dummy audio.
The runner passes `--disable-vsync` to both engine and application; saved VSync
preferences are retained. Software-renderer results do not establish target-GPU
performance or platform-wide accessibility.

## Use focused checks while developing

```sh
python3 -m unittest discover -s tests -p 'test_*.py'
python3 scripts/check_architecture.py
python3 scripts/check_docs.py
python3 scripts/verify.py --list-suites
python3 scripts/verify.py --godot /path/to/pinned/godot --suite architecture_tests
python3 scripts/content.py schemas --check --godot /path/to/pinned/godot
python3 scripts/balance.py validate --godot /path/to/pinned/godot
```

Choose focused native IDs from the registry and repeat `--suite` for multiple
suites. `--headless-only` explicitly skips native UI suites. Focused runs, Python
checks, documentation checks and advisory quality are useful partial evidence;
they do not replace the complete native gate.

## Aggregate source-bound evidence

CI runs six shards with a required aggregate `verify` job. All shards must match
the exact expected registry and source digest. Missing, duplicate, malformed,
failed, partial, stale or mixed-source evidence fails aggregation. Downloaded
artifacts also require digest integrity. Documentation edits change the source
digest, so earlier passing artifacts cannot be labeled evidence for this sweep.

Content/schema/exported-runtime checks, Runtime confidence and Linux/Windows
standalone build/native smoke have separate workflows and evidence. Export
success alone is not runtime acceptance. See [standalone validation](standalone-validation.md),
[runtime confidence](runtime-confidence.md), [content contracts](../reference/content/README.md)
and [advisory quality](code-quality.md). Inspect checks attached to the actual
source revision instead of copying green state from an older PR.

## Read the reports

`reports/` is generated and ignored by Git. `verification.json` records actual
source, suites, results and timing; accompanying suite JSON, engine logs and PNGs
show what ran. Sharded CI uploads `verification-shard-*` artifacts. Other
workflows publish their own content, standalone and quality evidence. Exact
artifact names belong to the corresponding workflow configuration.

Counts may repeat per-car/per-step invariants; they are not independent player
scenarios. Screenshots may disclose synthetic fixtures. A fixture render is not
proof of a physically completed weekend. Source packaging is not gameplay
acceptance. Keep observation, extrapolation and unexecuted checks separate.

## Perform manual acceptance on the target device

1. Play a short dry Minimal weekend: command both drivers, use pace/engine and pit
   controls, inspect fuel/tyres, save mid-session, close, relaunch and continue.
2. Select Advanced in Settings, Apply, reopen a weekend and exercise its retained
   workspaces without creating another race or changing time through navigation.
3. Play a campaign event and review the factual debrief and next-event readiness.
4. Edit a copied circuit, undo/redo, save, export/import and test the detached draft
   in a weekend. Exercise enlarged text, native dialogs and keyboard focus.
5. Try a longer changing-weather race and the actual controller/display hardware
   intended for release; record source, platform and limitations.

Human comprehension, controller/screen-reader completeness, wet/endurance balance,
macOS support and representative-GPU performance remain separate validation.
See [current scope](../reference/current-state.md) and [historical verification records](../_archive/README.md).
