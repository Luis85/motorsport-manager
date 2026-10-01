class_name CampaignReadinessQuery
extends RefCounted
## Read-only TM-08 event-readiness projection over existing campaign authorities.
## Readiness has no independent performance modifier: it reports blockers, accepted
## risks and the exact installed race-profile evidence that would be frozen.

const MAX_EVENT_ASSIGNMENTS = 32
const CREW_ROLES = ["race_engineer", "chief_mechanic", "operations_lead", "department_workforce"]

static func evaluate(checkpoint: Dictionary, manifest: Dictionary,
		race_profiles: Array, assignment_ids: Array, event_cost_minor: int) -> Dictionary:
	var source_fingerprint = RaceStateValue.fingerprint(checkpoint)
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return _result(false, [restored.error], [], {}, source_fingerprint)
	var blockers: Array = []
	var warnings: Array = []
	var manifest_error = CampaignWeekendManifest.validate(manifest)
	if not manifest_error.is_empty():
		blockers.append(manifest_error)
		return _result(false, blockers, warnings, {}, source_fingerprint)
	if not restored.active_manifest.is_empty():
		blockers.append("Another campaign weekend is already active.")
	if restored.state.clock.elapsed_slots != int(manifest.departure_slot):
		blockers.append("Campaign time must equal the registered departure slot.")
	var competition_error = CampaignCompetition.manifest_error(restored.competition, manifest)
	if not competition_error.is_empty():
		blockers.append(competition_error)
	if int(manifest.checkpoint_version) < TacticalDuels.CHECKPOINT_VERSION:
		blockers.append("Campaign departure requires the performance-profile race checkpoint.")
	var projected = CampaignEngineeringQuery.race_profiles(checkpoint, manifest.mappings)
	if not projected.ok:
		blockers.append(projected.error)
	elif not RacePerformanceProfile.validate_set(race_profiles, manifest.mappings.size()).is_empty():
		blockers.append("Race entry performance profiles are invalid or incomplete.")
	elif RaceStateValue.fingerprint(projected.profiles) != RaceStateValue.fingerprint(race_profiles):
		blockers.append("Race entry performance profiles differ from installed campaign parts.")
	var personnel = _personnel_readiness(restored, manifest, assignment_ids)
	blockers.append_array(personnel.blockers)
	warnings.append_array(personnel.warnings)
	var finance = _finance_readiness(checkpoint, restored, manifest, event_cost_minor)
	blockers.append_array(finance.blockers)
	warnings.append_array(finance.warnings)
	var evidence = {
		"manifest_digest": manifest.digest,
		"race_profiles_digest": RaceStateValue.fingerprint(race_profiles),
		"assignment_ids": assignment_ids.duplicate(true),
		"event_cost_minor": event_cost_minor,
		"finance": finance.evidence,
		"player_entry": personnel.entry
	}
	return _result(blockers.is_empty(), blockers, warnings, evidence, source_fingerprint)

static func event_commitment_input(restored: Dictionary, manifest: Dictionary,
		event_cost_minor: int) -> Dictionary:
	if event_cost_minor <= 0:
		return {}
	return {
		"id": "eventops." + RaceStateValue.fingerprint([
			manifest.campaign_event_id, manifest.entrant_id, "departure"]).substr(0, 24),
		"account_id": restored.state.organization_id,
		"source_id": manifest.campaign_event_id,
		"due_slot": int(manifest.departure_slot),
		"amount_minor": -event_cost_minor,
		"category": "event_operations"
	}

