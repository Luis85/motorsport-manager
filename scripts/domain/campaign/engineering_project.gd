class_name CampaignEngineeringProject
extends RefCounted
## One small engineering pipeline from problem investigation to one installed physical part.
const STAGES = [
	"investigation",
	"concept",
	"detailed_design",
	"prototype",
	"validation",
	"production",
	"integration",
	"complete"
]
const DOMAINS = ["power_delivery", "mechanical_grip", "braking", "aerodynamic_package"]
const MAX_TITLE = 100


static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var id = input.get("id")
	var data = {
		"id": id,
		"title": input.get("title"),
		"domain": input.get("domain"),
		"target_event_id": input.get("target_event_id", ""),
		"target_car_id": input.get("target_car_id"),
		"created_slot": created_slot,
		"stage": "investigation",
		"profile_delta": input.get("profile_delta", {}).duplicate(true),
		"material_cost_minor": input.get("material_cost_minor"),
		"stage_orders": {},
		"material_commitment_id": "",
		"design_id": _derived_id("design", str(id)),
		"part_id": _derived_id("part", str(id))
	}
	_seal(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign engineering project exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 14:
		return "Campaign engineering project has an unsupported shape."
	for key in ["id", "target_car_id", "design_id", "part_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign engineering project has an invalid " + key + "."
	if (
		not data.get("target_event_id") is String
		or (
			not data.target_event_id.is_empty() and not CampaignIdentity.valid(data.target_event_id)
		)
	):
		return "Campaign engineering project has an invalid target event."
	if (
		not data.get("title") is String
		or data.title.strip_edges().is_empty()
		or data.title.length() > MAX_TITLE
		or data.get("domain") not in DOMAINS
	):
		return "Campaign engineering project has an invalid title or domain."
	if (
		not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or data.get("stage") not in STAGES
	):
		return "Campaign engineering project has invalid timing or stage."
	if RacePerformanceProfile.build(data.get("profile_delta", {})).is_empty():
		return "Campaign engineering project has an unsupported performance profile."
	if not RaceCheckpoint.integral(data.get("material_cost_minor"), 1, CampaignEconomy.MAX_MINOR):
		return "Campaign engineering project has an invalid material cost."
	if not data.get("stage_orders") is Dictionary or data.stage_orders.size() > STAGES.size() - 1:
		return "Campaign engineering project has invalid work-order evidence."
	for stage in data.stage_orders:
		if (
			stage not in STAGES
			or stage == "complete"
			or not CampaignIdentity.valid(data.stage_orders[stage])
		):
			return "Campaign engineering project has invalid stage work."
	if (
		not data.get("material_commitment_id") is String
		or (
			not data.material_commitment_id.is_empty()
			and not CampaignIdentity.valid(data.material_commitment_id)
		)
	):
		return "Campaign engineering project has an invalid material commitment."
	if (
		data.design_id != _derived_id("design", data.id)
		or data.part_id != _derived_id("part", data.id)
	):
		return "Campaign engineering project has non-deterministic output identities."
	return _integrity_error(data)


static func expected_family(stage: String) -> String:
	match stage:
		"investigation", "concept", "detailed_design":
			return "design_office"
		"prototype", "production", "integration":
			return "preparation_workshop"
		"validation":
			return "test_validation"
	return ""


static func next_stage(stage: String) -> String:
	var index = STAGES.find(stage)
	return STAGES[index + 1] if index >= 0 and index + 1 < STAGES.size() else ""


static func material_commitment_id(project_id: String) -> String:
	return "engineering." + RaceStateValue.fingerprint([project_id, "material"]).substr(0, 24)


static func _derived_id(prefix: String, project_id: String) -> String:
	return prefix + "." + RaceStateValue.fingerprint([project_id, prefix]).substr(0, 24)


static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign engineering project integrity check failed."
	return ""


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
