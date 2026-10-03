class_name CampaignPeopleTransaction
extends RefCounted
## Atomic TM-13 people-market, hiring, development and promise boundary.


static func register_candidate(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.register_candidate(
		restored.management.people, input, restored.state.clock.elapsed_slots
	)
	return _publish_people(restored, changed, checkpoint)


static func approach(checkpoint: Dictionary, candidate_id: String) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.approach(
		restored.management.people, candidate_id, restored.state.clock.elapsed_slots
	)
	return _publish_people(restored, changed, checkpoint)


static func offer_and_hire(
	checkpoint: Dictionary,
	candidate_id: String,
	role_id: String,
	contract_terms: Dictionary,
	assignment_id: String
) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var slot = restored.state.clock.elapsed_slots
	var offer = CampaignPeopleDevelopment.evaluate_offer(
		restored.management.people,
		candidate_id,
		role_id,
		int(contract_terms.get("pay_minor", 0)),
		int(contract_terms.get("start_slot", -1)),
		slot,
		_people_policy(restored)
	)
	if not offer.ok:
		return _reject(offer.error, checkpoint)
	if not offer.accepted:
		var management = CampaignManagement.with_people(restored.management, offer.people)
		if management.is_empty():
			return _reject("Negotiation could not update candidate state.", checkpoint)
		return _publish(
			restored,
			restored.personnel,
			restored.economy,
			management,
			offer.status,
			checkpoint,
			{"reason": offer.reason}
		)
	var candidate: Dictionary = offer.candidate
	var personnel = restored.personnel.duplicate(true)
	var person = CampaignPersonnel.register_person(
		personnel,
		{
			"id": candidate.id,
			"display_name": candidate.display_name,
			"eligible_roles": candidate.eligible_roles
		},
		slot
	)
	if not person.ok:
		return _reject(person.error, checkpoint)
	personnel = person.personnel
	var terms = contract_terms.duplicate(true)
	terms["person_id"] = candidate.id
	terms["account_id"] = restored.state.organization_id
	var signed = CampaignPersonnel.sign_contract(personnel, terms, slot)
	if not signed.ok:
		return _reject(signed.error, checkpoint)
	personnel = signed.personnel
	var assignment = CampaignPersonnel.assign_role(
		personnel,
		{
			"id": assignment_id,
			"person_id": candidate.id,
			"contract_id": signed.contract.id,
			"role_id": role_id,
			"start_slot": signed.contract.start_slot,
			"end_slot": signed.contract.end_slot,
			"allocation_bps": signed.contract.capacity_bps
		},
		slot
	)
	if not assignment.ok:
		return _reject(assignment.error, checkpoint)
	personnel = assignment.personnel
	var economy = restored.economy.duplicate(true)
	for payroll_input in signed.payroll_inputs:
		var added = CampaignEconomy.add_commitment(economy, payroll_input, slot)
		if not added.ok:
			return _reject(added.error, checkpoint)
		economy = added.economy
	var people = offer.people
	var tuning = _people_policy(restored)
	var profile = CampaignPeopleDevelopment.add_profile(
		people,
		candidate.id,
		candidate.attributes,
		slot,
		int(tuning.new_hire_morale),
		int(tuning.new_hire_trust)
	)
	if not profile.ok:
		return _reject(profile.error, checkpoint)
	var management = CampaignManagement.with_people(restored.management, profile.people)
	if management.is_empty():
		return _reject("Hired candidate could not enter management people authority.", checkpoint)
	return _publish(
		restored,
		personnel,
		economy,
		management,
		"hired",
		checkpoint,
		{"person_id": candidate.id, "contract_id": signed.contract.id}
	)


static func add_profile(
	checkpoint: Dictionary,
	person_id: String,
	attributes: Dictionary,
	morale: int = 60,
	trust: int = 60
) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.add_profile(
		restored.management.people,
		person_id,
		attributes,
		restored.state.clock.elapsed_slots,
		morale,
		trust
	)
	if changed.ok and not restored.personnel.people.has(person_id):
		return _reject("People profile requires one registered campaign person.", checkpoint)
	return _publish_people(restored, changed, checkpoint)


static func set_development_plan(
	checkpoint: Dictionary, person_id: String, focus: String, review_slot: int
) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.set_plan(
		restored.management.people,
		person_id,
		focus,
		review_slot,
		restored.state.clock.elapsed_slots
	)
	return _publish_people(restored, changed, checkpoint)


static func create_promise(checkpoint: Dictionary, input: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.create_promise(
		restored.management.people, input, restored.state.clock.elapsed_slots
	)
	return _publish_people(restored, changed, checkpoint)


static func resolve_promise(
	checkpoint: Dictionary, promise_id: String, fulfilled: bool
) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.resolve_promise(
		restored.management.people, promise_id, fulfilled, restored.state.clock.elapsed_slots
	)
	return _publish_people(restored, changed, checkpoint)


static func review_due(checkpoint: Dictionary) -> Dictionary:
	var restored = _restore(checkpoint)
	if not restored.ok:
		return restored
	var changed = CampaignPeopleDevelopment.review_due(
		restored.management.people,
		restored.personnel,
		restored.state.clock.elapsed_slots,
		_people_policy(restored)
	)
	var result = _publish_people(restored, changed, checkpoint)
	if result.ok:
		result["reviewed"] = changed.reviewed
	return result


static func _people_policy(restored: Dictionary) -> Dictionary:
	var frozen = restored.management.get("campaign_content", {})
	if not frozen.is_empty() and CampaignContentSnapshot.validate(frozen).is_empty():
		return CampaignPeoplePolicy.normalized(frozen.definition.get("people_policy", {}))
	return CampaignPeoplePolicy.LEGACY.duplicate(true)


static func _restore(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, checkpoint)
	if not restored.active_manifest.is_empty():
		return _reject("People planning is frozen while a campaign weekend is active.", checkpoint)
	return restored


static func _publish_people(
	restored: Dictionary, changed: Dictionary, original: Dictionary
) -> Dictionary:
	if not changed.ok:
		return _reject(changed.error, original, changed.get("status", "rejected"))
	var management = CampaignManagement.with_people(restored.management, changed.people)
	if management.is_empty():
		return _reject("People change could not update management authority.", original)
	return _publish(
		restored, restored.personnel, restored.economy, management, changed.status, original
	)


static func _publish(
	restored: Dictionary,
	personnel: Dictionary,
	economy: Dictionary,
	management: Dictionary,
	status: String,
	original: Dictionary,
	extra: Dictionary = {}
) -> Dictionary:
	var candidate = CampaignCheckpoint.build(
		restored.state,
		restored.settlements,
		restored.active_manifest,
		restored.competition,
		economy,
		restored.inventory,
		personnel,
		restored.operations,
		restored.engineering,
		management
	)
	if candidate.is_empty():
		return _reject("People change could not form one valid campaign checkpoint.", original)
	var result = {"ok": true, "status": status, "error": "", "checkpoint": candidate}
	result.merge(extra, true)
	return result


static func _reject(
	message: String, checkpoint: Dictionary, status: String = "rejected"
) -> Dictionary:
	return {
		"ok": false, "status": status, "error": message, "checkpoint": checkpoint.duplicate(true)
	}
