class_name ContentPackLoader
extends RefCounted
## Folder packs only. All paths are relative, bounded and non-executable.
const MAX_FILE_BYTES = 1048576
const MAX_TOTAL_BYTES = 16777216
const MAX_PACKS = 32
const MAX_FILES = 2048
var _bytes: int = 0
var _files: int = 0

func load_packs(roots: Array) -> Dictionary:
	_bytes = 0
	_files = 0
	var candidate = ContentCatalog.new()
	var errors: Array = []
	var versions: Dictionary = {}
	if roots.size() > MAX_PACKS:
		return _failure("", "", "CONTENT_LIMIT", "Too many selected packs.")
	for root_value in roots:
		if not root_value is String:
			return _failure("", "", "CONTENT_PATH", "Pack roots must be paths.")
		var root: String = root_value
		var read = _read(root, "pack.json")
		if not read.ok: return read
		var manifest: Variant = read.data
		errors = ContentVersions.errors(manifest, true)
		if not errors.is_empty(): return _context(errors, root, "pack.json")
		errors = ContentValidation.check(manifest, ContentSchema.manifest())
		if not errors.is_empty(): return _context(errors, root, "pack.json")
		if versions.has(manifest.id):
			return _failure(root, "pack.json", "CONTENT_DUPLICATE_PACK", "Pack ID is already selected.")
		var dependencies: Dictionary = {}
		for dependency in manifest.dependencies:
			if dependency.id == manifest.id or dependencies.has(dependency.id):
				return _failure(root, "pack.json", "CONTENT_DEPENDENCY", "A dependency must be unique and cannot name its own pack: " + dependency.id)
			dependencies[dependency.id] = true
			if versions.get(dependency.id, "") != dependency.version:
				return _failure(root, "pack.json", "CONTENT_DEPENDENCY", "Load dependency " + dependency.id + " @ " + dependency.version + " first.")
		var overrides: Dictionary = {}
		for override in manifest.overrides:
			if overrides.has(override.id):
				return _failure(root, "pack.json", "CONTENT_OVERRIDE", "Duplicate override declaration.")
			overrides[override.id] = override.expected_sha256
		var seen_paths: Dictionary = {}
		var seen_ids: Dictionary = {}
		for path in manifest.files:
			if seen_paths.has(path.to_lower()):
				return _failure(root, path, "CONTENT_DUPLICATE_FILE", "A manifest cannot list a file twice.")
			seen_paths[path.to_lower()] = true
			read = _read(root, path)
			if not read.ok: return read
			if not read.data is Dictionary:
				return _failure(root, path, "CONTENT_TYPE", "Each definition file must contain an object.")
			var id = str(read.data.get("id", ""))
			if seen_ids.has(id):
				return _failure(root, path, "CONTENT_DUPLICATE_ID", "A pack cannot define an ID twice.")
			seen_ids[id] = true
			if not overrides.has(id) and not id.begins_with(manifest.id + "."):
				return _failure(root, path, "CONTENT_NAMESPACE", "New definitions must use the pack's ID prefix.")
			errors = candidate.add(read.data, {"pack": manifest.id, "version": manifest.version,
				"root": root, "file": path}, overrides.get(id, ""))
			if not errors.is_empty(): return _context(errors, root, path)
		if root == "res://content/packs/core":
			errors = BundledContentDocuments.load_into(self, candidate, manifest.version)
			if not errors.is_empty():
				return _context(errors, root, "pack.json")
		for id in overrides:
			if not seen_ids.has(id):
				return _failure(root, "pack.json", "CONTENT_OVERRIDE", "Declared override has no definition file: " + id)
		versions[manifest.id] = manifest.version
	errors = candidate.seal()
	if not errors.is_empty(): return _context(errors, "", "")
	return {"ok": true, "catalog": candidate, "diagnostics": [], "bytes": _bytes, "files": _files}

func _read(root: String, relative: String) -> Dictionary:
	if relative.is_empty() or relative.is_absolute_path() or "\\" in relative or ":" in relative or not relative.ends_with(".json"):
		return _failure(root, relative, "CONTENT_PATH", "Expected a relative .json path inside the pack.")
	var directory = DirAccess.open(root)
	if directory == null:
		return _failure(root, relative, "CONTENT_ROOT", "The selected pack directory is unavailable.")
	var parts = relative.split("/", true)
	var prefix = ""
	for part in parts:
		if part in ["", ".", ".."]:
			return _failure(root, relative, "CONTENT_PATH", "Empty, dot and parent path components are not allowed.")
		prefix = part if prefix.is_empty() else prefix + "/" + part
		if directory.is_link(prefix):
			return _failure(root, relative, "CONTENT_LINK", "Pack files and subdirectories cannot be links.")
	var file = FileAccess.open(root.path_join(relative), FileAccess.READ)
	if file == null:
		return _failure(root, relative, "CONTENT_READ", "The listed content file could not be opened.")
	var length = file.get_length()
	_bytes += length
	_files += 1
	if length > MAX_FILE_BYTES or _bytes > MAX_TOTAL_BYTES or _files > MAX_FILES:
		return _failure(root, relative, "CONTENT_LIMIT", "Content exceeds the file, total-byte or file-count limit.")
	var bytes = file.get_buffer(length)
	if bytes.size() != length:
		return _failure(root, relative, "CONTENT_READ", "The complete file could not be read.")
	if not ContentJson.valid_utf8(bytes):
		return _failure(root, relative, "CONTENT_ENCODING", "Content must be valid UTF-8.")
	var parsed = ContentJson.parse(bytes.get_string_from_utf8())
	if not parsed.ok:
		var result = _failure(root, relative, "CONTENT_JSON", parsed.error)
		result.diagnostics[0].line = parsed.line
		return result
	return parsed

static func _context(errors: Array, root: String, file: String) -> Dictionary:
	for error in errors:
		if not error.has("root"): error.root = root
		if not error.has("file"): error.file = file
	return {"ok": false, "diagnostics": errors}

static func _failure(root: String, file: String, code: String, message: String) -> Dictionary:
	return _context([ContentValidation.diagnostic(code, "", message)], root, file)
