class_name CircuitNotebook
extends RefCounted
## Explicit opt-in local history. Never called by physics, AI or the forecaster.
const KIND = "motorsport-manager-circuit-notebook"
const PATH = "user://circuit-notebook.json"
const MAX_ENTRIES = 128

static func empty() -> Dictionary:
	return {"kind": KIND, "version": 1, "entries": []}

static func valid(data: Variant) -> bool:
	if not data is Dictionary or data.size() != 3 or not data.get("kind") is String or data.kind != KIND: return false
	if not RaceCheckpoint.integral(data.get("version"), 1, 1) or not data.get("entries") is Array or data.entries.size() > MAX_ENTRIES: return false
	var seen = {}
	for entry in data.entries:
		if not NotebookEntry.validate(entry): return false
		var id = entry.facts.event_id
		if seen.has(id): return false
		seen[id] = true
	return true

static func read(path: String = PATH) -> Dictionary:
	if not FileAccess.file_exists(path): return {"ok": true, "data": empty()}
	var result = Storage.read_json(path)
	if result.ok and not valid(result.data): return failure("Notebook is invalid or unsupported. The file was not replaced; inspect its backup.")
	return result

static func remember(record: RaceRecord, path: String = PATH) -> Dictionary:
	var entry = NotebookEntry.build(record)
	if entry.is_empty() or not NotebookEntry.validate(entry): return failure("Complete a valid weekend before remembering its observed result.")
	var result = read(path)
	if not result.ok: return result
	for old in result.data.entries:
		if old.facts.event_id != entry.facts.event_id: continue
		if old.digest != entry.digest: return failure("This event already has different remembered facts. The existing entry and note were kept.")
		return {"ok": true, "already_recorded": true, "entry": old.duplicate(true)}
	if result.data.entries.size() >= MAX_ENTRIES: return failure("Notebook is full (128 runs). Export it, then explicitly forget an entry. Nothing was evicted.")
	result.data.entries.append(entry)
	var error = Storage.write_json(path, result.data)
	if not error.is_empty(): return failure(error)
	return {"ok": true, "already_recorded": false, "entry": entry.duplicate(true)}

static func save_note(id: String, note: String, revision: int, path: String = PATH) -> Dictionary:
	if note.length() > NotebookEntry.MAX_NOTE: return failure("Keep your note within 1,200 characters. The draft was not saved.")
	return change(id, revision, note, false, path)

static func forget(id: String, revision: int, path: String = PATH) -> Dictionary:
	return change(id, revision, "", true, path)

static func change(id: String, revision: int, note: String, remove: bool, path: String) -> Dictionary:
	var result = read(path)
	if not result.ok: return result
	for index in range(result.data.entries.size()):
		var entry = result.data.entries[index]
		if entry.facts.event_id != id: continue
		if int(entry.revision) != revision: return failure("This note changed since it was opened. Your draft is retained; reopen the notebook to review the saved version.")
		if remove: result.data.entries.remove_at(index)
		else:
			if entry.note == note: return {"ok": true, "entry": entry.duplicate(true)}
			if revision >= 1000000: return failure("Note revision limit reached. Export this record before making a new entry.")
			entry.note = note; entry.revision += 1
		var error = Storage.write_json(path, result.data)
		if not error.is_empty(): return failure(error)
		return {"ok": true, "entry": {} if remove else entry.duplicate(true)}
	return failure("The selected run no longer exists. Your draft was not saved.")

static func failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}
