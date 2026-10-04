# Rival campaign organizations

Implemented persistent rival-organization contract used by the first campaign slice and its Director Desk paddock summary.

## Authority

Each rival is tied exactly to one accepted season entry: entrant, team, people and car identities must match. Checkpoint validation rejects remapping even when outer digests are recomputed.

A rival record owns finite cash, a minimum reserve, outstanding project commitment, bounded capability, an archetype and dated review cadence. The first slice deliberately does not create a second staff market, factory simulator or hidden race-performance channel.

## Planning cadence

Rivals review at explicit campaign boundaries. A review may select reliability, balanced development, driver development or cash preservation. The decision sees only the rival's own organization plus public championship standings.

The review journal records that information scope. It never receives player drafts, future weather, race randomness or private engineering state.

Prior project commitments consume real rival cash before capability can change. New spending cannot breach the rival's declared liquidity reserve. Capability remains bounded and does not rewrite an already launched weekend.

## Archetypes

The first bounded archetypes are constructor, customer, talent, innovator, reliability, commercial and independent. They bias project selection but do not prescribe finishing order or exempt a team from financial constraints.

## Player presentation

The Director Desk shows a compact rival-paddock summary: organization identity, archetype, current project and committed cash. Rival administration is not a player chore; its purpose is to make the championship context traceable.

## Verification boundary

Registered contracts cover accepted-roster authority, finite reserve-constrained spending, dated reviews, real cash consumption before capability growth, public-information provenance and tamper rejection.

Contract markets, staff poaching, richer project portfolios and multi-season adaptation remain unimplemented rival depth.

## Implementation and coverage

Authority and application owners: [rivals.gd](../../../scripts/domain/campaign/rivals.gd), [rival_transaction.gd](../../../scripts/application/campaign/rival_transaction.gd), [rival_query.gd](../../../scripts/application/campaign/rival_query.gd).

Contract fixtures: [campaign_rival_contracts.gd](../../../tests/support/campaign_rival_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
