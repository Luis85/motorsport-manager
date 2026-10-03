class_name WeekendInspectorBuilder
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _build_driver_tabs(view, wall: VBoxContainer) -> void:
	var command_page = view.tab_page("Commands")
	var drive_sections = UI.hbox(command_page)
	for i in range(2):
		var button = UI.button(["Driving", "Pit service"][i], func(): view.show_drive(i))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		drive_sections.add_child(button)
		view.drive_buttons.append(button)
	for i in range(2):
		view.drive_pages.append(UI.vbox(command_page))
	view.drive_pages[1].visible = false
	var commands = view.drive_pages[0]
	view.automate = UI.check(
		"Delegate to engineer", true, func(value): view.dispatch("auto", {"value": value})
	)
	commands.add_child(view.automate)
	view.pace = UI.option(
		["Conserve pace", "Balanced pace", "Push pace"],
		func(index): view.dispatch("pace", {"value": index})
	)
	commands.add_child(view.pace)
	view.engine = UI.option(
		["Economy engine", "Standard engine", "Overtake engine"],
		func(index): view.dispatch("engine", {"value": index})
	)
	commands.add_child(view.engine)
	view.battle_picker = UI.option(
		["Patient racecraft", "Balanced racecraft", "Assertive racecraft"],
		func(index):
			view.dispatch("battle_mode", {"value": ["patient", "balanced", "assertive"][index]}),
		1
	)
	view.battle_picker.tooltip_text = "Changes passing choices and incident exposure, not engine power."
	commands.add_child(view.battle_picker)
	commands = view.drive_pages[1]
	commands.add_child(UI.label("COMPOUND / NEXT STOP", 11, UI.MUTED))
	var compound_rows = view.sim.compound_choices()
	view.compound_ids = compound_rows.map(func(item): return item.id)
	view.compound = UI.option(
		compound_rows.map(func(item): return item.short + " · " + item.name),
		func(index): view.dispatch("compound", {"value": view.compound_ids[index]})
	)
	commands.add_child(view.compound)
	commands.add_child(UI.button("Choose a fresh or used set →", func(): view.show_tyres(0)))
	view.repair = UI.check(
		"Repair damage at stop", true, func(value): view.dispatch("repair", {"value": value})
	)
	commands.add_child(view.repair)
	var setup_profile = view.sim.setup_profile()
	view.setup = UI.spin(
		setup_profile.defaults.wing,
		setup_profile.specs.wing[0],
		setup_profile.specs.wing[1],
		1,
		func(value): view.dispatch("setup", {"value": value})
	)
	UI.field(commands, setup_profile.specs.wing[2], view.setup)
	commands.add_child(UI.button("Open complete setup →", func(): view.tabs.current_tab = 4))
	view.command_note = UI.paragraph("", UI.MUTED)
	view.command_note.add_theme_font_size_override("font_size", 12)
	view.drive_pages[0].add_child(view.command_note)
	var telemetry = view.tab_page("Telemetry")
	view.telemetry_inspector = RaceTelemetryInspector.new()
	view.telemetry_inspector.configure(view.sim)
	telemetry.add_child(view.telemetry_inspector)
	view.telemetry_label = view.telemetry_inspector.metric_label
	view.telemetry_chart = view.telemetry_inspector.chart
	view.telemetry_sectors = view.telemetry_inspector.sectors
	view.history_label = view.telemetry_inspector.history
	view.trace = view.telemetry_chart
	var radio = view.tab_page("Radio")
	view.radio_inspector = RaceRadioInspector.new()
	view.radio_inspector.configure(view.sim)
	radio.add_child(view.radio_inspector)
	view.radio_inspector.filter_changed.connect(view._set_radio_filter)
	view.log_label = view.radio_inspector.source
	var tyres = view.tab_page("Tyres")
	var tyre_sections = UI.hbox(tyres)
	for index in range(3):
		var b = UI.button(
			["Allocation", "Wheels", "Stop plan"][index], func(): view.show_tyres(index)
		)
		b.add_theme_font_size_override("font_size", 12)
		b.custom_minimum_size.y = 32
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tyre_sections.add_child(b)
		view.tyre_nav.append(b)
	var stock = UI.vbox(tyres)
	view.tyre_pages.append(stock)
	view.tyre_readout = RaceTyreReadout.new()
	view.tyre_readout.configure(view.sim)
	stock.add_child(view.tyre_readout)
	stock.add_child(UI.label("PLAN A SET · THEN BOX / SEND", 12, UI.ACCENT))
	var sets = GridContainer.new()
	sets.columns = 3
	stock.add_child(sets)
	for index in range(12):
		var button = UI.button(
			"",
			func():
				view.dispatch(
					"select_set", {"set_id": view.sim.car(view.sim.selected_id).tyre_sets[index].id}
				),
		)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.custom_minimum_size = Vector2(74, 47)
		button.add_theme_font_size_override("font_size", 10)
		sets.add_child(button)
		view.tyre_buttons.append(button)
	stock.add_child(
		UI.paragraph(
			(
				"Planned is not fitted. Used sets keep their four-wheel damage; no new stock is "
				+ "created."
			)
		)
	)
	var condition = UI.vbox(tyres)
	view.tyre_pages.append(condition)
	condition.visible = false
	view.wheel_dashboard = RacecraftPanel.WheelDashboard.new()
	view.wheel_dashboard.model = view.sim
	condition.add_child(view.wheel_dashboard)
	var planning = UI.vbox(tyres)
	view.tyre_pages.append(planning)
	planning.visible = false
	planning.add_child(UI.label("PLANNED PIT STOP", 12, UI.ACCENT))
	var plan_row = UI.hbox(planning)
	plan_row.add_child(UI.label("Racing lap", 12, UI.MUTED))
	view.schedule_lap = UI.spin(2, 1, maxi(1, view.sim.laps - 1), 1, func(_value): pass)
	view.schedule_lap.custom_minimum_size.x = 65
	plan_row.add_child(view.schedule_lap)
	view.schedule_button = UI.button(
		"Schedule", func(): view.dispatch("schedule_pit", {"lap": int(view.schedule_lap.value)})
	)
	view.schedule_button.custom_minimum_size.x = 78
	view.schedule_button.add_theme_font_size_override("font_size", 12)
	plan_row.add_child(view.schedule_button)
	view.unschedule_button = UI.button(
		"Cancel planned stop", func(): view.dispatch("cancel_schedule")
	)
	planning.add_child(view.unschedule_button)
	view.schedule_label = UI.paragraph("")
	view.schedule_label.add_theme_font_size_override("font_size", 11)
	planning.add_child(view.schedule_label)
	view.stint_plot = WeekendViewSupport.StintPlot.new()
	view.stint_plot.source = view.sim.charts
	planning.add_child(view.stint_plot)
	view.tyre_summary = UI.paragraph("")
	view.tyre_summary.add_theme_font_size_override("font_size", 12)
	planning.add_child(view.tyre_summary)
	var setup_page = view.tab_page("Setup")
	view.racecraft = RacecraftPanel.new()
	view.racecraft.configure(view.sim, view.dispatch)
	setup_page.add_child(view.racecraft)
	view.setup_commit = UI.vbox(wall)
	view.setup_commit.add_theme_constant_override("separation", 3)
	view.setup_commit.visible = false
	view.racecraft.actions.reparent(view.setup_commit)
	view.racecraft.note.reparent(view.setup_commit)
	view.pin_navigation(0, drive_sections)
	view.show_drive(0)
	view.pin_navigation(3, tyre_sections)
	var lab_page = view.tab_page("Surface lab")
	view.surface_lab = SurfaceLab.new()
	view.surface_lab.source = view.sim.charts
	view.surface_lab.canvas = view.canvas
	lab_page.add_child(view.surface_lab)
	view.pit_note = UI.paragraph("")
	view.pit_note.add_theme_font_size_override("font_size", 12)
	wall.add_child(view.pit_note)
	var pit_row = UI.hbox(wall)
	view.box_button = UI.button("Box at next entry", func(): view.dispatch("pit"), true)
	view.box_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pit_row.add_child(view.box_button)
	view.cancel_box = UI.button("Cancel", func(): view.dispatch("cancel_pit"))
	pit_row.add_child(view.cancel_box)
	var runs = UI.hbox(wall)
	view.send_button = UI.button("Send out", func(): view.dispatch("send"), true)
	view.send_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	runs.add_child(view.send_button)
	view.recall_button = UI.button("Recall", func(): view.dispatch("recall"))
	runs.add_child(view.recall_button)
	view.detail_actions = UI.vbox(wall)
	view.detail_actions.add_theme_constant_override("separation", 4)
	for entry in [
		["Drive", 0], ["Tyres", 3], ["Setup", 4], ["Telemetry", 1], ["Radio", 2], ["Surface", 5]
	]:
		view.register_topic(entry[0], entry[1])
