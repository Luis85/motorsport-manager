# ECS M3 verification evidence

## Local focused verification

| Suite | Result |
|---|---:|
| ECS core | 9 / 9 |
| ECS world settlement | 11 / 11 |
| ECS world integration | 6 / 6 |
| Existing ECS integration | 4 / 4 |
| v8 world, production, and logistics regression | 88 / 88 |
| v10 domain | 76 / 76 |
| v15 scenario domain | 77 / 77 |
| v15 pause policy | 54 / 54 |
| v15 presentation | 47 / 47 |
| v15 release contracts | 54 / 54 |
| Growth stress | 3 / 3 |

The release-contract fixture now explicitly records `world-simulation.js` as an ECS migration surface while retaining its prior v14 checksum. New source modules are bundled into the offline artifact through explicit build and index insertion points.

## Full branch gate

`verify-v15.py` now includes both new M3 suites in addition to the M2 activity suite and all existing domain, schema, release, browser, and browser-contract gates. The branch workflow rebuilds `littlewild.html` from the committed source and publishes fresh verification evidence; no locally generated standalone artifact is treated as authoritative.
