# Resumption verification — 29 September 2026

## Product build

The supplied v15 source ZIP passed its archive-integrity check and was extracted
into an isolated directory. `python verify-v15.py` rebuilt the HTML and reran the
complete registered v15 gate: **871 / 871 checks in 17 suites**, including **105
browser checks**. No gameplay or UI source was modified during this resumption.

HTML SHA-256: `acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032`

| Suite | Passed / total | Seconds |
|---|---:|---:|
| scenario-domain | 77 / 77 | 5.42 |
| presentation | 47 / 47 | 0.43 |
| pause-policy | 54 / 54 | 0.53 |
| cartography | 73 / 73 | 2.58 |
| domain | 76 / 76 | 1.81 |
| growth-stress | 3 / 3 | 6.57 |
| earned-progression | 8 / 8 | 2.32 |
| legacy-v5 | 133 / 133 | 3.12 |
| legacy-v6 | 52 / 52 | 5.67 |
| legacy-v8 | 88 / 88 | 6.94 |
| quality-v9 | 31 / 31 | 1.02 |
| foundation-v9 | 31 / 31 | 7.46 |
| legacy-schemas | 19 / 19 | 1.87 |
| scenario-schema-cli | 21 / 21 | 2.59 |
| release | 53 / 53 | 3.41 |
| browser | 89 / 89 | 14.43 |
| browser-contracts | 16 / 16 | 5.75 |

`game-gate.json` records the actual current run. This is local test evidence,
not a GitHub CI result. The supplied source ZIP remains unchanged and is pinned
by `payload-manifest.json`; the rebuilt HTML matches the supplied standalone file.

## Publication helper

**18 / 18 tests passed.** The tests cover pinned archive identity, invalid paths,
symlinks, case collisions, missing payload, unapproved replacement, write-free
rejection, allowed destination scope, an actual detached-worktree commit and push
to a temporary local bare Git repository, and idempotent retry. The GitHub CLI was
an explicit fake in the integration test. No claim of remote publication follows
from those tests. The known staging README can be replaced; arbitrary user files
cannot. The active checkout branch and native-file sentinel remained unchanged.

Reproduce the helper tests with the original ZIP available:

```sh
LITTLEWILD_SOURCE_ZIP=/absolute/path/to/littlewild-v15-source.zip \
  python -m unittest discover -s docs/concepts/littlewild/publication -p 'test_*.py'
```

## Actual remote state and limits

This commit publishes support files only. The full game and source have not been
uploaded. The PR must remain draft until the pinned payload is installed, rebuilt
and pushed. The native Motorsport Manager Godot gate was not run; no native game
files are changed. Browser rendering used the software fallback. Hardware WebGL,
local-file persistence, other browsers, physical touch, screen readers and human
usability remain unverified.
