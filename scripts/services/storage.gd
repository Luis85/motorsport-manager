class_name Storage
extends RefCounted
## Atomic replacement with a recoverable .bak copy. Never silently overwrite corrupt input.
const MAX_BYTES = 16000000
static func read_json(path: String) -> Dictionary:
	var file = FileAccess.open(path, FileAccess.READ)
	if file == null: return {"ok": false, "error": "Cannot open %s (%s)." % [path, error_string(FileAccess.get_open_error())]}
	if file.get_length() > MAX_BYTES: return {"ok": false, "error": "File exceeds 16 MB."}
	var parser = JSON.new()
	var err = parser.parse(file.get_as_text())
	if err != OK: return {"ok": false, "error": "JSON line %d: %s" % [parser.get_error_line(), parser.get_error_message()]}
	return {"ok": true, "data": parser.data}

static func write_json(path: String, data: Variant) -> String:
	var absolute = ProjectSettings.globalize_path(path)
	var err = DirAccess.make_dir_recursive_absolute(absolute.get_base_dir())
	if err != OK: return "Cannot create destination folder: " + error_string(err)
	var temporary = absolute + ".tmp"
	var text = JSON.stringify(data, "\t", false, true)
	if text.to_utf8_buffer().size() > MAX_BYTES: return "Export exceeds 16 MB. Reduce retained evidence or reference-image size."
	var file = FileAccess.open(temporary, FileAccess.WRITE)
	if file == null: return "Cannot write destination: " + error_string(FileAccess.get_open_error())
	file.store_string(text); file.flush()
	var write_error = file.get_error(); file.close()
	if write_error != OK: return "Disk write failed: " + error_string(write_error)
	if FileAccess.file_exists(absolute):
		var backup = absolute + ".bak"
		if FileAccess.file_exists(backup): DirAccess.remove_absolute(backup)
		err = DirAccess.rename_absolute(absolute, backup)
		if err != OK: return "Could not preserve previous file: " + error_string(err)
	err = DirAccess.rename_absolute(temporary, absolute)
	if err != OK:
		if FileAccess.file_exists(absolute + ".bak"): DirAccess.rename_absolute(absolute + ".bak", absolute)
		return "Atomic replacement failed: " + error_string(err)
	return ""

static func read_catalog() -> Dictionary:
	var manifest = read_json("res://data/tracks/catalog.json")
	if not manifest.ok: return manifest
	var data = manifest.data
	if not data is Dictionary or data.get("kind") != "motorsport-manager-track-catalog" or data.get("version") != 1:
		return {"ok": false, "error": "Unsupported bundled track catalog."}
	if not data.get("files") is Array or data.files.is_empty() or data.files.size() > 64:
		return {"ok": false, "error": "Bundled catalog must list 1–64 track files."}
	var tracks: Array = []
	for name in data.files:
		if not name is String or not name.ends_with(".json") or name.contains("/") or name.contains("\\") or name.contains(".."):
			return {"ok": false, "error": "Invalid bundled track filename."}
		var result = read_json("res://data/tracks/" + name)
		if not result.ok: return result
		tracks.append(result.data)
	return {"ok": true, "data": tracks}
