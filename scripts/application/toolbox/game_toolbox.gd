class_name GameToolbox
extends RefCounted
## Explicit developer composition root. No wall clock, App or implicit persistence.
const PROTOCOL: String = "motorsport-manager-toolbox"
const VERSION: int = 1
const MAX_BATCH: int = 128
var weekends: DeveloperWeekends
var campaigns: DeveloperCampaigns
var tracks: DeveloperTracks
var _catalog_queries: DeveloperCatalogQueries
var _metadata: Dictionary
var _closed: bool = false


func _init(catalog: ContentCatalog, metadata: Dictionary = {}) -> void:
	_metadata = {
		"engine_executed": true,
		"engine": Engine.get_version_info().string,
		"source_revision": str(metadata.get("source_revision", "")),
		"source_digest": str(metadata.get("source_digest", ""))
	}
	weekends = DeveloperWeekends.new(catalog)
	campaigns = DeveloperCampaigns.new(catalog, weekends)
	tracks = DeveloperTracks.new(catalog)
	_catalog_queries = DeveloperCatalogQueries.new(catalog)


func metadata() -> Dictionary:
	return _metadata.duplicate(true)


func execute(request: Dictionary) -> Dictionary:
	var rejected: Dictionary = _validate(request)
	if not rejected.is_empty():
		return _respond(request, rejected)
	var operation: String = request.operation
	var session: String = request.get("session", "")
	var arguments: Dictionary = request.get("arguments", {})
	if _closed and operation != "toolbox.close":
		return _respond(request, DeveloperToolResult.failure("CLOSED", "The toolbox is closed."))
	var result: Dictionary
	match operation:
		"toolbox.discover":
			result = DeveloperToolResult.success(
				{
					"protocol": PROTOCOL,
					"version": VERSION,
					"operations": describe(),
					"limits": {"batch": MAX_BATCH, "sessions_per_facet": 32}
				}
			)
		"toolbox.close":
			close()
			result = DeveloperToolResult.success({"closed": true})
		"toolbox.batch":
			result = _batch(arguments)
		"content.list", "content.inspect", "content.schemas", "mechanics.list":
			result = _catalog_queries.dispatch(operation, arguments)
		_:
			result = _facet(operation, session, arguments)
	return _respond(request, result)


func close() -> void:
	if _closed:
		return
	campaigns.close_all()
	weekends.close_all()
	tracks.close_all()
	_closed = true


func describe() -> Array:
	var operations: Array = []
	for operation in [
		"toolbox.discover",
		"toolbox.close",
		"toolbox.batch",
		"content.list",
		"content.inspect",
		"content.schemas",
		"mechanics.list"
	]:
		operations.append(_descriptor(operation))
	operations.append_array(weekends.describe())
	operations.append_array(campaigns.describe())
	operations.append_array(tracks.describe())
	return operations.duplicate(true)


func _validate(request: Dictionary) -> Dictionary:
	if not RaceStateValue.serializable(request):
		return DeveloperToolResult.failure(
			"INVALID_REQUEST", "Expected bounded finite JSON values."
		)
	if (
		request.get("protocol") != PROTOCOL
		or not DeveloperToolResult.integral(request.get("version"), VERSION, VERSION)
	):
		return DeveloperToolResult.failure("PROTOCOL_MISMATCH", "Unsupported protocol or version.")
	if not DeveloperToolResult.identifier(request.get("request_id")):
		return DeveloperToolResult.failure("INVALID_REQUEST", "Expected a bounded request ID.")
	var operation: Variant = request.get("operation")
	if not operation is String or operation.is_empty() or operation.length() > 64:
		return DeveloperToolResult.failure("INVALID_REQUEST", "Expected an operation name.")
	if not request.get("arguments", {}) is Dictionary:
		return DeveloperToolResult.failure(
			"INVALID_REQUEST", "Operation arguments must be an object."
		)
	return _validate_session(request, operation)


