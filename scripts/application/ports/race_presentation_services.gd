class_name RacePresentationServices
extends RefCounted
## UI-facing infrastructure port. No filesystem, autoload or rendering dependency.
## Unconfigured services fail visibly rather than claiming to save data.
var preferences: Dictionary:
	get:
		return get_preferences()


func get_preferences() -> Dictionary:
	return {
		"labels": true,
		"racing_line": false,
		"reduced_motion": false,
		"pitwall_text_scale": 1.0,
		"pitwall_layout": "minimal",
		"guides": {}
	}


func save_guide(_flow: String, _step: int) -> String:
	return "Guide storage is unavailable."


func set_layout(_layout: String) -> String:
	return "Preferences storage is unavailable."


func save_live() -> String:
	return "Weekend storage is unavailable."


func save_record(_record: RaceRecord) -> String:
	return "Weekend storage is unavailable."


func accept_record(_record: RaceRecord) -> Dictionary:
	return {"ok": false, "message": "Results storage is unavailable."}


func export_value(_path: String, _data: Dictionary) -> String:
	return "Export storage is unavailable."


func notebook(_path: String = NotebookPort.PATH) -> NotebookPort:
	return NotebookPort.new()
