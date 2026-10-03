class_name WeekendView
extends "res://scripts/ui/weekend_support.gd"


## Persistent native controls: live telemetry never rebuilds the timing tree or pit wall.
func _ready() -> void:
	WeekendWorkspaceBuilder._ready(self)


func _process(delta: float) -> void:
	if sim == null:
		return
	if follow and canvas:
		var alpha = clampf(sim.accumulator / RaceViewQuery.STEP, 0, 1) if not sim.paused else 1.0
		var p = sim.car_position(sim.car(sim.selected_id), alpha).p
		var next = canvas.center.lerp(
			p,
			(
				1.0
				if (
					presentation_services.preferences.reduced_motion
					or canvas.center.distance_squared_to(p) < 0.0001
				)
				else 1.0 - exp(-delta * 7)
			)
		)
		if canvas.center != next:
			canvas.center = next
			canvas.queue_redraw()
	refresh_time -= delta
	if refresh_time <= 0:
		refresh_time = 0.2
		refresh()


func refresh() -> void:
	ui_refresh_count += 1
	if tower == null:
		return
	var c = sim.car(sim.selected_id)
	_present_decision(c)
	surface_control.set_pressed_no_signal(canvas.show_surface)
	compact_resources.text = (
		"TYRES %d%%   ·   FUEL %.1f laps   ·   CAR %d%%" % [c.tyre, c.fuel, c.health]
	)
	var q = sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
	var order = sim.standings(q)
	var leader = order[0]
	timing_view.present()
	qualifying_workspace.visible = sim.phase == "qualifying" and not right_panel.visible
	if qualifying_workspace.visible:
		qualifying_workspace.present()
	var captions = {
		"practice": "End practice…",
		"practice_results": "Return to briefing",
		"briefing": "Start qualifying",
		"qualifying": "Close qualifying…",
		"qualifying_results": "Prepare the race",
		"race_preparation": "Start formation lap",
		"formation": "Formation in progress",
		"grid_ready": "Release start lights",
		"lights": "Start lights",
		"race": "Race in progress",
		"results": "Another weekend"
	}
	primary_button.text = captions[sim.phase]
	primary_button.disabled = (
		sim.phase in ["formation", "lights", "race"]
		or sim.phase == "qualifying" and sim.qual_closed
	)
	primary_button.tooltip_text = (
		"Finish the active session before advancing."
		if primary_button.disabled
		else "Advance to the next weekend stage."
	)
	pause_button.text = "Resume" if sim.paused else "Pause"
	pause_button.disabled = sim.phase not in RaceViewQuery.ACTIVE
	speed_control.select([1, 2, 4, 8, 16].find(sim.speed))
	flag_label.text = (
		("PAUSED · " if sim.paused else "")
		+ ("CHEQUERED" if sim.chequered or q and sim.qual_closed else sim.flag)
	)
	flag_label.add_theme_color_override(
		"font_color", UI.GOLD if sim.paused or sim.flag != "GREEN" else GameTheme.ACCENT
	)
	var running_lap = clampi(
		int(floor(maxf(0, leader.distance) / sim.track.length)) + 1, 1, sim.laps
	)
	clock_label.text = (
		"QUAL %s" % RaceViewQuery.format_time(maxf(0.001, sim.qual_duration - sim.clock))
		if q and sim.phase != "qualifying_results"
		else (
			"LAP %d / %d · %s" % [running_lap, sim.laps, RaceViewQuery.format_time(sim.race_time)]
			if sim.phase in ["race", "results"]
			else sim.phase.replace("_", " ").to_upper()
		)
	)
	weather_label.text = "%s · Water %d%%" % [sim.weather_name, int(sim.average(sim.water) * 100)]
	weather_label.tooltip_text = (
		"Rubber %d%%. Rain and surface water are separate: the road wets and dries gradually."
		% int(sim.average(sim.rubber) * 100)
	)
	if race_context_label:
		race_context_label.text = (
			"SURFACE %d%% WATER   ·   RUBBER %d%%"
			% [int(sim.average(sim.water) * 100), int(sim.average(sim.rubber) * 100)]
		)
	session_label.text = (
		"%s   /   %s   /   SEED %d"
		% [sim.phase.replace("_", " ").to_upper(), sim.track.preset.to_upper(), sim.seed_value]
	)
	var step_index = {
		"practice": 0,
		"practice_results": 0,
		"briefing": 0,
		"qualifying": 0,
		"qualifying_results": 0,
		"race_preparation": 1,
		"formation": 2,
		"grid_ready": 3,
		"lights": 3,
		"race": 4,
		"results": 5
	}[sim.phase]
	steps[0].get_parent().visible = sim.phase not in RaceViewQuery.ACTIVE
	for i in range(steps.size()):
		steps[i].add_theme_color_override(
			"font_color",
			UI.ACCENT if i == step_index else (UI.GOOD if i < step_index else UI.MUTED)
		)
	_present_driver(c, order)
	_present_telemetry(c, q)
	var controllable = _present_commands(c, q)
	if radio_inspector and right_panel.visible and tabs.current_tab == 2:
		radio_inspector.present()
	_present_radio()
	var hints = {
		"practice": "Run a useful experiment; tyres, fuel, health and weather remain physical.",
		"practice_results":
		"Review measured findings, then return to briefing. No setup bonus is awarded.",
		"briefing":
		(
			"Start qualifying. Engineers schedule runs; switch delegation off to manage "
			+ "releases yourself."
		),
		"qualifying":
		(
			"Only complete hot laps set a time. OUT / HOT / IN / BOX are visible in the "
			+ "timing tower."
		),
		"qualifying_results":
		"The grid is set. Inspect measured splits in Telemetry, then prepare the race.",
		"race_preparation":
		"Select your starting tyres and setup. Formation warms the tyres but consumes fuel.",
		"formation":
		"One full formation lap. No overtaking; all cars return to their assigned grid slots.",
		"grid_ready": "The grid is ready. Release the lights when you are ready to start.",
		"lights": "Five red lights. Race distance begins at lights out.",
		"race":
		(
			"Calls use the next safe pit-entry gate. Your pit buttons stay visible while "
			+ "inspecting telemetry or radio."
		),
		"results":
		(
			"Final classification: completed laps first, then finish time. Pit laps are "
			+ "excluded from fastest-lap records."
		)
	}
	hint.text = hints[sim.phase]
	if Time.get_ticks_msec() / 1000.0 > feedback_until:
		radio_label.text = "Space pause · 1–5 speed · Ctrl+Tab driver · B box · Esc close panel · F fit"
		if is_instance_valid(help_target) and not help_target.tooltip_text.is_empty():
			radio_label.text = help_target.tooltip_text.replace("\n", " · ") + "   [F1 details]"
		radio_label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	var advisories = sim.car_advisories(c)
	advisory_button.visible = not advisories.is_empty()
	if not advisories.is_empty():
		advisory_button.text = "Inspect · " + advisories[0].left(44)
		advisory_button.tooltip_text = "\n".join(advisories)
	if racecraft and racecraft.is_visible_in_tree():
		racecraft.refresh()
		detail_refresh_count += 1
	if wheel_dashboard and wheel_dashboard.is_visible_in_tree():
		wheel_dashboard.refresh()
		detail_refresh_count += 1
	if tabs.current_tab == 3 and right_panel.visible:
		refresh_tyres(c, controllable)
		detail_refresh_count += 1
	if trace.is_visible_in_tree():
		trace.queue_redraw()
	if last_phase != sim.phase:
		last_phase = sim.phase
		if session_status != null and not session_status.persistence_error.is_empty():
			feedback("Autosave failed: " + session_status.persistence_error)


