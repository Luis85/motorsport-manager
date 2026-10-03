class_name TrackEditorCircuitInspector
extends RefCounted
## Builds draft controls for a cohesive editor workspace.


static func track(editor: Control) -> VBoxContainer:
	var track = editor.inspector_page("Track")
	track.add_child(UI.label("CIRCUIT", 16, UI.ACCENT))
	editor.name_field = LineEdit.new()
	editor.name_field.text = editor.document.name
	editor.name_field.placeholder_text = "Circuit name"
	track.add_child(editor.name_field)
	editor.name_field.text_submitted.connect(
		func(value): editor.perform(func(): editor.document.name = value.strip_edges())
	)
	editor.name_field.focus_exited.connect(
		func():
			if (
				not editor._refreshing_inspector
				and is_instance_valid(editor.name_field)
				and editor.document.name != editor.name_field.text
			):
				editor.perform(func(): editor.document.name = editor.name_field.text.strip_edges()),
	)
	var vehicles = editor.session.vehicle_choices()
	var ids = vehicles.map(func(v): return v.id)
	var selected = ids.find(editor.vehicle)
	if selected < 0:
		selected = ids.find("core.vehicle." + editor.vehicle.to_lower())
	track.add_child(
		UI.option(
			vehicles.map(func(v): return v.name),
			func(index):
				editor.vehicle = ids[index]
				editor.recompile(),
			maxi(0, selected)
		)
	)
	UI.field(
		track,
		"Grid places",
		UI.spin(
			editor.document.grid.get("count", 12),
			1,
			TrackDocument.MAX_GRID_PLACES,
			1,
			func(value): editor.perform(func(): editor.document.grid.count = int(value))
		)
	)
	UI.field(
		track,
		"Grid spacing m",
		UI.spin(
			editor.document.grid.get("spacing", 8),
			6,
			20,
			0.5,
			func(value): editor.perform(func(): editor.document.grid.spacing = value)
		)
	)
	UI.field(
		track,
		"Start / finish %",
		UI.spin(
			editor.document.start * 100,
			0,
			99.99,
			0.01,
			func(value): editor.perform(func(): editor.document.start = value / 100)
		)
	)
	track.add_child(
		UI.paragraph(
			(
				"Set start / finish lets you click the road. Race distance zero and the grid "
				+ "follow this gate, not control point one."
			)
		)
	)
	track.add_child(UI.label("TIMING SECTORS", 14, UI.ACCENT))
	for index in range(2):
		var button = UI.button(
			"Set S%d at selected point" % (index + 1), func(): editor.set_sector(index)
		)
		button.disabled = editor.canvas.selected < 0
		track.add_child(button)
	track.add_child(UI.label("PIT LANE", 16, UI.ACCENT))
	if not editor.document.pits.is_empty():
		var pit = editor.document.pits[0]
		UI.field(
			track,
			"Entry %",
			UI.spin(
				pit.entry * 100,
				0,
				99.99,
				0.01,
				func(value): editor.perform(func(): pit.entry = value / 100)
			)
		)
		UI.field(
			track,
			"Exit %",
			UI.spin(
				pit.exit * 100,
				0,
				99.99,
				0.01,
				func(value): editor.perform(func(): pit.exit = value / 100)
			)
		)
		UI.field(
			track,
			"Limit km/h",
			UI.spin(
				pit.get("speed", 80),
				30,
				100,
				5,
				func(value): editor.perform(func(): pit.speed = value)
			)
		)
		(
			track
			. add_child(
				(
					UI
					. paragraph(
						(
							"Entry and exit are absolute fractions of the authored circuit. The pit exit may "
							+ "wrap across start / finish. Use Edit pit lane to move its points."
						)
					)
				)
			)
		)
	track.add_child(
		UI.button(
			"Generate service lane",
			func():
				editor.perform(
					func():
						editor.document.pits = []
						var compiled = editor.session.compile_draft(editor.document, editor.vehicle)
						editor.document.pits = compiled.document.pits.duplicate(true),
					true
				),
		)
	)
	track.add_child(UI.label("VALIDATION", 16, UI.ACCENT))
	var issues = TrackDocument.validate(editor.document)
	if editor.geometry:
		issues.append_array(editor.geometry.warnings)
	track.add_child(
		UI.paragraph(
			"Authoring data is valid." if issues.is_empty() else "\n".join(issues),
			UI.GOOD if issues.is_empty() else UI.ACCENT
		)
	)
	track.add_child(
		UI.paragraph(
			(
				"Lap estimates are a heuristic reference, not a guaranteed fastest lap. "
				+ "Geographic layouts are unofficial reconstructions. Clearance metadata does not "
				+ "certify safety."
			)
		)
	)
	if not editor.document.provenance.is_empty():
		track.add_child(
			UI.paragraph(
				str(
					editor.document.provenance.get(
						"notice", editor.document.provenance.get("planSource", "")
					)
				)
			)
		)
	return track


