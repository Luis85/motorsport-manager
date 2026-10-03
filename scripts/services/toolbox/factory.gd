class_name GameToolboxFactory
extends RefCounted
## Filesystem composition is separate from the injected application facade.


static func create(pack_roots: Array = [], metadata: Dictionary = {}) -> Dictionary:
	var loaded: Dictionary = ContentPackLoader.new().load_packs(
		[ContentPackLoader.BUILTIN_ROOT] + pack_roots
	)
	if not loaded.ok:
		return DeveloperToolResult.failure(
			"CONTENT_REJECTED",
			"Selected content packs could not be activated.",
			{"diagnostics": loaded.diagnostics}
		)
	return {"ok": true, "toolbox": GameToolbox.new(loaded.catalog, metadata)}
