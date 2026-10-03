class_name WeekendLibraryScreen
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func show_library(view, test_track: Dictionary = {}) -> void:
	view.clear_screen("grand_prix_setup")
	view.launch_draft = WeekendLaunch.new(App.content_catalog)
	if App.content_catalog == null:
		view.content.add_child(
			UI.paragraph(
				(
					"New weekends are unavailable until the content errors are fixed. "
					+ App.content_warnings()
				)
			)
		)
		return
	App.load_library()
	var candidates = App.library.duplicate()
	if not test_track.is_empty():
		candidates.push_front(test_track)
	if candidates.is_empty():
		view.content.add_child(UI.label("No circuits available", 28))
		view.content.add_child(
			UI.paragraph(
				"Create a circuit in the editor, save it to your library, then return here."
			)
		)
		var create = UI.button("Create a circuit", func(): view.show_editor(), true)
		view.content.add_child(create)
		PitwallDesign.focus_later(create)
		return
	var selected_index = _selected_index(view, candidates, test_track)
	view.selected_track = candidates[selected_index]
	view.content.add_child(UI.label("Choose your Grand Prix", 30))
	view.content.add_child(
		UI.paragraph(
			(
				"Practice → Qualifying → Race. Keep the same screen and controls throughout; "
				+ "start the next session when ready."
			)
		)
	)
	ContentScenarioControls.append(view, view.content)
	var body = UI.hbox(view.content, true)
	var side = UI.panel()
	side.custom_minimum_size.x = 295
	body.add_child(side)
	var left = UI.vbox(side, true)
	left.add_child(UI.label("TRACK LIBRARY", 14, UI.ACCENT))
	var list = ItemList.new()
	list.custom_minimum_size.y = 80
	list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("v_separation", 13)
	left.add_child(list)
	for track in candidates:
		list.add_item(track.name + (" [custom]" if not track.get("builtin", false) else ""))
	list.select(selected_index)
	var preview = UI.vbox(body, true)
	var details = UI.label("", 17, UI.ACCENT)
	details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	preview.add_child(details)
	view.library_canvas = TrackCanvas.new()
	view.library_canvas.configure_presentation(App.settings)
	view.library_canvas.show_line = true
	preview.add_child(view.library_canvas)
	view.library_canvas.custom_minimum_size.y = 180
	var refresh = func():
		var geometry = TrackGeometry.new(
			view.selected_track,
			view.vehicle,
			false,
			App.content_catalog.vehicle(
				view.vehicle if "." in view.vehicle else "core.vehicle." + view.vehicle.to_lower()
			)
		)
		view.library_canvas.set_track(geometry)
		view.library_canvas.call_deferred("fit")
		details.text = (
			"%s  ·  %.3f km  ·  %s reference %s"
			% [
				view.selected_track.name,
				geometry.length / 1000,
				view.vehicle,
				RaceSim.format_time(geometry.estimate)
			]
		)
	list.item_selected.connect(
		func(index):
			view.selected_track = candidates[index]
			refresh.call(),
	)
	left.add_child(
		UI.button("Edit selected circuit", func(): view.show_editor(view.selected_track))
	)
	left.add_child(UI.paragraph("Edits create a local copy. Active races stay unchanged."))
	var setup_panel = UI.panel()
	view.content.add_child(setup_panel)
	var controls = HFlowContainer.new()
	setup_panel.add_child(controls)
	var preset_rows = App.content_catalog.entries("weekend")
	if not preset_rows.is_empty():
		var preset_ids = preset_rows.map(func(row): return row.id)
		controls.add_child(UI.label("WEEKEND", 12, UI.MUTED))
		var preset_control = UI.option(
			["Custom selection"] + preset_rows.map(func(row): return row.name),
			func(index):
				if index == 0:
					view.config.erase("weekend_id")
				else:
					var preset = App.content_catalog.weekend(preset_ids[index - 1])
					view.config = preset.launch_options()
					view.config.weekend_id = preset.id
					view.vehicle = preset.vehicle_id
					view.show_library(test_track),
			preset_ids.find(view.config.get("weekend_id", "")) + 1
		)
		preset_control.name = "WeekendPreset"
		controls.add_child(preset_control)
	var tuning_rows = App.content_catalog.entries("race_tuning")
	if tuning_rows.size() > 1:
		var tuning_ids = tuning_rows.map(func(row): return row.id)
		controls.add_child(UI.label("RACE MODEL", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				tuning_rows.map(func(row): return row.name),
				func(index): view.config.race_tuning_id = tuning_ids[index],
				maxi(
					0,
					tuning_ids.find(view.config.get("race_tuning_id", "core.race_tuning.default"))
				)
			)
		)
	var roster_rows = App.content_catalog.entries("roster")
	if roster_rows.size() > 1:
		var roster_ids = roster_rows.map(func(row): return row.id)
		controls.add_child(UI.label("FIELD", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				roster_rows.map(func(row): return row.name),
				func(index):
					view.config.roster_id = roster_ids[index]
					refresh.call(),
				maxi(0, roster_ids.find(view.config.get("roster_id", "core.roster.default")))
			)
		)
	var allocation_rows = App.content_catalog.entries("tyre_allocation")
	var allocation_ids = allocation_rows.map(func(item): return item.id)
	if not allocation_ids.has(
		view.config.get("tyre_allocation_id", "core.tyre_allocation.default")
	):
		view.config.tyre_allocation_id = "core.tyre_allocation.default"
	if allocation_rows.size() > 1:
		controls.add_child(UI.label("ALLOCATION", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				allocation_rows.map(func(item): return item.name),
				func(index):
					view.config.tyre_allocation_id = allocation_ids[index]
					refresh.call(),
				allocation_ids.find(
					view.config.get("tyre_allocation_id", "core.tyre_allocation.default")
				)
			)
		)
	var setup_rows = App.content_catalog.entries("setup")
	var setup_ids = setup_rows.map(func(item): return item.id)
	if setup_rows.size() > 1:
		controls.add_child(UI.label("SETUP PROFILE", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				setup_rows.map(func(item): return item.name),
				func(index): view.config.setup_id = setup_ids[index],
				maxi(0, setup_ids.find(view.config.get("setup_id", "core.setup.balanced")))
			)
		)
	var vehicle_rows = App.content_catalog.entries("vehicle")
	var vehicle_ids = vehicle_rows.map(func(v): return v.id)
	var vehicle_index = vehicle_ids.find(
		view.vehicle if "." in view.vehicle else "core.vehicle." + view.vehicle.to_lower()
	)
	controls.add_child(UI.label("CAR", 12, UI.MUTED))
	controls.add_child(
		UI.option(
			vehicle_rows.map(func(v): return v.name),
			func(index):
				view.vehicle = vehicle_ids[index]
				refresh.call(),
			maxi(0, vehicle_index)
		)
	)
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		controls.add_child(UI.label("WEATHER", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				["Dry", "Changing skies", "Rain-prone"],
				func(index): view.config.scenario = ["dry", "changeable", "wet"][index],
				["dry", "changeable", "wet"].find(view.config.scenario)
			)
		)
		controls.add_child(UI.label("RACE LAPS", 12, UI.MUTED))
		controls.add_child(
			UI.spin(view.config.laps, 1, 100, 1, func(value): view.config.laps = int(value))
		)
	else:
		controls.add_child(UI.label("WEATHER", 12, UI.MUTED))
		controls.add_child(
			UI.option(
				["Changing skies", "Dry", "Rain-prone"],
				func(index): view.config.scenario = ["changeable", "dry", "wet"][index],
				["changeable", "dry", "wet"].find(view.config.scenario)
			)
		)
		controls.add_child(
			UI.option(
				["Seeded weather", "Scripted training / legacy"],
				func(index): view.config.weather_mode = WeekendWeather.MODES[index],
				0 if view.config.get("weather_mode", "seeded") == "seeded" else 1
			)
		)
		controls.add_child(UI.label("LAPS", 12, UI.MUTED))
		var lap_input = UI.spin(
			view.config.laps, 1, 100, 1, func(value): view.config.laps = int(value)
		)
		controls.add_child(lap_input)
		controls.add_child(UI.label("QUAL MIN", 12, UI.MUTED))
		controls.add_child(
			UI.spin(
				view.config.qual_duration / 60,
				2,
				30,
				1,
				func(value): view.config.qual_duration = value * 60
			)
		)
		controls.add_child(
			UI.option(
				["Standard incidents", "Calm / testing", "Volatile"],
				func(index): view.config.intensity = ["standard", "calm", "volatile"][index],
				["standard", "calm", "volatile"].find(view.config.intensity)
			)
		)
		controls.add_child(UI.label("SEED", 12, UI.MUTED))
		controls.add_child(
			UI.spin(view.config.seed, 0, 4294967295, 1, func(value): view.config.seed = int(value))
		)
	var launch = UI.hbox(view.content)
	launch.add_child(UI.button("Back", view.go_home))
	launch.add_child(
		UI.paragraph(
			(
				"Review your choices before practice starts. Your existing weekend is not "
				+ "replaced here."
			)
		)
	)
	if App.settings.get("pitwall_layout", "minimal") == "minimal":
		launch.add_child(
			UI.button(
				"Review weekend",
				func():
					if not view.launch_draft.stage(view.selected_track, view.config, view.vehicle):
						UI.notify(view, "Weekend needs attention", view.launch_draft.last_error)
						return
					view.show_welcome(),
				true
			)
		)
	else:
		launch.add_child(
			UI.button(
				"Open weekend briefing",
				func():
					var start = func():
						if not view.launch_draft.stage(
							view.selected_track, view.config, view.vehicle
						):
							UI.notify(view, "Weekend needs attention", view.launch_draft.last_error)
							return
						App.weekend = PracticeRaceSim.new(
							view.launch_draft.visual_track(), view.launch_draft.session_options()
						)
						App.weekend.speed = App.settings.speed
						view.show_weekend()
					if App.requires_entry_confirmation():
						var dialog = ConfirmationDialog.new()
						dialog.title = "Replace current weekend?"
						dialog.dialog_text = (
							"This starts a new weekend and replaces the active checkpoint. Cancel to keep "
							+ "the current weekend."
						)
						view.add_child(dialog)
						dialog.confirmed.connect(
							func():
								dialog.queue_free()
								start.call(),
						)
						dialog.canceled.connect(dialog.queue_free)
						dialog.popup_centered(Vector2i(510, 180))
					else:
						start.call(),
				true
			)
		)
	refresh.call()
	PitwallDesign.scale_controls(view.content, UI.text_scale(view))
	PitwallDesign.focus_later(list)


static func _selected_index(view, candidates: Array, test_track: Dictionary) -> int:
	var selected_index = 0
	if test_track.is_empty() and view.selected_track != null:
		for index in range(candidates.size()):
			if candidates[index].id == view.selected_track.get("id", ""):
				selected_index = index
	return selected_index
