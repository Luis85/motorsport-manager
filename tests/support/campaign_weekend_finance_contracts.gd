class_name CampaignWeekendFinanceContracts
extends RefCounted
## Dated obligations inside the departure/return interval publish with the exact
## weekend consequence checkpoint rather than as a separate partial write.

static func run(check: Callable) -> void:
	var state = CampaignWeekendTransactionContracts._state_at_departure()
	var manifest = CampaignWeekendTransactionContracts._manifest()
	var receipt = CampaignWeekendTransactionContracts._receipt(manifest)
	var policy = CampaignWeekendTransactionContracts._policy(manifest)
	var competition = CampaignWeekendTransactionContracts._competition(manifest, policy)
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 10000, 0)
	var added = CampaignEconomy.add_commitment(economy, {
		"id": "commitment.weekend.operations",
		"account_id": state.organization_id,
		"source_id": "contract.weekend.operations",
		"due_slot": 120,
		"amount_minor": -300,
		"category": "fixed_operations"
	}, 100)
	check.call(added.ok, "A binding obligation can fall inside the frozen weekend interval")
	if not added.ok:
		return
	economy = added.economy
	var checkpoint = CampaignCheckpoint.build(state, {}, manifest, competition, economy, {})
	check.call(not checkpoint.is_empty(), "Weekend departure persists its pre-existing dated obligations")
	var before = RaceStateValue.fingerprint(checkpoint)
	var staged = CampaignWeekendTransaction.stage_receipt(checkpoint, manifest, receipt, policy)
	check.call(staged.ok and staged.status == "settled" and staged.settled_commitments == 1,
		"Weekend return settles due obligations with the same atomic consequence candidate")
	check.call(RaceStateValue.fingerprint(checkpoint) == before,
		"Weekend financial progression never mutates the departure checkpoint")
	if not staged.ok:
		return
	var restored = CampaignCheckpoint.restore(staged.checkpoint)
	var account: Dictionary = restored.economy.accounts[state.organization_id]
	var commitment: Dictionary = restored.economy.commitments["commitment.weekend.operations"]
	check.call(account.cash_minor == 9900 and account.postings.size() == 4,
		"Event cash and the due operating payment reconcile to one integer balance")
	check.call(commitment.status == "settled" and commitment.resolution_slot == 120,
		"The weekend obligation settles at its contractual due slot, not at return presentation time")
	var commitment_posting: Dictionary = account.postings[commitment.settlement_posting_id]
	check.call(commitment_posting.slot == 120 and commitment_posting.source_kind == "commitment" \
		and commitment_posting.source_id == commitment.id,
		"The due posting retains commitment provenance independently of the race event")
	var event_postings = restored.economy.events[manifest.campaign_event_id].posting_ids
	var event_postings_dated = event_postings.size() == 3
	for posting_id in event_postings:
		var posting: Dictionary = account.postings[posting_id]
		event_postings_dated = event_postings_dated \
			and posting.slot == manifest.return_slot and posting.source_kind == "event"
	check.call(event_postings_dated,
		"Weekend entry, participation and position postings remain dated at return")
	var duplicate = CampaignWeekendTransaction.stage_receipt(staged.checkpoint, manifest, receipt, policy)
	check.call(duplicate.ok and duplicate.status == "already_settled" \
		and RaceStateValue.fingerprint(duplicate.checkpoint) == RaceStateValue.fingerprint(staged.checkpoint),
		"Reapplying the settled weekend cannot pay the obligation or event rewards twice")
