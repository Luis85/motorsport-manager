class_name CampaignOperationalDepthContracts
extends RefCounted
## TM-15 procurement, material conservation, uncertainty, wear/repair and distress.
const DAY = CampaignClock.SLOTS_PER_DAY


static func run(check: Callable) -> void:
	var evidence_policy = CampaignSupplyPolicy.LEGACY.duplicate(true)
	evidence_policy.initial_confidence_bps = 4000
	evidence_policy.observation_gain_bps = 1000
	evidence_policy.max_confidence_bps = 6000
	evidence_policy.spread_floor_bps = 100
	evidence_policy.spread_scale_bps = 1000
	var policy_evidence = CampaignSupplyNetwork.register_project_evidence(
		CampaignSupplyNetwork.empty(), "project.policy", 0, 0, evidence_policy
	)
	check.call(
		(
			policy_evidence.ok
			and policy_evidence.supply.project_evidence["project.policy"].confidence_bps == 4000
		),
		"Authored supply policy sets initial engineering-evidence confidence"
	)
	if policy_evidence.ok:
		var range_before = CampaignSupplyNetwork.project_range(
			policy_evidence.supply, "project.policy", evidence_policy
		)
		var policy_observed = CampaignSupplyNetwork.observe_project(
			policy_evidence.supply, "project.policy", 1, evidence_policy
		)
		var range_after = CampaignSupplyNetwork.project_range(
			policy_observed.supply, "project.policy", evidence_policy
		)
		check.call(
			(
				policy_observed.ok
				and policy_observed.supply.project_evidence["project.policy"].confidence_bps == 5000
				and (
					int(range_after.high_bps) - int(range_after.low_bps)
					< int(range_before.high_bps) - int(range_before.low_bps)
				)
			),
			"Authored supply policy controls observation gain and uncertainty spread"
		)
	var checkpoint = _engineering_part_fixture(check)
	if checkpoint.is_empty():
		return
	var part_id: String = checkpoint.engineering.parts.keys()[0]
	var facility_start = int(checkpoint.state.clock.elapsed_slots)
	var expanded = CampaignOperationsTransaction.register_owned(
		checkpoint,
		{
			"id": "facility.fabrication",
			"display_name": "Fabrication shop",
			"family": "fabrication_shop",
			"available_from_slot": facility_start,
			"available_until_slot": facility_start + 60 * DAY,
			"capacity_units": 1
		}
	)
	check.call(
		expanded.ok,
		"Expanded fabrication facility is schedulable capability rather than a passive bonus"
	)
	if not expanded.ok:
		return
	checkpoint = expanded.checkpoint
	var supplier = CampaignSupplyTransaction.register_supplier(
		checkpoint,
		{
			"id": "supplier.alloy",
			"display_name": "Alloy Works",
			"material_id": "material.alloy",
			"unit_price_minor": 100,
			"lead_slots": DAY,
			"capacity_units": 10,
			"reliability_bps": 9000
		}
	)
	check.call(
		supplier.ok, "Supplier registers price, lead time, capacity and reliability explicitly"
	)
	if not supplier.ok:
		return
	checkpoint = supplier.checkpoint
	var ordered = CampaignSupplyTransaction.order_material(
		checkpoint, {"id": "order.alloy.1", "supplier_id": "supplier.alloy", "quantity": 5}
	)
	check.call(
		(
			ordered.ok
			and (
				ordered.checkpoint.economy.commitments.size()
				> checkpoint.economy.commitments.size()
			)
		),
		"Material order creates one explicit supplier cash commitment"
	)
	if not ordered.ok:
		return
	checkpoint = ordered.checkpoint
	checkpoint = _advance(checkpoint, DAY)
	if checkpoint.is_empty():
		check.call(false, "Campaign advances to supplier delivery")
		return
	var received = CampaignSupplyTransaction.receive_order(checkpoint, "order.alloy.1")
	check.call(
		(
			received.ok
			and received.checkpoint.management.supply.materials["material.alloy"].quantity == 5
		),
		"Received order settles cash and creates exactly five physical material units"
	)
	if not received.ok:
		return
	checkpoint = received.checkpoint
	var consumed = CampaignSupplyTransaction.consume_material(
		checkpoint, "material.alloy", 2, "project.first-package"
	)
	check.call(
		(
			consumed.ok
			and consumed.checkpoint.management.supply.materials["material.alloy"].quantity == 3
		),
		"Material consumption conserves stock rather than creating progress from a design"
	)
	if not consumed.ok:
		return
	checkpoint = consumed.checkpoint
	var evidence = CampaignSupplyTransaction.register_project_evidence(
		checkpoint, "project.first-package", 500
	)
	check.call(evidence.ok, "Engineering uncertainty receives one persistent latent outcome")
	if not evidence.ok:
		return
	checkpoint = evidence.checkpoint
	var before = RaceStateValue.fingerprint(checkpoint)
	var range_a = CampaignSupplyNetwork.project_range(
		checkpoint.management.supply, "project.first-package"
	)
	var range_b = CampaignSupplyNetwork.project_range(
		checkpoint.management.supply, "project.first-package"
	)
	check.call(
		range_a == range_b and RaceStateValue.fingerprint(checkpoint) == before,
		"Inspecting engineering uncertainty cannot reroll or mutate its latent outcome"
	)
	var observed = CampaignSupplyTransaction.observe_project(checkpoint, "project.first-package")
	check.call(observed.ok, "A new observation updates evidence explicitly")
	if not observed.ok:
		return
	checkpoint = observed.checkpoint
	var range_c = CampaignSupplyNetwork.project_range(
		checkpoint.management.supply, "project.first-package"
	)
	check.call(
		int(range_c.high_bps) - int(range_c.low_bps) < int(range_a.high_bps) - int(range_a.low_bps),
		"Testing narrows the visible range instead of awarding a universal speed bonus"
	)
	physical_part_and_distress(checkpoint, part_id, check)


