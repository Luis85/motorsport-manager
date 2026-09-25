class_name PublicRivalInspector
extends RefCounted
## Presentation boundary for expanded-profile weekends. No command or model writes.
var masks: Dictionary = {}
var restored: Dictionary = {}

func configure(view: WeekendView) -> void:
	for index in [0, 1, 3, 4]:
		var page = view.tabs.get_tab_control(index).get_child(0).get_child(0)
		var label = UI.paragraph(""); label.add_theme_font_size_override("font_size", 13)
		page.add_child(label); label.hide(); masks[index] = label

func restore() -> void:
	for control in restored:
		if is_instance_valid(control): control.visible = restored[control]
	restored.clear()
	for label in masks.values(): label.hide()

func conceal(control: Control) -> void:
	if not restored.has(control): restored[control] = control.visible
	control.hide()

func present(view: PracticeWeekendView) -> void:
	var sim = view.sim
	if not sim.rival_styles.enabled: return
	var order = sim.standings(sim.phase in ["qualifying", "qualifying_results"])
	for i in range(order.size()):
		var car = order[i]
		if car.player: continue
		var row = view.rows[int(car.id)]
		var state = "OUT" if car.dnf else ("FIN" if car.finished else ("PIT" if car.route == "pit" else ("BOX" if car.route == "garage" else "RUN")))
		row.set_text(4, state)
		var description = "%s · %s\n%s\nObserved compound %s; condition and future plans are private." % [car.name, car.team, RivalStyles.PROFILES[sim.rival_styles.drivers[int(car.id)].style].label, car.compound]
		for column in range(5): row.set_tooltip_text(column, description)
	var car = sim.cars[sim.selected_id]
	if car.player: return
	for control in [view.resource_row, view.compact_resources, view.intent_label, view.driver_plan_label, view.pit_note, view.advisory_button, view.trace]: conceal(control)
	for index in masks:
		var label = masks[index]
		for child in label.get_parent().get_children():
			if child != label and child is Control: conceal(child)
		label.text = RivalStyles.public_driver(sim.rival_styles, car)
		label.visible = true
