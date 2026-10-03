class_name Storage
extends RefCounted
## JSON decoding and recoverable replacement. Domain validators own schema acceptance.
const MAX_BYTES = 16000000


class FileOperations:
	extends RefCounted

	## Narrow local filesystem seam. Tests inject failures without changing policy.
	func read_text(path: String, maximum_bytes: int) -> Dictionary:
		var file = FileAccess.open(path, FileAccess.READ)
		if file == null:
			return {
				"ok": false,
				"error": "Cannot open %s (%s)." % [path, error_string(FileAccess.get_open_error())]
			}
		if file.get_length() > maximum_bytes:
			file.close()
			return {"ok": false, "error": "File exceeds 16 MB."}
		var text = file.get_as_text()
		var err = file.get_error()
		file.close()
		if err != OK and err != ERR_FILE_EOF:
			return {"ok": false, "error": "Disk read failed: " + error_string(err)}
		return {"ok": true, "text": text}

	func write_text(path: String, text: String) -> String:
		var file = FileAccess.open(path, FileAccess.WRITE)
		if file == null:
			return "Cannot write destination: " + error_string(FileAccess.get_open_error())
		file.store_string(text)
		file.flush()
		var err = file.get_error()
		file.close()
		return "" if err == OK else "Disk write failed: " + error_string(err)

	func make_directory(path: String) -> Error:
		return DirAccess.make_dir_recursive_absolute(path)

	func exists(path: String) -> bool:
		return FileAccess.file_exists(path)

	func remove(path: String) -> Error:
		return DirAccess.remove_absolute(path)

	func rename(source: String, destination: String) -> Error:
		return DirAccess.rename_absolute(source, destination)


static func read_json(path: String, files: FileOperations = null) -> Dictionary:
	if files == null:
		files = FileOperations.new()
	var result = files.read_text(path, MAX_BYTES)
	if not result.ok:
		return result
	var parser = JSON.new()
	var err = parser.parse(result.text)
	if err != OK:
		return {
			"ok": false,
			"error": "JSON line %d: %s" % [parser.get_error_line(), parser.get_error_message()]
		}
	if (
		parser.data is Dictionary
		and (
			parser.data.get("kind")
			in [
				"motorsport-manager-session",
				"motorsport-manager-replay",
				"motorsport-manager-weekend",
				"motorsport-manager-scenario",
				"motorsport-manager-reproduction",
				"motorsport-manager-weekend-result",
				"motorsport-manager-circuit-notebook",
				"motorsport-manager-result-receipts",
				"motorsport-manager-campaign-checkpoint"
			]
		)
	):
		# Preserve the exact decimal values written by full-precision serialization.
		# Legacy content/track import keeps its original numerical contract. Neither
		# live values nor existing integrity hashes are quantized or rewritten.
		var precise = ContentJson.parse(result.text, true)
		if not precise.ok:
			return {"ok": false, "error": "JSON line %d: %s" % [precise.line, precise.error]}
		return {"ok": true, "data": precise.data}
	return {"ok": true, "data": parser.data}


static func write_json(path: String, data: Variant, files: FileOperations = null) -> String:
	# Complete serialization before any filesystem mutation. No schema migration here.
	var text = JSON.stringify(data, "\t", false, true)
	if text.to_utf8_buffer().size() > MAX_BYTES:
		return "Export exceeds 16 MB. Reduce retained evidence or reference-image size."
	if files == null:
		files = FileOperations.new()
	var absolute = ProjectSettings.globalize_path(path)
	var temporary = absolute + ".tmp"
	var backup = absolute + ".bak"
	var err = files.make_directory(absolute.get_base_dir())
	if err != OK:
		return "Cannot create destination folder: " + error_string(err)
	var write_error = files.write_text(temporary, text)
	if not write_error.is_empty():
		return write_error
	var preserved_current = false
	if files.exists(absolute):
		if files.exists(backup):
			err = files.remove(backup)
			if err != OK:
				return "Could not remove previous backup: " + error_string(err)
		err = files.rename(absolute, backup)
		if err != OK:
			return "Could not preserve previous file: " + error_string(err)
		preserved_current = true
	err = files.rename(temporary, absolute)
	if err != OK:
		var message = "Atomic replacement failed: " + error_string(err)
		# Only restore the file moved by THIS attempt, never a stale unrelated .bak.
		if preserved_current:
			var recovery_error = files.rename(backup, absolute)
			if recovery_error != OK:
				return (
					message
					+ (
						(
							". Rollback failed: %s. Previous saved data remains at %s; do not "
							+ "delete it."
						)
						% [error_string(recovery_error), backup]
					)
				)
		return message
	return ""


static func read_catalog() -> Dictionary:
	var manifest = read_json("res://data/tracks/catalog.json")
	if not manifest.ok:
		return manifest
	var data = manifest.data
	if (
		not data is Dictionary
		or data.get("kind") != "motorsport-manager-track-catalog"
		or data.get("version") != 1
	):
		return {"ok": false, "error": "Unsupported bundled track catalog."}
	if not data.get("files") is Array or data.files.is_empty() or data.files.size() > 64:
		return {"ok": false, "error": "Bundled catalog must list 1–64 track files."}
	var tracks: Array = []
	for name in data.files:
		if (
			not name is String
			or not name.ends_with(".json")
			or name.contains("/")
			or name.contains("\\")
			or name.contains("..")
		):
			return {"ok": false, "error": "Invalid bundled track filename."}
		var result = read_json("res://data/tracks/" + name)
		if not result.ok:
			return result
		tracks.append(result.data)
	return {"ok": true, "data": tracks}
