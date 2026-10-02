class_name WeekendView
extends "res://scripts/ui/weekend_support.gd"
## Persistent native controls: live telemetry never rebuilds the timing tree or pit wall.
func _ready() -> void:
	# Retained Engineering tools keep their established compact type and spacing.
	# Player-facing menus and the Minimal pitwall use regular density.
	theme = GameTheme.build(1.0, true)
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 5)
	session_header = RaceSessionHeader.new(); session_header.configure(sim); add_child(session_header)
	session_strip = session_header
	session_header.action_requested.connect(dispatch); session_header.utility_requested.connect(weekend_action); session_header.advance_requested.connect(primary_action)
	title_label = session_header.title_label; session_label = session_header.session_label
	clock_label = session_header.clock_label; flag_label = session_header.flag_label; weather_label = session_header.weather_label
	race_context_label = session_header.context_label; primary_button = session_header.primary_button
	pause_button = session_header.pause_button; speed_control = session_header.speed_control; top_secondary_actions = session_header.weekend_menu
	steps = session_header.steps
	navigation = UI.hbox(self); navigation.add_theme_constant_override("separation", 3)
	watch_button = UI.button("Race view", close_detail); watch_button.tooltip_text = "Close the inspector and give the circuit more space. No orders or time changes."; navigation.add_child(watch_button)
	race_workspace = RaceObservationWorkspace.new(); add_child(race_workspace)
	var body = race_workspace
	timing_view = RaceTimingTower.new(); timing_view.configure(sim); body.add_child(timing_view)
	timing_panel = timing_view; tower = timing_view.tower; rows = timing_view.rows; rank_rows = timing_view.rank_rows; rendered_rows = timing_view.rendered_rows
	timing_view.driver_selected.connect(select_driver)
	var visual = UI.vbox(body, true)
	qualifying_workspace = RaceQualifyingWorkspace.new(); qualifying_workspace.configure(sim); visual.add_child(qualifying_workspace); qualifying_workspace.hide()
	qualifying_workspace.inspect_requested.connect(_inspect_qualifying)
	var view_row = HBoxContainer.new(); map_controls = view_row; visual.add_child(view_row)
	view_row.add_child(UI.button("Fit · F", func(): set_follow(false); canvas.fit()))
	follow_control = UI.check("Follow", false, set_follow); view_row.add_child(follow_control)
	layers_menu = MenuButton.new(); layers_menu.text = "Layers"; layers_menu.flat = false; layers_menu.custom_minimum_size.y = 32
	layers_menu.tooltip_text = "Optional racing line, driver labels and surface overlays. These never change race conditions."
	view_row.add_child(layers_menu)
	add_layer("Racing line", presentation_services.preferences.racing_line, func(value): canvas.show_line = value; canvas.queue_redraw())
	add_layer("Driver labels", presentation_services.preferences.labels, func(value): canvas.show_labels = value; canvas.queue_redraw())
	surface_control = add_layer("Track surface", false, func(value): canvas.show_surface = value; canvas.queue_redraw())
	layers_menu.get_popup().hide_on_checkable_item_selection = false
	layers_menu.get_popup().id_pressed.connect(func(id):
		var control = layer_controls[id]; control.button_pressed = not control.button_pressed
		layers_menu.get_popup().set_item_checked(id, control.button_pressed))
	layers_menu.get_popup().about_to_popup.connect(func():
		for i in range(layer_controls.size()): layers_menu.get_popup().set_item_checked(i, layer_controls[i].button_pressed))
	canvas = TrackCanvas.new(); canvas.configure_presentation(presentation_services.preferences); canvas.visual_source = sim.visuals; canvas.show_line = presentation_services.preferences.racing_line; canvas.show_labels = presentation_services.preferences.labels; canvas.show_grid = false
	canvas.set_track(sim.track); visual.add_child(canvas); canvas.car_selected.connect(select_driver)
	canvas.navigated.connect(func(): set_follow(false))
	right_panel = UI.race_panel(false, 8); right_panel.custom_minimum_size.x = 360; body.add_child(right_panel)
	var wall = UI.vbox(right_panel, true); wall.add_theme_constant_override("separation", 5)
	
	var teammates = UI.hbox(wall)
	for id in sim.player_ids():
		var b = UI.button("", func(): select_driver(id)); b.size_flags_horizontal = Control.SIZE_EXPAND_FILL; b.add_theme_font_size_override("font_size", 12)
		teammates.add_child(b); teammate_buttons.append(b)
	driver_status_card = UI.race_panel(false, 6); wall.add_child(driver_status_card)
	var driver_status = UI.vbox(driver_status_card)
	var driver_heading = UI.hbox(driver_status)
	driver_label = UI.label("", 14, UI.ACCENT); driver_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; driver_heading.add_child(driver_label)
	driver_position_label = UI.label("", 18, UI.INK); driver_heading.add_child(driver_position_label)
	driver_rival_label = UI.label("", 11, UI.MUTED); driver_status.add_child(driver_rival_label)
	intent_label = UI.label("", 12, UI.MUTED); intent_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; driver_status.add_child(intent_label)
	driver_plan_label = UI.label("", 11, UI.MUTED); driver_plan_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; driver_status.add_child(driver_plan_label)
	resource_row = UI.hbox(wall)
	for title in ["TYRES", "FUEL", "INTEGRITY"]:
		var cell = UI.vbox(resource_row); cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL; cell.add_theme_constant_override("separation", 3)
		cell.add_child(UI.label(title, 10, UI.MUTED))
		var value = UI.label("", 14); cell.add_child(value); resource_labels.append(value)
		var bar = ProgressBar.new(); bar.show_percentage = false; bar.custom_minimum_size = Vector2(55, 4)
		bar.add_theme_stylebox_override("background", UI.box(UI.LINE, UI.LINE, 2, 0)); bar.add_theme_stylebox_override("fill", UI.box(UI.GOOD, UI.GOOD, 2, 0))
		cell.add_child(bar); resource_bars.append(bar)
	compact_resources = UI.label("", 12, UI.MUTED); compact_resources.visible = false; wall.add_child(compact_resources)
	advisory_button = UI.button("No team advisories", func(): show_tyres(1))
	advisory_button.add_theme_font_size_override("font_size", 11); advisory_button.custom_minimum_size.y = 28; advisory_button.visible = false; wall.add_child(advisory_button)
	detail_picker = UI.option(["Commands", "Telemetry & lap history", "Race control & radio", "Tyres & strategy", "Setup & handling", "Track surface lab"], func(index): tabs.current_tab = index)
	detail_picker.tooltip_text = "Inspect one topic at a time. Primary pit actions remain below."
	var topic_row = UI.hbox(wall); detail_picker.visible = false; topic_row.add_child(detail_picker)
	detail_caption = UI.label("Drive", 13, UI.ACCENT); detail_caption.size_flags_horizontal = Control.SIZE_EXPAND_FILL; topic_row.add_child(detail_caption)
	expand_button = UI.button("Widen", func(): set_detail_expanded(not detail_expanded)); expand_button.add_theme_font_size_override("font_size", 12)
	expand_button.tooltip_text = "Give this topic more space. The timing tower is temporarily hidden; the map and pit actions stay available."; topic_row.add_child(expand_button)
	var close_button = UI.button("Close", close_detail); close_button.tooltip_text = "Return to watching. Drafts remain unapplied and are retained."; topic_row.add_child(close_button)
	detail_nav_host = UI.vbox(wall)
	tabs = TabContainer.new(); tabs.tabs_visible = false; tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL; wall.add_child(tabs)
	tabs.tab_changed.connect(func(index):
		detail_picker.select(index)
		if setup_commit: setup_commit.visible = index == 4
		open_detail()
		refresh_navigation()
		if radio_label: refresh())
	var command_page = tab_page("Commands")
	var drive_sections = UI.hbox(command_page)
	for i in range(2):
		var button = UI.button(["Driving", "Pit service"][i], func(): show_drive(i)); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		drive_sections.add_child(button); drive_buttons.append(button)
	for i in range(2): drive_pages.append(UI.vbox(command_page))
	drive_pages[1].visible = false
	var commands = drive_pages[0]
	automate = UI.check("Delegate to engineer", true, func(value): dispatch("auto", {"value": value})); commands.add_child(automate)
	pace = UI.option(["Conserve pace", "Balanced pace", "Push pace"], func(index): dispatch("pace", {"value": index})); commands.add_child(pace)
	engine = UI.option(["Economy engine", "Standard engine", "Overtake engine"], func(index): dispatch("engine", {"value": index})); commands.add_child(engine)
	battle_picker = UI.option(["Patient racecraft", "Balanced racecraft", "Assertive racecraft"], func(index): dispatch("battle_mode", {"value": ["patient", "balanced", "assertive"][index]}), 1)
	battle_picker.tooltip_text = "Changes passing choices and incident exposure, not engine power."; commands.add_child(battle_picker)
	commands = drive_pages[1]
	commands.add_child(UI.label("COMPOUND / NEXT STOP", 11, UI.MUTED))
	var compound_rows = sim.compound_choices()
	compound_ids = compound_rows.map(func(item): return item.id)
	compound = UI.option(compound_rows.map(func(item): return item.short + " · " + item.name), func(index): dispatch("compound", {"value": compound_ids[index]})); commands.add_child(compound)
	commands.add_child(UI.button("Choose a fresh or used set →", func(): show_tyres(0)))
	repair = UI.check("Repair damage at stop", true, func(value): dispatch("repair", {"value": value})); commands.add_child(repair)
	var setup_profile = sim.setup_profile()
	setup = UI.spin(setup_profile.defaults.wing, setup_profile.specs.wing[0], setup_profile.specs.wing[1], 1, func(value): dispatch("setup", {"value": value})); UI.field(commands, setup_profile.specs.wing[2], setup)
	commands.add_child(UI.button("Open complete setup →", func(): tabs.current_tab = 4))
	command_note = UI.paragraph("", UI.MUTED); command_note.add_theme_font_size_override("font_size", 12); drive_pages[0].add_child(command_note)
	var telemetry = tab_page("Telemetry")
	telemetry_inspector = RaceTelemetryInspector.new();telemetry_inspector.configure(sim);telemetry.add_child(telemetry_inspector)
	telemetry_label=telemetry_inspector.metric_label;telemetry_chart=telemetry_inspector.chart;telemetry_sectors=telemetry_inspector.sectors;history_label=telemetry_inspector.history;trace=telemetry_chart
	var radio = tab_page("Radio")
	radio_inspector=RaceRadioInspector.new();radio_inspector.configure(sim);radio.add_child(radio_inspector)
	radio_inspector.filter_changed.connect(_set_radio_filter);log_label=radio_inspector.source
	var tyres = tab_page("Tyres")
	var tyre_sections = UI.hbox(tyres)
	for index in range(3):
		var b = UI.button(["Allocation", "Wheels", "Stop plan"][index], func(): show_tyres(index))
		b.add_theme_font_size_override("font_size", 12); b.custom_minimum_size.y = 32; b.size_flags_horizontal = Control.SIZE_EXPAND_FILL; tyre_sections.add_child(b); tyre_nav.append(b)
	var stock = UI.vbox(tyres); tyre_pages.append(stock)
	tyre_readout=RaceTyreReadout.new();tyre_readout.configure(sim);stock.add_child(tyre_readout)
	stock.add_child(UI.label("PLAN A SET · THEN BOX / SEND", 12, UI.ACCENT))
	var sets = GridContainer.new(); sets.columns = 3; stock.add_child(sets)
	for index in range(12):
		var button = UI.button("", func(): dispatch("select_set", {"set_id": sim.car(sim.selected_id).tyre_sets[index].id}))
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; button.custom_minimum_size = Vector2(74, 47); button.add_theme_font_size_override("font_size", 10)
		sets.add_child(button); tyre_buttons.append(button)
	stock.add_child(UI.paragraph("Planned is not fitted. Used sets keep their four-wheel damage; no new stock is created."))
	var condition = UI.vbox(tyres); tyre_pages.append(condition); condition.visible = false
	wheel_dashboard = RacecraftPanel.WheelDashboard.new(); wheel_dashboard.model = sim; condition.add_child(wheel_dashboard)
	var planning = UI.vbox(tyres); tyre_pages.append(planning); planning.visible = false
	planning.add_child(UI.label("PLANNED PIT STOP", 12, UI.ACCENT))
	var plan_row = UI.hbox(planning)
	plan_row.add_child(UI.label("Racing lap", 12, UI.MUTED))
	schedule_lap = UI.spin(2, 1, maxi(1, sim.laps - 1), 1, func(_value): pass)
	schedule_lap.custom_minimum_size.x = 65; plan_row.add_child(schedule_lap)
	schedule_button = UI.button("Schedule", func(): dispatch("schedule_pit", {"lap": int(schedule_lap.value)})); schedule_button.custom_minimum_size.x = 78; schedule_button.add_theme_font_size_override("font_size", 12); plan_row.add_child(schedule_button)
	unschedule_button = UI.button("Cancel planned stop", func(): dispatch("cancel_schedule")); planning.add_child(unschedule_button)
	schedule_label = UI.paragraph(""); schedule_label.add_theme_font_size_override("font_size", 11); planning.add_child(schedule_label)
	stint_plot = StintPlot.new(); stint_plot.source = sim.charts; planning.add_child(stint_plot)
	tyre_summary = UI.paragraph(""); tyre_summary.add_theme_font_size_override("font_size", 12); planning.add_child(tyre_summary)
	var setup_page = tab_page("Setup")
	racecraft = RacecraftPanel.new(); racecraft.configure(sim, dispatch); setup_page.add_child(racecraft)
	setup_commit = UI.vbox(wall); setup_commit.add_theme_constant_override("separation", 3); setup_commit.visible = false
	racecraft.actions.reparent(setup_commit); racecraft.note.reparent(setup_commit)
	pin_navigation(0, drive_sections); show_drive(0)
	pin_navigation(3, tyre_sections)
	var lab_page = tab_page("Surface lab")
	surface_lab = SurfaceLab.new(); surface_lab.source = sim.charts; surface_lab.canvas = canvas; lab_page.add_child(surface_lab)
	pit_note = UI.paragraph(""); pit_note.add_theme_font_size_override("font_size", 12); wall.add_child(pit_note)
	var pit_row = UI.hbox(wall)
	box_button = UI.button("Box at next entry", func(): dispatch("pit"), true); box_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; pit_row.add_child(box_button)
	cancel_box = UI.button("Cancel", func(): dispatch("cancel_pit")); pit_row.add_child(cancel_box)
	var runs = UI.hbox(wall)
	send_button = UI.button("Send out", func(): dispatch("send"), true); send_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; runs.add_child(send_button)
	recall_button = UI.button("Recall", func(): dispatch("recall")); runs.add_child(recall_button)
	detail_actions = UI.vbox(wall); detail_actions.add_theme_constant_override("separation", 4)
	for entry in [["Drive", 0], ["Tyres", 3], ["Setup", 4], ["Telemetry", 1], ["Radio", 2], ["Surface", 5]]: register_topic(entry[0], entry[1])
	decision_strip = UI.race_panel(false, 7); add_child(decision_strip)
	var decision_row = UI.hbox(decision_strip)
	decision_row.add_child(UI.label("DECISION QUEUE", 11, UI.ACCENT))
	decision_badge = UI.label("CLEAR", 10, UI.GOOD); decision_badge.custom_minimum_size.x = 54; decision_row.add_child(decision_badge)
	decision_text = UI.label("No urgent decision · stay on plan", 12, UI.MUTED); decision_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL; decision_row.add_child(decision_text)
	decision_review = UI.button("Review", review_decision); decision_review.tooltip_text = "Open the most relevant control surface for this issue. Reviewing never changes the race."; decision_row.add_child(decision_review)
	decision_hold = UI.button("Keep plan", hold_decision); decision_hold.tooltip_text = "Acknowledge this state until the underlying condition materially changes."; decision_row.add_child(decision_hold)
	hint = UI.paragraph(""); hint.add_theme_font_size_override("font_size", 12); add_child(hint)
	radio_label = UI.label("", 11, UI.MUTED); add_child(radio_label)
	refresh(); setup_guide(); call_deferred("wire_control_help", self)
	call_deferred("fit_canvas")