func _validate_session(request: Dictionary, operation: String) -> Dictionary:
	var session: Variant = request.get("session", "")
	if not session is String or (session != "" and not DeveloperToolResult.identifier(session)):
		return DeveloperToolResult.failure("INVALID_REQUEST", "Expected a bounded session ID.")
	if (
		operation.begins_with("toolbox.")
		or operation.begins_with("content.")
		or operation == "mechanics.list"
	):
		if session != "":
			return DeveloperToolResult.failure(
				"INVALID_REQUEST", "Global operations do not take a session."
			)
	elif not DeveloperToolResult.identifier(session):
		return DeveloperToolResult.failure(
			"INVALID_REQUEST", "This operation requires a session ID."
		)
	return {}


func _facet(operation: String, session: String, arguments: Dictionary) -> Dictionary:
	var prefix: String = operation.get_slice(".", 0)
	match prefix:
		"weekend":
			return weekends.dispatch(operation, session, arguments)
		"campaign":
			return campaigns.dispatch(operation, session, arguments)
		"track":
			return tracks.dispatch(operation, session, arguments)
	return DeveloperToolResult.failure("UNKNOWN_OPERATION", "The operation is not registered.")


func _batch(arguments: Dictionary) -> Dictionary:
	var requests: Variant = arguments.get("requests")
	var stop_on_error: Variant = arguments.get("stop_on_error", true)
	if not requests is Array or requests.is_empty() or requests.size() > MAX_BATCH:
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Expected 1..128 ordered requests.")
	if not stop_on_error is bool:
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "stop_on_error must be a boolean.")
	var results: Array = []
	var stopped: bool = false
	for item in requests:
		var request: Dictionary = item if item is Dictionary else {}
		var result: Dictionary
		if stopped:
			result = _respond(
				request, DeveloperToolResult.failure("SKIPPED", "An earlier request failed.")
			)
		elif not item is Dictionary or request.get("operation") == "toolbox.batch":
			result = _respond(
				request,
				DeveloperToolResult.failure("INVALID_REQUEST", "Nested batches are not supported.")
			)
		else:
			result = execute(request)
		results.append(result)
		if not result.ok and stop_on_error:
			stopped = true
	return DeveloperToolResult.success({"responses": results, "stopped": stopped, "atomic": false})


func _respond(request: Dictionary, result: Dictionary) -> Dictionary:
	var response: Dictionary = {
		"protocol": PROTOCOL,
		"version": VERSION,
		"request_id": "",
		"operation": "",
		"session": "",
		"metadata": metadata()
	}
	for key in ["request_id", "operation", "session"]:
		var value: Variant = request.get(key, "")
		if value is String and value.length() <= 64:
			response[key] = value
	response.merge(result)
	return response


func _descriptor(operation: String) -> Dictionary:
	var properties: Dictionary = {}
	var required: Array = []
	var description: String = "Discover the native developer operations."
	match operation:
		"toolbox.close":
			description = "Close all owned sessions and release observers."
		"toolbox.batch":
			description = "Execute ordered requests; accepted prefix remains committed."
			properties = {
				"requests": {"type": "array", "minItems": 1, "maxItems": MAX_BATCH},
				"stop_on_error": {"type": "boolean", "default": true}
			}
			required = ["requests"]
		"content.list", "content.schemas":
			description = "Read authored content definitions or their schemas."
			properties = {"kind": {"type": "string", "enum": ContentSchema.KINDS + [""]}}
		"content.inspect":
			description = "Read a detached content definition and provenance."
			properties = {"id": {"type": "string", "minLength": 1}}
			required = ["id"]
		"mechanics.list":
			description = "Read registered provider definitions in their composition order."
	return {
		"operation": operation,
		"method": "execute",
		"description": description,
		"arguments": {"type": "object", "properties": properties, "required": required},
		"clock": "none",
		"persistence": "memory",
		"examples": []
	}
