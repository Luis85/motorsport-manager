class_name TrackEditorAuthoring
extends TrackEditorStorage
## Native presentation responsibilities; inherited state remains per instance.


func delete_point() -> void:
	var layer = (
		"scenery" if canvas.selected_object >= 0 else ("pits" if canvas.mode == "pit" else "road")
	)
	if not canvas.layer_editable(layer):
		status.text = "Layer is hidden or locked. Unlock it in World."
		return
	if canvas.selection_ids.size() > 1:
		selection_action("delete")
		return
	if canvas.selected_object >= 0 and canvas.selected_object < document.objects.size():
		perform(
			func():
				document.objects.remove_at(canvas.selected_object)
				canvas.selected_object = -1,
			true
		)
		return
	if canvas.mode == "pit" and canvas.selected_pit >= 0 and not document.pits.is_empty():
		perform(
			func():
				document.pits[0].nodes.remove_at(canvas.selected_pit)
				canvas.selected_pit = -1,
			true
		)
		return
	if canvas.selected < 0:
		return
	if document.nodes.size() <= 4:
		UI.notify(self, "Keep a closed circuit", "A circuit must retain at least four points.")
		return
	perform(
		func():
			document.nodes.remove_at(canvas.selected)
			canvas.selected = -1,
		true
	)


func set_tool(index: int) -> void:
	canvas._commit_drag()
	canvas.mode = [
		"select",
		"insert",
		"draw",
		"pit",
		"start",
		"scenery",
		"measure",
		"reference",
		"trace_freehand",
		"trace_pen",
		"select_objects"
	][index]
	if tool_picker:
		tool_picker.select(index)
	canvas.selected_object = -1
	canvas.selected = -1
	canvas.selection_ids.clear()
	call("refresh_inspector")
	canvas.queue_redraw()
	if index in [8, 9]:
		inspector.current_tab = 6
	if index == 10:
		canvas.selection_kind = "scenery"
	update_status()


func focus_finding(index: int) -> void:
	if index < 0 or index >= findings.size():
		return
	var finding = findings[index]
	var p = geometry.sample(finding.fraction * geometry.length, true).p
	canvas.center = p
	canvas.zoom = maxf(canvas.zoom, 0.75)
	canvas.selected = geometry.nearest(p).segment
	canvas.queue_redraw()
	status.text = finding.message


func set_sector(index: int) -> void:
	if canvas.selected < 0:
		return
	var fraction: float = (
		geometry.nearest(TrackDocument.point(document.nodes[canvas.selected])).fraction
	)
	perform(
		func():
			var gates: Array = []
			for i in range(2):
				var f = fposmod(geometry.sector_ends[i] / geometry.length + document.start, 1)
				gates.append({"type": "sector", "f": fraction if i == index else f})
			document.timingGates = gates,
		true
	)


func apply_selection_result(result: Dictionary) -> void:
	if not canvas.layer_editable(canvas.selection_kind):
		status.text = "Unlock and show the selected layer first."
		return
	if not result.ok:
		status.text = result.error
		return
	if document == result.document:
		status.text = "Selection is already arranged that way."
		return
	checkpoint()
	document = result.document
	canvas.selection_ids = TrackEdit.indices(document, canvas.selection_kind, result.selection)
	canvas.selected = (
		canvas.selection_ids[0]
		if canvas.selection_kind == "road" and not canvas.selection_ids.is_empty()
		else -1
	)
	canvas.selected_object = (
		canvas.selection_ids[0]
		if canvas.selection_kind == "scenery" and not canvas.selection_ids.is_empty()
		else -1
	)
	recompile()
	call("refresh_inspector")


