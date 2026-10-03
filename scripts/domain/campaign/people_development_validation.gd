class_name CampaignPeopleDevelopmentValidation
extends RefCounted
## Pure validation of detached campaign records.
const MAX_CANDIDATES = CampaignPeopleDevelopment.MAX_CANDIDATES
const MAX_PROFILES = CampaignPeopleDevelopment.MAX_PROFILES
const MAX_PLANS = CampaignPeopleDevelopment.MAX_PLANS
const MAX_PROMISES = CampaignPeopleDevelopment.MAX_PROMISES
const MAX_REVIEWS = CampaignPeopleDevelopment.MAX_REVIEWS
const ATTRIBUTES = CampaignPeopleDevelopment.ATTRIBUTES
const PREFERENCES = CampaignPeopleDevelopment.PREFERENCES
const PROMISE_TYPES = CampaignPeopleDevelopment.PROMISE_TYPES
const CANDIDATE_STATES = CampaignPeopleDevelopment.CANDIDATE_STATES


static func validate(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 5
		or not data.get("candidates") is Dictionary
		or data.candidates.size() > MAX_CANDIDATES
		or not data.get("profiles") is Dictionary
		or data.profiles.size() > MAX_PROFILES
		or not data.get("plans") is Dictionary
		or data.plans.size() > MAX_PLANS
		or not data.get("promises") is Dictionary
		or data.promises.size() > MAX_PROMISES
		or not data.get("reviews") is Array
		or data.reviews.size() > MAX_REVIEWS
	):
		return "Campaign people-development projection is invalid."
	for id in data.candidates:
		if (
			not data.candidates[id] is Dictionary
			or id != data.candidates[id].get("id")
			or not _candidate_error(data.candidates[id]).is_empty()
		):
			return "Campaign candidate registry is invalid."
	for person_id in data.profiles:
		if (
			not data.profiles[person_id] is Dictionary
			or person_id != data.profiles[person_id].get("person_id")
			or not _profile_error(data.profiles[person_id]).is_empty()
		):
			return "Campaign people profile registry is invalid."
	for person_id in data.plans:
		var plan = data.plans[person_id]
		if (
			not plan is Dictionary
			or person_id != plan.get("person_id")
			or not data.profiles.has(person_id)
			or not _plan_error(plan).is_empty()
		):
			return "Campaign development plan registry is invalid."
	for id in data.promises:
		var promise = data.promises[id]
		if (
			not promise is Dictionary
			or id != promise.get("id")
			or not data.profiles.has(promise.get("person_id"))
			or not _promise_error(promise).is_empty()
		):
			return "Campaign promise registry is invalid."
	for review in data.reviews:
		if not _review_error(review).is_empty() or not data.profiles.has(review.get("person_id")):
			return "Campaign development review history is invalid."
	return ""


static func _candidate_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 14:
		return "invalid candidate shape"
	if (
		not CampaignIdentity.valid(data.get("id"))
		or not data.get("display_name") is String
		or data.display_name.strip_edges().is_empty()
		or data.display_name.length() > 100
	):
		return "invalid candidate identity"
	if not data.get("eligible_roles") is Array or data.eligible_roles.is_empty():
		return "invalid candidate roles"
	for role in data.eligible_roles:
		if role not in CampaignRoleAssignment.ROLES:
			return "invalid candidate role"
	if not _attributes_error(data.get("attributes")).is_empty():
		return "invalid candidate attributes"
	if (
		not RaceCheckpoint.integral(data.get("confidence"), 0, 100)
		or not RaceCheckpoint.integral(
			data.get("salary_expectation_minor"), 1, CampaignEconomy.MAX_MINOR
		)
		or not RaceCheckpoint.integral(
			data.get("available_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "invalid candidate terms"
	if (
		data.get("state") not in CANDIDATE_STATES
		or not RaceCheckpoint.integral(data.get("offer_count"), 0, 3)
		or not RaceCheckpoint.integral(data.get("last_offer_minor"), 0, CampaignEconomy.MAX_MINOR)
		or not RaceCheckpoint.integral(
			data.get("last_contact_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "invalid candidate negotiation"
	var seen = {}
	if not data.get("preferences") is Array or data.preferences.size() > PREFERENCES.size():
		return "invalid candidate preferences"
	for preference in data.preferences:
		if preference not in PREFERENCES or seen.has(preference):
			return "invalid candidate preference"
		seen[preference] = true
	return _digest_error(data)


static func _profile_error(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 7
		or not CampaignIdentity.valid(data.get("person_id"))
		or not _attributes_error(data.get("attributes")).is_empty()
		or not RaceCheckpoint.integral(data.get("morale"), 0, 100)
		or not RaceCheckpoint.integral(data.get("trust"), 0, 100)
		or not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("last_change_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "invalid people profile"
	return _digest_error(data)


static func _plan_error(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 7
		or not CampaignIdentity.valid(data.get("person_id"))
		or data.get("focus") not in ATTRIBUTES
		or data.get("status") != "active"
		or not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("last_review_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(
			data.get("review_slot"), int(data.last_review_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "invalid development plan"
	return _digest_error(data)


static func _promise_error(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 9
		or not CampaignIdentity.valid(data.get("id"))
		or not CampaignIdentity.valid(data.get("person_id"))
		or data.get("type") not in PROMISE_TYPES
		or not CampaignIdentity.valid(data.get("evidence_id"))
		or not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("deadline_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or data.get("status") not in ["open", "fulfilled", "failed"]
		or not RaceCheckpoint.integral(
			data.get("resolved_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "invalid promise"
	if data.status == "open" and int(data.resolved_slot) != -1:
		return "open promise has resolution"
	if (
		data.status == "fulfilled"
		and (
			int(data.resolved_slot) < int(data.created_slot)
			or int(data.resolved_slot) > int(data.deadline_slot)
		)
	):
		return "fulfilled promise timing invalid"
	if data.status == "failed" and int(data.resolved_slot) < int(data.deadline_slot):
		return "failed promise timing invalid"
	return _digest_error(data)


static func _review_error(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 8
		or not CampaignIdentity.valid(data.get("person_id"))
		or data.get("focus") not in ATTRIBUTES
		or not RaceCheckpoint.integral(data.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(data.get("gain"), 0, 10)
		or not RaceCheckpoint.number(data.get("workload"), 0, 1)
		or not RaceCheckpoint.integral(data.get("morale"), 0, 100)
		or not RaceCheckpoint.integral(data.get("trust"), 0, 100)
	):
		return "invalid review"
	return _digest_error(data)


static func _attributes_error(value: Variant) -> String:
	if not value is Dictionary or value.size() != ATTRIBUTES.size():
		return "attributes must use the five bounded dimensions"
	for key in ATTRIBUTES:
		if not RaceCheckpoint.integral(value.get(key), 0, 100):
			return "attribute is invalid"
	return ""


static func _digest_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	return (
		""
		if (
			CampaignIdentity.valid_hash(data.get("digest"))
			and data.digest == RaceStateValue.fingerprint(content)
		)
		else "invalid integrity digest"
	)
