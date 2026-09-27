class_name RaceMechanics
extends RefCounted
## Ordered, construction-time composition. No runtime code loading or mutable global registry.
## Providers receive the aggregate for one call; this dispatcher never owns its lifetime.
var _source: WeakRef
var _providers: Array[RaceMechanic] = []
var _definitions: Array = []
var _hooks: Dictionary = {}
var _configured: bool = false
var _installed: bool = false
var _configuring: bool = false
var last_error: String = ""

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
		var dependencies: Array = []
		for dependency in value.requires:
			if not dependency is String or dependency.is_empty() or dependency in dependencies:
				errors.append("Invalid or duplicate prerequisite in " + value.id)
			elif dependency not in known:
				errors.append(value.id + " requires an earlier provider: " + str(dependency))
			dependencies.append(dependency)
		var unique: Array = []
		for hook in value.hooks:
			if not hook is String or hook.is_empty() or hook in unique:
				errors.append("Invalid or duplicate hook in " + value.id)
			unique.append(hook)
		known.append(value.id)
	return errors

func configure(providers: Array) -> bool:
	if _configured or _configuring:
		last_error = "Mechanics are already configured or configuration is in progress."
		return false
	_configuring = true
	var definitions: Array = []
	var proposed: Array[RaceMechanic] = []
	for index in range(providers.size()):
		var provider = providers[index]
		if not provider is Object or not is_instance_valid(provider) or not provider is RaceMechanic:
			return _configuration_failed("Provider %d must extend RaceMechanic." % index)
		proposed.append(provider)
		definitions.append(provider.definition())
	var errors = validate(definitions)
	if not errors.is_empty():
		return _configuration_failed("\n".join(errors))
	var owner: RaceSim = _source.get_ref()
	if owner == null:
		return _configuration_failed("The owning simulation has been released.")
	for index in range(proposed.size()):
		var contract_error = RaceHookContract.validate(owner, proposed[index], definitions[index].hooks)
		if not contract_error.is_empty():
			return _configuration_failed("%s: %s" % [definitions[index].id, contract_error])
		for hook in definitions[index].hooks:
			if not proposed[index].has_method(hook):
				return _configuration_failed("%s declares missing hook: %s" % [definitions[index].id, hook])
	# Publish the plan only after EVERY provider and definition is validated.
	_providers = proposed
	_definitions = RaceStateValue.read_only(definitions)
	for index in range(_providers.size()):
		for hook in _definitions[index].hooks:
			if not _hooks.has(hook):
				_hooks[hook] = []
			_hooks[hook].append(index)
	_configured = true
	_configuring = false
	last_error = ""
	return true

func _configuration_failed(message: String) -> bool:
	last_error = message
	_configuring = false
	return false

func install(geometry: TrackGeometry, options: Dictionary) -> bool:
	if not _configured or _installed:
		last_error = "Configure once before installing; installation cannot be repeated."
		return false
	var simulation = _source.get_ref()
	if simulation == null:
		last_error = "The owning simulation has been released."
		return false
	_installed = true
	for provider in _providers:
		provider.install(simulation, geometry.detached_copy() if geometry else null, options.duplicate(true))
	last_error = ""
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
