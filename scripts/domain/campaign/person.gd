class_name CampaignPerson
extends RefCounted
## Stable named person eligible for a bounded set of campaign roles.
const MAX_NAME_LENGTH = 80
const MAX_ROLES = 8

static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"display_name": input.get("display_name"),
		"eligible_roles": input.get("eligible_roles", []).duplicate(true),
		"created_slot": created_slot
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign person exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 5:
		return "Campaign person has an unsupported shape."
	if not CampaignIdentity.valid(data.get("id")):
		return "Campaign person has an invalid identity."
	if not data.get("display_name") is String or data.display_name.strip_edges().is_empty() \
			or data.display_name.length() > MAX_NAME_LENGTH:
		return "Campaign person has an invalid display name."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign person has an invalid creation slot."
	if not data.get("eligible_roles") is Array or data.eligible_roles.is_empty() \
			or data.eligible_roles.size() > MAX_ROLES:
		return "Campaign person has an invalid role eligibility set."
	var seen = {}
	for role_id in data.eligible_roles:
		if role_id not in CampaignRoleAssignment.ROLES or seen.has(role_id):
			return "Campaign person role eligibility is invalid or duplicated."
		seen[role_id] = true
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign person integrity check failed."
	return ""
