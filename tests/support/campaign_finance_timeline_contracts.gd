class_name CampaignFinanceTimelineContracts
extends RefCounted
## The economy may describe future due dates, but not future facts or policy history.


static func run(check: Callable) -> void:
	var state = CampaignState.create(
		{
			"campaign_id": "career.finance-time",
			"organization_id": "organization.finance-time",
			"principal_id": "person.finance-time",
			"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
		}
	)
	state.command("advance_slots", {"slots": 10})
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 1000, 0)
	var added = CampaignEconomy.add_commitment(
		economy,
		{
			"id": "commitment.future-due",
			"account_id": state.organization_id,
			"source_id": "contract.future-due",
			"due_slot": 20,
			"amount_minor": -100,
			"category": "supplier"
		},
		0
	)
	check.call(added.ok, "An open commitment may have a due date after current campaign time")
	if not added.ok:
		return
	economy = added.economy
	check.call(
		not CampaignCheckpoint.build(state, {}, {}, {}, economy, {}).is_empty(),
		"A future due date remains valid inside the current checkpoint"
	)
	var future_commitment = CampaignEconomy.add_commitment(
		economy,
		{
			"id": "commitment.created-future",
			"account_id": state.organization_id,
			"source_id": "contract.created-future",
			"due_slot": 30,
			"amount_minor": -50,
			"category": "other"
		},
		20
	)
	check.call(
		(
			future_commitment.ok
			and (
				CampaignCheckpoint
				. build(state, {}, {}, {}, future_commitment.economy, {})
				. is_empty()
			)
		),
		"A commitment created after authoritative campaign time cannot enter the checkpoint"
	)
	var future_policy = CampaignEconomy.set_reserve_policy(economy, state.organization_id, 500, 20)
	check.call(
		(
			future_policy.ok
			and CampaignCheckpoint.build(state, {}, {}, {}, future_policy.economy, {}).is_empty()
		),
		"A future-dated reserve policy cannot enter the checkpoint"
	)
	var future_posting = CampaignEconomy.settle_due(economy, 20)
	check.call(
		(
			future_posting.ok
			and CampaignCheckpoint.build(state, {}, {}, {}, future_posting.economy, {}).is_empty()
		),
		"A cash posting after authoritative campaign time cannot enter the checkpoint"
	)
	check.call(
		not CampaignEconomyTimeline.validate([], 10).is_empty(),
		"Malformed economy timeline input fails closed without becoming state"
	)
