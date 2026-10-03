extends "res://tests/support/toolbox_test_fixture.gd"
## JSON-decoded requests use the identical native capabilities and correlated responses.
const Budget = preload("res://tests/support/toolbox_response_budget.gd")
var toolbox: GameToolbox
var next_request: int = 0


func run() -> void:
	if not prepare():
		finish("toolbox-protocol-tests")
		return
	var files = player_files()
	toolbox = GameToolbox.new(catalog)
	value_contracts()
	integer_boundaries()
	discovery_contracts()
	schema_contracts()
	weekend_parity()
	request_rejections()
	batch_contracts()
	Budget.run(self)
	close_contracts()
	same(player_files(), files, "Protocol dispatch has no implicit player persistence")
	finish("toolbox-protocol-tests")


func value_contracts() -> void:
	var exact: int = 9007199254740993
	var draft = {&"values": [exact, &"authored-name", {"amount": exact}]}
	var result = DeveloperToolResult.success(draft)
	check(result.ok, "Native result preserves exact JSON-compatible integers")
	check(typeof(result.result.values[0]) == TYPE_INT, "Native detached values retain integer type")
	check(result.result.values[0] == exact, "Native copy preserves integers beyond float precision")
	check(
		typeof(result.result.keys()[0]) == TYPE_STRING,
		"Authored StringName keys become JSON strings"
	)
	check(
		typeof(result.result.values[1]) == TYPE_STRING,
		"Authored StringName values become JSON strings"
	)
	var error = DeveloperToolResult.failure("DOMAIN_REJECTED", "Owner rejection", draft)
	draft.values[0] = 0
	draft.values[2].amount = 0
	check(
		error.error.details.values[0] == exact,
		"Rejection details retain exact native integer evidence"
	)
	check(error.error.details.values[2].amount == exact, "Nested rejection details are detached")
	check(result.result.values[2].amount == exact, "Successful nested values are detached")
	rejected(
		DeveloperToolResult.success(RefCounted.new()), "Object result boundary", "INVALID_RESULT"
	)
	var decoded = ContentJson.parse(
		'{"value":9007199254740993,"decimal":0.12345678901234566}', true
	)
	check(decoded.ok, "Production strict transport parser accepts exact int64 JSON")
	check(
		typeof(decoded.data.value) == TYPE_INT and decoded.data.value == exact,
		"Wire decoding preserves valid int64 beyond double precision"
	)
	check(
		decoded.data.decimal == 0.12345678901234566,
		"Wire decoding preserves full decimal precision"
	)
	var wire = json_round_trip(result.result)
	check(
		typeof(wire.values[0]) == TYPE_INT and wire.values[0] == exact,
		"Full-precision response codec preserves int64"
	)


func integer_boundaries() -> void:
	for fixture in [
		{"text": "9007199254740993", "value": 9007199254740993},
		{"text": "-9007199254740993", "value": -9007199254740993},
		{"text": "9223372036854775807", "value": 9223372036854775807},
		{"text": "-9223372036854775808", "value": -9223372036854775807 - 1}
	]:
		var parsed = ContentJson.parse(fixture.text, true)
		check(parsed.ok, "Strict transport accepts signed int64 boundary " + fixture.text)
		check(
			typeof(parsed.data) == TYPE_INT and parsed.data == fixture.value,
			"Signed int64 boundary remains exact without binary64 coercion"
		)
	for text in ["9223372036854775808", "-9223372036854775809"]:
		var parsed = ContentJson.parse(text, true)
		check(
			not parsed.ok and not parsed.error.is_empty(),
			"Out-of-range integer rejects before native conversion"
		)
	var authored = ContentJson.parse("123")
	check(
		authored.ok and typeof(authored.data) == TYPE_FLOAT,
		"Existing authored-content numeric policy is unchanged"
	)


func request(operation: String, session: String = "", arguments: Dictionary = {}) -> Dictionary:
	next_request += 1
	return {
		"protocol": "motorsport-manager-toolbox",
		"version": 1,
		"request_id": "native-%d" % next_request,
		"operation": operation,
		"session": session,
		"arguments": arguments
	}


