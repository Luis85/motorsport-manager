# Founder business, academy, era and dynasty expansion

Implemented optional domain/application layer above the racing organization. The native Director Desk first slice does not expose group, academy, era or succession administration.

Founder-business customer orders must reference real shared preparation/fabrication work orders. Revenue enters parent-company cash only after that work completes. Parent-to-team funding is a conserved transfer: parent cash falls by the same amount that the team receives through a settled `owner_transfer` commitment.

Academy capacity comes from owned academy facility units. Academy prospects must already exist in the persistent candidate market; enrollment cannot exceed physical academy capacity. This is a small academy foundation, not a simulated junior championship.

Era profiles contain a stable identity, display name, start year and bounded capability tags. Activating an era is an explicit between-season milestone and records legacy evidence; it does not rewrite previous seasons or merely reskin the date.

The group can appoint an actively employed successor while retaining founder and organization history. Optional legacy goals are evidence-backed milestones rather than a grind currency.

Cross-authority validation reconstructs parent cash from opening capital plus completed customer work minus team transfers, verifies customer work against shared capacity, verifies team-side transfer receipts, academy candidates and succession identities, and rejects future-dated history.

## Implementation and coverage

Authority and application owners: [group.gd](../../../scripts/domain/campaign/group.gd), [group_transaction.gd](../../../scripts/application/campaign/group_transaction.gd).

Contract fixtures: [campaign_group_contracts.gd](../../../tests/support/campaign_group_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
