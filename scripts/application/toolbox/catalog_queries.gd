class_name DeveloperCatalogQueries
extends RefCounted
## Read-only discovery over the same authored catalog and registered mechanics.
var _catalog: ContentCatalog


func _init(catalog: ContentCatalog) -> void:
	_catalog = catalog


func dispatch(operation: String, arguments: Dictionary) -> Dictionary:
	if _catalog == null or not _catalog._sealed:
		return DeveloperToolResult.failure("UNAVAILABLE", "A sealed content catalog is required.")
	match operation:
		"content.list":
			return _list(arguments)
		"content.inspect":
			return _inspect(arguments)
		"content.schemas":
			return _schemas(arguments)
		"mechanics.list":
			var definitions: Array = []
			for identity in RaceMechanicProfiles.ORDER:
				definitions.append(RaceMechanicProfiles.registered(identity).definition())
			return DeveloperToolResult.success(
				{"provider_order": RaceMechanicProfiles.ORDER, "providers": definitions}
			)
	return DeveloperToolResult.failure("UNKNOWN_OPERATION", "Unsupported catalog operation.")


func _list(arguments: Dictionary) -> Dictionary:
	var kind: Variant = arguments.get("kind", "")
	if not kind is String or (kind != "" and kind not in ContentSchema.KINDS):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Expected a known content kind.")
	var entries: Array = []
	var kinds: Array = [kind] if kind != "" else ContentSchema.KINDS
	for selected in kinds:
		for record in _catalog.entries(selected):
			entries.append({"id": record.id, "kind": record.kind, "name": record.get("name", "")})
	return DeveloperToolResult.success(entries)


func _inspect(arguments: Dictionary) -> Dictionary:
	var id: Variant = arguments.get("id", "")
	if not id is String or id.is_empty():
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Expected a content ID.")
	var explained: Dictionary = _catalog.explain(id)
	if explained.definition.is_empty():
		return DeveloperToolResult.failure("NOT_FOUND", "The content ID is not in this catalog.")
	return DeveloperToolResult.success(explained)


func _schemas(arguments: Dictionary) -> Dictionary:
	var kind: Variant = arguments.get("kind", "")
	if not kind is String or (kind != "" and kind not in ContentSchema.KINDS):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Expected a known content kind.")
	if kind != "":
		return DeveloperToolResult.success(ContentSchema.definition(kind))
	var schemas: Dictionary = {}
	for selected in ContentSchema.KINDS:
		schemas[selected] = ContentSchema.definition(selected)
	return DeveloperToolResult.success(schemas)
