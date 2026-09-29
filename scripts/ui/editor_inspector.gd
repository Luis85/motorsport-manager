class_name TrackEditorInspector
extends RefCounted
## Rebuilds fields from the displayed draft; mutations stay on editor commands.

static func render(editor: Control) -> void:
	if editor.inspector == null: return
	editor._refreshing_inspector = true
	var tab = editor.inspector.current_tab
	UI.clear(editor.inspector)
	var point = editor.inspector_page("Point")
	if editor.canvas.selection_ids.size() > 1:
		point.add_child(UI.label("%d %s ITEMS" % [editor.canvas.selection_ids.size(), editor.canvas.selection_kind.to_upper()], 16, UI.ACCENT))
		point.add_child(UI.paragraph("Drag any selected item to move the selection. Shift-click toggles membership. Road handles move with their points; widths and elevations stay unchanged."))
		var turn = UI.spin(15, -180, 180, 1, func(_value): pass); UI.field(point, "Rotation °", turn)
		point.add_child(UI.button("Rotate selection", func(): editor.apply_selection_result(TrackEdit.transform(editor.document, editor.canvas.selection_kind, editor.canvas.selection_ids, Vector2.ZERO, turn.value))))
		var factor = UI.spin(1.1, 0.1, 4, 0.1, func(_value): pass); UI.field(point, "Scale factor", factor)
		point.add_child(UI.button("Scale selection", func(): editor.apply_selection_result(TrackEdit.transform(editor.document, editor.canvas.selection_kind, editor.canvas.selection_ids, Vector2.ZERO, 0, factor.value))))
		point.add_child(UI.button("Distribute horizontally", func(): editor.selection_action("distribute_x")))
		point.add_child(UI.button("Distribute vertically", func(): editor.selection_action("distribute_y")))
		point.add_child(UI.paragraph("Transforms are one undo step. Alignment uses item centres; grouping is flat and applies to scenery only."))
	elif editor.canvas.selected_object >= 0 and editor.canvas.selected_object < editor.document.objects.size():
		var object = editor.document.objects[editor.canvas.selected_object]
		point.add_child(UI.label("SCENERY / " + str(object.type).to_upper(), 16, UI.ACCENT))
		editor.coordinate_fields(point, object, false)
		UI.field(point, "Rotation °", UI.spin(object.get("rotation", 0), -360, 360, 1, func(value): editor.perform(func(): object.rotation = value)))
		UI.field(point, "Scale", UI.spin(object.get("scale", 1), 0.2, 8, 0.1, func(value): editor.perform(func(): object.scale = value)))
		point.add_child(UI.button("Delete scenery", editor.delete_point))
		point.add_child(UI.paragraph("Drag this object in Select / move. Rotation and scale affect its drawn footprint; this is scenery, not a collision body."))
	elif editor.canvas.mode == "pit" and editor.canvas.selected_pit >= 0 and not editor.document.pits.is_empty() and editor.canvas.selected_pit < editor.document.pits[0].nodes.size():
		var node = editor.document.pits[0].nodes[editor.canvas.selected_pit]
		point.add_child(UI.label("PIT POINT %d" % (editor.canvas.selected_pit + 1), 16, UI.ACCENT))
		editor.coordinate_fields(point, node, false)
		point.add_child(UI.button("Delete pit point", func(): editor.perform(func(): editor.document.pits[0].nodes.remove_at(editor.canvas.selected_pit); editor.canvas.selected_pit = -1, true)))
		point.add_child(UI.paragraph("Drag the gold pit handles. Shift-click empty space to append a point. Entry and exit gates are edited in Track."))
	elif editor.canvas.selected >= 0 and editor.canvas.selected < editor.document.nodes.size():
		var node = editor.document.nodes[editor.canvas.selected]
		point.add_child(UI.label("CONTROL POINT %d" % (editor.canvas.selected + 1), 16, UI.ACCENT))
		editor.coordinate_fields(point, node, true)
		point.add_child(UI.check("Aligned handles", node.get("mode", "aligned") == "aligned", func(value): editor.perform(func(): node.mode = "aligned" if value else "free")))
		point.add_child(UI.button("Smooth this corner", func(): editor.perform(func(): TrackDocument.smooth_node(editor.document, editor.canvas.selected), true)))
		point.add_child(UI.button("Make a sharp corner", func(): editor.perform(func(): node.mode = "free"; TrackDocument.set_handle(node, "in", Vector2.ZERO); TrackDocument.set_handle(node, "out", Vector2.ZERO), true)))
		point.add_child(UI.button("Split next segment", func(): editor.perform(func(): editor.canvas.selected = TrackDocument.split_segment(editor.document, editor.canvas.selected), true)))
		point.add_child(UI.button("Delete control point", editor.delete_point))
		point.add_child(UI.paragraph("The square handles shape the exact Bézier curve. Insertion splits that curve without changing its shape. Banking and height are interpolated along the circuit."))
	else:
		point.add_child(UI.label("DIRECT MANIPULATION", 16, UI.ACCENT))
		point.add_child(UI.paragraph("Click a control point to inspect it. Drag the point or its square handles. Double-click the road to insert a shape-preserving point."))
		point.add_child(UI.paragraph("New circuits begin as a four-corner starter. Draw points appends new corners; the circuit stays closed. Use Smooth all only on a new rough outline—not on a surveyed template."))
		point.add_child(UI.button("Smooth all points", func(): editor.perform(func():
			for i in range(editor.document.nodes.size()): TrackDocument.smooth_node(editor.document, i))))
		point.add_child(UI.paragraph("Navigation\nWheel: zoom at cursor\nRight or middle drag: pan\nCtrl while dragging: snap to 5 m\nF: fit\nCtrl+Z / Ctrl+Y: undo / redo\nCtrl+S: save\nDelete: delete selected point"))
	var track = editor.inspector_page("Track")
	track.add_child(UI.label("CIRCUIT", 16, UI.ACCENT))
	editor.name_field = LineEdit.new(); editor.name_field.text = editor.document.name; editor.name_field.placeholder_text = "Circuit name"; track.add_child(editor.name_field)
	editor.name_field.text_submitted.connect(func(value): editor.perform(func(): editor.document.name = value.strip_edges()))
	editor.name_field.focus_exited.connect(func():
		if not editor._refreshing_inspector and is_instance_valid(editor.name_field) and editor.document.name != editor.name_field.text: editor.perform(func(): editor.document.name = editor.name_field.text.strip_edges()))
	var vehicles = editor.session.vehicle_choices()
	var ids = vehicles.map(func(v): return v.id)
	var selected = ids.find(editor.vehicle)
	if selected < 0: selected = ids.find("core.vehicle." + editor.vehicle.to_lower())
	track.add_child(UI.option(vehicles.map(func(v): return v.name), func(index): editor.vehicle = ids[index]; editor.recompile(), maxi(0, selected)))
	UI.field(track, "Start / finish %", UI.spin(editor.document.start * 100, 0, 99.99, 0.01, func(value): editor.perform(func(): editor.document.start = value / 100)))
	track.add_child(UI.paragraph("Set start / finish lets you click the road. Race distance zero and the grid follow this gate, not control point one."))
	track.add_child(UI.label("TIMING SECTORS", 14, UI.ACCENT))
	for index in range(2):
		var button = UI.button("Set S%d at selected point" % (index + 1), func(): editor.set_sector(index))
		button.disabled = editor.canvas.selected < 0; track.add_child(button)
	track.add_child(UI.label("PIT LANE", 16, UI.ACCENT))
	if not editor.document.pits.is_empty():
		var pit = editor.document.pits[0]
		UI.field(track, "Entry %", UI.spin(pit.entry * 100, 0, 99.99, 0.01, func(value): editor.perform(func(): pit.entry = value / 100)))
		UI.field(track, "Exit %", UI.spin(pit.exit * 100, 0, 99.99, 0.01, func(value): editor.perform(func(): pit.exit = value / 100)))
		UI.field(track, "Limit km/h", UI.spin(pit.get("speed", 80), 30, 100, 5, func(value): editor.perform(func(): pit.speed = value)))
		track.add_child(UI.paragraph("Entry and exit are absolute fractions of the authored circuit. The pit exit may wrap across start / finish. Use Edit pit lane to move its points."))
	track.add_child(UI.button("Generate service lane", func(): editor.perform(func():
		editor.document.pits = []
		var compiled = editor.session.compile_draft(editor.document, editor.vehicle)
		editor.document.pits = compiled.document.pits.duplicate(true), true)))
	track.add_child(UI.label("VALIDATION", 16, UI.ACCENT))
	var issues = TrackDocument.validate(editor.document)
	if editor.geometry: issues.append_array(editor.geometry.warnings)
	track.add_child(UI.paragraph("Authoring data is valid." if issues.is_empty() else "\n".join(issues), UI.GOOD if issues.is_empty() else UI.ACCENT))
	track.add_child(UI.paragraph("Lap estimates are a heuristic reference, not a guaranteed fastest lap. Geographic layouts are unofficial reconstructions. Clearance metadata does not certify safety."))
	if not editor.document.provenance.is_empty(): track.add_child(UI.paragraph(str(editor.document.provenance.get("notice", editor.document.provenance.get("planSource", "")))))
	var features = editor.inspector_page("Features")
	features.add_child(UI.label("ROAD FEATURES", 16, UI.ACCENT))
	var feature_names: Array = ["Select a feature…"]
	for f in editor.document.features: feature_names.append("%s  %.1f–%.1f%%" % [str(f.type).capitalize(), f.a * 100, f.b * 100])
	features.add_child(UI.option(feature_names, func(index): editor.feature_index = index - 1; editor.refresh_inspector(), mini(editor.feature_index + 1, feature_names.size() - 1)))
	if editor.feature_index >= 0 and editor.feature_index < editor.document.features.size():
		var f = editor.document.features[editor.feature_index]
		UI.field(features, "From %", UI.spin(f.a * 100, 0, 99.99, 0.1, func(value): editor.perform(func(): f.a = value / 100)))
		UI.field(features, "To %", UI.spin(f.b * 100, 0, 99.99, 0.1, func(value): editor.perform(func(): f.b = value / 100)))
		UI.field(features, "Width m", UI.spin(f.get("width", 1), 0.2, 20, 0.1, func(value): editor.perform(func(): f.width = value)))
		UI.field(features, "Clearance m", UI.spin(f.get("clearance", 5), 1, 20, 0.1, func(value): editor.perform(func(): f.clearance = value)))
		features.add_child(UI.option(["Both sides", "Left side", "Right side"], func(index): editor.perform(func(): f.side = ["both", "left", "right"][index]), ["both", "left", "right"].find(f.get("side", "both"))))
		features.add_child(UI.button("Remove this feature", func(): editor.perform(func(): editor.document.features.remove_at(editor.feature_index); editor.feature_index = -1, true)))
	features.add_child(UI.label("ADD A FEATURE", 14, UI.MUTED))
	for type in ["curb", "runoff", "barrier", "tunnel", "bridge"]:
		features.add_child(UI.button("+ " + type.capitalize(), func(): editor.perform(func():
			var a = editor.geometry.nearest(TrackDocument.point(editor.document.nodes[editor.canvas.selected])).fraction if editor.canvas.selected >= 0 else 0.0
			editor.document.features.append({"type": type, "a": a, "b": fposmod(a + 0.04, 1), "side": "both", "width": 1, "clearance": 5, "thickness": 1})
			editor.feature_index = editor.document.features.size() - 1, true)))
	features.add_child(UI.paragraph("Feature ranges wrap around the lap. Bridges and tunnels are top-down annotations; the road height controls the elevation profile and runtime data."))
	features.add_child(UI.label("SCENERY", 16, UI.ACCENT))
	features.add_child(UI.option(["Tree", "Grandstand", "Garage", "Tower", "Yacht", "Water", "Tent", "Cafe"], func(index): editor.canvas.scenery_type = ["tree", "grandstand", "garage", "tower", "yacht", "water", "tent", "cafe"][index]; editor.set_tool(5), ["tree", "grandstand", "garage", "tower", "yacht", "water", "tent", "cafe"].find(editor.canvas.scenery_type)))
	features.add_child(UI.paragraph("Choose a prop, then click the canvas to place it. Return to Select / move to select and drag existing objects; Point exposes rotation, size and position."))
	features.add_child(UI.button("Remove last scenery object", func():
		if not editor.document.objects.is_empty(): editor.perform(func(): editor.document.objects.pop_back())))
	var reference = editor.inspector_page("Reference")
	reference.add_child(UI.label("TRACE AN IMAGE", 16, UI.ACCENT))
	reference.add_child(UI.button("Import PNG / JPG", editor.import_reference))
	reference.add_child(UI.paragraph("The image is embedded in track exports, so it travels with the circuit. Use an image you have rights to share. Move reference drags it without changing the road."))
	if editor.document.has("reference"):
		var ref = editor.document.reference
		UI.field(reference, "Image width m", UI.spin(ref.width, 10, 20000, 1, func(value): editor.perform(func(): ref.width = value)))
		UI.field(reference, "Center X", UI.spin(ref.x, -100000, 100000, 1, func(value): editor.perform(func(): ref.x = value)))
		UI.field(reference, "Center Y", UI.spin(ref.y, -100000, 100000, 1, func(value): editor.perform(func(): ref.y = value)))
		UI.field(reference, "Opacity", UI.spin(ref.opacity, 0.05, 0.9, 0.05, func(value): editor.perform(func(): ref.opacity = value)))
		reference.add_child(UI.paragraph("Measure two points on the image, enter their real-world separation, then calibrate. The first measured point stays anchored."))
		UI.field(reference, "Known distance m", UI.spin(editor.known_distance, 0.1, 20000, 0.1, func(value): editor.known_distance = value))
		var calibrate = UI.button("Calibrate from ruler", editor.calibrate_reference)
		calibrate.disabled = editor.canvas.measure_start == Vector2.INF or editor.canvas.measure_end == Vector2.INF
		reference.add_child(calibrate)
		reference.add_child(UI.button("Remove reference", func(): editor.perform(func(): editor.document.erase("reference"), true)))
	var checks = editor.inspector_page("Checks")
	checks.add_child(UI.label("TRACK READINESS", 16, UI.ACCENT))
	checks.add_child(UI.paragraph("%d blocking · %d advisory" % [editor.findings.filter(func(f): return f.severity == "error").size(), editor.findings.filter(func(f): return f.severity != "error").size()], UI.DANGER if TrackDiagnostics.blocking(editor.findings) else UI.GOOD))
	if editor.findings.is_empty(): checks.add_child(UI.paragraph("No sampled centreline problems detected. Always test a lap and inspect the pit route."))
	for index in range(editor.findings.size()):
		var finding = editor.findings[index]
		var button = UI.button("%s · %s" % [str(finding.severity).to_upper(), str(finding.code).capitalize()], func(): editor.focus_finding(index))
		button.tooltip_text = finding.message; checks.add_child(button); checks.add_child(UI.paragraph(finding.message))
	checks.add_child(UI.paragraph("Checks cover sampled road crossings, vertical separation, pit angles and very tight radii. They do not certify full road-edge, vehicle-envelope or structural clearance."))
	# Locks apply to pointer gestures, inspector input and destructive keyboard actions.
	var point_layer = "scenery" if editor.canvas.selected_object >= 0 else ("pits" if editor.canvas.mode == "pit" else "road")
	if not editor.canvas.layer_editable(point_layer): editor.disable_inputs(point)
	if not editor.canvas.layer_editable("road") or not editor.canvas.layer_editable("pits"): editor.disable_inputs(track)
	if not editor.canvas.layer_editable("features") or not editor.canvas.layer_editable("scenery"): editor.disable_inputs(features)
	if not editor.canvas.layer_editable("reference"): editor.disable_inputs(reference)
	var look = editor.inspector_page("World")
	look.add_child(UI.label("A QUIETER PLACE TO RACE", 15, UI.ACCENT))
	look.add_child(UI.paragraph("The same illustration is used in the editor and race. Surrounds are stylized, not geographic terrain surveys."))
	look.add_child(UI.option(["Meadow circuit", "Woodland circuit", "Coastal surround"], func(index): editor.perform(func(): editor.document.visual.environment = ["meadow", "woodland", "coastal"][index]), ["meadow", "woodland", "coastal"].find(editor.document.visual.get("environment", "meadow"))))
	look.add_child(UI.option(["Summer greens", "Autumn warmth"], func(index): editor.perform(func(): editor.document.visual.season = ["summer", "autumn"][index]), ["summer", "autumn"].find(editor.document.visual.get("season", "summer"))))
	look.add_child(UI.label("EDITOR LAYERS", 15, UI.ACCENT))
	look.add_child(UI.paragraph("Hidden or locked layers cannot be edited. These workspace toggles do not delete content, change exports, or hide roads in the race."))
	for key in editor.canvas.layer_state:
		look.add_child(UI.label(str(key).capitalize(), 13))
		var row = UI.hbox(look)
		row.add_child(UI.check("Visible", editor.canvas.layer_state[key].visible, func(value): editor.canvas.set_layer(key, "visible", value)))
		row.add_child(UI.check("Locked", editor.canvas.layer_state[key].locked, func(value): editor.canvas.set_layer(key, "locked", value)))
	look.add_child(UI.check("Construction grid", editor.canvas.show_grid, func(value): editor.canvas.show_grid = value; editor.canvas.queue_redraw()))
	look.add_child(UI.paragraph("Preview lap shows a reference dot on the baked line; it is not a second physics simulation. Editing automatically stops the preview."))
	var sketch_page = editor.inspector_page("Draw")
	sketch_page.add_child(UI.label("TRACE → PREVIEW → APPLY", 16, UI.ACCENT))
	sketch_page.add_child(UI.paragraph("The existing road remains intact while you draw. Start with freehand or click straight segments with Pen. Right-drag pans between strokes."))
	var trace_tools = UI.hbox(sketch_page)
	trace_tools.add_child(UI.button("Freehand [D]", func(): editor.set_tool(8)))
	trace_tools.add_child(UI.button("Pen", func(): editor.set_tool(9)))
	editor.sketch_summary = UI.paragraph(""); sketch_page.add_child(editor.sketch_summary)
	editor.sketch_close_button = UI.button("Close loop", func():
		if editor.canvas.sketch.close_loop(): editor.canvas.pen_anchor = Vector2.INF; editor.invalidate_sketch()
		else: editor.status.text = "Add at least four trace points before closing.")
	sketch_page.add_child(editor.sketch_close_button)
	UI.field(sketch_page, "Simplify metres", UI.spin(editor.canvas.sketch.tolerance, 0.2, 50, 0.2, func(value): editor.canvas.sketch.tolerance = value; editor.invalidate_sketch()))
	UI.field(sketch_page, "Smoothing", UI.spin(editor.canvas.sketch.smoothing, 0, 1, 0.05, func(value): editor.canvas.sketch.smoothing = value; editor.invalidate_sketch()))
	UI.field(sketch_page, "Road width m", UI.spin(editor.canvas.sketch.width, 5, 40, 0.5, func(value): editor.canvas.sketch.width = value; editor.invalidate_sketch()))
	sketch_page.add_child(UI.button("Clear trace", editor.confirm_clear_trace))
	sketch_page.add_child(UI.paragraph("Replacement clears old pits, features and timing markers because they reference the old layout. Scenery and the reference image remain. Undo restores the complete old document."))
	editor.inspector.current_tab = clampi(tab, 0, editor.inspector.get_tab_count() - 1)
	editor.section_picker.select(editor.inspector.current_tab)
	editor.sketch_actions.visible = editor.inspector.current_tab == 6
	editor.context_bar.visible = editor.canvas.selection_ids.size() > 1
	editor.selection_summary.text = "%d selected · %s" % [editor.canvas.selection_ids.size(), editor.canvas.selection_kind]
	editor.update_sketch_panel()
	editor._refreshing_inspector = false
