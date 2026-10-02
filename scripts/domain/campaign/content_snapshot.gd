class_name CampaignContentSnapshot
extends RefCounted
## Frozen campaign and race-content closure. An active career never rereads pack
## tuning, so replacing a source pack cannot retroactively change future rounds.
const KIND = "motorsport-manager-campaign-content"
const VERSION = 1

static func build(definition: Dictionary, race_initial: Dictionary, circuits: Dictionary) -> Dictionary:
	var campaign = CampaignDefinition.from_record(definition)
	if campaign == null or not race_initial is Dictionary:
		return {}
	var options = RaceContentSnapshot.options(race_initial)
	options.erase("performance_profiles")
	var data = {
		"kind": KIND, "version": VERSION, "definition": campaign.to_record(),
		"vehicle": race_initial.get("vehicle", ""),
		"vehicle_definition": race_initial.get("vehicle_definition", {}).duplicate(true),
		"race_options": options, "circuits": circuits.duplicate(true),
		"opening_track_hash": RaceStateValue.fingerprint(race_initial.get("track", {}))
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data) or not data is Dictionary or data.size() != 9:
		return "Campaign content snapshot has an unsupported shape."
	if data.get("kind") != KIND or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign content snapshot."
	var campaign = CampaignDefinition.from_record(data.get("definition"))
	if campaign == null:
		return "Campaign content snapshot has an invalid campaign definition."
	if not data.get("circuits") is Dictionary or not CampaignIdentity.valid_hash(data.get("opening_track_hash")):
		return "Campaign content snapshot has an invalid circuit closure."
	var campaign_record = campaign.to_record()
	var expected_circuits = {}
	for event in campaign_record.calendar:
		expected_circuits[event.circuit_id] = true
	var circuit_ids = data.circuits.keys(); circuit_ids.sort()
	var expected_ids = expected_circuits.keys(); expected_ids.sort()
	if circuit_ids != expected_ids:
		return "Campaign circuit closure disagrees with its authored calendar."
	for circuit_id in circuit_ids:
		if not data.circuits[circuit_id] is Dictionary or not TrackDocument.validate(data.circuits[circuit_id]).is_empty():
			return "Campaign circuit closure contains an invalid track document."
	if not campaign_record.calendar.is_empty():
		var first_id: String = campaign_record.calendar[0].circuit_id
		if RaceStateValue.fingerprint(data.circuits[first_id]) != data.opening_track_hash:
			return "Campaign opening race does not match the first authored circuit."
	if not data.get("vehicle") is String or data.vehicle.is_empty() or not data.get("vehicle_definition") is Dictionary:
		return "Campaign content snapshot has an invalid vehicle closure."
	var vehicle = VehicleDefinition.from_record(data.vehicle_definition)
	if vehicle == null or data.vehicle_definition.get("id") != data.vehicle:
		return "Campaign vehicle identity disagrees with its frozen definition."
	if not data.get("race_options") is Dictionary:
		return "Campaign content snapshot has invalid race options."
	var options: Dictionary = data.race_options
	if options.has("performance_profiles"):
		return "Campaign content snapshot cannot freeze event-specific performance profiles."
	var weekend = WeekendDefinition.from_record(options.get("weekend_definition"))
	if weekend == null or weekend.id != campaign.weekend_id:
		return "Campaign weekend reference disagrees with its frozen definition."
	for key in weekend.to_record().settings:
		if options.get(key) != weekend.to_record().settings[key]:
			return "Campaign race option disagrees with its frozen weekend setting: " + key
	if data.vehicle != weekend.vehicle_id:
		return "Campaign vehicle disagrees with its frozen weekend."
	var record = weekend.to_record()
	if not _references_agree(record, options):
		return "Campaign weekend references disagree with their frozen runtime definitions."
	if not RaceContentSnapshot.valid_mechanics(options):
		return "Campaign mechanic profile disagrees with its frozen weekend."
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign content snapshot integrity check failed."
	return ""

static func _references_agree(weekend: Dictionary, options: Dictionary) -> bool:
	if not options.get("roster_definition") is Dictionary 			or options.roster_definition.get("roster", {}).get("id") != weekend.roster_id:
		return false
	if not options.get("tyre_definition") is Dictionary 			or options.tyre_definition.get("allocation", {}).get("id") != weekend.tyre_allocation_id:
		return false
	if not options.get("setup_definition") is Dictionary 			or options.setup_definition.get("id") != weekend.setup_id:
		return false
	if not options.get("tuning_definition") is Dictionary 			or options.tuning_definition.get("id") != weekend.race_tuning_id:
		return false
	if weekend.has("mechanic_profile_id"):
		return options.get("mechanic_definition") is Dictionary 			and options.mechanic_definition.get("id") == weekend.mechanic_profile_id
	return true

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
