# Multi-season planning, prizes and promotion

TM-14 extends the campaign beyond one championship without resetting organization history.

A season plan records sporting ambition, organizational ambition and an explicit current-car versus next-car investment split. The plan is persistent evidence; it does not itself fabricate performance.

Promotion is an offer and a player decision. Offers have a target series, deadline and minimum-cash condition. Accepting an offer does not create the next season until the explicit transition transaction is executed.

`CampaignSeasonProgressionTransaction.begin_next_season()` requires a completed source season, a valid frozen target rule pack and an eight-event next-season definition. Stable accepted entrants carry into the new season. A declared season prize is posted as a dated `prize` cash commitment and settled once; it is not a balance reset.

Transition records preserve source season, next season, target series, decision and exact rules digest. Earlier season classifications, points and calendars remain unchanged when later seasons are created or completed.