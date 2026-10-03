class_name StrategyDeskDraft
extends VBoxContainer
## All plan editing is local until Approve. Live controls name their driver explicitly.
signal command_requested(action: String, payload: Dictionary)
signal preview_changed(forecast: Dictionary)
var timeline: RaceStrategyChart
var timeline_toggle: Button
var model: RaceViewQuery
var driver_id = 3
var drafts: Dictionary = {}
var revisions: Dictionary = {}
var dirty: Dictionary = {}
var edited: Dictionary = {}
var loading = false
var preview: Dictionary = {}
var live_preview: Dictionary = {}
var target_picker: OptionButton
var draft_status: Label
var plan_status: Label
var objective: OptionButton
var starting_set: OptionButton
var stop_count: SpinBox
var stop_rows: Array = []
var avoid_traffic: CheckButton
var emergency: CheckButton
var tyre_target: SpinBox
var fuel_target: SpinBox
var apply_button: Button
var clear_button: Button
var ownership_controls: Dictionary = {}
var override_label: Label
var estimates: Label
var rejoin: Label
var issue_text: Label
var briefing_text: Label
var box_now: Button
var extend_draft: Button
var action_buttons: Array[Button] = []
var last_refresh = -100.0
var compact_host = false
var topic = 0
var commit_bar: VBoxContainer
var plan_actions: VBoxContainer
var compare_actions: HBoxContainer
var policy_fields: VBoxContainer
var details_toggle: Button
var topic_panels: Array[VBoxContainer] = []
var topic_buttons: Array[Button] = []


func configure(sim: RaceViewQuery) -> void:
	model = sim
	driver_id = model.player_ids()[0]


func select_driver(id: int) -> void:
	if id not in model.player_ids() or driver_id == id:
		return
	live_preview = {}
	driver_id = id
	target_picker.select(model.player_ids().find(id))
	load_current(false)


func populate_sets(control: OptionButton, selected: String) -> void:
	control.clear()
	for item in model.car(driver_id).tyre_sets:
		control.add_item(
			"%s · %.0f%% %s" % [item.label, item.life, "used" if item.used else "fresh"]
		)
		var i = control.item_count - 1
		control.set_item_metadata(i, item.id)
		control.set_item_disabled(i, not WheelTyres.usable(item))
		if item.id == selected:
			control.select(i)


func new_draft(template: String) -> void:
	edited[driver_id] = true
	var draft = model.strategy_draft(model.car(driver_id), model.laps, template)
	if model.phase == "race":
		draft.starting_set = model.car(driver_id).set_id
	drafts[driver_id] = draft
	revisions[driver_id] = model.policy(driver_id).revision
	dirty[driver_id] = true
	show_draft()


func load_current(discard: bool) -> void:
	if discard or not drafts.has(driver_id):
		edited[driver_id] = false
		var current = model.active_plan(driver_id)
		drafts[driver_id] = (
			model.strategy_draft(model.car(driver_id), model.laps)
			if current.is_empty()
			else current
		)
		if model.phase == "race":
			drafts[driver_id].starting_set = model.car(driver_id).set_id
		revisions[driver_id] = model.policy(driver_id).revision
		dirty[driver_id] = current.is_empty()
	show_draft()


func show_draft() -> void:
	loading = true
	var draft = drafts[driver_id]
	objective.select(StrategyPlan.OBJECTIVES.find(draft.objective))
	populate_sets(starting_set, draft.starting_set)
	stop_count.value = draft.stops.size()
	for i in range(3):
		var stop = (
			draft.stops[i]
			if i < draft.stops.size()
			else {
				"from_lap": mini(model.laps - 1, 2 + i * 3),
				"to_lap": mini(model.laps - 1, 3 + i * 3),
				"set_id": "%d-H%d" % [driver_id, (i % 2) + 1]
			}
		)
		stop_rows[i].first.value = stop.from_lap
		stop_rows[i].last.value = stop.to_lap
		populate_sets(stop_rows[i].set, stop.set_id)
		stop_rows[i].row.visible = i < draft.stops.size()
	avoid_traffic.set_pressed_no_signal("avoid_traffic" in draft.branches)
	emergency.set_pressed_no_signal(draft.allow_emergency)
	tyre_target.value = draft.tyre_reserve
	fuel_target.value = draft.fuel_reserve
	loading = false
	preview = {}
	call("refresh", true)


func changed() -> void:
	if loading:
		return
	edited[driver_id] = true
	var stops: Array = []
	for i in range(3):
		stop_rows[i].row.visible = i < int(stop_count.value)
		if i < int(stop_count.value):
			stops.append(
				{
					"from_lap": int(stop_rows[i].first.value),
					"to_lap": int(stop_rows[i].last.value),
					"set_id": stop_rows[i].set.get_item_metadata(stop_rows[i].set.selected)
				}
			)
	drafts[driver_id] = {
		"version": 1,
		"driver_id": driver_id,
		"objective": StrategyPlan.OBJECTIVES[objective.selected],
		"starting_set": starting_set.get_item_metadata(starting_set.selected),
		"stops": stops,
		"branches": ["avoid_traffic"] if avoid_traffic.button_pressed else [],
		"allow_emergency": emergency.button_pressed,
		"tyre_reserve": tyre_target.value,
		"fuel_reserve": fuel_target.value
	}
	dirty[driver_id] = true
	preview = {}
	call("refresh", true)


func apply() -> void:
	command_requested.emit(
		"approve_plan",
		{
			"id": driver_id,
			"revision": revisions[driver_id],
			"plan": drafts[driver_id].duplicate(true)
		}
	)
	if (
		model.policy(driver_id).revision != revisions[driver_id]
		and model.policy(driver_id).plan == drafts[driver_id]
	):
		revisions[driver_id] = model.policy(driver_id).revision
		dirty[driver_id] = false
	call("refresh", true)


func commit_preview() -> void:
	if preview.is_empty():
		return
	command_requested.emit(
		"pit",
		{
			"id": driver_id,
			"forecast_key": preview.key,
			"forecast_time": preview.time,
			"expected_gate": preview.gate.distance,
			"set_id": preview.replacement_id
		}
	)
	preview = {}
	call("refresh", true)


func draft_extension() -> void:
	for candidate in preview.get("options", []):
		if candidate.id != "extend" or not candidate.available:
			continue
		var stops: Array = []
		for stop in candidate.stops:
			var lap = roundi(stop.at - model.track.pit_entry / model.track.length) + 1
			stops.append({"from_lap": lap, "to_lap": lap, "set_id": stop.set_id})
		drafts[driver_id].stops = stops
		drafts[driver_id].starting_set = model.car(driver_id).set_id
		dirty[driver_id] = true
		edited[driver_id] = true
		show_draft()
		call("show_topic", 1)
		return


func has_user_edits() -> bool:
	for id in edited:
		if edited[id] and dirty.get(id, false):
			return true
	return false
