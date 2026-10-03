# Littlewild verification

Run `npm ci --no-audit --no-fund`, install Playwright Chromium, and run `npm run verify`. The full gate includes strict TypeScript, architecture, compilation, deterministic domain/CLI/release tests and two browser suites. `--no-browser` creates partial evidence only.

## Current local evidence

Complete gate: **915/915 checks across 32 suites**, completed `2026-10-03T10:15:23.783Z`.

- Authored input SHA-256: `8413d557b50496c2c3397d0e42723ff708aa517ff714e67a32d9aa5decb073ba`
- Standalone SHA-256: `b8535879a86ada692dbc57a398c0dd4e115014394d78c84f15b2fd8e4da4dccf`
- Standalone bytes: 4195034
- Runtime: `v24.19.0` on `linux/x64`
- Chromium: `/usr/bin/chromium`
- Machine evidence: `verification/v15/gate-results.json`; CI uploads fresh evidence for each PR run.

| Suite | Passed / total |
| --- | ---: |
| canvas-renderer | 29 / 29 |
| architecture-policy | 52 / 52 |
| storage-clock | 15 / 15 |
| gate-integrity | 21 / 21 |
| cli-contracts | 23 / 23 |
| typescript-architecture | 15 / 15 |
| behavior-tree | 7 / 7 |
| content-boundary | 15 / 15 |
| assets | 15 / 15 |
| creatures | 23 / 23 |
| ecs-core | 19 / 19 |
| simulation-profile | 19 / 19 |
| simulation-profile-integration | 17 / 17 |
| developer-toolbox | 19 / 19 |
| engine-composition | 28 / 28 |
| ecs-activity | 9 / 9 |
| ecs-world | 24 / 24 |
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

## Independent review and developer acceptance

Independent review of committed source `c93a91d68b67dda94fd2764b52914942e6d80500` found no remaining actionable blockers after fixes. The complete gate ran from a clean git archive of that commit. Supplementary actual shipping-browser SDK checks passed **3/3**: discovery, asset validation and host activation rejection preserve registry and engine state, with clean page/console/network diagnostics. SDK Node/browser-global integration and positive/negative TypeScript consumers are included in the registered gate.

## Additional repository checks

Native Python tooling regressions: **106/106**. Native architecture scan: **190 scripts**, no violations. A complete local registered Godot run is additionally in progress against immutable checkpoint `0a82de68d0505542f524033cd087c03d5b843fcc`; its final result is recorded separately when complete. Native gameplay source has not changed since that checkpoint. PR CI verifies the pushed head. Shared official actions are pinned to supported immutable versions.

## Limits

Headless Chromium does not establish hardware GPU performance, physical touch interaction, Firefox/Safari compatibility, screen-reader conformance, localization, human comprehension or balance. The native repository advisory report contains pre-existing findings outside Littlewild; policy and findings remain visible. See `QUALITY-AUDIT.md` for the fix inventory and typing/compatibility boundaries.
