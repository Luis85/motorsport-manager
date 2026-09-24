class_name RecoveryWeekendView
extends WeatherWeekendView
## The two car cards remain primary. Recovery evidence scrolls; its actions do not.
var recovery_panel: RecoveryPanel
var recovery_links: Dictionary = {}
var recovery_page_index = -1

func _ready() -> void:
	super._ready()
	if not sim is RecoveryRaceSim: return
	detail_picker.add_item("Recovery & race control")
	recovery_panel = RecoveryPanel.new(); recovery_panel.configure(sim); tabs.add_child(recovery_panel)
	recovery_page_index = tabs.get_tab_count() - 1
	recovery_panel.command_requested.connect(targeted_command)
	for id in [3, 6]:
		var controls = decision_controls[id]
		controls.compare.text = "Strategy"; controls.hold.text = "Keep"; controls.save.text = "Fuel"
		var link = UI.button("Recovery", func(): open_recovery(id)); RecoveryPanel.compact(link)
		controls.compare.get_parent().add_child(link); recovery_links[id] = link
	guide.steps.insert(7, {"title": "Protect the finish", "body": "Recovery compares continuing, saving engine resources and a real repair-only stop. Repair removes aggregate damage, not lifetime health; the fitted tyres retain their wear. Additional emergency stops require explicit authority and engineer pit ownership. Read the published virtual-neutralization rules below. Actions stay above the scrolling evidence.", "target": func(): return recovery_panel, "reveal": func(): open_recovery(3)})
	refresh()

func open_recovery(id: int) -> void:
	if recovery_panel == null or id not in [3, 6]: return
	select_driver(id); recovery_panel.choose_driver(id); tabs.current_tab = recovery_page_index; refresh()

func refresh() -> void:
	super.refresh()
	if recovery_panel == null: return
	if tabs.current_tab == recovery_page_index:
		recovery_panel.refresh(); pit_note.visible = false; box_button.get_parent().visible = false
		driver_label.visible = false; resource_row.visible = false; compact_resources.visible = false; intent_label.visible = false
		teammate_buttons[0].get_parent().visible = false
	var c = sim.cars[sim.selected_id]
	if sim.enhanced():
		repair.disabled = not c.player or c.dnf or c.finished or c.route == "pit" or sim.reliability(int(c.id)).repair_only
		if repair.disabled: repair.tooltip_text = "A committed repair plan is locked; it cannot be changed by this checkbox."
		if not sim.chequered:
			var control = WeekendRaceControl.public_view(sim.control_state, sim.total_time)
			flag_label.text = ("PAUSED · " if sim.paused else "") + ("VIRTUAL ENDING" if control.state == "ending" else control.flag)
			flag_label.tooltip_text = control.rules + " Open Recovery & race control for persistent details."
	for id in [3, 6]:
		var observed = RaceReliability.observation(sim.cars[id], sim.reliability(id)); var urgent = observed.stage in ["degraded", "critical"]
		recovery_links[id].text = "Recovery !" if urgent else "Recovery"
		recovery_links[id].tooltip_text = "%s · %s · observed damage %.0f, lifetime health %.0f%%. Compare protect/repair/retire without changing the other car's orders." % [sim.cars[id].short, observed.stage, observed.damage, observed.health]
		if urgent:
			var weather = sim.weather_issue(id)
			decision_controls[id].battle.text = "%s · damage %.0f · health %.0f%%%s" % [observed.stage.to_upper(), observed.damage, observed.health, " · Weather !" if not weather.is_empty() else ""]
			decision_controls[id].battle.tooltip_text = recovery_links[id].tooltip_text + ("\n" + weather if not weather.is_empty() else "")
	if tabs.current_tab == 7: debrief_text.text = sim.recovery_debrief() + "\n\n" + debrief_text.text