static func _engineering_part_fixture(check: Callable) -> Dictionary:
	var checkpoint = CampaignEngineeringContracts._fixture()
	if checkpoint.is_empty():
		check.call(false, "Engineering fixture exists")
		return {}
	var created = CampaignEngineeringTransaction.create_project(
		checkpoint,
		{
			"id": "project.first-package",
			"title": "Serviceable package",
			"domain": "mechanical_grip",
			"target_event_id": "event.future",
			"target_car_id": "car.player",
			"profile_delta": {"top": 50, "lat": 100, "accel": 50, "brake": 50},
			"material_cost_minor": 5000
		}
	)
	if not created.ok:
		return {}
	checkpoint = created.checkpoint
	for stage in [
		"investigation",
		"concept",
		"detailed_design",
		"prototype",
		"validation",
		"production",
		"integration"
	]:
		var family = CampaignEngineeringProject.expected_family(stage)
		var start = int(checkpoint.state.clock.elapsed_slots)
		var scheduled = CampaignOperationsTransaction.schedule_internal(
			checkpoint,
			{
				"id": "work.depth." + stage,
				"family": family,
				"resource_id": "facility." + family,
				"start_slot": start,
				"end_slot": start + DAY,
				"units": 1,
				"assignment_ids": ["assignment.engineering"]
			}
		)
		if not scheduled.ok:
			return {}
		var bound = CampaignEngineeringTransaction.bind_stage(
			scheduled.checkpoint, "project.first-package", "work.depth." + stage
		)
		if not bound.ok:
			return {}
		checkpoint = bound.checkpoint
		if stage == "production":
			var paid = CampaignFinanceTransaction.settle_due(checkpoint, start)
			if not paid.ok:
				return {}
			checkpoint = paid.checkpoint
		checkpoint = _advance(checkpoint, DAY)
		if checkpoint.is_empty():
			return {}
		var completed = CampaignEngineeringTransaction.complete_stage(
			checkpoint, "project.first-package"
		)
		if not completed.ok:
			return {}
		checkpoint = completed.checkpoint
	check.call(
		checkpoint.engineering.parts.size() == 1, "TM-15 fixture produces one real traceable part"
	)
	return checkpoint


