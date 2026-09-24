# Race weekend — living racecraft and team coordination

Design basis: Race Weekend GDD v1.0, sections 10, 12, 16, 24 and 25. Starting point: `17948096ddb2d7c866d909acde825e5a84395f9a` (the initial Stage A strategy slice). This iteration continues PR #1 without changing main.

## Implementation sequence

1. Extend RW-07 with public-stop observations and bounded cover/extend responses; keep private player drafts and future weather inaccessible.
2. Implement RW-09 persistent battle targets, preparation, commitment, alongside, resolution and recovery through the existing physical corridor solver. No teleportation, fabricated pass events or racing under prohibited flags.
3. Implement RW-10 explicit two-driver hold/yield/pit-priority instructions. Safety and physical commitment take precedence. Priority can defer an uncommitted delegated stop inside its approved window, never reorder already committed cars.
4. Expose live battle/team state in native controls, add save migration, deterministic adversarial tests and native interaction coverage, then run the complete verification suite.

## Preserved contracts

Native Godot, flat dot cars, finite driver-owned four-wheel sets, 0.05-second simulation steps, physical pit routes, correct classification, independent domain ownership and explicit player control of pause/speed remain authoritative. The circuit editor, campaign economy, weather model and new sporting formats are outside this iteration.

## Acceptance boundary

Automated tests must cover public-information fairness, aborted and completed battles, prohibited passing, same-seed continuation after save/load, team command permissions and expiry, manual pit ownership, physical shared-box ordering, invalid-command atomicity, stable focus and both desktop layouts. Human enjoyment, broad strategy balance and calibrated forecast probabilities are separate open validation gates. Completed behavior and actual evidence will be recorded here after verification.

**Status:** implementation in progress; this planning commit does not claim the mechanics are delivered.
