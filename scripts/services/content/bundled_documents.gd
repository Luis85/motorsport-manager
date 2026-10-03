class_name BundledContentDocuments
extends RefCounted
## Keep one authoritative copy of the existing track/scenario JSON files.
## Only the trusted built-in pack can import these fixed resource directories.
## External packs use ordinary circuit/scenario definitions under their own root.


static func load_into(loader: ContentPackLoader, catalog: ContentCatalog, version: String) -> Array:
	var root = "res://config/circuits"
	var index = loader._read(root, "catalog.json")
	if not index.ok:
		return index.diagnostics
	if (
		not index.data is Dictionary
		or index.data.get("kind") != "motorsport-manager-track-catalog"
		or index.data.get("version") != 1
	):
		return _error(root, "catalog.json", "Unsupported bundled circuit catalog.")
	if (
		not index.data.get("files") is Array
		or index.data.files.is_empty()
		or index.data.files.size() > 64
	):
		return _error(root, "catalog.json", "The circuit catalog must list 1–64 files.")
	var seen: Dictionary = {}
	for filename in index.data.files:
		if not filename is String or seen.has(filename.to_lower()):
			return _error(root, "catalog.json", "Circuit paths must be unique strings.")
		seen[filename.to_lower()] = true
		var loaded = loader._read(root, filename)
		if not loaded.ok:
			return loaded.diagnostics
		if not loaded.data is Dictionary:
			return _error(root, filename, "A circuit document must be an object.")
		var document: Dictionary = loaded.data
		var definition = {
			"kind": "circuit",
			"schema_version": 1,
			"id": "core.circuit." + str(document.get("id", "")),
			"name": str(document.get("name", "")),
			"description": "Bundled authoring circuit.",
			"document": document
		}
		var errors = catalog.add(
			definition, {"pack": "core", "version": version, "root": root, "file": filename}
		)
		if not errors.is_empty():
			return _context(errors, root, filename)
	return []


static func _error(root: String, file: String, message: String) -> Array:
	return _context([ContentValidation.diagnostic("CONTENT_CATALOG", "", message)], root, file)


static func _context(errors: Array, root: String, file: String) -> Array:
	for error in errors:
		error.root = root
		error.file = file
	return errors
