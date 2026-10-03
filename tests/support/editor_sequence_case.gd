extends RefCounted


## Test-only operation recipe; authority and revision/history stay in TrackEditorSession.
class FailurePort:
	extends TrackEditorPort
	var fail_writes = true
	var writes = 0

	func save_authoring(document: Dictionary) -> Dictionary:
		writes += 1
		if fail_writes:
			return {"ok": false, "error": "Injected sequence write failure"}
		document.id = "custom-sequence"
		document.builtin = false
		return {"ok": true, "document": document}


var session: TrackEditorSession
var draft: Dictionary = {}
var observed_revision = -1
var stale: Dictionary = {}
var stale_revision = -1
var initial: Dictionary = {}
var operations: Array = []
var checks = 0
var failures: Array = []
var index = -1
var port = FailurePort.new()
var stats = {"commits": 0, "rejections": 0, "save_failures": 0, "retries": 0, "previews": 0}


func check(value: bool, invariant: String, evidence: Dictionary = {}) -> void:
	checks += 1
	if not value:
		failures.append({"index": index, "invariant": invariant, "evidence": evidence})


func configure(document: Dictionary, recipe: Array) -> void:
	session = TrackEditorSession.new(document)
	initial = session.read_document()
	operations = recipe.duplicate(true)


func run() -> Dictionary:
	for next in operations.size():
		index = next
		apply(operations[index])
		check(
			(
				session.history().past.size() <= TrackEditorSession.HISTORY_LIMIT
				and session.history().future.size() <= TrackEditorSession.HISTORY_LIMIT
			),
			"Generated editor history remains bounded"
		)
		if not failures.is_empty():
			break
	return {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"stats": stats,
		"state": session.read_document(),
		"revision": session.revision,
		"history": session.history(),
		"saved_signature": session.saved_signature()
	}


func begin() -> void:
	# A new pointer draft explicitly abandons the previous temporary draft.
	session.cancel()
	session.begin()
	draft = session.read_document()
	observed_revision = session.revision


func apply(operation: Dictionary) -> void:
	var before = session.read_document()
	var history = session.history()
	var revision = session.revision
	match operation.op:
		"begin":
			begin()
		"transform":
			transform_draft(operation, before)
		"commit":
			commit_draft(before, history, revision)
		"cancel":
			session.cancel()
			draft = {}
			check(
				(
					session.read_document() == before
					and session.history() == history
					and session.revision == revision
				),
				"Cancel preserves the canonical document, redo and revision"
			)
		"undo", "redo":
			var undoing = operation.op == "undo"
			var value = session.undo() if undoing else session.redo()
			var entries: Array = history.past if undoing else history.future
			check(
				value == (entries.back() if not entries.is_empty() else before),
				(
					"Undo restores the previous canonical document"
					if undoing
					else "Redo restores the retained future document"
				)
			)
		"remember_draft":
			stale = session.read_document()
			stale.name = "Older draft at operation %d" % index
			stale_revision = session.revision
		"stale_commit":
			reject_stale_draft(before, history, revision)
		"replace":
			check(session.replace(initial), "Replacing from a valid detached document succeeds")
			check(
				(
					session.history().past.is_empty()
					and session.history().future.is_empty()
					and session.revision > revision
				),
				"Replacement clears history but never resets the monotonic revision"
			)
		"save_failure":
			save_failure()
		"retry":
			port.fail_writes = false
			var result = session.save(port, session.read_document(), session.revision)
			check(
				result.ok and session.saved_signature() == JSON.stringify(session.read_document()),
				"Retry saves the retained document and marks exactly the accepted value"
			)
			stats.retries += 1
		"observe":
			var value = session.read_document()
			value.clear()
			var returned = session.history()
			returned.past.clear()
			check(
				(
					session.read_document() == before
					and session.history() == history
					and session.revision == revision
				),
				"Repeated editor reads and caller mutations cannot edit canonical state"
			)
		"preview":
			preview_document(before, history, revision)
		_:
			check(false, "Unknown editor operation in a bounded test recipe", operation)


func save_failure() -> void:
	begin()
	draft.name = "Retained after failed save %d" % index
	var signature = session.saved_signature()
	var writes = port.writes
	port.fail_writes = true
	var result = session.save(port, draft, observed_revision)
	check(
		not result.ok and port.writes == writes + 1,
		"Injected write failure is actually reached through the persistence port"
	)
	check(
		session.read_document() == draft and session.saved_signature() == signature,
		"Failed save retains work and does not mark it saved"
	)
	draft = {}
	stats.save_failures += 1


func transform_draft(operation: Dictionary, before: Dictionary) -> void:
	if draft.is_empty():
		begin()
	var source = draft.duplicate(true)
	var ids: Array = range(draft.nodes.size())
	var transformed = TrackEdit.transform(
		draft, "road", ids, Vector2(operation.dx, operation.dy), float(operation.degrees)
	)
	check(
		transformed.ok and draft == source and session.read_document() == before,
		"Pure transformation neither mutates its caller nor the canonical document"
	)
	if transformed.ok:
		draft = transformed.document


func commit_draft(before: Dictionary, history: Dictionary, revision: int) -> void:
	if draft.is_empty():
		begin()
	var accepted = session.commit(draft, observed_revision)
	if observed_revision != revision:
		check(
			not accepted and session.read_document() == before and session.history() == history,
			"A draft's observed revision is never silently advanced by intervening history"
		)
		stats.rejections += 1
	else:
		check(accepted, "Current valid editor draft commits", {"error": session.last_error})
		check(
			(
				session.history().past.size()
				== mini(
					TrackEditorSession.HISTORY_LIMIT,
					history.past.size() + (1 if draft != before else 0)
				)
			),
			"One committed gesture creates at most one undo entry"
		)
		stats.commits += 1
	draft = {}


func reject_stale_draft(before: Dictionary, history: Dictionary, revision: int) -> void:
	if not stale.is_empty() and stale_revision != revision:
		check(
			(
				not session.commit(stale, stale_revision)
				and session.read_document() == before
				and session.history() == history
			),
			"A stale operation remains stale after replacement, undo, redo or save"
		)
		stats.rejections += 1


func preview_document(before: Dictionary, history: Dictionary, revision: int) -> void:
	var geometry = session.compile_draft(session.read_document())
	check(geometry != null, "Generated valid document compiles through the session")
	if geometry != null:
		session.preview.toggle(geometry)
		session.advance_preview(0.05)
		session.preview.stop()
	check(
		(
			session.read_document() == before
			and session.history() == history
			and session.revision == revision
		),
		"Preview start, progress and cancellation create no editing transaction"
	)
	stats.previews += 1
