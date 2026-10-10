# Armored Platoon bounded verification evidence — 2026-10-10

> Historical implementation evidence from the work based on `749a9f6296f3beb665eedf1eda57ae8cbfd00b39`. These captures establish the behavior described below for particular artifacts. They do not establish reference-game parity or hardware acceptance.

This directory retains small, portable reports and selected captures. Generated HTML, raw frame streams, and full build logs are excluded. The [integration record](../armored-platoon-2026-10-10-integration.md) and [parity ledger](../../reference/armored-platoon-parity.md) record the broader scope and outstanding gaps. [SHA-256 manifest](manifest.json) covers every retained evidence file; source digests and complete command sequences are embedded in the two session reports.

## Artifact identities

| Artifact | Bytes | SHA-256 | Evidence scope |
| --- | ---: | --- | --- |
| Intermediate compiled browser artifact | 1,802,555 | `dffbbdb19f615925a09631cd3e84621742b2fb243feae218e2d3452f5a339558` | Nine browser checks, chase/gunner/phone captures, short motion recording |
| Later compiled Pine browser artifact | 1,803,580 | `9b561acf571dcce27c76ba68bcdc85e0ef02b8215cefe1d471401b32a60f686e` | Original Pine mission from menu to victory debrief |
| Published demo | 1,803,890 | `4708ad9b3cd9343ee69b1de248eaeef344b767d83e39bf2ad250271b6737c22d` | Packaging comparison; gzip size 332,430 bytes |

These are distinct files. [Published identity comparison](published-identity.json) records 21 byte-identical runtime inline scripts and identical CSS between the Pine artifact and published demo. The remaining catalog/visual-data script is identical after the exact added `LWGameProfile` storage-prefix statement is removed. Wrapper metadata and the explicit storage namespace differ. This supports code/data continuity; it does not turn the Pine run into a run of the published bytes. Published-demo lifecycle verification belongs to the final repository gate, whose full logs are not retained here.

## Browser checks and selected captures

[Intermediate result](armored-browser-results.json) records 9/9 checks passing. [Intermediate identity](intermediate-browser-identity.json) binds that result and the retained screenshots to its compiled artifact. The [browser suite](../../../source/wildlands/source/test-armored-browser.cts) covers menu/briefing/deployment and real WebGL, keyboard driving, pause and detached queries, three camera modes, ammunition and reload, platoon handover and orders, checkpoint rejection/replacement and UI save/load, desktop/compact HUD bounds, and absence of script errors or external requests.

The direct invocation used from `source/wildlands` was:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium node --import tsx source/test-armored-browser.cts
```

This invocation requires the repository dependencies and a built artifact. Running it against a later build creates new evidence, not a reproduction of the intermediate identity above.

- [Chase view](armored-chase.png)
- [Gunner view](armored-gunner.png)
- [390 × 844 phone observation](armored-phone-observation.png): layout observation only; touch driving is not implemented or accepted.

[Short motion recording](armored-motion.mp4) and [before/after observations](motion-observations.json) show actual keyboard drive, traverse, camera switching and fire at 960 × 600. The recording contains 21 captured frames over approximately 15.196 seconds of wall time; simulation advanced from tick 0 to 127 (2.117 simulated seconds). The controlled chassis moved approximately 5.607 metres, turret yaw changed from 0 to 0.325 radians, and AP ammunition decreased from 15 to 14. There were no recorded page errors. Sparse software-rendered capture cadence must not be interpreted as representative game frame rate.

## Pine browser mission completion

[Pine browser result](pine-browser-result.json) records a fresh menu selection and deployment into the original authored Pine mission, followed by 1,799 accepted public drive commands derived from detached queries. The vehicle reached the rally objective and retreated to cover. Victory occurred at tick 10,800 (180 simulated seconds), with `rally-platoon = 1` and `hold-ridge = 180`. The visible debrief read “Mission accomplished.” [Victory debrief capture](pine-victory-debrief.png) was taken at 1440 × 900. There were no recorded page errors.

The route used the public `WildlandsArmored.query` and `WildlandsArmored.command` ports. It did not restore a checkpoint, inject mission state, or invoke a private session tick. Before application boot, a requestAnimationFrame adapter supplied 100 milliseconds of application time per actual rendered frame; the application's existing six-tick frame cap remained intact. This clock acceleration tests mission progression and the terminal interface, not normal real-time performance or manual play.

Total observed wall time was 437.834 seconds. The initial route viewport was 480 × 320; it was reduced on the same live page to 320 × 240 after the tick-5,304 observation. The debrief capture used the larger viewport stated above. The report includes the viewport sequence, commands, timeline, terminal snapshot, screenshot digest, and a live observation from the original page.

## Session command evidence

| Report | Method and observed outcome |
| --- | --- |
| [Pine session commands](pine-session-command-report.json) | Fresh original catalog, 1,800 accepted drive commands and explicit six-tick session steps; victory at 180 seconds. |
| [Crossroads session commands](crossroads-session-command-report.json) | Fresh original catalog, 5,692 drive/aim/fire/ammo/control commands with explicit six-tick session steps; victory at 201.15 seconds after vehicle loss, handover and a flank. |

These are independent Node session runs, not additional browser completions. Both reports include full command sequences and SHA-256 digests of the exact catalog and relevant combat, AI, mission, physics, session, checkpoint and catalog-admission sources. Neither run uses checkpoint restoration or direct state injection. They establish possible successful routes through the two authored missions; they do not establish reference mission or AI fidelity. Pine's late withdrawal included momentum/downhill coasting after gunner disability, rather than powered driving throughout. The successful Crossroads route waited out finite enemy AP reserves before flanking; this exposes an AI ammunition-management and balance weakness.

## Environment and limits

Browser observations used Chromium 151.0.7922.173, Playwright 1.63.0 and software WebGL through `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. Node session reports identify Node v24.19.0. The Linux environment was not a representative gaming GPU.

At Pine tick 5,304, observed JavaScript heap use was 23,366,073 bytes out of 32,258,189 allocated bytes. This single point does not measure total process or GPU memory or establish stability. Navigation load time was 6,141 milliseconds for routed in-memory HTML; it is not a network cold-load benchmark. Renderer internals were not exposed to extract Three.js renderer counters.

No 30-minute hardware soak, representative hardware frame-rate acceptance, human usability study, reference-game visual comparison, or full fidelity acceptance is established by this directory. Screenshot presence and successful terminal objectives do not close the gaps documented in the parity ledger.
