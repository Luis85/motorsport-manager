extends SceneTree
## Exercise the production replacement policy through a deterministic filesystem seam.
var checks: int = 0
var failures: Array[String] = []


class MemoryFiles:
	extends Storage.FileOperations
	var entries: Dictionary = {}
	var faults: Dictionary = {}
	var calls: Array[String] = []

	func read_text(path: String, maximum_bytes: int) -> Dictionary:
		calls.append("read:" + path)
		path = ProjectSettings.globalize_path(path)
		if faults.has("read"):
			return {"ok": false, "error": "Injected disk read failure"}
		if not entries.has(path):
			return {"ok": false, "error": "Cannot open injected missing file"}
		var text: String = entries[path]
		if text.to_utf8_buffer().size() > maximum_bytes:
			return {"ok": false, "error": "File exceeds 16 MB."}
		return {"ok": true, "text": text}

	func write_text(path: String, text: String) -> String:
		calls.append("write:" + path)
		if faults.has("write"):
			entries[path] = "partial temporary write"
			return "Injected disk write failure"
		entries[path] = text
		return ""

	func make_directory(path: String) -> Error:
		calls.append("mkdir:" + path)
		return faults.get("mkdir", OK)

	func exists(path: String) -> bool:
		return entries.has(path)

	func remove(path: String) -> Error:
		calls.append("remove:" + path)
		if faults.has("remove:" + path):
			return faults["remove:" + path]
		entries.erase(path)
		return OK

	func rename(source: String, destination: String) -> Error:
		calls.append("rename:" + source + "->" + destination)
		if faults.has("rename:" + source):
			return faults["rename:" + source]
		if not entries.has(source):
			return ERR_FILE_NOT_FOUND
		entries[destination] = entries[source]
		entries.erase(source)
		return OK


class EditorPort:
	extends TrackEditorPort
	var files: MemoryFiles
	var path: String
	var writes: int = 0

	func save_authoring(document: Dictionary) -> Dictionary:
		writes += 1
		var error = Storage.write_json(path, document, files)
		return {"ok": error.is_empty(), "error": error, "document": document.duplicate(true)}


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, label: String) -> void:
	checks += 1
	if not value:
		failures.append(label)
		push_error(label)


