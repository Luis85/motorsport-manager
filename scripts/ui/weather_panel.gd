class_name WeatherPanel
extends VBoxContainer
## Stable native controls; all calculations are observational and commands name their own driver.
signal command_requested(action: String, payload: Dictionary)
signal surface_requested
var model: WeatherRaceSim
var driver_id = 3
var advice: Dictionary = {}
var summary: Label
var outlook_label: Label
var cases_label: Label
var limits: Label
var options: Array[Label] = []
var box: Button
var hold: Button
var selectors: Array[Button] = []
var sector_labels: Array[Label] = []

func configure(value: WeatherRaceSim) -> void: model = value

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	var drivers = HBoxContainer.new(); add_child(drivers)
	for id in [3, 6]:
		var button = UI.button(model.cars[id].short + " weather", func(): choose_driver(id))
		StrategyDesk.compact_button(button); drivers.add_child(button); selectors.append(button)
	var actions = HBoxContainer.new(); add_child(actions)
	box = UI.button("Box MER", submit_box, true); actions.add_child(box)
	hold = UI.button("Keep plan", submit_hold); actions.add_child(hold)
	var surface_button = UI.button("Surface map", func(): surface_requested.emit()); actions.add_child(surface_button)
	for button in [box, hold, surface_button]: StrategyDesk.compact_button(button)
	summary = UI.paragraph(""); summary.add_theme_font_size_override("font_size", 12); add_child(summary)
	var sectors = HBoxContainer.new(); add_child(sectors)
	for i in range(3):
		var label = UI.label("", 11, UI.ACCENT); label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		sectors.add_child(label); sector_labels.append(label)
	outlook_label = UI.paragraph(""); outlook_label.add_theme_font_size_override("font_size", 12); add_child(outlook_label)
	cases_label = UI.paragraph(""); cases_label.add_theme_font_size_override("font_size", 11); add_child(cases_label)
	for i in range(3):
		var label = UI.paragraph(""); label.add_theme_font_size_override("font_size", 12); add_child(label); options.append(label)
	limits = UI.paragraph("", UI.MUTED); limits.add_theme_font_size_override("font_size", 11); add_child(limits)
	refresh()

func choose_driver(id: int) -> void:
	if id not in [3, 6]: return
	driver_id = id; advice = {}; refresh()

func payload() -> Dictionary:
	return {"id": driver_id, "time": advice.time, "key": advice.key, "weather_key": advice.weather_key,
		"set_id": advice.replacement_id, "gate": advice.gate.distance}

func submit_box() -> void:
	if advice.is_empty() or box.disabled: return
	# Deliberately send the displayed snapshot. Do not silently refresh a stale click into a different order.
	command_requested.emit("weather_box", payload())
	advice = {}; refresh()

func submit_hold() -> void:
	if advice.is_empty() or hold.disabled: return
	command_requested.emit("weather_hold", payload())
	advice = {}; refresh()

func refresh() -> void:
	if model == null or summary == null: return
	if advice.is_empty() or model.weather_stale(advice) or model.total_time - advice.time >= 3: advice = model.weather_advice(driver_id)
	var c = model.cars[driver_id]; var p = model.policy(driver_id)
	var outlook = advice.outlook; var observed = outlook.observed
	for i in range(2): selectors[i].disabled = driver_id == [3, 6][i]
	box.text = "Box " + c.short
	var legal = model.phase == "race" and c.route == "track" and not c.dnf and not c.finished and not c.pit_order
	box.disabled = not legal or advice.replacement_id.is_empty() or advice.gate.distance >= model.laps * model.track.length
	hold.disabled = not legal
	hold.text = "Plan retained" if model.weather_state.held[driver_id] == WeatherStrategy.decision_key(advice) else "Keep plan"
	hold.tooltip_text = "Retain this weather choice until material conditions change. Approved windows still apply; no order, ownership, pause or speed is changed."
	box.tooltip_text = "Fit %s at safe gate lap %d%s. Revalidated on activation; this takes manual pit ownership only." % [advice.replacement_id, advice.gate.lap, " (deferred entry)" if advice.gate.deferred else ""]
	var mode = "Seeded weather" if outlook.mode == "seeded" else "Scripted training / legacy schedule"
	summary.text = "%s · %s\nObserved rain %.0f%% · measured line water %.0f%% (%s)\nPit owner: %s. Ignored: keep existing plan and ownership." % [c.short, mode, observed.rain * 100, observed.mean * 100, WeatherOutlook.condition(observed.mean), p.owners.pit]
	if not legal: summary.text += "\nComparison only: wait for a running car without a pending stop."
	for i in range(3): sector_labels[i].text = "S%d · %.0f%% %s" % [i + 1, observed.sectors[i] * 100, WeatherOutlook.condition(observed.sectors[i])]
	outlook_label.text = "%s · %s\n%s\nWettest line point %.0f%%; off-line peak %.0f%%. Rainfall is not surface grip." % [outlook.trend.capitalize(), outlook.confidence, outlook.message, observed.peak * 100, observed.off_line_peak * 100]
	if not outlook.arrival.is_empty(): outlook_label.text += "\nPossible rain window: %.0f–%.0f simulated seconds (~%.0f–%.0fs at %d×); unknown duration." % [outlook.arrival.low, outlook.arrival.high, outlook.arrival.low / model.speed, outlook.arrival.high / model.speed, model.speed]
	cases_label.text = "STRESS CASES · %.1f-lap horizon%s\nLine water after ~%.0fs: drier %.0f%% / trend %.0f%% / wetter %.0f%%. Not probabilities." % [advice.horizon_laps, " (partial race)" if advice.partial_horizon else "", outlook.horizon_seconds, outlook.cases[0].water * 100, outlook.cases[1].water * 100, outlook.cases[2].water * 100]
	for i in range(3):
		options[i].visible = i < advice.options.size()
		if not options[i].visible: continue
		var option = advice.options[i]
		options[i].text = option.title
		if not option.available: options[i].text += "\nUnavailable: " + option.reason; continue
		options[i].text += "\nEstimated time %.0f–%.0fs · finish/resource risk %s" % [option.low, option.high, option.risk]
		if i > 0 and option.has("gain_low"): options[i].text += "\nEstimated gain vs plan %+.0f to %+.0fs; negative values mean a loss." % [option.gain_low, option.gain_high]
	if not box.disabled:
		options[1].text += "\nGate L%d%s · decision closes in ~%.0fs simulated (~%.1fs at %d×)." % [advice.gate.lap, " deferred" if advice.gate.deferred else "", advice.gate.deadline, advice.gate.deadline / model.speed, model.speed]
		options[1].text += "\nPit loss %.0f–%.0fs; box queue ~%.1fs; possible traffic: %s." % [advice.pit.loss_low, advice.pit.loss_high, advice.pit.queue, "none observed" if advice.pit.traffic.is_empty() else ", ".join(advice.pit.traffic)]
	limits.text = advice.limitations + "\n" + outlook.limitations
