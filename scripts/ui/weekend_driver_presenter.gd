class_name WeekendDriverPresenter
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _present_telemetry(view, c: Dictionary, q: bool) -> void:
	if view.right_panel.visible and view.tabs.current_tab == 1:
		view.telemetry_label.text = (
			(
				"CURRENT MODEL · %d km/h · %d°C tyre · throttle %d%% / brake %d%%\nBest %s · "
				+ "Last %s\nS1 %s · S2 %s · S3 %s"
			)
			% [
				c.speed * 3.6,
				c.temperature,
				c.throttle * 100,
				c.braking * 100,
				RaceViewQuery.format_time(c.qual_best if q else c.best_lap),
				RaceViewQuery.format_time(c.last_lap),
				RaceViewQuery.format_time(c.sectors[0]),
				RaceViewQuery.format_time(c.sectors[1]),
				RaceViewQuery.format_time(c.sectors[2])
			]
		)
		var records: Array = c.qual_history if q else c.history
		var history: Array[String] = ["MEASURED FLYING LAPS" if q else "RACE LAP HISTORY"]
		for i in range(maxi(0, records.size() - 8), records.size()):
			var lap = records[i]
			history.append(
				(
					"%s %d   %s%s"
					% [
						"Run" if q else "Lap",
						lap.get("run", lap.get("lap", 0)),
						RaceViewQuery.format_time(lap.time),
						(
							" · INVALID"
							if not lap.get("valid", true)
							else (" · PIT" if lap.get("pit_lap", false) else "")
						)
					]
				)
			)
			if q and lap.has("sectors"):
				history.append(
					"%.2f / %.2f / %.2f" % [lap.sectors[0], lap.sectors[1], lap.sectors[2]]
				)
		view.history_label.text = "\n\n".join(history)
		view.telemetry_inspector.present()
		if view.telemetry_sectors:
			view.telemetry_sectors.present(records)


static func _present_radio(view) -> void:
	var signature = str(view.sim.events.back()) if not view.sim.events.is_empty() else ""
	if (
		view.right_panel.visible
		and view.tabs.current_tab == 2
		and (
			view.last_event_count != view.sim.events.size()
			or signature != view.last_event_signature
		)
	):
		view.last_event_signature = signature
		view.last_event_count = view.sim.events.size()
		var lines: Array[String] = []
		for i in range(view.sim.events.size() - 1, -1, -1):
			if lines.size() >= 50:
				break
			var event = view.sim.events[i]
			if view.radio_filter != "all":
				var kinds = {
					"flags": ["flag", "incident", "finish"],
					"pit": ["pit", "radio"],
					"tyre": ["tyre"],
					"weather": ["weather"]
				}[view.radio_filter]
				if event.kind not in kinds:
					continue
			lines.append(
				"%02d:%02d  %s" % [int(event.time / 60), int(fmod(event.time, 60)), event.text]
			)
		view.log_label.text = (
			"\n\n".join(lines) if not lines.is_empty() else "No matching events yet."
		)


static func _present_commands(view, c: Dictionary, q: bool) -> bool:
	view.automate.set_pressed_no_signal(c.auto)
	view.repair.set_pressed_no_signal(c.repair)
	view.battle_picker.select(["patient", "balanced", "assertive"].find(c.battle_mode))
	view.pace.select(c.pace)
	view.engine.select(c.engine)
	view.compound.select(view.compound_ids.find(c.next_compound))
	view.setup.set_value_no_signal(c.setup)
	var controllable = c.player and not c.dnf and not c.finished
	for button in [
		view.automate, view.pace, view.engine, view.compound, view.repair, view.battle_picker
	]:
		button.disabled = not controllable
	view.box_button.disabled = (
		not controllable
		or view.sim.phase != "race"
		or c.route != "track"
		or c.pit_order and c.scheduled_lap < 1
	)
	view.cancel_box.disabled = not controllable or not c.pit_order or c.route != "track"
	view.send_button.disabled = (
		not controllable
		or view.sim.phase != "qualifying"
		or view.sim.qual_closed
		or c.route != "garage"
	)
	view.recall_button.disabled = (
		not controllable or view.sim.phase != "qualifying" or c.route != "track"
	)
	view.box_button.get_parent().visible = not q
	view.send_button.get_parent().visible = q
	view.pace.visible = not q
	view.engine.visible = not q
	view.repair.visible = not q
	view.setup.get_parent().visible = false  # Complete setup has one staged editing surface.
	view.setup.editable = (
		controllable and (view.sim.phase in ["briefing", "race_preparation"] or c.route == "garage")
	)
	view.command_note.text = (
		"Spectating a rival. Select MER or MOR to give commands."
		if not c.player
		else (
			"Engineer controls releases and strategy."
			if c.auto
			else "Manual control. Pace, engine and pit calls are yours."
		)
	)
	view.pit_note.text = (
		(
			"Existing hot laps may finish."
			if view.sim.qual_closed
			else "Garage → Out → Hot → In → Garage"
		)
		if q
		else (
			view.sim.pit_status(c)
			if c.pit_order or c.route == "pit"
			else (
				"Planned compound: %s · %s\nRecommended now: %s"
				% [
					view.sim.tyre_info(c.next_compound).get("name", "Tyres"),
					"repair" if c.repair else "tyres only",
					view.sim.tyre_info(view.sim.recommended_compound()).get("name", "Tyres")
				]
			)
		)
	)
	view.box_button.tooltip_text = "Late calls defer safely to the following pit entry."
	view.cancel_box.tooltip_text = "A car already in the pit lane cannot cancel entry."
	return controllable
