class_name TrackEditorStorage
extends TrackEditorState
## Native presentation responsibilities; inherited state remains per instance.


func save_document() -> void:
	if name_field:
		document.name = name_field.text.strip_edges()
	var result = session.save(storage, document, document_revision)
	if result.ok:
		document = session.read_document()
		document_revision = session.revision
		recompile()
		call("invalidate_sketch")
		update_status()
		status.text = (
			(
				"Committed road saved. Your unapplied trace is still temporary; apply it before "
				+ "leaving."
			)
			if not canvas.sketch.strokes.is_empty()
			else "Saved to the track library. The Grand Prix selector will include this circuit."
		)
	else:
		update_status()
		UI.notify(self, "Could not save circuit", result.error)


func export_document() -> void:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		UI.notify(self, "Track needs attention", "\n".join(errors))
		return
	var dialog = UI.file_dialog(
		self,
		true,
		["*.json ; Track authoring JSON"],
		func(path):
			var error = session.export_authoring(storage, path, document)
			UI.notify(self, "Export circuit", "Track exported." if error.is_empty() else error),
	)
	dialog.current_file = document.name.validate_filename() + ".json"


func export_runtime() -> void:
	var errors = race_errors()
	if not errors.is_empty():
		UI.notify(self, "Track needs attention", "\n".join(errors))
		return
	var dialog = UI.file_dialog(
		self,
		true,
		["*.json ; Baked runtime JSON"],
		func(path):
			var error = session.export_runtime(storage, path, document, vehicle)
			(
				UI
				. notify(
					self,
					"Bake runtime",
					(
						(
							"Runtime package exported with geometry, racing line, speed profile, pit lane "
							+ "and authoring metadata."
						)
						if error.is_empty()
						else error
					)
				)
			),
	)
	dialog.current_file = document.name.validate_filename() + "-runtime.json"


func import_document() -> void:
	UI.file_dialog(
		self,
		false,
		["*.json ; Native or Circuit Atelier project"],
		func(path):
			var result = storage.load_authoring(path)
			if not result.ok:
				UI.notify(self, "Import failed", result.error)
				return
			var errors = TrackDocument.validate(result.data)
			if not errors.is_empty():
				UI.notify(self, "Import failed", "\n".join(errors))
				return
			confirm_discard(
				func():
					replace_document(result.data)
					document.builtin = false
					saved_signature = ""
					update_status(),
			),
	)


func import_reference() -> void:
	UI.file_dialog(
		self,
		false,
		["*.png,*.jpg,*.jpeg ; Reference image"],
		func(path):
			var result = storage.read_reference(path)
			if not result.ok:
				UI.notify(self, "Image unavailable", result.error)
				return
			perform(
				func():
					document.reference = {
						"png": result.png,
						"width": geometry.bounds.size.x,
						"x": geometry.bounds.get_center().x,
						"y": geometry.bounds.get_center().y,
						"opacity": 0.35
					},
				true
			),
	)


func new_document() -> void:
	confirm_discard(
		func():
			var nodes: Array = []
			for p in [
				Vector2(-300, -150), Vector2(300, -150), Vector2(300, 150), Vector2(-300, 150)
			]:
				nodes.append(TrackDocument.node_at(p))
			var d = TrackDocument.normalize(
				{"name": "My new circuit", "nodes": nodes, "closed": true}
			)
			for i in range(4):
				TrackDocument.smooth_node(d, i)
			replace_document(d)
			saved_signature = ""
			update_status(),
	)


func replace_document(d: Dictionary) -> void:
	if not session.replace(d):
		UI.notify(self, "Could not replace circuit", session.last_error)
		return
	canvas.sketch.clear()
	canvas.selection_ids.clear()
	canvas.sketch_preview = null
	sketch_result.clear()
	canvas.stroke.clear()
	canvas.pen_anchor = Vector2.INF
	document = session.read_document()
	document_revision = session.revision
	sync_history()
	canvas.selected = -1
	canvas.selected_pit = -1
	canvas.selected_object = -1
	feature_index = -1
	saved_signature = JSON.stringify(document)
	recompile()
	call("refresh_inspector")
	canvas.fit()


func confirm_discard(callback: Callable) -> void:
	if not dirty:
		callback.call()
		return
	UI.confirm(
		self,
		"Unsaved circuit changes",
		(
			"Discard unsaved circuit changes and any unapplied trace? Saved library files "
			+ "will not be deleted."
		),
		"Discard changes",
		callback
	)


func calibrate_reference() -> void:
	if (
		not document.has("reference")
		or canvas.measure_start == Vector2.INF
		or canvas.measure_end == Vector2.INF
	):
		return
	var measured = canvas.measure_start.distance_to(canvas.measure_end)
	if measured < 0.001:
		return
	var ratio = known_distance / measured
	var width = document.reference.width * ratio
	if width < 1 or width > 20000:
		UI.notify(
			self,
			"Calibration outside limits",
			"Image width must remain between 1 and 20,000 metres."
		)
		return
	var anchor = canvas.measure_start
	var target_center = (
		anchor + (Vector2(document.reference.x, document.reference.y) - anchor) * ratio
	)
	if absf(target_center.x) > 100000 or absf(target_center.y) > 100000:
		return
	perform(
		func():
			var center = Vector2(document.reference.x, document.reference.y)
			center = anchor + (center - anchor) * ratio
			document.reference.width = width
			document.reference.x = center.x
			document.reference.y = center.y,
		true
	)
	canvas.measure_end = anchor + (canvas.measure_end - anchor) * ratio
	canvas.queue_redraw()
	status.text = "Reference calibrated to %.2f m. Road geometry was not moved." % known_distance
