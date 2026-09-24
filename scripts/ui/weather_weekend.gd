class_name WeatherWeekendView
extends StrategyWeekendView
## Weather is a contextual native view over the same live race. No panel changes time controls.
var weather_panel: WeatherPanel
var weather_links: Dictionary = {}

func _ready() -> void:
	super._ready()
	if not sim is WeatherRaceSim: return
	detail_picker.add_item("Weather & crossovers")
	var page = tab_page("Weather")
	weather_panel = WeatherPanel.new(); weather_panel.configure(sim); page.add_child(weather_panel)
	weather_panel.command_requested.connect(targeted_command)
	weather_panel.surface_requested.connect(func(): canvas.show_surface = true; canvas.queue_redraw())
	for id in [3, 6]:
		var link = UI.button("Weather", func(): open_weather(id))
		StrategyDesk.compact_button(link); decision_controls[id].compare.get_parent().add_child(link)
		weather_links[id] = link
	guide.steps.insert(6, {"title": "Rain is not the road", "body": "Weather separates observed rain from measured surface water. Compare three uncertain cases, the shared-box loss and the safe entry. Keep plan changes no order. The forecast cannot read hidden weather targets; both cars retain their own pit ownership.", "target": func(): return tabs, "reveal": func(): open_weather(3)})
	refresh()

func open_weather(id: int) -> void:
	if weather_panel == null or id not in [3, 6]: return
	select_driver(id); weather_panel.choose_driver(id); tabs.current_tab = 9; refresh()

func refresh() -> void:
	super.refresh()
	if weather_panel == null: return
	var rainfall = "Heavy rain" if sim.rain >= 0.60 else ("Rain" if sim.rain >= 0.08 else "No rain")
	weather_label.text = rainfall + " · Line water %d%%" % roundi(sim.average(sim.water) * 100)
	weather_label.tooltip_text = "Observed rain %.0f%%. Measured surface water is separate; weather mode: %s." % [sim.rain * 100, sim.weather_state.model.mode]
	if tabs.current_tab == 9:
		weather_panel.refresh()
		pit_note.visible = false; box_button.get_parent().visible = false
		if not detail_expanded:
			driver_label.visible = false; resource_row.visible = false; compact_resources.visible = true; intent_label.visible = false
	for id in [3, 6]:
		var issue = sim.weather_issue(id)
		var link = weather_links[id]
		link.text = "Weather !" if not issue.is_empty() else "Weather"
		link.tooltip_text = issue + ". Inspect the public observations and three alternatives; existing orders stay active." if not issue.is_empty() else "Inspect weather and crossover alternatives for " + sim.cars[id].short
		if not issue.is_empty():
			decision_controls[id].battle.text = "Weather: " + issue + " · compare before calling"
			decision_controls[id].battle.tooltip_text = issue + ". " + RacecraftController.describe(strategy_model.battle_state, id, sim.cars)
	if tabs.current_tab == 7:
		# Rebuild from evidence rather than appending repeatedly during presentation refreshes.
		var subset = strategy_model.strategy_state.records.filter(func(record): return record.driver_id in [-1, 3, 6])
		var state = {"truncated": strategy_model.strategy_state.truncated, "records": subset.slice(maxi(0, subset.size() - 100))}
		debrief_text.text = WeekendScenarios.team_result(strategy_model) + "\n\n" + sim.weather_debrief() + "\n\n" + "\n\n".join(RaceJournal.debrief(state))
		if subset.size() > 100: debrief_text.text += "\n\nLatest 100 team records. Export retains the full journal."
