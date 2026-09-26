# Finishing verification and release-platform gates

## Source and scope

This report belongs to the continuation of PR #12 on `feat/race-weekend-ui-overhaul`, recovered at `c0c6a9164030258ddb84cdf282e724bd636d5920` (tree `cc145c40d4ffbb307dbd40b6664f996d92113db7`). The original handoff was `d5832348…`; the newer tree was not overwritten by that fallback. Final commit, source tree, archive SHA-256 and hosted CI are established **after publication** in the delivered publication receipt and PR, not guessed inside this commit.

The native implementation and engineering visual review are recorded separately from OS/device/manual acceptance in [finish-ledger.md](finish-ledger.md). This is not a browser implementation, a certification of the full GDD, or a claim that a synthetic input event proves physical controller support.

## Recovered failure and reproducing tests

Hosted run **#268 / 36205488914** failed four compact UI assertions. The compact suite passed **119 checks** when run with clean user data. Running the guide first reproduced the **same four failures**: the guide persisted 130% text preferences, which the following compact suite inherited. The prior runner isolated the whole run from the user's real data but did not isolate one suite from another.

`isolate_phase()` now assigns each subprocess a unique verification application name and XDG/APPDATA/LOCALAPPDATA directory. It refuses to rename a real production project or a path outside its private copy. Previous suite data is preserved as evidence, not deleted. Every existing compact assertion remains intact.

`tests/test_verify_runner.py` has five regressions, including an actual pinned-Godot user-directory write/read test. Native guide → compact then passed **300 + 119 checks** sequentially, followed by the bounded native soak. The directory resolver check is headless; the guide/compact tests render and receive native input under Xvfb. These are deliberately different evidence types.

Final visual review added a second reproducer: compact qualifying's release-time line was clipped and could imply that its new-release estimate was the active hot lap's countdown. Four red assertions produced a two-line fit/meaning repair. The final observation suite passes **19 checks**, including actual native releases and physically active hot laps at 1100×720/130%.

## Executed targeted acceptance

| Evidence | Result | Meaning |
|---|---:|---|
| Fresh import and production script load | 104 scripts, no parse/runtime errors | Pinned 4.7.2 native source is importable. |
| Runner regressions | 5 tests | Per-suite data isolation, production-path safeguard and exit-zero error detection. |
| Observation | 19 checks / 4 captures | Names, secondary issues and qualifying release semantics/fit. |
| Populated physical matrix | 655 checks / 149 captures | Actual practice, qualifying, preparation, formation, race, service, weather and results lineage; A–C and primary scale cross-product. |
| Scrolled analytical detail, standalone | 111 checks / 15 captures | Physical lineage generation plus weather cases/alternatives, practice costs, MOR service detail and sectors. |
| Retained completion | 68 checks / 21 captures | Reviewed targeting, native keyboard/gamepad events, shared workspaces and draft/authority boundaries. |
| Retained repair | 89 checks / 5 captures | Existing repaired behavior remains protected. |

The detail suite can also reuse hash-checked physical report snapshots produced immediately before it by the populated suite. That full-run path independently passed **77 checks** using the retained hash-checked states and has a different assertion count because it verifies retained sources instead of generating the lineage again; `ui-finish-details.json` is authoritative for the executed count. It does not reuse another suite's settings or user save.

The full runner retains all original domain, strategy, weather, recovery, practice, rivals, replay, notebook, scenario-authoring, native UI and performance suites. It also runs observation, analysis, execution, guide, populated, details, states and soak finishing suites. New reports must pass; error logs are not ignored because the process exits zero. The final `verification.json` provides exact suite totals and screenshot counts, including the added finishing captures.

**Source honesty:** the long local full-run rehearsal and 30-minute soak were started before the final qualifying wording-only change and the new detail suite/registration. All four targeted source-final suites above were rerun after the qualifying fix; detail was independently run on that source. The exact final-head hosted full runner is a separate post-publication gate. Do not label the earlier local full-run copy as the exact final tree. Source-scope records in the delivery evidence distinguish these runs. The rehearsal runner removes its temporary project on completion; it is not represented as an exact frozen commit. Retained final-source copies receive per-file manifests.

