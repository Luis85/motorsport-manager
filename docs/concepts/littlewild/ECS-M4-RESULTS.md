# ECS M4 verification evidence

## Focused verification

| Suite | Result |
|---|---:|
| Economy ECS unit checks | 12 / 12 |
| Economy real-engine integration | 8 / 8 |
| Scenario domain | 77 / 77 |
| v10 domain | 76 / 76 |
| Cartography/domain | 73 / 73 |
| Legacy v5 | 133 / 133 |
| Legacy v6 | 52 / 52 |
| Legacy v8 | 88 / 88 |
| Quality v9 | 31 / 31 |
| Foundation v9 | 31 / 31 plus 8,432 exact path comparisons |
| Growth stress | 3 / 3 |

The direct-mutation audit found no remaining guide/actor coin, shared-research, XP, or prestige arithmetic in the simulation layers outside `economy-ecs.js` and its tests.

## Full branch gate

`verify-v15.py` now includes the isolated economy and real-engine economy integration suites in addition to the M1–M3 ECS suites and every existing scenario, domain, migration, schema, release, browser, and browser-contract gate. The branch workflow rebuilds `littlewild.html` from committed source before running the complete gate; generated verification evidence and the standalone artifact are committed only after all checks pass.