func execute(operation: String, session: String = "", arguments: Dictionary = {}) -> Dictionary:
	var input = request(operation, session, arguments)
	var original = RaceStateValue.fingerprint(input)
	var wire: Dictionary = json_round_trip(input)
	var response = toolbox.execute(wire)
	for key in ["request_id", "operation", "session", "protocol", "version"]:
		check(response[key] == wire[key], "Native protocol retains request correlation: " + key)
	check(response.metadata.engine_executed, "A protocol result identifies actual engine execution")
	check(
		response.metadata.engine == Engine.get_version_info().string,
		"Protocol metadata reports this running native engine"
	)
	check(
		response.metadata.source_revision == "" and response.metadata.source_digest == "",
		"Unknown source identity remains explicitly empty"
	)
	check(
		RaceStateValue.serializable(response), "Every protocol envelope contains JSON values only"
	)
	check(RaceStateValue.fingerprint(input) == original, "Dispatch never mutates the request draft")
	return json_round_trip(response)


func discovery_contracts() -> void:
	var native = toolbox.weekends.describe()
	var queries = native.filter(func(entry): return entry.method == "query")[0]
	var tactical = queries.views.filter(func(entry): return entry.view == "tactical_draft")[0]
	tactical.parameters.properties.kind.enum.append("external-mutation")
	var fresh = toolbox.weekends.describe().filter(func(entry): return entry.method == "query")[0]
	var retained = fresh.views.filter(func(entry): return entry.view == "tactical_draft")[0]
	check(
		"external-mutation" not in retained.parameters.properties.kind.enum,
		"Native weekend discovery does not retain mechanic enum references"
	)
	check(
		"external-mutation" not in TacticalForecast.KINDS,
		"Editing detached discovery cannot change the actual mechanic's supported plans"
	)
	var response = execute("toolbox.discover")
	if not accepted(response, "Discover native capabilities"):
		return
	check(
		(
			response.result.limits
			== {"batch": 128, "sessions_per_facet": 32, "response_bytes": 67108864}
		),
		"Discovery exposes real bounds"
	)
	check(
		(
			typeof(response.result.limits.batch) == TYPE_INT
			and typeof(response.result.limits.sessions_per_facet) == TYPE_INT
			and typeof(response.result.limits.response_bytes) == TYPE_INT
		),
		"Disclosed limits preserve exact integer types on the wire"
	)
	var operations: Array = []
	for descriptor in response.result.operations:
		check(not descriptor.description.is_empty(), "Discovered operation explains its behavior")
		check(descriptor.arguments.type == "object", "Discovery describes object arguments")
		check(
			descriptor.clock in ["none", "fixed ticks", "elapsed", "campaign slots"],
			"Clock units are explicit"
		)
		check(descriptor.persistence == "memory", "Capabilities disclose memory-only ownership")
		check(descriptor.examples is Array, "Discovery example values are serializable")
		check(descriptor.operation not in operations, "Discovery never duplicates an operation")
		operations.append(descriptor.operation)
	for operation in [
		"weekend.create", "campaign.create", "track.create", "content.inspect", "mechanics.list"
	]:
		check(operation in operations, "Discovery includes implemented facet " + operation)
	response.result.operations.clear()
	check(not toolbox.describe().is_empty(), "Discovered descriptors are detached")
	var metadata = toolbox.metadata()
	metadata.engine = "caller"
	check(
		toolbox.metadata().engine == Engine.get_version_info().string, "Metadata reads are detached"
	)
	for operation in ["content.list", "content.schemas", "mechanics.list"]:
		accepted(execute(operation), "Read global " + operation)
	var inspected = execute("content.inspect", "", {"id": "core.weekend.quick"})
	if accepted(inspected, "Inspect frozen content"):
		inspected.result.clear()
		check(
			not execute("content.inspect", "", {"id": "core.weekend.quick"}).result.is_empty(),
			"Content results are detached"
		)
	rejected(execute("content.inspect", "", {"id": "missing.content"}), "Unknown content")


