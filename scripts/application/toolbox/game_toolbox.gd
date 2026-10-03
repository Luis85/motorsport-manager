class_name GameToolbox
extends RefCounted
## Explicit developer composition root. No wall clock, App or implicit persistence.
const PROTOCOL: String = "motorsport-manager-toolbox"
const VERSION: int = 1
const MAX_BATCH: int = 128
const MAX_RESPONSE_BYTES: int = 67108864
const MIN_RESPONSE_BYTES: int = 4096
var weekends: DeveloperWeekends
var campaigns: DeveloperCampaigns
var tracks: DeveloperTracks
var _catalog_queries: DeveloperCatalogQueries
var _metadata: Dictionary
var _closed: bool = false
var _response_limit: int = MAX_RESPONSE_BYTES


func _init(
	catalog: ContentCatalog,
	metadata: Dictionary = {},
	response_limit_bytes: int = MAX_RESPONSE_BYTES
) -> void:
	_response_limit = (
		response_limit_bytes
		if response_limit_bytes >= MIN_RESPONSE_BYTES and response_limit_bytes <= MAX_RESPONSE_BYTES
		else MAX_RESPONSE_BYTES
	)
	_metadata = {
		"engine_executed": true,
		"engine": Engine.get_version_info().string,
		"source_revision": _source_identity(metadata.get("source_revision", "")),
		"source_digest": _source_identity(metadata.get("source_digest", ""))
	}
	weekends = DeveloperWeekends.new(catalog)
	campaigns = DeveloperCampaigns.new(catalog, weekends)
	tracks = DeveloperTracks.new(catalog)
	_catalog_queries = DeveloperCatalogQueries.new(catalog)


func _source_identity(value: Variant) -> String:
	var identity: String = str(value)
	return identity if identity.length() <= 128 else ""


func metadata() -> Dictionary:
	return _metadata.duplicate(true)


func execute(request: Dictionary) -> Dictionary:
	var execution: Dictionary = _execute(request)
	return _bounded(request, execution.response, execution.executed)


func _execute(request: Dictionary) -> Dictionary:
	var rejected: Dictionary = _validate(request)
	if not rejected.is_empty():
		return {"response": _respond(request, rejected), "executed": false}
	if _closed and request.operation != "toolbox.close":
		return {
			"response":
			_respond(request, DeveloperToolResult.failure("CLOSED", "The toolbox is closed.")),
			"executed": false
		}
	if request.operation == "toolbox.batch":
		return {"response": _batch(request), "executed": true}
	return {"response": _respond(request, _operation(request)), "executed": true}


func _operation(request: Dictionary) -> Dictionary:
	var operation: String = request.operation
	var arguments: Dictionary = request.get("arguments", {})
	match operation:
		"toolbox.discover":
			return DeveloperToolResult.success(
				{
					"protocol": PROTOCOL,
					"version": VERSION,
					"operations": describe(),
					"limits":
					{
						"batch": MAX_BATCH,
						"sessions_per_facet": 32,
						"response_bytes": _response_limit
					}
				}
			)
		"toolbox.close":
			close()
			return DeveloperToolResult.success({"closed": true})
		"content.list", "content.inspect", "content.schemas", "mechanics.list":
			return _catalog_queries.dispatch(operation, arguments)
	return _facet(operation, request.get("session", ""), arguments)


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


func _batch(request: Dictionary) -> Dictionary:
	var arguments: Dictionary = request.get("arguments", {})
	var requests: Variant = arguments.get("requests")
	var stop_on_error: Variant = arguments.get("stop_on_error", true)
	if not requests is Array or requests.is_empty() or requests.size() > MAX_BATCH:
		return _respond(
			request,
			DeveloperToolResult.failure("INVALID_ARGUMENT", "Expected 1..128 ordered requests.")
		)
	if not stop_on_error is bool:
		return _respond(
			request,
			DeveloperToolResult.failure("INVALID_ARGUMENT", "stop_on_error must be a boolean.")
		)
	var receipts: Array = []
	for item in requests:
		# Reserve a complete limit receipt for every future request before any dispatch.
		receipts.append(_limit_response(_request_value(item), 9223372036854775807, false))
	var response: Dictionary = _respond(
		request, {"ok": true, "result": {"responses": receipts, "stopped": false, "atomic": false}}
	)
	var budget: DeveloperResponseBudget = DeveloperResponseBudget.new(response, _response_limit)
	if not budget.fits():
		return _limit_response(request, budget.bytes, false)
	return _run_batch(requests, stop_on_error, response, budget)


func _run_batch(
	requests: Array, stop_on_error: bool, response: Dictionary, budget: DeveloperResponseBudget
) -> Dictionary:
	var stopped: bool = false
	var limit_reached: bool = false
	for index in requests.size():
		var request: Dictionary = _request_value(requests[index])
		if stopped:
			var reason: String = (
				"The batch response budget was exhausted."
				if limit_reached
				else "An earlier request failed."
			)
			budget.replace(
				index,
				_respond(
					request, DeveloperToolResult.failure("SKIPPED", reason, {"executed": false})
				)
			)
			continue
		var execution: Dictionary = _batch_item(requests[index], request)
		if not budget.replace(index, execution.response):
			budget.replace(
				index,
				_limit_response(
					request, budget.required_bytes(index, execution.response), execution.executed
				)
			)
			limit_reached = true
			stopped = true
		elif not execution.response.ok and stop_on_error:
			stopped = true
	response.result.stopped = stopped
	return response


func _batch_item(item: Variant, request: Dictionary) -> Dictionary:
	if not item is Dictionary or request.get("operation") == "toolbox.batch":
		return {
			"response":
			_respond(
				request,
				DeveloperToolResult.failure("INVALID_REQUEST", "Nested batches are not supported.")
			),
			"executed": false
		}
	return _execute(request)


func _request_value(item: Variant) -> Dictionary:
	return item if item is Dictionary else {}


func _bounded(request: Dictionary, response: Dictionary, executed: bool) -> Dictionary:
	var required: int = DeveloperResponseBudget.size_of(response)
	if required <= _response_limit:
		return response
	return _limit_response(request, required, executed)


func _limit_response(request: Dictionary, required: int, executed: bool) -> Dictionary:
	return _respond(
		request,
		DeveloperToolResult.failure(
			"RESPONSE_LIMIT",
			"The operation response exceeds the available response budget.",
			{"executed": executed, "limit_bytes": _response_limit, "required_bytes": required}
		)
	)


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
			var kinds: Array = ContentSchema.KINDS + [""]
			if operation == "content.schemas":
				kinds.append("pack")
			properties = {"kind": {"type": "string", "enum": kinds}}
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
