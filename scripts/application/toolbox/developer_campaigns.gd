class_name DeveloperCampaigns
extends RefCounted
## Memory-only complete campaign checkpoints, sharing actual tool weekend recordings.
var _catalog: ContentCatalog
var _weekends: DeveloperWeekends
var _sessions: Dictionary = {}
var _links: Dictionary = {}
var _disposed = false


func _init(catalog: ContentCatalog, weekends: DeveloperWeekends) -> void:
	_catalog = catalog
	_weekends = weekends


func create(session: String, campaign_id: String) -> Dictionary:
	var error = _new_session_error(session)
	if not error.is_empty():
		return error
	var candidate = CampaignWeekendWorkflow.create(_catalog, campaign_id)
	if not candidate.ok:
		return _rejected(candidate)
	_sessions[session] = candidate.checkpoint.duplicate(true)
	return snapshot(session)


func restore(session: String, snapshot_value: Dictionary) -> Dictionary:
	var error = _restore_session_error(session)
	if not error.is_empty():
		return error
	var candidate = DeveloperCampaignSnapshots.prepare(snapshot_value)
	if not candidate.ok:
		return candidate
	var weekend: Dictionary = candidate.weekend
	if not weekend.is_empty():
		if _weekends == null:
			weekend.record.detach()
			return DeveloperToolResult.failure("UNAVAILABLE", "Weekend ownership is unavailable.")
		var adopted = _weekends.adopt(weekend.session, weekend.simulation, weekend.record)
		if not adopted.ok:
			weekend.record.detach()
			return adopted
		_links[session] = weekend.session
	else:
		_links.erase(session)
	_sessions[session] = candidate.checkpoint.duplicate(true)
	return snapshot(session)


func snapshot(session: String) -> Dictionary:
	if not _available(session):
		return _missing()
	var captured = DeveloperCampaignSnapshots.capture(
		_sessions[session], _links.get(session, ""), _weekends
	)
	if not captured.ok:
		return captured
	captured.result["session"] = session
	return captured


func query(session: String, view: String = "overview", parameters: Dictionary = {}) -> Dictionary:
	if not _available(session):
		return _missing()
	if view not in DeveloperCampaignQueries.VIEWS:
		return DeveloperToolResult.failure("UNKNOWN_VIEW", "Choose a supported campaign view.")
	var error = DeveloperFacetValues.argument_error(
		parameters, DeveloperCampaignQueries.schema(view)
	)
	if not error.is_empty():
		return error
	var canonical: Dictionary = DeveloperToolResult.success(parameters).result
	var value = DeveloperCampaignQueries.query(_sessions[session], view, canonical)
	if not value.get("ok", true):
		return _rejected(value)
	return DeveloperToolResult.success(value)


func command(session: String, action: String, payload: Dictionary = {}) -> Dictionary:
	if not _available(session):
		return _missing()
	var schema = DeveloperCampaignPlanning.schema(action)
	if schema.is_empty():
		return DeveloperToolResult.failure("UNKNOWN_COMMAND", "Choose a supported planning action.")
	var error = DeveloperFacetValues.argument_error(payload, schema)
	if not error.is_empty():
		return error
	var canonical: Dictionary = DeveloperToolResult.success(payload).result
	return _publish(session, DeveloperCampaignPlanning.apply(_sessions[session], action, canonical))


func advance(session: String) -> Dictionary:
	if not _available(session):
		return _missing()
	return _publish(session, CampaignDirectorTransaction.advance_to_next_event(_sessions[session]))


func depart(session: String, weekend_session: String) -> Dictionary:
	if not _available(session):
		return _missing()
	if _weekends == null:
		return DeveloperToolResult.failure("UNAVAILABLE", "Weekend ownership is unavailable.")
	var candidate = CampaignWeekendWorkflow.depart(_sessions[session])
	if not candidate.ok:
		return _rejected(candidate)
	var adopted = _weekends.adopt(weekend_session, candidate.simulation, candidate.record)
	if not adopted.ok:
		candidate.record.detach()
		return adopted
	_sessions[session] = candidate.departed.checkpoint.duplicate(true)
	_links[session] = weekend_session
	return DeveloperToolResult.success(
		{
			"session": session,
			"weekend_session": weekend_session,
			"checkpoint": _sessions[session],
			"weekend": adopted.result
		}
	)


