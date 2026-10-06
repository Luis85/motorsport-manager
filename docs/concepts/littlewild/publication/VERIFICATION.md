# Littlewild v15 verification — 29 September 2026

> **Historical pre-TypeScript publication evidence.** This record describes the one-time v15 payload publication and its then-current Python/JavaScript gate. It is retained for provenance only and is not current-head verification. See [`../VERIFICATION.md`](../VERIFICATION.md) for the authoritative TypeScript gate.

## Product build

The supplied v15 source ZIP passed its archive-integrity check and was extracted
into an isolated directory. `python verify-v15.py` rebuilt the HTML and reran the
complete registered v15 gate: **871 / 871 checks in 17 suites**, including **105
browser checks**. No gameplay or UI source was modified during publication.

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

`game-gate.json` records the actual source-verification run.
`payload-manifest.json` pins the supplied source archive. The rebuilt standalone
HTML matches the supplied artifact exactly.

## Publication helper

The publication helper's safety/integration suite passed before remote publication.
Coverage includes pinned archive identity, invalid paths, symlinks, case
collisions, missing payload, unapproved replacement, write-free rejection,
allowed destination scope, detached-worktree commit/push behavior, and idempotent
retry.

The remote one-time installer additionally reassembled **72 / 72** exact transfer
chunks, verified transport SHA-256
`cba1683fbbeefbd471d7d4b8016d6d69c068f9efc6ac92b7e15ea1a72146c484`,
safely extracted the authored files, reproduced the pinned vendor, rebuilt the
standalone HTML, and verified the final SHA-256 before committing.

GitHub Actions publication run `36643462040` completed successfully. Installation
commit: `a5436ecbe7d140579fc83efb254fad28b58e6f11`.

## Remote state and limits

The branch now contains the runnable standalone HTML, full authored source,
vendor dependency, scenario/configuration packs, tests, and documentation. The
temporary transfer chunks, trigger files, installer, and one-time workflow were
removed after successful installation.

No native Motorsport Manager gameplay files were changed by the installer. The
native Godot six-shard gate was not rerun by the one-time publication workflow.
Browser rendering evidence uses the software fallback; hardware WebGL, native
local-file persistence, other physical devices, screen readers, and human
usability remain unverified.