static func features(editor: Control) -> VBoxContainer:
	var features = editor.inspector_page("Features")
	features.add_child(UI.label("ROAD FEATURES", 16, UI.ACCENT))
	var feature_names: Array = ["Select a feature…"]
	for f in editor.document.features:
		feature_names.append("%s  %.1f–%.1f%%" % [str(f.type).capitalize(), f.a * 100, f.b * 100])
	features.add_child(
		UI.option(
			feature_names,
			func(index):
				editor.feature_index = index - 1
				editor.refresh_inspector(),
			mini(editor.feature_index + 1, feature_names.size() - 1)
		)
	)
	if editor.feature_index >= 0 and editor.feature_index < editor.document.features.size():
		var f = editor.document.features[editor.feature_index]
		UI.field(
			features,
			"From %",
			UI.spin(
				f.a * 100, 0, 99.99, 0.1, func(value): editor.perform(func(): f.a = value / 100)
			)
		)
		UI.field(
			features,
			"To %",
			UI.spin(
				f.b * 100, 0, 99.99, 0.1, func(value): editor.perform(func(): f.b = value / 100)
			)
		)
		UI.field(
			features,
			"Width m",
			UI.spin(
				f.get("width", 1),
				0.2,
				20,
				0.1,
				func(value): editor.perform(func(): f.width = value)
			)
		)
		UI.field(
			features,
			"Clearance m",
			UI.spin(
				f.get("clearance", 5),
				1,
				20,
				0.1,
				func(value): editor.perform(func(): f.clearance = value)
			)
		)
		features.add_child(
			UI.option(
				["Both sides", "Left side", "Right side"],
				func(index): editor.perform(func(): f.side = ["both", "left", "right"][index]),
				["both", "left", "right"].find(f.get("side", "both"))
			)
		)
		features.add_child(
			UI.button(
				"Remove this feature",
				func():
					editor.perform(
						func():
							editor.document.features.remove_at(editor.feature_index)
							editor.feature_index = -1,
						true
					),
			)
		)
	features.add_child(UI.label("ADD A FEATURE", 14, UI.MUTED))
	for type in ["curb", "runoff", "barrier", "tunnel", "bridge"]:
		features.add_child(
			UI.button(
				"+ " + type.capitalize(),
				func():
					editor.perform(
						func():
							var a = (
								(
									editor
									. geometry
									. nearest(
										TrackDocument.point(
											editor.document.nodes[editor.canvas.selected]
										)
									)
									. fraction
								)
								if editor.canvas.selected >= 0
								else 0.0
							)
							editor.document.features.append(
								{
									"type": type,
									"a": a,
									"b": fposmod(a + 0.04, 1),
									"side": "both",
									"width": 1,
									"clearance": 5,
									"thickness": 1
								}
							)
							editor.feature_index = editor.document.features.size() - 1,
						true
					),
			)
		)
	features.add_child(
		UI.paragraph(
			(
				"Feature ranges wrap around the lap. Bridges and tunnels are top-down "
				+ "annotations; the road height controls the elevation profile and runtime data."
			)
		)
	)
	features.add_child(UI.label("SCENERY", 16, UI.ACCENT))
	var placements = editor.session.placement_choices()
	var placement_index = 0
	if not editor.canvas.scenery_preset.is_empty():
		for index in range(placements.size()):
			if placements[index].id == editor.canvas.scenery_preset.get("id", ""):
				placement_index = index
				break
	# Always replace cached preset values with the current validated profile.
	# A removed ID or a changed scale/renderer must not survive an editor refresh.
	if placements.is_empty():
		editor.canvas.scenery_preset.clear()
	else:
		editor.canvas.scenery_preset = placements[placement_index].duplicate(true)
		editor.canvas.scenery_type = placements[placement_index].object_type
	if not placements.is_empty():
		features.add_child(
			UI.option(
				placements.map(func(p): return p.name),
				func(index):
					editor.canvas.scenery_preset = placements[index].duplicate(true)
					editor.canvas.scenery_type = placements[index].object_type
					editor.set_tool(5),
				placement_index
			)
		)
	features.add_child(UI.paragraph(editor.session.placement_help()))
	features.add_child(
		UI.button(
			"Remove last scenery object",
			func():
				if not editor.document.objects.is_empty():
					editor.perform(func(): editor.document.objects.pop_back()),
		)
	)
	return features
