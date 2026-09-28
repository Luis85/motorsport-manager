# Standalone build and recovery validation

The export contract is Godot **4.7.2.stable.official.ed1daf0bf**, the matching
four SHA-256-pinned desktop templates in `scripts/build_standalone.py`, and the
version-controlled **Linux Desktop** / **Windows Desktop** presets. No engine
migration or sporting save migration is involved.

## Build and play

Download a `standalone-linux-release` or `standalone-windows-release` artifact
from the **Standalone application** workflow. Extract the downloaded artifact ZIP,
then extract its inner `standalone-<platform>-<mode>.tar.gz` into a writable folder.
Keep `Motorsport Manager.pck` beside the executable; start the executable, not
`project.godot`. The engine and source editor are not needed to play. Debug and
release builds are separate artifacts, with separate acceptance reports.

To build from a checkout with the pinned editor and verified templates:

```sh
python3 scripts/build_standalone.py --godot /path/to/pinned/godot \
  --templates /path/to/desktop-templates --target linux --mode release \
  --revision "$(git rev-parse HEAD)" --output builds/linux-release
python3 scripts/smoke_standalone.py --package builds/linux-release \
  --output reports/standalone-linux-release
```

Use `--target windows` and the matching Windows template pair for a Windows
build. Building that pair on Linux **does not** establish Windows runtime support.
The workflow executes each exported `.exe` on a fresh **windows-2022** runner.
A completed build job is different from a completed native-smoke job.

The build wrapper hashes actual source and toolchain bytes, imports a clean
staging project without `.godot`, and uses the named presets. It embeds
`build-identity.json` as developer provenance, not in the sporting save. Its
manifest also records the actual executable and PCK hashes. A nonempty output
folder, wrong engine version, missing/different template, failed export, or
missing PCK fails closed. Disclose dirty source changes in `--revision`.

## What the executable journey establishes

The smoke wrapper copies only the executable and PCK to a new directory named
`Clean application – Ω`. The running application cannot consult the source
checkout or its editor import cache. It checks packaged source identity,
actual debug/release features, bundled track/scenario JSON, and real user-data
paths before executing a stage. A token proves ownership of the test data.

The eight-process sequence covers launch, apply settings, configure a weekend,
start practice, send both drivers, run real fixed steps, save, exit, relaunch,
continue, compare restored state/RNG and subsequent behavior, and save again.
The editor then creates and saves a Unicode-named circuit, imports an external
reference image from a path containing spaces/Unicode, exports/imports authoring
JSON, exits and reloads both the circuit and embedded reference in a third
process. Native screenshots are retained; reference preview starts and cancels.

This is a scripted journey through application/native-control APIs, not a human
usability study or keyboard-only acceptance. It supplements the existing full
physical-weekend and six-size/text regression suites; it does not replace them.
The developer entry point is inactive unless explicitly invoked with
`--standalone-smoke=<stage>` and the wrapper's validated environment. There is
no new player menu, telemetry panel, mechanic, replay engine or save format.

Linux uses a fresh `XDG_DATA_HOME`; the wrapper uses its own Xvfb display when
available. Windows runs only on a disposable GitHub runner with an absent actual
application-data slot. A Windows known-folder resolver need not honor an APPDATA
override, so the wrapper never assumes such an override proves isolation. It
refuses an existing slot and never deletes a player's saved games. Reports retain
the actual path, renderer, source, mode, checks and process boundaries.

## Real filesystem recovery

The existing `Storage.FileOperations` seam is retained. A developer subclass
performs the **real** flushed write or rename, then waits. The wrapper kills its
owned process tree at two explicit boundaries: after the temporary file is
flushed and after the primary is renamed to backup. New processes verify the
actual primary/temporary/backup contents before a retry. This complements the
injected failure suites rather than replacing them with a fake filesystem.

Recovery from the second boundary explicitly restores the known-valid backup
before retrying the normal production write. This is developer recovery evidence,
**not a claim of automatic player-facing backup fallback**. No stale unrelated
backup is silently loaded. A real file-as-parent obstruction tests an unavailable
destination even when the test process has elevated permissions; it is not a
claim that a chmod permission test ran under a restricted OS account. Another
restart removes only that owned obstruction and retries the save successfully.

The acceptance JSON distinguishes `runtime_verified` from the build manifest's
initial false value, and records each stage. A stale report, runtime script error,
wrong source/mode, altered artifact hash or missing result fails the wrapper.
The advisory quality job remains advisory; exported-app correctness is checked
separately.

## Evidence status at initial publication

A local Linux **debug** export completed all eight stages: **129 checks**, four
native screenshots, two actual killed/restarted filesystem stages. Engine:
4.7.2.stable.official.ed1daf0bf; OpenGL compatibility with llvmpipe on Linux.
Tested candidate source digest:
`aa8eb2b744ddc4eaa304e95097fa120faa1af7ca689a292fadb564508acf371b`.
This identifies the local candidate before this guide, not a future commit.
Fourteen Python launcher contract tests and the 190-script architecture guard
passed. Release and Windows runtime acceptance were still open at publication;
consult the exact-source workflow artifacts, not this dated status, for results.

## Primary implementation references

Godot's command-line export documentation specifies named presets, editor versus
template roles and distinct debug/release switches:
https://docs.godotengine.org/en/4.6/tutorials/editor/command_line_tutorial.html

Export filters and configuration are described in the engine's export guide:
https://docs.godotengine.org/en/4.6/tutorials/export/exporting_projects.html

## Artifact transport regression

The first hosted Linux runs reached `create` but could not start the executable:
`Permission denied`. The source export had executable permissions; GitHub's
artifact ZIP transport normalized files to 0644. The workflow now uploads a tar
archive and extracts that exact distributed archive before the native smoke.
It does not silently repair the runtime copy with chmod and call the broken
player download verified. `test_standalone_archive.py` checks executable mode,
actual launch, manifest hashes, and Unicode/space paths across the ZIP/tar journey.

GitHub documents artifact permission loss and tar-based preservation:
https://github.com/actions/upload-artifact#permission-loss

Windows hosted extraction exposed two separate path errors: a drive colon was
interpreted as a remote archive host, then `--force-local` still left a mixed
backslash/forward-slash `-C` destination which GNU tar could not open. The workflow
now sets the working directory through the runner and passes only relative archive
and destination paths to tar. The transport regression uses that same process-cwd
and relative-path pattern, including Unicode/spaces and a colon-bearing archive
basename, then validates hashes and actually launches the extracted executable.
Actual Windows application execution remains a separate native-smoke requirement.
