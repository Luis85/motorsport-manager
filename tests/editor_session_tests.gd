extends SceneTree
var checks: int = 0
var failures: Array[String] = []

class FakePort:
	extends TrackEditorPort
	var fail_writes: bool = true
	var writes: int = 0
	var exports: Array = []
	func export_value(path: String, value: Dictionary) -> String:
		exports.append({"path": path, "value": value.duplicate(true)})
		value.clear()
		return ""
	func save_authoring(document: Dictionary) -> Dictionary:
		writes += 1
		if fail_writes: return {"ok": false, "error": "Injected disk failure"}
		document.builtin = false
		document.id = "custom-tested"
		return {"ok": true, "error": "", "document": document}

class ReentrantPort:
	extends TrackEditorPort
	var session: TrackEditorSession
	var nested: Dictionary
	var writes: int = 0
	func save_authoring(document: Dictionary) -> Dictionary:
		writes += 1
		if writes == 1:
			nested = session.save(self, document)
			var newer = session.read_document()
			newer.name = "Edited during persistence"
			session.commit(newer)
		return {"ok": true, "document": document}

class ChangedPort:
	extends TrackEditorPort
	func save_authoring(document: Dictionary) -> Dictionary:
		document.nodes[0].x += 1.0
		return {"ok": true, "document": document}

func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)

func _initialize() -> void:
	call_deferred("run")

func run() -> void:
	var source = Storage.read_json("res://data/tracks/hillside.json").data
	var session = TrackEditorSession.new(source)
	var original = session.read_document()
	source.nodes[0][0] += 500
	check(session.read_document() == original, "Editor owns its input rather than a library alias")
	var draft = session.read_document()
	session.begin()
	draft.nodes[0].x += 12
	check(session.read_document() == original and session.history().past.is_empty(), "An in-flight gesture does not change the document or history")
	check(session.commit(draft), "A valid gesture commits")
	draft.nodes[0].x += 100
	check(session.read_document().nodes[0].x == original.nodes[0].x + 12, "Committed document does not alias the gesture draft")
	check(session.history().past.size() == 1, "One gesture creates one undo transaction")
	var after = session.read_document()
	check(session.undo() == original, "Undo restores the entire previous authoring value")
	var revision = session.revision
	session.begin()
	draft = session.read_document(); draft.name = "Cancelled"
	check(session.cancel() == original and session.history().future.size() == 1, "Cancel retains canonical data and the redo branch")
	check(session.revision == revision, "Cancelled gestures do not create revisions")
	check(session.redo() == after, "Redo retains the committed gesture")
	var history = session.history(); history.past.clear()
	check(session.history().past.size() == 1, "History queries are detached")
	check(session.commit(session.read_document()) and session.history().past.size() == 1, "No-op commits create no history")
	for invalid in [NAN, INF, -INF]:
		draft = session.read_document(); draft.nodes[0].x = invalid
		check(not session.commit(draft) and session.read_document() == after, "Non-finite input fails before mutation")
	var bad = session.read_document(); bad.nodes = [Node.new()]
	check(not session.commit(bad), "Engine objects cannot enter serialized authoring state")
	bad.nodes[0].free()
	check(not session.replace({"nodes": "bad"}) and session.read_document() == after, "Malformed replacement cannot destroy the current document")
	for change in [{"features": [42]}, {"pits": ["wrong"]}, {"objects": [1]}, {"reference": {"width": -1}}, {"start": "wrong"}, {"visual": {"environment": "unsupported"}}]:
		bad = session.read_document()
		bad.merge(change, true)
		check(not session.commit(bad) and session.read_document() == after, "Malformed nested draft is rejected without losing work")
		check(session.compile_draft(bad) == null, "Malformed nested data never reaches geometry compilation")
	for index in range(55):
		draft = session.read_document(); draft.name = "Revision %d" % index
		check(session.commit(draft), "Valid edit is committed")
	check(session.history().past.size() == TrackEditorSession.HISTORY_LIMIT, "History memory is bounded")
	var port = FakePort.new()
	var saved = session.saved_signature()
	draft = session.read_document(); draft.name = "Unsaved edit"
	var result = session.save(port, draft)
	check(not result.ok and session.saved_signature() == saved, "A failed write never marks the draft saved")
	check(session.read_document().name == "Unsaved edit", "A failed write retains the player's edited work")
	port.fail_writes = false
	check(session.save(port, session.read_document()).ok, "Successful write returns the saved authoring identity")
	check(session.read_document().id == "custom-tested", "Saved identity is applied after successful persistence only")
	check(session.saved_signature() == JSON.stringify(session.read_document()), "Saved signature follows exactly the committed value")
	var previous_signature = session.saved_signature()
	var nested = ReentrantPort.new()
	nested.session = session
	var receipt = session.save(nested, session.read_document())
	check(not receipt.ok and receipt.get("saved", false), "Saving an older revision reports that newer edits remain unsaved")
	check(not nested.nested.ok and nested.writes == 1, "Reentrant track save cannot create a second repository write")
	check(session.read_document().name == "Edited during persistence" and session.saved_signature() == previous_signature, "A stale save receipt never overwrites current work or marks it saved")
	var latest = session.read_document()
	check(not session.save(ChangedPort.new(), latest).ok and session.read_document() == latest, "Repository must not alter the authored geometry in its save receipt")
	var geometry = session.compile_draft(session.read_document())
	var immutable = session.read_document()
	geometry.document.nodes[0].x = 0
	check(session.read_document() == immutable, "Compiled preview cannot edit authoring state")
	session.preview.toggle(geometry)
	var before = session.preview.capture()
	var frame = session.preview.capture(); frame.distance = 900
	check(session.preview.capture() == before, "Preview readout is detached")
	for invalid in [-1.0, NAN, INF]: session.advance_preview(invalid)
	check(session.preview.capture() == before, "Invalid preview time is rejected")
	session.advance_preview(0.08)
	check(session.preview.capture().distance > 0 and session.read_document() == immutable, "Application advances reference preview without editing the document")
	session.begin(); draft = session.read_document(); draft.name = "New topology revision"; session.commit(draft)
	check(not session.preview.capture().running, "Document revision invalidates the running reference preview")
	check(session.replace(original) and session.history().past.is_empty() and session.history().future.is_empty(), "Replace resets authoring history explicitly")
	check(session.export_authoring(port, "fixture.json", original).is_empty(), "Application exports a validated detached authoring value")
	check(session.read_document() == original and port.exports.size() == 1, "An export adapter cannot mutate canonical editor state")
	bad = original.duplicate(true); bad.closed = false
	check(not session.export_runtime(port, "fixture-runtime.json", bad, "Formula").is_empty() and port.exports.size() == 1, "Unfinished runtime export is rejected before writing")
	check(session.commit(bad), "An open circuit remains a legal editing draft")
	check(not session.export_authoring(port, "fixture.json", bad).is_empty(), "Export revalidates at execution, not only when the dialog opened")
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/editor-session-tests.json", report)
	print("EDITOR_SESSION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
