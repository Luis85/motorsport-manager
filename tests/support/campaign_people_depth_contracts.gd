class_name CampaignPeopleDepthContracts
extends RefCounted
## TM-13 candidate persistence, bounded negotiation, development and promise contracts.
const DAY = CampaignClock.SLOTS_PER_DAY
const WEEK = 7 * DAY

static func run(check: Callable) -> void:
	var policy_people = CampaignPeopleDevelopment.empty()
	var policy_candidate = CampaignPeopleDevelopment.register_candidate(policy_people, {
		"id": "person.policy", "display_name": "Policy Candidate",
		"eligible_roles": ["technical_lead"],
		"attributes": {"technical": 60, "operations": 60, "commercial": 60, "feedback": 60, "development": 60},
		"confidence": 70, "salary_expectation_minor": 10000,
		"available_slot": 0, "preferences": ["stable_role"]}, 0)
	if policy_candidate.ok:
		var policy_approach = CampaignPeopleDevelopment.approach(policy_candidate.people, "person.policy", 0)
		var custom_policy = CampaignPeoplePolicy.LEGACY.duplicate(true)
		custom_policy.counter_offer_ratio_bps = 9500
		var policy_offer = CampaignPeopleDevelopment.evaluate_offer(
			policy_approach.people, "person.policy", "technical_lead", 9000, 0, 0, custom_policy)
		check.call(policy_offer.ok and policy_offer.status == "rejected",
			"Authored people policy changes bounded negotiation without changing the negotiation algorithm")
	else:
		check.call(false, "People policy fixture registers a candidate")
	var state = CampaignState.create({"campaign_id": "career.people-depth",
		"organization_id": "organization.people-depth", "principal_id": "person.principal",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}})
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {},
		CampaignEconomy.create(state.campaign_id, state.organization_id, 100000, 0), {})
	var attributes = {"technical": 65, "operations": 58, "commercial": 42,
		"feedback": 70, "development": 75}
	var registered = CampaignPeopleTransaction.register_candidate(checkpoint, {
		"id": "person.candidate", "display_name": "Alex Hart",
		"eligible_roles": ["technical_lead"], "attributes": attributes,
		"confidence": 70, "salary_expectation_minor": 10000,
		"available_slot": 0, "preferences": ["development_support", "stable_role"]})
	check.call(registered.ok, "Persistent candidate can enter the bounded market")
	if not registered.ok: return
	checkpoint = registered.checkpoint
	var approached = CampaignPeopleTransaction.approach(checkpoint, "person.candidate")
	check.call(approached.ok, "Candidate can be approached explicitly")
	if not approached.ok: return
	checkpoint = approached.checkpoint
	var low = CampaignPeopleTransaction.offer_and_hire(checkpoint, "person.candidate",
		"technical_lead", {"id": "contract.candidate", "start_slot": 0,
			"end_slot": 4 * WEEK, "pay_interval_slots": WEEK, "pay_minor": 9000,
			"capacity_bps": 10000, "renewal_window_slots": WEEK}, "assignment.candidate")
	check.call(low.ok and low.status == "countered" and not low.get("accepted", false),
		"Below-expectation offer returns actionable feedback without signing employment")
	check.call(low.checkpoint.management.people.candidates["person.candidate"].attributes == attributes,
		"Negotiation never rerolls candidate attributes")
	checkpoint = low.checkpoint
	var hired = CampaignPeopleTransaction.offer_and_hire(checkpoint, "person.candidate",
		"technical_lead", {"id": "contract.candidate", "start_slot": 0,
			"end_slot": 4 * WEEK, "pay_interval_slots": WEEK, "pay_minor": 10000,
			"capacity_bps": 10000, "renewal_window_slots": WEEK}, "assignment.candidate")
	check.call(hired.ok and hired.status == "hired",
		"Accepted offer atomically creates person, contract, role and payroll")
	if not hired.ok: return
	checkpoint = hired.checkpoint
	check.call(checkpoint.personnel.people.has("person.candidate") 		and checkpoint.personnel.contracts.has("contract.candidate") 		and checkpoint.personnel.assignments.has("assignment.candidate"),
		"Hired candidate is represented by the existing personnel authority")
	check.call(checkpoint.economy.commitments.size() == 4,
		"Four-week employment creates exactly its four dated payroll commitments")
	var reserved = CampaignPersonnelTransaction.reserve_availability(checkpoint, {
		"id": "training.candidate", "person_id": "person.candidate",
		"assignment_id": "assignment.candidate", "start_slot": 0, "end_slot": 3 * DAY,
		"kind": "training", "location_id": "training.external"})
	check.call(reserved.ok, "Development fixture reserves explicit training time")
	if not reserved.ok: return
	checkpoint = reserved.checkpoint
	var plan = CampaignPeopleTransaction.set_development_plan(
		checkpoint, "person.candidate", "development", WEEK)
	check.call(plan.ok, "Person can have one explicit development focus and review date")
	if not plan.ok: return
	checkpoint = plan.checkpoint
	var promise = CampaignPeopleTransaction.create_promise(checkpoint, {
		"id": "promise.development", "person_id": "person.candidate",
		"type": "development", "deadline_slot": WEEK,
		"evidence_id": "training.candidate"})
	check.call(promise.ok, "Promise records an exact deadline and evidence identity")
	if not promise.ok: return
	checkpoint = promise.checkpoint
	checkpoint = _advance(checkpoint, WEEK)
	check.call(not checkpoint.is_empty(), "Campaign advances to the scheduled people review")
	if checkpoint.is_empty(): return
	var review = CampaignPeopleTransaction.review_due(checkpoint)
	check.call(review.ok and review.reviewed == 1, "Development review occurs at its declared boundary")
	if not review.ok: return
	checkpoint = review.checkpoint
	var profile: Dictionary = checkpoint.management.people.profiles["person.candidate"]
	check.call(profile.attributes.development == 77 and profile.morale == 63,
		"Relevant work improves only the chosen attribute and updates bounded morale")
	var fulfilled = CampaignPeopleTransaction.resolve_promise(
		checkpoint, "promise.development", true)
	check.call(fulfilled.ok and fulfilled.checkpoint.management.people.profiles[
		"person.candidate"].trust == 63,
		"Fulfilling the exact promise improves long-lived trust once")
	if not fulfilled.ok: return
	checkpoint = fulfilled.checkpoint
	var duplicate = CampaignPeopleTransaction.resolve_promise(
		checkpoint, "promise.development", true)
	check.call(not duplicate.ok, "Resolved promises cannot be farmed for repeated relationship gains")
	var immediate = CampaignPeopleTransaction.review_due(checkpoint)
	check.call(immediate.ok and immediate.reviewed == 0,
		"Development is review-driven rather than a repetitive daily training click")
	check.call(CampaignCheckpoint.validate(checkpoint).is_empty(),
		"TM-13 people depth remains inside one valid campaign checkpoint")

static func _advance(checkpoint: Dictionary, slots: int) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.state.command("advance_slots", {"slots": slots}): return {}
	var due = CampaignEconomy.settle_due(restored.economy, restored.state.clock.elapsed_slots)
	if not due.ok: return {}
	return CampaignCheckpoint.build(restored.state, restored.settlements, restored.active_manifest,
		restored.competition, due.economy, restored.inventory, restored.personnel,
		restored.operations, restored.engineering, restored.management)
