class_name DeveloperWeekends
extends RefCounted
## Native weekend capability facet. Sessions live in memory and never use App or player storage.
const MAX_SESSIONS = 32
const MAX_TICKS = 20000
var _catalog: ContentCatalog
var _sessions: Dictionary = {}
var _disposed = false


func _init(catalog: ContentCatalog) -> void:
	_catalog = catalog


## Discover the actual supported native and transport operations.
func describe() -> Array:
	return DeveloperWeekendDescriptors.describe()


## Construct a validated authored weekend at its actual initial briefing phase.
func create(session: String, configuration: Dictionary) -> Dictionary:
	var error = _new_session_error(session)
	if not error.is_empty():
		return error
	if _catalog == null or not _catalog._sealed:
		return DeveloperToolResult.failure(
			"DOMAIN_REJECTED", "A sealed content catalog is required."
		)
	if not RaceStateValue.serializable(configuration):
		return _invalid("Weekend configuration must contain bounded finite serialized values.")
	var launch = WeekendLaunch.new(_catalog)
	var configured = _stage(launch, configuration)
	if not configured.ok:
		return configured
	var simulation = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	if not simulation.last_error.is_empty():
		return DeveloperToolResult.failure("DOMAIN_REJECTED", simulation.last_error)
	var record = RaceRecord.new()
	record.attach(simulation, "standalone", _lineage(configuration, simulation))
	_sessions[session] = DeveloperWeekendSession.new(simulation, record)
	return _created(session, simulation, configuration)


## Atomically replace an available session through the production snapshot reader.
func restore(session: String, snapshot_value: Dictionary) -> Dictionary:
	var error = _restore_session_error(session)
	if not error.is_empty():
		return error
	if not RaceStateValue.serializable(snapshot_value):
		return _invalid("Snapshot must contain bounded finite serialized values.")
	# Native practice readers inspect optional profiles before their inherited envelope.
	if not snapshot_value.get("cars") is Array:
		return _invalid("Snapshot requires an entrant collection.")
	var simulation = PracticeRaceSim.restore_practice(snapshot_value)
	if simulation == null:
		return DeveloperToolResult.failure(
			"DOMAIN_REJECTED", "The weekend snapshot cannot be restored."
		)
	var replacement = DeveloperWeekendSession.new(simulation)
	if _sessions.has(session):
		_sessions[session].close()
	_sessions[session] = replacement
	return _created(session, simulation, {})


## Apply one existing authoritative command; rejected inputs never enter the recording.
func command(session: String, action: String, payload: Dictionary = {}) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	if action.is_empty() or not RaceStateValue.serializable(payload):
		return _invalid("Command requires an action and bounded finite serialized payload.")
	return _sessions[session].command(action, payload)


## Read a named detached view. Query parameters cannot invoke arbitrary methods.
func query(session: String, view: String = "state", parameters: Dictionary = {}) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	if not RaceStateValue.serializable(parameters):
		return _invalid("Query parameters must contain bounded finite serialized values.")
	return _sessions[session].query(view, parameters)


## Step exactly the requested fixed ticks, stopping at pause or inactive phase boundaries.
func step_ticks(session: String, count: Variant) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(count, 1, MAX_TICKS):
		return _invalid("Fixed tick count must be an integer from 1 to 20000.")
	return _sessions[session].step_ticks(int(count))


## Supply at most one production frame of elapsed seconds, retaining playback semantics.
func advance_elapsed(session: String, seconds: Variant) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.number(seconds, 0, RaceStepClock.MAX_FRAME_SECONDS):
		return _invalid("Elapsed seconds must be finite and between 0 and 0.25.")
	return _sessions[session].advance_elapsed(float(seconds))


## Export the production snapshot without observer or transport state.
func snapshot(session: String) -> Dictionary:
	return _invoke_read(session, "snapshot")


## Export the owned production recording with exact accepted-input chronology.
func recording(session: String) -> Dictionary:
	return _invoke_read(session, "recording")


## Drain detached transport observations exactly once.
func events(session: String) -> Dictionary:
	return _invoke_read(session, "events")


## Close an existing session permanently. Repeated close succeeds without side effects.
func close(session: String) -> Dictionary:
	if not _valid_id(session):
		return _invalid("Use a valid process-local session ID.")
	if not _sessions.has(session):
		return DeveloperToolResult.failure("NOT_FOUND", "Unknown weekend session.")
	_sessions[session].close()
	return DeveloperToolResult.success({"session": session, "closed": true})


## Dispose all tool-owned weekend lifetimes; no player resources or files are touched.
func close_all() -> void:
	_disposed = true
	for value in _sessions.values():
		value.close()


## Application-only campaign bridge. The exact aggregate and record remain jointly owned.
func adopt(session: String, simulation: RaceSim, record: RaceRecord) -> Dictionary:
	var error = _new_session_error(session)
	if not error.is_empty():
		return error
	if simulation == null or record == null or record.source == null:
		return _invalid("Campaign departure requires its actual simulation and attached recording.")
	if record.source.get_ref() != simulation or not simulation.last_error.is_empty():
		return _invalid("Campaign recording must observe the adopted authoritative weekend.")
	if not simulation is PracticeRaceSim:
		return _invalid("Campaign departure requires the supported practice weekend profile.")
	_sessions[session] = DeveloperWeekendSession.new(simulation, record)
	return _created(session, simulation, {})


