class_name TrackEditorWorkspaceInspector
extends RefCounted
## Builds draft controls for a cohesive editor workspace.


static func reference_page(editor: Control) -> VBoxContainer:
	var reference = editor.inspector_page("Reference")
	reference.add_child(UI.label("TRACE AN IMAGE", 16, UI.ACCENT))
	reference.add_child(UI.button("Import PNG / JPG", editor.import_reference))
	reference.add_child(
		UI.paragraph(
			(
				"The image is embedded in track exports, so it travels with the circuit. Use an "
				+ "image you have rights to share. Move reference drags it without changing the "
				+ "road."
			)
		)
	)
	if editor.document.has("reference"):
		var ref = editor.document.reference
		UI.field(
			reference,
			"Image width m",
			UI.spin(ref.width, 10, 20000, 1, func(value): editor.perform(func(): ref.width = value))
		)
		UI.field(
			reference,
			"Center X",
			UI.spin(ref.x, -100000, 100000, 1, func(value): editor.perform(func(): ref.x = value))
		)
		UI.field(
			reference,
			"Center Y",
			UI.spin(ref.y, -100000, 100000, 1, func(value): editor.perform(func(): ref.y = value))
		)
		UI.field(
			reference,
			"Opacity",
			UI.spin(
				ref.opacity,
				0.05,
				0.9,
				0.05,
				func(value): editor.perform(func(): ref.opacity = value)
			)
		)
		reference.add_child(
			UI.paragraph(
				(
					"Measure two points on the image, enter their real-world separation, then "
					+ "calibrate. The first measured point stays anchored."
				)
			)
		)
		UI.field(
			reference,
			"Known distance m",
			UI.spin(
				editor.known_distance, 0.1, 20000, 0.1, func(value): editor.known_distance = value
			)
		)
		var calibrate = UI.button("Calibrate from ruler", editor.calibrate_reference)
		calibrate.disabled = (
			editor.canvas.measure_start == Vector2.INF or editor.canvas.measure_end == Vector2.INF
		)
		reference.add_child(calibrate)
		reference.add_child(
			UI.button(
				"Remove reference",
				func(): editor.perform(func(): editor.document.erase("reference"), true)
			)
		)
	return reference


static func checks(editor: Control) -> VBoxContainer:
	var checks = editor.inspector_page("Checks")
	checks.add_child(UI.label("TRACK READINESS", 16, UI.ACCENT))
	checks.add_child(
		UI.paragraph(
			(
				"%d blocking · %d advisory"
				% [
					editor.findings.filter(func(f): return f.severity == "error").size(),
					editor.findings.filter(func(f): return f.severity != "error").size()
				]
			),
			UI.DANGER if TrackDiagnostics.blocking(editor.findings) else UI.GOOD
		)
	)
	if editor.findings.is_empty():
		(
			checks
			. add_child(
				(
					UI
					. paragraph(
						(
							"No sampled centreline problems detected. Always test a lap and inspect the pit "
							+ "route."
						)
					)
				)
			)
		)
	for index in range(editor.findings.size()):
		var finding = editor.findings[index]
		var button = UI.button(
			"%s · %s" % [str(finding.severity).to_upper(), str(finding.code).capitalize()],
			func(): editor.focus_finding(index)
		)
		button.tooltip_text = finding.message
		checks.add_child(button)
		checks.add_child(UI.paragraph(finding.message))
	checks.add_child(
		UI.paragraph(
			(
				"Checks cover sampled road crossings, vertical separation, pit angles and very "
				+ "tight radii. They do not certify full road-edge, vehicle-envelope or structural "
				+ "clearance."
			)
		)
	)
	return checks


