class_name BalanceConfigValidation
extends RefCounted
## Authoring acceptance covers every shipped JSON resource, including raw diagnostic data.
## This prepares detached values only; it never publishes a live application catalog.
const ROOT = ContentPackLoader.BUILTIN_ROOT
const CIRCUITS = "circuits/catalog.json"


static func run(roots: Array = [ROOT]) -> Dictionary:
	if roots.is_empty() or roots[0] != ROOT:
		return _failure("pack.json", "CONTENT_ROOT", "Validate the built-in config first.")
	var parent = DirAccess.open(ROOT.get_base_dir())
	if parent == null or parent.is_link(ROOT.get_file()):
		return _failure("", "CONTENT_LINK", "The config root cannot be a symbolic link.")
	var loader = ContentPackLoader.new()
	var loaded = loader.load_packs(roots)
	if not loaded.ok:
		return _rejected(loaded)
	var raw = ContentPackLoader.new()
	var manifest = raw._read(ROOT, "pack.json")
	if not manifest.ok:
		return _rejected(manifest)
	var expected: Dictionary = {"pack.json": true}
	for path in manifest.data.files:
		expected[path] = true
	var circuits = _circuits(raw, expected)
	if not circuits.ok:
		return _rejected(circuits)
	var scenarios = _scenarios(loader, circuits.ids, expected)
	if not scenarios.ok:
		return _rejected(scenarios)
	var scanned = _scan("", {}, [0])
	if not scanned.ok:
		return _rejected(scanned)
	for path in scanned.files:
		if not expected.has(path):
			return _failure(path, "CONTENT_UNLISTED", "Every config JSON file must be consumed.")
	for path in expected:
		if path not in scanned.files:
			return _failure(path, "CONTENT_READ", "A required config JSON file is missing.")
	return {
		"ok": true,
		"config_validated": true,
		"diagnostics": [],
		"config_files": expected.size(),
		"files": loader._files,
		"bytes": loader._bytes
	}


static func _circuits(loader: ContentPackLoader, expected: Dictionary) -> Dictionary:
	var index = loader._read(ROOT, CIRCUITS)
	if not index.ok:
		return index
	var schema = ContentSchema.object(
		{
			"kind": {"enum": ["motorsport-manager-track-catalog"]},
			"version": {"enum": [1]},
			"files": ContentSchema.array(ContentSchema.text(200), 64, 1)
		}
	)
	var errors = ContentValidation.check(index.data, schema)
	if not errors.is_empty():
		return ContentPackLoader._context(errors, ROOT, CIRCUITS)
	expected[CIRCUITS] = true
	var ids: Dictionary = {}
	for filename in index.data.files:
		var path = "circuits/" + filename
		if filename.contains("/") or filename.contains("\\") or filename.contains(".."):
			return _failure(CIRCUITS, "CONTENT_PATH", "List adjacent circuit JSON filenames.")
		if expected.has(path):
			return _failure(CIRCUITS, "CONTENT_DUPLICATE_FILE", "A circuit is listed twice.")
		expected[path] = true
		var read = loader._read(ROOT, path)
		if not read.ok:
			return read
		var problems = TrackDocument.validate(read.data)
		if not problems.is_empty():
			return _failure(path, "CONTENT_CIRCUIT", "\n".join(problems))
		var id: Variant = read.data.get("id")
		if not id is String or id.is_empty() or ids.has(id):
			return _failure(path, "CONTENT_DOCUMENT_ID", "Raw circuit IDs must be unique strings.")
		ids[id] = true
	# Exercise the retained raw library adapter as well as the strict content reader.
	# Validating before normalization prevents editor repair from hiding invalid input.
	var library = Storage.read_catalog()
	if not library.ok:
		return _failure(CIRCUITS, "CONTENT_CATALOG", library.error)
	for document in library.data:
		var problems = TrackDocument.validate(document)
		if not problems.is_empty():
			return _failure(CIRCUITS, "CONTENT_CIRCUIT", "\n".join(problems))
	return {"ok": true, "ids": ids}


static func _scenarios(
	loader: ContentPackLoader, ids: Dictionary, expected: Dictionary
) -> Dictionary:
	for family in ScenarioCatalog.PATHS:
		var path: String = ScenarioCatalog.PATHS[family].trim_prefix(ROOT + "/")
		if expected.has(path):
			return _failure(path, "CONTENT_DUPLICATE_FILE", "A config file has multiple consumers.")
		expected[path] = true
		# Continue the production loader's original byte/file budget: diagnostic
		# resources are additional consumed files, not a second unbounded allowance.
		var read = loader._read(ROOT, path)
		if not read.ok:
			return read
		if (
			not read.data is Dictionary
			or not RaceCheckpoint.integral(read.data.get("version"), 1, 1)
			or ScenarioCatalog.validate_collection(read.data, family).is_empty()
		):
			return _failure(
				path, "CONTENT_SCENARIO_COLLECTION", "Invalid " + family + " collection."
			)
		for index in range(read.data.scenarios.size()):
			var recipe: Dictionary = read.data.scenarios[index]
			if not ids.has(recipe.track):
				return _failure(
					path,
					"CONTENT_REFERENCE",
					"Choose a shipped circuit for this diagnostic recipe.",
					"/scenarios/%d/track" % index
				)
	return {"ok": true}


static func _scan(relative: String, seen: Dictionary, budget: Array, depth: int = 0) -> Dictionary:
	if depth > ContentJson.MAX_DEPTH:
		return _failure(relative, "CONTENT_LIMIT", "Config directories exceed the nesting limit.")
	var directory = DirAccess.open(ROOT.path_join(relative))
	if directory == null:
		return _failure(relative, "CONTENT_ROOT", "The config directory is unavailable.")
	directory.include_hidden = true
	var files: Array[String] = []
	if directory.list_dir_begin() != OK:
		return _failure(relative, "CONTENT_READ", "The config directory could not be listed.")
	var name = directory.get_next()
	while not name.is_empty():
		var path = relative.path_join(name)
		budget[0] += 1
		if budget[0] > ContentPackLoader.MAX_FILES:
			return _failure(path, "CONTENT_LIMIT", "Config exceeds the entry-count limit.")
		if directory.is_link(name):
			return _failure(path, "CONTENT_LINK", "Config entries cannot be symbolic links.")
		var key = path.to_lower()
		if seen.has(key):
			return _failure(
				path, "CONTENT_DUPLICATE_FILE", "Config paths must be unique ignoring case."
			)
		seen[key] = true
		if directory.current_is_dir():
			var child = _scan(path, seen, budget, depth + 1)
			if not child.ok:
				return child
			files.append_array(child.files)
		elif name.to_lower().ends_with(".json"):
			files.append(path)
		name = directory.get_next()
	directory.list_dir_end()
	return {"ok": true, "files": files}


static func _failure(file: String, code: String, message: String, field: String = "") -> Dictionary:
	return _rejected(
		ContentPackLoader._context([ContentValidation.diagnostic(code, field, message)], ROOT, file)
	)


static func _rejected(result: Dictionary) -> Dictionary:
	result["config_validated"] = false
	return result
