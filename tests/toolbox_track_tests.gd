extends "res://tests/support/toolbox_test_fixture.gd"
## Native and JSON editor capabilities retain revision, draft and compilation ownership.
var tracks: DeveloperTracks


func run() -> void:
	if not prepare():
		finish("toolbox-track-tests")
		return
	var files = player_files()
	tracks = DeveloperTracks.new(catalog)
	draft_contracts()
	history_contracts()
	protocol_parity()
	tracks.close_all()
	same(player_files(), files, "Tool editor never writes player or source documents")
	finish("toolbox-track-tests")


func read(session: String) -> Dictionary:
	var response = tracks.read(session)
	return response.result if accepted(response, "Read editor " + session) else {}


func draft_contracts() -> void:
	var document = TrackEditorSession.blank_document()
	document.name = ""
	document.closed = false
	document.nodes = document.nodes.slice(0, 2)
	var before = document.duplicate(true)
	if not accepted(
		tracks.create("draft", {"document": document}), "Create a valid unfinished draft"
	):
		return
	same(document, before, "Editor creation preserves caller draft")
	document.nodes[0].x += 900.0
	same(read("draft").document, before, "Editor owns a detached input document")
	check(tracks.validate("draft").result.valid, "Unfinished draft passes the editing policy")
	check(
		not tracks.validate("draft", true).result.valid,
		"Publication separately requires a complete circuit"
	)
	var current = read("draft")
	var exported = tracks.snapshot("draft").result
	exported.document.nodes.clear()
	same(read("draft"), current, "Snapshot reads cannot replace canonical draft")
	var malformed = current.document.duplicate(true)
	malformed.nodes = ["scalar"]
	rejected(
		tracks.commit("draft", malformed, current.revision),
		"Malformed nested draft",
		"DOMAIN_REJECTED"
	)
	same(read("draft"), current, "Rejected draft retains revision, history and canonical value")
	accepted(tracks.close("draft"), "Close incomplete editor")
	accepted(tracks.close("draft"), "Repeated editor close")
	rejected(tracks.read("draft"), "Read closed editor")
	rejected(tracks.create("draft"), "Closed editor ID remains terminal", "SESSION_EXISTS")


func history_contracts() -> void:
	var definition = catalog.record("core.circuit.hillside")
	if not accepted(
		tracks.create("history", {"circuit_id": "core.circuit.hillside"}), "Open authored circuit"
	):
		return
	var initial = read("history")
	var copied = tracks.create("copy", {"document": initial.document})
	if accepted(copied, "Create directly from an SDK-owned document read"):
		same(
			copied.result.document,
			initial.document,
			"SDK read-to-create works without a JSON workaround"
		)
	var draft = initial.document.duplicate(true)
	draft.name = "SDK edited circuit"
	var committed = tracks.commit("history", draft, initial.revision)
	if not accepted(committed, "Commit one explicit editing transaction"):
		return
	var changed = committed.result.duplicate(true)
	check(
		changed.undo_depth == 1 and changed.revision > initial.revision,
		"Commit creates one revision and undo item"
	)
	draft.nodes[0].x += 500.0
	same(read("history"), changed, "Committed authoring values do not alias the caller")
	rejected(
		tracks.commit("history", initial.document, initial.revision),
		"Stale commit",
		"DOMAIN_REJECTED"
	)
	rejected(
		tracks.edit(
			"history", "transform", {"selected": [0], "delta": {"x": 12, "y": 0}}, initial.revision
		),
		"Stale pure edit",
		"STALE_REVISION"
	)
	same(read("history"), changed, "Stale operations preserve history and data")
	var undone = tracks.undo("history").result
	same(undone.document, initial.document, "Undo restores the entire original authoring value")
	check(undone.redo_depth == 1, "Undo preserves the redo branch")
	same(tracks.cancel("history").result, undone, "Cancel leaves revision and redo untouched")
	var redone = tracks.redo("history").result
	same(redone.document, changed.document, "Redo restores the one committed draft")
	var edit = {"selected": [0], "delta": {"x": 12, "y": -4}}
	var transformed = tracks.edit("history", "transform", edit, redone.revision)
	if accepted(transformed, "Apply existing pure track transformation"):
		var expected = TrackEdit.transform(redone.document, "road", [0], Vector2(12, -4), 0, 1)
		same(
			transformed.result.document,
			expected.document,
			"SDK edit matches the production pure operation"
		)
	var before_compile = read("history")
	var compiled = tracks.compile("history")
	if accepted(compiled, "Compile detached JSON runtime geometry"):
		var reference = TrackEditorSession.new(before_compile.document)
		reference.content_catalog = catalog
		var geometry = reference.compile_draft(before_compile.document, "core.vehicle.formula")
		same(
			compiled.result.runtime,
			geometry.runtime_export(),
			"Runtime compilation matches the production compiler"
		)
		check(compiled.result.diagnostics is Array, "Compilation exposes JSON diagnostics")
		compiled.result.runtime.clear()
		check(
			not tracks.compile("history").result.runtime.is_empty(),
			"Runtime export does not alias editor geometry"
		)
	same(read("history"), before_compile, "Compilation and diagnostics cannot create revisions")
	same(
		catalog.record("core.circuit.hillside"),
		definition,
		"Tool editor never mutates sealed source content"
	)
	for parameters in [
		{"selected": [9999]},
		{"selected": [0], "delta": {"x": "12", "y": 0}},
		{"selected": [0], "factor": 0},
		{"selected": [0], "unexpected": true}
	]:
		rejected(
			tracks.edit("history", "transform", parameters, before_compile.revision),
			"Malformed edit arguments"
		)
	same(read("history"), before_compile, "Malformed pure edits preserve complete editor state")


