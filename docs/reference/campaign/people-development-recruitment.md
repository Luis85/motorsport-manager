# Recruitment, development, morale and promises

Implemented domain/application contract for persistent recruitment and people development above the personnel/payroll authority. Dedicated recruitment and people screens remain future presentation.

Candidates are persistent records with stable identity, eligible roles, five bounded attributes, confidence, salary expectation, availability and preferences. Approaching and negotiating never rerolls candidate attributes. Negotiation is deliberately bounded to three offers; accepted hiring atomically creates the ordinary campaign person, employment contract, role assignment and payroll commitments.

Employed people may have a persistent profile with morale and trust plus one role-oriented development focus and review date. Development advances at explicit review boundaries from recorded workload; it does not require repetitive training clicks. Training/other reservations remain the existing availability authority.

Promises are explicit records with person, type, deadline and named evidence. Fulfilment or failure changes trust once. A resolved promise cannot be repeatedly harvested for relationship value.

Candidate-market records are not a second employment registry. Checkpoint validation requires signed candidates and all profiles/plans/promises/reviews to agree with the existing personnel authority and campaign time.

## Implementation and coverage

Authority and application owners: [people_development.gd](../../../scripts/domain/campaign/people_development.gd), [people_transaction.gd](../../../scripts/application/campaign/people_transaction.gd).

Contract fixtures: [campaign_people_depth_contracts.gd](../../../tests/support/campaign_people_depth_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
