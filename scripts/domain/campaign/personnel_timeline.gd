class_name CampaignPersonnelTimeline
extends RefCounted
## Personnel history cannot be dated after the campaign state that contains it.
## Effective starts, endings and future reservations may remain ahead of time.

static func validate(personnel: Dictionary, elapsed_slot: int) -> String:
	var error = CampaignPersonnel.validate(personnel)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(elapsed_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign personnel has no valid authoritative time boundary."
	if int(personnel.authority_from_slot) > elapsed_slot:
		return "Campaign personnel authority begins after authoritative campaign time."
	for person in personnel.people.values():
		if int(person.created_slot) > elapsed_slot:
			return "Campaign person was created after authoritative campaign time."
	for contract in personnel.contracts.values():
		if int(contract.signed_slot) > elapsed_slot:
			return "Campaign employment contract was signed after authoritative campaign time."
		if int(contract.terminated_slot) > elapsed_slot:
			return "Campaign employment contract terminates after authoritative campaign time."
	for assignment in personnel.assignments.values():
		if int(assignment.created_slot) > elapsed_slot:
			return "Campaign role assignment was created after authoritative campaign time."
	for reservation in personnel.reservations.values():
		if int(reservation.created_slot) > elapsed_slot:
			return "Campaign availability reservation was created after authoritative campaign time."
		if int(reservation.cancellation_slot) > elapsed_slot:
			return "Campaign availability cancellation is dated after authoritative campaign time."
	return ""
