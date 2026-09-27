class_name RaceMechanics
extends RefCounted
## Ordered, construction-time composition. No runtime code loading or mutable global registry.
## Providers receive the aggregate for one call; this dispatcher never owns its lifetime.
var _source: WeakRef
var _providers: Array = []
var _definitions: Array = []
var _hooks: Dictionary = {}
var _configured: bool = false
var _installed: bool = false

func _init(simulation: RaceSim) -> void:
	_source = weakref(simulation)

static func validate(definitions: Array) -> Array[String]:
	var errors: Array[String] = []
	var known: Array[String] = []
	for value in definitions:
		if not value is Dictionary or not value.get("id") is String or value.id.is_empty():
			errors.append("A mechanic requires a non-empty stable identity.")
			continue
		if value.id in known:
			errors.append("Duplicate mechanic: " + value.id)
		if not value.get("version") is int or value.version < 1:
			errors.append("A mechanic requires a positive version: " + value.id)
		if not value.get("requires") is Array or not value.get("hooks") is Array:
			errors.append("Mechanic dependencies and hooks must be arrays: " + value.id)
			continue
		for dependency in value.requires:
			if dependency not in known:
				errors.append(value.id + " requires an earlier provider: " + str(dependency))
		var unique: Array = []
		for hook in value.hooks:
			if not hook is String or hook.is_empty() or hook in unique:
				errors.append("Invalid or duplicate hook in " + value.id)
			unique.append(hook)
		known.append(value.id)
	return errors

func configure(providers: Array) -> bool:
	if _configured:
		return false
	var definitions: Array = []
	for provider in providers:
		if provider == null or not provider.has_method("definition") or not provider.has_method("install"):
			return false
		var definition: Dictionary = provider.definition()
		for hook in definition.get("hooks", []):
			if not provider.has_method(hook):
				return false
		definitions.append(definition)
	if not validate(definitions).is_empty():
		return false
	_providers = providers.duplicate()
	_definitions = RaceStateValue.read_only(definitions)
	for index in range(_providers.size()):
		for hook in _definitions[index].hooks:
			if not _hooks.has(hook):
				_hooks[hook] = []
			_hooks[hook].append(index)
	_configured = true
	return true

func install(geometry: TrackGeometry, options: Dictionary) -> bool:
	if not _configured or _installed:
		return false
	var simulation = _source.get_ref()
	if simulation == null:
		return false
	_installed = true
	for provider in _providers:
		provider.install(simulation, geometry, options)
	return true

func has_mechanic(identity: String) -> bool:
	return _definitions.any(func(item): return item.id == identity)

func describe() -> Array:
	return _definitions.duplicate(true)

func invoke(hook: String, arguments: Array) -> Variant:
	return _invoke_before(_providers.size(), hook, arguments)

func before(identity: String, hook: String, arguments: Array) -> Variant:
	for index in range(_definitions.size()):
		if _definitions[index].id == identity:
			return _invoke_before(index, hook, arguments)
	assert(false, "Unknown mechanic predecessor: " + identity)
	return null

func _invoke_before(limit: int, hook: String, arguments: Array) -> Variant:
	var simulation = _source.get_ref()
	if simulation == null:
		return null
	var chain: Array = _hooks.get(hook, [])
	for offset in range(chain.size() - 1, -1, -1):
		var index: int = chain[offset]
		if index < limit:
			return _providers[index].callv(hook, [simulation] + arguments)
	var fallback = "_base_" + hook
	if simulation.has_method(fallback):
		return simulation.callv(fallback, arguments)
	return null
