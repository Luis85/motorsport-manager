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
		if fail_writes:
			return {"ok": false, "error": "Injected disk failure"}
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
			nested = session.save(self, document, session.revision)
			var newer = session.read_document()
			newer.name = "Edited during persistence"
			session.commit(newer, session.revision)
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
	var source = Storage.read_json("res://config/circuits/hillside.json").data
	var session = TrackEditorSession.new(source)
	var original = session.read_document()
	draft_contract_tests(original)
	source.nodes[0][0] += 500
	check(session.read_document() == original, "Editor owns its input rather than a library alias")
	var draft = session.read_document()
	session.begin()
	draft.nodes[0].x += 12
	check(
		session.read_document() == original and session.history().past.is_empty(),
		"An in-flight gesture does not change the document or history"
	)
	check(session.commit(draft, session.revision), "A valid gesture commits")
	draft.nodes[0].x += 100
	check(
		session.read_document().nodes[0].x == original.nodes[0].x + 12,
		"Committed document does not alias the gesture draft"
	)
	check(session.history().past.size() == 1, "One gesture creates one undo transaction")
	var after = session.read_document()
	check(session.undo() == original, "Undo restores the entire previous authoring value")
	var revision = session.revision
	session.begin()
	draft = session.read_document()
	draft.name = "Cancelled"
	check(
		session.cancel() == original and session.history().future.size() == 1,
		"Cancel retains canonical data and the redo branch"
	)
	check(session.revision == revision, "Cancelled gestures do not create revisions")
	check(session.redo() == after, "Redo retains the committed gesture")
	var history = session.history()
	history.past.clear()
	check(session.history().past.size() == 1, "History queries are detached")
	check(
		(
			session.commit(session.read_document(), session.revision)
			and session.history().past.size() == 1
		),
		"No-op commits create no history"
	)
	for invalid in [NAN, INF, -INF]:
		draft = session.read_document()
		draft.nodes[0].x = invalid
		check(
			not session.commit(draft, session.revision) and session.read_document() == after,
			"Non-finite input fails before mutation"
		)
	var bad = session.read_document()
	bad.nodes = [Node.new()]
	check(
		not session.commit(bad, session.revision),
		"Engine objects cannot enter serialized authoring state"
	)
	bad.nodes[0].free()
	check(
		not session.replace({"nodes": "bad"}) and session.read_document() == after,
		"Malformed replacement cannot destroy the current document"
	)
	for change in [
		{"features": [42]},
		{"pits": ["wrong"]},
		{"objects": [1]},
		{"reference": {"width": -1}},
		{"start": "wrong"},
		{"visual": {"environment": "unsupported"}}
	]:
		bad = session.read_document()
		bad.merge(change, true)
		check(
			not session.commit(bad, session.revision) and session.read_document() == after,
			"Malformed nested draft is rejected without losing work"
		)
		check(
			session.compile_draft(bad) == null,
			"Malformed nested data never reaches geometry compilation"
		)
	for index in range(55):
		draft = session.read_document()
		draft.name = "Revision %d" % index
		check(session.commit(draft, session.revision), "Valid edit is committed")
	check(
		session.history().past.size() == TrackEditorSession.HISTORY_LIMIT,
		"History memory is bounded"
	)
	var port = FakePort.new()
	var saved = session.saved_signature()
	draft = session.read_document()
	draft.name = "Unsaved edit"
	var result = session.save(port, draft, session.revision)
	check(
		not result.ok and session.saved_signature() == saved,
		"A failed write never marks the draft saved"
	)
	check(
		session.read_document().name == "Unsaved edit",
		"A failed write retains the player's edited work"
	)
	port.fail_writes = false
	check(
		session.save(port, session.read_document(), session.revision).ok,
		"Successful write returns the saved authoring identity"
	)
	check(
		session.read_document().id == "custom-tested",
		"Saved identity is applied after successful persistence only"
	)
	check(
		session.saved_signature() == JSON.stringify(session.read_document()),
		"Saved signature follows exactly the committed value"
	)
	var previous_signature = session.saved_signature()
	var nested = ReentrantPort.new()
	nested.session = session
	var receipt = session.save(nested, session.read_document(), session.revision)
	check(
		not receipt.ok and receipt.get("saved", false),
		"Saving an older revision reports that newer edits remain unsaved"
	)
	check(
		not nested.nested.ok and nested.writes == 1,
		"Reentrant track save cannot create a second repository write"
	)
	check(
		(
			session.read_document().name == "Edited during persistence"
			and session.saved_signature() == previous_signature
		),
		"A stale save receipt never overwrites current work or marks it saved"
	)
	var latest = session.read_document()
	check(
		(
			not session.save(ChangedPort.new(), latest, session.revision).ok
			and session.read_document() == latest
		),
		"Repository must not alter the authored geometry in its save receipt"
	)
	var geometry = session.compile_draft(session.read_document())
	var immutable = session.read_document()
	geometry.document.nodes[0].x = 0
	check(session.read_document() == immutable, "Compiled preview cannot edit authoring state")
	check(
		not session.preview.has_method("advance"),
		"Editor canvas preview handle exposes no clock operation"
	)
	session.preview.toggle(geometry)
	var before = session.preview.capture()
	var frame = session.preview.capture()
	frame.distance = 900
	check(session.preview.capture() == before, "Preview readout is detached")
	for invalid in [-1.0, NAN, INF]:
		session.advance_preview(invalid)
	check(session.preview.capture() == before, "Invalid preview time is rejected")
	session.advance_preview(0.08)
	check(
		session.preview.capture().distance > 0 and session.read_document() == immutable,
		"Application advances reference preview without editing the document"
	)
	session.begin()
	draft = session.read_document()
	draft.name = "New topology revision"
	session.commit(draft, session.revision)
	check(
		not session.preview.capture().running,
		"Document revision invalidates the running reference preview"
	)
	check(
		(
			session.replace(original)
			and session.history().past.is_empty()
			and session.history().future.is_empty()
		),
		"Replace resets authoring history explicitly"
	)
	check(
		session.export_authoring(port, "fixture.json", original).is_empty(),
		"Application exports a validated detached authoring value"
	)
	check(
		session.read_document() == original and port.exports.size() == 1,
		"An export adapter cannot mutate canonical editor state"
	)
	bad = original.duplicate(true)
	bad.closed = false
	check(
		(
			not session.export_runtime(port, "fixture-runtime.json", bad, "Formula").is_empty()
			and port.exports.size() == 1
		),
		"Unfinished runtime export is rejected before writing"
	)
	check(session.commit(bad, session.revision), "An open circuit remains a legal editing draft")
	check(
		not session.export_authoring(port, "fixture.json", bad).is_empty(),
		"Export revalidates at execution, not only when the dialog opened"
	)
	# A draft carries the revision observed when it was created. Undo/replace/save
	# cannot turn a delayed commit into an unguarded immediate edit.
	var guarded = TrackEditorSession.new(original)
	var first = guarded.read_document()
	var first_revision = guarded.revision
	first.name = "Committed first"
	check(
		guarded.commit(first, first_revision),
		"Revision-bound edit commits on its observed document"
	)
	var delayed = guarded.read_document()
	var delayed_revision = guarded.revision
	delayed.name = "Delayed gesture"
	guarded.begin()
	guarded.undo()
	var state_before = guarded.read_document()
	var history_before = guarded.history()
	check(
		not guarded.commit(delayed, delayed_revision),
		"Undo invalidates a delayed gesture even after clearing the transaction marker"
	)
	check(
		guarded.read_document() == state_before and guarded.history() == history_before,
		"Stale rejection preserves canonical road and redo history"
	)
	var writes_before = port.writes
	check(
		not guarded.save(port, delayed, delayed_revision).ok and port.writes == writes_before,
		"Stale saves never reach the repository"
	)
	guarded.redo()
	check(
		not guarded.commit(delayed, delayed_revision), "Redo cannot resurrect an old edit revision"
	)
	guarded.replace(original)
	check(
		not guarded.commit(delayed, delayed_revision),
		"Document replacement also rejects prior revision drafts"
	)
	var current = guarded.read_document()
	check(
		guarded.commit(current, guarded.revision),
		"No-op edit on the current revision remains valid"
	)
	running_track_isolation(original)
	var compilation = compilation_measurements(original)
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"compilation": compilation
	}
	Storage.write_json("res://reports/editor-session-tests.json", report)
	print("EDITOR_SESSION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)


func draft_contract_tests(document: Dictionary) -> void:
	var before = RaceStateValue.fingerprint(document)
	check(
		(
			TrackDocument.draft_errors(document).is_empty()
			and TrackDocument.publication_errors(document).is_empty()
		),
		"The pure document owner accepts a complete normalized circuit"
	)
	var unfinished = document.duplicate(true)
	unfinished.nodes = [unfinished.nodes[0]]
	unfinished.closed = false
	unfinished.name = ""
	check(
		TrackDocument.draft_errors(unfinished).is_empty(),
		"An unnamed open one-point road is a safe editable draft"
	)
	check(
		not TrackDocument.publication_errors(unfinished).is_empty(),
		"Publishing does not confuse a safe draft with a complete circuit"
	)
	var invalid = unfinished.duplicate(true)
	invalid.visual = []
	check(
		TrackDocument.draft_errors(invalid) == ["Invalid draft metadata: visual"],
		"Draft validation preserves actionable first-stage metadata errors"
	)
	check(
		TrackDocument.publication_errors(invalid) == TrackDocument.draft_errors(invalid),
		"Publishing returns draft errors before complete-road errors"
	)
	invalid = document.duplicate(true)
	invalid.nodes[0].w = 4
	check(
		TrackDocument.draft_errors(invalid) == ["Road width must remain between 5 and 40 metres."],
		"Editable road-width policy is owned by the pure document contract"
	)
	for value in [NAN, INF, -INF, RefCounted.new(), Vector2.ZERO, {1: "non-string key"}]:
		check(
			not TrackDocument.serializable(value), "Only finite serialized values can enter a draft"
		)
	var cycle: Array = []
	cycle.append(cycle)
	check(
		not TrackDocument.serializable(cycle),
		"A cyclic draft is rejected by the bounded traversal before duplication"
	)
	cycle.clear()
	var oversized: Array = []
	oversized.resize(20001)
	check(
		not TrackDocument.serializable(oversized),
		"Serialized collections retain their existing size limit"
	)
	check(
		before == RaceStateValue.fingerprint(document),
		"Draft and publication validation never normalize or mutate the caller's document"
	)


func running_track_isolation(document: Dictionary) -> void:
	var editor = TrackEditorSession.new(document)
	var geometry = editor.compile_draft(editor.read_document())
	check(
		geometry != null, "A valid editor draft compiles for the running-weekend isolation fixture"
	)
	if geometry == null:
		return
	var running = PracticeRaceSim.new(geometry, {"scenario": "dry", "intensity": "calm"})
	check(
		running.command("practice_start"),
		"The editor isolation fixture enters an actual practice session"
	)
	var controls = MinimalRaceControls.new()
	controls.configure(running)
	check(controls.send_out(3), "The running-weekend fixture explicitly releases a managed driver")
	for index in range(40):
		running.step()
	var expected = RaceStateValue.fingerprint(running.snapshot())
	var road = RaceStateValue.fingerprint(running.track.runtime_export())
	var draft = editor.read_document()
	draft.nodes[0].x += 20
	check(
		editor.commit(draft, editor.revision),
		"Editing the source circuit remains possible while a weekend owns its snapshot"
	)
	editor.undo()
	editor.redo()
	check(editor.replace(document), "Replacing the source resets only its editor session")
	geometry.document.nodes[0].x += 200
	geometry.points.clear()
	check(
		(
			expected == RaceStateValue.fingerprint(running.snapshot())
			and road == RaceStateValue.fingerprint(running.track.runtime_export())
		),
		"Source edits, undo, redo, replacement and compiled aliases cannot change an already running weekend"
	)


func compilation_measurements(document: Dictionary) -> Dictionary:
	var editor = TrackEditorSession.new(document)
	var before = RaceStateValue.fingerprint(editor.read_document())
	var workloads: Array = []
	for fast in [true, false]:
		var total_samples: Array[int] = []
		var geometry_samples: Array[int] = []
		for index in range(6):
			var started = Time.get_ticks_usec()
			var geometry = editor.compile_draft(document, "Formula", fast)
			var elapsed = Time.get_ticks_usec() - started
			check(
				geometry != null and geometry.preview_only == fast,
				"Compilation measurement performs the requested real preview/full bake"
			)
			if index > 0:
				total_samples.append(elapsed)
				geometry_samples.append(editor.compile_usec)
		total_samples.sort()
		geometry_samples.sort()
		workloads.append(
			{
				"preview": fast,
				"samples": 5,
				"application_median_us": total_samples[2],
				"application_max_us": total_samples[4],
				"geometry_median_us": geometry_samples[2],
				"geometry_max_us": geometry_samples[4]
			}
		)
	check(
		before == RaceStateValue.fingerprint(editor.read_document()),
		"Repeated measured compilation does not edit the canonical authoring document"
	)
	return {
		"engine": Engine.get_version_info().string,
		"cpu": OS.get_processor_name(),
		"track": document.name,
		"nodes": document.nodes.size(),
		"vehicle": "Formula",
		"workloads": workloads,
		"scope":
		(
			"One warmup plus five serial samples per mode on the populated built-in "
			+ "circuit. Application time includes draft validation and copying; geometry "
			+ "time is the existing compile_usec observation. No simulation or rendering "
			+ "time, threshold, baseline speedup or player-device claim. Source identity "
			+ "belongs to the parent verification report."
		)
	}
