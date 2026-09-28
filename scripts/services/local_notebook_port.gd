class_name LocalNotebookPort
extends NotebookPort
var _path: String
func _init(path: String = NotebookPort.PATH) -> void:
	_path = path
func read() -> Dictionary:
	return CircuitNotebook.read(_path)
func remember(record: RaceRecord) -> Dictionary:
	return CircuitNotebook.remember(record, _path)
func save_note(id: String, note: String, revision: int) -> Dictionary:
	return CircuitNotebook.save_note(id, note, revision, _path)
func forget(id: String, revision: int) -> Dictionary:
	return CircuitNotebook.forget(id, revision, _path)
