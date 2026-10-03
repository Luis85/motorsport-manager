class_name CampaignPeopleDevelopmentAuthority
extends RefCounted
## Profiles/plans/promises are management evidence over registered personnel, not a second people registry.


static func validate(people: Dictionary, personnel: Dictionary, current_slot: int) -> String:
	var error = CampaignPeopleDevelopment.validate(people)
	if not error.is_empty():
		return error
	error = CampaignPersonnel.validate(personnel)
	if not error.is_empty():
		return error
	for candidate in people.candidates.values():
		if (
			int(candidate.created_slot) > current_slot
			or int(candidate.last_contact_slot) > current_slot
		):
			return "Candidate market history is dated after authoritative campaign time."
		if candidate.state == "signed" and not personnel.people.has(candidate.id):
			return "Signed candidate has no registered campaign person."
	for profile in people.profiles.values():
		if not personnel.people.has(profile.person_id):
			return "People profile references an unknown campaign person."
		if int(profile.created_slot) > current_slot or int(profile.last_change_slot) > current_slot:
			return "People profile history is future-dated."
	for plan in people.plans.values():
		if (
			not personnel.people.has(plan.person_id)
			or int(plan.created_slot) > current_slot
			or int(plan.last_review_slot) > current_slot
		):
			return "Development plan references unknown or future personnel evidence."
	for promise in people.promises.values():
		if (
			not personnel.people.has(promise.person_id)
			or int(promise.created_slot) > current_slot
			or int(promise.resolved_slot) > current_slot
		):
			return "People promise references unknown or future personnel evidence."
	for review in people.reviews:
		if not personnel.people.has(review.person_id) or int(review.slot) > current_slot:
			return "People development review references unknown or future personnel evidence."
	return ""