static func look(editor: Control) -> VBoxContainer:
	var look = editor.inspector_page("World")
	look.add_child(UI.label("A QUIETER PLACE TO RACE", 15, UI.ACCENT))
	look.add_child(
		UI.paragraph(
			(
				"The same illustration is used in the editor and race. Surrounds are stylized, "
				+ "not geographic terrain surveys."
			)
		)
	)
	look.add_child(
		UI.option(
			["Meadow circuit", "Woodland circuit", "Coastal surround"],
			func(index):
				editor.perform(
					func():
						editor.document.visual.environment = ["meadow", "woodland", "coastal"][index],
				),
			["meadow", "woodland", "coastal"].find(
				editor.document.visual.get("environment", "meadow")
			)
		)
	)
	look.add_child(
		UI.option(
			["Summer greens", "Autumn warmth"],
			func(index):
				editor.perform(func(): editor.document.visual.season = ["summer", "autumn"][index]),
			["summer", "autumn"].find(editor.document.visual.get("season", "summer"))
		)
	)
	look.add_child(UI.label("EDITOR LAYERS", 15, UI.ACCENT))
	look.add_child(
		UI.paragraph(
			(
				"Hidden or locked layers cannot be edited. These workspace toggles do not delete "
				+ "content, change exports, or hide roads in the race."
			)
		)
	)
	for key in editor.canvas.layer_state:
		look.add_child(UI.label(str(key).capitalize(), 13))
		var row = UI.hbox(look)
		row.add_child(
			UI.check(
				"Visible",
				editor.canvas.layer_state[key].visible,
				func(value): editor.canvas.set_layer(key, "visible", value)
			)
		)
		row.add_child(
			UI.check(
				"Locked",
				editor.canvas.layer_state[key].locked,
				func(value): editor.canvas.set_layer(key, "locked", value)
			)
		)
	look.add_child(
		UI.check(
			"Construction grid",
			editor.canvas.show_grid,
			func(value):
				editor.canvas.show_grid = value
				editor.canvas.queue_redraw(),
		)
	)
	look.add_child(
		UI.paragraph(
			(
				"Preview lap shows a reference dot on the baked line; it is not a second physics "
				+ "simulation. Editing automatically stops the preview."
			)
		)
	)
	return look


static func sketch_page(editor: Control) -> VBoxContainer:
	var sketch_page = editor.inspector_page("Draw")
	sketch_page.add_child(UI.label("TRACE → PREVIEW → APPLY", 16, UI.ACCENT))
	sketch_page.add_child(
		UI.paragraph(
			(
				"The existing road remains intact while you draw. Start with freehand or click "
				+ "straight segments with Pen. Right-drag pans between strokes."
			)
		)
	)
	var trace_tools = UI.hbox(sketch_page)
	trace_tools.add_child(UI.button("Freehand [D]", func(): editor.set_tool(8)))
	trace_tools.add_child(UI.button("Pen", func(): editor.set_tool(9)))
	editor.sketch_summary = UI.paragraph("")
	sketch_page.add_child(editor.sketch_summary)
	editor.sketch_close_button = UI.button(
		"Close loop",
		func():
			if editor.canvas.sketch.close_loop():
				editor.canvas.pen_anchor = Vector2.INF
				editor.invalidate_sketch()
			else:
				editor.status.text = "Add at least four trace points before closing.",
	)
	sketch_page.add_child(editor.sketch_close_button)
	UI.field(
		sketch_page,
		"Simplify metres",
		UI.spin(
			editor.canvas.sketch.tolerance,
			0.2,
			50,
			0.2,
			func(value):
				editor.canvas.sketch.tolerance = value
				editor.invalidate_sketch(),
		)
	)
	UI.field(
		sketch_page,
		"Smoothing",
		UI.spin(
			editor.canvas.sketch.smoothing,
			0,
			1,
			0.05,
			func(value):
				editor.canvas.sketch.smoothing = value
				editor.invalidate_sketch(),
		)
	)
	UI.field(
		sketch_page,
		"Road width m",
		UI.spin(
			editor.canvas.sketch.width,
			5,
			40,
			0.5,
			func(value):
				editor.canvas.sketch.width = value
				editor.invalidate_sketch(),
		)
	)
	sketch_page.add_child(UI.button("Clear trace", editor.confirm_clear_trace))
	sketch_page.add_child(
		UI.paragraph(
			(
				"Replacement clears old pits, features and timing markers because they reference "
				+ "the old layout. Scenery and the reference image remain. Undo restores the "
				+ "complete old document."
			)
		)
	)
	return sketch_page
