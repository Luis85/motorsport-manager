class_name TrackEditorPort
extends RefCounted


## Application-owned file boundary. Views choose a path; adapters own I/O.
func catalog() -> Array:
	return []


func save_authoring(_document: Dictionary) -> Dictionary:
	return {"ok": false, "error": "Track storage is unavailable."}


func load_authoring(_path: String) -> Dictionary:
	return {"ok": false, "error": "Track storage is unavailable."}


func export_value(_path: String, _value: Dictionary) -> String:
	return "Track storage is unavailable."


func read_reference(_path: String) -> Dictionary:
	return {"ok": false, "error": "Reference image storage is unavailable."}