func schema_contracts() -> void:
	var schemas = execute("content.schemas").result
	check(
		schemas.size() == ContentSchema.KINDS.size() + 1,
		"Schema discovery includes every content kind and the pack manifest"
	)
	for kind in ContentSchema.KINDS + ["pack"]:
		var document = execute("content.schemas", "", {"kind": kind}).result
		same(
			document,
			ContentSchema.document(kind),
			"SDK schema document is the authoritative published contract"
		)
		check(
			document.has("$schema") and document.has("title"),
			"Schema document exposes its dialect and title"
		)
		same(schemas[kind], document, "Combined schema discovery matches the individual document")
	var manifest = Storage.read_json("res://content/packs/core/pack.json").data
	check(
		ContentValidation.check(manifest, schemas.pack).is_empty(),
		"Published pack schema validates the actual bundled manifest"
	)
	rejected(
		execute("content.list", "", {"kind": "pack"}),
		"Pack is a schema contract rather than a catalog entity"
	)
	for facet in [toolbox.weekends, toolbox.campaigns, toolbox.tracks]:
		var described: Array = facet.describe()
		var original: Array = json_round_trip(described)
		described[0].arguments.clear()
		same(facet.describe(), original, "Native facet descriptors cannot alias owner contracts")


func weekend_parity() -> void:
	var direct = DeveloperWeekends.new(catalog)
	var settings: Dictionary = json_round_trip(configuration())
	var native = direct.create("parity", settings)
	var wire = execute("weekend.create", "parity", {"configuration": settings})
	if (
		not accepted(native, "Direct SDK creates parity source")
		or not accepted(wire, "Protocol creates parity source")
	):
		direct.close_all()
		return
	same(wire.result, native.result, "Native and JSON create parity")
	var operations = [
		{"action": "practice_start", "payload": {}},
		{"action": "speed", "payload": {"value": 2}},
		{"action": "pace", "payload": {"id": 3, "value": 1}},
		{"action": "pause", "payload": {}},
		{"action": "unknown_mechanic", "payload": {}},
		{"action": "pause", "payload": {}}
	]
	for operation in operations:
		var decoded: Dictionary = json_round_trip(operation)
		native = direct.command("parity", decoded.action, decoded.payload)
		wire = execute("weekend.command", "parity", decoded)
		check(wire.ok == native.ok, "Protocol shares authoritative command acceptance")
		same(
			wire.get("result", wire.get("error")),
			native.get("result", native.get("error")),
			"Command response parity"
		)
	for count in [1, 13, 0, 20001]:
		native = direct.step_ticks("parity", count)
		wire = execute("weekend.step_ticks", "parity", {"count": count})
		check(wire.ok == native.ok, "Protocol shares fixed tick validation")
		same(
			wire.get("result", wire.get("error")),
			native.get("result", native.get("error")),
			"Tick response parity"
		)
	for seconds in [0.02, 0.03, 0.1, -1.0, 0.251]:
		native = direct.advance_elapsed("parity", seconds)
		wire = execute("weekend.advance_elapsed", "parity", {"seconds": seconds})
		check(wire.ok == native.ok, "Protocol shares elapsed-time validation")
		same(
			wire.get("result", wire.get("error")),
			native.get("result", native.get("error")),
			"Elapsed response parity"
		)
	for view in [
		"state",
		"cars",
		"overview",
		"weather",
		"strategy",
		"mechanics",
		"practice",
		"strategy_draft",
		"strategy_forecast",
		"tactical_draft",
		"team_orders",
		"recovery",
		"decisions",
		"setup"
	]:
		same(
			execute("weekend.query", "parity", {"view": view}).result,
			direct.query("parity", view).result,
			"Detached query parity: " + view
		)
	var native_snapshot = direct.snapshot("parity").result
	same(
		execute("weekend.snapshot", "parity").result,
		native_snapshot,
		"Complete native checkpoint parity"
	)
	var native_record = direct.recording("parity").result
	var wire_record = execute("weekend.recording", "parity").result
	check(
		RaceRecord.validate(wire_record).is_empty(), "Protocol emits a genuine production recording"
	)
	for key in ["initial", "endpoint", "inputs", "steps", "model", "parent", "manifest"]:
		same(wire_record[key], native_record[key], "Production recording parity: " + key)
	same(
		execute("weekend.events", "parity").result,
		direct.events("parity").result,
		"Observer drain parity"
	)
	var restored = execute("weekend.restore", "parity", {"snapshot": native_snapshot.snapshot})
	accepted(restored, "Protocol restores actual exported checkpoint")
	same(
		execute("weekend.snapshot", "parity").result.snapshot,
		native_snapshot.snapshot,
		"JSON restore preserves state"
	)
	var continuation = direct.step_ticks("parity", 31)
	var wire_continuation = execute("weekend.step_ticks", "parity", {"count": 31})
	same(wire_continuation.result, continuation.result, "SDK-to-wire restore continuation clocks")
	same(
		execute("weekend.snapshot", "parity").result.snapshot,
		direct.snapshot("parity").result.snapshot,
		"Full-precision SDK-to-wire restore continuation including RNG"
	)
	direct.close_all()


