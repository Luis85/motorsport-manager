class_name CampaignStorage
extends RefCounted
## Concrete atomic JSON adapter for the versioned campaign checkpoint envelope.
var path: String
var files: Storage.FileOperations

func _init(destination: String = "user://campaign.json", operations: Storage.FileOperations = null) -> void:
	path = destination
	files = operations if operations != null else Storage.FileOperations.new()

func save(state: CampaignState, settlements: Dictionary = {}, active_manifest: Dictionary = {}) -> String:
	var checkpoint = CampaignCheckpoint.build(state, settlements, active_manifest)
	if checkpoint.is_empty():
		return "Campaign state could not form a valid checkpoint."
	return Storage.write_json(path, checkpoint, files)

func load() -> Dictionary:
	var result = Storage.read_json(path, files)
	if not result.ok:
		return result
	return CampaignCheckpoint.restore(result.data)
