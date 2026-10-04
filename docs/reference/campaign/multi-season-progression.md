# Multi-season planning, prizes and promotion

Implemented domain/application contract for season plans, prizes, promotion choices and next-season creation. The native starter route ends after four events; it does not expose this transition as a player action.

A season plan records sporting ambition, organizational ambition and an explicit current-car versus next-car investment split. The plan is persistent evidence; it does not itself fabricate performance.

Promotion is an offer and a player decision. Offers have a target series, deadline and minimum-cash condition. Accepting an offer does not create the next season until the explicit transition transaction is executed.

`CampaignSeasonProgressionTransaction.begin_next_season()` requires a completed source season, a valid frozen target rule pack and an eight-event next-season definition. Stable accepted entrants carry into the new season. A declared season prize is posted as a dated `prize` cash commitment and settled once; it is not a balance reset.

Transition records preserve source season, next season, target series, decision and exact rules digest. Earlier season classifications, points and calendars remain unchanged when later seasons are created or completed.

## Implementation and coverage

Authority and application owners: [season_planning.gd](../../../scripts/domain/campaign/season_planning.gd), [season_progression_transaction.gd](../../../scripts/application/campaign/season_progression_transaction.gd).

Contract fixtures: [campaign_season_progression_contracts.gd](../../../tests/support/campaign_season_progression_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