func request_rejections() -> void:
	var before = toolbox.weekends.snapshot("parity").result
	for altered in [
		{"protocol": "other"},
		{"version": 2},
		{"version": true},
		{"request_id": ""},
		{"request_id": "r".repeat(65)},
		{"operation": 17},
		{"arguments": []},
		{"session": "a/b"}
	]:
		var invalid = request("weekend.snapshot", "parity")
		invalid.merge(altered, true)
		rejected(toolbox.execute(invalid), "Malformed protocol envelope")
	rejected(execute("toolbox.discover", "parity"), "Global session misuse", "INVALID_REQUEST")
	rejected(execute("weekend.snapshot"), "Missing facet session", "INVALID_REQUEST")
	rejected(
		execute("weekend.owned_record", "parity"),
		"Native bridge is not a protocol operation",
		"UNKNOWN_OPERATION"
	)
	rejected(
		execute("weekend.command", "parity", {"action": "speed", "payload": "scalar"}),
		"Malformed typed arguments",
		"INVALID_ARGUMENT"
	)
	same(toolbox.weekends.snapshot("parity").result, before, "Rejected protocol inputs")


func batch_contracts() -> void:
	var operations = [
		request("weekend.command", "parity", {"action": "speed", "payload": {"value": 4}}),
		request("weekend.command", "parity", {"action": "unknown_mechanic"}),
		request("weekend.command", "parity", {"action": "speed", "payload": {"value": 8}})
	]
	var response = execute("toolbox.batch", "", {"requests": operations, "stop_on_error": true})
	if not accepted(response, "Execute ordered batch"):
		return
	check(
		not response.result.atomic and response.result.stopped,
		"Batch explicitly retains its accepted prefix"
	)
	var results: Array = response.result.responses
	check(
		results.size() == 3 and results[0].ok and not results[1].ok,
		"Batch records actual success and failure in order"
	)
	check(results[2].error.code == "SKIPPED", "Stop-on-error explicitly marks unexecuted requests")
	check(
		toolbox.weekends.query("parity").result.speed == 4,
		"Accepted prefix remains committed after failure"
	)
	for index in range(results.size()):
		check(
			results[index].request_id == operations[index].request_id,
			"Batch preserves inner request identity"
		)
	response = execute("toolbox.batch", "", {"requests": operations, "stop_on_error": false})
	check(
		not response.result.stopped and response.result.responses[2].ok,
		"Explicit continuation executes later requests"
	)
	check(
		toolbox.weekends.query("parity").result.speed == 8,
		"Continued batch uses the ordinary command authority"
	)
	rejected(execute("toolbox.batch", "", {"requests": []}), "Empty batch", "INVALID_ARGUMENT")
	var excessive: Array = []
	for index in range(129):
		excessive.append(request("toolbox.discover"))
	rejected(
		execute("toolbox.batch", "", {"requests": excessive}), "Batch capacity", "INVALID_ARGUMENT"
	)
	var nested = execute(
		"toolbox.batch", "", {"requests": [request("toolbox.batch", "", {"requests": operations})]}
	)
	check(
		nested.result.responses[0].error.code == "INVALID_REQUEST",
		"Nested execution batches are rejected"
	)


func close_contracts() -> void:
	var source_ref = toolbox.weekends.owned_record("parity").source
	accepted(execute("toolbox.close"), "Toolbox close releases all facets")
	accepted(execute("toolbox.close"), "Toolbox repeated close is idempotent")
	check(source_ref.get_ref() == null, "Global close releases the actual simulation")
	rejected(execute("toolbox.discover"), "Closed global discovery", "CLOSED")
	rejected(
		execute("weekend.create", "later", {"configuration": configuration()}),
		"Closed creation",
		"CLOSED"
	)
