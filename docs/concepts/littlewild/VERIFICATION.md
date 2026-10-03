# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The full gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and two browser suites. `--no-browser` creates partial evidence only.

## Current local evidence

Complete gate: **853/853 checks across 31 suites**, completed `2026-10-03T09:32:52.691Z`.

- Authored input SHA-256: `9ab2e6734dfbd4d1b6dd79c62f68a94a2f013f407d83a522f38d031a33b2c269`
- Standalone SHA-256: `fcebf3a38c92d5c8329cf4ec5ae7784e9029c5785e95cdcbb93c38092b92648a`
- Standalone bytes: 4161545
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Machine evidence: `verification/v15/gate-results.json`; CI uploads fresh evidence for each PR run.

| Suite | Passed / total |
| --- | ---: |
| canvas-renderer | 29 / 29 |
| architecture-policy | 41 / 41 |
| storage-clock | 15 / 15 |
| gate-integrity | 20 / 20 |
| cli-contracts | 21 / 21 |
| typescript-architecture | 15 / 15 |
| behavior-tree | 7 / 7 |
| content-boundary | 6 / 6 |
| assets | 12 / 12 |
| creatures | 18 / 18 |
| ecs-core | 18 / 18 |
| simulation-profile | 19 / 19 |
| simulation-profile-integration | 17 / 17 |
| engine-composition | 24 / 24 |
| ecs-activity | 9 / 9 |
| ecs-world | 17 / 17 |
| ecs-economy | 15 / 15 |
| ecs-integration | 7 / 7 |
| ecs-world-integration | 6 / 6 |
| ecs-economy-integration | 9 / 9 |
| scenario-domain | 74 / 74 |
| presentation | 49 / 49 |
| pause-policy | 52 / 52 |
| cartography | 71 / 71 |
| domain | 82 / 82 |
| growth-stress | 3 / 3 |
| earned-progression | 8 / 8 |
| scenario-schema-cli | 47 / 47 |
| release | 28 / 28 |
| browser | 90 / 90 |
| browser-contracts | 24 / 24 |

## Evidence integrity

The gate clears previous suite results, requires explicit unique successful checks, bounds child processes, preserves failure logs, and rejects source/artifact changes during verification. All browser pages are monitored for warnings, errors, uncaught exceptions and network requests. Tests run against the rebuilt standalone under its production CSP. Historical result counts and milestone hashes are historical evidence only.

## Additional repository checks

Native Python tooling regressions: **106/106**. Native architecture scan: **190 scripts**, no violations. The complete local six-shard Godot gate was not run; PR CI owns that verification. Shared official actions are pinned to supported immutable versions.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch interaction, Firefox/Safari compatibility, screen-reader conformance, localization, human comprehension or balance. The native repository advisory report contains pre-existing findings outside Littlewild; policy and findings remain visible. See `QUALITY-AUDIT.md` for the fix inventory and typing/compatibility boundaries.