func _process(delta: float) -> void:
	if sim == null: return
	if follow and canvas:
		var alpha = clampf(sim.accumulator / RaceViewQuery.STEP, 0, 1) if not sim.paused else 1.0
		var p = sim.car_position(sim.car(sim.selected_id), alpha).p
		var next = canvas.center.lerp(p, 1.0 if presentation_services.preferences.reduced_motion or canvas.center.distance_squared_to(p) < 0.0001 else 1.0 - exp(-delta * 7))
		if canvas.center != next: canvas.center = next; canvas.queue_redraw()
	refresh_time -= delta
	if refresh_time <= 0: refresh_time = 0.2; refresh()

func refresh() -> void:
	ui_refresh_count += 1
	if tower == null: return
	var c = sim.car(sim.selected_id)
	if decision_text and decision_strip.visible:
		var issue = current_decision(c)
		decision_signature = issue.signature
		var actionable = not issue.signature.is_empty() and issue.signature != decision_snoozed_signature
		decision_text.text = issue.text if actionable else ("Plan acknowledged · watching for a material change" if not issue.signature.is_empty() else "No urgent decision · watch the race and stay on plan")
		decision_badge.text = issue.badge if actionable else ("HOLD" if not issue.signature.is_empty() else "CLEAR")
		decision_badge.add_theme_color_override("font_color", issue.color if actionable else (UI.ACCENT if not issue.signature.is_empty() else UI.GOOD))
		decision_review.visible = actionable
		decision_hold.visible = actionable
	surface_control.set_pressed_no_signal(canvas.show_surface)
	compact_resources.text = "TYRES %d%%   ·   FUEL %.1f laps   ·   CAR %d%%" % [c.tyre, c.fuel, c.health]
	var q = sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
	var order = sim.standings(q); var leader = order[0]
	timing_view.present()
	qualifying_workspace.visible = sim.phase == "qualifying" and not right_panel.visible
	if qualifying_workspace.visible: qualifying_workspace.present()
	var captions = {"practice": "End practice…", "practice_results": "Return to briefing", "briefing": "Start qualifying", "qualifying": "Close qualifying…", "qualifying_results": "Prepare the race", "race_preparation": "Start formation lap", "formation": "Formation in progress", "grid_ready": "Release start lights", "lights": "Start lights", "race": "Race in progress", "results": "Another weekend"}
	primary_button.text = captions[sim.phase]; primary_button.disabled = sim.phase in ["formation", "lights", "race"] or sim.phase == "qualifying" and sim.qual_closed
	primary_button.tooltip_text = "Finish the active session before advancing." if primary_button.disabled else "Advance to the next weekend stage."
	pause_button.text = "Resume" if sim.paused else "Pause"; pause_button.disabled = sim.phase not in RaceViewQuery.ACTIVE
	speed_control.select([1, 2, 4, 8, 16].find(sim.speed))
	flag_label.text = ("PAUSED · " if sim.paused else "") + ("CHEQUERED" if sim.chequered or q and sim.qual_closed else sim.flag)
	flag_label.add_theme_color_override("font_color", UI.GOLD if sim.paused or sim.flag != "GREEN" else GameTheme.ACCENT)
	var running_lap = clampi(int(floor(maxf(0, leader.distance) / sim.track.length)) + 1, 1, sim.laps)
	clock_label.text = "QUAL %s" % RaceViewQuery.format_time(maxf(0.001, sim.qual_duration - sim.clock)) if q and sim.phase != "qualifying_results" else ("LAP %d / %d · %s" % [running_lap, sim.laps, RaceViewQuery.format_time(sim.race_time)] if sim.phase in ["race", "results"] else sim.phase.replace("_", " ").to_upper())
	weather_label.text = "%s · Water %d%%" % [sim.weather_name, int(sim.average(sim.water) * 100)]
	weather_label.tooltip_text = "Rubber %d%%. Rain and surface water are separate: the road wets and dries gradually." % int(sim.average(sim.rubber) * 100)
	if race_context_label:
		race_context_label.text = "SURFACE %d%% WATER   ·   RUBBER %d%%" % [int(sim.average(sim.water) * 100), int(sim.average(sim.rubber) * 100)]
	session_label.text = "%s   /   %s   /   SEED %d" % [sim.phase.replace("_", " ").to_upper(), sim.track.preset.to_upper(), sim.seed_value]
	var step_index = {"practice": 0, "practice_results": 0, "briefing": 0, "qualifying": 0, "qualifying_results": 0, "race_preparation": 1, "formation": 2, "grid_ready": 3, "lights": 3, "race": 4, "results": 5}[sim.phase]
	steps[0].get_parent().visible = sim.phase not in RaceViewQuery.ACTIVE
	for i in range(steps.size()): steps[i].add_theme_color_override("font_color", UI.ACCENT if i == step_index else (UI.GOOD if i < step_index else UI.MUTED))
	for i in range(2):
		var teammate = sim.cars[sim.player_ids()[i]]
		teammate_buttons[i].text = "%s · P%d" % [teammate.short, order.find(teammate) + 1]
		UI.set_active(teammate_buttons[i], teammate.id == c.id)
	driver_label.text = "%02d  %s" % [c.number, c.name]; driver_label.add_theme_color_override("font_color", UI.INK)
	var selected_position = order.find(c) + 1
	driver_position_label.text = "P%d" % selected_position
	var nearest = order[selected_position - 2] if selected_position > 1 else null
	driver_rival_label.text = ("Car ahead · %s" % nearest.short) if nearest != null else "Leading the classification"
	intent_label.text = "Finished P%d" % c.finish_position if c.finished else ("Retired: " + c.retire_reason if c.dnf else c.intent); intent_label.tooltip_text = intent_label.text
	driver_plan_label.text = "%s %d%%   ·   Finish fuel ~%+.1f laps   ·   %s" % [sim.tyre_info(c.compound).get("name", "Tyres"), c.tyre, sim.race_forecaster_fuel_margin(c), ("Pit lap %d" % c.scheduled_lap) if c.scheduled_lap > 0 else "No stop scheduled"]
	var values = [c.tyre, c.fuel, c.health]
	for i in range(3):
		resource_labels[i].text = "%.1f laps" % values[i] if i == 1 else "%d%%" % values[i]
		resource_bars[i].value = clampf(values[i] / maxf(1, sim.laps) * 100, 0, 100) if i == 1 else values[i]
		var risk = (i == 0 and c.tyre < 28) or (i == 1 and sim.phase == "race" and sim.race_forecaster_fuel_margin(c) < 0.35) or (i == 2 and c.health < 55)
		UI.resource_state(resource_bars[i], resource_labels[i], risk)
	if right_panel.visible and tabs.current_tab == 1:
		telemetry_label.text = "CURRENT MODEL · %d km/h · %d°C tyre · throttle %d%% / brake %d%%\nBest %s · Last %s\nS1 %s · S2 %s · S3 %s" % [c.speed * 3.6, c.temperature, c.throttle * 100, c.braking * 100, RaceViewQuery.format_time(c.qual_best if q else c.best_lap), RaceViewQuery.format_time(c.last_lap), RaceViewQuery.format_time(c.sectors[0]), RaceViewQuery.format_time(c.sectors[1]), RaceViewQuery.format_time(c.sectors[2])]
		var records: Array = c.qual_history if q else c.history
		var history: Array[String] = ["MEASURED FLYING LAPS" if q else "RACE LAP HISTORY"]
		for i in range(maxi(0, records.size() - 8), records.size()):
			var lap = records[i]
			history.append("%s %d   %s%s" % ["Run" if q else "Lap", lap.get("run", lap.get("lap", 0)), RaceViewQuery.format_time(lap.time), " · INVALID" if not lap.get("valid", true) else (" · PIT" if lap.get("pit_lap", false) else "")])
			if q and lap.has("sectors"): history.append("%.2f / %.2f / %.2f" % [lap.sectors[0], lap.sectors[1], lap.sectors[2]])
		history_label.text = "\n\n".join(history)
		telemetry_inspector.present()
		if telemetry_sectors: telemetry_sectors.present(records)
	automate.set_pressed_no_signal(c.auto); repair.set_pressed_no_signal(c.repair)
	battle_picker.select(["patient", "balanced", "assertive"].find(c.battle_mode))
	pace.select(c.pace); engine.select(c.engine); compound.select(compound_ids.find(c.next_compound)); setup.set_value_no_signal(c.setup)
	var controllable = c.player and not c.dnf and not c.finished
	for button in [automate, pace, engine, compound, repair, battle_picker]: button.disabled = not controllable
	box_button.disabled = not controllable or sim.phase != "race" or c.route != "track" or c.pit_order and c.scheduled_lap < 1
	cancel_box.disabled = not controllable or not c.pit_order or c.route != "track"
	send_button.disabled = not controllable or sim.phase != "qualifying" or sim.qual_closed or c.route != "garage"
	recall_button.disabled = not controllable or sim.phase != "qualifying" or c.route != "track"
	box_button.get_parent().visible = not q; send_button.get_parent().visible = q
	pace.visible = not q; engine.visible = not q; repair.visible = not q
	setup.get_parent().visible = false # Complete setup has one staged editing surface.
	setup.editable = controllable and (sim.phase in ["briefing", "race_preparation"] or c.route == "garage")
	command_note.text = "Spectating a rival. Select MER or MOR to give commands." if not c.player else ("Engineer controls releases and strategy." if c.auto else "Manual control. Pace, engine and pit calls are yours.")
	pit_note.text = ("Existing hot laps may finish." if sim.qual_closed else "Garage → Out → Hot → In → Garage") if q else (sim.pit_status(c) if c.pit_order or c.route == "pit" else "Planned compound: %s · %s\nRecommended now: %s" % [sim.tyre_info(c.next_compound).get("name", "Tyres"), "repair" if c.repair else "tyres only", sim.tyre_info(sim.recommended_compound()).get("name", "Tyres")])
	box_button.tooltip_text = "Late calls defer safely to the following pit entry."; cancel_box.tooltip_text = "A car already in the pit lane cannot cancel entry."
	if radio_inspector and right_panel.visible and tabs.current_tab==2: radio_inspector.present()
	var signature = str(sim.events.back()) if not sim.events.is_empty() else ""
	if right_panel.visible and tabs.current_tab == 2 and (last_event_count != sim.events.size() or signature != last_event_signature):
		last_event_signature = signature
		last_event_count = sim.events.size()
		var lines: Array[String] = []
		for i in range(sim.events.size() - 1, -1, -1):
			if lines.size() >= 50: break
			var event = sim.events[i]
			if radio_filter != "all":
				var kinds = {"flags": ["flag", "incident", "finish"], "pit": ["pit", "radio"], "tyre": ["tyre"], "weather": ["weather"]}[radio_filter]
				if event.kind not in kinds: continue
			lines.append("%02d:%02d  %s" % [int(event.time / 60), int(fmod(event.time, 60)), event.text])
		log_label.text = "\n\n".join(lines) if not lines.is_empty() else "No matching events yet."
	var hints = {"practice": "Run a useful experiment; tyres, fuel, health and weather remain physical.", "practice_results": "Review measured findings, then return to briefing. No setup bonus is awarded.", "briefing": "Start qualifying. Engineers schedule runs; switch delegation off to manage releases yourself.", "qualifying": "Only complete hot laps set a time. OUT / HOT / IN / BOX are visible in the timing tower.", "qualifying_results": "The grid is set. Inspect measured splits in Telemetry, then prepare the race.", "race_preparation": "Select your starting tyres and setup. Formation warms the tyres but consumes fuel.", "formation": "One full formation lap. No overtaking; all cars return to their assigned grid slots.", "grid_ready": "The grid is ready. Release the lights when you are ready to start.", "lights": "Five red lights. Race distance begins at lights out.", "race": "Calls use the next safe pit-entry gate. Your pit buttons stay visible while inspecting telemetry or radio.", "results": "Final classification: completed laps first, then finish time. Pit laps are excluded from fastest-lap records."}
	hint.text = hints[sim.phase]
	if Time.get_ticks_msec() / 1000.0 > feedback_until:
		radio_label.text = "Space pause · 1–5 speed · Ctrl+Tab driver · B box · Esc close panel · F fit"
		if is_instance_valid(help_target) and not help_target.tooltip_text.is_empty(): radio_label.text = help_target.tooltip_text.replace("\n", " · ") + "   [F1 details]"
		radio_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var advisories = sim.car_advisories(c)
	advisory_button.visible = not advisories.is_empty()
	if not advisories.is_empty():
		advisory_button.text = "Inspect · " + advisories[0].left(44)
		advisory_button.tooltip_text = "\n".join(advisories)
	if racecraft and racecraft.is_visible_in_tree(): racecraft.refresh(); detail_refresh_count += 1
	if wheel_dashboard and wheel_dashboard.is_visible_in_tree(): wheel_dashboard.refresh(); detail_refresh_count += 1
	if tabs.current_tab == 3 and right_panel.visible: refresh_tyres(c, controllable); detail_refresh_count += 1
	if trace.is_visible_in_tree(): trace.queue_redraw()
	if last_phase != sim.phase:
		last_phase = sim.phase
		if session_status != null and not session_status.persistence_error.is_empty():
			feedback("Autosave failed: " + session_status.persistence_error)

