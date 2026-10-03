# Littlewild verification

Run `npm ci --no-audit --no-fund` and `npm run verify`. The complete gate runs strict TypeScript, architecture, compilation, 55 non-browser suites and all 20 browser suites. Supplemental PNG capture is explicitly opt-in with `LITTLEWILD_CAPTURE_SCREENSHOTS=1`; functional image comparisons remain mandatory.

## Final-source verification in progress

The reviewed capture-policy source checkpoint is `a1bc95db62d9a31f6d97c979a335b9dfa17b6117`. Its complete fresh gate is in progress. It fixes the first pushed head's 15-second supplemental screenshot timeout while preserving all assertions, limits, browser actions, diagnostics and functional image comparisons.

- Final input SHA-256: `6ba2e108553c2cd1d7b74f9ba522370b58d1b1f4a5778dd55152adc65e833049`
- Standalone SHA-256: `0f205d483b1dcc1ac17311b034d262f54355f0308518701b1ea377cf8078e007`
- Standalone bytes: 18761160
- Engine source inventory: 657 files, identity `3084091dd08a1b7e30a66725e77984c3962a36e0c26e2e1f3f8b5e2d2cbfb3e9`

The standalone, embedded source inventory and runtime bytes match the separately complete whitespace checkpoint. That checkpoint (`ddb3d83`, input `805258bd0a0002f8edabdb75a66e03d047e512fdcaea6b415b8a87026d655339`) passed **1,523/1,523 across 75 suites**, including 332 browser checks. It is historical relative to the 12 verifier-only capture-policy changes and does not certify this newer full gate. The earlier 9b56e8f complete result and the failed hosted attempt retain their original identities.

The independent review verifies 421 unchanged assertion expressions and their control flow, all timeouts, 37 explicit opt-in PNG sites and three mandatory buffer comparisons. Strict compilation, build and architecture 17/17 pass. See `PR25-POSTPUSH-REVIEW.md` for the exact failure, correction, focused browser proofs and acceptance boundaries.

## Additional repository evidence

The separately source-pinned merged-main native checkpoint (`0f9cd5e`) passed 103 suites / 21,346 checks across six shards with 537 UI captures and original suite limits. Python completed 335 tests: 334 passed and one expected platform skip. Native architecture: 453 scripts, zero violations. Advisory quality: 687 files, zero findings. Full identities and historical records remain in `delivery-manifest.json`.

Current-head hosted checks are separate from local evidence. The first pushed head's source packaging, quality, runtime confidence, content and standalone matrices passed; its Littlewild screenshot failure is retained, and native hosted verification was still running at this checkpoint. A later push must be checked independently.

## Limits

Headless tests do not establish hardware GPU performance, physical-device accessibility, human usability or balance. Editor exchange supports documented native data and static proxies. Complete engine JSON supplies inert code-generation inputs; semantic Godot gameplay conversion still requires a port.
