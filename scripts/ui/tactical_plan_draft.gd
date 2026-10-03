class_name TacticalPlanDraft
extends VBoxContainer
## Native Plan -> Review -> Follow-up. Display state never grants race authority.
signal command_requested(action: String, payload: Dictionary)
signal driver_selected(id: int)
signal reading_requested(title: String, text: String, invoker: Control)
var model: RaceViewQuery
var driver_id = 3
var text_scale = 1.0
var drafts: Dictionary = {}
var edited: Dictionary = {}
var loading = false
var stage = "plan"
var preview: Dictionary = {}
var reviewed_plan: Dictionary = {}
var reviewed_revision = -1
var reviewed_policy_revision = -1
var picker: OptionButton
var kind: OptionButton
var rival: OptionButton
var replacement: OptionButton
var authority: OptionButton
var first: SpinBox
var last: SpinBox
var wait: SpinBox
var fuel: SpinBox
var floor_life: SpinBox
var traffic: CheckButton
var rival_first: CheckButton
var live_label: Label
var draft_label: Label
var comparison: Label
var commit_bar: VBoxContainer
var refresh_button: Button
var approve_button: Button
var end_button: Button
var evidence_button: Button
var team_button: Button
var edit_button: Button
var reset_button: Button
var limits_button: Button
var limits_summary: Label
var authority_help: Label
var intention_help: Label
var stage_label: Label
var status_copy: Label
var case_copy: Label
var plan_body: VBoxContainer
var review_body: VBoxContainer
var status_body: VBoxContainer
var limits_body: VBoxContainer
var extension_row: VBoxContainer
var option_rows: Array = []
var confirm_dialog: ConfirmationDialog
var pending: Dictionary = {}
var notice = ""
var reveal_serial = 0


func configure(sim: RaceViewQuery) -> void:
	model = sim
	driver_id = model.player_ids()[0]


func choose_driver(id: int) -> void:
	if id not in model.player_ids():
		return
	driver_id = id
	if not drafts.has(id):
		drafts[id] = model.tactical_forecast_draft(id)
		edited[id] = false
	var p = drafts[id]
	loading = true
	picker.select(model.player_ids().find(id))
	kind.select(TacticalForecast.KINDS.find(p.kind))
	rival.select(-1)
	for i in range(rival.item_count):
		if rival.get_item_metadata(i) == int(p.target_id):
			rival.select(i)
	replacement.clear()
	for item in model.car(id).tyre_sets:
		var why = (
			" · fitted"
			if item.id == model.car(id).set_id
			else (
				" · unusable"
				if not WheelTyres.usable(item)
				else (
					" · wet-weather"
					if model.tyre_info(item.compound).get("family", "slick") != "slick"
					else ""
				)
			)
		)
		replacement.add_item("%s · %.0f%%%s" % [item.id.get_slice("-", 1), item.life, why])
		replacement.set_item_metadata(replacement.item_count - 1, item.id)
		if item.id == p.set_id:
			replacement.select(replacement.item_count - 1)
	first.value = p.from_lap
	last.value = p.to_lap
	wait.value = p.wait_laps
	authority.select(TacticalForecast.AUTHORITIES.find(p.authority))
	fuel.value = p.fuel_reserve
	floor_life.value = p.tyre_floor
	traffic.button_pressed = p.avoid_traffic
	rival_first.button_pressed = p.rival_first
	loading = false
	preview = {}
	reviewed_plan = {}
	notice = ""
	stage = (
		"status"
		if not model.tactical_current(id).is_empty() and not edited.get(id, false)
		else "plan"
	)
	call("refresh")


func changed() -> void:
	if loading or authority == null or traffic == null or rival_first == null:
		return
	drafts[driver_id] = {
		"kind": TacticalForecast.KINDS[kind.selected],
		"target_id": int(rival.get_selected_metadata()) if rival.selected >= 0 else -1,
		"set_id": str(replacement.get_selected_metadata()) if replacement.selected >= 0 else "",
		"from_lap": int(first.value),
		"to_lap": int(last.value),
		"wait_laps": int(wait.value),
		"authority": TacticalForecast.AUTHORITIES[authority.selected],
		"fuel_reserve": fuel.value,
		"tyre_floor": floor_life.value,
		"avoid_traffic": traffic.button_pressed,
		"rival_first": rival_first.button_pressed
	}
	edited[driver_id] = true
	preview = {}
	reviewed_plan = {}
	notice = ""
	stage = "plan"
	call("refresh")


func change_kind() -> void:
	if loading:
		return
	loading = true
	if kind.selected == 1:
		last.value = mini(model.laps - 1, maxi(int(last.value), int(first.value + wait.value)))
	loading = false
	changed()


func toggle_limits() -> void:
	# Move focus before hiding controls; never leave it inside a collapsed section.
	limits_button.grab_focus()
	limits_body.visible = not limits_body.visible
	call("refresh")


func edit_draft() -> void:
	stage = "plan"
	notice = ""
	call("refresh")
	call("reveal_control", kind)


func reset_draft() -> void:
	call(
		"request_confirmation",
		"reset",
		"Reset %s's draft?" % model.car(driver_id).short,
		(
			"Replace this driver's unapplied choices with current defaults?\n\nThe active "
			+ "tactic, race orders and the other driver's draft stay unchanged."
		),
		"Reset draft",
		reset_button
	)


func show_evidence() -> void:
	reading_requested.emit("Tactical evidence", model.tactical_debrief(), evidence_button)


func authority_copy(plan: Dictionary) -> String:
	return (
		(
			"Approval delegates pit timing for this tactic only. Other controls keep their "
			+ "existing owners."
		)
		if plan.authority == "execute"
		else (
			"Advice only. No new execution authority; existing pit ownership and orders stay "
			+ "unchanged."
		)
	)
