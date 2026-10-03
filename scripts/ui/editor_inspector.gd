class_name TrackEditorInspector
extends RefCounted
## Rebuilds fields from the displayed draft; mutations stay on editor commands.


static func render(editor: Control) -> void:
	if editor.inspector == null:
		return
	editor._refreshing_inspector = true
	var tab = editor.inspector.current_tab
	UI.clear(editor.inspector)
	var point = TrackEditorSelectionInspector.point(editor)
	var track = TrackEditorCircuitInspector.track(editor)
	var features = TrackEditorCircuitInspector.features(editor)
	var reference = TrackEditorWorkspaceInspector.reference_page(editor)
	TrackEditorWorkspaceInspector.checks(editor)
	TrackEditorWorkspaceInspector.look(editor)
	TrackEditorWorkspaceInspector.sketch_page(editor)
	# Locks apply to pointer gestures, inspector input and destructive keyboard actions.
	var point_layer = (
		"scenery"
		if editor.canvas.selected_object >= 0
		else ("pits" if editor.canvas.mode == "pit" else "road")
	)
	if not editor.canvas.layer_editable(point_layer):
		editor.disable_inputs(point)
	if not editor.canvas.layer_editable("road") or not editor.canvas.layer_editable("pits"):
		editor.disable_inputs(track)
	if not editor.canvas.layer_editable("features") or not editor.canvas.layer_editable("scenery"):
		editor.disable_inputs(features)
	if not editor.canvas.layer_editable("reference"):
		editor.disable_inputs(reference)
	editor.inspector.current_tab = clampi(tab, 0, editor.inspector.get_tab_count() - 1)
	editor.section_picker.select(editor.inspector.current_tab)
	editor.sketch_actions.visible = editor.inspector.current_tab == 6
	editor.context_bar.visible = editor.canvas.selection_ids.size() > 1
	editor.selection_summary.text = (
		"%d selected · %s" % [editor.canvas.selection_ids.size(), editor.canvas.selection_kind]
	)
	editor.update_sketch_panel()
	editor._refreshing_inspector = false
