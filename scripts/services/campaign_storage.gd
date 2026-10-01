class_name CampaignStorage
extends RefCounted
## Concrete atomic JSON adapter for the versioned campaign checkpoint envelope.
var path: String
var files: Storage.FileOperations

func _init(destination: String = "user://campaign.json", operations: Storage.FileOperations = null) -> void:
	path = destination
	files = operations if operations != null else Storage.FileOperations.new()

func save(state: CampaignState, settlements: Dictionary = {}, active_manifest: Dictionary = {},
		competition: Dictionary = {}, economy: Dictionary = {}, inventory: Dictionary = {},
		personnel: Dictionary = {}, operations: Dictionary = {}) -> String:
	var checkpoint = CampaignCheckpoint.build(
		state, settlements, active_manifest, competition, economy, inventory, personnel, operations)
	if checkpoint.is_empty():
		return "Campaign state could not form a valid checkpoint."
	return save_checkpoint(checkpoint)

func save_checkpoint(checkpoint: Dictionary) -> String:
	var error = CampaignCheckpoint.validate(checkpoint)
	if not error.is_empty():
		return error
	var normalized = CampaignCheckpoint.upgrade(checkpoint)
	if normalized.is_empty():
		return "Campaign checkpoint could not be upgraded for persistence."
	return Storage.write_json(path, normalized, files)

func load() -> Dictionary:
	var result = Storage.read_json(path, files)
	if not result.ok:
		return result
	return CampaignCheckpoint.restore(result.data)
