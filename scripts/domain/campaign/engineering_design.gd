class_name CampaignEngineeringDesign
extends RefCounted


## Validated specification. It is knowledge/design evidence, not a physical part.
static func build(project: Dictionary, validated_slot: int, work_order_id: String) -> Dictionary:
	if not project.get("profile_delta", {}) is Dictionary:
		return {}
	var data = {
		"id": project.get("design_id"),
		"project_id": project.get("id"),
		"domain": project.get("domain"),
		"validated_slot": validated_slot,
		"profile_delta": project.get("profile_delta", {}).duplicate(true),
		"validation_work_order_id": work_order_id
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data) or not data is Dictionary or data.size() != 7:
		return "Campaign engineering design has an unsupported shape."
	for key in ["id", "project_id", "validation_work_order_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign engineering design has an invalid " + key + "."
	if (
		data.get("domain") not in CampaignEngineeringProject.DOMAINS
		or not RaceCheckpoint.integral(
			data.get("validated_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not data.get("profile_delta", {}) is Dictionary
		or RacePerformanceProfile.build(data.get("profile_delta", {})).is_empty()
	):
		return "Campaign engineering design has invalid validated capability evidence."
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign engineering design integrity check failed."
	return ""
