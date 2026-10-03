class_name DeveloperTracks
extends RefCounted
## Independent revision/history owners; editing and compiling never write player files.
var _catalog: ContentCatalog
var _sessions: Dictionary = {}
var _disposed = false


func _init(catalog: ContentCatalog) -> void:
	_catalog = catalog


func create(session: String, configuration: Dictionary = {}) -> Dictionary:
	var session_error = _new_session_error(session)
	if not session_error.is_empty():
		return session_error
	var error = DeveloperFacetValues.argument_error(
		configuration, DeveloperTrackDescriptions.configuration()
	)
	if not error.is_empty():
		return error
	var canonical: Dictionary = DeveloperToolResult.success(configuration).result
	var resolved = _document(canonical)
	if not resolved.ok:
		return resolved
	var document: Dictionary = resolved.result
	var editor = TrackEditorSession.new()
	editor.content_catalog = _catalog
	if not editor.replace(document, false):
		return DeveloperToolResult.failure("DOMAIN_REJECTED", editor.last_error)
	_sessions[session] = editor
	return read(session)


func read(session: String) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	var history = editor.history()
	return DeveloperToolResult.success(
		{
			"session": session,
			"document": editor.read_document(),
			"revision": editor.revision,
			"undo_depth": history.past.size(),
			"redo_depth": history.future.size()
		}
	)


func snapshot(session: String) -> Dictionary:
	return read(session)


func validate(session: String, publication: bool = false) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	var document = editor.read_document()
	var errors = (
		TrackDocument.publication_errors(document)
		if publication
		else TrackDocument.draft_errors(document)
	)
	return DeveloperToolResult.success(
		{
			"session": session,
			"revision": editor.revision,
			"publication": publication,
			"valid": errors.is_empty(),
			"errors": errors
		}
	)


func commit(session: String, document: Dictionary, expected_revision: int) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	if not RaceStateValue.serializable(document):
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT", "Use a bounded finite JSON document."
		)
	var canonical: Dictionary = DeveloperToolResult.success(document).result
	if not editor.commit(canonical, expected_revision):
		return DeveloperToolResult.failure("DOMAIN_REJECTED", editor.last_error)
	return read(session)


func edit(
	session: String, action: String, parameters: Dictionary, expected_revision: int
) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	if action not in DeveloperTrackEdits.ACTIONS:
		return DeveloperToolResult.failure("UNKNOWN_COMMAND", "Choose a supported track edit.")
	if editor.revision != expected_revision:
		return DeveloperToolResult.failure(
			"STALE_REVISION", "Start from the current document revision."
		)
	var error = DeveloperFacetValues.argument_error(parameters, DeveloperTrackEdits.schema(action))
	if not error.is_empty():
		return error
	var canonical: Dictionary = DeveloperToolResult.success(parameters).result
	var edited = DeveloperTrackEdits.apply(editor.read_document(), action, canonical)
	if not edited.ok:
		return DeveloperToolResult.failure("DOMAIN_REJECTED", edited.error)
	return commit(session, edited.document, expected_revision)


func undo(session: String) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	editor.undo()
	return read(session)


func redo(session: String) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	editor.redo()
	return read(session)


func cancel(session: String) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	editor.cancel()
	return read(session)


func compile(
	session: String, vehicle: String = "core.vehicle.formula", fast: bool = false
) -> Dictionary:
	var editor = _editor(session)
	if editor == null:
		return _missing()
	var geometry = editor.compile_draft(editor.read_document(), vehicle, fast)
	if geometry == null:
		return DeveloperToolResult.failure(
			"DOMAIN_REJECTED", "Choose a supported vehicle and compilable draft."
		)
	return DeveloperToolResult.success(
		{
			"session": session,
			"revision": editor.revision,
			"runtime": geometry.runtime_export(),
			"diagnostics": editor.diagnostics(geometry)
		}
	)


func close(session: String) -> Dictionary:
	if not DeveloperToolResult.identifier(session):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use a valid session identifier.")
	var existed = _editor(session) != null
	if _sessions.has(session):
		_sessions[session] = null
	return DeveloperToolResult.success({"session": session, "closed": existed})


func close_all() -> void:
	_disposed = true
	_sessions.clear()
	_catalog = null


func describe() -> Array:
	return DeveloperToolResult.success(DeveloperTrackDescriptions.describe()).result


func dispatch(operation: String, session: String, arguments: Dictionary) -> Dictionary:
	var descriptor = DeveloperTrackDescriptions.find(operation)
	if descriptor.is_empty():
		return DeveloperToolResult.failure("UNKNOWN_OPERATION", "Unknown track operation.")
	var error = DeveloperFacetValues.argument_error(arguments, descriptor.arguments)
	if not error.is_empty():
		return error
	var result: Dictionary = {}
	match operation:
		"track.create":
			result = create(session, arguments.get("configuration", {}))
		"track.read":
			result = read(session)
		"track.snapshot":
			result = snapshot(session)
		"track.validate":
			result = validate(session, arguments.get("publication", false))
		"track.commit":
			result = commit(session, arguments.document, int(arguments.expected_revision))
		"track.edit":
			result = edit(
				session,
				arguments.action,
				arguments.get("parameters", {}),
				int(arguments.expected_revision)
			)
		"track.undo":
			result = undo(session)
		"track.redo":
			result = redo(session)
		"track.cancel":
			result = cancel(session)
		"track.compile":
			result = compile(
				session,
				arguments.get("vehicle", "core.vehicle.formula"),
				arguments.get("fast", false)
			)
		"track.close":
			result = close(session)
	return result


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
			"SESSION_LIMIT", "At most 32 track sessions are supported."
		)
	return {}


func _document(configuration: Dictionary) -> Dictionary:
	if configuration.has("circuit_id") and configuration.has("document"):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Choose a circuit or a document.")
	var document: Dictionary = TrackEditorSession.blank_document()
	if configuration.has("circuit_id"):
		var circuit = _catalog.circuit(configuration.circuit_id) if _catalog != null else null
		if circuit == null:
			return DeveloperToolResult.failure(
				"DOMAIN_REJECTED", "The authored circuit is unavailable."
			)
		document = circuit.document()
	elif configuration.has("document"):
		document = configuration.document
	return DeveloperToolResult.success(document)


func _editor(session: String) -> TrackEditorSession:
	return _sessions.get(session)


static func _missing() -> Dictionary:
	return DeveloperToolResult.failure("SESSION_NOT_FOUND", "This track session is unavailable.")
