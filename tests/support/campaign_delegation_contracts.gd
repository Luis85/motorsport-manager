class_name CampaignDelegationContracts
extends RefCounted
## TM-10 mandate limits, auditability and zero-founder-energy execution contracts.
const DAY = CampaignClock.SLOTS_PER_DAY
const ACCOUNT = "organization.delegation"


static func run(check: Callable) -> void:
	var checkpoint = _fixture()
	check.call(not checkpoint.is_empty(), "TM-10 fixture creates a qualified operations owner")
	if checkpoint.is_empty():
		return
	var created = CampaignDelegationTransaction.create_mandate(
		checkpoint,
		{
			"id": "mandate.finance",
			"owner_person_id": "person.operations",
			"scope": "finance",
			"review_slot": DAY,
			"expiry_slot": 20 * DAY,
			"spending_ceiling_minor": 5000,
			"future_obligation_ceiling_minor": 10000,
			"minimum_cash_minor": 20000,
			"allowed_categories": ["supplier", "facility"],
			"protected_ids": ["supplier.protected"],
			"risk_posture": "balanced"
		}
	)
	check.call(created.ok, "Qualified staff can receive one persistent bounded mandate")
	if not created.ok:
		return
	checkpoint = created.checkpoint
	var restored = CampaignCheckpoint.restore(checkpoint)
	var state: CampaignState = restored.state
	check.call(
		state.command(
			"intervention", {"id": "intervention.exhaust", "energy": 1, "duration_slots": 1}
		),
		"Fixture can exhaust founder intervention energy"
	)
	checkpoint = CampaignCheckpoint.build(
		state,
		restored.settlements,
		restored.active_manifest,
		restored.competition,
		restored.economy,
		restored.inventory,
		restored.personnel,
		restored.operations,
		restored.engineering,
		restored.management
	)
	var state_before = RaceStateValue.fingerprint(checkpoint.state)
	var first = CampaignDelegatedExecutor.add_commitment(
		checkpoint,
		"mandate.finance",
		{
			"id": "supplier.autonomous.1",
			"account_id": ACCOUNT,
			"source_id": "supplier.standard",
			"due_slot": 2 * DAY,
			"amount_minor": -4000,
			"category": "supplier"
		},
		"Replenish bounded critical stock."
	)
	check.call(
		first.ok and first.checkpoint.state.energy_available == 0,
		"Delegated staff execute authorized routine work at zero founder energy"
	)
	if not first.ok:
		return
	checkpoint = first.checkpoint
	check.call(
		RaceStateValue.fingerprint(checkpoint.state) == state_before,
		"Delegated execution does not issue founder commands, advance time or consume energy"
	)
	var decision = checkpoint.management.delegation.decisions[0]
	check.call(
		(
			decision.mandate_id == "mandate.finance"
			and (
				checkpoint.economy.commitments[decision.subject_id].terms_digest
				== decision.source_digest
			)
		),
		"Every delegated action records its mandate and exact financial evidence"
	)
	var before_reject = RaceStateValue.fingerprint(checkpoint)
	var too_large = CampaignDelegatedExecutor.add_commitment(
		checkpoint,
		"mandate.finance",
		{
			"id": "supplier.autonomous.large",
			"account_id": ACCOUNT,
			"source_id": "supplier.standard",
			"due_slot": 2 * DAY,
			"amount_minor": -6000,
			"category": "supplier"
		},
		"Attempt oversized order."
	)
	check.call(
		(
			not too_large.ok
			and too_large.status == "escalated"
			and RaceStateValue.fingerprint(too_large.checkpoint) == before_reject
		),
		"Per-decision spending ceiling escalates rather than silently overspending"
	)
	var protected = CampaignDelegatedExecutor.add_commitment(
		checkpoint,
		"mandate.finance",
		{
			"id": "supplier.autonomous.protected",
			"account_id": ACCOUNT,
			"source_id": "supplier.protected",
			"due_slot": 2 * DAY,
			"amount_minor": -1000,
			"category": "supplier"
		},
		"Attempt protected supplier change."
	)
	check.call(
		not protected.ok and RaceStateValue.fingerprint(protected.checkpoint) == before_reject,
		"Protected resources remain outside delegated authority"
	)
	var second = CampaignDelegatedExecutor.add_commitment(
		checkpoint,
		"mandate.finance",
		{
			"id": "supplier.autonomous.2",
			"account_id": ACCOUNT,
			"source_id": "supplier.standard",
			"due_slot": 3 * DAY,
			"amount_minor": -4000,
			"category": "supplier"
		},
		"Reserve second bounded order."
	)
	check.call(
		second.ok, "Mandate may create multiple commitments inside its future-obligation ceiling"
	)
	if not second.ok:
		return
	checkpoint = second.checkpoint
	var future = CampaignDelegatedExecutor.add_commitment(
		checkpoint,
		"mandate.finance",
		{
			"id": "supplier.autonomous.3",
			"account_id": ACCOUNT,
			"source_id": "supplier.standard",
			"due_slot": 4 * DAY,
			"amount_minor": -3000,
			"category": "supplier"
		},
		"Attempt beyond future ceiling."
	)
	check.call(
		not future.ok and future.status == "escalated",
		"Future-obligation ceiling prevents cheap-upfront autonomous overcommitment"
	)
	var revoked = CampaignDelegationTransaction.revoke_mandate(checkpoint, "mandate.finance")
	check.call(revoked.ok, "Player can explicitly take authority back from a mandate")
	if not revoked.ok:
		return
	var stopped = CampaignDelegatedExecutor.add_commitment(
		revoked.checkpoint,
		"mandate.finance",
		{
			"id": "supplier.after.revoke",
			"account_id": ACCOUNT,
			"source_id": "supplier.standard",
			"due_slot": 5 * DAY,
			"amount_minor": -500,
			"category": "supplier"
		},
		"Should not execute."
	)
	check.call(not stopped.ok, "Revoked mandate cannot create new autonomous commitments")


static func _fixture() -> Dictionary:
	var state = CampaignState.create(
		{
			"campaign_id": "career.delegation",
			"organization_id": ACCOUNT,
			"principal_id": "person.principal",
			"energy_capacity": 1,
			"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
		}
	)
	var economy = CampaignEconomy.create(state.campaign_id, ACCOUNT, 50000, 0)
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	var person = CampaignPersonnelTransaction.register_person(
		checkpoint,
		{
			"id": "person.operations",
			"display_name": "Operations Lead",
			"eligible_roles": ["operations_lead"]
		}
	)
	if not person.ok:
		return {}
	checkpoint = person.checkpoint
	var contract = CampaignPersonnelTransaction.sign_contract(
		checkpoint,
		{
			"id": "contract.operations",
			"person_id": "person.operations",
			"account_id": ACCOUNT,
			"start_slot": 0,
			"end_slot": 30 * DAY,
			"pay_interval_slots": 10 * DAY,
			"pay_minor": 1000,
			"capacity_bps": 10000,
			"renewal_window_slots": 2 * DAY
		}
	)
	if not contract.ok:
		return {}
	checkpoint = contract.checkpoint
	var assignment = CampaignPersonnelTransaction.assign_role(
		checkpoint,
		{
			"id": "assignment.operations",
			"person_id": "person.operations",
			"contract_id": "contract.operations",
			"role_id": "operations_lead",
			"start_slot": 0,
			"end_slot": 30 * DAY,
			"allocation_bps": 10000
		}
	)
	return assignment.checkpoint if assignment.ok else {}
