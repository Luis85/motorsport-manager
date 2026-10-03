class_name ContentScenarioControls
extends RefCounted


## Explicit alternative to custom setup. Selection and reading never start a race.
static func append(host: Control, parent: Control) -> void:
	var scenarios = App.content_catalog.entries("scenario")
	if scenarios.is_empty():
		return
	var row = HBoxContainer.new()
	parent.add_child(row)
	row.add_child(UI.label("SCENARIO", 12, UI.MUTED))
	var selection = UI.option(
		["Choose a scenario…"] + scenarios.map(func(entry): return entry.name), func(_index): pass
	)
	selection.name = "ContentScenario"
	selection.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	selection.clip_text = true
	row.add_child(selection)
	var actions = HBoxContainer.new()
	row.add_child(actions)
	var review = UI.button(
		"Review scenario",
		func():
			if selection.selected <= 0:
				return
			if not host.launch_draft.stage_scenario(scenarios[selection.selected - 1].id):
				UI.notify(host, "Scenario needs attention", host.launch_draft.last_error)
				return
			host.show_welcome()
	)
	review.name = "ReviewContentScenario"
	review.disabled = true
	review.tooltip_text = "Choose a scenario to review its frozen circuit and weekend preset."
	actions.add_child(review)
	var read = UI.button(
		"Read brief",
		func():
			if selection.selected > 0:
				UI.notify(
					host,
					"Scenario brief",
					ScenarioBrief.describe(scenarios[selection.selected - 1].brief)
				)
	)
	read.disabled = true
	actions.add_child(read)
	selection.item_selected.connect(
		func(index):
			review.disabled = index <= 0
			read.disabled = index <= 0
	)
