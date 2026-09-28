class_name TrackEditorToolbar
extends RefCounted
## Builds controls; the editor session retains every document transaction.

static func build(editor: Control) -> void:
	var title_row = UI.hbox(editor)
	title_row.add_child(UI.label("CIRCUIT ATELIER", 23))
	editor.dirty_label = UI.label("SAVED", 12, UI.GOOD); title_row.add_child(editor.dirty_label)
	var space = Control.new(); space.size_flags_horizontal = Control.SIZE_EXPAND_FILL; title_row.add_child(space)
	title_row.add_child(UI.label("AUTHOR → VALIDATE → DRIVE", 12, UI.MUTED))
	title_row.add_child(UI.button("Editor guide", func(): editor.guide.open_guide()))
	var actions = HFlowContainer.new(); editor.add_child(actions)
	var choices: Array = ["Load a library circuit…"]
	for track in editor.catalog: choices.append(track.name)
	var library = UI.option(choices, func(index):
		if index > 0: editor.confirm_discard(func(): editor.replace_document(editor.catalog[index - 1])))
	library.custom_minimum_size.x = 260; actions.add_child(library)
	actions.add_child(UI.button("New circuit", editor.new_document))
	actions.add_child(UI.button("Save to library", editor.save_document))
	actions.add_child(UI.button("Import JSON", editor.import_document))
	actions.add_child(UI.button("Export JSON", editor.export_document))
	actions.add_child(UI.button("Bake runtime", editor.export_runtime))
	editor.test_button = UI.button("Test weekend", func():
		var errors = editor.race_errors()
		if errors.is_empty(): editor.test_requested.emit(editor.document.duplicate(true))
		else: UI.notify(editor, "Track needs attention", "\n".join(errors)), true)
	actions.add_child(editor.test_button)
	var tools = HFlowContainer.new(); editor.add_child(tools)
	editor.tool_picker = UI.option(["Select / move [V]", "Insert point [I]", "Draw points", "Edit pit lane [P]", "Set start / finish", "Place scenery", "Measure [M]", "Move reference", "Freehand trace [D]", "Pen trace", "Select scenery [S]"], editor.set_tool)
	tools.add_child(editor.tool_picker)
	editor.undo_button = UI.button("Undo", editor.undo); tools.add_child(editor.undo_button)
	editor.redo_button = UI.button("Redo", editor.redo); tools.add_child(editor.redo_button)
	tools.add_child(UI.button("Fit circuit", func(): editor.canvas.fit()))
	tools.add_child(UI.button("Preview lap", func(): editor.canvas.toggle_preview()))
	tools.add_child(UI.check("Racing line", true, func(value): editor.canvas.show_line = value; editor.canvas.queue_redraw()))
	tools.add_child(UI.check("Elevation profile", false, func(value): editor.canvas.show_profile = value; editor.canvas.queue_redraw()))
	editor.tool_picker.tooltip_text = "Wheel: zoom · Right-drag: pan · Ctrl: snap · Esc: cancel drag"
	editor.context_bar = HFlowContainer.new(); editor.add_child(editor.context_bar)
	editor.selection_summary = UI.label("", 12, UI.ACCENT); editor.context_bar.add_child(editor.selection_summary)
	for action in [["Duplicate", "duplicate"], ["Group", "group"], ["Ungroup", "ungroup"], ["Align X", "align_x"], ["Align Y", "align_y"], ["Delete", "delete"]]:
		var b = UI.button(action[0], func(): editor.selection_action(action[1])); b.custom_minimum_size.y = 30; b.add_theme_font_size_override("font_size", 12); editor.context_bar.add_child(b)
	editor.context_bar.visible = false