func selection_action(action: String) -> void:
	var kind = canvas.selection_kind
	var ids: Array = canvas.selection_ids.duplicate()
	if ids.is_empty():
		if canvas.selected_object >= 0:
			kind = "scenery"
			ids = [canvas.selected_object]
		elif canvas.selected >= 0:
			kind = "road"
			ids = [canvas.selected]
	canvas.selection_kind = kind
	if not canvas.layer_editable(kind):
		status.text = "The selected layer is hidden or locked."
		return
	if action in ["duplicate", "group", "ungroup"] and kind != "scenery":
		status.text = "Grouping and duplication apply to scenery, not road topology."
		return
	match action:
		"duplicate":
			apply_selection_result(TrackEdit.duplicate_scenery(document, ids))
		"group", "ungroup":
			apply_selection_result(TrackEdit.group(document, ids, action == "ungroup"))
		"align_x", "align_y", "distribute_x", "distribute_y":
			apply_selection_result(
				TrackEdit.arrange(
					document, kind, ids, action.right(1), action.begins_with("distribute")
				)
			)
		"delete":
			var selected_indices = TrackEdit.indices(document, kind, ids)
			if selected_indices.is_empty():
				return
			if kind == "road" and document.nodes.size() - selected_indices.size() < 4:
				status.text = "Keep at least four road points."
				return
			var copy = document.duplicate(true)
			var items: Array = copy.nodes if kind == "road" else copy.objects
			selected_indices.reverse()
			for index in selected_indices:
				items.remove_at(index)
			apply_selection_result({"ok": true, "document": copy, "selection": []})


func invalidate_sketch() -> void:
	sketch_result.clear()
	canvas.sketch_preview = null
	canvas.queue_redraw()
	update_sketch_panel()
	update_status()


func update_sketch_panel() -> void:
	if not sketch_summary or not is_instance_valid(sketch_summary):
		return
	var points = canvas.sketch.points()
	sketch_close_button.text = "Loop closed" if canvas.sketch.closed else "Close loop"
	sketch_close_button.disabled = canvas.sketch.closed or points.size() < 4
	sketch_summary.text = (
		"%s · %d strokes · %d samples\n%s"
		% [
			"CLOSED" if canvas.sketch.closed else "OPEN",
			canvas.sketch.strokes.size(),
			points.size(),
			canvas.sketch_note
		]
	)
	if sketch_result.get("ok", false):
		sketch_summary.text += (
			"\nPreview: %d road points · %.2f km"
			% [sketch_result.nodes, canvas.sketch_preview.length / 1000]
		)
	sketch_preview_button.disabled = not canvas.sketch.closed or not canvas.layer_editable("road")
	sketch_apply_button.disabled = (
		not sketch_result.get("ok", false) or not canvas.layer_editable("road")
	)


func preview_sketch() -> void:
	if not canvas.layer_editable("road"):
		return
	sketch_result = canvas.sketch.compile(document)
	if sketch_result.ok:
		canvas.sketch_preview = session.compile_draft(sketch_result.document, vehicle)
		var diagnostics = session.diagnostics(canvas.sketch_preview)
		if TrackDiagnostics.blocking(diagnostics):
			sketch_result.ok = false
			canvas.sketch_note = "Preview has blocking crossings. Adjust the trace before replacing the road."
		else:
			canvas.sketch_note = "Teal is the generated road. Nothing has been replaced yet."
	else:
		canvas.sketch_note = sketch_result.error
	update_sketch_panel()
	canvas.queue_redraw()


func apply_sketch() -> void:
	if not sketch_result.get("ok", false) or not canvas.layer_editable("road"):
		return
	UI.confirm(
		self,
		"Replace this road?",
		(
			"Apply the preview and clear the old pit route, track features and timing "
			+ "markers? Scenery and reference remain. Undo restores the original circuit."
		),
		"Replace road",
		commit_sketch
	)


func commit_sketch() -> void:
	if not sketch_result.get("ok", false) or not canvas.layer_editable("road"):
		return
	checkpoint()
	document = sketch_result.document.duplicate(true)
	canvas.sketch.clear()
	canvas.pen_anchor = Vector2.INF
	canvas.sketch_preview = null
	sketch_result.clear()
	canvas.selection_ids.clear()
	canvas.selected = -1
	canvas.selected_object = -1
	recompile()
	call("refresh_inspector")
	set_tool(0)
	status.text = (
		"Traced road applied. Review the generated pit lane and timing before driving. "
		+ "Undo restores the original."
	)


func confirm_clear_trace() -> void:
	if canvas.sketch.strokes.is_empty():
		return
	UI.confirm(
		self,
		"Clear the unapplied trace?",
		(
			"Discard these drawing strokes and their preview? The existing road and saved "
			+ "library files stay unchanged. This clears trace history."
		),
		"Clear trace",
		func():
			canvas.sketch.clear()
			canvas.pen_anchor = Vector2.INF
			invalidate_sketch(),
	)
