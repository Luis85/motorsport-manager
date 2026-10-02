class_name LocalRacePresentationServices
extends RacePresentationServices
## Composition supplies an application owner; views never resolve a singleton.
var _owner: WeakRef
func _init(owner: Node) -> void:
	_owner = weakref(owner)
func get_preferences() -> Dictionary:
	var owner = _owner.get_ref()
	return owner.settings.duplicate(true) if owner else super.get_preferences()
func save_guide(flow: String, step: int) -> String:
	var owner = _owner.get_ref()
	if owner == null: return "The application is closed."
	var next = owner.settings.duplicate(true)
	if not next.has("guides"): next.guides = {}
	next.guides[flow] = step
	var error = Storage.write_json("user://settings.json", next)
	if error.is_empty(): owner.settings = next
	return error
func set_layout(layout: String) -> String:
	var owner = _owner.get_ref()
	if owner == null: return "The application is closed."
	if layout not in ["minimal", "engineering", "director"]: return "Unsupported workspace."
	var previous = owner.settings.duplicate(true)
	owner.settings.pitwall_layout = layout
	if layout in ["director", "engineering"]: owner.settings.advanced_pitwall_layout = layout
	var error: String = owner.save_settings()
	if not error.is_empty(): owner.settings = previous
	return error
func save_live() -> String:
	var owner = _owner.get_ref()
	return owner.save_weekend() if owner else "The application is closed."
func save_record(record: RaceRecord) -> String:
	var owner = _owner.get_ref()
	if owner == null or record == null: return "The weekend is unavailable."
	return ReplayStorage.save_session(owner.sandbox_path if record.origin == "sandbox" else owner.checkpoint_path, record)
func accept_record(record: RaceRecord) -> Dictionary:
	if record == null or record.origin == "sandbox":
		return {"ok": false, "message": "Sandbox results cannot be accepted as an original."}
	var error = save_record(record)
	return ResultReceipts.accept(record) if error.is_empty() else {"ok": false, "message": error}
func export_value(path: String, data: Dictionary) -> String:
	return Storage.write_json(path, data.duplicate(true))
func notebook(path: String = NotebookPort.PATH) -> NotebookPort:
	return LocalNotebookPort.new(path)