func settle(session: String, weekend_session: String) -> Dictionary:
	if not _available(session):
		return _missing()
	if _weekends == null:
		return DeveloperToolResult.failure("UNAVAILABLE", "Weekend ownership is unavailable.")
	var record: RaceRecord = _weekends.owned_record(weekend_session)
	return _publish(session, CampaignWeekendWorkflow.settle(_sessions[session], record))


func close(session: String) -> Dictionary:
	if not DeveloperToolResult.identifier(session):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use a valid session identifier.")
	var existed = _available(session)
	if _sessions.has(session):
		_sessions[session] = null
	_links.erase(session)
	return DeveloperToolResult.success({"session": session, "closed": existed})


func close_all() -> void:
	_disposed = true
	_sessions.clear()
	_links.clear()
	_catalog = null
	_weekends = null


func describe() -> Array:
	return DeveloperToolResult.success(DeveloperCampaignDescriptions.describe()).result


func dispatch(operation: String, session: String, arguments: Dictionary) -> Dictionary:
	var descriptor = DeveloperCampaignDescriptions.find(operation)
	if descriptor.is_empty():
		return DeveloperToolResult.failure("UNKNOWN_OPERATION", "Unknown campaign operation.")
	var error = DeveloperFacetValues.argument_error(arguments, descriptor.arguments)
	if not error.is_empty():
		return error
	var result: Dictionary = {}
	match operation:
		"campaign.create":
			result = create(session, arguments.campaign_id)
		"campaign.restore":
			result = restore(session, arguments.snapshot)
		"campaign.snapshot":
			result = snapshot(session)
		"campaign.query":
			result = query(
				session, arguments.get("view", "overview"), arguments.get("parameters", {})
			)
		"campaign.command":
			result = command(session, arguments.action, arguments.get("payload", {}))
		"campaign.advance":
			result = advance(session)
		"campaign.depart":
			result = depart(session, arguments.weekend_session)
		"campaign.settle":
			result = settle(session, arguments.weekend_session)
		"campaign.close":
			result = close(session)
	return result


func _publish(session: String, candidate: Dictionary) -> Dictionary:
	if not candidate.ok:
		return _rejected(candidate)
	var error = CampaignCheckpoint.validate(candidate.get("checkpoint"))
	if not error.is_empty():
		return DeveloperToolResult.failure("DOMAIN_REJECTED", error)
	_sessions[session] = candidate.checkpoint.duplicate(true)
	if candidate.checkpoint.active_manifest.is_empty():
		_links.erase(session)
	return DeveloperToolResult.success(
		{
			"session": session,
			"checkpoint": _sessions[session],
			"status": candidate.get("status", "updated")
		}
	)


func _available(session: String) -> bool:
	return _sessions.has(session) and _sessions[session] != null


func _restore_session_error(session: String) -> Dictionary:
	if _disposed:
		return DeveloperToolResult.failure("FACET_CLOSED", "This toolbox facet is closed.")
	if not DeveloperToolResult.identifier(session):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use a valid session identifier.")
	if _sessions.has(session) and _sessions[session] == null:
		return DeveloperToolResult.failure("SESSION_CLOSED", "This campaign session is closed.")
	if not _sessions.has(session):
		var error = _new_session_error(session)
		if not error.is_empty():
			return error
	return {}


func _new_session_error(session: String) -> Dictionary:
	if _disposed:
		return DeveloperToolResult.failure("FACET_CLOSED", "This toolbox facet is closed.")
	if not DeveloperToolResult.identifier(session):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use a valid session identifier.")
	if _sessions.has(session):
		return DeveloperToolResult.failure(
			"SESSION_EXISTS", "This session identifier has been used."
		)
	if _sessions.size() >= DeveloperFacetValues.MAX_SESSIONS:
		return DeveloperToolResult.failure(
			"SESSION_LIMIT", "At most 32 campaign sessions are supported."
		)
	return {}


static func _missing() -> Dictionary:
	return DeveloperToolResult.failure("SESSION_NOT_FOUND", "This campaign session is unavailable.")


static func _rejected(candidate: Dictionary) -> Dictionary:
	return DeveloperToolResult.failure("DOMAIN_REJECTED", str(candidate.get("error", "Rejected.")))
