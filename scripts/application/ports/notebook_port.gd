class_name NotebookPort
extends RefCounted
## History persistence boundary. Read-only facts and editable notes remain separate.
const PATH = "user://circuit-notebook.json"
const MAX_ENTRIES = 128
static func empty() -> Dictionary:
	return {"kind": "motorsport-manager-circuit-notebook", "version": 1, "entries": []}
func read() -> Dictionary:
	return {"ok": false, "error": "Notebook storage is unavailable."}
func remember(_record: RaceRecord) -> Dictionary:
	return {"ok": false, "error": "Notebook storage is unavailable."}
func save_note(_id: String, _note: String, _revision: int) -> Dictionary:
	return {"ok": false, "error": "Notebook storage is unavailable."}
func forget(_id: String, _revision: int) -> Dictionary:
	return {"ok": false, "error": "Notebook storage is unavailable."}
