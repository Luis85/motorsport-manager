# Race weekend — optional purposeful practice

Design basis: Race Weekend GDD v1.0, RW-17 and sections 7.2, 9.5, 17, 20, 22 and 25. Baseline: merged native 0.9.0 at `66c2338a3f708123265bc6c1e55923296638a1f7`. This increment targets 0.10.0 on `feat/race-weekend-practice`, with a PR directly into main.

## Implementation contract

An optional, explicitly started session before qualifying lets both drivers run complementary tyre-life, qualifying-preparation, setup-comparison or wet-learning objectives. A release commits a named driver's real set and setup. Engineers execute out/measured/in laps through the existing fixed-step movement and pit geometry. Runs spend time, finite tyre condition, fuel and lifetime health. Recall and closure retain partial observations. Practice laps never become qualifying results.

Practice evidence can inform bounded coarse forecasts only when driver, compound, setup, modes and conditions are comparable. Traffic/neutralization contamination is labeled, not silently credited as confidence. Estimates and recommendations never change vehicle performance, apply a hidden optimum or create a universal setup bonus. Skipping uses the baseline model and normal delegation without a hidden penalty.

Retain the merged task-oriented native pit wall, text scaling, both drivers' primary actions, explicit session approvals and player-owned pause/speed. New state needs validated checkpoint persistence and old-save migration without invented practice history. Existing race, weather, recovery, editor and UX tests remain in the runner.

## Verification plan

Exercise actual multi-lap runs and physical return, finite stock/health costs, interrupted samples, clock closure, command atomicity, both driver recipients, no qualifying pollution, observational forecasts, compatible learning and invalidation, live JSON continuation, legacy behavior and malformed-save rejection. Verify native controls at 1440×900 and 1100×720 with existing enlarged-text settings. Run a complete practice-to-race lifecycle and the unchanged baseline suites.

## Status and limits

Implementation in progress. This planning commit does not claim delivered functionality. Coefficients, sample matching and confidence wording remain tuning hypotheses; human comprehension, forecast calibration and wider balance are not established by automated checks. Driver pressure, broader rulesets, replay and once-only campaign settlement remain outside this increment.