### Completed full local rehearsal

The retained full runner completed successfully: **3,978 counted checks, 331 native screenshots, five runner unit tests**, plus observational performance outputs. All phase logs were scanned; no script/parse/runtime errors were accepted. The later source-final qualifying and detail tests are listed separately above. The final exact-head hosted run must not be conflated with this earlier rehearsal.

## Physical versus synthetic evidence

`ui_finish_populated_tests.gd` creates real two-driver practice programmes, a completed and recalled run, manual qualifying releases, a closed session with hot laps in progress, explicit race approvals, formation/lights, measured race laps, reviewed pit calls, physical service/rejoin and final classification. A separate seeded wet run supplies observed surface and public weather evidence. Each retained snapshot includes seed, session/time, engine, viewport/text preference and a hash in `physical-provenance.json`; the snapshot itself is retained for reproduction.

Synthetic fixtures deliberately exercise puncture/low-fuel pressure, absent/nonfinite samples, missing categories, unequal stint histories, long radio retention, style states and selected receipt boundaries. They are labeled synthetic in the capture/report. Their data is not advertised as a physical race outcome. Native state/hit-target/contrast tests do not establish enjoyment or human accessibility.

## Supported native profile matrix

All screen families are rendered at **1440×900/100%, 1280×800/115%, 1100×720/130%**. Race, confirmation, practice, focused strategy and results additionally sweep **100/115/130%** on those three sizes, and **1920×1080 at 100/130%**. Focused result inspection survives a live resize and preserves its selected sample and authoritative race state.

Control assertions check visibility, viewport bounds and clipping ancestors. Native wheel scrolling reaches long evidence while fixed commands remain visible. Pointer, keyboard and synthetic joypad events exercise the composed production scene. The [visual review](finish-visual-acceptance.md) independently inspects hierarchy, density, typography, semantics, states and input/reflow continuity; colors alone do not establish acceptance.

## Performance evidence and budgets

The default finishing soak is a bounded 30-second native workload in the full runner. The extended acceptance run uses the same test for **1800 seconds of wall time**, alternating explicitly selected 1×/16× speeds, live production frame processing, paused inspection checkpoints, workspace transitions and a separately sampled refresh workload. It does not substitute a headless fixed-step benchmark for native responsiveness.

The reproducible local profile is Linux, Xvfb, Mesa llvmpipe, Dummy audio, AMD EPYC 9V74 and `LP_NUM_THREADS=2`, pinned `4.7.2.stable.official.ed1daf0bf`. Other test processes can contend for CPU. Frame and refresh median/p95/max, static memory observations, node/style counts and completed physical session hashes are in `ui-finish-soak.json` and its progress report. Measurements are not a portable 60-FPS guarantee.

Local engineering invariants are strict: the warmed-up composed node tree must not grow during repeated inspection; cached race styles may grow by at most four during the bounded transition workload; the existing workspace/UX/replay/notebook performance suites keep their original checks. Model history and recorded samples legitimately consume bounded storage, so static memory is reported rather than incorrectly required to stay byte-identical. Physical simulation throughput and pause/inspection time are not conflated with frame rendering latency.

### Completed extended local run

The 30-minute run completed in **1800.192 seconds**, with **606 checks passed**, **17,479 rendered-loop frames** and two completed physical 100-lap sessions before continuing into a third. The composed node count stayed **1,827** and cached race styles stayed **3** throughout inspection observations. Observed static memory ranged **135.4–152.9 MB** as bounded model/history data accumulated and sessions changed; this is not a zero-allocation claim.

The separately measured refresh workload had **2.767 ms median / 4.621 ms p95 / 52.556 ms maximum** over 1,785 calls. Sampled frame intervals had **56.497 ms median / 229.935 ms p95 / 6,184.741 ms maximum** under software rendering, simultaneous regression workloads, explicit inspection pauses and session recreation. These frame intervals include that mixed workload and do **not** establish a 60-FPS or input-latency target. The passing checks establish bounded resources, state/focus invariants and physical continuation, not universal rendering performance. Broad hardware/performance acceptance remains P04.