func run() -> void:
	json_value_contract()
	memory_round_trip()
	compact_response_contract()
	failure_stages()
	read_failures()
	editor_failure_retention()
	native_round_trip()
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/storage-contract-tests.json", report)
	print("STORAGE_CONTRACT_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func json_value_contract() -> void:
	# Independently authored JSON establishes the decode contract, not a writer echo.
	# https://docs.godotengine.org/en/stable/classes/class_json.html
	var files = MemoryFiles.new()
	var path = ProjectSettings.globalize_path("user://storage-contract-json.json")
	files.entries[path] = '{"number":1,"fraction":1.125,"enabled":true,"unset":null,"array":[1,2],"name":"track"}'
	var expected = {
		"number": 1.0,
		"fraction": 1.125,
		"enabled": true,
		"unset": null,
		"array": [1.0, 2.0],
		"name": "track"
	}
	var decoded = Storage.read_json(path, files)
	check(
		decoded.ok and decoded.data == expected,
		"Independent JSON decodes into the exact expected keys, values, types and array order"
	)
	check(
		typeof(decoded.data.number) == TYPE_FLOAT and typeof(decoded.data.array[0]) == TYPE_FLOAT,
		"Decoded JSON numbers have their documented floating-point representation"
	)
	check(
		typeof(decoded.data.enabled) == TYPE_BOOL and decoded.data.unset == null,
		"JSON Boolean and null values are not coerced into numbers"
	)
	var integer_record = {"number": 1}
	var parsed_record = JSON.parse_string('{"number":1}')
	check(
		integer_record != parsed_record and parsed_record == {"number": 1.0},
		"Strict dictionary equality distinguishes native integer records from decoded JSON records"
	)
	for key in expected:
		var missing = expected.duplicate(true)
		missing.erase(key)
		check(
			decoded.data != missing,
			"Round-trip comparison cannot conceal a missing JSON field: " + key
		)
	var extra = expected.duplicate(true)
	extra.extra = "unexpected"
	check(decoded.data != extra, "Round-trip comparison cannot conceal an extra field")
	for values in [[2.0, 1.0], [1.0, 3.0], ["1", 2.0]]:
		var changed = expected.duplicate(true)
		changed.array = values
		check(
			decoded.data != changed,
			"JSON comparison detects reordered, changed or mistyped nested values"
		)
	print(
		"STORAGE_JSON_TYPES ",
		JSON.stringify(
			{
				"native_number_type": typeof(integer_record.number),
				"decoded_number_type": typeof(parsed_record.number),
				"strict_equal": integer_record == parsed_record
			}
		)
	)


func memory_round_trip() -> void:
	var files = MemoryFiles.new()
	var path = ProjectSettings.globalize_path("user://storage-contract-memory.json")
	var first = {"version": 1, "nested": {"values": [1, "unchanged"]}}
	# JSON numbers decode as floats; strict collection equality preserves that type.
	var expected = {"version": 1.0, "nested": {"values": [1.0, "unchanged"]}}
	check(
		Storage.write_json(path, first, files).is_empty(),
		"First publication succeeds without a previous file"
	)
	check(
		files.exists(path) and not files.exists(path + ".bak"),
		"A first save does not invent a backup"
	)
	var saved: String = files.entries[path]
	check(
		Storage.write_json(path, {"version": 2}, files).is_empty(),
		"Replacement publishes the second document"
	)
	check(
		files.entries[path + ".bak"] == saved,
		"Successful replacement retains the exact previous bytes"
	)
	check(not files.exists(path + ".tmp"), "Successful replacement consumes the staged file")
	var previous = Storage.read_json(path + ".bak", files)
	check(previous.ok and previous.data == expected, "The previous saved JSON remains readable")
	previous.data.nested.values[0] = 99
	check(
		Storage.read_json(path + ".bak", files).data == expected,
		"Read results cannot mutate persisted values"
	)
	check(
		Storage.read_json(path, files).data == {"version": 2.0},
		"Current and backup state remain distinct"
	)


func failure_stages() -> void:
	var path = ProjectSettings.globalize_path("user://storage-contract-memory.json")
	var original = JSON.stringify({"revision": 1})
	var stale = JSON.stringify({"revision": 0})
	var stages = {
		"mkdir": "Cannot create destination folder",
		"write": "Injected disk write failure",
		"remove:" + path + ".bak": "Could not remove previous backup",
		"rename:" + path: "Could not preserve previous file",
		"rename:" + path + ".tmp": "Atomic replacement failed"
	}
	for stage in stages:
		var files = MemoryFiles.new()
		files.entries[path] = original
		files.entries[path + ".bak"] = stale
		files.faults[stage] = ERR_FILE_CANT_WRITE
		var error = Storage.write_json(path, {"revision": 2}, files)
		check(
			error.contains(stages[stage]),
			"Each failed filesystem stage reports its specific cause: " + stage
		)
		check(
			files.entries.get(path) == original,
			"A recoverable failure retains the last saved file: " + stage
		)
		check(
			Storage.read_json(path, files).data.revision == 1,
			"Failed publication never exposes staged JSON as saved data"
		)
		var attempted_rollback = files.calls.has("rename:" + path + ".bak->" + path)
		check(
			attempted_rollback == (stage == "rename:" + path + ".tmp"),
			"Rollback occurs only after this attempt preserved the current file"
		)
	var absent = MemoryFiles.new()
	absent.entries[path + ".bak"] = stale
	absent.faults["rename:" + path + ".tmp"] = ERR_FILE_CANT_WRITE
	check(
		not Storage.write_json(path, {"revision": 2}, absent).is_empty(),
		"Failed first save is rejected even when an old backup exists"
	)
	check(
		not absent.exists(path) and absent.entries[path + ".bak"] == stale,
		"A stale backup cannot become an unintended active file"
	)
	check(
		not absent.calls.has("rename:" + path + ".bak->" + path),
		"No rollback is attempted for an original that never existed"
	)
	var blocked = MemoryFiles.new()
	blocked.entries[path] = original
	blocked.faults["rename:" + path + ".tmp"] = ERR_FILE_CANT_WRITE
	blocked.faults["rename:" + path + ".bak"] = ERR_FILE_CANT_WRITE
	var recovery_error = Storage.write_json(path, {"revision": 2}, blocked)
	check(
		recovery_error.contains("Rollback failed") and recovery_error.contains(path + ".bak"),
		"An unrecoverable replacement names the retained recovery file"
	)
	check(
		not blocked.exists(path) and blocked.entries[path + ".bak"] == original,
		"A failed rollback retains previous data rather than overwriting its backup"
	)
	check(
		blocked.exists(path + ".tmp"),
		"Failed replacement keeps staged data separate from the last valid backup"
	)
	var oversized = MemoryFiles.new()
	check(
		Storage.write_json(path, "x".repeat(Storage.MAX_BYTES), oversized).contains(
			"exceeds 16 MB"
		),
		"Write size bound includes serialized UTF-8 bytes"
	)
	check(
		oversized.calls.is_empty(), "Oversized writes are rejected before any filesystem mutation"
	)


func read_failures() -> void:
	var files = MemoryFiles.new()
	var path = ProjectSettings.globalize_path("user://storage-contract-memory.json")
	check(not Storage.read_json(path, files).ok, "Open failure is an explicit outcome")
	files.entries[path] = "{}"
	files.faults["read"] = true
	var result = Storage.read_json(path, files)
	check(
		not result.ok and result.error.contains("read failure"),
		"Read failure is propagated before decoding"
	)
	files.faults.clear()
	files.entries[path] = "{malformed"
	result = Storage.read_json(path, files)
	check(
		not result.ok and result.error.contains("JSON line"),
		"Structural decoding reports malformed JSON"
	)
	files.entries[path] = "42"
	result = Storage.read_json(path, files)
	check(
		result.ok and result.data == 42,
		"JSON decoding does not pretend to validate a domain schema"
	)
	files.entries[path] = "x".repeat(Storage.MAX_BYTES + 1)
	check(not Storage.read_json(path, files).ok, "Injected reads obey the existing byte bound")


func editor_failure_retention() -> void:
	var session = TrackEditorSession.new(TrackEditorSession.blank_document())
	var port = EditorPort.new()
	port.files = MemoryFiles.new()
	port.path = ProjectSettings.globalize_path("user://storage-contract-editor.json")
	check(
		session.save(port, session.read_document(), session.revision).ok,
		"Editor fixture persists its initial authoring state through the production policy"
	)
	var saved_bytes: String = port.files.entries[port.path]
	var signature = session.saved_signature()
	var draft = session.read_document()
	draft.name = "Editable work"
	check(session.commit(draft, session.revision), "First editor transaction commits")
	draft = session.read_document()
	draft.name = "Redo branch"
	check(
		session.commit(draft, session.revision), "Second editor transaction creates redoable work"
	)
	draft = session.undo()
	var observed_revision = session.revision
	var history = session.history()
	port.files.faults["rename:" + port.path + ".tmp"] = ERR_FILE_CANT_WRITE
	var result = session.save(port, draft, observed_revision)
	check(
		not result.ok and result.error.contains("Atomic replacement failed"),
		"Filesystem replacement failure reaches the editor transaction result"
	)
	check(
		port.files.entries[port.path] == saved_bytes,
		"Failed editor save preserves the exact last valid saved bytes"
	)
	check(
		session.read_document() == draft and session.saved_signature() == signature,
		"Failed editor save retains editable work without marking it saved"
	)
	check(
		session.history() == history and session.revision == observed_revision,
		"A failed no-op save cannot destroy redo or invent a revision"
	)
	check(
		session.cancel() == draft and session.history() == history,
		"Cancel after a failed save retains the redo branch"
	)
	port.files.faults.clear()
	check(
		session.save(port, draft, observed_revision).ok,
		"Retry uses retained work after the filesystem recovers"
	)
	var expected_json = JSON.parse_string(JSON.stringify(draft, "", false, true))
	check(
		Storage.read_json(port.path, port.files).data == expected_json,
		"Successful retry writes exactly the retained authoring document"
	)
	check(
		port.files.entries[port.path] == JSON.stringify(draft, "\t", false, true),
		"Successful retry retains every submitted field in the full-precision serialized bytes"
	)
	check(
		session.saved_signature() == JSON.stringify(draft),
		"Only successful retry updates the saved signature"
	)
	var writes = port.writes
	check(
		not session.save(port, draft, observed_revision).ok and port.writes == writes,
		"Successful publication invalidates the prior observed save revision"
	)


func compact_response_contract() -> void:
	var path: String = ProjectSettings.globalize_path("user://storage-compact.json")
	var document: Dictionary = {"z": 9007199254740993, "a": "Ω"}
	var expected: String = '{"a":"Ω","z":9007199254740993}'
	var limit: int = expected.to_utf8_buffer().size()
	for bound in [0, limit - 1, expected.length()]:
		var files := MemoryFiles.new()
		files.entries[path] = "original"
		check(
			not Storage.write_compact_json(path, document, bound, files).is_empty(),
			"Compact byte limit rejects before publication"
		)
		check(files.calls.is_empty(), "Rejected compact export performs no filesystem mutation")
		check(files.entries == {path: "original"}, "Rejected compact export retains original")
	var files := MemoryFiles.new()
	files.entries[path] = "original"
	check(
		Storage.write_compact_json(path, document, limit, files).is_empty(),
		"Compact export accepts the exact UTF-8 byte boundary"
	)
	check(files.entries[path] == expected, "Compact response preserves exact int64 and sorted JSON")
	check(files.entries[path + ".bak"] == "original", "Compact response preserves prior backup")
	files.calls.clear()
	files.faults["rename:" + path + ".tmp"] = ERR_CANT_CREATE
	check(
		not Storage.write_compact_json(path, {"next": true}, limit, files).is_empty(),
		"Compact response propagates replacement failure"
	)
	check(files.entries[path] == expected, "Compact response rolls back a failed replacement")


func native_round_trip() -> void:
	# Real Godot filesystem operations use only this isolated suite's user:// folder.
	var path = ProjectSettings.globalize_path("user://storage-contract-native/value.json")
	check(
		Storage.write_json(path, {"revision": 1}).is_empty(),
		"Native filesystem creates the first saved file"
	)
	check(
		Storage.write_json(path, {"revision": 2}).is_empty(),
		"Native filesystem replaces the saved file"
	)
	check(Storage.read_json(path).data == {"revision": 2.0}, "Native current-file JSON round trip")
	check(
		Storage.read_json(path + ".bak").data == {"revision": 1.0},
		"Native backup preserves prior JSON"
	)
	check(
		not Storage.read_json(path + ".missing").ok,
		"Native missing-file error is returned without replacing any state"
	)
	var oversized_path = path + ".oversized"
	var file = FileAccess.open(oversized_path, FileAccess.WRITE)
	check(file != null, "Native read-bound fixture is writable")
	if file != null:
		file.store_string("x".repeat(Storage.MAX_BYTES + 1))
		file.close()
		var result = Storage.read_json(oversized_path)
		check(
			not result.ok and result.error.contains("exceeds 16 MB"),
			"Native reader enforces the size bound before parsing"
		)
	for owned_path in [path, path + ".bak", path + ".tmp", oversized_path]:
		if FileAccess.file_exists(owned_path):
			DirAccess.remove_absolute(owned_path)
