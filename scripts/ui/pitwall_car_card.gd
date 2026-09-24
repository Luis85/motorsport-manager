class_name PitwallCarCard
extends RefCounted
## Structured presentation of the existing driver's decisions; no model mutation.
var position: Label
var name_label: Button
var status: Label
var facts: Array[Label] = []
var issue: Label
var controls: Dictionary
var details_button: Button
var panel: PanelContainer
var actions: HFlowContainer
var prior_style = ""

func build(host: PanelContainer, existing: Dictionary, car: Dictionary, details: Callable) -> void:
	panel = host; controls = existing
	var body = host.get_child(0)
	for key in ["heading", "summary", "detail", "battle"]: controls[key].visible = false
	var header = UI.hbox(body); body.move_child(header, 0)
	position = UI.label("P—", 22); position.custom_minimum_size.x = 45; header.add_child(position)
	name_label = UI.button(car.short + " · " + car.name.get_slice(" ", 1), details); name_label.add_theme_font_size_override("font_size", 14); name_label.alignment = HORIZONTAL_ALIGNMENT_LEFT; name_label.add_theme_stylebox_override("normal", UI.action_box(Color.TRANSPARENT, Color.TRANSPARENT)); name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; header.add_child(name_label)
	status = UI.label("", 12, PitwallDesign.MUTED); header.add_child(status)
	var metrics = UI.hbox(body); body.move_child(metrics, 1)
	for text in ["FITTED TYRE", "FINISH FUEL · EST.", "NEXT STOP"]:
		var column = UI.vbox(metrics); column.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		column.add_child(UI.label(text, 11, PitwallDesign.MUTED))
		var value = UI.label("—", 13); value.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; column.add_child(value); facts.append(value)
	issue = UI.label("", 12); issue.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; issue.custom_minimum_size.y = 34; body.add_child(issue); body.move_child(issue, 2)
	var old_actions = controls.compare.get_parent()
	actions = HFlowContainer.new(); actions.add_theme_constant_override("h_separation", 5); actions.add_theme_constant_override("v_separation", 4); body.add_child(actions)
	for child in old_actions.get_children(): child.reparent(actions)
	old_actions.queue_free()
	details_button = name_label; details_button.tooltip_text = car.name + ": read this driver's full issue, deadline, control ownership and available actions."
	for button in actions.get_children():
		button.custom_minimum_size.y = 32
		button.add_theme_font_size_override("font_size", 12)

func refresh(model: StrategyRaceSim, id: int) -> void:
	var car = model.cars[id]; var policy = model.policy(id); var decision = controls.card
	var rank = model.standings(model.phase in ["qualifying", "qualifying_results"]).find(car)
	position.text = "OUT" if car.dnf else "P%d" % (rank + 1)
	name_label.text = car.short + " · " + car.name.get_slice(" ", 1)
	var pace_owner = "You" if policy.owners.pace == "player" else "Engineer"
	status.text = "FINISHED" if car.finished else ("RETIRED" if car.dnf else ("PIT ORDER" if car.pit_order else (["Conserve", "Balanced", "Push"][car.pace] + " · " + pace_owner)))
	if not car.finished and not car.dnf and not car.pit_order and policy.overrides.has("engine"):
		status.text = ["Save fuel", "Standard engine", "Engine attack"][car.engine] + " · You"
	facts[2].get_parent().get_child(0).text = "PITS · " + ("YOU" if policy.owners.pit == "player" else "ENGINEER")
	var fitted = TyreInventory.find(car, car.set_id)
	var minimum = 100.0
	for wheel in fitted.get("wheels", {}).values(): minimum = minf(minimum, float(wheel.get("life", 100)))
	facts[0].text = "%s · %.0f%% min" % [car.set_id.get_slice("-", 1), minimum]
	facts[0].tooltip_text = controls.summary.tooltip_text + "\nInspect Car / Wheels for individual limiting conditions."
	facts[1].text = "%+.1f laps" % RaceForecaster.fuel_margin(model, car)
	facts[1].tooltip_text = "Estimated finish margin in lap-equivalent units under the current engine policy. Not litres or a guaranteed result."
	var next = int(policy.next_stop)
	var stops = policy.plan.get("stops", [])
	facts[2].text = "Committed" if car.route == "pit" else ("Ordered" if car.pit_order else ("L%d–%d" % [stops[next].from_lap, stops[next].to_lap] if next < stops.size() else ("No stop planned" if policy.plan.is_empty() else "To finish")))
	facts[2].tooltip_text = "A planned window is not a physical order. Inspect Strategy / Plan for approval and stock."
	issue.text = decision.get("title", "Plan active" if not policy.plan.is_empty() else "No approved plan · compare options")
	if decision.is_empty() and not controls.battle.text.ends_with("Clear running"): issue.text = controls.battle.text.trim_prefix("Team & battles: ")
	if not decision.is_empty() and decision.get("deadline", -1) >= 0:
		issue.text += " · ~%.0f s sim%s" % [decision.deadline, " (paused)" if model.paused else " / %.1f s at %dx" % [decision.deadline / model.speed, model.speed]]
	issue.tooltip_text = controls.heading.tooltip_text + "\n" + controls.detail.text + "\n" + controls.battle.tooltip_text
	if car.route == "pit": issue.text = "In pit lane · frozen service plan and physical queue"
	if car.finished or car.dnf: issue.text = "Race complete · open Review / Debrief for measured outcomes"
	var key = "warning" if decision.get("priority", 0) >= 90 else ("selected" if model.selected_id == id else "normal")
	if prior_style != key:
		prior_style = key
		var style = UI.box(UI.PANEL, UI.DANGER if key == "warning" else (UI.PRIMARY if key == "selected" else UI.LINE), 5, 8)
		style.border_width_left = 1; panel.add_theme_stylebox_override("panel", style)