## Reproduction

Use an absolute path to the pinned standard editor:

```sh
LP_NUM_THREADS=2 python3 scripts/verify.py --godot /absolute/path/to/Godot_v4.7.2-stable_linux.x86_64
```

The runner copies the project, performs a clean import, isolates each suite's user data, uses native Xvfb where available, requires passing JSON reports and scans output for script/parse/runtime errors. `--headless-only` is explicitly not native UI acceptance. Review `reports/verification.json` and all phase logs, not only the shell return code.

For the separately disclosed long native soak on Linux, use a clean disposable copy and preserve its reports:

```sh
set -eu
export GODOT=/absolute/path/to/Godot_v4.7.2-stable_linux.x86_64
export LP_NUM_THREADS=2 GODOT_SILENCE_ROOT_WARNING=1 LIBGL_ALWAYS_SOFTWARE=1
work=$(mktemp -d)
git archive HEAD | tar -x -C "$work"
python3 - "$work" <<'PY'
from pathlib import Path
import sys, uuid
p = Path(sys.argv[1]) / "project.godot"
p.write_text(p.read_text().replace('config/name="Motorsport Manager"',
    'config/name="MotorsportManagerVerification-soak-' + uuid.uuid4().hex + '"'))
PY
mkdir -p "$work/reports" "$work/user"
export XDG_DATA_HOME="$work/user" APPDATA="$work/user" LOCALAPPDATA="$work/user"
"$GODOT" --path "$work" --headless --editor --quit > "$work/reports/import.log" 2>&1
xvfb-run -a -s '-screen 0 2000x1200x24' "$GODOT" --path "$work" \
  --audio-driver Dummy --script res://tests/ui_finish_soak_tests.gd \
  -- soak_seconds=1800 > "$work/reports/soak.log" 2>&1
printf 'Preserved native evidence: %s/reports\n' "$work"
```

The script clamps the optional soak duration to 30–3600 seconds. Inspect its passed/errors fields and logs. It generates no production configuration/save modifications and never deletes the real user directory.

## Publication checks

Before a non-force branch update, re-read PR/head and preserve any intervening work. Compare the local staged tree with the Git API-created tree. After publication, re-read the remote head/tree and workflow conclusion. Extract the exact source archive into a fresh directory; reproduce its Git tree and run clean pinned import plus production script loading. Compare per-file hashes with the hosted verification-source archive; a PR test-merge commit ID can differ while the source tree is identical, so record both instead of assuming equality.

Keep the original/native/synthetic provenance manifests and the final archive SHA-256. No Godot cache, user data, font files, credentials or write-enabled publication workflow belongs in the source package. The workflow itself remains read-only. The final delivery receipt records the exact remote SHA/tree and successful/failed/pending CI truthfully at delivery time.

## Explicit blocked platform/manual gates

| Gate | Required evidence | Status / reason |
|---|---|---|
| P01 — Physical controller | Real connected device; mapping, repeat/hold, disconnect/reconnect and modal behavior | Not certified. Synthetic native joypad events verify software routing only. |
| P02 — Windows assistive technology | Actual screen-reader announcements, focus order and dynamic evidence on supported Windows | Not certified. Linux accessibility metadata is not a Windows reader session. |
| P03 — Export/Windows DPI | Packaged build launch, monitor/DPI changes, file dialogs, save/replay and font rendering | Blocked in this environment: no Windows desktop/export-template validation. Editor execution is not an exported-build pass. |
| P04 — Broad hardware performance | Named minimum/recommended GPU/CPU, sustained native play and input latency | Not certified. Local/hosted llvmpipe measurements have their own machine/workload limits. |
| P05 — Human usability/access needs | Newcomer and experienced-player tasks, comprehension and disability-access sessions | Not performed. Automated correctness and engineering visual inspection are not user research. |

These gates are not hidden code gaps or permission to add placeholder controls. They prevent a universal release-platform completion claim while preserving the substantial implemented and native-tested work.