func _build_driver_inspector() -> VBoxContainer:
	return WeekendWorkspaceBuilder._build_driver_inspector(self)


func _build_driver_tabs(wall: VBoxContainer) -> void:
	WeekendInspectorBuilder._build_driver_tabs(self, wall)


func _present_telemetry(c: Dictionary, q: bool) -> void:
	WeekendDriverPresenter._present_telemetry(self, c, q)


func _present_radio() -> void:
	WeekendDriverPresenter._present_radio(self)


func _present_commands(c: Dictionary, q: bool) -> bool:
	return WeekendDriverPresenter._present_commands(self, c, q)


func _present_decision(c: Dictionary) -> void:
	if decision_text and decision_strip.visible:
		var issue = current_decision(c)
		decision_signature = issue.signature
		var actionable = (
			not issue.signature.is_empty() and issue.signature != decision_snoozed_signature
		)
		decision_text.text = (
			issue.text
			if actionable
			else (
				"Plan acknowledged · watching for a material change"
				if not issue.signature.is_empty()
				else "No urgent decision · watch the race and stay on plan"
			)
		)
		decision_badge.text = (
			issue.badge if actionable else ("HOLD" if not issue.signature.is_empty() else "CLEAR")
		)
		decision_badge.add_theme_color_override(
			"font_color",
			(
				issue.color
				if actionable
				else (UI.ACCENT if not issue.signature.is_empty() else UI.GOOD)
			)
		)
		decision_review.visible = actionable
		decision_hold.visible = actionable


func _present_driver(c: Dictionary, order: Array) -> void:
	for i in range(2):
		var teammate = sim.cars[sim.player_ids()[i]]
		teammate_buttons[i].text = "%s · P%d" % [teammate.short, order.find(teammate) + 1]
		UI.set_active(teammate_buttons[i], teammate.id == c.id)
	driver_label.text = "%02d  %s" % [c.number, c.name]
	driver_label.add_theme_color_override("font_color", UI.INK)
	var selected_position = order.find(c) + 1
	driver_position_label.text = "P%d" % selected_position
	var nearest = order[selected_position - 2] if selected_position > 1 else null
	driver_rival_label.text = (
		("Car ahead · %s" % nearest.short) if nearest != null else "Leading the classification"
	)
	intent_label.text = (
		"Finished P%d" % c.finish_position
		if c.finished
		else ("Retired: " + c.retire_reason if c.dnf else c.intent)
	)
	intent_label.tooltip_text = intent_label.text
	driver_plan_label.text = (
		"%s %d%%   ·   Finish fuel ~%+.1f laps   ·   %s"
		% [
			sim.tyre_info(c.compound).get("name", "Tyres"),
			c.tyre,
			sim.race_forecaster_fuel_margin(c),
			("Pit lap %d" % c.scheduled_lap) if c.scheduled_lap > 0 else "No stop scheduled"
		]
	)
	var values = [c.tyre, c.fuel, c.health]
	for i in range(3):
		resource_labels[i].text = "%.1f laps" % values[i] if i == 1 else "%d%%" % values[i]
		resource_bars[i].value = (
			clampf(values[i] / maxf(1, sim.laps) * 100, 0, 100) if i == 1 else values[i]
		)
		var risk = (
			(i == 0 and c.tyre < 28)
			or (i == 1 and sim.phase == "race" and sim.race_forecaster_fuel_margin(c) < 0.35)
			or (i == 2 and c.health < 55)
		)
		UI.resource_state(resource_bars[i], resource_labels[i], risk)
