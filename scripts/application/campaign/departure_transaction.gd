class_name CampaignDepartureTransaction
extends RefCounted
## Atomic TM-08 departure checkpoint. It derives readiness from existing campaign
## authorities, reserves travelling people, settles explicit event-operations cost,
## and freezes the existing immutable weekend manifest. It owns no second race setup.

static func depart(checkpoint: Dictionary, context: Dictionary, record: RaceRecord,
		mappings: Array, assignment_ids: Array, event_cost_minor: int) -> Dictionary:
	var original = checkpoint.duplicate(true)
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _reject(restored.error, original)
	var record_error = _record_error(record)
	if not record_error.is_empty():
		return _reject(record_error, original)
	var manifest = CampaignWeekendManifest.build(context, record, mappings)
	if manifest.is_empty():
		return _reject("Race record could not form a valid immutable campaign manifest.", original)
	var profiles = record.initial.get("performance_profiles", [])
	var readiness = CampaignReadinessQuery.evaluate(
		checkpoint, manifest, profiles, assignment_ids, event_cost_minor)
	if not readiness.ok or not readiness.ready:
		return _reject("Departure readiness is blocked: " + "; ".join(readiness.blockers), original,
			"blocked", readiness)
	var personnel = restored.personnel.duplicate(true)
	for assignment_id in assignment_ids:
		var assignment: Dictionary = personnel.assignments[assignment_id]
		var reservation_id = _reservation_id(manifest.campaign_event_id, assignment_id)
		var reserved = CampaignPersonnel.reserve_availability(personnel, {
			"id": reservation_id,
			"person_id": assignment.person_id,
			"assignment_id": assignment_id,
			"start_slot": int(manifest.departure_slot),
			"end_slot": int(manifest.return_slot),
			"kind": "event_duty",
			"location_id": manifest.campaign_event_id
		}, restored.state.clock.elapsed_slots)
		if not reserved.ok:
			return _reject(reserved.error, original, "blocked", readiness)
		personnel = reserved.personnel
	var economy = restored.economy.duplicate(true)
	var settled_count = 0
	if event_cost_minor > 0:
		var commitment = CampaignReadinessQuery.event_commitment_input(
			restored, manifest, event_cost_minor)
		var added = CampaignEconomy.add_commitment(
			economy, commitment, restored.state.clock.elapsed_slots)
		if not added.ok:
			return _reject(added.error, original, "blocked", readiness)
		var due = CampaignEconomy.settle_due(added.economy, int(manifest.departure_slot))
		if not due.ok:
			return _reject(due.error, original, "blocked", readiness)
		economy = due.economy
		settled_count = due.get("settled_count", 0)
	var candidate = CampaignCheckpoint.build(
		restored.state, restored.settlements, manifest, restored.competition,
		economy, restored.inventory, personnel, restored.operations, restored.engineering)
	if candidate.is_empty():
		return _reject("Departure could not form one valid frozen campaign checkpoint.",
			original, "rejected", readiness)
	return {"ok": true, "status": "departed", "error": "", "checkpoint": candidate,
		"manifest": manifest.duplicate(true), "readiness": readiness,
		"settled_commitments": settled_count}

static func _record_error(record: RaceRecord) -> String:
	if record == null or not RaceRecord.valid_id(record.event_id) \
			or not record.initial is Dictionary or record.initial.is_empty():
		return "Departure requires one valid recorded race entry."
	if int(record.initial.get("version", 0)) < TacticalDuels.CHECKPOINT_VERSION:
		return "Campaign departure requires a performance-profile race checkpoint."
	if PracticeRaceSim.restore_practice(record.initial) == null:
		return "Recorded race entry cannot be restored under the supported race model."
	return ""

static func _reservation_id(event_id: String, assignment_id: String) -> String:
	return "eventperson." + RaceStateValue.fingerprint(
		[event_id, assignment_id, "event-duty"]).substr(0, 24)

static func _reject(message: String, checkpoint: Dictionary,
		status: String = "rejected", readiness: Dictionary = {}) -> Dictionary:
	return {"ok": false, "status": status, "error": message,
		"checkpoint": checkpoint.duplicate(true), "readiness": readiness.duplicate(true)}