static func _personnel_readiness(restored: Dictionary, manifest: Dictionary,
		assignment_ids: Variant) -> Dictionary:
	var blockers: Array = []
	var warnings: Array = []
	if not assignment_ids is Array or assignment_ids.size() < 3 \
			or assignment_ids.size() > MAX_EVENT_ASSIGNMENTS:
		return {"blockers": ["Event duty requires a bounded driver-and-crew assignment set."],
			"warnings": warnings, "entry": {}}
	var season = restored.competition.seasons.get(manifest.season_id, {})
	var entry = season.get("entries", {}).get(manifest.entrant_id, {})
	if entry.is_empty():
		return {"blockers": ["The campaign entrant is not registered for this event."],
			"warnings": warnings, "entry": {}}
	var selected_people = {}
	var selected_roles = {}
	var seen_assignments = {}
	for assignment_id in assignment_ids:
		if not CampaignIdentity.valid(assignment_id) or seen_assignments.has(assignment_id) \
				or not restored.personnel.assignments.has(assignment_id):
			blockers.append("Event duty contains an invalid, repeated or unknown assignment.")
			continue
		seen_assignments[assignment_id] = true
		var assignment: Dictionary = restored.personnel.assignments[assignment_id]
		if selected_people.has(assignment.person_id):
			blockers.append("One person cannot occupy two simultaneous event-duty assignments.")
			continue
		if int(assignment.start_slot) > int(manifest.departure_slot) \
				or int(assignment.end_slot) < int(manifest.return_slot):
			blockers.append("Event-duty assignment does not cover the complete travel interval: " + assignment_id)
			continue
		var availability = CampaignPersonnel.availability_error(
			restored.personnel, assignment.person_id,
			int(manifest.departure_slot), int(manifest.return_slot))
		if not availability.is_empty():
			blockers.append(availability)
			continue
		selected_people[assignment.person_id] = assignment
		selected_roles[assignment.role_id] = true
	for person_id in entry.get("person_ids", []):
		if not selected_people.has(person_id) \
				or selected_people[person_id].role_id != "race_driver":
			blockers.append("Every entered player driver requires a covering race-driver assignment.")
	var crew_ready = false
	for role in CREW_ROLES:
		if selected_roles.has(role):
			crew_ready = true
			break
	if not crew_ready:
		blockers.append("Event duty requires at least one qualified race-operations crew assignment.")
	if restored.inventory.events.is_empty():
		warnings.append("No prior campaign return inventory exists; this first departure relies on the frozen race-entry resources.")
	return {"blockers": blockers, "warnings": warnings, "entry": entry.duplicate(true)}

static func _finance_readiness(checkpoint: Dictionary, restored: Dictionary,
		manifest: Dictionary, event_cost_minor: int) -> Dictionary:
	var blockers: Array = []
	var warnings: Array = []
	var evidence = {"commitment": {}, "forecast": {}}
	if not RaceCheckpoint.integral(event_cost_minor, 0, CampaignEconomy.MAX_MINOR):
		blockers.append("Event operations cost must be a bounded integer amount.")
		return {"blockers": blockers, "warnings": warnings, "evidence": evidence}
	if event_cost_minor == 0:
		return {"blockers": blockers, "warnings": warnings, "evidence": evidence}
	var input = event_commitment_input(restored, manifest, event_cost_minor)
	var preview = CampaignFinanceQuery.commitment_preview(
		checkpoint, input, int(manifest.return_slot))
	if not preview.ok:
		blockers.append(preview.error)
		return {"blockers": blockers, "warnings": warnings, "evidence": evidence}
	evidence.commitment = preview.commitment
	evidence.forecast = preview.forecast
	var committed: Dictionary = preview.forecast.scenarios.committed
	if committed.breaches_reserve:
		warnings.append("Event operations would breach the chosen cash reserve by %d credits." %
			int(committed.reserve_gap_minor))
	return {"blockers": blockers, "warnings": warnings, "evidence": evidence}

static func _result(ready: bool, blockers: Array, warnings: Array,
		evidence: Dictionary, source_fingerprint: String) -> Dictionary:
	return {
		"ok": true,
		"ready": ready,
		"blockers": blockers,
		"warnings": warnings,
		"evidence": evidence,
		"source_checkpoint_fingerprint": source_fingerprint
	}
