class_name CampaignRoleAssignment
extends RefCounted
## Dated responsibility allocation inside one employment contract.
const ROLES = [
	"race_driver", "race_engineer", "technical_lead", "chief_mechanic",
	"operations_lead", "commercial_lead", "department_workforce", "academy_lead"
]
const MAX_ALLOCATION_BPS = 10000

static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"person_id": input.get("person_id"),
		"contract_id": input.get("contract_id"),
		"role_id": input.get("role_id"),
		"created_slot": created_slot,
		"start_slot": input.get("start_slot"),
		"end_slot": input.get("end_slot"),
		"allocation_bps": input.get("allocation_bps")
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign role assignment exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 9:
		return "Campaign role assignment has an unsupported shape."
	for key in ["id", "person_id", "contract_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign role assignment has an invalid " + key + "."
	if data.get("role_id") not in ROLES:
		return "Campaign role assignment has an unsupported role."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("start_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign role assignment has invalid timing."
	if not RaceCheckpoint.integral(data.get("allocation_bps"), 1, MAX_ALLOCATION_BPS):
		return "Campaign role assignment has an invalid allocation."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign role assignment integrity check failed."
	return ""

static func overlaps(left: Dictionary, right: Dictionary,
		left_end: int = -1, right_end: int = -1) -> bool:
	var actual_left_end = int(left.end_slot) if left_end < 0 else left_end
	var actual_right_end = int(right.end_slot) if right_end < 0 else right_end
	return int(left.start_slot) < actual_right_end and int(right.start_slot) < actual_left_end
