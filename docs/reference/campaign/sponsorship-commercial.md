# Campaign sponsorship and commercial obligations

Implemented domain/application contract for dated sponsor payments, evidenced bonuses and appearance obligations. Dedicated commercial administration remains future presentation.

A signed agreement records guaranteed payments, optional result bonuses, and named appearance obligations. Guaranteed payments create positive `sponsor` commitments immediately but do not change cash until their contractual due date. Conditional bonuses create no commitment until a settled competition event proves the stated finishing condition.

Appearance obligations reserve the same personnel availability used by factory work, training and event duty. A person cannot be promised to a sponsor and simultaneously scheduled elsewhere.

`CampaignCommercialQuery` reports guaranteed open value and already-earned bonus value separately. Unsigned offers and unearned bonus terms never appear as spendable cash.

All sign/claim operations publish one campaign checkpoint atomically; rejected terms, capacity conflicts or missing sporting evidence return the caller checkpoint unchanged.

## Implementation and coverage

Authority and application owners: [commercial.gd](../../../scripts/domain/campaign/commercial.gd), [commercial_transaction.gd](../../../scripts/application/campaign/commercial_transaction.gd), [commercial_query.gd](../../../scripts/application/campaign/commercial_query.gd).

Contract fixtures: [campaign_commercial_contracts.gd](../../../tests/support/campaign_commercial_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
