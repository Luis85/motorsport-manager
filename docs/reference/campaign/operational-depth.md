# Procurement, uncertainty, part life and financial pressure

Implemented domain/application contracts for procurement, engineering evidence, part life and financial pressure, sharing the existing cash, people and facility authorities. Dedicated specialist screens remain future presentation.

## Procurement and materials

Suppliers expose material identity, price, lead time, finite order capacity and reliability. A procurement order creates one ordinary `supplier` cash commitment. Delivery can occur only after the due boundary and settled payment. Material stock is reconstructed from received orders minus explicit consumption, so designs/research cannot create physical material.

## Engineering uncertainty

Engineering projects can hold one persistent latent outcome and a visible confidence range. Reading the range is pure and cannot reroll it. Explicit observations narrow uncertainty. This evidence remains separate from the validated design and manufactured part.

## Part life and repair

Manufactured parts can enter service-life tracking. Wear updates the same authoritative `CampaignPartInstance.condition`; repairs require completed preparation/fabrication work and restore that same instance. The service ledger and engineering part condition are cross-validated.

## Expanded facilities

The capacity model now supports preparation workshop, design office, test/validation, fabrication shop, race operations, staff development, commercial operations and academy families. These remain schedulable capacity; owning a building never grants a passive race-speed bonus.

## Financial pressure

The finance forecast can produce `normal`, `reserve_pressure`, `funding_gap` or `missed_obligation` distress state. Recovery is explicit. Bridge financing creates a current cash receipt and a later repayment liability; it cannot mint free money.

`CampaignFinancialPositionQuery` provides a game-defined operating view of cash, operating result, receivables, payables/debt and physical operational counts. It is a gameplay statement, not a claim of real-world accounting compliance.

## Implementation and coverage

Authority and application owners: [supply_transaction.gd](../../../scripts/application/campaign/supply_transaction.gd), [distress_transaction.gd](../../../scripts/application/campaign/distress_transaction.gd), [financial_position_query.gd](../../../scripts/application/campaign/financial_position_query.gd).

Contract fixtures: [campaign_operational_depth_contracts.gd](../../../tests/support/campaign_operational_depth_contracts.gd).

Campaign fixtures run through registered `weekend_launch_tests`, via
`CampaignStateContracts`. The [verification guide](../../how-to/verification.md) defines
complete-suite execution; this reference describes coverage, not a fresh pass.
