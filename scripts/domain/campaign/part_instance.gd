class_name CampaignPartInstance
extends RefCounted
## One physical produced item. A validated design never implies this item exists.
const STATUSES = ["available", "installed"]

static func build(project: Dictionary, design: Dictionary,
		produced_slot: int, production_order_id: String) -> Dictionary:
	var data = {
		"id": project.get("part_id"),
		"project_id": project.get("id"),
		"design_id": design.get("id"),
		"produced_slot": produced_slot,
		"production_work_order_id": production_order_id,
		"condition": 100,
		"status": "available",
		"installed_car_id": "",
		"installed_slot": -1,
		"integration_work_order_id": ""
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func install(current: Dictionary, car_id: String,
		slot: int, integration_order_id: String) -> Dictionary:
	if not validate(current).is_empty() or current.status != "available" 			or not CampaignIdentity.valid(car_id) or not CampaignIdentity.valid(integration_order_id) 			or slot < int(current.produced_slot):
		return {}
	var data = current.duplicate(true)
	data.status = "installed"
	data.installed_car_id = car_id
	data.installed_slot = slot
	data.integration_work_order_id = integration_order_id
	_seal(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data) or not data is Dictionary or data.size() != 11:
		return "Campaign physical part has an unsupported shape."
	for key in ["id", "project_id", "design_id", "production_work_order_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign physical part has an invalid " + key + "."
	if not RaceCheckpoint.integral(data.get("produced_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("condition"), 0, 100) 			or data.get("status") not in STATUSES:
		return "Campaign physical part has invalid production or condition evidence."
	if not data.get("installed_car_id") is String or not data.get("integration_work_order_id") is String 			or not RaceCheckpoint.integral(data.get("installed_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign physical part has invalid installation evidence."
	if data.status == "available":
		if not data.installed_car_id.is_empty() or int(data.installed_slot) != -1 				or not data.integration_work_order_id.is_empty():
			return "Available campaign part already has installation evidence."
	elif not CampaignIdentity.valid(data.installed_car_id) 			or not CampaignIdentity.valid(data.integration_work_order_id) 			or int(data.installed_slot) < int(data.produced_slot):
		return "Installed campaign part has invalid installation evidence."
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) 			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign physical part integrity check failed."
	return ""

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