static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var r = CampaignCheckpoint.restore(checkpoint)
	if not r.ok or not r.state.command("advance_slots", {"slots": slots}):
		return {}
	return CampaignCheckpoint.build(
		r.state,
		r.settlements,
		r.active_manifest,
		r.competition,
		r.economy,
		r.inventory,
		r.personnel,
		r.operations,
		r.engineering,
		r.management
	)


static func physical_part_and_distress(
	checkpoint: Dictionary, part_id: String, check: Callable
) -> void:
	var tracked = CampaignSupplyTransaction.register_part(checkpoint, part_id)
	check.call(tracked.ok, "Manufactured physical part can enter service-life tracking")
	if not tracked.ok:
		return
	checkpoint = tracked.checkpoint
	var worn = CampaignSupplyTransaction.wear_part(checkpoint, part_id, 35)
	check.call(
		worn.ok and worn.checkpoint.management.supply.part_service[part_id].condition == 65,
		"Part wear preserves unique identity and condition history"
	)
	if not worn.ok:
		return
	checkpoint = worn.checkpoint
	var start = int(checkpoint.state.clock.elapsed_slots)
	var repair_work = CampaignOperationsTransaction.schedule_internal(
		checkpoint,
		{
			"id": "work.part.repair",
			"family": "fabrication_shop",
			"resource_id": "facility.fabrication",
			"start_slot": start,
			"end_slot": start + DAY,
			"units": 1,
			"assignment_ids": ["assignment.engineering"]
		}
	)
	check.call(repair_work.ok, "Part repair reserves explicit people and fabrication capacity")
	if not repair_work.ok:
		return
	checkpoint = _advance(repair_work.checkpoint, DAY)
	if checkpoint.is_empty():
		return
	var repaired = CampaignSupplyTransaction.repair_part(checkpoint, part_id, "work.part.repair")
	check.call(
		(
			repaired.ok
			and repaired.checkpoint.management.supply.part_service[part_id].condition == 100
		),
		"Completed repair restores recorded service condition without replacing the part identity"
	)
	if not repaired.ok:
		return
	checkpoint = repaired.checkpoint
	var reserve = CampaignFinanceTransaction.set_reserve_policy(
		checkpoint, checkpoint.state.organization_id, 190000
	)
	if not reserve.ok:
		return
	checkpoint = reserve.checkpoint
	var pressure = CampaignFinanceTransaction.add_commitment(
		checkpoint,
		{
			"id": "optional.expansion",
			"account_id": checkpoint.state.organization_id,
			"source_id": "plan.expansion",
			"due_slot": checkpoint.state.clock.elapsed_slots + DAY,
			"amount_minor": -150000,
			"category": "other"
		}
	)
	if not pressure.ok:
		return
	checkpoint = pressure.checkpoint
	var evaluated = CampaignDistressTransaction.evaluate(checkpoint)
	check.call(
		(
			evaluated.ok
			and (
				evaluated.checkpoint.management.distress.stage
				in ["reserve_pressure", "funding_gap"]
			)
		),
		"Forecast pressure becomes an explicit distress stage before a missed obligation"
	)
	if not evaluated.ok:
		return
	checkpoint = evaluated.checkpoint
	var cash_before = int(checkpoint.economy.accounts[checkpoint.state.organization_id].cash_minor)
	var bridge = CampaignDistressTransaction.bridge_financing(checkpoint, 50000)
	check.call(bridge.ok, "Bridge financing is an explicit recovery action")
	if not bridge.ok:
		return
	checkpoint = bridge.checkpoint
	var position = CampaignFinancialPositionQuery.snapshot(checkpoint)
	check.call(
		(
			position.ok
			and (
				int(checkpoint.economy.accounts[checkpoint.state.organization_id].cash_minor)
				== cash_before + 50000
			)
		),
		"Bridge receipt changes cash exactly once"
	)
	check.call(
		position.debt_minor >= 55000 and position.liabilities_minor >= position.debt_minor,
		"Financial position keeps future repayment as a liability rather than income"
	)
	check.call(
		CampaignCheckpoint.validate(checkpoint).is_empty(),
		"TM-15 operational depth remains one valid auditable checkpoint"
	)