func protocol_parity() -> void:
	var toolbox = GameToolbox.new(catalog)
	var session = "track-parity"
	var native = tracks.create(session)
	var wire = dispatch(toolbox, "track.create", session)
	if (
		not accepted(native, "Direct SDK blank editor")
		or not accepted(wire, "Protocol blank editor")
	):
		toolbox.close()
		return
	same(wire.result, native.result, "Native and JSON editor creation")
	var document = native.result.document.duplicate(true)
	document.name = "JSON and native revision"
	var arguments: Dictionary = JSON.parse_string(
		JSON.stringify({"document": document, "expected_revision": native.result.revision})
	)
	native = tracks.commit(session, arguments.document, int(arguments.expected_revision))
	wire = dispatch(toolbox, "track.commit", session, arguments)
	same(wire.result, native.result, "Native and JSON editing commit")
	var stale = dispatch(toolbox, "track.commit", session, arguments)
	rejected(stale, "Protocol stale commit", "DOMAIN_REJECTED")
	same(
		dispatch(toolbox, "track.read", session).result,
		tracks.read(session).result,
		"Stale protocol commit is atomic"
	)
	for operation in ["undo", "cancel", "redo", "snapshot", "validate", "compile"]:
		match operation:
			"undo":
				native = tracks.undo(session)
			"cancel":
				native = tracks.cancel(session)
			"redo":
				native = tracks.redo(session)
			"snapshot":
				native = tracks.snapshot(session)
			"validate":
				native = tracks.validate(session)
			"compile":
				native = tracks.compile(session)
		wire = dispatch(toolbox, "track." + operation, session)
		check(wire.ok == native.ok, "Protocol shares editor operation acceptance")
		same(
			wire.get("result", wire.get("error")),
			native.get("result", native.get("error")),
			"Editor response parity: " + operation
		)
	toolbox.close()


func dispatch(
	toolbox: GameToolbox, operation: String, session: String, arguments: Dictionary = {}
) -> Dictionary:
	var request = {
		"protocol": "motorsport-manager-toolbox",
		"version": 1,
		"request_id": "track-test",
		"operation": operation,
		"session": session,
		"arguments": arguments
	}
	return json_round_trip(toolbox.execute(json_round_trip(request)))
