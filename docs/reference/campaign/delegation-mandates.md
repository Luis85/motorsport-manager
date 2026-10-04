# Campaign mandates and bounded delegation

Implemented domain/application contract for persistent mandates and bounded delegated finance. The native Director Desk can report a mandate due for review; specialist mandate administration remains future presentation.

A mandate names its owner, scope, review/expiry dates, per-decision spending ceiling, total future-obligation ceiling, minimum liquidity floor, permitted cash categories, protected resources and risk posture. Taking authority back is an explicit revocation; signed obligations remain in the normal ledger.

The first executable seam is delegated financial commitment creation. It uses the same `CampaignEconomy` and forecast path as manual finance. The guard rejects wrong scopes, unavailable owners, protected resources, disallowed categories, spending-limit breaches, future-obligation breaches and reserve breaches. Rejection returns the source checkpoint unchanged.

Every successful autonomous commitment is linked to an immutable decision record containing the mandate, subject, slot, amount, explanation and the exact commitment terms digest.

Delegated execution never calls `CampaignState.command`; it therefore consumes no founder energy and does not advance campaign time.

## Implementation and coverage

Authority and application owners: [delegation.gd](../../../scripts/domain/campaign/delegation.gd), [delegation_guard.gd](../../../scripts/domain/campaign/delegation_guard.gd), [delegated_executor.gd](../../../scripts/application/campaign/delegated_executor.gd).

Contract fixtures: [campaign_delegation_contracts.gd](../../../tests/support/campaign_delegation_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