## Native campaign settlement capability only; never reachable by transport dispatch.
func owned_record(session: String) -> RaceRecord:
	return _sessions[session].owned_record() if _session_error(session).is_empty() else null


## Native application-only factual result from this session's own finished recording.
func factual_result(session: String) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	var record: RaceRecord = _sessions[session].owned_record()
	var source: RaceSim = record.source.get_ref()
	if source.phase != "results":
		return DeveloperToolResult.failure(
			"DOMAIN_REJECTED", "Finish the owned weekend before settlement."
		)
	var result = WeekendResult.build(record)
	var result_error = WeekendResult.validate(result)
	if not result_error.is_empty():
		return DeveloperToolResult.failure("DOMAIN_REJECTED", result_error)
	return DeveloperToolResult.success(
		{"finished": true, "result": result, "recording": record.seal()}
	)


## Transport allowlist. Every field is checked before entering typed native methods.
func dispatch(operation: String, session: String, arguments: Dictionary) -> Dictionary:
	return DeveloperWeekendDispatch.execute(self, operation, session, arguments)


func _invoke_read(session: String, operation: String) -> Dictionary:
	var error = _session_error(session)
	if not error.is_empty():
		return error
	match operation:
		"snapshot":
			return _sessions[session].snapshot()
		"recording":
			return _sessions[session].recording()
	return _sessions[session].events()


func _session_error(session: String) -> Dictionary:
	if _disposed:
		return DeveloperToolResult.failure("TOOLBOX_CLOSED", "This weekend capability is disposed.")
	if not _valid_id(session):
		return _invalid("Use a valid process-local session ID.")
	if not _sessions.has(session):
		return DeveloperToolResult.failure("NOT_FOUND", "Unknown weekend session.")
	if _sessions[session].closed:
		return DeveloperToolResult.failure("SESSION_CLOSED", "This weekend session is closed.")
	return {}


func _new_session_error(session: String) -> Dictionary:
	if _disposed:
		return DeveloperToolResult.failure("TOOLBOX_CLOSED", "This weekend capability is disposed.")
	if not _valid_id(session):
		return _invalid("Use a valid process-local session ID.")
	if _sessions.has(session):
		return DeveloperToolResult.failure("SESSION_EXISTS", "Weekend session ID is already owned.")
	if _sessions.size() >= MAX_SESSIONS:
		return DeveloperToolResult.failure("LIMIT_EXCEEDED", "The weekend session limit is 32.")
	return {}


func _restore_session_error(session: String) -> Dictionary:
	if _sessions.has(session):
		return _session_error(session)
	return _new_session_error(session)


func _stage(launch: WeekendLaunch, configuration: Dictionary) -> Dictionary:
	if configuration.has("scenario_id"):
		if configuration.size() != 1 or not configuration.scenario_id is String:
			return _invalid("Scenario selection requires only its stable scenario_id.")
		return _stage_result(launch.stage_scenario(configuration.scenario_id), launch)
	var error = _preset_configuration_error(configuration)
	if not error.is_empty():
		return _invalid(error)
	var circuit = _catalog.circuit(configuration.circuit_id)
	if circuit == null:
		return DeveloperToolResult.failure("DOMAIN_REJECTED", "Unknown circuit definition.")
	return _stage_result(
		launch.stage_preset(
			configuration.weekend_id, circuit.document(), configuration.get("overrides", {})
		),
		launch
	)


func _preset_configuration_error(configuration: Dictionary) -> String:
	for key in configuration:
		if key not in ["circuit_id", "weekend_id", "overrides"]:
			return "Unsupported weekend configuration field: " + str(key)
	if (
		not configuration.get("circuit_id") is String
		or not configuration.get("weekend_id") is String
	):
		return "Choose circuit_id and weekend_id by their stable content IDs."
	if not configuration.get("overrides", {}) is Dictionary:
		return "Weekend overrides must be an object."
	return ""


func _stage_result(accepted: bool, launch: WeekendLaunch) -> Dictionary:
	return (
		DeveloperToolResult.success({})
		if accepted
		else DeveloperToolResult.failure("DOMAIN_REJECTED", launch.last_error)
	)


func _lineage(configuration: Dictionary, simulation: PracticeRaceSim) -> Dictionary:
	if not configuration.has("scenario_id"):
		return {}
	var scenario = _catalog.scenario(configuration.scenario_id)
	return {
		"scenario": scenario.brief(),
		"content_scenario":
		{"definition": scenario.to_record(), "track_id": simulation.track.document.id}
	}


func _created(
	session: String, simulation: PracticeRaceSim, configuration: Dictionary
) -> Dictionary:
	return DeveloperToolResult.success(
		{
			"session": session,
			"phase": simulation.phase,
			"state": _sessions[session].state(),
			"player_ids": simulation.player_ids(),
			"configuration":
			{
				"selection": configuration,
				"seed": simulation.seed_value,
				"track_hash": RaceStateValue.fingerprint(simulation.track.document),
				"mechanics": simulation.mechanic_catalog()
			}
		}
	)


static func _valid_id(value: String) -> bool:
	return DeveloperToolResult.identifier(value)


static func _invalid(message: String) -> Dictionary:
	return DeveloperToolResult.failure("INVALID_ARGUMENT", message)


func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		_disposed = true
		for value in _sessions.values():
			value.close()
