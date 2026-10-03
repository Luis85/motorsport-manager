class_name WeekendDriverSupport
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func refresh_tyres(view, c: Dictionary, controllable: bool) -> void:
	if view.tyre_readout:
		view.tyre_readout.present()
	if view.tyre_buttons.is_empty():
		return
	var planned = view.sim.planned_set(c, view.sim.phase == "race")
	for i in range(view.tyre_buttons.size()):
		var button = view.tyre_buttons[i]
		button.visible = i < c.tyre_sets.size()
		if not button.visible:
			button.disabled = true
			continue
		var item = c.tyre_sets[i]
		var mounted = item.id == c.set_id
		var selected = not planned.is_empty() and item.id == planned.id
		var state = (
			"FITTED" if mounted else ("PLANNED" if selected else ("USED" if item.used else "FRESH"))
		)
		button.text = "%s  %d%%\n%s" % [item.label, item.life, state]
		button.disabled = (
			not controllable
			or c.route == "pit"
			or not WheelTyres.usable(item)
			or view.sim.phase == "race" and mounted
		)
		UI.set_active(button, selected)
		button.tooltip_text = (
			"%s · %d°C · %.2f laps · %d mounts\nCondition and temperature persist when removed."
			% [item.id, item.temperature, item.laps, item.mounts]
		)
	view.tyre_summary.text = view.sim.strategy_advice(c)
	view.schedule_button.disabled = (
		not controllable
		or view.sim.phase != "race"
		or c.route != "track"
		or c.pit_order
		or view.sim.laps <= 1
	)
	view.unschedule_button.disabled = not controllable or c.route != "track" or c.scheduled_lap < 1
	view.schedule_label.text = (
		(
			"Booked for lap %d. Box cancels this plan and calls the next safe entry."
			% c.scheduled_lap
		)
		if c.scheduled_lap > 0
		else (
			"No stop scheduled. Lap numbers refer to the entry gate on that racing lap, not "
			+ "crossing the finish line."
		)
	)
	view.stint_plot.queue_redraw()


static func current_decision(view, c: Dictionary) -> Dictionary:
	if view.sim.phase != "race" or not c.player or c.dnf or c.finished or c.route == "pit":
		return {"signature": "", "text": "", "badge": "CLEAR", "color": UI.GOOD, "topic": 0}
	if c.health < 55:
		return {
			"signature": "%s:health:%d" % [c.id, int(c.health / 10)],
			"text":
			"%s · Car condition %d%% · review recovery or pit service" % [c.short, c.health],
			"badge": "CAR",
			"color": UI.DANGER,
			"topic": 0
		}
	if c.tyre < 28:
		return {
			"signature": "%s:tyre:%d" % [c.id, int(c.tyre / 5)],
			"text":
			"%s · Tyre life %d%% · current set is becoming the limiting factor" % [c.short, c.tyre],
			"badge": "TYRE",
			"color": UI.ACCENT,
			"topic": 3
		}
	if view.sim.race_forecaster_fuel_margin(c) < 0.35:
		return {
			"signature":
			"%s:fuel:%d" % [c.id, int(floor(view.sim.race_forecaster_fuel_margin(c) * 4))],
			"text":
			(
				"%s · Estimated finish fuel %+.1f laps · review engine policy"
				% [c.short, view.sim.race_forecaster_fuel_margin(c)]
			),
			"badge": "FUEL",
			"color": UI.ACCENT,
			"topic": 0
		}
	if (
		c.scheduled_lap > 0
		and c.scheduled_lap <= int(maxf(0, c.distance) / view.sim.track.length) + 2
	):
		return {
			"signature": "%s:pit:%d" % [c.id, c.scheduled_lap],
			"text":
			(
				"%s · Pit plan active for lap %d · review stop plan before commitment"
				% [c.short, c.scheduled_lap]
			),
			"badge": "PIT",
			"color": UI.ACCENT,
			"topic": 3
		}
	return {"signature": "", "text": "", "badge": "CLEAR", "color": UI.GOOD, "topic": 0}
